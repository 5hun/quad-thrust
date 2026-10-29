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
extern struct s_CAR_PROPATIE CARS_PROPATIE[4];
extern struct s_CARS_DATA *car_data;

extern GsDOBJ2 DOBJ_head, DOBJ_body;
extern GsDOBJ2 DOBJ_Rarm0, DOBJ_Rarm1, DOBJ_Rhand;
extern GsDOBJ2 DOBJ_Larm0, DOBJ_Larm1, DOBJ_Lhand;
extern GsDOBJ2 DOBJ_Rleg0, DOBJ_Rleg1, DOBJ_Rshoes;
extern GsDOBJ2 DOBJ_Lleg0, DOBJ_Lleg1, DOBJ_Lshoes;
extern GsDOBJ2 DOBJ_kage;
extern GsCOORDINATE2 CRD_head, CRD_body;
extern GsCOORDINATE2 CRD_Rarm0, CRD_Rarm1, CRD_Rhand;
extern GsCOORDINATE2 CRD_Larm0, CRD_Larm1, CRD_Lhand;
extern GsCOORDINATE2 CRD_Rleg0, CRD_Rleg1, CRD_Rshoes;
extern GsCOORDINATE2 CRD_Lleg0, CRD_Lleg1, CRD_Lshoes;
extern GsCOORDINATE2 CRD_kage;

int body_r, r_a0, r_a1, l_a0, l_a1, r_f0, r_f1, l_f0, l_f1;
SVECTOR VBody={0,0,0};

#define DASH_KOMA 11
#define WALK_KOMA 19
#define BACK_KOMA 16
#define KUP_KOMA 15

int ku_foot0[KUP_KOMA*4]={	1,2,8,9,8,3,2,-5,-18,-38,-40,-40,-29,-26,-9	};
int ku_foot1[KUP_KOMA*4]={	0,1,4,5,6,19,25,46,34,45,39,26,21,20,15	};
int ku_arm0[KUP_KOMA*4]={	-6,-22,-27,-26,-24,-8,-5,9,27,29,34,38,33,25,9	};
int ku_arm1[KUP_KOMA*4]={	-23,-27,-36,-46,-47,-36,-14,1,9,16,25,30,20,11,7};

int cf_foot0[WALK_KOMA*4]={	4,6,10,13,16,10,-1,-11,-21,-26,-30,-27,-24,-23,-22,-20,-14,-9,-4	};
int cf_foot1[WALK_KOMA*4]={	8,11,17,24,33,48,53,50,42,26,9,-12,-17,-11,-5,1,8,8,10 };
int cf_arm0[WALK_KOMA*4]={	-32,-33,-32,-31,-20,-14,-6,4,12,18,27,28,27,27,25,15,0,0,-19 };
int cf_arm1[WALK_KOMA*4]={	-41,-50,-50,-48,-38,-27,-14,1,8,14,22,22,22,19,16,7,0,-14,-28 };

int cb_foot0[BACK_KOMA*4]={	0,-1,-5,-12,-15,-17,-22,-27,-22,-13,-1,-2,0,5,4,2,0	};
int cb_foot1[BACK_KOMA*4]={	0,0,0,-1,-4,-5,-7,3,30,38,37,32,21,5,4,2,0 };
int cb_arm0[BACK_KOMA*4]={	-15,-20,-17,-12,-5,1,12,11,7,-2,-13,-23,-31,-23,-16,-15,-7 };
int cb_arm1[BACK_KOMA*4]={	-35,-27,-19,-14,-7,-7,0,-1,-1,-8,-19,-30,-32,-41,-35,-37,-14 };

int cd_foot0[DASH_KOMA*4]={	0,0,19,20,11,-9,-30,-42,-36,-22,-14	};
int cd_foot1[DASH_KOMA*4]={	27,37,34,51,79,83,87,45,14,-1,10	};
int cd_arm0[DASH_KOMA*4]={	25,30,58,74,68,39,24,-7,-9,-11,-21	};
int cd_arm1[DASH_KOMA*4]={	-57,-46,-8,-4,-8,-25,-54,-89,-100,-86,-59	};

struct MOTION {
	int *arm0;
	int *arm1;
	int *foot0;
	int *foot1;
	int body;
	int fr_tim;
	int fl_tim;
	int ar_tim;
	int al_tim;
	int MAX_KOMA;
};

struct MOTION DASH, WALK, BACK, KUP;

void motion( struct MOTION *mot, SVECTOR Vadd );
void d_stand( int mode );

void Motion_set(struct MOTION *mot, int *a0, int *a1, int *f0, int *f1, int m, int b, int r )
{
	mot->arm0=a0;
	mot->arm1=a1;
	mot->foot0=f0;
	mot->foot1=f1;
	mot->ar_tim=0;
	mot->al_tim=m*2;
	if (r==0)
	{
		mot->fr_tim=0;
		mot->fl_tim=m*2;
	}
	else
	{
		mot->fr_tim=m*2;
		mot->fl_tim=0;
	}
	mot->MAX_KOMA=m;
	mot->body=b*4096/360;
}

void floor_shoes(int n)
{
	int y0, y1;
	y0=CRD_Rshoes.workm.t[1];
	y1=CRD_Lshoes.workm.t[1];
	if (y1>y0) y0=y1;
	memcpy( CRD_body.coord.m, CRD_C[n].coord.m, 9*2 );
	CRD_body.coord.t[0]=CRD_C[n].coord.t[0];
	CRD_body.coord.t[1]-=(y0-80)-CRD_C[n].coord.t[1];//WORLD2.coord.t[1];
	CRD_body.coord.t[2]=CRD_C[n].coord.t[2];
	CRD_body.flg=0;
}

void man_draw( GsOT *ot, int n )
{
/* ‚±‚±‚©‚çMACRO */
#define writeObj( obj, ot )	\
	GsGetLs( obj.coord2, &MATi );\
	GsSetLightMatrix( &CRD_body.coord );\
	GsSetLsMatrix( &MATi );\
	GsSortObject4(&obj,ot,14-OT_LENGTH_CAR,NULL);
/* ‚±‚±‚Ü‚ÅMACRO */
	MATRIX MATi;
	SVECTOR VZ={0,0,0};
	static int sw=0;

	motion( &DASH, VZ );
	if (cars_scra[n]->speed<20)
	{
		if (sw==1)
		{
			d_stand( 1 );
		}
		else
		{
			sw=1;
			d_stand( 0 );
		}
	}
	else
	{
		sw=0;
	}
	floor_shoes( n );
	writeObj( DOBJ_head, ot );
	writeObj( DOBJ_body, ot );
	writeObj( DOBJ_Rhand, ot );
	writeObj( DOBJ_Lhand, ot );
	writeObj( DOBJ_Rleg0, ot );
	writeObj( DOBJ_Lleg0, ot );
	writeObj( DOBJ_Rarm0, ot );
	writeObj( DOBJ_Larm0, ot );
	writeObj( DOBJ_Rarm1, ot );
	writeObj( DOBJ_Larm1, ot );
	writeObj( DOBJ_Rleg1, ot );
	writeObj( DOBJ_Lleg1, ot );
	writeObj( DOBJ_Rshoes, ot );
	writeObj( DOBJ_Lshoes, ot );
}

void cap_work( int *a, int size, int *c )
{
int i, d, e;
int b[1024];
	if (c==NULL)
	{
		for( i=0 ; i<size*4 ; i++ )
		{
			d=a[i/4]*4096;
			e=a[(i/4+1) % size]*4096;
			b[i]=-(d*(4-(i % 4))+e*((i % 4)+1))/4/360;
		}
	}
	else
	{
		for( i=0 ; i<size*4 ; i++ )
		{
			d=(a[i/4]-c[i/4]);
			e=(a[(i/4+1) % size]-c[(i/4+1) % size]);
			d*=4096;
			e*=4096;
			b[i]=-(d*(4-(i % 4))+e*((i % 4)+1))/4/360;
		}
	}
	memcpy( a, b, size*4*4 );
}

void cap_tenkai()
{
	cap_work( cf_foot1, WALK_KOMA, cf_foot0 );
	cap_work( cf_foot0, WALK_KOMA, NULL );
	cap_work( cf_arm1, WALK_KOMA, cf_arm0 );
	cap_work( cf_arm0, WALK_KOMA, NULL );
	Motion_set( &WALK, cf_arm0, cf_arm1, cf_foot0, cf_foot1, WALK_KOMA, 0,0 );
	cap_work( cd_foot1, DASH_KOMA, cd_foot0 );
	cap_work( cd_foot0, DASH_KOMA, NULL );
	cap_work( cd_arm1, DASH_KOMA, cd_arm0 );
	cap_work( cd_arm0, DASH_KOMA, NULL );
	Motion_set( &DASH, cd_arm0, cd_arm1, cd_foot0, cd_foot1, DASH_KOMA, -13,1);
	cap_work( cb_foot1, BACK_KOMA, cb_foot0 );
	cap_work( cb_foot0, BACK_KOMA, NULL );
	cap_work( cb_arm1, BACK_KOMA, cb_arm0 );
	cap_work( cb_arm0, BACK_KOMA, NULL );
	Motion_set( &BACK, cb_arm0, cb_arm1, cb_foot0, cb_foot1, BACK_KOMA, 10,0 );
	cap_work( ku_foot1, KUP_KOMA, ku_foot0 );
	cap_work( ku_foot0, KUP_KOMA, NULL );
	cap_work( ku_arm1, KUP_KOMA, ku_arm0 );
	cap_work( ku_arm0, KUP_KOMA, NULL );
	Motion_set( &KUP, ku_arm0, ku_arm1, ku_foot0, ku_foot1, KUP_KOMA, 0,0 );
}

void man_set()
{
#define make_object( obj, coord, VEC, n, CRD, attr ) \
	MT=GsIDMATRIX;\
	MT.t[0]=VEC.vx;\
	MT.t[1]=VEC.vy;\
	MT.t[2]=VEC.vz;\
	crd_set( &coord, MT, CRD );\
	obj_set( &obj, &coord, (u_long *)YMAN_TMD_ADDR, n, attr );

	MATRIX MT;

	VECTOR V0={ 0, 0, 0 };
	VECTOR H0={ 0,0,0 };
	VECTOR R_L0={326*0.15,1748*0.14,37*0.15};
	VECTOR L_L0={-326*0.15,1748*0.14,37*0.15};
	VECTOR R_A0={845*0.15,436*0.14, 0 };
	VECTOR L_A0={-845*0.15,436*0.14, 0 };
	VECTOR HA={0,768*0.17,0};

	VECTOR L1={ 0,755*0.3,0 };
	VECTOR SH={0,726*0.25,0};
	VECTOR A1={0,600*0.175,0};

	cap_tenkai();
	make_object( DOBJ_Rarm0, CRD_Rarm0, R_A0, 0, &CRD_body, 0  );
	make_object( DOBJ_Rarm1, CRD_Rarm1, A1, 1, &CRD_Rarm0, 0 );
	make_object( DOBJ_Larm0, CRD_Larm0, L_A0, 0, &CRD_body,0  );
	make_object( DOBJ_Larm1, CRD_Larm1, A1, 1, &CRD_Larm0,0 );
	make_object( DOBJ_Rhand, CRD_Rhand, HA, 5, &CRD_Rarm1,0 );
	make_object( DOBJ_Lhand, CRD_Lhand, HA, 5, &CRD_Larm1,0 );
	make_object( DOBJ_body, CRD_body, V0, 2, &CRD_COURCE,0 );
	make_object( DOBJ_head, CRD_head, H0, 6, &CRD_body,0 );
	make_object( DOBJ_Rleg0, CRD_Rleg0, R_L0, 3, &CRD_body,0  );
	make_object( DOBJ_Rleg1, CRD_Rleg1, L1, 4, &CRD_Rleg0,0  );
	make_object( DOBJ_Lleg0, CRD_Lleg0, L_L0, 3, &CRD_body,0  );
	make_object( DOBJ_Lleg1, CRD_Lleg1, L1, 4, &CRD_Lleg0,0  );
	make_object( DOBJ_Rshoes, CRD_Rshoes, SH, 8, &CRD_Rleg1,0  );
	make_object( DOBJ_Lshoes, CRD_Lshoes, SH, 8, &CRD_Lleg1,0  );
}

void motion( struct MOTION *mot, SVECTOR Vadd )
{
//	MATRIX MATi;
	SVECTOR VNULL;
	SVECTOR VN2={0,0,0};
	int rx=0;
	int *c_arm0;
	int *c_arm1;
	int *c_foot0;
	int *c_foot1;
	int koma;
	c_arm0=mot->arm0;
	c_arm1=mot->arm1;
	c_foot0=mot->foot0;
	c_foot1=mot->foot1;
	koma=mot->MAX_KOMA*4;

	ApplyMatrixSV( &CRD_body.coord, &Vadd, &VNULL );
	CRD_body.coord.t[0]+=VNULL.vx;
	CRD_body.coord.t[1]+=VNULL.vy;
	CRD_body.coord.t[2]+=VNULL.vz;
	CRD_body.flg=0;
//body
	VBody.vx=mot->body;
	body_r=VBody.vx;
	rx=body_r/2;
//right arm 0
	VN2.vx=c_arm0[mot->ar_tim % koma]-rx;
	VN2.vz=-5;
	r_a0=VN2.vx;
	RotMatrix( &VN2, &CRD_Rarm0.coord );
	CRD_Rarm0.flg=0;
//right arm 1
	VN2.vx=c_arm1[mot->ar_tim % koma]-rx;
	VN2.vz=5;
	r_a1=VN2.vx;
	RotMatrix( &VN2, &CRD_Rarm1.coord );
	CRD_Rarm0.flg=0;
	mot->ar_tim+=(cars_scra[0]->speed>>7)+1;
//	mot->ar_tim++;
//left arm 0
 	VN2.vx=c_arm0[mot->al_tim % koma]-rx;
	VN2.vz=5;
	l_a0=VN2.vx;
 	RotMatrix( &VN2, &CRD_Larm0.coord );
	CRD_Larm0.flg=0;
//left arm 1
	VN2.vx=c_arm1[mot->al_tim % koma]-rx;
	VN2.vz=-5;
	l_a1=VN2.vx;
	RotMatrix( &VN2, &CRD_Larm1.coord );
	CRD_Larm1.flg=0;
	mot->al_tim+=(cars_scra[0]->speed>>7)+1;
//	mot->al_tim++;
//right leg 0
	VN2.vx = c_foot0[mot->fr_tim % koma]-rx;
	r_f0=VN2.vx;
	VN2.vz=0;
	RotMatrix( &VN2, &CRD_Rleg0.coord );
	CRD_Rleg0.flg=0;
//right leg 1
	VN2.vx = c_foot1[mot->fr_tim % koma]-rx;
	r_f1=VN2.vx;
	RotMatrix( &VN2, &CRD_Rleg1.coord );
	CRD_Rleg1.flg=0;
	mot->fr_tim+=(cars_scra[0]->speed>>7)+1;
//	mot->fr_tim++;
//left leg 0
	VN2.vx = c_foot0[mot->fl_tim % koma]-rx;
	l_f0=VN2.vx;
	RotMatrix( &VN2, &CRD_Lleg0.coord );
	CRD_Lleg0.flg=0;
//left leg 1
	VN2.vx = c_foot1[mot->fl_tim % koma]-rx;
	l_f1=VN2.vx;
	RotMatrix( &VN2, &CRD_Lleg1.coord );
	CRD_Lleg1.flg=0;
	mot->fl_tim+=(cars_scra[0]->speed>>7)+1;
//	if ((mot->fl_tim % (mot->MAX_KOMA*2))==mot->MAX_KOMA)
//	{
//		voice=SsUtKeyOn(VabID, 6+Ysys.shoes*2, 0, 13+Ysys.shoes*18,0,127,127);
//		SsUtSetVVol( voice,127,127 );
//	}
}

void d_stand( int mode )
{
static int tim=8;
SVECTOR VN2={ 0,0,0 };
	if (mode==0) tim=16;
//body
	body_r-=body_r/tim;
	VBody.vx=body_r;
//right arm 0
	r_a0-=r_a0/tim;
	VN2.vx=r_a0;
	VN2.vz=-5;
	RotMatrix( &VN2, &CRD_Rarm0.coord );
	CRD_Rarm0.flg=0;
//right arm 1
	r_a1-=r_a1/tim;
	VN2.vx=r_a1;
	VN2.vz=5;
	RotMatrix( &VN2, &CRD_Rarm1.coord );
	CRD_Rarm1.flg=0;
//left arm 0
	l_a0-=l_a0/tim;
	VN2.vx=l_a0;
	VN2.vz=5;
 	RotMatrix( &VN2, &CRD_Larm0.coord );
	CRD_Larm0.flg=0;
//left arm 1
	l_a1-=l_a1/tim;
	VN2.vz=-5;
	VN2.vx=l_a1;
 	RotMatrix( &VN2, &CRD_Larm1.coord );
	CRD_Larm1.flg=0;
//right leg 0
	VN2.vz=0;
	r_f0-=r_f0/tim;
	VN2.vx = r_f0;
	RotMatrix( &VN2, &CRD_Rleg0.coord );
	CRD_Rleg0.flg=0;
//right leg 1
	r_f1-=r_f1/tim;
	VN2.vx = r_f1;
	RotMatrix( &VN2, &CRD_Rleg1.coord );
	CRD_Rleg1.flg=0;
//left leg 0
	l_f0-=l_f0/tim;
	VN2.vx = l_f0;
	RotMatrix( &VN2, &CRD_Lleg0.coord );
	CRD_Lleg0.flg=0;
//left leg 1
	l_f1-=l_f1/tim;
	VN2.vx = l_f1;
	RotMatrix( &VN2, &CRD_Lleg1.coord );
	CRD_Lleg1.flg=0;
	if (tim>1) tim--;
}
