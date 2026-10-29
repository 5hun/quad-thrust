#include "GP1.h"

//extern struct s_CARS_DATA cars_data[MAX_CAR_NUM];
extern struct s_CARS_DATA *cars_scra[4];

extern GsDOBJ2 DOBJ_C[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_RD_L[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_RD_R[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_FIRE_R[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_FIRE_L[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_BOOSTER[MAX_CAR_NUM][4];
extern GsDOBJ2 DOBJ_KAGE[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_EFFECT[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_C[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_RD_L[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_RD_R[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_FIRE_R[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_FIRE_L[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_BOOSTER[MAX_CAR_NUM][4];
extern GsCOORDINATE2 CRD_KAGE[MAX_CAR_NUM];

extern GsCOORDINATE2 CRD_COURCE;
extern GsCOORDINATE2 CRD_EFFECT[MAX_CAR_NUM];

extern struct s_SYSTEM_DATA Gsys;
extern GsDOBJ2 DOBJ_BACK;
extern GsCOORDINATE2 CRD_BACK;
extern struct s_MAP_DATA *map_data;

extern struct s_CARS_DATA *car_data;
extern struct s_TRAINING Trn;

void car_hitsound( int tone, int vol, int n )
{
	static int toneb=-1;
	if (Gsys.replaying) return;
	if (n && Gsys.GameMode==5) return;
	if (cars_scra[0]->wallVoice!=-1 && toneb!=-1)
	{
		SsUtSetVVol( cars_scra[0]->wallVoice, 0, 0 );
		SsUtKeyOff( cars_scra[0]->wallVoice, Gsys.vab_se, SND_WALL, 0, toneb );
	}
	cars_scra[0]->wallVoice=SsUtKeyOn( Gsys.vab_se, SND_WALL, 0, tone, 0, 64, 64 );
	SsUtSetVVol( cars_scra[0]->wallVoice, vol, vol );
	toneb=tone;
}

void cars_distance_set()
{
	int x, y, da, db, dc;
	for (y=0 ; y<Gsys.cars_number ; y++)
		for (x=0 ; x<Gsys.cars_number ; x++)
		{
			if (x==y)
			{
				Gsys.cars_distance[x][y]=0;
				continue;
			}
			if (x<y)
			{
				Gsys.cars_distance[x][y]=Gsys.cars_distance[y][x];
			}
			else
			{
				da=_abs(cars_scra[x]->pos.vx-cars_scra[y]->pos.vx);
				db=_abs(cars_scra[x]->pos.vy-cars_scra[y]->pos.vy);
				dc=_abs(cars_scra[x]->pos.vz-cars_scra[y]->pos.vz);
				if (da>=512 || db>=512 || dc>=512)
				{
					Gsys.cars_distance[x][y]=512;
					continue;
				}
				Gsys.cars_distance[x][y]=sqr_i( 512, da*da+db*db+dc*dc );
			}
		}
}

void car_radder( int n, int i, int m )
{
	SVECTOR VX={0,0,0};
	if (cars_scra[n]->radder_rot==0 && m==0) return;
	if ((cars_scra[n]->boost_wr & (1<<6))==0) return;

	if (cars_scra[n]->radder_rot>(4096/360*20))
		cars_scra[n]->radder_rot=(4096/360*20);
	if (cars_scra[n]->radder_rot<(-4096/360*20))
		cars_scra[n]->radder_rot=(-4096/360*20);

	if (m==1)
	{
		VX.vy=(cars_scra[n]->radder_rot+=(4096/360*2)*i);
	}
	else
	{
		if (cars_scra[n]->radder_rot>0)
			VX.vy=(cars_scra[n]->radder_rot-=(4096/360*2));
		else
			VX.vy=(cars_scra[n]->radder_rot+=(4096/360*2));
	}
	if (n<4)
	{
		RotMatrix( &VX, &CRD_RD_R[n].coord );
		RotMatrix( &VX, &CRD_RD_L[n].coord );
	}
	if (Trn.forb_r) Trn.forb_r=2;
}

void car_boost( int n, int r )
{
	SVECTOR VX={0,0,0};
	if (cars_scra[n]->lev || (((Gsys.time+n) & 1)==0 && Gsys.GameMode!=3)) return;
	cars_scra[n]->boost_wr|=1<<(r+1);
	VX.vz=(cars_scra[n]->boost_timming2);
	if ((r & 1)==0) VX.vy=-4096*90/360;
	else VX.vy=+4096*90/360;
	RotMatrix( &VX, &CRD_BOOSTER[n][r].coord );
}

void car_bank( int n )
{
	int k;
	SVECTOR *VP;
	VECTOR A={0,0,0};
	car_data=cars_scra[n];
	if (car_data->grip==0) return;
	k=car_data->now_on;
	VP=car_data->VN+car_data->now_chip_x+car_data->now_chip_y*map_data[k].xdiv;
	A.vx=VP->vx>>(INERTIA_KETA2);
	if (VP->vy!=0)
		A.vy=-(((VP->vx*VP->vx+VP->vz*VP->vz))/VP->vy)>>(INERTIA_KETA2);
	A.vz=VP->vz>>(INERTIA_KETA2);
	A.vx=A.vx*cars_scra[n]->weight>>(8+4);
	A.vy=A.vy*cars_scra[n]->weight>>(8+4);
	A.vz=A.vz*cars_scra[n]->weight>>(8+4);
	_addVECTOR( &car_data->inertia_forward,car_data->inertia_forward,A );
	_addVECTOR( &car_data->inertia_back,car_data->inertia_back,A );
}

void car_rotation( int n )
{
	SVECTOR *V, VK;
	V=cars_scra[n]->VN+cars_scra[n]->now_chip_x+cars_scra[n]->now_chip_y*map_data[cars_scra[n]->now_on].xdiv;
	cars_scra[n]->status.vx=((cars_scra[n]->status.vx+4096) & 8191)-4096;
	cars_scra[n]->status.vy=((cars_scra[n]->status.vy+4096) & 8191)-4096;
	cars_scra[n]->status.vz=((cars_scra[n]->status.vz+4096) & 8191)-4096;
	cars_scra[n]->statusk.vx&=4095;
	cars_scra[n]->statusk.vy&=4095;
	cars_scra[n]->statusk.vz&=4095;

	if (cars_scra[n]->speed>=5 && (cars_scra[n]->boost_wr & (1<<6)))
		cars_scra[n]->status.vy-=cars_scra[n]->radder_rot/cars_scra[n]->per_rot;
	if (cars_scra[n]->lev==0 && cars_scra[n]->grip==0)
	{
		if (cars_scra[n]->status.vz>4096/360/2)
			cars_scra[n]->status.vz-=4096/360/2;
		if (cars_scra[n]->status.vz<4096/360/2)
			cars_scra[n]->status.vz+=4096/360/2;
		cars_scra[n]->statusb=cars_scra[n]->status;
		return;
	}

//ŒX‚«§Œä 

//	TransposeMatrix( &CRD_C[n].coord, &MT );
//	ApplyMatrixSV( &MT, V, &VK );
	VK.vx=-(V->vx*CRD_C[n].coord.m[0][0]+V->vy*CRD_C[n].coord.m[1][0]+V->vz*CRD_C[n].coord.m[2][0])>>12;
	VK.vz=-(V->vx*CRD_C[n].coord.m[0][2]+V->vy*CRD_C[n].coord.m[1][2]+V->vz*CRD_C[n].coord.m[2][2])>>12;

	if (_abs(VK.vx)<600)
		cars_scra[n]->status.vz+=
			(cars_scra[n]->speed*(((cars_scra[n]->statusb.vy-cars_scra[n]->status.vy+2048) & 4095)-2048))>>8;
	if (VK.vz>40)
		cars_scra[n]->status.vx+=4096/360;
	if (VK.vz<-40)
		cars_scra[n]->status.vx-=4096/360;
	if (VK.vx<-40)
		cars_scra[n]->status.vz+=4096/360;
	if (VK.vx>40)
		cars_scra[n]->status.vz-=4096/360;
	VK.vx=-(V->vx*CRD_KAGE[n].coord.m[0][0]+V->vy*CRD_KAGE[n].coord.m[1][0]+V->vz*CRD_KAGE[n].coord.m[2][0])>>12;
	VK.vz=-(V->vx*CRD_KAGE[n].coord.m[0][2]+V->vy*CRD_KAGE[n].coord.m[1][2]+V->vz*CRD_KAGE[n].coord.m[2][2])>>12;
	if (VK.vz>40)
		cars_scra[n]->statusk.vx+=4096*2/360;
	if (VK.vz<-40)
		cars_scra[n]->statusk.vx-=4096*2/360;
	if (VK.vx<-40)
		cars_scra[n]->statusk.vz+=4096*2/360;
	if (VK.vx>40)
		cars_scra[n]->statusk.vz-=4096*2/360;
	cars_scra[n]->statusb=cars_scra[n]->status;
}
