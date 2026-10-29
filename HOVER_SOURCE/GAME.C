#include "GP1.H"

extern GsOT Wot[2];
extern GsOT_TAG zsortTable[2][1<<OT_LENGTH];
extern PACKET packet[2][PACKET_MAX*24];
extern GsOT Wot_CAR[8];
extern GsOT_TAG zsortTable_CAR[8][1<<OT_LENGTH_CAR];
extern GsOT Wot_BACK[2];
extern GsOT_TAG zsortTable_BACK[2][1<<OT_LENGTH_BACK];

extern GsCOORDINATE2 CRD_CHIP;
extern GsDOBJ2 DOBJ_CHIP;
extern GsCOORDINATE2 CRD_C[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_KAGE[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_COURCE;
extern GsCOORDINATE2 CRD_VIEW;
extern GsDOBJ2 DOBJ_ALPHABET[16];
extern GsCOORDINATE2 CRD_ALPHABET[16];
extern GsCOORDINATE2 CRD_BACK_SPRITE;
extern GsDOBJ2 DOBJ_BACK_SPRITE;
extern GsDOBJ2 DOBJ_EFFECT[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_EFFECT[MAX_CAR_NUM];
extern struct s_CARS_DATA *cars_scra[4];

extern volatile u_char *pd0, *pd1;

extern struct s_SYSTEM_DATA Gsys;
extern struct s_MAP_DATA *map_data;
extern struct s_BESTLAP_RECORD best_data;
extern struct s_REPLAY_HEAD replay_head[8], n_replay_data, n_replay_data_g;
static struct s_CARS_DATA *car_data;
extern char *cource_name[];
extern struct s_SYSTEM_SAVEDATA save_data;
extern struct s_TRAINING Trn;

void add_crash_chip( VECTOR V, SVECTOR VN, int wi, int addnum, int mode, int pl )
{
	int i, p, m,n, o, a;
	static int rn;
	VECTOR Va;

	Gsys.crash_player=pl;
	p=Gsys.chip_point;
	for ( i=0 ; i<addnum ; i++ )
	{
		m=Gsys.rnd[rn++ & 1023] & 511;
		n=Gsys.rnd[rn++ & 1023] & 511;
		o=Gsys.rnd[rn++ & 1023] & 511;
		Gsys.CHIP_V[p].vx=V.vx<<4;
		Gsys.CHIP_V[p].vy=V.vy<<4;
		Gsys.CHIP_V[p].vz=V.vz<<4;
		Va.vx=(m-256)<<wi;
		Va.vy=(n-256)<<wi;
		Va.vz=(o-256)<<wi;
		a=(Va.vx*VN.vx+Va.vy*VN.vy+Va.vz*VN.vz)>>12;
		Va.vx-=(VN.vx*a>>(13-mode));
		Va.vy-=(VN.vy*a>>(13-mode));
		Va.vz-=(VN.vz*a>>(13-mode));
		Gsys.CHIP_AV[p].vx=Va.vx;
		Gsys.CHIP_AV[p].vy=Va.vy;
		Gsys.CHIP_AV[p].vz=Va.vz;
		Gsys.chip_delete_timming[p]=48-mode;
		Gsys.chip_rot[p]=m & 7;
		Gsys.chip_rot_t[p]=n & 15;
		p++;
		if (p>=MAX_CHIP) p=0;
	}
	Gsys.chip_point=p;
}

void crash_chip( GsOT *ot, int ot_length )
{
	int i;
	u_char *p=DIVIDE_CAR_ADDR+12;
	SVECTOR *v, *vn;
	SVECTOR *VX;
	static VECTOR VVs;
	VECTOR Vs;

	v=(SVECTOR *)(DWORD( p ));
	vn=(SVECTOR *)(DWORD( p+8 ));
	Vs.vx=(VVs.vx-CRD_C[Gsys.crash_player].coord.t[0])<<4;
	Vs.vy=(VVs.vy-CRD_C[Gsys.crash_player].coord.t[1])<<4;
	Vs.vz=(VVs.vz-CRD_C[Gsys.crash_player].coord.t[2])<<4;
	VVs.vx=CRD_CHIP.coord.t[0]=CRD_C[Gsys.crash_player].coord.t[0];
	VVs.vy=CRD_CHIP.coord.t[1]=CRD_C[Gsys.crash_player].coord.t[1];
	VVs.vz=CRD_CHIP.coord.t[2]=CRD_C[Gsys.crash_player].coord.t[2];
	CRD_CHIP.flg=0;
	for ( i=0 ; i<MAX_CHIP ; i++ )
	{
		if (Gsys.chip_delete_timming[i])
		{
			if (Gsys.chip_delete_timming[i]==48)
			{
				Gsys.CHIP_AV[i].vx-=Vs.vx;
				Gsys.CHIP_AV[i].vy-=Vs.vy;
				Gsys.CHIP_AV[i].vz-=Vs.vz;
			}
			Gsys.chip_delete_timming[i]--;
			if (Gsys.chip_delete_timming[i]==0)
			{
				v[i*3].vx=v[i*3].vy=v[i*3].vz=0;
				v[i*3+1].vx=v[i*3+1].vy=v[i*3+1].vz=0;
				v[i*3+2].vx=v[i*3+2].vy=v[i*3+2].vz=0;
			}
			else
			{
				VX=Gsys.VCrashChip[Gsys.chip_rot[i]][Gsys.chip_rot_t[i]];
				vn[i]=VX[0];
				Gsys.chip_rot_t[i]=(Gsys.chip_rot_t[i]+1) & 7;
				Gsys.CHIP_AV[i].vy+=16;
				Gsys.CHIP_V[i].vx+=Gsys.CHIP_AV[i].vx+Vs.vx;
				Gsys.CHIP_V[i].vy+=Gsys.CHIP_AV[i].vy+Vs.vy;
				Gsys.CHIP_V[i].vz+=Gsys.CHIP_AV[i].vz+Vs.vz;
				v[i*3].vx=(Gsys.CHIP_V[i].vx>>4)+VX[1].vx;
				v[i*3].vy=(Gsys.CHIP_V[i].vy>>4)+VX[1].vy;
				v[i*3].vz=(Gsys.CHIP_V[i].vz>>4)+VX[1].vz;
				v[i*3+1].vx=(Gsys.CHIP_V[i].vx>>4)+VX[2].vx;
				v[i*3+1].vy=(Gsys.CHIP_V[i].vy>>4)+VX[2].vy;
				v[i*3+1].vz=(Gsys.CHIP_V[i].vz>>4)+VX[2].vz;
				v[i*3+2].vx=(Gsys.CHIP_V[i].vx>>4)+VX[3].vx;
				v[i*3+2].vy=(Gsys.CHIP_V[i].vy>>4)+VX[3].vy;
				v[i*3+2].vz=(Gsys.CHIP_V[i].vz>>4)+VX[3].vz;
			}
		}
	}
	_DrawObject( ot, ot_length, DOBJ_CHIP );
}

int acosd( int a )
{
	int i;
	for (i=0 ; i<1024 ; i++ )
		if (Gsys.cosd2[i]<a) break;
	return( i*2 );
}

void GsSetRefView3( GsRVIEW2 *a )
{
	VECTOR Xr={0,0,0}, Yr={0,0,0};
	int ly, yr=0, lx;
	Xr.vx=Yr.vx=(a->vrx-a->vpx)>>2;
	Xr.vy=(a->vry-a->vpy)>>2;
	Xr.vz=Yr.vz=(a->vrz-a->vpz)>>2;
	ly=sqr_i(1<<16, (Yr.vx*Yr.vx+Yr.vz*Yr.vz));
	if (ly!=0)
	{
		yr=acosd( (Yr.vz<<12)/ly );
		if (Yr.vx<0) yr=4096-yr;
		Gsys.BackRotY=yr;
	}
	lx=sqr_i(1<<16, (Xr.vx*Xr.vx+Xr.vz*Xr.vz));
	Gsys.BackTan=Gsys.tand[1024+2048*7/360]-(Xr.vy<<12)/lx;
}

void view_set( int type )
{
	SVECTOR SV;
	int vsa, avsa, fin=0, x, y, ra, pl, n, ad=0;
	n=Gsys.draw_player;
	if (Gsys.GameMode==3) ad=1;

	car_data=cars_scra[n];

	Gsys.view_now_on=car_data->now_on;
	if (Gsys.replaying)
	{
		if (Gsys.replay_view_remain==0)
		{
			ra=((int)rand()) & 3;
			switch(ra)
			{
			case 0:
			case 1:
				Gsys.replay_view_mode=33;
				Gsys.viewR[n].vpx = map_data[car_data->now_on].center.vx;
				Gsys.viewR[n].vpy = map_data[car_data->now_on].center.vy;
				Gsys.viewR[n].vpz = map_data[car_data->now_on].center.vz;
				x=map_data[car_data->now_on].xdiv+1;
				y=map_data[car_data->now_on].ydiv+1;
				Gsys.viewR[n].vpx += (car_data->VP[ra*(x*(y-1))+x-1].vx<<1);
				Gsys.viewR[n].vpy += (car_data->VP[ra*(x*(y-1))+x-1].vy<<1)-3000;
				Gsys.viewR[n].vpz += (car_data->VP[ra*(x*(y-1))+x-1].vz<<1);
				Gsys.replay_view_remain=120;
				break;
			case 2:
				Gsys.replay_view_mode=1;
				Gsys.replay_view_remain=240;
				break;
			case 3:
				Gsys.replay_view_mode=17;
				Gsys.replay_view_remain=240;
				break;
			}
		}
		Gsys.replay_view_remain--;
		type=Gsys.replay_view_mode;
	}
	Gsys.BackTan=0xffff;
	Gsys.view_type=type;
	switch( type )
	{
	case 0:
		pl=Gsys.start_count-60*2;
		if (pl<0) pl=0;
		Gsys.vrot[n].vy&=4095;
		vsa = (((Gsys.vrot[n].vy-car_data->status.vy+pl*16+(fin<<11))+2048) & 4095)-2048;
		avsa = _abs(vsa);
		if (vsa>=0) vsa=-(4096/360/2<<ad); else vsa=4096/360/2<<ad;
		if (avsa<=(4096/360/2<<ad)) Gsys.vrot[n].vy=(car_data->status.vy+(fin<<11));
		else
			Gsys.vrot[n].vy+=vsa*(1+(avsa)/(4096*6/360<<ad));
		vsa = (((Gsys.vrot[n].vx-car_data->status.vx)+2048) & 4095)-2048;
		avsa = _abs(vsa);
		if (vsa>=0) vsa=-(4096/360/8<<ad); else vsa=4096/360/8<<ad;
		if (avsa<=(4096/360/8<<ad)) Gsys.vrot[n].vx=car_data->status.vx;
		else Gsys.vrot[n].vx+=vsa*(1+(avsa)/(4096*12/360<<ad));
		SV.vx=-4096*7/360+Gsys.vrot[n].vx;
		SV.vy=0;
		y=((car_data->status.vz-Gsys.vrot[n].vz+2048) & 4095)-2048;
		if (y>(4096*30/360<<ad)) Gsys.vrot[n].vz+=4<<ad;
		if (y>0) Gsys.vrot[n].vz++;
		if (y<-(4096*30/360<<ad)) Gsys.vrot[n].vz-=4<<ad;
		if (y<0) Gsys.vrot[n].vz--;
		SV.vz=Gsys.vrot[n].vz;
		RotMatrix( &SV, &CRD_VIEW.coord );
		RotMatrixY(Gsys.vrot[n].vy, &CRD_VIEW.coord );
		CRD_VIEW.coord.t[0]=CRD_C[n].coord.t[0];
		CRD_VIEW.coord.t[1]=CRD_C[n].coord.t[1];
		CRD_VIEW.coord.t[2]=CRD_C[n].coord.t[2];
		CRD_VIEW.flg=0;
		if (car_data->view_long>car_data->speed*2+16) car_data->view_long-=16;
		if (car_data->view_long<car_data->speed*2-16) car_data->view_long+=16;
		Gsys.vlong=3500+car_data->view_long/4+Gsys.ana1+Gsys.start_count*100;
		Gsys.view[n].view=GsIDMATRIX;
		Gsys.view[n].super=&CRD_VIEW;
		Gsys.view[n].view.t[0]=0;
		Gsys.view[n].view.t[1]=850;
		Gsys.view[n].view.t[2]=Gsys.vlong;
		GsSetView2( &Gsys.view[n] );
		Gsys.BackRotX=Gsys.vrot[n].vx;
		Gsys.BackRotY=Gsys.vrot[n].vy;
		Gsys.BackRotZ=Gsys.vrot[n].vz;
		break;
	case 33:
		Gsys.viewR[n].vrx = CRD_C[n].coord.t[0];
		Gsys.viewR[n].vry = CRD_C[n].coord.t[1];
		Gsys.viewR[n].vrz = CRD_C[n].coord.t[2];
		Gsys.viewR[n].rz = 0;
		Gsys.viewR[n].super = &CRD_COURCE;
		GsSetRefView2( &Gsys.viewR[n] );
		GsSetRefView3( &Gsys.viewR[n] );
		Gsys.BackRotZ = 0;
		break;
	case 17:
		fin = 1;
	case 1:
		Gsys.vrot[n].vy&=4095;
		vsa = (((Gsys.vrot[n].vy-car_data->status.vy+(fin<<11))+2048) & 4095)-2048;
		avsa = _abs(vsa);
		if (vsa>=0) vsa=-(4096/360/2); else vsa=4096/360/2;
		if (avsa<=4096/360/2) Gsys.vrot[n].vy=(car_data->status.vy+(fin<<11));
		else
			Gsys.vrot[n].vy+=vsa*(1+(avsa)/(4096*6/360));
		vsa = (((Gsys.vrot[n].vx-car_data->status.vx)+2048) & 4095)-2048;
		avsa = _abs(vsa);
		if (vsa>=0) vsa=-(4096/360/8); else vsa=4096/360/8;
		if (avsa<=4096/360/8) Gsys.vrot[n].vx=car_data->status.vx;
		else Gsys.vrot[n].vx+=vsa*(1+(avsa)/(4096*12/360));
		SV.vx=-4096*7/360+Gsys.vrot[n].vx*(1-2*fin);
		SV.vy=0;
		SV.vz=0;
		RotMatrix( &SV, &CRD_VIEW.coord );
		RotMatrixY(Gsys.vrot[n].vy, &CRD_VIEW.coord );
		CRD_VIEW.coord.t[0]=CRD_C[n].coord.t[0];
		CRD_VIEW.coord.t[1]=CRD_C[n].coord.t[1];
		CRD_VIEW.coord.t[2]=CRD_C[n].coord.t[2];
		CRD_VIEW.flg=0;
		if (car_data->view_long>car_data->speed+8) car_data->view_long-=8;
		if (car_data->view_long<car_data->speed-8) car_data->view_long+=8;
		Gsys.vlong=3500+car_data->view_long;

		Gsys.view[n].view=GsIDMATRIX;
		Gsys.view[n].super=&CRD_VIEW;
		Gsys.view[n].view.t[0]=0;
		Gsys.view[n].view.t[1]=850;
		Gsys.view[n].view.t[2]=Gsys.vlong;
		GsSetView2( &Gsys.view[n] );
		Gsys.BackRotX=Gsys.vrot[n].vx*(1-2*fin);
		Gsys.BackRotY=Gsys.vrot[n].vy;
		Gsys.BackRotZ=Gsys.vrot[n].vz;
		break;
	}
}

void back_draw( GsOT *ot, int ot_length )
{
	static GsSPRITE sp={ 1<<24, 0,0, 16,16, 0,
						 0,0, 0,496, 128,128,128, 0,0, 4096, 4096, 0 };
	static int plus_y[]={24,0,0,0,0};
	int i, k, yp;
	int x,y, ym, ym2;
	int xx,yy, dx, dy;
	MATRIX MT=GsIDMATRIX;
	MATRIX MT2={
		{{8192,0,0},{0,8192,0},{0,0,8192}},
		{0,0,0}
	};
	SVECTOR *v;
	SVECTOR A, B;
	static GsBOXF box={ 0, -160,-120,320,0,0,0,0 };
	static int ligx[]={ 700,780,810,1200,1250};
	static int ligx2[]={ 700,780-50,810+80,1200-50,1250+100};
	static int ligx3[]={ 100,50,80,106,110};
	static int ligy[]={ 0,-13,-10,0,-20 };
	static int cir[]={0,1024,2562,500,100};
	static int cira[]={5,4,2,5,1};

	yp=plus_y[Gsys.cource_type];
	sp.attribute=(1<<24)+(1<<6);
	sp.w=128,sp.h=120;
	sp.cx=0,sp.cy=496;
	sp.u=0,sp.v=0;
	sp.scalex=4096*129/128;
	sp.scaley=4096;
	sp.rotate=-4096*Gsys.BackRotZ*360/4096;

	RotMatrixZ( -Gsys.BackRotZ, &MT );
	k=(((Gsys.BackRotY)+2048) & 4095)*640*3/4096;
	A.vx=-(k & 127)-180,A.vy=-140+yp, A.vz=0;
	ApplyMatrixSV( &MT, &A, &B );
	dx=(((u_long)MT.m[0][0])<<8)>>(12-7);
	dy=(((u_long)MT.m[1][0])<<8)>>(12-7);
	sp.x=B.vx;
	if (Gsys.BackTan!=0xffff)
	{
		sp.y=B.vy+((PROJECTION_LONG*Gsys.BackTan)>>12);
	}
	else
	{
		sp.y=B.vy+((PROJECTION_LONG*Gsys.tand[(Gsys.BackRotX+1024) & 2047])>>12);
	}
	ym=-120;
	ym2=120;
	xx=sp.x<<8, yy=sp.y<<8;
	for( i=0 ; i<4 ; i++ )
	{
		x=((k>>7)+i) % 15;
		sp.tpage=_GetTPage(1, 0, 320+256+128+64*(x % 5) , (x/10)*256 );
		sp.x=xx>>8, sp.y=yy>>8;
		sp.v=(((x/5)*128) & 255);
		GsSortSprite( &sp, ot, (1<<ot_length)-2 );
		xx+=dx;
		yy+=dy;
		if (sp.y>ym) ym=sp.y;
		if (sp.y<ym) ym2=sp.y;
	}
	sp.x=xx>>8, sp.y=yy>>8;
	if (sp.y>ym) ym=sp.y;
	if (sp.y<ym) ym2=sp.y;
	if (ym>=-120)
	{
		box.y=-120;
		box.h=ym+120;
		box.b=Gsys.bg_b;
		box.r=Gsys.bg_r;
		box.g=Gsys.bg_g;
		GsSortBoxFill( &box, ot, (1<<ot_length)-1 );
	}
	ym2+=((MT.m[1][1]*(128*2+100))>>12);
	if (ym2<=120)
	{
		box.y=ym2;
		box.h=120-ym2;
		box.b=Gsys.bg_b2;
		box.r=Gsys.bg_r2;
		box.g=Gsys.bg_g2;
		GsSortBoxFill( &box, ot, (1<<ot_length)-1 );
	}
	v=(SVECTOR *)(BACKTMD_ADDR+28+12);
	for ( x=0 ; x<NUMBER_BTMD+1 ; x++ )
		for ( y=0 ; y<4 ; y++, v++ )
			v->vx=((((x-(NUMBER_BTMD/2))*128+64-(k & 127))*(y+2))>>1)*25;
	RotMatrixZ( -Gsys.BackRotZ, &MT2 );
	if (Gsys.BackTan!=0xffff)
		MT2.t[1]=(((PROJECTION_LONG*Gsys.BackTan)>>12)-1+yp)*50;
	else
		MT2.t[1]=(((PROJECTION_LONG*Gsys.tand[(Gsys.BackRotX+1024) & 2047])>>12)-1+yp)*50;
	if (Gsys.cource_type!=0)
	{
		GsSetLsMatrix( &MT2 );
		GsSortObject4(&DOBJ_BACK_SPRITE,ot,14-ot_length-2,NULL);
		return;
	}

	k %= 1920;
	if (k<0) k+=1920;
	for( i=0 ; i<NUMBER_SEARCHLIGHT ; i++, v+=3 )
	{
		x=ligx3[i]*Gsys.sind2[cir[i] & 2047]>>12;
		v[0].vx=-(k-ligx[i])*25, v[0].vy=-60*25-ligy[i]*25;
		v[1].vx=-(k-ligx2[i]-x)*25-6*25, v[1].vy=-200*25-ligy[i]*25;
		v[2].vx=-(k-ligx2[i]-x)*25+6*25, v[2].vy=-200*25-ligy[i]*25;
		v[1].vz=v[2].vz=PROJECTION_LONG*25;
		cir[i]+=cira[i];
	}
	GsSetLsMatrix( &MT2 );
	GsSortObject4(&DOBJ_BACK_SPRITE,ot,14-ot_length-2,NULL);
}

void back_draw2( GsOT *ot, int ot_length )
{
	static GsSPRITE sp={ 1<<24, 0,0, 16,16, 0,
						 0,0, 0,496, 128,128,128, 0,0, 4096, 4096, 0 };
	static int plus_y[]={12,0,0,0,0};
	static int ligx[]={ 700,780,810,1200,1250};
	static int ligx2[]={ 700,780-50,810+80,1200-50,1250+100};
	static int ligx3[]={ 100,50,80,106,110};
	static int ligy[]={ 0,-13,-10,0,-20 };
	static int cir[]={0,1024,2562,500,100};
	static int cira[]={5,4,2,5,1};
	int i, k, yp;
	int x,y, ym, ym2, xx, yy, dx, dy;
	MATRIX MT=GsIDMATRIX;
	MATRIX MT2={
		{{8192,0,0},{0,8192,0},{0,0,8192}},
		{0,0,0}
	};
	SVECTOR *v;
	SVECTOR A, B;
	static GsBOXF box={ 0, -160,-120,320,0,0,0,0 };
	yp=plus_y[Gsys.cource_type];
	sp.attribute=(1<<24)+(1<<6);
	sp.w=128,sp.h=120;
	sp.cx=0,sp.cy=496;
	sp.u=0,sp.v=0;
	sp.scalex=2048*65/64;
	sp.scaley=2048*65/64;
	sp.rotate=-4096*Gsys.BackRotZ*360/4096;

	RotMatrixZ( -Gsys.BackRotZ, &MT );
	k=(((Gsys.BackRotY)+2048) & 4095)*640*3/4096;
	A.vx=-((k & 127)>>1)-160,A.vy=-70+yp, A.vz=0;
	ApplyMatrixSV( &MT, &A, &B );
	dx=(((u_long)MT.m[0][0])<<8)>>(12-6);
	dy=(((u_long)MT.m[1][0])<<8)>>(12-6);
	sp.x=B.vx;
	sp.y=B.vy+((PROJECTION_LONG*Gsys.tand[(Gsys.BackRotX+1024) & 2047])>>13);
	ym=-60;
	ym2=60;
	xx=sp.x<<8, yy=sp.y<<8;
	for( i=0 ; i<7 ; i++ )
	{
		x=((k>>7)+i) % 15;
		sp.tpage=_GetTPage(1, 0, 320+256+128+64*(x % 5) , (x/10)*256 );
		sp.x=xx>>8, sp.y=yy>>8;
		sp.v=(((x/5)*128) & 255);
		GsSortSprite( &sp, ot, (1<<ot_length)-2 );
		xx+=dx;
		yy+=dy;
		if (sp.y>ym) ym=sp.y;
		if (sp.y<ym) ym2=sp.y;
	}
	sp.x=xx>>8, sp.y=yy>>8;
	if (sp.y>ym) ym=sp.y;
	if (sp.y<ym) ym2=sp.y;
	if (ym>=-60)
	{
		box.y=-60;
		box.h=ym+60;
		box.b=Gsys.bg_b;
		box.r=Gsys.bg_r;
		box.g=Gsys.bg_g;
		GsSortBoxFill( &box, ot, (1<<ot_length)-1 );
	}
	ym2+=((MT.m[1][1]*(200+100))>>13);
	if (ym2<=60)
	{
		box.y=ym2;
		box.h=60-ym2;
		box.b=Gsys.bg_b2;
		box.r=Gsys.bg_r2;
		box.g=Gsys.bg_g2;
		GsSortBoxFill( &box, ot, (1<<ot_length)-1 );
	}
	v=(SVECTOR *)(BACKTMD_ADDR+28+12);
	for ( x=0 ; x<NUMBER_BTMD+1 ; x++ )
		for ( y=0 ; y<4 ; y++, v++ )
			v->vx=((((x-(NUMBER_BTMD/2))*128+64-(k & 127))*(y+2))>>1)*25;
	RotMatrixZ( -Gsys.BackRotZ, &MT2 );
	MT2.t[1]=(((PROJECTION_LONG*Gsys.tand[(Gsys.BackRotX+1024) & 2047])>>12)-1+yp)*50;

	if (Gsys.cource_type!=0)
	{
		GsSetLsMatrix( &MT2 );
		GsSortObject4(&DOBJ_BACK_SPRITE,ot,14-ot_length-2,NULL);
		return;
	}

	k %= 1920;
	if (k<0) k+=1920;
	for( i=0 ; i<NUMBER_SEARCHLIGHT ; i++, v+=3 )
	{
		x=ligx3[i]*Gsys.sind2[cir[i] & 2047]>>12;
		v[0].vx=-(k-ligx[i])*25-160*25, v[0].vy=-60*25-ligy[i]*25;
		v[1].vx=-(k-ligx2[i]-x)*25-6*25-160*25, v[1].vy=-200*25-ligy[i]*25;
		v[2].vx=-(k-ligx2[i]-x)*25+6*25-160*25, v[2].vy=-200*25-ligy[i]*25;
		v[1].vz=v[2].vz=PROJECTION_LONG*25;
		cir[i]+=cira[i];
	}
	GsSetLsMatrix( &MT2 );
	GsSortObject4(&DOBJ_BACK_SPRITE,ot,14-ot_length-2,NULL);
}

void rank_draw( GsOT *ot, int ot_length )
{
	int i=0, ma;
	static SVECTOR NT[3];
	VECTOR VS={3072,3072,4096};

	if (Gsys.replay_timming==1)
		memset( (char *)&NT, 0, sizeof(SVECTOR)*3 );

	ma=Gsys.replay_timming/20;

	if (Gsys.replay_timming<200)
	{
		for ( i=0 ; i<ma && i<3 ; i++ )
		{
			if (CRD_ALPHABET[i].coord.t[2]>3000)
			{
				NT[i].vy-=4096/((15000-3000)/1000);
				CRD_ALPHABET[i].coord.t[0]+=(i-1)*(800/((15000-3000)/500));
				CRD_ALPHABET[i].coord.t[2]-=1000;
				RotMatrix( &NT[i], &CRD_ALPHABET[i].coord );
				if (i!=0)
					ScaleMatrix( &CRD_ALPHABET[i].coord, &VS );
			}
		}
	}
	if (Gsys.replay_timming>=200 && Gsys.replay_timming<=260)
	{
		for ( i=0 ; i<3 ; i++ )
		{
			CRD_ALPHABET[i].coord.t[0]-=25;
			CRD_ALPHABET[i].coord.t[1]-=22;
			CRD_ALPHABET[i].coord.t[2]+=40;
		}
	}
	for ( i=0 ; i<ma && i<3 ; i++ )
		_DrawObjectNAMA( ot, ot_length, DOBJ_ALPHABET[i] );
}

void make_chip_tmd( int n )
{
	u_char *w=DIVIDE_CAR_ADDR;
	SVECTOR *v;
	int i;

//	printf( "start make chip" );

	DWORD( w )=0x41;
	DWORD( w+4 )=0;
	DWORD( w+8 )=1;
	w+=12;
	DWORD( w )=28;
	DWORD( w+4 )=MAX_CHIP*3;
	DWORD( w+8 )=28+DWORD(w+4)*sizeof(SVECTOR);
	DWORD( w+12 )=MAX_CHIP;
	DWORD( w+16 )=DWORD( w+8 )+DWORD(w+12)*sizeof(SVECTOR);
	DWORD( w+20 )=MAX_CHIP*2;
	DWORD( w+24 )=0;
	w+=28;
	v=(SVECTOR *)w;
	for ( i=0 ; i<MAX_CHIP*3 ; i++, v++ )
	{
		v[0].vx=0;
		v[0].vy=0;
		v[0].vz=0;
	}
	for ( i=0 ; i<MAX_CHIP ; i++, v++ )
		v->vx=0, v->vy=0, v->vz=-4096;
	w=(u_char *)v;
	for ( i=0 ; i<MAX_CHIP ; i++ )
	{
		DWORD( w )=0x20000304;
		w[4]=255;
		w[5]=255;
		w[6]=255;
		w[7]=0x20;
		WORD( w+8 )=i;
		WORD( w+10 )=i*3;
		WORD( w+12 )=i*3+1;
		WORD( w+14 )=i*3+2;
		w+=16;
		DWORD( w )=0x20000304;
		w[4]=255;
		w[5]=200;
		w[6]=0;
		w[7]=0x20;
		WORD( w+8 )=i;
		WORD( w+10 )=i*3+2;
		WORD( w+12 )=i*3+1;
		WORD( w+14 )=i*3;
		w+=16;
	}
//	printf( "end make chip" );
}

void sort_position( int p )
{
	int y, x, dis[4], max=0, d=0, max_n=4;
	if (Gsys.GameMode==3) max=2;
	for ( y=0 ; y<max_n ; y++ )
		dis[y]=cars_scra[y+p]->line_position;
	for ( y=0 ; y<max_n ; y++ )
	{
		max=-1000;
		for ( x=0 ; x<max_n ; x++ )
			if (dis[x]>max)
			{
				max=dis[x];
				d=x;
			}
		Gsys.cars_pos[y+p]=d+p;
		cars_scra[d+p]->rank=y+p;
		dis[d]=-65536;
	}
}

void start_count( GsOT *ot, int ot_length )
{
	int i, j;
	SVECTOR VX={0,0,0};
	static int voice_beep=-1;

	Gsys.start_count--;
	i=Gsys.start_count/60;
	if (i<4)
	{
		j=Gsys.start_count % 60;
		if (j==0)
		{
			if (i==0)
			{
				if (voice_beep!=-1)
					SsUtKeyOff( voice_beep, Gsys.vab_se, SND_BEEP, 0, 20 );
				SsSeqPlay( Gsys.seq, SSPLAY_PLAY, SSPLAY_INFINITY );
				SsSeqSetVol( Gsys.seq, 127,127 );
			}
			else
			{
				if (i<2) SsUtKeyOff( voice_beep, Gsys.vab_se, SND_BEEP, 0, 20 );
				voice_beep=SsUtKeyOn( Gsys.vab_se, SND_BEEP, 0, 20, 0, 127, 127 );
			}
		}
		if (j<=20 && i!=0)
		{
			i--;
			VX.vy=-4096/20*((j-40));
			RotMatrix( &VX, &CRD_ALPHABET[i].coord );
		}
		if (i!=3)
		{
			_DrawObjectNAMA( ot, ot_length, DOBJ_ALPHABET[i] );
			CRD_ALPHABET[i].flg=0;
		}
	}
}

void goal_count( GsOT *ot, int ot_length )
{
	int i, ma;
	static SVECTOR VX[6];

	if (Gsys.goal_count==1)
		memset( (char *)&VX, 0, sizeof(SVECTOR)*6 );

	Gsys.goal_count++;
	ma=Gsys.goal_count>>3;

	if (Gsys.GameMode==3)
	{
		for ( i=3 ; i<ma+3 && i<6 ; i++ )
		{
			if (CRD_ALPHABET[i].coord.t[2]>3000)
			{
				VX[i-3].vy+=4096/((4000-3000)/200);
				CRD_ALPHABET[i].coord.t[2]-=200;
				RotMatrix( &VX[i-3], &CRD_ALPHABET[i].coord );
			}
			if (cars_scra[Gsys.draw_player]->finish_rank==0)
				_DrawObjectNAMA( ot, ot_length, DOBJ_ALPHABET[i] );
		}
		for ( i=6 ; i<ma+6 && i<10 ; i++ )
		{
			if (CRD_ALPHABET[i].coord.t[2]>3000)
			{
				VX[i-3].vy+=4096/((4000-3000)/200);
				CRD_ALPHABET[i].coord.t[2]-=200;
				RotMatrix( &VX[i-3], &CRD_ALPHABET[i].coord );
			}
			if (cars_scra[Gsys.draw_player]->finish_rank==1)
				_DrawObjectNAMA( ot, ot_length, DOBJ_ALPHABET[i] );
		}
	}
	else
	{
		if (Gsys.GameMode!=0)
			for ( i=3 ; i<ma+3 && i<9 ; i++ )
			{
				if (CRD_ALPHABET[i].coord.t[2]>4000)
				{
					VX[i-3].vy+=4096/((4000-3000)/200);
					CRD_ALPHABET[i].coord.t[2]-=200;
					RotMatrix( &VX[i-3], &CRD_ALPHABET[i].coord );
				}
				_DrawObjectNAMA( ot, ot_length, DOBJ_ALPHABET[i] );
			}
		else
			for ( i=3 ; i<ma+3 && i<6 ; i++ )
			{
				if (CRD_ALPHABET[i+cars_scra[0]->finish_rank*3].coord.t[2]>4000)
				{
					VX[i+cars_scra[0]->finish_rank*3-3].vy+=4096/((4000-3000)/200);
					CRD_ALPHABET[i+cars_scra[0]->finish_rank*3].coord.t[2]-=200;
					RotMatrix( &VX[i-3], &CRD_ALPHABET[i+cars_scra[0]->finish_rank*3].coord );
				}
				_DrawObjectNAMA( ot, ot_length, DOBJ_ALPHABET[i+cars_scra[0]->finish_rank*3] );
			}
	}
}

int rec_replaydata( int pd, int replay )
{
	int pde, las;
	if (replay & 2) //Ghost Rec
	{
		if (Gsys.rec_p2_g*2!=REPLAY_SIZE)
		{
			pde=((pd & 15) | ((pd & (7<<5))>>1) | ((pd & (15<<12))>>5));
			if (Gsys.rec_p2_g!=0 &&
				(REPLAY_DATA_G[Gsys.rec_p2_g-1]>>5)==pde
				 && (REPLAY_DATA_G[Gsys.rec_p2_g-1] & 31)!=31)
			{
				REPLAY_DATA_G[Gsys.rec_p2_g-1]++;
			}
			else
			{
				REPLAY_DATA_G[Gsys.rec_p2_g] = pde<<5;
				Gsys.rec_p2_g++;
			}
		}
	}
	if ((replay & 1)==0)
	{
		if (Gsys.rec_p2*2!=REPLAY_SIZE)
		{
			pde=((pd & 15) | ((pd & (7<<5))>>1) | ((pd & (15<<12))>>5));
			if (Gsys.rec_p2!=0 &&
				(REPLAY_DATA[Gsys.rec_p2-1]>>5)==pde
				 && (REPLAY_DATA[Gsys.rec_p2-1] & 31)!=31)
			{
				REPLAY_DATA[Gsys.rec_p2-1]++;
			}
			else
			{
				REPLAY_DATA[Gsys.rec_p2] = pde<<5;
				Gsys.rec_p2++;
			}
		}
	}
	else
	{
		if (Gsys.rec_p2*2==REPLAY_SIZE) return(0);
		pd&=(PADselect | PADstart);
		pde=REPLAY_DATA[Gsys.rec_p2];
		las=pde & 31;
		pde>>=5;
		pd|=(pde & 15) | ((pde & (7<<4))<<1) | ((pde & (15<<7))<<5);
		if (las==0) Gsys.rec_p2++;
		else REPLAY_DATA[Gsys.rec_p2]--;
		Gsys.replay_timming++;
	}
	Gsys.rec_point++;
	return(pd);
}

int pause( int active )
{
	static GsSPRITE sp={ 0, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	int pd=0xffffffff, pdd, sel=0, i, col;
	RECT p1;

	setRECT( &p1, 320+256, 128, 128, 128 );
	ClearImage( &p1, 255,255,255 );
	DrawSync(0);
	VSync(0);
	DrawSync(0);
	VSync(0);
	setRECT( &p1, 0, (1-active)*240,320,240 );
	MoveImage( &p1, 0, (active)*240 );

	alphabet16(320+256,16,"CONTINUE");
	alphabet16(320+256,32,"RESTART ");
	alphabet16(320+256,48,"  EXIT  ");
//	Krom2Tim("‚b‚‚Ž‚”‚‰‚Ž‚•‚…",fbuff,320+256,128,0,480,32767,0);
//	loadTim( fbuff );
//	Krom2Tim("‚q‚…‚“‚”‚‚’‚”",fbuff,320+256,128+16,0,481,31<<5,0);
//	loadTim( fbuff );
//	Krom2Tim("‚d‚˜‚‰‚”",fbuff,320+256,128+32,0,480,32767,0);
//	loadTim( fbuff );
	sp.tpage=_GetTPage(0,0,320+256, 0);
	DrawSync(0);
	VSync(0);
	while( 1 )
	{
		pdd=pd;
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		pd=padd(pd0);
		for (i=0 ; i<3 ;i++)
		{
			if (sel==i)
				col=128<<8;
			else
				col=0x808080;
			draw_words_ot16(&Wot[active],-64+(i & 1)*8,-120+64+i*32,8,i+1,4096,col);
		}
		if ((pdd & PADRright)==0 && (pd & PADRright))
		{
			pcm( SND_OK );
			break;
		}
		if ((pdd & PADLdown)==0 && (pd & PADLdown) && sel!=2)
		{
			sel++;
			pcm( SND_CHANGE );
		}
		if ((pdd & PADLup)==0 && (pd & PADLup) && sel!=0)
		{
			sel--;
			pcm( SND_CHANGE );
		}

		GsSwapDispBuff();
		GsDrawOt( &Wot[active] );
		if ((pdd & PADRdown)==0 && (pd & PADRdown))
		{
			sel=0;
			pcm( SND_CANCEL );
			break;
		}
	}

	DrawSync(0);
	VSync(0);
//	printf( "sel %d", sel );
	return(sel);
}

void game_init2( int mode, int last_mode)
{
	int i, x, y;
	int lap_time[4];
	int finish_rank;
	SVECTOR SVZ={0,0,0};

	Gsys.replaying=0;
	if (mode==2 && last_mode!=2) Gsys.replay_timming=0;
	if (mode==2 || Gsys.GameMode==5)
	{
		if (mode!=2 && n_replay_data.car==5 && Gsys.mine==5)
		{
			Gsys.GameMode=4;
		}
		else
		{
			Gsys.cource_number=n_replay_data.cource;
			Gsys.rec_point=n_replay_data.play_time;
			if (mode==2)
			{
				Gsys.replaying=1;
				Gsys.front_mode=3;
				Gsys.mine=n_replay_data.car;
				Gsys.GameMode=n_replay_data.gamemode;
			}
			if (mode==2 && Gsys.replay_buff_sel)
			{
				Gsys.cource_number=n_replay_data_g.cource;
				Gsys.rec_point=n_replay_data_g.play_time;
				Gsys.mine=n_replay_data_g.car;
			}
			if (Gsys.replay_mode)
				Gsys.replay_timming=3000;
		}
	}
	if (mode!=2 || last_mode!=2)
	{
		if ( Gsys.GameMode==0 || Gsys.replay_mode )
			cource_select(Gsys.cource_number+1);
		cource_init( Gsys.cource_number, 0 );
		SsUtAllKeyOff(0);
	}
	for ( y=0 ; y<4 ; y++ )
		for ( x=0 ; x<4 ; x++ )
			Gsys.cars_distance[x][y]=1024;
	if (Gsys.replaying==0)
	{
		switch (Gsys.GameMode)
		{
		case 4:
		case 5:
			Gsys.front_mode=4;
			break;
		case 3:
			Gsys.front_mode=2;
			break;
		default:
			Gsys.front_mode=1;
			break;
		}
	}
	switch(Gsys.GameMode)
	{
	case 2:
		Gsys.enemy_number=0;
		Gsys.cars_number=1;
		break;
	case 3:
		Gsys.enemy_number=0;
		Gsys.cars_number=2;
		break;
	case 5:
		Gsys.enemy_number=0;
		Gsys.cars_number=2;
		break;
	case 4:
		Gsys.enemy_number=0;
		Gsys.cars_number=1;
		break;
	default:
		Gsys.enemy_number=3;
		Gsys.cars_number=4;
		break;
	}
//Gsys init
	Gsys.vrot[0]=SVZ;
	Gsys.vrot[1]=SVZ;
	Gsys.time=0;
	Gsys.goal_count=0;
	Gsys.best_draw=0;
	Gsys.effectVoice=-1;
	Gsys.wrong_time=0;
	Gsys.start_count=0;
	Gsys.ana0=0;
	Gsys.ana1=0;
	Gsys.draw_player=0;
	Gsys.timming=0;
	Gsys.rec_p2=0;
	Gsys.rec_p2_g=0;
	Gsys.replay_view_remain=0;
	Trn.time=0;
//Def TMD
	make_chip_tmd( Gsys.mine );
	crd_set(&CRD_BACK_SPRITE,GsIDMATRIX,&CRD_COURCE);
	obj_set(&DOBJ_BACK_SPRITE,&CRD_BACK_SPRITE,(u_long *)BACKTMD_ADDR,0,0);
	crd_set( &CRD_CHIP, GsIDMATRIX, &CRD_COURCE );
	obj_set( &DOBJ_CHIP, &CRD_CHIP, (u_long *)DIVIDE_CAR_ADDR, 0, 0 );
	for (i=0 ; i<4 ; i++)
	{
		cars_scra[i]->warnVoice=-1;
		cars_scra[i]->damageVoice=-1;
		memcpy( lap_time, cars_scra[i]->lap_time, sizeof(lap_time) );
		finish_rank=cars_scra[i]->finish_rank;
		memset((u_char *)cars_scra[i],0,sizeof(struct s_CARS_DATA));
		memcpy( cars_scra[i]->lap_time, lap_time, sizeof(lap_time) );
		cars_scra[i]->finish_rank=finish_rank;
		cars_scra[i]->effect=0;
		cars_scra[i]->lap=0;
		cars_scra[i]->last_lap=3;
		Gsys.viewR[i].super=&CRD_COURCE;
		Gsys.view[i].super=&CRD_COURCE;
		cars_scra[i]->tei=100;
		cars_scra[i]->timming=0;
		cars_scra[i]->wallVoice=-1;
		cars_scra[i]->boost_tone=BOOST_TONE;
	}
}

void game_init( int mode, int last_mode )
{
	VECTOR COUNT={-500*2,-200*2,3000*2}, FINISH={-1500,0,5000}, FINISH2={-600,-600,5000};
	char *m_finish="FINISH";
	char *m_finish2="WINLOSE";
	char *m_finish3="1ST2ND3RD4TH";
	char tmp[32];
	u_long *addr;
	int i, j, n;
	int lev[][9]={
		{ 1, 1, 2, 3, 4, 5, 6, 4, 6 },
		{ 2, 2, 3, 4, 5, 6, 7, 5, 7 },
		{ 4, 4, 4, 7, 6, 7, 8, 6, 8 },
		{ 10, 8, 6, 9, 8, 10, 10, 8, 10 }
	};
	MATRIX MT=GsIDMATRIX;
	VECTOR VZ[]={ {1000,0,0}, {2500,0,3000}, {1000,0,6000}, {2500,0,9000},
					{1000,0,0}, {2500,0,0} };
	VECTOR OST={0,0,15000};
	char *nst[]={"1ST","2ND","3RD","4TH"};

	if (Gsys.GameMode==4 && n_replay_data.he==('h'+('R'<<8))
			 && Gsys.cource_number==n_replay_data.cource
				 && n_replay_data.gamemode==4 && mode!=2)
			Gsys.GameMode=5;
	if (mode!=2)
		Gsys.replay_buff_sel=0;
	if (Gsys.GameMode==5 && mode==2) Gsys.GameMode=4;
	game_init2( mode, last_mode );
	if (mode==2)
	{
		if (Gsys.replay_buff_sel)
			memcpy( (char *)REPLAY_DATA, (char *)REPLAY_DATA_G, REPLAY_SIZE );
		else
			memcpy( (char *)REPLAY_DATA, (char *)REPLAY_BUFF, REPLAY_SIZE );
	}
	else
	{
		if (Gsys.GameMode==5)
		{
			memcpy( (char *)REPLAY_DATA, (char *)REPLAY_BUFF, REPLAY_SIZE );
		}
		Gsys.seq=SsSeqOpen( (u_long *)SEQ0_ADDR, Gsys.vab_bgm );
		for (i=0 ; i<=(Gsys.GameMode==3) ; i++)
		{
			cars_scra[i]->windVoice=SsUtKeyOn( Gsys.vab_se, SND_WIND, 0, 8, 0, 0, 0 );
			cars_scra[i]->boostLVoice=SsUtKeyOn( Gsys.vab_se, SND_WIND, 0, BOOST_TONE, 0,0,0 );
			cars_scra[i]->boostRVoice=SsUtKeyOn( Gsys.vab_se, SND_WIND, 0, BOOST_TONE, 0,0,0 );
			cars_scra[i]->boostBVoice=SsUtKeyOn( Gsys.vab_se, SND_WIND, 0, BOOST_TONE, 0,0,0 );
		}
	}
	switch(Gsys.GameMode)
	{
	default:
		car_init( 0, 0x1, Gsys.mine, 0, &CRD_COURCE, 0 );
		for (i=0,j=0 ; i<4 && j<3 ; i++ )
		{
			if (i==Gsys.mine) continue;
			j++;
			if (mode==2) n=lev[n_replay_data.level+1][Gsys.cource_number];
			else n=lev[save_data.level+1][Gsys.cource_number];
			car_init( j, 0x1, i, n, &CRD_COURCE, 0 );
		}
		for (i=0 ; i<4 ; i++ )
			car_position( i, &VZ[i], 0 );
		GsSetProjection(PROJECTION_LONG);
		Gsys.rec_rpl=1;
		break;
	case 5:
		car_init( 0, 0x1, Gsys.mine, 0, &CRD_COURCE, 0 );
		if (Gsys.replaying)
			car_init( 1, 0x1, n_replay_data_g.car, 0, &CRD_COURCE, 0 );
		else
			car_init( 1, 0x1, n_replay_data.car, 0, &CRD_COURCE, 0 );
		car_position( 0, &VZ[0], 0 );
		car_position( 1, &VZ[0], 0 );
		Gsys.rec_rpl=1;
		break;
	case 3:
		car_init( 0, 0x1, Gsys.mine, 0, &CRD_COURCE, 0 );
		car_init( 1, 0x1, Gsys.mine2, 0, &CRD_COURCE, 0 );
		car_position( 0, &VZ[4], 0 );
		car_position( 1, &VZ[5], 0 );
		GsSetProjection(PROJECTION_LONG/2);
		Gsys.rec_rpl=0;
		break;
	}
	sort_position( 0 );
	if (Gsys.replaying==1)
	{
		Gsys.rec_last=Gsys.rec_point;
		Gsys.rec_point=0;
		Gsys.start_count=0;
		Gsys.replay_timming--;
		if (last_mode!=2 && Gsys.replay_mode==0)
		{
			for (i=0 ; i<3 ; i++ )
			{
				_setMATRIXsVECTOR(&MT,OST);
				addr=alphabet_addr( nst[cars_scra[0]->finish_rank][i], &n );
				crd_set(&CRD_ALPHABET[i],MT,WORLD);
				obj_set(&DOBJ_ALPHABET[i],&CRD_ALPHABET[i],addr,n,0);
			}
			CRD_ALPHABET[1].coord.t[0]+=70;
			CRD_ALPHABET[2].coord.t[0]+=70;
			CRD_ALPHABET[1].coord.t[1]+=70;
			CRD_ALPHABET[2].coord.t[1]+=70;
			j=10*60*60;
			for (i=0 ; i<3 ; i++ )
				if (cars_scra[0]->lap_time[i]<j)
				{
					j=cars_scra[0]->lap_time[i];
					Gsys.fbest_lap=i;
				}
			Gsys.time--;
			Gsys.entry_check=entry_check( j, Gsys.total_time );
		}
		if (last_mode!=2 && last_mode!=15)
		{
			SsUtAllKeyOff(0);
			VSync(2);
			SeqPlay( "ENTRY1.SEQ", 1 );
			Gsys.bestline=sort_betlap( 2, cars_scra[0]->lap_time[Gsys.fbest_lap], NULL );
			Gsys.totalline=sort_betlap( 3, Gsys.total_time, NULL );
		}
//		printf("REplay set END\n");
	}
	else
	{
		for (i=0 ; i<3 ; i++ )
		{
			_setMATRIXsVECTOR(&MT,COUNT);
			addr=alphabet_addr( "123"[i], &n );
			crd_set(&CRD_ALPHABET[i],MT,WORLD);
			obj_set(&DOBJ_ALPHABET[i],&CRD_ALPHABET[i],addr,n,0);
		}
		if (Gsys.GameMode!=3)
		{
			if (Gsys.GameMode!=0)
				for (i=0 ; i<6 ; i++ )
				{
					_setMATRIXsVECTOR(&MT,FINISH);
					addr=alphabet_addr( m_finish[i], &n );
					crd_set(&CRD_ALPHABET[3+i],MT,WORLD);
					obj_set(&DOBJ_ALPHABET[3+i],&CRD_ALPHABET[3+i],addr,n,0);
					FINISH.vx+=600;
				}
			else
				for (i=0 ; i<12 ; i++ )
				{
					if ((i % 3)==0) FINISH2.vx=-600;
					_setMATRIXsVECTOR(&MT,FINISH2);
					addr=alphabet_addr( m_finish3[i], &n );
					crd_set(&CRD_ALPHABET[3+i],MT,WORLD);
					obj_set(&DOBJ_ALPHABET[3+i],&CRD_ALPHABET[3+i],addr,n,0);
					FINISH2.vx+=600;
				}
		}
		else
		{
			FINISH.vx=-600;
			for (i=0 ; i<3 ; i++ )
			{
				_setMATRIXsVECTOR(&MT,FINISH);
				crd_set(&CRD_ALPHABET[3+i],MT,WORLD);
				addr=alphabet_addr( m_finish2[i], &n );
				obj_set(&DOBJ_ALPHABET[3+i],&CRD_ALPHABET[3+i],addr,n,0);
				FINISH.vx+=600;
			}
			FINISH.vx=-900;
			for (i=0 ; i<4 ; i++ )
			{
				_setMATRIXsVECTOR(&MT,FINISH);
				crd_set(&CRD_ALPHABET[6+i],MT,WORLD);
				addr=alphabet_addr( m_finish2[i+3], &n );
				obj_set(&DOBJ_ALPHABET[6+i],&CRD_ALPHABET[6+i],addr,n,0);
				FINISH.vx+=600;
			}
		}
		if (Gsys.GameMode==5)
			Gsys.rec_last=Gsys.rec_point;
		Gsys.rec_point=0;
		Gsys.replay_timming=0;
		Gsys.start_count=300;
		cars_scra[0]->lap_time[3]=0;
		cars_scra[1]->lap_time[3]=0;
		Gsys.total_time=0;
	}
//flame buff
	Gsys.best_lap_time[Gsys.cource_number]=best_data.best_lap[Gsys.cource_number+Gsys.TimeMode*9][0];
	if (Gsys.GameMode==0 && Gsys.best_lap_time[Gsys.cource_number]>Gsys.gran_laps[(Gsys.cource_number % 3)*2])
		Gsys.best_lap_time[Gsys.cource_number]=Gsys.gran_laps[(Gsys.cource_number % 3)*2];
	get_record_time( tmp, Gsys.best_lap_time[Gsys.cource_number] );
	for (i=0 ; i<8 ; i++ )
		alphabet88( 576+32,384+8*i, "00\'00\"00" );
	alphabet88( 576+32,384, tmp );
	if (Gsys.ending==0) alphabet16(320+256,0,cource_name[Gsys.cource_number]);
}

int game_end( int mode, int endd )
{
	int i,j;
	if (Gsys.replaying==0 && Gsys.goal_count && (Gsys.GameMode==0 || Gsys.GameMode==1 || Gsys.GameMode==4))
	{
		n_replay_data.he=('h'+('R'<<8));
		n_replay_data.car=Gsys.mine;
		n_replay_data.cource=Gsys.cource_number;
		n_replay_data.play_time=Gsys.rec_point;
		n_replay_data.data_size=Gsys.rec_p2*2;
		n_replay_data.flame_size=(Gsys.rec_p2*2+127) & (0xff<<7);
		n_replay_data.gamemode=Gsys.GameMode;
		n_replay_data.total_time=Gsys.total_time;
		n_replay_data.level=save_data.level;
		memcpy( (char *)REPLAY_BUFF, (char *)REPLAY_DATA, REPLAY_SIZE );
		if (Gsys.GameMode==4)
		{
			memcpy( (char *)REPLAY_DATA_G, (char *)REPLAY_DATA, REPLAY_SIZE );
			n_replay_data_g=n_replay_data;
		}
	}
	if (Gsys.replaying==0 && Gsys.goal_count && Gsys.GameMode==5)
	{
		Gsys.replay_buff_sel=1;
		n_replay_data_g.he=('h'+('R'<<8));
		n_replay_data_g.car=Gsys.mine;
		n_replay_data_g.cource=Gsys.cource_number;
		n_replay_data_g.play_time=Gsys.rec_point;
		n_replay_data_g.data_size=Gsys.rec_p2_g*2;
		n_replay_data_g.flame_size=(Gsys.rec_p2_g*2+127) & (0xff<<7);
		n_replay_data_g.gamemode=4;
		n_replay_data_g.total_time=Gsys.total_time;
		if (Gsys.total_time<n_replay_data.total_time)
		{
			n_replay_data.he=('h'+('R'<<8));
			n_replay_data.car=Gsys.mine;
			n_replay_data.cource=Gsys.cource_number;
			n_replay_data.play_time=Gsys.rec_point;
			n_replay_data.data_size=Gsys.rec_p2_g*2;
			n_replay_data.flame_size=(Gsys.rec_p2_g*2+127) & (0xff<<7);
			n_replay_data.gamemode=4;
			n_replay_data.total_time=Gsys.total_time;
			memcpy( (char *)REPLAY_BUFF, (char *)REPLAY_DATA_G, REPLAY_SIZE );
		}
	}
	if (Gsys.replay_mode==0)
	{
		if (Gsys.GameMode==0 && (endd==2 || (endd==1 && Gsys.goal_count && cars_scra[0]->finish_rank)))
		{
			Gsys.entry_plus=1;
			j=10*60*60;
			for (i=0 ; i<3 ; i++ )
				if (cars_scra[0]->lap_time[i]<j)
				{
					j=cars_scra[0]->lap_time[i];
					Gsys.fbest_lap=i;
				}
			if (Gsys.gran_laps[(Gsys.cource_number % 3)*2]>cars_scra[0]->lap_time[Gsys.fbest_lap])
				Gsys.gran_laps[(Gsys.cource_number % 3)*2]=cars_scra[0]->lap_time[Gsys.fbest_lap];
			if (Gsys.gran_laps[(Gsys.cource_number % 3)*2+1]>Gsys.total_time)
				Gsys.gran_laps[(Gsys.cource_number % 3)*2+1]=Gsys.total_time;
			if (cars_scra[0]->finish_rank==0) endd=4;
		}
		if (Gsys.replaying==1 && Gsys.entry_check==1) endd=2;
	}
	if (endd!=2 || mode!=2)
	{
		warning( 0, 0 );
		warning( 0, 1 );
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
	GsSetProjection(PROJECTION_LONG);
	if (endd==0) endd=-1;
	if (Gsys.GameMode==3 && endd!=1) endd=-1;
	if (Gsys.GameMode==0 && (endd==10 || endd==11))
	{
		if (endd==10)
			grandprix_entry_mode( (Gsys.cource_number % 3)+1, 1-Gsys.entry_plus );
		else
			grandprix_entry_mode( (Gsys.cource_number % 3)+1, 0 );
		endd=-1;
	}
	return( endd );
}

int sel_continue( GsOT *ot, int ot_length, int timm, int mode )
{
	static int sel, rot_tim;
	MATRIX MT=GsIDMATRIX;
	VECTOR FINISH={-9*300+300,-1000,6000}, FINISH2={-3*300+300,1000,5000};
	u_char *wd="CONTINUE?", *wd2="YESNO";
	SVECTOR VR={0,0,0};
	int i, n;
	u_long *addr;
//	printf("timm=%d\n", timm);
	if (timm==0)
	{
		if (Gsys.GameMode==1 || Gsys.GameMode==4 || Gsys.GameMode==5
				|| (Gsys.GameMode==0 && cars_scra[0]->finish_rank==0 && mode!=1)) return(10);
		sel=0;
		rot_tim=0;
		for (i=0 ; i<9 ; i++ )
		{
			_setMATRIXsVECTOR(&MT,FINISH);
			addr=alphabet_addr( wd[i], &n );
			crd_set(&CRD_ALPHABET[i],MT,WORLD);
			obj_set(&DOBJ_ALPHABET[i],&CRD_ALPHABET[i],addr,n,0);
			FINISH.vx+=600;
		}
		for (i=0 ; i<3 ; i++ )
		{
			_setMATRIXsVECTOR(&MT,FINISH2);
			addr=alphabet_addr( wd2[i], &n );
			crd_set(&CRD_ALPHABET[i+9],MT,WORLD);
			obj_set(&DOBJ_ALPHABET[i+9],&CRD_ALPHABET[i+9],addr,n,0);
			FINISH2.vx+=600;
		}
		FINISH2.vx-=2*600+300;
		for (i=0 ; i<2 ; i++ )
		{
			_setMATRIXsVECTOR(&MT,FINISH2);
			addr=alphabet_addr( wd2[i+3], &n );
			crd_set(&CRD_ALPHABET[i+12],MT,WORLD);
			obj_set(&DOBJ_ALPHABET[i+12],&CRD_ALPHABET[i+12],addr,n,0);
			FINISH2.vx+=600;
		}
		return(1-mode);
	}
	if (padd(pd0)==PADLright && rot_tim==0) rot_tim=-16;
	if (padd(pd0)==PADLleft && rot_tim==0) rot_tim=16;
	if (padd(pd0)==PADRright && sel==0) return(20000);
	if (padd(pd0)==PADRright && sel==1) return(80000);
	if (rot_tim>0) rot_tim--;
	if (rot_tim<0) rot_tim++;
	if (rot_tim==8) sel=(sel+1) & 1;
	if (rot_tim==-8) sel=(sel+1) & 1;
	for ( i=0 ; i<9 ; i++ )
		_DrawObjectNAMA( ot, 1, DOBJ_ALPHABET[i] );
	for ( i=0 ; i<3-sel ; i++ )
	{
		if (rot_tim>0 && rot_tim<8) VR.vy=2048*rot_tim/16;
		if (rot_tim>=8) VR.vy=2048*(rot_tim-16)/16;
		if (rot_tim<-8) VR.vy=2048*(16+rot_tim)/16;
		if (rot_tim<0 && rot_tim>=-8) VR.vy=2048*rot_tim/16;
		RotMatrix( &VR, &CRD_ALPHABET[i+9+sel*3].coord );
		_DrawObjectNAMA( ot, 1, DOBJ_ALPHABET[i+9+sel*3] );
	}
	return(mode);
}

int game_draw( GsOT *ot, int active )
{
	int i, l;
	MATRIX MT;
	if (Gsys.GameMode==0 && cars_scra[0]->over)
	{
		if (cars_scra[0]->over<=3 && cars_scra[0]->over>0)
		{
			cars_scra[0]->over+=sel_continue( ot, OT_LENGTH, cars_scra[0]->over-3,1 );
			if (cars_scra[0]->over>1000 && cars_scra[0]->over<50000)
				return( 1+1 );
			if (cars_scra[0]->over>60000)
				return( 10+1 );
		}
		if (cars_scra[0]->over>=-3 && cars_scra[0]->over<0)
		{
			cars_scra[0]->over-=sel_continue( ot, OT_LENGTH, cars_scra[0]->over+3,1 );
			if (cars_scra[0]->over<-1000 && cars_scra[0]->over>-50000)
				return( 1+1 );
			if (cars_scra[0]->over<-60000)
				return( 10+1 );
		}
	}
	if (Gsys.goal_count && Gsys.GameMode!=2)
	{
		if (Gsys.GameMode!=0 || cars_scra[0]->finish_rank!=0)
			view_set( 1+16 );
		if (Gsys.replaying)
			Gsys.goal_count++;
		if (Gsys.goal_count>=(60*3-3))
		{
			if (Gsys.replaying==0)
			{
				Gsys.goal_count+=sel_continue( ot, OT_LENGTH, (Gsys.goal_count-60*3)+3,0 );
			}
			if (Gsys.goal_count>60*3)
			{
				if (Gsys.goal_count>1000 && Gsys.goal_count<50000) return( 1+1 );
				if (Gsys.goal_count>60000) return( 11+1 );
				return( 3 );
//				endd=2;//-Gsys.replaying*2;
			}
		}
		else
		{
			if (Gsys.replaying==0) goal_count( ot, 4 );
		}
	}
	else
	{
		if (cars_scra[Gsys.draw_player]->over>=0) view_set( (Gsys.replaying<<5) );
	}
	for (i=0 ; i<4 && i<Gsys.cars_number ; i++)
	{
		GsGetLs( &CRD_C[i], &MT );
		l=(MT.t[2]>>(14-OT_LENGTH_CAR))-100;
		if (l>=15 && l<((1<<OT_LENGTH)-120))
		{
			GsClearOt( 0, l, &Wot_CAR[(active<<2)+i] );
			cars_scra[i]->draw=1;
		}
	}
	crash_chip( ot, OT_LENGTH );
	if (Gsys.start_count)
	{
		start_count( ot, 4 );
		if (Gsys.start_count>=60*3)
			draw_words_ot16(ot,-160+16,-8,16,0,4096,0x808080);
	}
	car_draw( &Wot_CAR[active<<2], OT_LENGTH_CAR );
	if (Gsys.GameMode!=3)
		back_draw( ot, OT_LENGTH );
	else
		back_draw2( ot, OT_LENGTH );
	if (cars_scra[0]->over>64 || cars_scra[1]->over>64)
	{
		if (cars_scra[0]->over>64)
			draw_bomb( &Wot_CAR[(active<<2)], 0, cars_scra[0]->over );
		else
			draw_bomb( &Wot_CAR[(active<<2)+1], 1, cars_scra[1]->over );
		if ((Gsys.time & 7)==7)
			if (Gsys.effectVoice!=-1)
			{
				SsUtSetVVol( Gsys.effectVoice, 0, 0 );
				SsUtKeyOff( Gsys.effectVoice, Gsys.vab_se, SND_BOMB, 0, Gsys.etone );
				Gsys.effectVoice=-1;
			}
		if ((Gsys.time & 7)==0)
		{
			Gsys.etone=30;
			Gsys.effectVoice=SsUtKeyOn( Gsys.vab_se, SND_BOMB, 0, 30, 0, 90, 90 );
		}
	}
	cource_draw( ot, OT_LENGTH );
	switch(Gsys.front_mode)
	{
	case 1:
		if (Gsys.goal_count<=(60*3-3) && cars_scra[0]->over==0)
			front_draw( ot, OT_LENGTH );
		break;
	case 2:
		front_draw_dv( ot, OT_LENGTH );
		break;
	case 3:
		front_draw_replay( ot, OT_LENGTH_CAR );
		break;
	case 4:
		front_draw_time( ot, OT_LENGTH_CAR );
		break;
	}
	for (i=0 ; i<Gsys.cars_number ; i++)
		if (cars_scra[i]->draw)
			GsSortOt( &Wot_CAR[(active<<2)+i], ot );
	return(0);
}

// mode
// -1..view replay
// 0..grandprix
// 1..restart
// 2..replay
// 4..next_stage
// GameMode  0: GrandPrix
//           1: GrandPrixPractice
//           2: FreeRun
//           3: VS BATTLE
//           4: TIME ATTACK
//           5: with Ghost
// endd ... 0  EXIT
//          1  RESTART
//          2  GOAL
//          4  NEXT STAGE
//         10  SEL_CONTINUE NO(BOMB DROP)
//         11  SEL_CONTINUE NO(2ND GOAL)
int game( int mode )
{
	int pdd[2]={0,0}, pd[2]={0,0};
	int active, endd=-1, i;
	static last_mode=0;
	RECT rect={0,0,320,120};
	Gsys.ending=0;

	if (mode==-1)
	{
		last_mode=0;
		Gsys.replay_mode=1;
		mode=2;
	}
	if (mode==4)
	{
		Gsys.cource_number++;
		Gsys.entry_plus=0;
	}
	game_init( mode, last_mode );

	while( 1 )
	{
		if (Gsys.replay_mode==1)
		{
			if (pd[0]==PADRdown) break;
			pd[0]=0;
		}
		if (Gsys.time==59*60*60)
			cars_scra[0]->over=5*60;
		if (cars_scra[Gsys.draw_player]->over)
		{
			if (Gsys.GameMode==3)
			{
				if (Gsys.goal_count==0)
				{
					Gsys.goal_count++;
					cars_scra[Gsys.draw_player]->finish_rank=1;
					cars_scra[1-Gsys.draw_player]->finish_rank=0;
				}
				if (cars_scra[Gsys.draw_player]->over>3)
					cars_scra[Gsys.draw_player]->over-=2;
			}
			else
			{
				Gsys.goal_count=0;
				if (cars_scra[0/*Gsys.draw_player*/]->over>0)
				{
					cars_scra[0/*Gsys.draw_player*/]->over--;
					if (cars_scra[0/*Gsys.draw_player*/]->over==1)
					{
						endd=1;
						break;
					}
				}
				else
				{
					cars_scra[0/*Gsys.draw_player*/]->over++;
					if (cars_scra[0/*Gsys.draw_player*/]->over==-1)
					{
						endd=1;
						break;
					}
				}
			}
			pd[0]=0;
		}
		if (Gsys.start_count==0 && Gsys.rec_rpl)
		{
			if (Gsys.GameMode==5)
				pd[1]=rec_replaydata( pd[0], 3 );
			else
				pd[0]=rec_replaydata( pd[0], Gsys.replaying );
			Gsys.timming++;
			if (Gsys.rec_point>=Gsys.rec_last)
			{
				if (Gsys.GameMode==5) pd[1]=0;
				if (Gsys.replaying)
				{
					endd=2;
					break;
				}
			}
		}
//		for (i=0 ; i<Gsys.cars_number ; i++)
		car_preope( Gsys.cars_number );
		if (Gsys.GameMode!=5)
			cars_distance_set();
		if (Gsys.start_count==0)
		{
			if (Gsys.goal_count)
			{
				for (i=0 ; i<Gsys.cars_number-Gsys.enemy_number ; i++ )
				{
					if (Gsys.GameMode==0 && cars_scra[0]->finish_rank==0)
						cars_scra[0]->lev=10;
					car_enemy( i, 0xffffffff );
					SsUtSetVVol( cars_scra[i]->boostBVoice, 0,0 );
					SsUtSetVVol( cars_scra[i]->boostRVoice, 0,0 );
					SsUtSetVVol( cars_scra[i]->boostLVoice, 0,0 );
				}
			}
			else
			{
				for (i=0 ; i<Gsys.cars_number-Gsys.enemy_number ; i++ )
					car_action(i, pd[i]);
				if (Gsys.replaying==0)
					Gsys.total_time++;
			}
			for (i=Gsys.cars_number-Gsys.enemy_number ; i<Gsys.cars_number ; i++)
				car_enemy( i, 0xffffffff );
			Gsys.time++;
			cars_scra[0]->time++;
			cars_scra[1]->time++;
		}
		if (Gsys.GameMode!=3) active=GsGetActiveBuff();
		else active=Gsys.draw_player;
		if (_padd(pd0) & PADstart)
		{
			if (Gsys.replaying)
			{
				if (Gsys.entry_check==1 && Gsys.replay_timming<1050)
					Gsys.replay_timming=1050;
				if (Gsys.entry_check==0)
				{
					endd=0;
					break;
				}
			}
			else
			{
				endd=pause( active );
				if (endd==1 || endd==2)
				{
					endd=2-endd;
					break;
				}
				active=GsGetActiveBuff();
			}
		}
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		if ((i=game_draw( &Wot[active], active )))
		{
			endd=i-1;
			break;
		}
		DrawSync(0);
		VSync(0);
		pdd[0]=pd[0];
		pd[0]=_padd(pd0);
		pdd[1]=pd[1];
		pd[1]=_padd(pd1);

		if (Gsys.GameMode==3)
		{
			if (Gsys.draw_player==0)
				GsSwapDispBuff();
			GsSetOffset( 160, 60+Gsys.draw_player*120 );
			rect.y=Gsys.draw_player*120;
			GsSetClip( &rect );
			Gsys.draw_player^=1;
			GsDrawOt( &Wot[active] );
		}
		else
		{
			GsSwapDispBuff();
			GsDrawOt( &Wot[active] );
		}
	}
	last_mode=mode;
	return( game_end( mode, endd ) );
}

int gamedemo()
{
	int i, l=0;
	int active;
	MATRIX MT;
	GsOT *ot;
	char *music[]={
	"B.SEQ",
	"SAMPLE16.SEQ",
	"SAMPLE15.SEQ",
	"HOVER4.SEQ",
	"TO7.SEQ",
	"ENTRY1.SEQ",
	"SELECT.SEQ",
	"SAMPLE19.SEQ",
	"HOVER2.SEQ",
	"CANION.SEQ",
	"SAMPLE21.SEQ"
	};
	

	Gsys.replay_mode=0;
	Gsys.cource_number=rand() % 9;
	Gsys.mine=3;
	Gsys.GameMode=1;
	Gsys.replay_view_remain=0;
	game_init( 0, 0 );
	Gsys.replaying=1;
	Gsys.start_count=0;
	for (i=0 ; i<4 ; i++ )
		cars_scra[i]->lev=8;
	alphabet16(320+256,0,"PRESS ANY BUTTON");

	SeqPlay( music[(rand() % 11)], 1 );

	while( padd(pd0)==0 )
	{
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
		if ((Gsys.time & 63)>31)
			draw_words_ot16(ot,-8*16,-8,16,0,4096,0x808080);
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
		car_draw( &Wot_CAR[active<<2], OT_LENGTH_CAR );
		back_draw( &Wot[active], OT_LENGTH );
		cource_draw( ot, OT_LENGTH );
		for (i=0 ; i<Gsys.cars_number ; i++)
			if (cars_scra[i]->draw)
				GsSortOt( &Wot_CAR[(active<<2)+i], ot );
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsDrawOt( &Wot[active] );
	}
	GsSetProjection(PROJECTION_LONG);

	SeqPlay( NULL, 0 );

	return( 0 );
}

void staff_draw()
{
	int x,y, i;
	u_char *sc=PACKED_WORK_ADDR;
	RECT rect;

	setRECT( &rect, 1024-256, 512-128, 128, 128 );
	StoreImage( &rect, (u_long *)COURCETMD_ADDR );
	VSync(0);
	DrawSync(0);
	memset( sc, 0, 0x1000 );
	LZS_unpack_one( COURCETMD_ADDR, sc, 0x1000, "STAFF2.TXT" );
	for( i=0 ; i<0x1000 ; i++ )
		if ( (sc[i]+(sc[i+1]<<8) )==0x0a0d)
			sc[i]=0;

	for (x=0 ; x<3 ; x++ )
		for (y=0 ; y<16 ; y++ )
		{
			japanese(448+x*64, y*16, sc, 7 );
//			printf("sc=%s",sc);
			sc+=strlen(sc)+2;
			if (strcmp(sc,"END")==0) break;
		}
}

int draw_name( GsOT *ot, int timm )
{
	static int mode, mmode, timm2, tline;
	GsBOXF box;
	static GsSPRITE sp={ 0, 0,0, 128,128, 0,
						 0,0, 0,0, 128,128,128, 0,0, 4096, 4096, 0 };
	int my[]={2,1,1,2,2,4,7,2,2};
	int y, x, i;
	if (timm==0) mode=0, timm2=0, tline=6;
	if (mmode!=mode) mmode=mode, timm2=0;

	switch( mode )
	{
	case 0:
	case 2:
	case 4:
		y=0;
		if (timm2<16) y=16-timm2;
		if (timm2>(32*2+60*2+24*2)-16) y=(timm2-((32*2+60*2+24*2)-16));
		box.attribute=0;
		box.x=-160, box.y=-y*2-120;
		box.w=320, box.h=32;
		box.r=box.g=box.b=0;
		GsSortBoxFill( &box, ot, 1 );
		box.y=120-32+y*2;
		GsSortBoxFill( &box, ot, 1 );
		if (timm2>32 && timm2<(32+60*2+24*2))
		{
			x=0;
			if ((timm2-32)<24) x=-(timm2-32-24);
			if ((timm2-32)>60*2+24) x=(timm2-32-60*2-24);
			sp.tpage=_GetTPage( 0,0,448, 0);
			sp.x=32-160+x*10;
			sp.y=-120+8;
			sp.w=16*16,sp.h=16;
			sp.u=0,sp.v=mode*16;
			sp.cx=0;
			sp.cy=480;
			GsSortFastSprite( &sp, ot, 0 );
			sp.x=32-160-x*10;
			sp.y=120-24;
			sp.w=16*16,sp.h=16;
			sp.u=0, sp.v=mode*16+16;
			sp.cx=0;
			sp.cy=480;
			GsSortFastSprite( &sp, ot, 0 );
		}
		if (timm2>32*2+60*2+24*2) mode++;
		break;
	case 1:
	case 3:
	case 5:
		if (timm2>60*3) mode++;
		break;
	case 6:
	case 8:
	case 10:
	case 12:
	case 14:
	case 16:
	case 18:
	case 20:
		box.attribute=0;
		box.x=-160, box.y=-120;
		box.w=320, box.h=240;
		box.r=box.g=box.b=0;
		GsSortBoxFill( &box, ot, 1 );
		x=0;
		if (timm2<24) x=timm2-24;
		if (timm2>24+60*2-20) x=timm2-60*2-24+20;
		y=(my[(mode-6)/2]+1)*24;
		sp.tpage=_GetTPage( 0,0,448+64*(tline/16), 0);
		sp.x=32-160-x*10;
		sp.y=-120+(240-y)/2;
		sp.w=16*16,sp.h=16;
		sp.u=0, sp.v=(tline & 15)*16;
		sp.cx=0;
		sp.cy=480;
		GsSortFastSprite( &sp, ot, 0 );
		for (i=0 ; i<my[(mode-6)/2] ; i++)
		{
			sp.tpage=_GetTPage( 0,0,448+64*((tline+1+i)/16), 0);
			sp.x=32-160+x*10*(1-((i & 1)<<1));
			sp.y=-120+(240-y)/2+i*24+32;
			sp.w=16*16,sp.h=16;
			sp.u=0, sp.v=((tline+1+i) & 15)*16;
			sp.cx=0;
			sp.cy=480;
			GsSortFastSprite( &sp, ot, 0 );
		}
		if (timm2>60*2+24*2-20)
		{
			tline+=my[(mode-6)/2]+1;
			mode++;
		}
		break;
	case 22:
		mode++;
	case 23:
		sp.tpage=_GetTPage( 0,0,448+64*((tline+1)/16), 0);
		sp.x=32-160;
		sp.y=-24;
		sp.w=16*16,sp.h=16;
		sp.u=0, sp.v=((tline+1) & 15)*16;
		sp.cx=0;
		sp.cy=480;
		GsSortFastSprite( &sp, ot, 0 );
		sp.tpage=_GetTPage( 0,0,448+64*((tline+2)/16), 0);
		sp.x=32-160;
		sp.y=8;
		sp.w=16*16,sp.h=16;
		sp.u=0, sp.v=((tline+2) & 15)*16;
		sp.cx=0;
		sp.cy=480;
		GsSortFastSprite( &sp, ot, 0 );
		break;
	case 7:
	case 9:
	case 11:
	case 13:
	case 15:
	case 17:
	case 19:
	case 21:
		if (timm2>(60*3-20)) mode++;
		break;
	}
	timm2++;
	if ((mode<6) || (mode & 1)) return( 0 );
	return( 1 );
}

void ending()
{
	int i, l=0, pd=0;
	int active;
	int timm;
	MATRIX MT;
	GsOT *ot;

	staff_draw();

	Gsys.ending=1;
	Gsys.replay_mode=0;
//	Gsys.mine=3;
	Gsys.GameMode=1;
	Gsys.start_count=0;
	Gsys.replay_view_remain=0;
	game_init( 2, 15 );
	Gsys.replaying=1;

	SeqPlay( "SAMPLE19.SEQ", 2 );

	for (timm=0 ; timm<60*68 ; timm++ )
	{
		if (padd(pd0) & PADstart) break;
		pd=rec_replaydata( 0, 1 );
		Gsys.timming++;
		if (Gsys.replaying && Gsys.rec_point>=Gsys.rec_last)
			break;
		car_preope( 4 );
		cars_distance_set(0);
		car_action(0, pd);
		for (i=1 ; i<4 ; i++)
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
		if (draw_name( ot, timm )==0)
		{
			car_draw( &Wot_CAR[active<<2], OT_LENGTH_CAR );
			back_draw( &Wot[active], OT_LENGTH );
			cource_draw( ot, OT_LENGTH );
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
	SeqPlay( NULL, 0 );
	Gsys.ending=0;
}

void make_back_tmd2()
{
	int x, y;
	unsigned char *p;
	SVECTOR *v;

	p=COURCETMD_ADDR;
	DWORD(p)=0x41;
	DWORD(p+4)=0;
	DWORD(p+8)=1;
	p+=12;
	DWORD(p)=(u_long)(28);
	DWORD(p+4)=4;
	DWORD(p+8)=(u_long)NULL;
	DWORD(p+12)=0;
	DWORD(p+16)=(u_long)(28+4*sizeof(SVECTOR));
	DWORD(p+20)=1;
	DWORD(p+24)=0;
	p+=28;
	v=(SVECTOR *)p;
	for (y=0 ; y<2 ; y++ )
		for( x=0 ; x<2 ; x++, v++ )
			v->vx=x*320-160, v->vy=y*240-120, v->vz=PROJECTION_LONG;
	p=(unsigned char *)v;
	DWORD(p)=0x39010608;
	DWORD(p+4)=0x397f0000;
	DWORD(p+8)=0x007f0000;
	DWORD(p+12)=0x0000007f;
	DWORD(p+16)=0x0000007f;
	WORD(p+20)=0;
	WORD(p+22)=1;
	WORD(p+24)=2;
	WORD(p+26)=3;
}

void gran_back_draw( GsOT *ot, int ot_length )
{
	unsigned char *p;
	MATRIX MT;
	static short int tim=0;
	tim++;
	p=COURCETMD_ADDR+28+12+4*sizeof(SVECTOR);
	MT=GsIDMATRIX;
	GsSetLsMatrix( &MT );
	GsSortObject4(&DOBJ_BACK_SPRITE,ot,14-ot_length,NULL);
	DWORD(p+4)=0x397f0000;
	DWORD(p+8)=0x007f0000;
	DWORD(p+12)=0x0000007f;
	DWORD(p+16)=0x0000007f;
}

void grandprix_entry_mode( int stg, int mode )
{
	int active;
	GsOT *ot;
	int timm=0, st=0, ech=0, pd=0xffffff,pdd, i, tmp;
	int bline[3], tline[3];

	GsDRAWENV.dtd=1;
	SeqPlay( "ENTRY1.SEQ", 1 );
	make_back_tmd2();
	crd_set(&CRD_BACK_SPRITE,GsIDMATRIX,&CRD_COURCE);
	obj_set(&DOBJ_BACK_SPRITE,&CRD_BACK_SPRITE,(u_long *)COURCETMD_ADDR,0,0);
	if (stg==0) return;
	tmp=(Gsys.cource_number-=(stg-1));
	stg-=mode;
	for (i=0 ; i<stg ; i++ )
	{
		if (sort_betlap( 2, Gsys.gran_laps[i*2], NULL )<6 ||
			sort_betlap( 3, Gsys.gran_laps[i*2+1], NULL )<6) ech=1;
		Gsys.cource_number++;
	}
	Gsys.cource_number=tmp;
	while( st!=stg )
	{
		pdd=pd;
		pd=padd(pd0);
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		ot=&Wot[active];
		GsClearOt( 0, 0, ot );
		GsClearOt( 0, (1<<OT_LENGTH)-1, &Wot_BACK[active] );
		gran_back_draw( &Wot_BACK[active], OT_LENGTH_BACK );
		if (ech)
		{
			if (timm==0)
				enter_name( ot, OT_LENGTH_CAR, 1 );
			if (timm==1)
				timm-=enter_name( ot, OT_LENGTH_CAR, 0 );
		}
		if (timm>60 && pd==PADstart && (pdd & PADstart)==0) break;
		Gsys.time++;
		if (timm==60)
		{
			for (i=0 ; i<stg ; i++ )
			{
				bline[i]=sort_betlap( 0, Gsys.gran_laps[i*2], Gsys.player_name );
				tline[i]=sort_betlap( 1, Gsys.gran_laps[i*2+1], Gsys.player_name );
				Gsys.cource_number++;
			}
			Gsys.cource_number-=stg;
		}
		if (timm>=60+st*60*16 && timm<60+st*60*16+60*7)
		{
			Gsys.bestline=bline[st];
			Gsys.totalline=tline[st];
			Gsys.replay_timming=1200+(timm-(60+st*60*16));
			best_draw( ot, OT_LENGTH,1 );
			if (pdd!=pd && pd) timm=60+st*60*16+60*7;
		}
		if (timm>=60+8*60+st*60*16 && timm<60+st*60*16+60*15)
		{
			Gsys.replay_timming=1860+(timm-(60+st*60*16+8*60));
			total_draw( ot, OT_LENGTH,1 );
			if (pdd!=pd && pd) timm=60+st*60*16+60*15;
		}
		if (timm==60+st*60*16+60*15)
		{
			st++;
			Gsys.cource_number++;
		}
		GsSortOt( &Wot_BACK[active], ot );
		DrawSync(0);
		VSync(0);
		GsSwapDispBuff();
		GsDrawOt( &Wot[active] );
		timm++;
	}
	GsDRAWENV.dtd=0;
	SeqPlay( NULL, 0 );
}
