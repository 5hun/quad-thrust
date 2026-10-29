#include "GP1.H"

extern GsOT Wot[2];
extern GsOT_TAG zsortTable[2][1<<OT_LENGTH];
extern PACKET packet[2][PACKET_MAX*24];
extern GsOT Wot_CAR[8];
extern GsOT_TAG zsortTable_CAR[8][1<<OT_LENGTH_CAR];

extern GsCOORDINATE2 CRD_C[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_COURCE;
extern GsCOORDINATE2 CRD_VIEW;
extern GsCOORDINATE2 CRD_BACK[MAX_COURCE_PARTS*2];
extern GsDOBJ2 DOBJ_BACK[MAX_COURCE_PARTS*2];
extern GsDOBJ2 DOBJ_ALPHABET[16];
extern GsCOORDINATE2 CRD_ALPHABET[16];

//extern struct s_CARS_DATA cars_data[MAX_CAR_NUM];
extern struct s_CARS_DATA *cars_scra[4];

extern volatile u_char *pd0, *pd1;

extern struct s_SYSTEM_DATA Gsys;
extern struct s_MAP_DATA *map_data;
extern struct s_BESTLAP_RECORD best_data;

GsSPRITE sp={ 0<<24, 0,0, 0,16, (320>>6),
			 0,0, 0,497, 128,128,128, 0,0, 4096, 4096, 0 };

void draw_bomb( GsOT *ot, int player, int timm )
{
	static GsSPRITE sp[8]={
	{ (1<<24)+(1<<6), 0,0, 0,16, (320>>6), 0,0, 0,492, 128,128,128, 16,16, 0, 0, 0 },
	{ (1<<24)+(1<<6), 0,0, 0,16, (320>>6), 0,0, 0,492, 128,128,128, 16,16, 0, 0, 0 },
	{ (1<<24)+(1<<6), 0,0, 0,16, (320>>6), 0,0, 0,492, 128,128,128, 16,16, 0, 0, 0 },
	{ (1<<24)+(1<<6), 0,0, 0,16, (320>>6), 0,0, 0,492, 128,128,128, 16,16, 0, 0, 0 }
	};
	static int scale[8], sx[8],sy[8], pat[8];
	int i, sc=0;
	int x, y, z;
	static int timm2=0;
	MATRIX MT;
	
	if (timm==-1)
	{
		scale[0]=0;
		scale[1]=0;
		scale[2]=0;
		scale[3]=0;
		return;
	}
	if (Gsys.GameMode==3) sc=1;
	GsGetLs( &CRD_C[player], &MT );
	if (MT.t[2]<32) return;
	x=MT.t[0]*PROJECTION_LONG/MT.t[2]>>sc;
	y=MT.t[1]*PROJECTION_LONG/MT.t[2]>>sc;
	z=4096*PROJECTION_LONG/MT.t[2]>>sc;
	for (i=0 ; i<4 ; i++)
	{
		if (((timm2+i*2) & 7)==0)
		{
			scale[i]=((rand() & 8191)+4096);
			sx[i]=(rand() & 31)-16;
			sy[i]=(rand() & 31)-16;
			pat[i]=0;
		}
		sp[i].tpage=_GetTPage(1,0,320+64,256 );
		sp[i].w=32;
		sp[i].h=32;
		sp[i].u=((pat[i]/4)*32) & 63, sp[i].v=(((pat[i])*32) & 127);
		sp[i].x=x+(sx[i]*z>>9);
		sp[i].y=y+(sy[i]*z>>9);
		sp[i].scalex=sp[i].scaley=scale[i]*z>>9;
		GsSortSprite( &sp[i], ot, 0 );
		pat[i]++;
	}
	timm2++;
}

void draw_damage( GsOT *ot, int ot_length, int n, int yp )
{
	int l;
//FRAME
	sp.cy=497;
	sp.attribute=1<<6;
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.x=-160+8, sp.y=120-4-32+yp;
	sp.w=16;
	sp.h=32;
	sp.u=0, sp.v=128+128-32;
	GsSortFastSprite( &sp, ot, 1 );
//GAGE
	l=(cars_scra[n]->damage_max-cars_scra[n]->damage);
	if (l<0)
	{
		l=0;
		if (cars_scra[n]->over==0 && Gsys.goal_count==0)
		{
			cars_scra[n]->over=60*5;
			draw_bomb(ot,n,-1);
		}
	}
	l=29*l/cars_scra[n]->damage_max;
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.x=-160+8+8, sp.y=120-8-l+2+yp;
	sp.w=8;
	sp.h=l;
	sp.u=16, sp.v=128+128-32+1+29-l;
	GsSortFastSprite( &sp, ot, 0 );
}

void draw_wrongway( GsOT *ot, int ot_length )
{
	if ((Gsys.total_time & 31)>15) return;
	sp.attribute=1<<6;
	sp.cy=487;
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.x=-160+16, sp.y=-120+64;
	sp.w=16*8;
	sp.h=16;
	sp.u=0, sp.v=64+16+128;
	GsSortFastSprite( &sp, ot, 0 );
}

void draw_map( GsOT *ot, int ot_length, int n, int yp )
{
	int x, y, i;
//Map
	sp.attribute=1<<6;
	sp.cy=500;
	sp.mx=sp.my=4;
	sp.tpage=_GetTPage(0,0,576+128,256 );
	x=sp.x=-160+8, y=sp.y=-120+32+yp;
	sp.w=64;
	sp.h=64;
	sp.u=32*4, sp.v=128;
	GsSortFastSprite( &sp, ot, 1 );
//MAP CHARA
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.cy=497;
	for (i=0 ; i<Gsys.cars_number ; i++ )
	{
		if (i!=n) sp.scalex=2048,sp.scaley=2048;
		else sp.scalex=4096,sp.scaley=4096;
		sp.x=x+64-(32-(((CRD_C[i].coord.t[0]-Gsys.map_cx)/Gsys.map_scx)>>7));
		sp.y=y+(32-(((CRD_C[i].coord.t[2]-Gsys.map_cy)/Gsys.map_scx)>>7));
		sp.w=8;
		sp.h=8;
		sp.u=64+8*cars_scra[i]->car_type, sp.v=128+8*7;
		sp.rotate=(cars_scra[i]->status.vy)*360+(180<<12)+4096*180;
		GsSortSprite( &sp, ot, 0 );
	}
//	sp.cy=497;
}

void draw_lap( GsOT *ot, int ot_length, int n, int yp )
{
#define LAP_WX (16-160+16+16)
#define LAP_WY (64-120+24-32)
	int nn;
//LAST LAP

	sp.attribute=1<<6;

	if ((cars_scra[n]->last_lap)==0) return;

	if ((cars_scra[n]->last_lap)==1)
	{
		sp.cy=487;
		sp.tpage=_GetTPage(0,0,576,256 );
		sp.x=LAP_WX+16, sp.y=LAP_WY+yp;
		sp.w=64+16;
		sp.h=16;
		sp.u=32, sp.v=64+128+32;
		GsSortFastSprite( &sp, ot, 0 );
		sp.tpage=_GetTPage(0,0,576,256 );
		sp.x=LAP_WX+16*6+16, sp.y=LAP_WY+yp;
		sp.w=48;
		sp.h=16;
		sp.u=64, sp.v=64+128;
		GsSortFastSprite( &sp, ot, 0 );
		return;
	}

	sp.cy=487;
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.x=LAP_WX+8, sp.y=LAP_WY+yp;
	sp.w=64;
	sp.h=16;
	sp.u=0, sp.v=64+128;
	GsSortFastSprite( &sp, ot, 0 );
	sp.x=LAP_WX+16*7+8, sp.y=LAP_WY+yp;
	sp.w=64;
	sp.h=16;
	sp.u=64, sp.v=64+128;
	GsSortFastSprite( &sp, ot, 0 );

//LAST LAP
	sp.x=LAP_WX+16*5, sp.y=LAP_WY+yp;
	sp.w=16;
	sp.h=16;
	nn=cars_scra[n]->last_lap;
	sp.u = (nn & 7)*16;
	sp.v = (nn / 8)*16+128;
	GsSortFastSprite( &sp, ot, 0 );
}

void draw_position( GsOT *ot, int ot_length, int n, int yp )
{
	int nn;

	if (Gsys.GameMode==2) return;

//Position
	sp.attribute=1<<6;
	sp.cy=487;
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.x=-32, sp.y=8-120+yp;
	sp.w=16*4;
	sp.h=24;
	sp.u=0, sp.v=128+40;
	GsSortFastSprite( &sp, ot, 0 );
//n
	sp.x=16, sp.y=16-120+yp;
	sp.w=16;
	sp.h=16;
	nn = Gsys.cars_number;
	sp.u = (nn & 7)*16;
	sp.v = (nn / 8)*16+128;
	GsSortFastSprite( &sp, ot, 0 );
	sp.x-=16;
//nm
	sp.x=-32, sp.y=16-120+yp;
	sp.w=16;
	sp.h=16;
	nn = cars_scra[n]->rank+1;
	sp.u = (nn & 7)*16;
	sp.v = (nn / 8)*16+128;
	GsSortFastSprite( &sp, ot, 0 );
	sp.x-=16;
}

void draw_speed( GsOT *ot, int ot_length, int speed, int yp )
{
	int i, n, nn;
//SPEED
	sp.cy=487;
	sp.attribute=1<<6;
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.x=160-24-16, sp.y=240-24-120+yp;
	sp.w=16*2;
	sp.h=16;
	sp.u=16*2, sp.v=128+16;
	GsSortFastSprite( &sp, ot, 0 );
//SPEED Number
	sp.x-=16;
	sp.w=16;
	sp.h=16;
	sp.v=0;
	for (i=0, n=1 ; i<3 ; i++, n*=10)
	{
		nn = ((speed % (n*10))/n);
		sp.u = (nn & 7)*16;
		sp.v = (nn / 8)*16+128;
		GsSortFastSprite( &sp, ot, 0 );
		sp.x-=16;
	}
}

void draw_time( GsOT *ot, int ot_length, int nn, int yp )
{
	int i, t, tt, lp;
//TOTAL,LAP TIME
	sp.attribute=0;
	sp.cy=487;
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.x=-160+16-8, sp.y=-120+8+yp;
	sp.w=8*5, sp.h=8;
	sp.u=64, sp.v=128+16;
	sp.r=128;
	sp.g=sp.b=0;
	GsSortFastSprite( &sp, ot, 0 );
	sp.x=64+8, sp.y=-120+8+yp;
	sp.w=8*8;
	sp.h=8;
	sp.u=64, sp.v=24+128;
	GsSortFastSprite( &sp, ot, 0 );
	if ((Gsys.best_draw==0 || (Gsys.time & 31)>15) && Gsys.GameMode!=2 && yp==0)
	{
		sp.x=64+8, sp.y=-120+16+2+3*12+4;
		sp.w=8*8;
		sp.h=8;
		sp.u=64, sp.v=40+128;
		GsSortFastSprite( &sp, ot, 0 );
	}
	sp.r=sp.g=sp.b=128;
//TOTAL TIME
	sp.attribute=1<<6;
	t=Gsys.total_time*100/60;
	tt=t/6000;
	t=(t % 6000)+tt*10000;

	sp.x=-160+8+8*8, sp.y=-120+16+2+yp;
	sp.w=8;
	sp.h=8;
	sp.u=0, sp.v=128+32;
	for (i=0 ; i<8 ; i++ )
	{
		if (i==2 || i==5)
		{
			if (i==2) sp.u=11<<3;
			if (i==5) sp.u=10<<3;
		}
		else
		{
			sp.u=(t % 10)<<3;
			t/=10;
		}
		GsSortFastSprite( &sp, ot, 0 );
		sp.x-=8;
	}

//LAP TIME
	for (lp=0 ; lp<3 ; lp++)
	{
		if (lp!=(cars_scra[nn]->lap % 3) || Gsys.goal_count!=0)
		{
//			sp.tpage=_GetTPage(0,0,576,256 );
			sp.x=64+16, sp.y=-120+16+2+yp+lp*12;
			sp.w=8*8, sp.h=8;
			sp.u=128, sp.v=128+8+lp*8+nn*32;
			GsSortFastSprite( &sp, ot, 0 );
//			sp.tpage=_GetTPage(0,0,576,256 );
			continue;
		}
		t=cars_scra[nn]->time*100/60;
		tt=t/6000;
		t=(t % 6000)+tt*10000;
		sp.x=64+8+8*8, sp.y=-120+16+2+yp+lp*12;
		sp.w=8;
		sp.h=8;
		sp.u=0, sp.v=128+32;
		for (i=0 ; i<8 ; i++ )
		{
			if (i==2 || i==5)
			{
				if (i==2) sp.u=11<<3;
				if (i==5) sp.u=10<<3;
			}
			else
			{
				sp.u=(t % 10)<<3;
				t/=10;
			}
			GsSortFastSprite( &sp, ot, 0 );
			sp.x-=8;
		}
	}
	if (Gsys.GameMode==2 || yp!=0) return;

//BEST LAP
	if (Gsys.best_draw && (Gsys.time & 31)<=15) return;
	if (Gsys.best_draw) Gsys.best_draw--;
//	sp.tpage=_GetTPage(0,0,320+64,256 );
	t=Gsys.best_lap_time[Gsys.cource_number]*100/60;
	sp.x=64+8+8, sp.y=-120+16+2+3*12+4+8+2;
	sp.w=8*8,sp.h=8;
	sp.u=128, sp.v=128;
	GsSortFastSprite( &sp, ot, 0 );
//	sp.tpage=_GetTPage(0,0,576,256 );
}

void best_draw( GsOT *ot, int ot_length, int mode )
{
	GsSPRITE sp={ 2<<24, 0,0, 16,16, 0,
						 0,0, 0,480, 128,128,128, 0,0, 4096, 4096, 0 };
	int i=0,j;
	char tmp[64], tmp2[64];
	i=Gsys.replay_timming-1200;
	if (i==0)
	{
		_BOXFILL(320+256, 128, 128, 128, 0,0,0);
		sprintf( tmp, "%d-%d BESTLAP    ", Gsys.cource_number/3+1, (Gsys.cource_number % 3)+1 );
		if (mode==0) alphabet16(320+256, 128, "BESTLAP RECORDS" );
		else alphabet16(320+256, 128, tmp );
	}
	else
	{
		if (i<7)
		{
			get_record_time( tmp, best_data.best_lap[Gsys.cource_number+Gsys.TimeMode*9][i-1] );
			get_record_name( tmp2, best_data.best_name[Gsys.cource_number+Gsys.TimeMode*9][i-1] );
			sprintf( tmp, "%s %s", tmp, tmp2 );
			alphabet16( 320+256,128+i*16,tmp );
		}
	}
	draw_words_ot16(ot,-160+8,-120+16,15,8,4096,0x808080);
	for (i=0 ; i<6 ; i++ )
	{
		if (i==Gsys.bestline && ((Gsys.time & 31)>24)) continue;
		draw_words_ot16(ot,-160+64+16,-120+16+32+i*32,14,9+i,4096,0x808080);
		sp.tpage=_GetTPage(2,0,384,256 );
		j=(best_data.used_car[Gsys.cource_number+Gsys.TimeMode*9][0]>>(i*4)) & 15;
		sp.x=-160+24+16, sp.y=-120+16+32+i*32;
		sp.u=32, sp.v=j*16;
		sp.w=24, sp.h=16;
		GsSortFastSprite( &sp, ot, 0 );
	}
	sp.attribute=2<<24;
}

void total_draw( GsOT *ot, int ot_length, int mode )
{
	GsSPRITE sp={ 2<<24, 0,0, 16,16, 0,
						 0,0, 0,480, 128,128,128, 0,0, 4096, 4096, 0 };
	int i=0,j;
	char tmp[64], tmp2[64];
	i=Gsys.replay_timming-1860;
	if (i==0)
	{
		_BOXFILL(320+256, 128, 128, 128, 0,0,0);
		sprintf( tmp, "%d-%d TOTAL      ", Gsys.cource_number/3+1, (Gsys.cource_number % 3)+1 );
		if (mode==0) alphabet16(320+256, 128, "TOTAL RECORDS   " );
		else alphabet16(320+256, 128, tmp );
	}
	else
	{
		if (i<7)
		{
			get_record_time( tmp, best_data.total_lap[Gsys.cource_number+Gsys.TimeMode*9][i-1] );
			get_record_name( tmp2, best_data.total_name[Gsys.cource_number+Gsys.TimeMode*9][i-1] );
			sprintf( tmp, "%s %s", tmp, tmp2 );
			alphabet16( 320+256,128+i*16,tmp );
		}
	}
	draw_words_ot16(ot,-160+8,-120+16,15,8,4096,0x808080);
	for (i=0 ; i<6 ; i++ )
	{
		if (i==Gsys.totalline && ((Gsys.time & 31)>24)) continue;
		draw_words_ot16(ot,-160+64+16,-120+16+32+i*32,14,9+i,4096,0x808080);
		sp.tpage=_GetTPage(2,0,384,256 );
		j=(best_data.used_car[Gsys.cource_number+Gsys.TimeMode*9][1]>>(i*4)) & 15;
		sp.x=-160+24+16, sp.y=-120+16+32+i*32;
		sp.u=32, sp.v=j*16;
		sp.w=24, sp.h=16;
		GsSortFastSprite( &sp, ot, 0 );
	}
	sp.attribute=2<<24;
}

void front_draw_replay( GsOT *ot, int ot_length )
{
//REPLAY
	int i=0,j,t,tt;
	static int pdd;
	int pd=0;

	pd=padd(pd0);

	if (Gsys.replay_timming<1000 && Gsys.GameMode!=4) rank_draw( ot, ot_length );

	if (Gsys.entry_check!=0)
	{
		if (Gsys.replay_timming==1099)
			enter_name( ot, OT_LENGTH_CAR, 1 );
		if (Gsys.replay_timming==1100)
			Gsys.replay_timming-=enter_name( ot, OT_LENGTH_CAR, 0 );
		if (Gsys.replay_timming==1101)
			Gsys.entry_check=0;
	}

	if (Gsys.replay_timming==1150)
		sort_betlap( 0, cars_scra[0]->lap_time[Gsys.fbest_lap], Gsys.player_name );
	if (Gsys.replay_timming==1151)
		sort_betlap( 1, Gsys.total_time, Gsys.player_name );

	if (Gsys.replay_timming>=1200 && Gsys.replay_timming<1200+60*10)
	{
		best_draw( ot, ot_length,0 );
		if (pdd!=pd && pd) Gsys.replay_timming=1830;
	}
	else
		if (Gsys.replay_timming>=1860 && Gsys.replay_timming<1860+60*10)
		{
			total_draw( ot, ot_length,0 );
			if (pdd!=pd && pd) Gsys.replay_timming=1860+600;
		}
		else
		{
			if ((Gsys.time & 63)>=32)
			{
				sp.tpage=_GetTPage( 0,0,576,256 );
				sp.x=160-16*5, sp.y=120-32;
				sp.w=16*4, sp.h=16;
				sp.u=32, sp.v=128+112;
				GsSortFastSprite( &sp, ot, 0 );
			}
		}

	if (Gsys.replay_timming>300 && Gsys.replay_timming<300+60*10)
	{
		sp.tpage=_GetTPage(0,0,576,256 );
		sp.cy=487;
		sp.x=-80, sp.y=-64+16;
		sp.w=8*8;
		sp.h=8;
		sp.u=64, sp.v=24+128;
		sp.r=128, sp.g=sp.b=0;
		GsSortFastSprite( &sp, ot, 0 );
		sp.x=-80, sp.y=-64+20*4+16+16;
		sp.w=8*5, sp.h=8;
		sp.u=64, sp.v=128+16;
		GsSortFastSprite( &sp, ot, 0 );
		sp.r=sp.g=sp.b=128;
		for ( i=0 ; i<3 ; i++ )
		{
			if (i==(Gsys.fbest_lap) && Gsys.bestline<6 && (Gsys.replay_timming & 31)>=24)
				continue;
			t=cars_scra[0]->lap_time[i]*100/60;
			tt=t/6000;
			t=(t % 6000)+tt*10000;
			sp.x=16+8*8, sp.y=-64+i*20+16;
			sp.w=8;
			sp.h=8;
			sp.u=0, sp.v=128+32;
			for (j=0 ; j<8 ; j++ )
			{
				if (j==2 || j==5)
				{
					if (j==2) sp.u=11<<3;
					if (j==5) sp.u=10<<3;
				}
				else
				{
					sp.u=(t % 10)<<3;
					t/=10;
				}
				GsSortFastSprite( &sp, ot, 0 );
				sp.x-=8;
			}
		}
		if (Gsys.totalline>5 || (Gsys.replay_timming & 31)<24)
		{
			t=Gsys.total_time*100/60;
			tt=t/6000;
			t=(t % 6000)+tt*10000;
			sp.x=16+8*8, sp.y=-64+20*4+16+16;
			sp.w=8;
			sp.h=8;
			sp.u=0, sp.v=128+32;
			for (j=0 ; j<8 ; j++ )
			{
				if (j==2 || j==5)
				{
					if (j==2) sp.u=11<<3;
					if (j==5) sp.u=10<<3;
				}
				else
				{
					sp.u=(t % 10)<<3;
					t/=10;
				}
				GsSortFastSprite( &sp, ot, 0 );
				sp.x-=8;
			}
		}
	}
	pdd=pd;
}

void front_draw( GsOT *ot, int ot_length )
{
	draw_speed( ot, ot_length, (cars_scra[0]->speed>>1),0 );
	draw_time( ot, ot_length,0,0 );
	if (Gsys.GameMode!=2)
	{
		draw_position( ot, ot_length, 0, 0 );
		draw_damage( ot, ot_length, 0, 0 );
	}
	draw_map( ot, ot_length, 0, 0 );
	if (cars_scra[0]->lap_draw)
	{
		draw_lap( ot, ot_length, 0, 0 );
		cars_scra[0]->lap_draw--;
	}
	if (Gsys.wrong_time>5)
		draw_wrongway( ot, ot_length);
	if (cars_scra[0]->line_position<cars_scra[0]->before_line_position)
		Gsys.wrong_time++;
	if (cars_scra[0]->line_position>cars_scra[0]->before_line_position)
		Gsys.wrong_time=0;
}

void front_draw_time( GsOT *ot, int ot_length )
{
	draw_speed( ot, ot_length, (cars_scra[0]->speed>>1),0 );
	draw_time( ot, ot_length,0,0 );
	draw_damage( ot, ot_length, 0, 0 );
	draw_map( ot, ot_length, 0, 0 );
	if (cars_scra[0]->lap_draw)
	{
		draw_lap( ot, ot_length, 0, 0 );
		cars_scra[0]->lap_draw--;
	}
	if (Gsys.wrong_time>5)
		draw_wrongway( ot, ot_length);
	if (cars_scra[0]->line_position<cars_scra[0]->before_line_position)
		Gsys.wrong_time++;
	if (cars_scra[0]->line_position>cars_scra[0]->before_line_position)
		Gsys.wrong_time=0;
}

void front_draw_dv( GsOT *ot, int ot_length )
{
	int n;
	n=Gsys.draw_player;
	draw_speed( ot, ot_length, (cars_scra[n]->speed>>1), -60 );
	draw_time( ot, ot_length, n, 60 );
	draw_position( ot, ot_length, n, 60 );
	draw_damage( ot, ot_length, n, -60 );
	draw_map( ot, ot_length, n, 60 );
	if (cars_scra[n]->lap_draw>0)
	{
		draw_lap( ot, ot_length, n, 30 );
		cars_scra[n]->lap_draw-=2;
	}
/*	if (Gsys.wrong_time>5)
		draw_wrongway( ot, ot_length);
	if (cars_scra[0]->line_position<cars_scra[0]->before_line_position)
		Gsys.wrong_time++;
	if (cars_scra[0]->line_position>cars_scra[0]->before_line_position)
		Gsys.wrong_time=0;
*/
}
