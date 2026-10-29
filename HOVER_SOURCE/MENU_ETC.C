#include "GP1.H"

extern GsOT Wot[2];
extern GsOT_TAG zsortTable[2][1<<OT_LENGTH];
extern PACKET packet[2][PACKET_MAX*24];
extern GsOT Wot_CAR[8];
extern GsOT_TAG zsortTable_CAR[8][1<<OT_LENGTH_CAR];

extern struct s_SYSTEM_DATA Gsys;
extern struct s_MAP_DATA *map_data;
extern struct s_BESTLAP_RECORD best_data;
extern struct s_SYSTEM_SAVEDATA save_data;

extern GsDOBJ2 DOBJ_C[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_RD_L[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_RD_R[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_FIRE_R[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_FIRE_L[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_BOOSTER[MAX_CAR_NUM][4];
extern GsDOBJ2 DOBJ_KAGE[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_BACK[MAX_COURCE_PARTS*2];
extern GsCOORDINATE2 CRD_C[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_RD_L[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_RD_R[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_FIRE_R[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_FIRE_L[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_BOOSTER[MAX_CAR_NUM][4];
extern GsCOORDINATE2 CRD_KAGE[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_ALPHABET[16];
extern GsDOBJ2 DOBJ_ALPHABET[16];
extern GsCOORDINATE2 CRD_BACK[MAX_COURCE_PARTS*2];

extern struct s_CAR_PROPATIE CARS_PROPATIE[6];
extern volatile u_char *pd0, *pd1;
//extern struct s_CARS_DATA cars_data[MAX_CAR_NUM];
extern struct s_CARS_DATA *cars_scra[4];
extern char *cource_name[];

short int siz[]={0,0,0,0,0,0,0,0,-100,-200,-200};
short int points[6][2][160];
short int data[7][8];

void pcm( int mode )
{
	static int a=-1, pm=-1;
	if (a!=-1)
	{
		switch( pm )
		{
		case SND_OK:
			SsUtKeyOff( a, Gsys.vab_se, SND_OK, 0, 50 );
			break;
		case SND_CANCEL:
			SsUtKeyOff( a, Gsys.vab_se, SND_CANCEL, 0, 40 );
			break;
		case SND_CHANGE:
			SsUtKeyOff( a, Gsys.vab_se, SND_CHANGE, 0, 40 );
			break;
		}
	}
	pm=mode;
	switch( mode )
	{
	case SND_OK:
		a=SsUtKeyOn( Gsys.vab_se, SND_OK, 0, 50, 0, 80, 80 );
		break;
	case SND_CANCEL:
		a=SsUtKeyOn( Gsys.vab_se, SND_CANCEL, 0, 40, 0, 127, 127 );
		break;
	case SND_CHANGE:
		a=SsUtKeyOn( Gsys.vab_se, SND_CHANGE, 0, 40, 0, 127, 127 );
		break;
	}
}

void draw_words_ot( GsOT *ot, int x, int y, int lng, int n, int z, int col )
{
	GsSPRITE sp={ 0, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	int l2=0;
	sp.tpage=_GetTPage( 0,0,320+256, 0);
	sp.x=x;
	sp.y=y;
	if (lng>32) l2=lng-32,lng=32;
	sp.w=8*lng,sp.h=8;
	sp.u=0,sp.v=n*8;
	sp.cx=0;
	sp.cy=487;
	sp.r=col & 255;
	sp.g=(col>>8) & 255;
	sp.b=(col>>16) & 255;
	if (z==4096)
	{
		GsSortFastSprite( &sp, ot, 0 );
	}
	else
	{
		sp.scalex=z;
		sp.scaley=z;
		GsSortSprite( &sp, ot, 0 );
	}
	if (l2)
	{
		sp.tpage=_GetTPage( 0,0,320+256+64, 0);
		sp.x=x+8*32;
		sp.w=8*l2,sp.h=8;
		sp.u=0,sp.v=n*8;
		GsSortFastSprite( &sp, ot, 0 );
	}
}

void draw_words_ot16( GsOT *ot, int x, int y, int lng, int n, int z, int col )
{
	GsSPRITE sp={ 0, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	int lng2=0;
	sp.tpage=_GetTPage( 0,0,320+256, 0);
	sp.x=x;
	sp.y=y;
	if (lng>16) lng2=lng-16, lng=16;
	sp.w=16*lng,sp.h=16;
	sp.u=0,sp.v=n*16;
	sp.cx=0;
	sp.cy=487;
	sp.r=col & 255;
	sp.g=(col>>8) & 255;
	sp.b=(col>>16) & 255;
	if (z<360 && z>-360)
	{
		sp.rotate=4096*z;
		GsSortSprite( &sp, ot, 0 );
	}
	else
		if (z==4096 || z<360)
		{
			GsSortFastSprite( &sp, ot, 0 );
		}
		else
		{
			sp.scalex=z;
			sp.scaley=z;
			GsSortSprite( &sp, ot, 0 );
		}
	if (lng2)
	{
		sp.tpage=_GetTPage( 0,0,320+256+64, 0);
		sp.x+=256;
		sp.w=16*lng2;
		GsSortFastSprite( &sp, ot, 0 );
	}
}

void draw_words_ot_j( GsOT *ot, int x, int y, int lng, int n, int z, int col )
{
	GsSPRITE sp={ 0, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	sp.tpage=_GetTPage( 0,0,320+256, 0);
	sp.x=x;
	sp.y=y;
	sp.w=16*lng,sp.h=16;
	sp.u=0,sp.v=n*16;
	sp.cx=0;
	sp.cy=480;
	sp.r=col & 255;
	sp.g=(col>>8) & 255;
	sp.b=(col>>16) & 255;
	GsSortFastSprite( &sp, ot, 0 );
}

void draw_words_ot_j2( GsOT *ot, int x, int y, int lng, int n, int z, int col, int mode )
{
	GsSPRITE sp={ 0, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	sp.tpage=_GetTPage( 0,0,320+256+(n/16)*(128-mode*64), 0);
	sp.x=x;
	sp.y=y;
	sp.w=16*lng,sp.h=16;
	sp.u=0,sp.v=(n & 15)*16;
	sp.cx=0;
	sp.cy=480;
	sp.r=col & 255;
	sp.g=(col>>8) & 255;
	sp.b=(col>>16) & 255;
	GsSortFastSprite( &sp, ot, 0 );
}

void draw_message( int x, int y, char *message )
{
	int active, i;
	DrawSync(0);
	VSync(0);
	
	alphabet88( 320+256,0, message);

	for ( i=0 ; i<2 ; i++ )
	{
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		draw_words_ot(&Wot[active],x,y,strlen(message),0,4096,0x808080);
		DrawSync(0);
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}
}

void alphabet88( int x, int y, char *a )
{
	int l, i, t;
	RECT rect;
	l=strlen(a);
	t=0;
	for( i=0 ; i<l ; i++ )
	{
		t=a[i]-' ';
		rect.x=320+64+(t/16)*2;
		rect.y=256+128+(t & 15)*8;
		rect.w=2;
		rect.h=8;
		MoveImage( &rect, x+i*2, y );
	}
}

void alphabet16( int x, int y, char *a )
{
	int l, i, t;
	RECT rect;
	l=strlen(a);
	t=0;
	for( i=0 ; i<l ; i++ )
	{
		t=a[i]-' ';
		if (a[i]>='a' && a[i]<='z') t+='A'-'a';
		rect.x=320+64+32+(t/8)*4;
		rect.y=256+128+(t & 7)*16;
		rect.w=4;
		rect.h=16;
		MoveImage( &rect, x+i*4, y );
	}
}

void draw_alphabet( GsOT *Wot, int n, int ry, VECTOR *V )
{
	CRD_ALPHABET[n].coord=GsIDMATRIX;
	RotMatrixY( ry, &CRD_ALPHABET[n].coord );
	CRD_ALPHABET[n].coord.t[0]=V->vx;
	CRD_ALPHABET[n].coord.t[1]=V->vy;
	CRD_ALPHABET[n].coord.t[2]=V->vz;
	CRD_ALPHABET[n].flg=0;
	_DrawObjectNAMA( Wot, OT_LENGTH, DOBJ_ALPHABET[n] );
}

#if TITLE==1
void make_title()
{
	u_long *addr;
	char *title="HOVERRACING";
	VECTOR V;
	int i,t, n, active, last, pd;
	GsF_LIGHT light;

	light.vx=0;
	light.vy=256;
	light.vz=128;
	light.r=230;
	light.g=230;
	light.b=230;
	GsSetFlatLight(0, &light);
	GsSetAmbient( LIGHT_AMBIENT*3/5, LIGHT_AMBIENT*3/5, LIGHT_AMBIENT*3/5 );//Žü•ÓŒõ
	GsSetLightMode( 0 );

	for ( i=0 ; i<11 ; i++ )
	{
		addr=alphabet_addr( title[i], &n );
		crd_set(&CRD_ALPHABET[i],GsIDMATRIX,WORLD);
		obj_set(&DOBJ_ALPHABET[i],&CRD_ALPHABET[i],addr,n,0);
	}
	for( t=0 ; t<60*5 ; t++ )
	{
		pd=padd(pd0);
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );

		for ( i=0 ; i<5 ; i++ )
		{
			last=60*3-t-1+(4-i)*12;
			if (last<0) last=0;
			V.vx=-500*4+i*560-last*20*(5-i);
			V.vy=-1700;
			V.vz=6000;
			draw_alphabet( &Wot[active], i, last*32*(i+2), &V );
		}
		for ( i=5 ; i<11 ; i++ )
		{
			last=60*3-t-1+(i-5)*10;
			if (last<0) last=0;
			V.vx=(i-5)*560-500+last*20*(i-4)+siz[i];
			V.vy=-1000;
			V.vz=6000;
			draw_alphabet( &Wot[active], i,last*32*((11-i)*5/6+2), &V  );
		}
		if (pd==0)
		{
			DrawSync(0);
			VSync(0);
		}
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}
}

void close_title()
{
	VECTOR V;
	int i,t, active, last, pd;

	for( t=60*5-1 ; t>=-60*1 ; t-=8 )
	{
		pd=padd(pd0);
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		for ( i=0 ; i<5 ; i++ )
		{
			last=60*3-t-1+(4-i)*12;
			if (last<0) last=0;
			V.vx=-500*4+i*560-last*20*(5-i);
			V.vy=-1700;
			V.vz=6000;
			draw_alphabet( &Wot[active], i,last*4*(i+2), &V );
		}
		for ( i=5 ; i<11 ; i++ )
		{
			last=60*3-t-1+(i-5)*10;
			if (last<0) last=0;
			V.vx=(i-5)*560-500+last*20*(i-4)+siz[i];
			V.vy=-1000;
			V.vz=6000;
			draw_alphabet( &Wot[active], i,last*4*((11-i)*5/6+2), &V );
		}
		if (pd==0)
		{
			DrawSync(0);
			VSync(0);
		}
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}
}
#endif

int title( int mode_f )
{
	int sel=0, pd=0, pdd, i, active, y, col;
	static int lsel=0;
	int mode=0, chg=1;
	int time=60, time2=60, ntime=0;
	GsBOXF box={(1<<28)+(1<<30),-160,-120,320,240,0,0,0};
	GsSPRITE sp={ 1<<24, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	char *cright="Copyright (C) 1997 Sato Tomokazu";
	char *menu2[]={
				"START","OPTION","HELP","EXIT",
				"GRANDPRIX","TIME ATTACK","TRAINING","2P BATTLE",
				"MEMORY CARD","VIEW RECORDS","VIEW REPLAY","MUSIC MODE",
				"Blue GP","          ","          ","          ",
				"LEVEL 1","LEVEL 2","LEVEL 3","FREE RUN",
				"SLOT 1","SLOT 2","ENDING","",
				"GRANDPRIX'S","TIME ATTACK'S","",""
	};
	char *m3[]={
				"Blue GP","PRACTICE","","",
				"Blue GP","Yellow GP","PRACTICE","",
				"Blue GP","Yellow GP","Red GP","PRACTICE"
	};
	
	int menu_size[]={4,4,3,2,4,2,2};
	int nex[]={	2,3,0,0,	4,0,5,0,	6,7,0,0,	0,0,0,0,
				0,0,0,0,	0,0,0,0,	0,0,0,0 };
	int bef[]={	0,0,1,4,6,8,9 };

	for ( i=0 ; i<4 ; i++ )
		menu2[4*3+i]=m3[i];
	if (save_data.omake & 1)
	{
		menu_size[2]++;
		menu_size[3]++;
		for ( i=0 ; i<4 ; i++ )
			menu2[3*4+i]=m3[i+4];
	}
	if (save_data.omake & (1<<1))
	{
		menu_size[3]++;
		for ( i=0 ; i<4 ; i++ )
			menu2[4*3+i]=m3[i+8];
	}
	
#if TITLE==1
	VECTOR V;
#endif
	alphabet88( 320+256,0, cright);
#if TITLE==1
	make_title();
#endif
	DrawSync(0);
	VSync(0);
	if (mode_f==1)
	{
		time=0;
		sel=lsel & 3;
		mode=lsel/4;
	}
	pd=padd( pd0 );
	while( 1 )
	{
		if (chg==1)
		{
			for (i=0 ; i<4 ; i++ )
				alphabet16( 320+256,i*16+16, menu2[i+4*mode]);
			chg=0;
		}
		pdd=pd;
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		pd=padd(pd0);
		if (pd==0) ntime++;
		else ntime=0;
		if (ntime>30*60)
		{
			sel=-1;
			break;
		}
		if (pd==PADstart) time=0, time2=0;
		if (time2) pd=0;
		if (time) time--;
		else if (time2) time2--;
#if TITLE==1
		for ( i=0 ; i<5 ; i++ )
		{
			V.vx=-500*4+i*560;
			V.vy=-1700;
			V.vz=6000;
			draw_alphabet( &Wot[active], i, 0, &V );
		}
		for ( i=5 ; i<11 ; i++ )
		{
			V.vx=(i-5)*560-500+siz[i];
			V.vy=-1000;
			V.vz=6000;
			draw_alphabet( &Wot[active], i, 0, &V );
		}
#else
		sp.cx=0, sp.cy=482;
		sp.tpage=_GetTPage( 1,0,320, 0);
		sp.x=-120-time*8, sp.y=-120+8+time*8*50/(235-119);
		sp.w=256, sp.h=51;
		sp.u=0, sp.v=128;
		GsSortFastSprite( &sp, &Wot[active], 1 );
		sp.cx=0, sp.cy=482;
		sp.tpage=_GetTPage( 1,0,320, 0);
		sp.x=-120+time*8, sp.y=-120+8+50-time*8*(50)/(235-119);
		sp.w=256, sp.h=128-78;
		sp.u=0, sp.v=128+78;
		GsSortFastSprite( &sp, &Wot[active], 1 );
		if (time2 && time==0)
		{
			box.r=box.g=box.b=time2*255/60;
			GsSortBoxFill( &box, &Wot[active], 0 );
		}
#endif
		for (i=0 ; i<menu_size[mode] && time==0 ;i++)
		{
			y=i*24+4;
			if (menu_size[mode]==3) y=i*32+4;
			if (menu_size[mode]==2) y=i*32+16+4;
			if (sel==i)
				col=128<<8;
			else
				col=0x808080;
			draw_words_ot16(&Wot[active],-strlen(menu2[i+mode*4])*8,y,strlen(menu2[i+mode*4]),i+1,4096,col);
		}
		if (time==0)
			draw_words_ot(&Wot[active],-strlen(cright)*4,120-16,strlen(cright),0,4096,0x808080);
		if ((pdd & PADRdown)==0 && (pd & PADRdown) && mode!=0)
		{
			mode=bef[mode];
			pcm( SND_CANCEL );
			sel=mode & 3;
			mode/=4;
			chg=1;
		}
		if ((pdd & PADRright)==0 && (pd & PADRright))
		{
			if (nex[mode*4+sel]==0)
			{
				sel+=mode*4;
				pcm( SND_OK );
				break;
			}
			else
			{
				mode=nex[mode*4+sel]-1;
				sel=0;
				pcm( SND_OK );
				chg=1;
			}
		}
		if ((pdd & PADLdown)==0 && (pd & PADLdown) && sel!=menu_size[mode]-1)
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
#if TITLE==1
		GsSortClear( 0,0,0,&Wot[active] );
#else
		GsSortClear( 0,0,0,&Wot[active] );
#endif
		GsDrawOt( &Wot[active] );
	}
//	SsUtKeyOn( Gsys.vab_se, SND_BEEP, 0, 70, 0, 127, 127 );
#if TITLE==1
	close_title();
#endif
	while( padd(pd0)!=0 );
	lsel=sel;
	if (sel==menu_size[3]+12-1) sel=12+3;
	return(sel);
}

void as_draw_front( GsOT *Wot, int ot_length, int time, int wtime, int sel, int md )
{
//	static GsSPRITE sp={ 0, 0,0, 128,128, 0,
//						 0,0, 0,0, 128,128,128, 0,0, 8193, 8193, 0 };
	int last;
	GsBOXF box;
	GsLINE line;
	VECTOR V;
	int i, t, n1=9, n2=2;

	line.attribute=0;
	box.attribute=0;
	if (md)
	{
		n1=7;
		n2=5;
	}
	for (i=0 ; i<n1 ; i++ )
	{
		last=-time*4+(n1-i)*12-10*12;
		if (last<0) last=0;
		V.vx=-500*5*1.5+i*560+560*(i>n2)-last*20*(n1-i);
		V.vy=-1700*1.5;
		V.vz=6000*1.5;
		draw_alphabet( Wot, i, last*4*(i+2), &V );
	}
	for (t=0 ; t<2 ; t++ )
		for (i=1 ; i<wtime ; i++)
		{
			line.x0=16+i-1-time*2;
			line.y0=-64+12*8-16-points[sel][t][i-1];
			line.x1=16+i-time*2;
			line.y1=-64+12*8-16-points[sel][t][i];
			if (t==0)
			{
				line.r=line.g=line.b=255;
			}
			else
			{
				line.r=255;
				line.g=line.b=0;
			}
			GsSortLine( &line, Wot, 4 );
		}
//Chara Name
	draw_words_ot16(Wot,-160+16+time*2,-64,6,0,4096,0x808080);
//MaxSpeed
	draw_words_ot(Wot,48-time*2,-32+24,10,11,4096,0x808080);
	draw_words_ot(Wot,32+64-time*2,-32+24+10,7,13,4096,0x808080);
//MaxTurbo
	draw_words_ot(Wot,48-time*2,-32+24+20,10,12,4096,0x808080);
	draw_words_ot(Wot,32+64-time*2,-32+24+10+20,7,14,4096,0x808080);
	for ( i=0 ; i<7 ; i++ )
	{
		draw_words_ot(Wot,16-time*2,-64+i*12+12*8,10,4+i,4096,0x808080);
		box.x=16-time*2, box.y=-64+i*12+12*8;
		box.w=152*data[sel][i]/data[6][i];
		box.h=8;
		box.r=0, box.g=0, box.b=128;
		GsSortBoxFill( &box, Wot, 8 );
	}
}

void car_select_init( int md )
{
	u_long *addr;
	int n;
	int t, j, i, max_car=4;
	char *title[]={	"CARSELECT",
					"PLAYER1",
					"PLAYER2"
	};
	char *text[]={
		"Booster   ",
		"Slaster   ",
		"Radder    ",
		"Resistance",
		"Turbo     ",
		"Weight    ",
		"Power     ",
		"MAX SPEED ",
		"MAX TURBO ",
	};
	GsF_LIGHT light;
	GsRVIEW2 viewR;
	VECTOR VZ={0,0,0};

	viewR.vpx = 0;
	viewR.vpy = -900;
	viewR.vpz = 1400;
	viewR.vrz = 0;
	viewR.vry = -400;
	viewR.vrx = 0;
	viewR.rz = 0;
	viewR.super = WORLD;
	GsSetRefView2( &viewR );
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
	memset( (char *)data, 0, sizeof(data) );

	for (i=0 ; i<9 ; i++ )
		alphabet88( 320+256,i*8+32, text[i]);
	for ( i=0 ; i<strlen(title[md]) ; i++ )
	{
		addr=alphabet_addr( title[md][i], &n );
		crd_set(&CRD_ALPHABET[i],GsIDMATRIX,WORLD);
		obj_set(&DOBJ_ALPHABET[i],&CRD_ALPHABET[i],addr,n,0);
	}
	cars_scra[0]->effect=0;
	cars_scra[1]->effect=0;
	cars_scra[2]->effect=0;
	cars_scra[3]->effect=0;
	cars_scra[0]->over=0;
	cars_scra[1]->over=0;
	cars_scra[2]->over=0;
	cars_scra[3]->over=0;
//	car_init( 1, 0x1, 1, 0, WORLD,0 );
//	car_init( 2, 0x1, 2, 0, WORLD,0 );
//	car_init( 3, 0x1, 3, 0, WORLD,0 );

	for ( n=0 ; n<6 ; n++ )
	{
		car_init( 0, 0x1, n, 0, WORLD,0 );
		CRD_C[0].coord=GsIDMATRIX;
		for (t=0 ; t<2 ; t++ )
		{
			cars_scra[0]->inertia_forward=VZ;
			cars_scra[0]->inertia_back=VZ;
			cars_scra[0]->speed=0;
			cars_scra[0]->brek=0;
			cars_scra[0]->breaking=0;
			for (i=0 ; i<(160-16-8)*3 ; i++ )
			{
				points[n][t][i/3]=(cars_scra[0]->speed*26>>8);
				car_preope( 1 );
				cars_scra[0]->turbo=t;
				car_acceralate( 0, 0 );
				car_resistance( 0 );
			}
			points[n][t][159]=cars_scra[0]->speed/2;
		}
		data[n][0]=CARS_PROPATIE[n].per_accer0-CARS_PROPATIE[n].per_accer1*8;
		data[n][1]=CARS_PROPATIE[n].side_boost;
		if (n==2 || n==4) data[n][2]=0;
		else data[n][2]=CARS_PROPATIE[n].per_rot2+(4096*20/360)/CARS_PROPATIE[n].per_rot;
		data[n][3]=CARS_PROPATIE[n].resi1;
		data[n][4]=CARS_PROPATIE[n].turbo0-CARS_PROPATIE[n].turbo1*4;
		data[n][5]=CARS_PROPATIE[n].weight;
		data[n][6]=CARS_PROPATIE[n].tanc;
	}
	if (save_data.omake & (1<<2)) max_car++;
	if (save_data.omake & (1<<3)) max_car++;
	for (j=0 ; j<7 ; j++)
		for (i=0 ; i<max_car ; i++ )
			if (data[6][j]<data[i][j]) data[6][j]=data[i][j];
	car_position( 0, &VZ, 1 );
//	car_position( 1, &VZ, 1 );
//	car_position( 2, &VZ, 1 );
//	car_position( 3, &VZ, 1 );
}

int car_select( int md )
{
	int pd=0, pdd=0, sel=0, active, sec=1, max_c=4;
	static int lsel=0;
	SVECTOR VX={0,0,0};
	VECTOR VZ={0,0,0};
	char temp[32];
	char *name[]={
		"Luster",
		"Excel ",
		"Beta  ",
		"Juster",
		"Alpha ",
		"Suzuki"
	};
	int brk=0;
	int mode=1;
	int time=-60*1;
	int wtime=0;
	car_select_init( md );
	if (save_data.omake & (1<<2)) max_c=5;
	if (md==0 && save_data.omake & (1<<3)) max_c=6;
	sel=lsel;
	cars_scra[0]->attribute=1;
	cars_scra[1]->attribute=0;
	cars_scra[2]->attribute=0;
	cars_scra[3]->attribute=0;

	while( 1 )
	{
		if (sec==1)
		{
			sprintf( temp, "%3dKm/h", points[sel][0][159] );
			alphabet88( 320+256,9*8+32, temp);
			sprintf( temp, "%3dKm/h", points[sel][1][159] );
			alphabet88( 320+256,10*8+32, temp);
			alphabet16( 320+256,0, name[sel]);
			car_init( 0, 0x1, sel, 0, WORLD,0 );
			car_position( 0, &VZ, 1 );
			sec=0;
		}
		time+=mode;
		if (wtime<160-16-8) wtime++;
		if (time==0 && mode==1) mode=0;
		if (time<=-60*2 && mode<0) break;
		VX.vy+=4096*2/360;
		RotMatrix( &VX, &CRD_C[0].coord );
		CRD_C[0].coord.t[0]=350-time*8;
		CRD_C[0].flg=0;
		RotMatrix( &VX, &CRD_KAGE[0].coord );
		CRD_KAGE[0].coord.t[0]=350-time*8;
		CRD_KAGE[0].flg=0;

		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );

		GsClearOt( 0, 0, &Wot_CAR[(active<<2)] );
		cars_scra[0]->draw=1;
		cars_scra[0]->attribute=1;
		car_draw( &Wot_CAR[active<<2], OT_LENGTH_CAR );
		as_draw_front( &Wot[active], OT_LENGTH, time, wtime, sel, md );

		GsSortOt( &Wot_CAR[(active<<2)], &Wot[active] );
		if ((pdd & PADLright)==0 && pd & PADLright)
		{
			sel++;
			if (sel==max_c) sel=0;
			pcm( SND_CHANGE );
			sec=1;
		}
		if ((pdd & PADLleft)==0 && pd & PADLleft)
		{
			sel--;
			if (sel==-1) sel=max_c-1;
			pcm( SND_CHANGE );
			sec=1;
		}
		if ((pdd & PADRdown) && pd & PADRdown)
		{
			brk=1;
			pcm( SND_CANCEL );
			mode=-4;
		}
		if ((pdd & PADRright) && pd & PADRright)
		{
			pcm( SND_OK );
			mode=-4;
		}
		DrawSync(0);
		VSync(0);
		pdd=pd;
		if (md!=2) 
			pd=padd(pd0);
		else
			pd=padd(pd1);
		if (mode<0) pd=0;
		ResetGraph(1);
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}
	if (brk==1) sel=-1;
	if (sel!=-1) lsel=sel;
	return(sel);
}

void cs_draw_front( GsOT *Wot, int ot_length, int time, int sel )
{
//	static GsSPRITE sp={ 0, 0,0, 128,128, 0,
//						 0,0, 0,0, 128,128,128, 0,0, 8193, 8193, 0 };
	int last;
	VECTOR V;
	int i;

//	sp.tpage=_GetTPage( 0,0,320+256, 0);

	for (i=0 ; i<12 ; i++ )
	{
		last=-time*6+(12-i)*12-13*12;
		if (last<0) last=0;
		V.vx=-500*5*1.5+i*560+560*(i>5)-last*20*(12-i);
		V.vy=-1700*1.5;
		V.vz=6000*1.5;
		draw_alphabet( Wot, i, last*4*(i+2), &V );
	}
//Cource Name
	draw_words_ot16(Wot,-160+16+time*4,-64,16,0,4096,0x808080);
//Best Lap
	sel+=Gsys.TimeMode*9;
	draw_words_ot(Wot,-160+16+time*4-8,120-48,14,2,4096,0x808080);
	draw_words_ot(Wot,-160+16+16+time*4,120-48+12,12,4,4096,0x808080);
	draw_minicar(Wot,-160+8+time*4,120-48+12,best_data.used_car[sel][0] & 7,2048);

//TOTAL Lap
	draw_words_ot(Wot,16+16-time*4-8,120-48,14,3,4096,0x808080);
	draw_words_ot(Wot,16+16+16-time*4,120-48+12,12,8,4096,0x808080);
	draw_minicar(Wot,16+8-time*4,120-48+12,best_data.used_car[sel][1] & 7,2048);
}

void get_record_name( char *a, char *b )
{
	char *dat="ABCDEFGHIJKLMNOPQRSTUVWXYZ,.^_0123456789%*?&!";
	int i;
	for ( i=0 ; i<3 ; i++ )
		a[i]=dat[b[i]];
	a[3]=0;
}

void get_record_time( char *a, int dat )
{
	int s,i,n;
	s=dat*100/60;
	i=s/6000;
	s=(s % 6000)+i*10000;
	for ( i=0,n=100000 ; i<8 ; i++ )
	{
		if (i==2) { a[i]='\''; continue; }
		if (i==5) { a[i]='\"'; continue; }
		a[i]=((s/n) % 10)+'0';
		n/=10;
	}
	a[i]=0;
}

void set_cs( int num )
{
	char tmp[32];
	char nm[32];

	alphabet16( 320+256,0, cource_name[num]);
	alphabet88( 320+256,2*8, "BESTLAP RECORD" );
	alphabet88( 320+256,3*8, "TOTAL RECORD  " );
	num+=Gsys.TimeMode*9;
	get_record_time( tmp, best_data.best_lap[num][0] );
	get_record_name( nm, best_data.best_name[num][0] );
	sprintf( tmp, "%s %s", tmp, nm );
	alphabet88( 320+256,4*8, tmp );
	get_record_time( tmp, best_data.total_lap[num][0] );
	get_record_name( nm, best_data.total_name[num][0] );
	sprintf( tmp, "%s %s", tmp, nm );
	alphabet88( 320+256,8*8, tmp );
}

void analog_rot( SVECTOR *VR )
{
	int p;
	p=analog(pd0,0);
	if (_abs(p-128)>32) VR->vy+=(p-128)>>2;
	p=analog(pd0,1);
	if (_abs(p-128)>32) VR->vx+=(p-128)>>2;
}

void make_minimap( int x, int y, int h, int w )
{
	u_char buff[128*128*2], b2[64*32+32];
	RECT rect;
	int xx, yy, a, xa, ya;
	setRECT( &rect, x, y, h, w );
	StoreImage( &rect, (u_long *)buff );
	DrawSync(0);
	memset( b2, 0, sizeof(b2) );
	for (yy=0 ; yy<128 ; yy++ )
		for (xx=0 ; xx<128 ; xx++ )
		{
			xa=xx/2;
			ya=yy/2;
			a=WORD(&buff[xx*2+yy*256]);
			b2[xa/2+ya*32]|=((a!=0x7fff)<<((xa & 1)*4));
		}
	setRECT( &rect, 576+128+32, 256+128, 16, 64 );
	LoadImage( &rect, (u_long *)b2 );
	DrawSync(0);
	WORD(buff)=0;
	WORD(buff+2)=0x7fff;
	setRECT( &rect, 0, 500, 2, 1 );
	LoadImage( &rect, (u_long *)buff );
	DrawSync(0);
}

int cource_select( int cmode )
{
	int pd=0, pdd=0, sel=0, active, i;
	static int lsel=0;
	int redraw=1;
	int lng[]={
		10000,
		7500,
		10000,
		7500,
		14000,
		12000,
		16000,
		12000,
		9000
	};
	u_long *addr;
	SVECTOR VR={0,0,0};
	char *title="COURCESELECT";
	int n, brk=0;
	int time=-60*1;
	int mode=1;
	GsF_LIGHT light;
	GsRVIEW2 viewR;
	RECT rect;

	light.vx=0;
	light.vy=-256;
	light.vz=128;
	light.r=230;
	light.g=230;
	light.b=230;
	GsSetFlatLight(0, &light);
	GsSetAmbient( LIGHT_AMBIENT, LIGHT_AMBIENT, LIGHT_AMBIENT );//Žü•ÓŒõ
	GsSetLightMode( 0 );

	for ( i=0 ; i<12 ; i++ )
	{
		addr=alphabet_addr( title[i], &n );
		crd_set(&CRD_ALPHABET[i],GsIDMATRIX,WORLD);
		obj_set(&DOBJ_ALPHABET[i],&CRD_ALPHABET[i],addr,n,0);
	}
	VR.vx=-4096*70/360;

	if (cmode) sel=cmode-1;
	else sel=lsel;

	while( cmode==0 )
	{
		if (redraw)
		{
			makemap( sel, 1 );
			crd_set(&CRD_BACK[0],GsIDMATRIX,WORLD);
			obj_set(&DOBJ_BACK[0],&CRD_BACK[0],(u_long *)COURCETMD_ADDR,0,0);
			viewR.vpx = 0;
			viewR.vpy = -30000/4;
			viewR.vpz = 0;
			viewR.vrz = 0;
			viewR.vry = 0;
			viewR.vrx = 0;
			viewR.rz = 0;
			viewR.super = WORLD;
			GsSetRefView2( &viewR );
			VSync(0);
			set_cs( sel );
			redraw=0;
		}
		analog_rot( &VR );
		VR.vy+=16;
		time+=mode;
		if (time==0 && mode==1) mode=0;
		if (time<=-60*2 && mode<0) break;
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		cs_draw_front( &Wot[active], OT_LENGTH, time, sel );
		RotMatrix( &VR, &CRD_BACK[0].coord );
		CRD_BACK[0].coord.t[0]=-((time*10000)>>7);
		CRD_BACK[0].flg=0;
		_DrawObject( &Wot[active], OT_LENGTH, DOBJ_BACK[0] );
		if ((pdd & PADLright)==0 && (pd & PADLright))
		{
			sel=(sel+1) % 9;
			pcm( SND_CHANGE );
			redraw=1;
		}
		if ((pdd & PADLleft)==0 && (pd & PADLleft))
		{
			sel=(sel-1);
			if (sel==-1) sel=8;
			pcm( SND_CHANGE );
			redraw=1;
		}
		if ((pdd & PADRdown)==0 && (pd & PADRdown))
		{
			brk=1;
			pcm( SND_CANCEL );
			mode=-4;
		}
		if ((pdd & PADRright)==0 && (pd & PADRright))
		{
			pcm( SND_OK );
			mode=-4;
		}
		DrawSync(0);
		VSync(0);
		pdd=pd;
		pd=padd(pd0);
		if (mode<0) pd=0;
		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}


	if (brk==1) sel=-1;
	else
	{
		SetDispMask( 0 );
		DrawSync(0);
		VSync(0);
		GsDefDispBuff( 0,240,0,240 );
		GsSwapDispBuff();
		makemap( sel, 1 );
		crd_set(&CRD_BACK[0],GsIDMATRIX,WORLD);
		obj_set(&DOBJ_BACK[0],&CRD_BACK[0],(u_long *)COURCETMD_ADDR,0,0);
		DrawSync(0);
		VSync(0);
		_BOXFILL(0,0,320,240,255,255,255);
		VR.vx=90*4096/360;
		VR.vy=180*4096/360;
		VR.vz=0;
		RotMatrix( &VR, &CRD_BACK[0].coord );
		RotMatrixZ( 180*4096/360, &CRD_BACK[0].coord );
		CRD_BACK[0].coord.t[0]=0;
		CRD_BACK[0].coord.t[2]=lng[sel];
		CRD_BACK[0].flg=0;
		Gsys.map_scx=lng[sel]/PROJECTION_LONG;
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		_DrawObjectNAMA( &Wot[active], OT_LENGTH, DOBJ_BACK[0] );
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsSetOffset(160,-120);
		setRECT( &rect, 0,-240,320,240 );
		GsSetClip( &rect );
		GsDrawOt( &Wot[active] );

		make_minimap( 160-64,120-64,128,128 );
		DrawSync(0);
		_BOXFILL(0,0,320,480,0,0,0);
		VSync(0);
		SetDispMask( 1 );
		GsDefDispBuff( 0,0,0,240 );
		GsSwapDispBuff();
	}
	GsSetLightMode( 1 );
	if (sel!=-1) lsel=sel;
	return(sel);
}

int enter_name( GsOT *ot, int ot_length, int flash )
{
	SVECTOR VX={0,0,0};
	int a[3]={0,0,0},b[3]={0,0,0};
	static int sel=0, tim2=0, tim3=0;
	u_long *addr[]={(u_long *)APHA_TMD_A_O_ADDR,(u_long *)APHA_TMD_P_O_ADDR,(u_long *)APHA_TMD_0_9_ADDR};
	static pdd, pd=0;
	int i;

	tim2++;
	if (tim3>0) tim3--;
	if (tim3<0) tim3++;
	for (i=0 ; i<3 ; i++)
	{
		a[i]=Gsys.player_name[i] % 15;
		b[i]=Gsys.player_name[i] / 15;
	}
	if (flash==1)
	{
		sel=0;
		pd=0;
		tim3=0;
	}
	pdd=pd;
	pd=padd(pd0);
	if ((pdd & PADRdown)==0 && (pd==PADRdown) && sel!=0)
	{
		sel--;
		flash=1;
	}
	if ((pdd & PADRright)==0 && (pd==PADRright))
	{
		sel++;
		flash=1;
		if (sel==3)
			return(0);
	}
	if (pdd!=pd && (pd==PADLup || pd==PADLright))
	{
		a[sel]++;
		if (tim3>8 || tim3<-8) flash=1;
		tim3=16;
		if (a[sel]==15)
		{
			a[sel]=0;
			b[sel]++;
			if (b[sel]==3) b[sel]=0;
		}
	}
	if (pdd!=pd && (pd==PADLdown || pd==PADLleft))
	{
		a[sel]--;
		if (tim3>8 || tim3<-8) flash=1;
		tim3=-16;
		if (a[sel]==-1)
		{
			a[sel]=14;
			b[sel]--;
			if (b[sel]==-1) b[sel]=2;
		}
	}
	if (flash==1 || tim3==8 || tim3==-8)
	{
		for ( i=0 ; i<3 ; i++ )
		{
			crd_set(&CRD_ALPHABET[i],GsIDMATRIX,WORLD);
			obj_set(&DOBJ_ALPHABET[i],&CRD_ALPHABET[i],addr[(int)b[i]],(int)a[i],0);
		}
	}
	for ( i=0 ; i<3 ; i++ )
	{
		VX.vx=0;
		VX.vz=0;
		VX.vy=0;
		if (i==sel && tim3)
		{
			VX.vx=(Gsys.sind[(tim2*3) % 720]>>6);
			VX.vz=(Gsys.sind[(tim2*5) % 720]>>6);
			if (tim3>8) VX.vy=-(1024/8)*(16-tim3);
			if (tim3>0 && tim3<=8) VX.vy=(1024/8)*(tim3);
			if (tim3<-8) VX.vy=-(1024/8)*(-16-tim3);
			if (tim3<0 && tim3>=-8) VX.vy=(1024/8)*(tim3);
		}
		RotMatrix( &VX, &CRD_ALPHABET[i].coord );
		CRD_ALPHABET[i].coord.t[0]=i*800-800+(sel==i)*(Gsys.sind[(tim2) % 720]>>6);
		CRD_ALPHABET[i].coord.t[1]=0+(sel==i)*(Gsys.sind[(tim2*7) % 720]>>6);
		CRD_ALPHABET[i].coord.t[2]=5000-(sel==i)*(1000+(Gsys.sind[(tim2+45) % 720]>>8));
	}
	for ( i=0 ; i<3 ; i++ )
		_DrawObjectNAMA( ot, ot_length, DOBJ_ALPHABET[i] );
	Gsys.player_name[sel]=b[sel]*15+a[sel];
	return(1);
}

int sort_betlap( int mode, int best, char *ina )
{
	unsigned short int *a;
	char *b, nn[8];
	int i, j, re, x, y, sel;
	sel=Gsys.cource_number+Gsys.TimeMode*9;

	memcpy( nn, ina, 3 );
	ina[3]=0;

	if ((mode & 1)==0)
	{
		a=best_data.best_lap[sel];
		b=(char *)(&best_data.best_name[sel][0][0]);
	}
	else
	{
		a=best_data.total_lap[sel];
		b=(char *)(&best_data.total_name[sel][0][0]);
	}

	for (i=0 ; i<6 ; i++)
		if (best<a[i]) break;
	re=i;
	if (mode>1 || i==6) return(re);
//	printf("insert %d\n",i);
	if (i!=6)
	{
		x=best_data.used_car[sel][0];
		y=best_data.used_car[sel][1];
		if (mode==0)
			x=((x & (0xffffff>>(24-i*4)))+((x<<4) & (0xffffffff<<(i*4+4)))) | (Gsys.mine<<(i*4));
		else
			y=((y & (0xffffff>>(24-i*4)))+((y<<4) & (0xffffffff<<(i*4+4)))) | (Gsys.mine<<(i*4));
		best_data.used_car[sel][0]=x;
		best_data.used_car[sel][1]=y;
	}
	for (j=4 ; j>=i ; j--)
	{
		a[j+1]=a[j];
		memcpy( b+(j+1)*3, b+j*3, 3 );
	}
	a[i]=best;
	memcpy( b+i*3, ina, 3 );
	return(re);
}

int entry_check( int best, int best2 )
{
	if (sort_betlap( 2, cars_scra[0]->lap_time[Gsys.fbest_lap], NULL )<6) return(1);
	if (sort_betlap( 3, Gsys.total_time, NULL )<6) return(1);
	return(0);
}
