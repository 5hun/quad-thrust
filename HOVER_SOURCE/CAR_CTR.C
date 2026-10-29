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
extern struct s_CAR_PROPATIE CARS_PROPATIE[6];
extern struct s_CARS_DATA *car_data;
extern struct s_TRAINING Trn;

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

void car_position( int n, VECTOR *Vp, int ret )
{
	int i,xs,ys,da,db,dc,dd;
	SVECTOR A, B, C, D;
	SVECTOR *V, Vl;
	VECTOR VZ={0,0,0};

	car_data=cars_scra[n];

	CRD_KAGE[n].coord.t[1]=car_data->pos.vy;
	car_data->pos=*Vp;
	car_data->pos.vy-=CARS_PROPATIE[car_data->car_type].hight;
	car_data->posr.vx=car_data->pos.vx<<POS_KETA;
	car_data->posr.vy=car_data->pos.vy<<POS_KETA;
	car_data->posr.vz=car_data->pos.vz<<POS_KETA;
	car_data->inertia_forward=VZ;
	car_data->inertia_back=VZ;
	car_data->before_line_position=0;
	car_data->line_position=0;
	CRD_KAGE[n].coord.t[0]=car_data->pos.vx=CRD_C[n].coord.t[0]=car_data->posr.vx>>POS_KETA;
	car_data->pos.vy=CRD_C[n].coord.t[1]=car_data->posr.vy>>POS_KETA;
	CRD_KAGE[n].coord.t[2]=car_data->pos.vz=CRD_C[n].coord.t[2]=car_data->posr.vz>>POS_KETA;
	CRD_C[n].flg=0;
	CRD_KAGE[n].flg=0;

	if (ret==1) return;

	for(i=0;i<Gsys.cource_tmd_num;i++)
	{
		V=(SVECTOR *)(*((u_long *)(Gsys.cource_tmd_addr+12+28*map_data[i].tmd_num)));
		xs=map_data[i].xdiv;
		ys=map_data[i].ydiv;
		Vl.vx=(Vp->vx-map_data[i].center.vx)>>1;
		Vl.vy=(Vp->vy-map_data[i].center.vy)>>1;
		Vl.vz=(Vp->vz-map_data[i].center.vz)>>1;
		A=V[(xs+1)*2];
		B=V[xs+(xs+1)*2];
		C=V[xs+(ys-2)*(xs+1)];
		D=V[(ys-2)*(xs+1)];
		da=_LINE_CHECK( A, B, Vl );
		db=_LINE_CHECK( B, C, Vl );
		dc=_LINE_CHECK( C, D, Vl );
		dd=_LINE_CHECK( D, A, Vl );
//最適化可能 
		if (da<=0 && db<=0 && dc<=0 && dd<=0)
		{
			car_data->now_on=i;
			break;
		}
//		printf("[%d].line=%d,(x,y)=(%d,%d)\n",n,car_data->line_position,car_data->now_chip_x,car_data->now_chip_y);
		car_data->line_position+=xs;
	}
	car_data->now_chip_x=0;
	car_data->now_chip_y=0;
	car_getplate( n );
//	printf("[%d].line=%d,(x,y)=(%d,%d)\n",n,car_data->line_position,car_data->now_chip_x,car_data->now_chip_y);
}

void car_init( int n, int attribute, int car_type, int lev, GsCOORDINATE2 *upper, int r )
{
	int attr=0;
	VECTOR VZ={ 0,0,0 };
	SVECTOR SVZ={0,0,0};
	MATRIX MT;
	int speedd[]={350,330,310,260};

	SVZ.vy=4096*r/360;

	attr=((1-(attribute & 1))<<30);
	car_data=cars_scra[n];
	car_data->status=SVZ;
	car_data->lev=lev;
	car_data->max_speed=speedd[n]*2-(10-car_data->lev)*20;
//	printf("leV=%d\n",lev);
	car_data->inertia_forward=VZ;
	car_data->inertia_back=VZ;
	car_data->attribute=attribute;
	car_data->car_type=car_type;
	car_data->damage=0;
	car_data->damage_max=CARS_PROPATIE[car_type].tanc;
	car_data->pos=VZ;
	car_data->posr=VZ;
	car_data->line_position=0;
	car_data->last_goal=0;
	car_data->draw=0;
	car_data->boost_wr=0;
	if (car_type!=2 && car_type!=4)
		car_data->boost_wr|=(1<<6);
	car_data->resi1=CARS_PROPATIE[car_type].resi1;
	car_data->brek=CARS_PROPATIE[car_type].brek;
	car_data->per_rot=CARS_PROPATIE[car_type].per_rot;
	car_data->per_rot2=CARS_PROPATIE[car_type].per_rot2;
	car_data->side_boost=CARS_PROPATIE[car_type].side_boost;
	car_data->weight=CARS_PROPATIE[car_type].weight;
	car_data->rank=3-n;
//車体
	RotMatrix( &SVZ, &MT );
	MT.t[1]=CARS_PROPATIE[car_type].hight;
	crd_set( &CRD_C[n], MT, upper );
	obj_set( &DOBJ_C[n], &CRD_C[n], CARS_PROPATIE[car_type].tmd_addr, 0, attr );
	MT=GsIDMATRIX;
	if (car_data->boost_wr & (1<<6))
	{
//ラダー右
		_setMATRIXsVECTOR( &MT, CARS_PROPATIE[car_type].RADDER_R );
		crd_set( &CRD_RD_R[n], MT, &CRD_C[n] );
		obj_set( &DOBJ_RD_R[n], &CRD_RD_R[n],
								CARS_PROPATIE[car_type].tmd_addr, 1, attr );
//ラダー左
		_setMATRIXsVECTOR( &MT, CARS_PROPATIE[car_type].RADDER_L );
		crd_set( &CRD_RD_L[n], MT, &CRD_C[n] );
		obj_set( &DOBJ_RD_L[n], &CRD_RD_L[n],
								CARS_PROPATIE[car_type].tmd_addr, 1, attr );
	}
	crd_set( &CRD_EFFECT[n], GsIDMATRIX, &CRD_C[n] );
	obj_set( &DOBJ_EFFECT[n], &CRD_EFFECT[n], (u_long *)OTHER_TMD_ADDR, 0, 0 );
//バックブースターR
	_setMATRIXsVECTOR( &MT, CARS_PROPATIE[car_type].BOOSTER_BR );
	crd_set( &CRD_FIRE_R[n], MT, &CRD_C[n] );
	obj_set( &DOBJ_FIRE_R[n], &CRD_FIRE_R[n],
								CARS_PROPATIE[car_type].tmd_addr, 2, attr );
//バックブースターL
	_setMATRIXsVECTOR( &MT, CARS_PROPATIE[car_type].BOOSTER_BL );
	crd_set( &CRD_FIRE_L[n], MT, &CRD_C[n] );
	obj_set( &DOBJ_FIRE_L[n], &CRD_FIRE_L[n],
								CARS_PROPATIE[car_type].tmd_addr, 2, attr );
//ブースターR1
	_setMATRIXsVECTOR( &MT, CARS_PROPATIE[car_type].BOOSTER_R1 );
	crd_set( &CRD_BOOSTER[n][BOOST_R1], MT, &CRD_C[n] );
	obj_set( &DOBJ_BOOSTER[n][BOOST_R1], &CRD_BOOSTER[n][BOOST_R1],
								CARS_PROPATIE[car_type].tmd_addr, 3, attr );
//ブースターL1
	_setMATRIXsVECTOR( &MT, CARS_PROPATIE[car_type].BOOSTER_L1 );
	crd_set( &CRD_BOOSTER[n][BOOST_L1], MT, &CRD_C[n] );
	obj_set( &DOBJ_BOOSTER[n][BOOST_L1], &CRD_BOOSTER[n][BOOST_L1],
								CARS_PROPATIE[car_type].tmd_addr, 3, attr );
//ブースターR2
	_setMATRIXsVECTOR( &MT, CARS_PROPATIE[car_type].BOOSTER_R2 );
	crd_set( &CRD_BOOSTER[n][BOOST_R2], MT, &CRD_C[n] );
	obj_set( &DOBJ_BOOSTER[n][BOOST_R2], &CRD_BOOSTER[n][BOOST_R2],
								CARS_PROPATIE[car_type].tmd_addr, 3, attr );
//ブースターL1
	_setMATRIXsVECTOR( &MT, CARS_PROPATIE[car_type].BOOSTER_L2 );
	crd_set( &CRD_BOOSTER[n][BOOST_L2], MT, &CRD_C[n] );
	obj_set( &DOBJ_BOOSTER[n][BOOST_L2], &CRD_BOOSTER[n][BOOST_L2],
								CARS_PROPATIE[car_type].tmd_addr, 3, attr );
//影
	_setMATRIXsVECTOR( &MT, VZ );
	MT.t[1]=CARS_PROPATIE[car_type].hight;
	crd_set( &CRD_KAGE[n], MT, &CRD_COURCE );
	obj_set( &DOBJ_KAGE[n], &CRD_KAGE[n],
							CARS_PROPATIE[car_type].tmd_addr, 4, attr|(1<<30) );
}

void car_gravide( int n )
{
	int xs, vy, vy2;
	SVECTOR *V, D;
	VECTOR A, B, C, CV={0,0,0}, CV2={0,0,0};
	VECTOR Vl;
	struct s_MAP_DATA *mp;
	car_data=cars_scra[n];
	CV.vy=(car_data->weight*3)>>4;
	CV.vy-=(((car_data->status.vx+2048) & 4095)-2048)>>8;
	mp=&map_data[car_data->now_on];
	V=car_data->VP;
	xs=mp->xdiv;

	Vl.vx=(car_data->pos.vx-mp->center.vx)>>1;
	Vl.vy=(car_data->pos.vy-mp->center.vy)>>1;
	Vl.vz=(car_data->pos.vz-mp->center.vz)>>1;

	D=V[car_data->now_chip];
	_subVECTOR( &A, V[car_data->now_chip+1], D );
	_subVECTOR( &B, V[car_data->now_chip+1+xs], D );

	C.vx=A.vy*B.vz-A.vz*B.vy;
	C.vy=A.vz*B.vx-A.vx*B.vz;
	C.vz=A.vx*B.vy-A.vy*B.vx;

//	printf("vy,pos_vy=%d,%d,%d\n",mp->center.vy,V[car_data->now_chip].vy*2,car_data->pos.vy);
	if (car_data->cource_out)
	{
		vy=V[car_data->now_chip].vy*2+5000;
	}
	else
	{
		if (C.vy==0) vy=0;
		else vy=(((-C.vx*(Vl.vx-D.vx)-C.vz*(Vl.vz-D.vz))/C.vy+D.vy)<<1);
	}

	DOBJ_KAGE[n].attribute &=~(1<<31);
	if (car_data->cource_out || car_data->over<0)
		DOBJ_KAGE[n].attribute |=(1<<31);
	CRD_KAGE[n].coord.t[1]=vy+mp->center.vy;

	vy2=vy;
	vy2+=-CARS_PROPATIE[car_data->car_type].hight/2+mp->center.vy;
	vy+=-CARS_PROPATIE[car_data->car_type].hight+mp->center.vy;

	if (car_data->lev==0 && car_data->over==0 && 
		((car_data->cource_out && car_data->pos.vy>=vy+2048) ||
									(car_data->cource_out==0 && car_data->pos.vy>=vy2+512)))
		car_data->over=-64*4;
	if (car_data->cource_out==0 && car_data->over>=0 && car_data->lev==0 && (car_data->pos.vy >= vy2 && car_data->tei==0))
	{
		CV2.vy=-200*car_data->weight>>7;
		car_data->inertia_forward.vy=CV2.vy;
		car_data->inertia_back.vy=CV2.vy;
		car_data->tei=16;
		car_data->posr.vy=(car_data->pos.vy = vy2-10)<<POS_KETA;
		car_hitsound( 80, 127, n );
		DOBJ_C[n].attribute|=1<<6;
		car_data->damage+=100;
	}
	else
	{
		if (car_data->cource_out==0 && car_data->pos.vy >= vy && (car_data->over>=0 || car_data->lev))
		{
			if (car_data->lev==0)
			{
				CV2.vy=(-25-(((car_data->pos.vy-vy)*(car_data->pos.vy-vy)>>2)))*car_data->weight>>7;
				if (CV2.vy<-8*CV.vy) CV2.vy=-8*CV.vy;
				_addVECTOR2(&car_data->inertia_forward,CV2);
				_addVECTOR2(&car_data->inertia_back,CV2);
			}
			if (car_data->lev || car_data->tei ||
				((car_data->pos.vy-vy)<70 &&
					_abs(car_data->inertia_forward.vy
									+car_data->inertia_back.vy)<500))
			{
				car_data->pos.vy = vy;
				car_data->posr.vy = vy<<POS_KETA;
				car_data->tei=60;
			}
		}
		else
		{
			_addVECTOR2(&car_data->inertia_forward,CV);
			_addVECTOR2(&car_data->inertia_back,CV);
			if (car_data->tei)
				car_data->tei--;
		}
	}
	car_data->grip=0;
	if (car_data->pos.vy >= vy-150)
		car_data->grip=1;
}

void car_draw( GsOT *ot, int ot_length )
{
	int i=0;
	VECTOR VZ;
	MATRIX MT;
	GsF_LIGHT light2={0,128,32,120,120,120};

	for ( i=0 ; i<MAX_CAR_NUM ; i++ )
	{
		car_data=cars_scra[i];
		if (car_data->car_type==5)
		{
			if (((car_data->attribute) & 1) && car_data->draw)
			{
				if (car_data->over>0 && car_data->over<120) continue;
				man_draw( &ot[i], i );
				CRD_C[i].flg=0;
				CRD_KAGE[i].flg=0;
				CRD_RD_L[i].flg=0;
				CRD_RD_R[i].flg=0;
				_DrawObject( &ot[i], ot_length, DOBJ_KAGE[i] );
			}
			continue;
		}
		if (car_data->over>0 && car_data->over<120) continue;
		if (((car_data->attribute) & 1) && car_data->draw)
		{
			CRD_C[i].flg=0;
			CRD_KAGE[i].flg=0;
			CRD_RD_L[i].flg=0;
			CRD_RD_R[i].flg=0;
			_DrawObject( &ot[i], ot_length, DOBJ_C[i] );
			_DrawObject( &ot[i], ot_length, DOBJ_KAGE[i] );
			if (car_data->boost_wr & (1<<6))
			{
				_DrawObject( &ot[i], ot_length, DOBJ_RD_L[i] );
				_DrawObject( &ot[i], ot_length, DOBJ_RD_R[i] );
			}
			GsSetFlatLight(0, &light2);
			if (car_data->boost_wr & 1)
			{
				CRD_FIRE_R[i].flg=0;
				CRD_FIRE_L[i].flg=0;
				_DrawObject_NL( &ot[i], ot_length, DOBJ_FIRE_R[i] );
				_DrawObject_NL( &ot[i], ot_length, DOBJ_FIRE_L[i] );
			}
			if (car_data->boost_wr & (1<<1))
			{
				CRD_BOOSTER[i][0].flg=0;
				_DrawObject_NL( &ot[i], ot_length, DOBJ_BOOSTER[i][0] );
			}
			if (car_data->boost_wr & (1<<2))
			{
				CRD_BOOSTER[i][1].flg=0;
				_DrawObject_NL( &ot[i], ot_length, DOBJ_BOOSTER[i][1] );
			}
			if (car_data->boost_wr & (1<<3))
			{
				CRD_BOOSTER[i][2].flg=0;
				_DrawObject_NL( &ot[i], ot_length, DOBJ_BOOSTER[i][2] );
			}
			if (car_data->boost_wr & (1<<4))
			{
				CRD_BOOSTER[i][3].flg=0;
				_DrawObject_NL( &ot[i], ot_length, DOBJ_BOOSTER[i][3] );
			}
			if (car_data->effect)
			{
				car_data->effect_time--;
				if (car_data->effect_time==0)
				{
					car_data->effect=0;
				}
				else
				{
					MT=GsIDMATRIX;
					VZ.vx=4096*car_data->effect_time/16;
					VZ.vy=4096*car_data->effect_time/16;
					VZ.vz=4096*car_data->effect_time/16;
					RotMatrixY( (4096/8)*car_data->effect_time, &MT );
					ScaleMatrix( &MT, &VZ );
					CRD_EFFECT[i].coord=MT;
					CRD_EFFECT[i].flg=0;
					_DrawObject_NL( &ot[i], ot_length, DOBJ_EFFECT[i] );
				}
			}
			GsSetFlatLight(0, &Gsys.light);
		}
	}
}

void car_preope( int e )
{
	VECTOR VS;
	int i;
	for ( i=0 ; i<e ; i++ )
	{
		car_data=cars_scra[i];
		car_data->boost_wr&=(1<<6);
		car_data->turbo=0;
		car_data->breaking=0;
		car_data->breaking2=0;
		car_data->boost_timming2-=4096/360*15;
		car_data->draw=0;
//speed check
		_addVECTOR( &VS, car_data->inertia_forward, car_data->inertia_back );
		car_data->speed=sqr_i(2048, (VS.vx*VS.vx+VS.vy*VS.vy+VS.vz*VS.vz)>>(9-INERTIA_KETA2));
	}
}

void car_fire( int n, int size )
{
	SVECTOR VX={0,0,0};
	VECTOR VZ={4096,4096,4096};
	if (((Gsys.time+n) & 1) && Gsys.GameMode!=3) return;
	if (Trn.forb_b) Trn.forb_b=2;
	cars_scra[n]->boost_wr|=1;
	VX.vz=(cars_scra[n]->boost_timming-=4096/360*15);
	RotMatrix( &VX, &CRD_FIRE_R[n].coord );
	RotMatrix( &VX, &CRD_FIRE_L[n].coord );
	if (cars_scra[n]->turbo) size+=16;
	if (size!=64)
	{
		VZ.vx=VZ.vx*size>>6;
		VZ.vy=VZ.vy*size>>6;
		VZ.vz=VZ.vz*size>>6;
		ScaleMatrixL(&CRD_FIRE_R[n].coord, &VZ );
		ScaleMatrixL(&CRD_FIRE_L[n].coord, &VZ );
	}
}

void car_acceralate( int n, int mode )
{
	VECTOR AV={0,0,0}, BV;
	int t, turb;

	car_data=cars_scra[n];
//	car_data->acceralate=1;
	if (car_data->speed>2000) return;
	t=car_data->car_type;
	switch( mode )
	{
	case 0:
		if (cars_scra[n]->turbo)
			cars_scra[n]->damage+=48;
		AV.vz=(CARS_PROPATIE[t].per_accer0
			-(CARS_PROPATIE[t].per_accer1*car_data->speed>>6))>>INERTIA_KETA2;
		if (cars_scra[n]->turbo)
		{
			turb=(CARS_PROPATIE[t].turbo0-
				(CARS_PROPATIE[t].turbo1*car_data->speed>>4))>>INERTIA_KETA2;
			if (cars_scra[n]->turbo>=2)
				turb=(turb*cars_scra[n]->turbo)>>8;
			if (turb>0)
				AV.vz+=turb;
		}
		if (car_data->lev>=2)
		{
			turb=(CARS_PROPATIE[t].turbo0-
				(CARS_PROPATIE[t].turbo1*car_data->speed>>4))>>
												(INERTIA_KETA2+2);
			if (turb>0)
				AV.vz+=(turb*(cars_scra[n]->accer+2)>>1);
		}
		AV.vz=(AV.vz<<7)/CARS_PROPATIE[t].weight;
//		ApplyMatrixLV( &CRD_C[n].coord, &AV, &BV );
		BV.vx=CRD_C[n].coord.m[0][2]*AV.vz>>12;
		BV.vy=CRD_C[n].coord.m[1][2]*AV.vz>>12;
		BV.vz=CRD_C[n].coord.m[2][2]*AV.vz>>12;
		if (cars_scra[n]->grip==0) BV.vy=0;
		_addVECTOR2(&cars_scra[n]->inertia_forward,BV);
		_addVECTOR2(&cars_scra[n]->inertia_back,BV);
		break;
	case 1://R1
		cars_scra[n]->status.vy-=cars_scra[n]->per_rot2;
		AV.vx=(-cars_scra[n]->side_boost+(cars_scra[n]->speed>>4))>>INERTIA_KETA2;
		AV.vx=(AV.vx<<7)/CARS_PROPATIE[t].weight;
//		ApplyMatrixLV( &CRD_C[n].coord, &AV, &BV );
		BV.vx=CRD_C[n].coord.m[0][0]*AV.vx>>12;
		BV.vy=CRD_C[n].coord.m[1][0]*AV.vx>>12;
		BV.vz=CRD_C[n].coord.m[2][0]*AV.vx>>12;
		if (cars_scra[n]->grip==0) BV.vy=0;
		_addVECTOR2(&cars_scra[n]->inertia_forward,BV);
		break;
	case 2://L1
		cars_scra[n]->status.vy+=cars_scra[n]->per_rot2;
		AV.vx=(cars_scra[n]->side_boost-(cars_scra[n]->speed>>4))>>INERTIA_KETA2;
		AV.vx=(AV.vx<<7)/CARS_PROPATIE[t].weight;
//		ApplyMatrixLV( &CRD_C[n].coord, &AV, &BV );
		BV.vx=CRD_C[n].coord.m[0][0]*AV.vx>>12;
		BV.vy=CRD_C[n].coord.m[1][0]*AV.vx>>12;
		BV.vz=CRD_C[n].coord.m[2][0]*AV.vx>>12;
		if (cars_scra[n]->grip==0) BV.vy=0;
		_addVECTOR2(&cars_scra[n]->inertia_forward,BV);
		break;
	case 3://R2
		cars_scra[n]->status.vy+=cars_scra[n]->per_rot2;
		AV.vx=(-cars_scra[n]->side_boost+(cars_scra[n]->speed>>4))>>INERTIA_KETA2;
		AV.vx=(AV.vx<<7)/CARS_PROPATIE[t].weight;
//		ApplyMatrixLV( &CRD_C[n].coord, &AV, &BV );
		BV.vx=CRD_C[n].coord.m[0][0]*AV.vx>>12;
		BV.vy=CRD_C[n].coord.m[1][0]*AV.vx>>12;
		BV.vz=CRD_C[n].coord.m[2][0]*AV.vx>>12;
		if (cars_scra[n]->grip==0) BV.vy=0;
		_addVECTOR2(&cars_scra[n]->inertia_back,BV);
		break;
	case 4://L2
		cars_scra[n]->status.vy-=cars_scra[n]->per_rot2;
		AV.vx=(cars_scra[n]->side_boost-(cars_scra[n]->speed>>4))>>INERTIA_KETA2;
		AV.vx=(AV.vx<<7)/CARS_PROPATIE[t].weight;
//		ApplyMatrixLV( &CRD_C[n].coord, &AV, &BV );
		BV.vx=CRD_C[n].coord.m[0][0]*AV.vx>>12;
		BV.vy=CRD_C[n].coord.m[1][0]*AV.vx>>12;
		BV.vz=CRD_C[n].coord.m[2][0]*AV.vx>>12;
		if (cars_scra[n]->grip==0) BV.vy=0;
		_addVECTOR2(&cars_scra[n]->inertia_back,BV);
		break;
	}
}

void car_resistance( int n )
{
	int m, mm, x, y, z;
	car_data=cars_scra[n];
	m = (car_data->speed*car_data->resi1)/(car_data->weight*(car_data->speed+1));
	mm = m;
	if (car_data->breaking)
		mm+=car_data->brek*30;
	if (car_data->breaking2)
		mm+=car_data->brek*30;
	x=car_data->inertia_forward.vx;
	y=car_data->inertia_forward.vy;
	z=car_data->inertia_forward.vz;
	car_data->inertia_forward.vx-=(car_data->inertia_forward.vx*mm>>13);
	car_data->inertia_forward.vy-=(car_data->inertia_forward.vy*m>>13);
	car_data->inertia_forward.vz-=(car_data->inertia_forward.vz*mm>>13);
	if (x*car_data->inertia_forward.vx<0) car_data->inertia_forward.vx=0;
	if (y*car_data->inertia_forward.vy<0) car_data->inertia_forward.vy=0;
	if (z*car_data->inertia_forward.vz<0) car_data->inertia_forward.vz=0;
	x=car_data->inertia_back.vx;
	y=car_data->inertia_back.vy;
	z=car_data->inertia_back.vz;
	car_data->inertia_back.vx-=((car_data->inertia_back.vx)*mm>>13);
	car_data->inertia_back.vy-=((car_data->inertia_back.vy)*m>>13);
	car_data->inertia_back.vz-=((car_data->inertia_back.vz)*mm>>13);
	if (x*car_data->inertia_back.vx<0) car_data->inertia_back.vx=0;
	if (y*car_data->inertia_back.vy<0) car_data->inertia_back.vy=0;
	if (z*car_data->inertia_back.vz<0) car_data->inertia_back.vz=0;
}

void car_getplate( int n )
{
	SVECTOR *V;
	VECTOR *Vp, Vl;
	int xs, ys, now;
	SVECTOR A, B, C, D;

	int da, dd;
	int max_rk=3;
	if (Gsys.GameMode==3) max_rk=1;

	car_data=cars_scra[n];
	Vp=&(car_data->pos);

	now=car_data->now_on;
	if (now==-1) return;
	V=(SVECTOR *)(*((u_long *)(Gsys.cource_tmd_addr+12+28*map_data[now].tmd_num)));
	xs=map_data[now].xdiv;
	ys=map_data[now].ydiv;
	Vl.vx=(Vp->vx-map_data[now].center.vx)>>1;
	Vl.vy=(Vp->vy-map_data[now].center.vy)>>1;
	Vl.vz=(Vp->vz-map_data[now].center.vz)>>1;

	A=V[2*(xs+1)];
	B=V[xs+2*(xs+1)];
	C=V[xs+(ys-2)*(xs+1)];
	D=V[(ys-2)*(xs+1)];
	da=_LINE_CHECK( B, C, Vl );//next
	dd=_LINE_CHECK( D, A, Vl );//before
	if (dd>0)
	{
		now=map_data[now].before;
		car_data->now_chip_x+=xs;
	}
	if (da>0)
	{
		now=map_data[now].next;
		car_data->now_chip_x-=xs;
//		if (n==0) printf("xs-=%d\n\n",xs);
	}

	car_data->now_on=now;

//getChip
	if (now==-1) return;
	V=(SVECTOR *)(*((u_long *)(Gsys.cource_tmd_addr+12+28*map_data[now].tmd_num)));
	car_data->VP=V;
	car_data->VP2=(SVECTOR *)(*((u_long *)(Gsys.cource_tmd_addr+12+28*map_data[map_data[now].next].tmd_num)));
	car_data->VN=(SVECTOR *)(*((u_long *)(Gsys.cource_tmd_addr+20+28*map_data[now].tmd_num)));;

	xs=map_data[now].xdiv;
	ys=map_data[now].ydiv;
	Vl.vx=(Vp->vx-map_data[now].center.vx)>>1;
	Vl.vy=(Vp->vy-map_data[now].center.vy)>>1;
	Vl.vz=(Vp->vz-map_data[now].center.vz)>>1;
//x特定
	{
		int up, i, xss=15, xp=8, f=0, lp, rk, se;
		up=31;
		lp=0;
		se=0;
		do
		{
			se++;
			if (xss>xs && xp!=1) { up=xss, xss-=xp; xp>>=1; continue; }
			A=V[xss+2*(xs+1)];
			B=V[xss+(ys-2)*(xs+1)];
			f=_LINE_CHECK( A, B, Vl );
			if (f<=0)
			{
				up=xss;
				xss-=xp;
			}
			if (f>0)
			{
				lp=xss;
				xss+=xp;
			}
			if (xp!=1) xp>>=1;
		}
		while( up-lp!=1 && up>lp && se<6);

		if (up<1) up=1;
		if (up>=xs) up=xs;
		for( i=0 ; i<=ys ; i++ )
		{
			A=V[up-1+i*(xs+1)];
			B=V[up+i*(xs+1)];
			if (_LINE_CHECK( A, B, Vl )>0) break;
		}
		car_data->before_line_position=car_data->line_position;
		lp=((car_data->line_position+=(up-1)-car_data->now_chip_x));

		rk=car_data->rank;
		if (Gsys.goal_count==0)
			if (rk!=0 && lp>cars_scra[(int)Gsys.cars_pos[rk-1]]->line_position)
			{
				car_data->rank--;
				cars_scra[(int)Gsys.cars_pos[rk-1]]->rank++;
				Gsys.cars_pos[rk]=Gsys.cars_pos[rk-1];
				Gsys.cars_pos[rk-1]=n;
			}
			else
				if (rk!=max_rk && lp<cars_scra[(int)Gsys.cars_pos[rk+1]]->line_position)
				{
					car_data->rank++;
					cars_scra[(int)Gsys.cars_pos[rk+1]]->rank--;
					Gsys.cars_pos[rk]=Gsys.cars_pos[rk+1];
					Gsys.cars_pos[rk+1]=n;
				}
		car_data->now_chip_x=(up-1);
		car_data->cource_out=0;
		if (i==0)
		{
			car_data->cource_out=1;
			i=1;
		}
		if (i==ys+1)
		{
			car_data->cource_out=1;
			i=ys;
		}
		car_data->now_chip_y=(i-1);
		car_data->now_chip=(up-1)+(i-1)*(xs+1);
	}
}

int car_wallcheck( int n, int mode )
{
	SVECTOR *Vp, *Vn;
	SVECTOR A,B,C;
	VECTOR *Vpp;
	VECTOR R, Vl, Vl2, VN0;
	VECTOR VH;
	int xs, ys, x, da, hr, dis;
	int am, bm;

	car_data=cars_scra[n];

	Vpp=&car_data->pos;

	Vp=car_data->VP;
	Vn=car_data->VN;

	Vl.vx=(Vpp->vx-map_data[car_data->now_on].center.vx)>>1;
	Vl.vy=(Vpp->vy-map_data[car_data->now_on].center.vy)>>1;
	Vl.vz=(Vpp->vz-map_data[car_data->now_on].center.vz)>>1;
	Vl2.vx=(car_data->npos.vx-map_data[car_data->now_on].center.vx)>>1;
	Vl2.vy=(car_data->npos.vy-map_data[car_data->now_on].center.vy)>>1;
	Vl2.vz=(car_data->npos.vz-map_data[car_data->now_on].center.vz)>>1;

	x=car_data->now_chip_x;
	xs=map_data[car_data->now_on].xdiv;
	ys=map_data[car_data->now_on].ydiv;
	hr=(car_data->speed>>4)+3;
	if (car_data->lev) hr=0;
	car_data->lhit=0;
	car_data->rhit=0;

	A=Vp[x+(xs+1)*(2+mode)];
	_subVECTOR( &B, Vp[x+1+(xs+1)*(2+mode)], A );
	C=Vn[x+(xs)];
	A.vx+=(C.vx>>6);
	A.vz+=(C.vz>>6);
	am=B.vz*(Vl.vx-A.vx)-B.vx*(Vl.vz-A.vz);
	A.vx+=(C.vx>>6);
	A.vz+=(C.vz>>6);
	bm=B.vz*(Vl2.vx-A.vx)-B.vx*(Vl2.vz-A.vz);
	dis=_abs((C.vx*(Vl2.vx-A.vx)+C.vy*(Vl2.vy-A.vy)+C.vz*(Vl2.vz-A.vz))>>12);
	car_data->l_distans=dis;
	if (am>0 && bm<0 && (((Vp[x+(xs+1)].vy-Vl.vy)<SIDE_HIGHT && car_data->over>=0) || car_data->lev))
	{
		car_data->nposr.vx+=(C.vx*(dis+10))>>(11-POS_KETA);
		car_data->nposr.vz+=(C.vz*(dis+10))>>(11-POS_KETA);
		car_data->lhit=1;
		car_data->damage+=(hr*hr*2)+10;
		_subVECTOR( &R, Vp[x+1], Vp[x] );
		VN0=car_data->inertia_forward;
		da=((R.vx*VN0.vx+R.vy*VN0.vy+R.vz*VN0.vz)<<6)/(R.vx*R.vx+R.vy*R.vy+R.vz*R.vz);
		if (car_data->speed>80 && cars_scra[n]->lev==0 && Gsys.goal_count==0)
			da=(da*180)>>8;
		car_data->inertia_back.vx=car_data->inertia_forward.vx=(R.vx*da>>6)+(C.vx*hr>>8);
		car_data->inertia_back.vz=car_data->inertia_forward.vz=(R.vz*da>>6)+(C.vz*hr>>8);
		if (car_data->lev==0 && Gsys.goal_count==0)
		{
			Trn.wall_ch=1;
			VH.vx=(C.vx>>5);
			VH.vy=(C.vy>>5);
			VH.vz=(C.vz>>5);
			add_crash_chip( VH, C, 1, hr-3, 0, n );
			if (hr>16) car_hitsound( 45, 127, n );
		}
		return(1);
	}
	A=Vp[x+(xs+1)*(ys-2-mode)];
	_subVECTOR( &B, Vp[x+1+(xs+1)*(ys-2-mode)], A );
	C=Vn[x+(xs)*(ys-2)];
	A.vx+=(C.vx>>6);
	A.vz+=(C.vz>>6);
	am=B.vz*(Vl.vx-A.vx)-B.vx*(Vl.vz-A.vz);
	A.vx+=(C.vx>>6);
	A.vz+=(C.vz>>6);
	bm=B.vz*(Vl2.vx-A.vx)-B.vx*(Vl2.vz-A.vz);
	dis=_abs((C.vx*(Vl2.vx-A.vx)+C.vy*(Vl2.vy-A.vy)+C.vz*(Vl2.vz-A.vz))>>12);
	car_data->r_distans=dis;
	if (am<0 && bm>0 && (((Vp[x+(xs+1)*(ys-1)].vy-Vl.vy)<SIDE_HIGHT && car_data->over>=0) || car_data->lev))
	{
		car_data->nposr.vx+=(C.vx*(dis+10))>>(11-POS_KETA);
		car_data->nposr.vz+=(C.vz*(dis+10))>>(11-POS_KETA);
		car_data->rhit=1;
		car_data->damage+=(hr*hr*2)+10;
		_subVECTOR( &R, Vp[x+1], Vp[x] );
		VN0=car_data->inertia_forward;
		da=((R.vx*VN0.vx+R.vy*VN0.vy+R.vz*VN0.vz)<<6)/(R.vx*R.vx+R.vy*R.vy+R.vz*R.vz);
		if (car_data->speed>80 && cars_scra[n]->lev==0 && Gsys.goal_count==0)
			da=(180*da)>>8;
		car_data->inertia_back.vx=car_data->inertia_forward.vx=(R.vx*da>>6)+(C.vx*hr>>8);
		car_data->inertia_back.vz=car_data->inertia_forward.vz=(R.vz*da>>6)+(C.vz*hr>>8);
		if (car_data->lev==0 && Gsys.goal_count==0)
		{
			Trn.wall_ch=1;
			VH.vx=(C.vx>>5);
			VH.vy=(C.vy>>5);
			VH.vz=(C.vz>>5);
			add_crash_chip( VH, C, 1, hr-3, 0, n );
			if (hr>16) car_hitsound( 45, 127, n );
		}
		return(1);
	}
	return(0);
}

void car_chipeffect( int n )
{
	int ch,d,xdiv,ydiv,i;
	static int ccc[4]={-1,-1,-1,-1};
	char tmp[32];
	unsigned char *a;
	SVECTOR *Vp,V2;
	car_data=cars_scra[n];

	a=COURCE_PAT_ADDR;
	d=car_data->now_on;

	Vp=car_data->VP;
	ch=a[map_data[d].pat*16*32+car_data->now_chip_x+car_data->now_chip_y*32];
	xdiv=map_data[d].xdiv;
	ydiv=map_data[d].ydiv;

	DOBJ_C[n].attribute&=~((1<<6)+(1<<30));
	if (Gsys.GameMode==5) DOBJ_C[1].attribute|=(1<<30);
	switch( ch )
	{
	case '*':
		if (car_data->lev || car_data->grip==0) break;
		car_data->breaking2=1;
		break;
	case 'd':
		if ((Gsys.GameMode!=3 && n) || car_data->grip==0) break;
		if (car_data->damageVoice==-1 && Gsys.replaying==0)
			car_data->damageVoice=SsUtKeyOn( Gsys.vab_se, SND_DAMAGE, 0, 90, 0, 64, 64 );
		DOBJ_C[n].attribute|=(((Gsys.time & 3)>>1)<<6)+(((Gsys.time+1) & 1)<<30);
		car_data->damage+=100;
		break;
	case 'B':
		if (car_data->grip==0) break;
		car_data->damage+=100000;
		break;
	}
	if ((Gsys.GameMode==3 || n==0) && (ch!='d' || car_data->grip==0) && car_data->damageVoice!=-1)
	{
		SsUtSetVVol( car_data->damageVoice, 0, 0 );
		SsUtKeyOff( car_data->damageVoice, Gsys.vab_se, SND_DAMAGE, 0, 90 );
		car_data->damageVoice=-1;
	}

	if (ccc[n]!=ch && car_data->over==0)
	{
		switch( ch )
		{
		case 's':
			ccc[n]=ch;
			Trn.stop[n]=1;
			break;
		case 'g':
			ccc[n]=ch;
			if (n && Gsys.GameMode==5) break;
			if (car_data->lev && Gsys.GameMode!=3) break;
			if (car_data->line_position<=car_data->last_goal+32)
				break;
			get_record_time( tmp, car_data->time );
			alphabet88( 576+32,384+(car_data->lap % 3)*8+8+n*32, tmp );
			car_data->lap++;
			car_data->last_goal=car_data->line_position;
			car_data->lap_time[(car_data->lap-1) & 3]=car_data->time;
			car_data->last_lap--;
			if (Gsys.time<Gsys.best_lap_time[Gsys.cource_number] && Gsys.GameMode!=2)
			{
				Gsys.best_lap_time[Gsys.cource_number]=car_data->time;
				Gsys.best_draw=150;
				alphabet88( 576+32,384+n*32, tmp );
			}
			if (Gsys.GameMode==2)
			{
				Gsys.time=0;
				car_data->time=0;
				break;
			}
			car_data->lap_draw=60*3;
			if (car_data->last_lap==0)
			{
				if (Gsys.goal_count==0) Gsys.goal_count=1;
				for ( i=0 ; i<4 ; i++ )
					cars_scra[i]->finish_rank=cars_scra[i]->rank;
			}
			car_data->time=0;
			Gsys.time=0;
			break;
		case 'J':
			if (car_data->grip==0) break;
			ccc[n]=ch;
			if (Trn.time!=0) car_data->inertia_forward.vy=car_data->inertia_back.vy=0;
			car_data->inertia_forward.vy-=1500;
			car_data->inertia_back.vy-=1500;
			break;
		case 'P':
			ccc[n]=ch;
			if (car_data->grip==0) break;
			car_data->damage-=6000;
			if (car_data->lev==0 && (Gsys.GameMode!=5 || n==0))
			{
				if (Gsys.replaying==0)
				{
					Gsys.etone=24;
					Gsys.effectVoice=SsUtKeyOn( Gsys.vab_se, SND_POWUP, 0, Gsys.etone, 0, 64, 64 );
					SsUtSetVVol( Gsys.effectVoice, 90, 90 );
				}
				car_data->effect=1;
				car_data->effect_time=32;
			}
			if (car_data->damage<0) car_data->damage=0;
			break;
		case '>':
			ccc[n]=ch;
			if (car_data->grip==0) break;
			Vp+=car_data->now_chip_x+car_data->now_chip_y*(xdiv+1);
			_subVECTOR( &V2, Vp[1], Vp[0] );
			car_data->inertia_forward.vx+=V2.vx<<1;
			car_data->inertia_forward.vy+=V2.vy<<1;
			car_data->inertia_forward.vz+=V2.vz<<1;
			car_data->inertia_back.vx+=V2.vx<<1;
			car_data->inertia_back.vy+=V2.vy<<1;
			car_data->inertia_back.vz+=V2.vz<<1;
			break;
		default:
			ccc[n]=ch;
			break;
		}
	}
}

void car_crashcheck( int n )
{
	int speed, l, k;
	VECTOR HR;
	SVECTOR C={0,0,4096};
	car_data=cars_scra[n];
	if ((car_data->over>0 && car_data->over<=64)) return;
	for( k=0 ; k<Gsys.cars_number ; k++ )
		if ((l=Gsys.cars_distance[n][k])<512 && n!=k && (cars_scra[k]->over<=0 || cars_scra[k]->over>64))
		{
			speed=(_abs(cars_scra[k]->speed-car_data->speed)>>3)+200;
			_subVECTOR(&HR, car_data->pos, cars_scra[k]->pos );
			speed=(speed<<7)/CARS_PROPATIE[car_data->car_type].weight;
			if (l!=0)
			{
				HR.vx=HR.vx*speed/l;
				HR.vy=HR.vy*speed/l;
				HR.vz=HR.vz*speed/l;
			}
			_addVECTOR(&car_data->inertia_forward,car_data->inertia_forward,HR);
			_addVECTOR(&car_data->inertia_back,car_data->inertia_back,HR);
			if (car_data->lev==0)
			{
				if (l)
				{
					C.vx=HR.vx*4096/l;
					C.vy=HR.vy*4096/l;
					C.vz=HR.vz*4096/l;
				}
				_addVECTOR(&HR, car_data->pos, car_data->pos );
				HR.vx=(HR.vx>>1)-car_data->pos.vx;
				HR.vy=(HR.vy>>1)-car_data->pos.vy;
				HR.vz=(HR.vz>>1)-car_data->pos.vz;
				add_crash_chip( HR, C, 2, 8, 0, n );
				car_data->damage+=speed+300;
				car_hitsound( 70, 127, n );
			}
		}
}

void warning( int ref, int n )
{
	if (n && Gsys.GameMode==5) return;
	if (Gsys.replaying) return;
	if (ref==1)
	{
		if (cars_scra[n]->warnVoice!=-1)
		{
			SsUtSetVVol( cars_scra[n]->warnVoice, 0, 0 );
			SsUtKeyOff( cars_scra[n]->warnVoice, Gsys.vab_se, SND_WARN, 0, 40 );
			cars_scra[n]->warnVoice=-1;
		}
		return;
	}
	if (cars_scra[n]->warnVoice==-1)
	{
		cars_scra[n]->warnVoice = SsUtKeyOn( Gsys.vab_se, SND_WARN, 0, 40, 0, 80, 80 );
		SsUtSetVVol( cars_scra[n]->warnVoice, 80, 80 );
	}
}

void car_action( int n, int pd )
{
	VECTOR VT;
	SVECTOR VR={0,0,0};
	int vol;
	car_data=cars_scra[n];

//	printf("ac st:");

	if (cars_scra[n]->car_type==5)
		pd &= ~(PADL1 | PADL2 | PADR1 | PADR2);
	if (Gsys.GameMode==2) car_data->damage=0;
	if (car_data->damage>4 && car_data->over==0)
		car_data->damage-=(6+((car_data->damage)*9/car_data->damage_max));
	if ((pd & PADRleft) && car_data->car_type!=4)
		car_data->turbo=1;
	if (car_data->over>=0) car_getplate( n ); //現在位置特定
	car_chipeffect( n );
	if (pd & PADRright)
		car_data->breaking=1;

	car_resistance( n );
	car_crashcheck( n );

	car_gravide( n );
	car_bank( n );
	if (car_data->attribute & 1<<1)
		pd=0;

	if ((pd & (PADLright | PADLleft))==0)
	{
		car_radder( n, 0, 0 );
	}
	else
	{
		if (pd & PADLright)
			car_radder( n, -1, 1 );
		if (pd & PADLleft)
			car_radder( n, 1, 1 );
	}
	if (pd & (PADRdown | PADRleft))
	{
		car_fire( n, 64 );
		car_data->last=64;
		car_acceralate( n, 0 );
		if (Gsys.replaying==0) SsUtSetVVol( car_data->boostBVoice, 40, 40 );
	}
	else
	{
		if (Gsys.replaying==0) SsUtSetVVol( car_data->boostBVoice, 0, 0 );
		if (car_data->last)
		{
			car_fire( n, car_data->last );
//			car_acceralate( n, 0 );
			car_data->last--;
		}
	}

	if (car_data->turbo)
	{
		SsUtChangePitch( car_data->boostBVoice,Gsys.vab_se,SND_WIND,car_data->boost_tone,0,BOOST_TONE+12,0 );
		car_data->boost_tone=BOOST_TONE+12;
		DOBJ_FIRE_R[n].attribute|=1<<6;
		DOBJ_FIRE_L[n].attribute|=1<<6;
	}
	else
	{
		SsUtChangePitch( car_data->boostBVoice,Gsys.vab_se,SND_WIND,car_data->boost_tone,0,BOOST_TONE,0 );
		car_data->boost_tone=BOOST_TONE;
		DOBJ_FIRE_R[n].attribute&=~(1<<6);
		DOBJ_FIRE_L[n].attribute&=~(1<<6);
	}

	if ((pd & PADLup) && car_data->grip==0 && car_data->status.vx>-4096*20/360)
		car_data->status.vx-=4096/360;
	if ((pd & PADLdown) && car_data->grip==0 && car_data->status.vx<4096*20/360)
		car_data->status.vx+=4096/360;

	if (pd & PADR1)
	{
		car_boost( n, BOOST_R1 );
		car_acceralate( n, BOOST_R1+1 );
	}
	if (pd & PADL1)
	{
		car_boost( n, BOOST_L1 );
		car_acceralate( n, BOOST_L1+1 );
	}
	if (pd & PADR2)
	{
		car_boost( n, BOOST_R2 );
		car_acceralate( n, BOOST_R2+1 );
	}
	if (pd & PADL2)
	{
		car_boost( n, BOOST_L2 );
		car_acceralate( n, BOOST_L2+1 );
	}

	if (Gsys.replaying==0)
	{
		if (pd & (PADR1 | PADR2))
			SsUtSetVVol( car_data->boostRVoice, 10,40 );
		else
			SsUtSetVVol( car_data->boostRVoice, 0, 0 );
		if (pd & (PADL1 | PADL2))
			SsUtSetVVol( car_data->boostLVoice, 40, 10 );
		else
			SsUtSetVVol( car_data->boostLVoice, 0, 0 );
	}

	car_rotation( n );

	vol=car_data->speed>>5;
	if (vol>127) vol=127;
	if (Gsys.replaying==0)
		SsUtSetVVol( car_data->windVoice, vol, vol );

	if ((car_data->damage_max-car_data->damage)<(car_data->damage_max>>3) && car_data->over==0)
	{
		warning( 0, n );
		if ((Gsys.time & 7)==0)
			DOBJ_C[n].attribute|=1<<6;
	}
	else
	{
		warning( 1, n );
	}
	car_data->npos=car_data->pos;
	car_data->nposr=car_data->posr;
	VR=car_data->status;
	VR.vy=0;
	RotMatrix( &VR, &CRD_C[n].coord );
	VR=car_data->statusk;
	VR.vy=0;
	RotMatrix( &VR, &CRD_KAGE[n].coord );
	RotMatrixY( car_data->status.vy, &CRD_C[n].coord );
	RotMatrixY( car_data->status.vy, &CRD_KAGE[n].coord );
	_addVECTOR(&VT,car_data->inertia_forward,car_data->inertia_back);
	VT.vx>>=(INERTIA_KETA-POS_KETA);
	VT.vy>>=(INERTIA_KETA-POS_KETA);
	VT.vz>>=(INERTIA_KETA-POS_KETA);
	_addVECTOR( &car_data->nposr, car_data->nposr, VT );
	do
	{
		car_data->npos.vx=car_data->nposr.vx>>POS_KETA;
		car_data->npos.vy=car_data->nposr.vy>>POS_KETA;
		car_data->npos.vz=car_data->nposr.vz>>POS_KETA;
	}
	while( car_wallcheck( n, 0 ) );

	car_data->pos=car_data->npos;
	car_data->posr=car_data->nposr;
	CRD_KAGE[n].coord.t[0]=CRD_C[n].coord.t[0]=car_data->nposr.vx>>POS_KETA;
	CRD_C[n].coord.t[1]=car_data->nposr.vy>>POS_KETA;
	CRD_KAGE[n].coord.t[2]=CRD_C[n].coord.t[2]=car_data->nposr.vz>>POS_KETA;
	CRD_C[n].flg=0;
//	CRD_KAGE[n].flg=0;
//	printf("ac end");
}

int car_control( int n )
{
	int rc=0, kx, nx=0, np, br=0, ln;
	int left=800, right=800;
	int ds;
	VECTOR VS;
	SVECTOR *Vp;
	car_data=cars_scra[n];

//	ApplyMatrixLV( &CRD_C[n].coord, &VE, &VN );
	Vp=car_data->VP;

	car_data->timming++;
	np=car_data->now_chip_x;

	nx=car_data->now_on;
	ln=map_data[nx].attribute;

	ds=cars_scra[0]->line_position-car_data->line_position;
	car_data->accer=0;
	if (ds>-4 && car_data->timming>60*10) car_data->accer=1;

	np+=1;
	if (car_data->speed>200)
		np+=1;
	if (car_data->speed>250)
		np+=2;
	if (car_data->speed>300)
		np+=2;
	if (ln==1)
	{
		if (car_data->r_distans<800)
			np-=2;
		if (car_data->l_distans<800)
			np++;
	}
	if (ln==2)
	{
		if (car_data->l_distans<800)
			np-=2;
		if (car_data->r_distans<800)
			np++;
	}

	switch(car_data->car_type)
	{
	case 0:
		if (map_data[map_data[nx].next].attribute==1 && ln==0)
			right=1600;
		if (map_data[map_data[nx].next].attribute==2 && ln==0)
			left=1600;
		break;
	case 1:
		if (map_data[map_data[nx].next].attribute==1 && ln==0)
			left=1800;
		if (map_data[map_data[nx].next].attribute==2 && ln==0)
			right=1800;
		if (ln==1)
			left=1000;
		if (ln==2)
			right=1000;
		break;
	case 2:
		if (map_data[map_data[nx].next].attribute==1 && ln==0)
			right=1600;
		if (map_data[map_data[nx].next].attribute==2 && ln==0)
			left=1600;
		break;
	case 3:
		if (map_data[map_data[nx].next].attribute==1 && ln==0)
			right=1600;
		if (map_data[map_data[nx].next].attribute==2 && ln==0)
			left=1600;
		break;
	}

	if (car_data->speed<car_data->max_speed)
		rc|=PADRdown;

	while (np>map_data[nx].xdiv)
	{
		np-=map_data[nx].xdiv;
		Vp=car_data->VP2;
		nx=map_data[nx].next;
	}

	Vp+=np;
	_subVECTOR( &VS, Vp[1], Vp[0] );
	kx=VS.vx*CRD_C[n].coord.m[2][2]-CRD_C[n].coord.m[0][2]*VS.vz;

	if (kx>200000)
	{
		rc|=PADL1;
		rc|=PADR2;
		rc|=PADLright;
		br=1;
	}
	if (kx<-200000)
	{
		rc|=PADR1;
		rc|=PADL2;
		rc|=PADRleft;
		br=1;
	}

	if (br==0)
	{
		if (car_data->l_distans<left)
		{
			if (ln==0)
			{
				rc|=PADL1 | PADL2;
				rc|=PADLright;
			}
			if (ln==1)
			{
				rc|=PADL1 | PADR2;
				rc|=PADLright;
			}
		}
		if (car_data->r_distans<right)
		{
			if (ln==0)
			{
				rc|=PADR1 | PADR2;
				rc|=PADLleft;
			}
			if (ln==1)
			{
				rc|=PADL2 | PADR1;
				rc|=PADLleft;
			}
		}
	}

	if (car_data->timming<60*5+60*(3-n))
	{
		car_data->turbo=256;
		rc|=PADRdown;
	}
	else
		if (car_data->timming<60*5+256+60*(3-n))
			car_data->turbo=256-(car_data->timming-60*5+60*(3-n));
	if (car_data->lev==0)
	{
		rc&=~PADRdown;
		rc&=~PADL2;
		rc&=~PADR2;
		rc&=~PADL1;
		rc&=~PADR1;
		rc|=PADRright;
	}
	return( rc );
}

void car_enemy( int n, unsigned int mask )
{
	VECTOR VT;
	SVECTOR VR={0,0,0};
	
	int pd=0;
	car_data=cars_scra[n];

	car_getplate( n ); //現在位置特定
	car_chipeffect( n );

	pd=car_control( n ) & mask;

	car_resistance( n );
	car_crashcheck( n );
	car_gravide( n );
	if (car_data->lev==0) car_bank( n );

	if ((pd & (PADLright | PADLleft))==0)
	{
		car_radder( n, 0, 0 );
	}
	else
	{
		if (pd & PADLright)
			car_radder( n, -1, 1 );
		if (pd & PADLleft)
			car_radder( n, 1, 1 );
	}
	if (pd & PADRdown)
	{
//		car_data->last=64;
		car_acceralate( n, 0 );
	}
	if (car_data->lev)
		car_fire( n, 64 );

	if (pd & PADR1)
	{
		car_boost( n, BOOST_R1 );
		car_acceralate( n, BOOST_R1+1 );
	}

	if (pd & PADL1)
	{
		car_boost( n, BOOST_L1 );
		car_acceralate( n, BOOST_L1+1 );
	}
	if (pd & PADR2)
	{
		car_boost( n, BOOST_R2 );
		car_acceralate( n, BOOST_R2+1 );
	}
	if (pd & PADL2)
	{
		car_boost( n, BOOST_L2 );
		car_acceralate( n, BOOST_L2+1 );
	}

	car_rotation( n );

	car_data->npos=car_data->pos;
	car_data->nposr=car_data->posr;
	VR=car_data->status;
	VR.vy=0;
	RotMatrix( &VR, &CRD_C[n].coord );
	VR=car_data->statusk;
	VR.vy=0;
	RotMatrix( &VR, &CRD_KAGE[n].coord );
	RotMatrixY( car_data->status.vy, &CRD_C[n].coord );
	RotMatrixY( car_data->status.vy, &CRD_KAGE[n].coord );
	_addVECTOR(&VT,car_data->inertia_forward,car_data->inertia_back);
	VT.vx>>=(INERTIA_KETA-POS_KETA);
	VT.vy>>=(INERTIA_KETA-POS_KETA);
	VT.vz>>=(INERTIA_KETA-POS_KETA);
	_addVECTOR( &car_data->nposr, car_data->nposr, VT );
	car_data->npos.vx=car_data->nposr.vx>>POS_KETA;
	car_data->npos.vy=car_data->nposr.vy>>POS_KETA;
	car_data->npos.vz=car_data->nposr.vz>>POS_KETA;
	car_wallcheck( n, 1 );
	do
	{
		car_data->npos.vx=car_data->nposr.vx>>POS_KETA;
		car_data->npos.vy=car_data->nposr.vy>>POS_KETA;
		car_data->npos.vz=car_data->nposr.vz>>POS_KETA;
	}
	while( car_wallcheck( n, 0 ) );

	car_data->pos=car_data->npos;
	car_data->posr=car_data->nposr;
	CRD_KAGE[n].coord.t[0]=CRD_C[n].coord.t[0]=car_data->nposr.vx>>POS_KETA;
	CRD_C[n].coord.t[1]=car_data->nposr.vy>>POS_KETA;
	CRD_KAGE[n].coord.t[2]=CRD_C[n].coord.t[2]=car_data->nposr.vz>>POS_KETA;
	CRD_C[n].flg=0;
//	CRD_KAGE[n].flg=0;
}
