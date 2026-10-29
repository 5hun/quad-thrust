#include "GP1.H"
#include <strings.h>

extern GsOT Wot[2];
extern PACKET packet[2][PACKET_MAX*24];
extern GsOT Wot_CAR[8];
extern GsOT_TAG zsortTable_CAR[8][1<<OT_LENGTH_CAR];
extern GsOT_TAG zsortTable_BACK[2][1<<OT_LENGTH_BACK];

extern GsCOORDINATE2 CRD_C[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_RD_R[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_KAGE[MAX_CAR_NUM];
extern struct s_SYSTEM_DATA Gsys;
extern struct s_BESTLAP_RECORD best_data;
extern struct s_SYSTEM_SAVEDATA save_data;
extern struct s_REPLAY_HEAD replay_head[4], n_replay_data;
extern char *cource_name[];
//extern struct s_CARS_DATA cars_data[MAX_CAR_NUM];
extern struct s_CARS_DATA *cars_scra[4];

extern volatile u_char *pd0, *pd1;
extern struct s_CAR_PROPATIE CARS_PROPATIE[6];

void draw_minicar( GsOT *ot, int x, int y, int n, int z )
{
	GsSPRITE sp={ 2<<24, 0,0, 16,16, 0,
						 0,0, 0,480, 128,128,128, 0,0, 4096, 4096, 0 };
	sp.x=x;
	sp.y=y;
	sp.tpage=_GetTPage(2,0,384,256 );
	sp.scalex=sp.scaley=z;
	sp.u=32, sp.v=n*16;
	sp.w=24, sp.h=16;
	GsSortSprite( &sp, ot, 0 );
}

void draw_wall( GsOT *ot, int y )
{
	GsSPRITE sp={ 1<<24, 0,0, 16,16, 0,
						 0,0, 0,484, 160,155,140, 0,0, 4096, 4096, 0 };
	int xx, yy;

	for (yy=-(y & 31) ; yy<240 ; yy+=32 )
		for (xx=0 ; xx<320 ; xx+=32 )
		{
			sp.x=xx-160;
			sp.y=yy-120+y;
			sp.tpage=_GetTPage(1,0,320,256 );
			sp.u=0, sp.v=0;
			sp.w=32, sp.h=32;
			GsSortSprite( &sp, ot, (1<<OT_LENGTH)-1 );
		}
}

void get_password( char *a, int tim, int mode, int stg )
{
	char word[]="TQRPCJUKFVL23AIW4EMN?H&X79YZ!#-";
	int c=stg*7+mode;
	if (mode==0) c=c*c+tim*tim;
	a[0]=word[((unsigned int)(c+(tim & 7)+(tim>>4)*16+(tim/99))) % 31];
	a[1]=word[((unsigned int)(a[0]*c+tim+tim/(57+c)+((tim*tim+c) & 3)+(a[0] & 7)*61)) % 31];
	a[2]=word[((unsigned int)(a[c & 1]*a[0]+a[1]+tim*(99+c)+(tim & 7)+(tim>>9))) % 31];
	a[3]=word[((unsigned int)(a[2]*a[0]+a[1]+tim+((tim+c) % 125))) % 31];
	a[4]=word[((unsigned int)(a[0]*a[tim & 3]+a[3]+a[1]+tim*(99+c)+(tim & 7)+(tim>>7))) % 31];
	a[5]=word[((unsigned int)(a[0]+a[1]+a[2]+a[3]+a[4]+c+tim+a[tim & 3])) % 31];
	a[6]=0;
}

void view_records2( int sel, int snum )
{
	GsSPRITE sp={ 0<<24, 0,0, 16,16, 0,
						 0,0, 0,487, 160,155,140, 0,0, 4096, 4096, 0 };
	char *sdata[]={
		"Mysterious Wave ","By.Ohmori",
		"Laser Wind      ","By.Ohmori",
		"A North Breeze  ","By.Ohmori",
		"Freezing Moment ","By.Kawakami&Ohmori",
		"Rest On Space   ","By.Ohmori",
		"E.O.E.          ","By.Ohmori",
		"Groove On Night ","By.Ohmori",
		"Drop To The Sky ","By.Ohmori",
		"Dead Heat       ","By.Ohmori",
		"ON!             ","By.Ohmori",
		"Help Mode       ","By.Ohmori",
		"NoTitle -UnUsed-","By.Ohmori"
	};
	char *m_name[]={
		"SAMPLE16.SEQ",
		"SAMPLE15.SEQ",
		"HOVER4.SEQ",
		"TO7.SEQ",
		"ENTRY1.SEQ",
		"SELECT.SEQ",
		"SAMPLE19.SEQ",
		"HOVER2.SEQ",
		"CANION.SEQ",
		"B.SEQ",
		"SAMPLE26.SEQ",
		"SAMPLE21.SEQ"
	};
	int i, l=0,pd=1, pdd=1, md=1, time=160;
	int active;
	MATRIX MT;
	GsOT *ot;
	char tmp[8], tmp2[8];

	Gsys.replay_mode=0;
	Gsys.cource_number=sel;
	Gsys.mine=rand() & 3;
	Gsys.GameMode=1;
	Gsys.replay_mode=0;
	Gsys.bestline=8;
	Gsys.totalline=8;
	game_init( 0, 0 );
	Gsys.replaying=1;
	Gsys.start_count=0;
	for (i=0 ; i<4 ; i++ )
		cars_scra[i]->lev=8;
	Gsys.replay_timming=1140;
	sel+=Gsys.TimeMode*9;
	get_password( tmp, best_data.best_lap[sel][0], 0, sel );
	get_password( tmp2, best_data.total_lap[sel][0], 1, sel );
	strcat( tmp, " " );
	strcat( tmp, tmp2 );
	alphabet16( 448, 128, tmp );

	if (snum!=0)
	{
		md=0;
		SeqPlay( m_name[snum-1], 1 );
		alphabet88( 576, 8*22+32, sdata[snum*2-2] );
		alphabet88( 576, 8*23+32, sdata[snum*2-1] );
	}
	while( pdd || pd!=PADRdown )
	{
		if (time) time--;
		pdd=pd;
		pd=padd(pd0);
		if (snum && (pd & PADLright) && (pdd!=PADLright))
		{
			snum++;
			if (snum==13) snum=1;
			time=160;
			SeqPlay( m_name[snum-1], 1 );
			alphabet88( 576, 8*22+32, sdata[snum*2-2] );
			alphabet88( 576, 8*23+32, sdata[snum*2-1] );
		}
		if (snum && (pd & PADLleft) && (pdd!=PADLleft))
		{
			snum--;
			if (snum==0) snum=12;
			time=160;
			SeqPlay( m_name[snum-1], 1 );
			alphabet88( 576, 8*22+32, sdata[snum*2-2] );
			alphabet88( 576, 8*23+32, sdata[snum*2-1] );
		}
//		for (i=0 ; i<4 ; i++)
		car_preope( 4 );
		cars_distance_set();
		for (i=0 ; i<4 ; i++)
			car_enemy( i, 0xffffffff );
		Gsys.time++;
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		ot=&Wot[active];
		GsClearOt( 0, 0, ot );
		view_set( 0 );
		for (i=0 ; i<4 ; i++)
		{
			GsGetLs( &CRD_C[i], &MT );
			l=(MT.t[2]>>(14-OT_LENGTH_CAR))-100;
			if (l>=15 && l<((1<<OT_LENGTH)-120))
			{
				GsClearOt( 0, l, &Wot_CAR[(active<<2)+i] );
				cars_scra[i]->draw=1;
			}
		}
		Gsys.replay_timming+=md;
		if (snum==0 && (pd & PADR1) && (pd & PADR2) && (pd & PADL1) && (pd & PADL2))
		{
			sp.x=-16*6-8;
			sp.y=-8;
			sp.tpage=_GetTPage(0,0,448,0 );
			sp.u=0, sp.v=128;
			sp.w=16*13, sp.h=16;
			GsSortSprite( &sp, ot, 0 );
			sp.tpage=_GetTPage(0,0,576,256 );
			Gsys.replay_timming=1140;
		}
		else
			if (Gsys.replay_timming>=1200 && Gsys.replay_timming<1200+60*10)
			{
				best_draw( &Wot[active], OT_LENGTH, 0 );
				if (pdd!=pd && pd) Gsys.replay_timming=1830;
			}
			else
				if (Gsys.replay_timming>=1860 && Gsys.replay_timming<1860+60*10)
				{
					total_draw( &Wot[active], OT_LENGTH, 0 );
					if (pdd!=pd && pd) Gsys.replay_timming=1860+600;
				}
		if (Gsys.replay_timming>=1860+60*10)
			Gsys.replay_timming=1140;
		car_draw( &Wot_CAR[active<<2], OT_LENGTH_CAR );
		back_draw( &Wot[active], OT_LENGTH );
		cource_draw( ot, OT_LENGTH );
		if (snum)
		{
			draw_words_ot(ot,-160+8+time*2,-120+24,16,26,4096,0x808080);
			draw_words_ot(ot,160-8-strlen(sdata[snum*2-1])*8-time*2,120-24,strlen(sdata[snum*2-1]),27,4096,0x808080);
		}
		for (i=0 ; i<Gsys.cars_number ; i++)
			if (cars_scra[i]->draw)
				GsSortOt( &Wot_CAR[(active<<2)+i], ot );
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsDrawOt( &Wot[active] );
	}
	GsSetProjection(PROJECTION_LONG);
	if (Gsys.seq!=-1)
	{
		VSync(0);
		SsUtAllKeyOff(0);
		VSync(0);
		SsSeqStop( Gsys.seq );
		VSync(0);
		SsUtAllKeyOff(0);
		VSync(0);
		SsSeqClose( Gsys.seq );
		VSync(8);
		Gsys.seq=-1;
	}
}

int view_records( int md )
{
	int i, pd=0xffffffff, pdd;
	int col,sel=0,active;
	char tmp[64], r1[16], r2[8];
	alphabet16( 320+256,0, "BEST RECORDS");
	Gsys.TimeMode=md;
	for ( i=0 ; i<9 ; i++ )
	{
		get_record_time( r1, best_data.best_lap[i+md*9][0] );
		get_record_name( r2, best_data.best_name[i+md*9][0] );
		sprintf(tmp, "%s     %s %s",cource_name[i],r1,r2);
		alphabet88( 320+256,16+i*16, tmp );
		get_record_time( r1, best_data.total_lap[i+md*9][0] );
		get_record_name( r2, best_data.total_name[i+md*9][0] );
		sprintf(tmp, "%s %s",r1,r2);
		alphabet88( 320+256,16+i*16+8, tmp );
	}
	while(1)
	{
		pdd=pd;
		pd=padd(pd0);
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		for (i=0;i<9;i++)
		{
			if (sel==i)
				col=128<<8;
			else
				col=0x808080;
			draw_words_ot(&Wot[active],-160+16, -120+24+i*24,8+4+3+18,i*2+2,4096,col);
			draw_words_ot(&Wot[active],-160+16+8*21, -120+24+10+i*24,12,i*2+3,4096,col);
			draw_minicar( &Wot[active],-160+16+8*18, -120+24+i*24, best_data.used_car[i+md*9][0] & 15, 2048 );
			draw_minicar( &Wot[active],-160+16+8*18, -120+24+10+i*24, best_data.used_car[i+md*9][1] & 15, 2048 );
		}
		draw_words_ot16(&Wot[active],-160+8, -120,12,0,4096,0x000080);
		if (_PAD( pdd, pd, PADRdown ))
		{
			pcm( SND_CANCEL );
			break;
		}
		if (_PAD( pdd, pd, PADLup ) && sel!=0)
		{
			pcm( SND_CHANGE );
			sel--;
		}
		if (_PAD( pdd, pd, PADLdown ) && sel!=8)
		{
			pcm( SND_CHANGE );
			sel++;
		}
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
		if (_PAD( pdd, pd, PADRright ))
		{
			pcm( SND_OK );
			DrawSync(0);
			VSync(0);
			view_records2( sel, 0 );
			DrawSync(0);
			return(1);
		}
	}
	return(0);
}

void music_mode()
{
	int i, pd=0xffffffff, pdd;
	int col,sel=0,active;
	char *m_name[]={
		"Mysterious Wave ","SAMPLE16.SEQ",
		"Laser Wind      ","SAMPLE15.SEQ",
		"A North Breeze  ","HOVER4.SEQ",
		"Freezing Moment ","TO7.SEQ",
		"Rest On Space   ","ENTRY1.SEQ",
		"E.O.E.          ","SELECT.SEQ",
		"Groove On Night ","SAMPLE19.SEQ",
		"Drop To The Sky ","HOVER2.SEQ",
		"Dead Heat       ","CANION.SEQ",
		"ON!             ","B.SEQ",
		"Help Mode       ","SAMPLE26.SEQ",
		"NoTitle -UnUsed-","SAMPLE21.SEQ"
	};
	alphabet16( 320+256,0, "MUSIC MODE");
	for ( i=0 ; i<12 ; i++ )
		alphabet16( 320+256,16+i*16, m_name[i*2] );
	while(1)
	{
		pdd=pd;
		pd=padd(pd0);
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		for (i=0;i<12;i++)
		{
			if (sel==i)
				col=128<<8;
			else
				col=0x808080;
			draw_words_ot16(&Wot[active],-128, -120+32-8+8+i*17,16,i+1,4096,col);
		}
		draw_words_ot16(&Wot[active],-160+8, -120+8,10,0,4096,0x800000);
		if (_PAD( pdd, pd, PADRdown ))
		{
			pcm( SND_CANCEL );
			break;
		}
		if (_PAD( pdd, pd, PADLup ) && sel!=0)
		{
			pcm( SND_CHANGE );
			sel--;
		}
		if (_PAD( pdd, pd, PADLdown ) && sel!=11)
		{
			pcm( SND_CHANGE );
			sel++;
		}
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
		if (_PAD( pdd, pd, PADRright ))
		{
			pcm( SND_OK );
			DrawSync(0);
			VSync(0);
			view_records2( rand() % 9, sel+1 );
			alphabet16( 320+256,0, "MUSIC MODE");
			for ( i=0 ; i<7 ; i++ )
				alphabet16( 320+256,16+i*16, m_name[i*2] );
		}
	}
}


void japanese( int xp, int yp, char *ch, int mode )
{
	#define _getPIX( aa, x, y ) ((aa[(x+y*(im.pw*4))/2]>>((x & 1)*4)) & 15)
	#define _putPIX( bb, x, y, a ) \
	{\
		int xx, yy;\
		xx=x,yy=y;\
		if (x>=im.pw*4) xx=im.pw*4-1;\
		if (x<0) xx=0;\
		if (y>=im.ph) yy=im.ph-1;\
		if (y<0) yy=0;\
		bb[(xx+yy*(im.pw*4))/2]=(bb[(xx+yy*(im.pw*4))/2] & (15<<(4-(xx & 1)*4))) | (a<<((xx & 1)*4));\
	}
	u_long fbuff[32*128+84];
	u_long fbuff2[32*128+84];
	u_char *aa, *bb;
	char moji[32*2];
	GsIMAGE im, im2;
	int x, y, a;

	if (strlen(ch)==0) return;
	if (strlen(ch)>32) japanese( xp+64, yp, ch+32, mode );
	strcpy(moji,ch);
	moji[32]=0;
	Krom2Tim( moji ,fbuff, xp, yp,0,480,32767,0);
	memcpy( fbuff2, fbuff, sizeof(fbuff2) );
	GsGetTimInfo( fbuff+1, &im );
	GsGetTimInfo( fbuff2+1, &im2 );
	aa=(u_char *)im.pixel;
	bb=(u_char *)im2.pixel;
	if (mode & 1)
	{	
		for( y=0 ; y<im.ph ; y++ )
			for( x=0 ; x<im.pw*4 ; x++ )
			{
				a=_getPIX( aa, x, y );
				if (a==1)
					_putPIX( bb, x+1, y, a );
			}
		memcpy( fbuff, fbuff2, sizeof(fbuff2) );
		GsGetTimInfo( fbuff+1, &im );
		GsGetTimInfo( fbuff2+1, &im2 );
		aa=(u_char *)im.pixel;
		bb=(u_char *)im2.pixel;
	}
	if (mode & 2)
	{	
		for( y=0 ; y<im.ph ; y++ )
			for( x=0 ; x<im.pw*4 ; x++ )
			{
				a=_getPIX( aa, x, y );
				if (a==1)
				{
					_putPIX( bb, x+1, y, 2 );
					_putPIX( bb, x, y+1, 2 );
					_putPIX( bb, x, y-1, 3 );
					_putPIX( bb, x-1, y, 3 );
				}
			}
		for( y=0 ; y<im.ph ; y++ )
			for( x=0 ; x<im.pw*4 ; x++ )
			{
				a=_getPIX( aa, x, y );
				if (a)
					_putPIX( bb, x, y, 1 );
			}
		memcpy( fbuff, fbuff2, sizeof(fbuff2) );
		GsGetTimInfo( fbuff+1, &im );
		GsGetTimInfo( fbuff2+1, &im2 );
		aa=(u_char *)im.pixel;
		bb=(u_char *)im2.pixel;
		if (mode & 4)
		{
			im.clut[0]=(((31<<5)+(31<<10)+(31))<<16);
			im.clut[1]=(7<<5)+(7<<10)+(7)+(((15<<5)+(15<<10)+15)<<16);
		}
		else
		{
			im.clut[0]=(((2<<5)+(2<<10)+(2))<<16);
			im.clut[1]=(7<<5)+(6<<10)+(8)+(((15<<5)+(14<<10)+16)<<16);
		}
	}
	loadTim( fbuff );
}

int select( char *a[], int n, int sel2 )
{
	int i, pd=0xffffffff, pdd;
	int col,sel,active;

	sel=sel2;
	_BOXFILL( 320+256,0,128,256,0,0,0);
	for (i=0 ; i<n+1 ; i++ )
		japanese( 320+256, i*16, a[i], 3 );

	while(1)
	{
		pdd=pd;
		pd=padd(pd0);
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		draw_wall( &Wot[active], 0 );
		for (i=0;i<n;i++)
		{
			if (sel==i)
				col=128<<8;
			else
				col=0x808080;
			draw_words_ot_j(&Wot[active],-128, -120+40+i*24,strlen(a[i+1])/2,i+1,4096,col);
		}
		draw_words_ot_j(&Wot[active],-160+8, -120+8,strlen(a[0])/2,0,4096,0x008000);
		if (_PAD( pdd, pd, PADRdown ))
		{
			pcm( SND_CANCEL );
			sel=-1;
			break;
		}
		if (_PAD( pdd, pd, PADLup ) && sel!=0)
		{
			pcm( SND_CHANGE );
			sel--;
		}
		if (_PAD( pdd, pd, PADLdown ) && sel!=n-1)
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
//		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}
	return( sel );
}

void draw_help_sign( GsOT *ot )
{
	GsSPRITE sp={ 1<<24, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	int y;
	int bx[]={0,1,1,0,1};
	int by[]={2,2,1,1,0};
	for ( y=0 ; y<5 ; y++ )
	{
		sp.tpage=_GetTPage( 1,0,320, 256);
		sp.x=-160+32;
		sp.y=-120+10+2*28+28*5*y;
		sp.w=32,sp.h=32;
		sp.u=bx[y]*32,sp.v=by[y]*32;
		sp.cx=0;
		sp.cy=484;
		GsSortFastSprite( &sp, ot, 0 );
	}
}

void line( GsOT *ot, int x, int y, int xx, int yy, int col )
{
	GsLINE li;
	li.x0=x, li.x1=x+xx;
	li.y0=y, li.y1=y+yy;
	li.r=(col>>16) & 255;
	li.g=(col>>8) & 255;
	li.b=(col) & 255;
	li.attribute=0;
	GsSortLine( &li, ot, 0 );
}

void draw_help_car0( GsOT *ot, int timming, int sw )
{
	SVECTOR VX={0,0,0};
	MATRIX MT;
	GsSPRITE sp={ 0<<24, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	SVECTOR VR;
	VECTOR VR2;
	int x, y, i;
	if (sw==2)
		VX.vy=2048+128;
	else
		VX.vy=(timming*8) & 4095;
	RotMatrix( &VX, &CRD_C[0].coord );
	CRD_C[0].coord.t[0]=0;
	CRD_C[0].flg=0;
	RotMatrix( &VX, &CRD_KAGE[0].coord );
	CRD_KAGE[0].coord.t[0]=0;
	CRD_KAGE[0].flg=0;
	GsClearOt( 0, 10, &Wot_CAR[((timming & 1)<<2)] );
	cars_scra[0]->draw=1;
	cars_scra[0]->attribute=1;
	cars_scra[0]->over=0;
	switch( sw )
	{
	case 0:
		GsGetLs( &CRD_C[0], &MT );
		VR=CARS_PROPATIE[0].RADDER_L;
		VR.vy+=32;
		VR.vz-=64;
		ApplyMatrix( &MT, &VR, &VR2 );
		VR2.vx+=MT.t[0];
		VR2.vy+=MT.t[1];
		VR2.vz+=MT.t[2];
		x=VR2.vx*PROJECTION_LONG/VR2.vz;
		y=VR2.vy*PROJECTION_LONG/VR2.vz;
		line( ot, x, y, 20, -10, 0 );
		line( ot, x+20, y-10, 0, -10, 0 );
		sp.tpage=_GetTPage( 0,0,448, 0);
		sp.x=x+20, sp.y=y-20;
		sp.w=8*6, sp.h=8;
		sp.u=0, sp.v=128;
		sp.cx=0, sp.cy=487;
		sp.b=128;
		sp.r=sp.g=32;
		GsSortFastSprite( &sp, ot, 0 );
		break;
	case 1:
		Gsys.time++;
		Gsys.GameMode=0;
		cars_scra[0]->turbo=0;
		cars_scra[0]->boost_wr&=~1;
		car_fire( 0, 64 );
		GsGetLs( &CRD_C[0], &MT );
		VR=CARS_PROPATIE[0].BOOSTER_BL;
		ApplyMatrix( &MT, &VR, &VR2 );
		VR2.vx+=MT.t[0];
		VR2.vy+=MT.t[1];
		VR2.vz+=MT.t[2];
		x=VR2.vx*PROJECTION_LONG/VR2.vz;
		y=VR2.vy*PROJECTION_LONG/VR2.vz;
		line( ot, x, y, 20, -10, 0 );
		line( ot, x+20, y-10, 0, -10, 0 );
		sp.tpage=_GetTPage( 0,0,448, 0);
		sp.x=x+20, sp.y=y-20;
		sp.w=8*7, sp.h=8;
		sp.u=0, sp.v=128;
		sp.cx=0, sp.cy=487;
		sp.b=128;
		sp.r=sp.g=32;
		GsSortFastSprite( &sp, ot, 0 );
		break;
	case 2:
		Gsys.time++;
		Gsys.GameMode=0;
		for (i=0 ; i<4 ; i++ )
		{
			cars_scra[0]->boost_wr&=~(1<<(i+1));
			car_boost( 0, i );
			GsGetLs( &CRD_C[0], &MT );
			VR=(*((SVECTOR *)&(CARS_PROPATIE[0].BOOSTER_L1)+i));
			ApplyMatrix( &MT, &VR, &VR2 );
			VR2.vx+=MT.t[0];
			VR2.vy+=MT.t[1];
			VR2.vz+=MT.t[2];
			x=VR2.vx*PROJECTION_LONG/VR2.vz;
			y=VR2.vy*PROJECTION_LONG/VR2.vz;
			if (i<2)
			{
				line( ot, x, y, -20, -10, 0 );
//				line( ot, x-20, y-10, 0, -10, 0 );
				sp.x=x-20-8*10, sp.y=y-20;
			}
			else
			{
				line( ot, x, y, 20, -10, 0 );
//				line( ot, x+20, y-10, 0, -10, 0 );
				sp.x=x+20, sp.y=y-20;
			}
			sp.tpage=_GetTPage( 0,0,448, 0);
			sp.w=8*10, sp.h=8;
			sp.u=0, sp.v=128+i*8;
			sp.cx=0, sp.cy=487;
			sp.b=128;
			sp.r=sp.g=64;
			GsSortFastSprite( &sp, ot, 0 );
		}
		break;
	}
	car_draw( &Wot_CAR[(timming & 1)<<2], OT_LENGTH_CAR );
	GsSortOt( &Wot_CAR[((timming & 1)<<2)], ot );
}

void book( char *fname, int mode )
{
	GsSPRITE sp={ 0<<24, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	GsBOXF box={1<<30,0,0,37*8,40,0,0,0};
	unsigned char *script=PACKED_WORK_ADDR, *sc;
	VECTOR VZ={0,0,0};
	int line=0;
	int yp=0, yl=0, tim=0;
	int i, pd=0xffffffff, pdd;
	int active;
	RECT rect;
	GsF_LIGHT light;
	GsRVIEW2 viewR;

	light.vx=0;
	light.vy=256;
	light.vz=128;
	light.r=230;
	light.g=230;
	light.b=230;
	GsSetFlatLight(0, &light);
	Gsys.light=light;
	GsSetAmbient( LIGHT_AMBIENT, LIGHT_AMBIENT, LIGHT_AMBIENT );//Žü•ÓŒõ
	GsSetLightMode( 0 );
	setRECT( &rect, 1024-256, 512-128, 128, 128 );
	StoreImage( &rect, (u_long *)COURCETMD_ADDR );
	VSync(0);
	DrawSync(0);
	LZS_unpack_one( COURCETMD_ADDR, script, 0x1000, fname );
	for( i=0 ; i<0x1000 ; i++ )
	{
		if (( script[i]+(script[i+1]<<8) )==0x0a0d)
			script[i]=0;
	}
	sc=script;
	_BOXFILL( 320+256,0,64+128*3,256,0,0,0);
	DrawSync(0);
	if (mode!=1)
		for (i=0 ; i<96 ; i++ )
		{
			if (strcmp(sc,"END")==0) break;
			if (strcmp( fname, "about.txt" )==0 && i==30)
				japanese( 320+256+(i/16)*64, (i & 15)*16, "@@@‚u‚…‚’@‚PD‚Q‚O‚O", 3 );
			else
				japanese( 320+256+(i/16)*64, (i & 15)*16, sc, 3 );
			sc+=strlen(sc)+2;
			line++;
		}
	else
		for (i=0 ; i<96 ; i++ )
		{
			if (strcmp(sc,"END")==0) break;
			japanese( 320+256+(i/16)*64+32-strlen(sc), (i & 15)*16, sc, 3 );
			sc+=strlen(sc)+2;
			line++;
		}
	if (mode>=3)
	{
		if (mode>5)
			car_init( 0, 0x1, mode-6, 0, WORLD,0 );
		else
			car_init( 0, 0x1, 0, 0, WORLD,0 );
		car_position( 0, &VZ, 1 );
	}
	switch(mode)
	{
	case -1:
		alphabet88( 448, 128, "http://www.sakuranet.or.jp/~uzusio/" );
		alphabet88( 448, 128+8, "E-Mail:uzusio@sakuranet.or.jp" );
		break;
	case 3:
		alphabet88( 448, 128, "RADDER" );
		break;
	case 4:
		alphabet88( 448, 128, "BOOSTER" );
		break;
	case 5:
		alphabet88( 448, 128, "SLASTER L1" );
		alphabet88( 448, 128+8, "SLASTER L2" );
		alphabet88( 448, 128+16, "SLASTER R1" );
		alphabet88( 448, 128+24, "SLASTER R2" );
		break;
	}
	while(1)
	{
		viewR.vpx = 0;
		viewR.vpy = -((double)PROJECTION_LONG)*3;
		viewR.vpz = ((double)PROJECTION_LONG)*1.7320508*3;
		viewR.vrz = 0;
		viewR.vry = 0;
		viewR.vrx = 0;
		viewR.rz = 0;
		viewR.super = WORLD;
		GsSetRefView2( &viewR );
		pdd=pd;
		pd=padd(pd0);
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		draw_wall( &Wot[active], yp );
		for (i=0;i<10;i++)
		{
			yl=yp/28+i;
			draw_words_ot_j2(&Wot[active],-160+32, -120+10+yl*28,16,yl,4096,0x808080,1);
		}
		switch( mode )
		{
		case -1:
			box.x=-4*37;
			box.y=-120+10+line*28-28*2-8;
			GsSortBoxFill( &box, &Wot[active],2 );
			sp.b=128,sp.g=128;
			sp.r=128;
			sp.tpage=_GetTPage( 0,0,448, 0);
			sp.cx=0, sp.cy=487;
			sp.x=-4*35, sp.y=-120+10+line*28-28*2+16;
			sp.w=8*29, sp.h=8;
			sp.u=0, sp.v=128+8;
			GsSortFastSprite( &sp,&Wot[active], 0 );
			sp.tpage=_GetTPage( 0,0,448, 0);
			sp.cx=0, sp.cy=487;
			sp.x=-4*35, sp.y=-120+10+line*28-28*2;
			sp.w=256, sp.h=8;
			sp.u=0, sp.v=128;
			GsSortFastSprite( &sp,&Wot[active], 0 );
			sp.tpage=_GetTPage( 0,0,448+64, 0);
			sp.x=-4*35+256, sp.y=-120+10+line*28-28*2;
			sp.w=8*35-256, sp.h=8;
			sp.u=0, sp.v=128;
			GsSortFastSprite( &sp,&Wot[active], 0 );
			break;
		case 2:
			draw_help_sign( &Wot[active] );
			break;
		case 3:
		case 4:
		case 5:
		case 6:
		case 7:
		case 8:
		case 9:
		case 10:
		case 11:
			draw_help_car0( &Wot[active], tim++, mode-3 );
			break;
		}
		if (_PAD( pdd, pd, PADRdown ))
		{
			pcm( SND_CANCEL );
			break;
		}
		if ((pd & PADLup) && yp>=2)
			if (pd & PADRleft) yp-=4; else yp-=2;
		if ((pd & PADLdown) && yp<line*28-228)
			if (pd & PADRleft) yp+=4; else yp+=2;
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsSetOffset(160,120-yp);
//		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}
}

void online_help()
{
	int sel=0, sel2=0, om;
	char *menus[]={
		"‚g‚d‚k‚o@u‚à‚­‚¶v",
		"‚Í‚¶‚ß‚É","‘€ì‚É‚Â‚¢‚Ä","ƒ}ƒVƒ“Ð‰î","ƒQ[ƒ€ƒ‚[ƒhÐ‰î",
		"˜H–Ê‚Ì‹L†‚É‚Â‚¢‚Ä","ƒZ[ƒuEƒ[ƒh‚É‚Â‚¢‚Ä","‚±‚ÌƒQ[ƒ€‚É‚Â‚¢‚Ä","ƒXƒ^ƒbƒt"
	};
	char *menus2[]={
		"‚g‚d‚k‚o@u‘€ì‚É‚Â‚¢‚Äv",
		"¶‰Eiƒ‰ƒ_[j",
		"ã‰ºiŒX‚«j",
		"~ƒ{ƒ^ƒ“iƒu[ƒXƒ^[j",
		" ƒ{ƒ^ƒ“iƒ^[ƒ{j",
		"›ƒ{ƒ^ƒ“iƒuƒŒ[ƒLj",
		"‚q‚P‚q‚QE‚k‚P‚k‚QiƒXƒ‰ƒXƒ^[j"
	};
	char *menus3[]={
		"‚g‚d‚k‚o@uƒ}ƒVƒ“Ð‰îv",
		"‚k‚t‚r‚s‚d‚q",
		"‚d‚w‚b‚d‚k",
		"‚a‚d‚s‚`",
		"‚i‚t‚r‚s‚d‚q",
		"‚`‚k‚o‚g‚`",
		"‚r‚t‚y‚t‚j‚h"
	};
	while(1)
	{
		sel=select( menus, 8, sel );
		if (sel==-1) break;
		switch( sel )
		{
//INTRO
		case 0:
			book( "intro.txt",0 );
			break;
//KEY
		case 1:
			sel2=0;
			while(1)
			{
				sel2=select( menus2, 6, sel2 );
				if (sel2==-1) break;
				switch(sel2)
				{
				case 0:
					book("radder.txt",3);
					break;
				case 1:
					book("move.txt",0);
					break;
				case 2:
					book("booster.txt",4);
					break;
				case 3:
					book("turbo.txt",0);
					break;
				case 4:
					book("brake.txt",0);
					break;
				case 5:
					book("slaster.txt",5);
					break;
				}
			}
			break;
//INTRO CAR
		case 2:
			sel2=0;
			om=0;
			if (save_data.omake & (1<<2)) om++;
			if (save_data.omake & (1<<3)) om++;
			while(1)
			{
				sel2=select( menus3, 4+om, sel2 );
				if (sel2==-1) break;
				switch(sel2)
				{
				case 0:
					book("luster.txt",6);
					break;
				case 1:
					book("excel.txt",7);
					break;
				case 2:
					book("beta.txt",8);
					break;
				case 3:
					book("juster.txt",9);
					break;
				case 4:
					book("alpha.txt",10);
					break;
				case 5:
					book("suzuki.txt",11);
					break;
				}
			}
			break;
//GAMEMODE
		case 3:
			book("MODES.txt",0);
			break;
//SIGN
		case 4:
			book("sign.txt",2);
			break;
//ABOUT REPLAY
		case 5:
			book( "replay.txt",0 );
			break;
//TEC
		case 6:
			book( "about.txt",-1 );
			break;
//STAFF
		case 7:
			book("staff.txt",1);
			break;
		}
	}
}
