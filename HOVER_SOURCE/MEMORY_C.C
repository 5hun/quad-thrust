#include "GP1.H"
#include <sys\file.h>

extern GsOT Wot[2];
extern PACKET packet[2][PACKET_MAX*24];

extern struct s_SYSTEM_DATA Gsys;
extern struct s_BESTLAP_RECORD best_data;
extern struct s_SYSTEM_SAVEDATA save_data;
extern struct s_REPLAY_HEAD replay_head[4], n_replay_data;

extern volatile u_char *pd0, *pd1;
extern char *cource_name[];

int sam_set()
{
	int i, s=0;
	for( i=0 ; i<sizeof(struct s_BESTLAP_RECORD) ; i++ )
		s+=((char *)&best_data)[i]+8+i+
			((char *)&best_data)[i]*((char *)&best_data)[sizeof(struct s_BESTLAP_RECORD)-i-1];
	return( s );
}

void error_message( char *message )
{
	int active, i;
	u_long fbuff[32*128+84];
	static GsSPRITE sp={ 0, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };

	Krom2Tim(message,fbuff,320+256,0,0,480,32767,0);
	loadTim( fbuff );

	sp.tpage=_GetTPage(0,0,320+256, 0);
	for ( i=0 ; i<120 ; i++ )
	{
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		sp.x=-strlen(message)*4,sp.y=-8;
		sp.w=8*strlen(message),sp.h=16;
		sp.u=0,sp.v=0;
		sp.cx=0, sp.cy=480;
		if ((i & 15)>4)
			GsSortFastSprite( &sp, &Wot[active], 0 );
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}
}

void mcard_autoload()
{
	int i, m_mode, fp;
	char fname[32];
	unsigned char t[128];
	draw_message(160-8*21,120-20,"Checking MEMORY CARD");
	for ( i=0 ; i<2 ; i++ )
	{
		m_mode=TestCard( i );
		if (m_mode!=1 && m_mode!=2) continue;
		sprintf( fname, "bu%d0:BNYedg01299HoverVer1", i );
		fp=open( fname, O_RDONLY | O_NOBUF );
		if (fp ==-1) continue;
		lseek( fp, 256, SEEK_SET );
		read( fp, t, 128 );
		if ((t[0] & 1)==0) continue;
		draw_message(160-8*21,120-20,"    LOADING SAVEDATA");
		lseek( fp, 0, SEEK_SET );
		read( fp, (char *)&save_data, sizeof(struct s_SYSTEM_SAVEDATA) );
		read( fp, (char *)&best_data, sizeof(struct s_BESTLAP_RECORD) );
		close( fp );
		Gsys.slot=i;
		if (save_data.sam!=sam_set())
		{
			error_message("セーブデータが不当です");
			exit(1);
		}
		break;
	}
	Gsys.auto_save=((save_data.auto_load_save>>1) & 1)<<i;
	memcpy( Gsys.player_name, save_data.user_name, 3 );
}

void select_format( int slot )
{
	int i, pd=0xffffffff, pdd;
	int col,sel=1,active;
	char tmp[32];
	japanese( 320+256, 0, "フォーマットします", 1 );
	japanese( 320+256, 16, "はい　", 1 );
	japanese( 320+256, 32, "いいえ", 1 );
	while(1)
	{
		pdd=pd;
		pd=padd(pd0);
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		for (i=0;i<2;i++)
		{
			if (sel==i)
				col=128<<8;
			else
				col=0x808080;
			draw_words_ot_j(&Wot[active],-24, -64+i*64, 3, i+1, 4096, col);
		}
		draw_words_ot_j(&Wot[active],-160+8, -120+8,9,0,4096,0x008000);
		if (_PAD( pdd, pd, PADRdown ))
		{
			pcm( SND_CANCEL );
			sel=1;
			break;
		}
		if (_PAD( pdd, pd, PADLup ) && sel!=0)
		{
			pcm( SND_CHANGE );
			sel--;
		}
		if (_PAD( pdd, pd, PADLdown ) && sel!=1)
		{
			pcm( SND_CHANGE );
			sel++;
		}
		if (_PAD( pdd, pd, PADRright ))
		{
			pcm( SND_OK );
			break;
		}
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}
	if (sel==0)
	{
		sprintf( tmp, "bu%d0:", slot );
		if ( format( tmp )==1 )
			error_message("カードを初期化しました");
		else
			error_message("カードの初期化に失敗");
	}
}

int cardtest( int slot, int mode )
{
	int m_mode, size=0, fp;
	char fname[32], tmp[32];
	struct DIRENTRY dir;

	if (slot==2) return(0);
	m_mode=TestCard( slot );
	sprintf( fname, "bu%d0:BNYedg01299HoverVer1", slot );
	switch ( m_mode )
	{
	case 0:
		error_message("カードがありません");
		return(-1);
	case 3:
		error_message("通信またはカードの異常検出");
		return(-1);
	case 4:
		error_message("カードが初期化されていません");
		select_format( slot );
		return(-1);
	}
	fp=open( fname, O_RDONLY | O_NOBUF );
	close( fp );
	if (fp==-1)
	{
		if (mode==1)
		{
			error_message("データがありません");
			return(-1);
		}
//		for (i=0 ; i<32 ; i++)
//		{
//			printf("%2d",dir.system[i]);
//		}
		memset( (char *)&dir, 0, sizeof(struct DIRENTRY));
		sprintf( tmp, "bu%d0:*", slot );
		if (firstfile( tmp, &dir ))
		{
			do
			{
				if (dir.size==0) size+=8192;
				else size+=((dir.size-1) & ((0xf)<<13))+8192;
			}
			while(nextfile( &dir ));
		}
//		printf("data size=%d\n",size);
		if (size>=15*8192)
		{
			error_message("カードに空き領域がありません");
			return(-1);
		}
	}
	return(0);
}

int save( int slot )
{
	char fname[32], clear[256];
	int fp, i;
	save_data.sam=sam_set();
	sprintf( fname, "bu%d0:BNYedg01299HoverVer1", slot );
	if (cardtest( slot, 0 )!=0)
		return(-1);
	fp=open( fname, O_RDONLY | O_NOBUF );
	if (fp==-1)
	{
		fp=open( fname, O_CREAT | (1<<16) | O_NOBUF );
		if (fp==-1) printf("cant create!");
		close(fp);
		memset( clear, 0, sizeof(clear) );
		fp=open( fname, O_WRONLY | O_NOBUF );
		for ( i=0 ; i<8192 ; i+=sizeof(clear) )
			write( fp, clear, sizeof(clear) );
		close(fp);
	}
	else
	{
		close(fp);
	}
	memcpy( save_data.user_name,Gsys.player_name,3 );
	fp=open( fname, O_WRONLY | O_NOBUF );
	if (fp==-1) printf("open ERROR");
	write( fp, (char *)&save_data, sizeof(struct s_SYSTEM_SAVEDATA) );
	write( fp, (char *)&best_data, sizeof(struct s_BESTLAP_RECORD) );
	close(fp);
	return(0);
}

int save_replay( int slot, int sel )
{
	char fname[32];
	char rbuff[8192*3];
	int fp, fsize, i;
	sprintf( fname, "bu%d0:BNYedg01299HoverVer1", slot );
	if (cardtest( slot, 0 )!=0)
		return(-1);
	fp=open( fname, O_RDONLY | O_NOBUF );
	if (fp==-1)
	{
		save( slot );
	}
	else
	{
		close(fp);
	}
	fp=open( fname, O_RDONLY | O_NOBUF );
	lseek( fp, sizeof(struct s_SYSTEM_SAVEDATA)+sizeof(struct s_BESTLAP_RECORD)+sizeof(struct s_REPLAY_HEAD)*3, SEEK_SET );
	for (i=0 ; i<3 ; i++ )
	{
		if (replay_head[i].data_size!=0)
		{
			fsize=((replay_head[i].data_size+127) & (0xff)<<7);
			read( fp, rbuff+8192*i, fsize );
		}
	}
	close(fp);

	memcpy( (char *)&replay_head[sel], (char *)&n_replay_data, sizeof(struct s_REPLAY_HEAD) );
	memcpy( rbuff+8192*sel, REPLAY_BUFF, 8192 );

	fp=open( fname, O_WRONLY | O_NOBUF );
	if (fp==-1) printf("open ERROR");
	lseek( fp, sizeof(struct s_SYSTEM_SAVEDATA)+sizeof(struct s_BESTLAP_RECORD), SEEK_SET );
	write( fp, (char *)&replay_head[0], sizeof(struct s_REPLAY_HEAD)*3 );
	for (i=0 ; i<3 ; i++ )
	{
		if (replay_head[i].data_size!=0)
		{
			fsize=((replay_head[i].data_size+127) & (0xff)<<7);
			write( fp, rbuff+8192*i, fsize );
		}
	}
	close(fp);
	return(0);
}

int delete_replay( int slot, int sel )
{
	char fname[32];
	char rbuff[8192*3];
	int fp, fsize, i;
	sprintf( fname, "bu%d0:BNYedg01299HoverVer1", slot );
	if (cardtest( slot, 0 )!=0)
		return(-1);
	fp=open( fname, O_RDONLY | O_NOBUF );
	lseek( fp, sizeof(struct s_SYSTEM_SAVEDATA)+sizeof(struct s_BESTLAP_RECORD)+sizeof(struct s_REPLAY_HEAD)*3, SEEK_SET );
	for (i=0 ; i<3 ; i++ )
	{
		if (replay_head[i].data_size!=0)
		{
			fsize=((replay_head[i].data_size+127) & (0xff)<<7);
			read( fp, rbuff+8192*i, fsize );
		}
	}
	close(fp);
	replay_head[sel].he=0;
	fp=open( fname, O_WRONLY | O_NOBUF );
	if (fp==-1) printf("open ERROR");
	lseek( fp, sizeof(struct s_SYSTEM_SAVEDATA)+sizeof(struct s_BESTLAP_RECORD), SEEK_SET );
	write( fp, (char *)&replay_head[0], sizeof(struct s_REPLAY_HEAD)*3 );
	for (i=0 ; i<3 ; i++ )
	{
		if (replay_head[i].data_size!=0)
		{
			fsize=((replay_head[i].data_size+127) & (0xff)<<7);
			write( fp, rbuff+8192*i, fsize );
		}
	}
	close(fp);
	return(0);
}

int load_replay( int slot, int sel )
{
	char fname[32];
	char rbuff[8192*3], *buf;
	int fp, fsize, i;

	RECT rect;
	setRECT( &rect, 1024-128, 512-128, 128, 128 );

	sprintf( fname, "bu%d0:BNYedg01299HoverVer1", slot );
	if (cardtest( slot, 1 )!=0)
		return(-1);
	if (slot==2)
	{
		if (Gsys.replay_exist==0)
		{
			StoreImage( &rect, (u_long *)PACKED_WORK_ADDR );
			DrawSync(0);
			buf=rbuff;
			LZS_unpack_one( PACKED_WORK_ADDR, buf, 8192, "replay.dat" );
			buf+=sizeof(struct s_REPLAY_HEAD)*3;
			for (i=0 ; i<3 ; i++ )
			{
				if (i==sel) break;
				fsize=((replay_head[i].data_size+127) & (0xff)<<7);
				buf+=fsize;
			}
			memcpy( (char *)&n_replay_data, (char *)&replay_head[sel], sizeof(struct s_REPLAY_HEAD) );
			memcpy( REPLAY_BUFF, buf,  8192 );
		}
		else
		{
			buf=MEMORY_CARD_GET+12;
			buf+=sizeof(struct s_REPLAY_HEAD)*3;
			for (i=0 ; i<3 ; i++ )
			{
				if (i==sel) break;
				fsize=((replay_head[i].data_size+127) & (0xff)<<7);
				buf+=fsize;
			}
			memcpy( (char *)&n_replay_data, (char *)&replay_head[sel], sizeof(struct s_REPLAY_HEAD) );
			memcpy( REPLAY_BUFF, buf,  8192 );
		}
	}
	else
	{
		fp=open( fname, O_RDONLY | O_NOBUF );
		lseek( fp, sizeof(struct s_SYSTEM_SAVEDATA)+sizeof(struct s_BESTLAP_RECORD)+sizeof(struct s_REPLAY_HEAD)*3, SEEK_SET );
		for (i=0 ; i<3 ; i++ )
		{
			if (replay_head[i].data_size!=0)
			{
				fsize=((replay_head[i].data_size+127) & (0xff)<<7);
				read( fp, rbuff+8192*i, fsize );
			}
		}
		close(fp);
		memcpy( (char *)&n_replay_data, (char *)&replay_head[sel], sizeof(struct s_REPLAY_HEAD) );
		memcpy( REPLAY_BUFF, rbuff+8192*sel,  8192 );
	}
	return(0);
}

int load( int slot )
{
	char fname[32];
	int fp;
	sprintf( fname, "bu%d0:BNYedg01299HoverVer1", slot );
	if (cardtest( slot, 1 )!=0)
		return(-1);
	fp=open( fname, O_RDONLY | O_NOBUF );
	if (fp==-1) printf("open ERROR");
	read( fp, (char *)&save_data, sizeof(struct s_SYSTEM_SAVEDATA) );
	read( fp, (char *)&best_data, sizeof(struct s_BESTLAP_RECORD) );
	close(fp);
	memcpy( Gsys.player_name, save_data.user_name, 3 );
	if (save_data.sam!=sam_set())
	{
		error_message("セーブデータが不当です");
		exit(1);
	}
	return(0);
}

void load_replay_heads( int slot )
{
	char fname[32], buff[8192];
	int fp, i;
	char *blank="               ";
	char *blank2="       ";
	RECT rect;
	setRECT( &rect, 1024-128, 512-128, 128, 128 );
	if (slot==2 && Gsys.replay_exist==1)
	{
		memcpy( (char *)&replay_head[0], MEMORY_CARD_GET+12, sizeof(struct s_REPLAY_HEAD)*3 );
		return;
	}
	if (slot==2)
	{
		StoreImage( &rect, (u_long *)PACKED_WORK_ADDR );
		DrawSync(0);
		LZS_unpack_one( PACKED_WORK_ADDR, buff, sizeof(buff), "replay.dat" );
		memcpy( (char *)&replay_head[0], buff, sizeof(struct s_REPLAY_HEAD)*3 );
		return;
	}
	sprintf( fname, "bu%d0:BNYedg01299HoverVer1", slot );
	for (i=0 ; i<3 ; i++ )
	{
		memset( (char *)&replay_head[i], 0, sizeof(struct s_REPLAY_HEAD) );
		strcpy( replay_head[i].name,blank );
		strcpy( replay_head[i].player_name,blank2 );
	}
	fp=open( fname, O_RDONLY | O_NOBUF );
	if (fp==-1)
		return;
	lseek( fp, sizeof(struct s_SYSTEM_SAVEDATA)+sizeof(struct s_BESTLAP_RECORD), SEEK_SET );
	for (i=0 ; i<3 ; i++ )
	{
		read( fp, (char *)&replay_head[i], sizeof(struct s_REPLAY_HEAD) );
		if (replay_head[i].he!=('h'+('R'<<8)))
		{
			memset( (char *)&replay_head[i], 0, sizeof(struct s_REPLAY_HEAD) );
			strcpy( replay_head[i].name,blank );
			strcpy( replay_head[i].player_name,blank2 );
		}
	}
	close(fp);
}

int replay_file( int slot, int mode )
{
	int m2, enter=0, nex=0, time=0, brk=0;
	char tmp[64], tm[32];
	int pdd, pd=0xffffffff, sel=0, active, col, y;
	int i, flame=0, salph=0;
	char *mode2[]={

	"GrandPrix ",
	"GrandPrix ",
	"Vs        ",
	"TimeAttack",
	"TimeAttack"

	};

	char *car_name[]={
		"Luster",
		"Excel ",
		"Beta  ",
		"Juster",
		"Alpha "
	};
	char *mode_name[]={
		"SAVE REPLAY DATA  ",
		"LOAD REPLAY DATA  ",
		"DELETE REPLAY DATA"
	};
	char *ent=" ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.-+/&?!()";

	m2=mode;
	if (m2==2) mode=1;
	if (cardtest( slot, m2 )!=0)
		return(1);
	load_replay_heads( slot );

	if (m2==0)
	{
		enter=1;
		nex=1;
	}

	_BOXFILL( 320+256,0,128,256,0,0,0 );
	alphabet16( 320+256,8*2+4*24+16+16, mode_name[m2] );
	alphabet88( 320+256,8*2+4*24, "--------------------------------------" );
	if (n_replay_data.he!=('h'+('R'<<8)))
	{
		sprintf(tmp,"NO REPLAY DATA                    ");
		alphabet88( 320+256,8*2+3*24, tmp );
	}
	else
	{
		get_record_time( tm, n_replay_data.total_time );
		sprintf(tmp,"%s,SIZE %4d,TIME %s          ",mode2[n_replay_data.gamemode],n_replay_data.flame_size,tm);
		alphabet88( 320+256,8*2+3*24, tmp );
		sprintf(tmp,"NAME %16s, PLAYER %8s          ",n_replay_data.name,n_replay_data.player_name);
		alphabet88( 320+256,8*2+3*24+8, tmp );
		sprintf(tmp, "CAR %5s, COURCE %16s", car_name[(int)n_replay_data.car], cource_name[(int)n_replay_data.cource] );
		alphabet88( 320+256,8*2+3*24+16, tmp );
	}

	for (i=0 ; i<3 ; i++ )
	{
		if (replay_head[i].he!=('h'+('R'<<8)))
		{
			sprintf(tmp,"NO REPLAY DATA                    ");
			alphabet88( 320+256,8*2+i*24, tmp );
			continue;
		}
		get_record_time( tm,replay_head[i].total_time );
		sprintf(tmp,"%s,SIZE %4d,TIME %s          ",mode2[replay_head[i].gamemode],replay_head[i].flame_size,tm);
		alphabet88( 320+256,8*2+i*24, tmp );
		sprintf(tmp,"NAME %15s, PLAYER %7s    ",replay_head[i].name,replay_head[i].player_name);
		alphabet88( 320+256,8*2+i*24+8, tmp );
		sprintf(tmp, "CAR %5s, COURCE %16s", car_name[(int)replay_head[i].car], cource_name[(int)replay_head[i].cource] );
		alphabet88( 320+256,8*2+i*24+16, tmp );
		flame+=((replay_head[i].data_size+127) & (0xFF<<7));
	}
	sprintf( tmp, "LAST RAM SIZE %4d", 8192-128*16-flame );
	if (slot==2) strcpy( tmp, "                     " );
	alphabet88( 320+256,8*2+4*24+16, tmp );

	while(padd(pd0) & PADRright);

	while( brk==0 )
	{
		pdd=pd;
		pd=padd(pd0);
//		printf("a");
		if (enter)
		{
			time++;
			sel=-2;
			if (nex && nex!=-1)
			{
				salph=0;
				if (enter<15 && n_replay_data.name[enter-1]!=0)
				{
					for (i=0 ; i<strlen(ent) ; i++ )
						if (n_replay_data.name[enter-1]==ent[i]) break;
					salph=i;
				}
				if (enter>=15 && n_replay_data.player_name[enter-15]!=0)
				{
					for (i=0 ; i<strlen(ent) ; i++ )
						if (n_replay_data.player_name[enter-15]==ent[i]) break;
					salph=i;
				}
			}
			if ((pdd!=pd || (time & 7)==0) && pd==PADLup)
			{
				salph++;
				if (salph==73) salph=0;
				if (enter<15) n_replay_data.name[enter-1]=ent[salph];
				if (enter>=15) n_replay_data.player_name[enter-15]=ent[salph];
				time=0;
			}
			if ((pdd!=pd || (time & 7)==0) && pd==PADLdown)
			{
				salph--;
				if (salph==-1) salph=72;
				if (enter<15) n_replay_data.name[enter-1]=ent[salph];
				if (enter>=15) n_replay_data.player_name[enter-15]=ent[salph];
				time=0;
			}
			if ((pdd!=pd || (time & 31)==0) && pd==PADLright)
			{
				enter++;
				if (enter==15+7)
				{
					enter=0;
					sel=0;
					sprintf(tmp,"NAME %15s, PLAYER %7s          ",n_replay_data.name,n_replay_data.player_name);
					alphabet88( 320+256,8*2+3*24+8, tmp );
					continue;
				}
				time=16;
				if (nex==0) nex=1;
			}
			if ((pdd!=pd || (time & 31)==0) && pd==PADLleft && enter!=1)
			{
				enter--;
				time=16;
				if (nex==0) nex=1;
			}
			sprintf(tmp,"NAME %15s, PLAYER %7s          ",n_replay_data.name,n_replay_data.player_name);
			alphabet88( 320+256,8*2+3*24+8, tmp );
			if ((time & 31)>16)
			{
				tmp[0]=' '+16*6-1;
				tmp[1]=0;
				if (enter<15) alphabet88( 320+256+4*2+enter*2,8*2+3*24+8, tmp );
				else alphabet88( 320+256+4*2+enter*2+2*10,8*2+3*24+8, tmp );
			}
		}
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		for (i=0;i<4;i++)
		{
			if (sel==i)
				col=128<<8;
			else
				col=0x808080;
			y=0;
			if (i==3) y=16;
			draw_words_ot(&Wot[active],-160+16,-120+48+y+i*40,38,i*3+2,4096,col);
			draw_words_ot(&Wot[active],-160+16,-120+48+y+i*40+12,38,i*3+3,4096,col);
			draw_words_ot(&Wot[active],-160+16,-120+48+y+i*40+24,38,i*3+4,4096,col);
		}
		draw_words_ot(&Wot[active],-160+8,-120+48+3*40,38,4*3+2,4096,0x808080);
		draw_words_ot16(&Wot[active],-160+8,-120+16,18,9,4096,0x007f7f);
		draw_words_ot(&Wot[active],0,-120+16+16,20,4*3+4,4096,0x808080);
		if ((pdd & PADRdown)==0 && (pd & PADRdown))
		{
			pcm( SND_CANCEL );
			if (m2==0)
			{
				if (enter==0) enter=15+6;
				if (enter) break;
			}
			else
				break;
		}
		if (pdd!=pd && (pd & PADstart))
		{
			pcm( SND_OK );
			enter=0;
			sel=0;
		}
		if ((pdd & PADLdown)==0 && (pd & PADLdown) && sel!=2 && enter==0)
		{
			sel++;
			pcm( SND_CHANGE );
		}
		if ((pdd & PADLup)==0 && (pd & PADLup) && sel!=0 && enter==0)
		{
			sel--;
			pcm( SND_CHANGE );
		}
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
		if (pdd!=pd && pd==PADRright)
		{
			switch( m2 )
			{
			case 0:
				if (sel<0) break;
				i=8192-128*16-flame;
				i+=((replay_head[sel].data_size+127) & (0xFF<<7));
				if (i<n_replay_data.data_size)
				{
					error_message("空き領域が足りません");
					break;
				}
				pcm( SND_OK );
				draw_message(0,120-24,"NOW SAVING");
				save_replay( slot, sel );
				brk=1;
				break;
			case 1:
				pcm( SND_OK );
				if (replay_head[sel].he!=('h'+('R'<<8)))
					break;
				draw_message(0,120-24,"NOW LOADING");
				load_replay( slot, sel );
				brk=1;
				break;
			case 2:
				pcm( SND_OK );
				if (replay_head[sel].he!=('h'+('R'<<8)))
					break;
				draw_message(0,120-24,"NOW DELETING");
				delete_replay( slot, sel );
				brk=1;
				break;
			}
		}
	}
	return(brk);
}

int memory_card( int slot )
{
	int pdd, pd=0xffffffff, sel=0, active, col, ret=0;
	int i, max_s=8;

	alphabet88( 320+256,8*2, "SAVE SYSTEM DATA    ");
	alphabet88( 320+256,8*3, "LOAD SYSTEM DATA    ");
	alphabet88( 320+256,8*4, "AUTO SAVE           ");
	alphabet88( 320+256,8*5, "AUTO LOAD           ");
	alphabet88( 320+256,8*6, "GAME LEVEL          ");
	alphabet88( 320+256,8*7, "SAVE REPLAY DATA    ");
	alphabet88( 320+256,8*8, "LOAD REPLAY DATA    ");
	alphabet88( 320+256,8*9, "DELETE REPLAY DATA  ");
	alphabet88( 320+256,8*10, "LOAD SPECIAL REPLAY ");
	alphabet88( 320+256,8*11, "OFF");
	alphabet88( 320+256,8*12, "ON ");
	alphabet88( 320+256,8*13, "EASY     ");
	alphabet88( 320+256,8*14, "NORMAL   ");
	alphabet88( 320+256,8*15, "HARD     ");
	alphabet88( 320+256,8*16, "EXPART   ");
	strcpy((save_data.card_head+4),"ネットやろうぜ　ＨＯＶＥＲ　ＲＡＣＩＮＧ");
	if (save_data.omake & (1<<1)) max_s++;

	while( ret==0 )
	{
		pdd=pd;
		pd=padd(pd0);
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		for (i=0;i<max_s;i++)
		{
			if (sel==i)
				col=128<<8;
			else
				col=0x808080;
			draw_words_ot(&Wot[active],-160+16,-120+32+i*24,20,i+2,4096,col);
			if (i==2 || i==3)
				draw_words_ot(&Wot[active],-160+16+128,-120+32+i*24,3,11+((save_data.auto_load_save>>(3-i)) & 1),4096,col);
			if (i==4)
				draw_words_ot(&Wot[active],-160+16+128,-120+32+i*24,9,14+save_data.level,4096,col);
		}
		if ((pdd & PADRdown)==0 && (pd & PADRdown))
		{
			pcm( SND_CANCEL );
			break;
		}
		if ((pdd & PADLdown)==0 && (pd & PADLdown) && sel!=(max_s-1))
		{
			sel++;
			pcm( SND_CHANGE );
		}
		if ((pdd & PADLup)==0 && (pd & PADLup) && sel!=0)
		{
			sel--;
			pcm( SND_CHANGE );
		}
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
		if ((pdd & (PADLright | PADLleft))==0 && (pd & (PADLright | PADLleft)) && (sel==2 || sel==3))
		{
			pcm( SND_OK );
			save_data.auto_load_save^=(1<<(3-sel));
			Gsys.auto_save=((save_data.auto_load_save>>1) & 1)<<slot;
		}
		if ((pdd & PADLright)==0 && (pd & PADLright) && sel==4 && save_data.level!=2)
		{
			pcm( SND_OK );
			save_data.level++;
			Gsys.auto_save=((save_data.auto_load_save>>1) & 1)<<slot;
		}
		if ((pdd & PADLleft)==0 && (pd & PADLleft) && sel==4 && save_data.level!=-1)
		{
			pcm( SND_OK );
			save_data.level--;
		}
		if ((pdd & PADRright)==0 && (pd & PADRright) && sel!=2 && sel!=3 && sel!=4)
		{
			pcm( SND_OK );
			switch(sel)
			{
			case 0:
				if (cardtest( slot, 0 )==0)
				{
					draw_message(0,120-24,"NOW SAVING");
					if (save( slot )!=0) return(-1);
				}
				break;
			case 1:
				if (cardtest( slot, 0 )==0)
				{
					draw_message(0,120-24,"NOW LOADING");
					if (load( slot )!=0) return(-1);
				}
				break;
			case 5:
			case 6:
			case 7:
				if (cardtest( slot, 0 )==0)
				{
					if (sel==5 && n_replay_data.he!=('h'+('R'<<8)))
					{
						error_message("リプレイデータがありません");
						break;
					}
					ret=replay_file( slot, sel-5 );
				}
				break;
			case 8:
				ret=replay_file( 2, 1 );
				break;
			}
		}
	}
	Gsys.slot=slot;
	return(ret);
}

void memorycard_put()
{
	int fp;
	char fname[32];

	sprintf( fname, "bu%d0:BNYedg01299HoverVer1", Gsys.slot );
	fp=open( fname, O_RDONLY | O_NOBUF );
	if (fp==-1)
		return;
	lseek( fp, sizeof(struct s_SYSTEM_SAVEDATA)+sizeof(struct s_BESTLAP_RECORD), SEEK_SET );
	strcpy( MEMORY_CARD_PUT, "HoVeRRePlAy" );
	read( fp, MEMORY_CARD_PUT+12, 0x2000-12 );
	close(fp);
}
