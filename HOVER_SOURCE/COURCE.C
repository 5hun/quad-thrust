#include "GP1.h"

//extern struct s_CARS_DATA cars_data[MAX_CAR_NUM];
extern struct s_CARS_DATA *cars_scra[4];

extern GsDOBJ2 DOBJ_RD_L[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_RD_R[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_FIRE_R[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_FIRE_L[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_BOOSTER[MAX_CAR_NUM][4];
extern GsDOBJ2 DOBJ_KAGE[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_EFFECT[MAX_CAR_NUM];
extern GsDOBJ2 DOBJ_ALPHABET[16];
extern GsCOORDINATE2 CRD_RD_L[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_RD_R[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_FIRE_R[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_FIRE_L[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_BOOSTER[MAX_CAR_NUM][4];
extern GsCOORDINATE2 CRD_KAGE[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_EFFECT[MAX_CAR_NUM];
extern GsCOORDINATE2 CRD_ALPHABET[16];
extern GsCOORDINATE2 CRD_C[MAX_CAR_NUM];

extern GsCOORDINATE2 CRD_COURCE;

extern GsDOBJ2 DOBJ_BACK[MAX_COURCE_PARTS*2];
extern GsCOORDINATE2 CRD_BACK[MAX_COURCE_PARTS*2];

extern struct s_SYSTEM_DATA Gsys;
extern struct s_MAP_DATA *map_data;

u_long *alphabet_addr( char u, int *b )
{
	if (u>='A' && u<='O')
	{
		*b=u-'A';
		return((u_long *)APHA_TMD_A_O_ADDR);
	}
	if (u>='P' && u<='Z')
	{
		*b=u-'P';
		return((u_long *)APHA_TMD_P_O_ADDR);
	}
	if (u>='0' && u<='9')
	{
		*b=u-'0';
		return((u_long *)APHA_TMD_0_9_ADDR);
	}
	if (u=='?')
	{
		*b='9'-'0'+3;
		return((u_long *)APHA_TMD_0_9_ADDR);
	}
//	printf("ALPHABET %d is Not Found!",u);
	exit(1);
}

void get_bgcolor()
{
	u_long a;
	RECT rect={704+28,0,1,1};
	StoreImage( &rect, &a );
	DrawSync(0);
	rect.x=a & 255;
	rect.y=496;
	StoreImage( &rect, &a );
	DrawSync(0);
	Gsys.bg_b=((a>>10) & 31)<<3;
	Gsys.bg_g=((a>>5) & 31)<<3;
	Gsys.bg_r=((a) & 31)<<3;
	rect.x=5;
	rect.y=491;
	StoreImage( &rect, &a );
	DrawSync(0);
	Gsys.bg_b2=((a>>10) & 31)<<3;
	Gsys.bg_g2=((a>>5) & 31)<<3;
	Gsys.bg_r2=((a) & 31)<<3;
//	printf("brg=(%d,%d,%d)\n",Gsys.bg_b2,Gsys.bg_r2,Gsys.bg_g2);
}

void cource_init( int cource_n, int mode )
{
	MATRIX MT;
	VECTOR VS={4096*2,4096*2,4096*2};
	u_long *cource_tmd=(u_long *)COURCETMD_ADDR;
	int i, k;
//	RECT rect;
	char *mapname[]={
		"SAMPLE15.SEQ",
		"HOVER2.SEQ",
		"TO7.SEQ",
		"SAMPLE15.SEQ",
		"HOVER2.SEQ",
		"HOVER4.SEQ",
		"TO7.SEQ",
		"HOVER4.SEQ",
		"SAMPLE16.SEQ"
	};
	GsFOGPARAM FPARA[]={
		{	-120000*4096/64/1000,4096*4096*1.25,32,32,32	},//city
		{	-200000*4096/64/1000,4096*4096*1.25,120,120,120	},//ROCK
		{	-180000*4096/64/1000,4096*4096*1.25,64,64,64	},//ICE
		{	-180000*4096/64/1000,4096*4096*1.25,40,40,40	},//MYST
		{	-180000*4096/64/1000,4096*4096*1.25,6,2,2	}//DESERT
	};
	GsF_LIGHT light[]={
		{0,128,128,40,40,40},
		{0,128,128,120,120,120},
		{0,128,128,70,70,70},
		{0,128,128,60,60,60},
		{40,32,128,90,60,60},
		{0,0,0,0,0,0}
	};
	int ambi[]={
		LIGHT_AMBIENT*3/2,LIGHT_AMBIENT*3/2,LIGHT_AMBIENT*3/2,1,
		LIGHT_AMBIENT*3/2,LIGHT_AMBIENT*3/2,LIGHT_AMBIENT*3/2,0,
		LIGHT_AMBIENT*3/4,LIGHT_AMBIENT*3/4,LIGHT_AMBIENT*3/4,1,
		LIGHT_AMBIENT,LIGHT_AMBIENT,LIGHT_AMBIENT,1,
		LIGHT_AMBIENT*7/8,LIGHT_AMBIENT*3/4,LIGHT_AMBIENT*3/4,1
	};
	char *sfname[]={
		"NIGHT0A.TIM","NIGHT0B.TIM","NIGHT0C.TIM",
		"SEA01.TIM","SEA01B.TIM","SEA01C.TIM",
		"ROCK_U0.TIM","ROCK_U1.TIM","ROCK_U2.TIM",
		"ROCK_D0.TIM","ROCK_D1.TIM","ROCK_D2.TIM",
		"SEA_KEIA.TIM","SEA_KEIB.TIM","SEA_KEIC.TIM",
		"SKY13A.TIM","SKY13B.TIM","SKY13C.TIM",
		"BGT0.TIM","BGT1.TIM","BGT2.TIM",
		"TOWNA.TIM","TOWNB.TIM","TOWNC.TIM",
		"SABAKU0.TIM","SABAKU1.TIM","SABAKU2.TIM",
		"SABA_T1.TIM","SABA_T2.TIM","SABA_T3.TIM"
	};
	int stage_type[]={0,1,2,0,1,3,2,3,4};
	Gsys.cource_number=cource_n;
	Gsys.cource_tmd_addr=(char *)cource_tmd;
	Gsys.cource_type=stage_type[cource_n];
	if (Gsys.cource_type==0)
	{
		DWORD(BACKTMD_ADDR+12+4)=(NUMBER_BTMD+1)*4+NUMBER_SEARCHLIGHT*3;
		DWORD(BACKTMD_ADDR+12+20)=(NUMBER_BTMD)*3+NUMBER_SEARCHLIGHT;
	}
	else
	{
		DWORD(BACKTMD_ADDR+12+4)=(NUMBER_BTMD+1)*4;
		DWORD(BACKTMD_ADDR+12+20)=(NUMBER_BTMD)*3;
	}
	if (mode!=1)
	{
		i=stage_type[cource_n];
		if (Gsys.GameMode==3)
			FPARA[i].dqa*=2;
		GsSetFogParam( &FPARA[i] );
		GsSetFlatLight(0, &light[i]);
		GsSetFlatLight(1, &light[5]);
		GsSetFlatLight(2, &light[5]);
		Gsys.light=light[i];
		GsSetAmbient( ambi[i*4],ambi[i*4+1],ambi[i*4+2]);//Žü•ÓŒõ
		GsSetLightMode( ambi[i*4+3] );
	}
	if (mode==0)
	{
		if (Gsys.GameMode!=3) SeqPlay( mapname[cource_n], 0 );
		else SeqPlay( "CANION.SEQ", 0 );

		for ( i=0 ; i<6 ; i++ )
		{
			LZS_unpack_one( C_TIM_PAC, COURCETMD_ADDR, SIZE_COURCETMD, sfname[stage_type[Gsys.cource_number]*6+i] );
			loadTim( (u_long *)COURCETMD_ADDR );
		}
		get_bgcolor();
	}
	DrawSync(0);
	VSync(0);
	makemap( cource_n, (mode==1) );

	MT=GsIDMATRIX;
	ScaleMatrix( &MT, &VS );
	Gsys.cource_tmd_num=DWORD(cource_tmd+2);
	k=DWORD(cource_tmd+2)/2;
	for (i=0 ; i<k ; i++ )
	{
//		printf("B:put %d,(%d,%d,%d), %d\n",i,map_data[i].center.vx,map_data[i].center.vy,map_data[i].center.vz,(map_data+i)->tmd_num);
		_setMATRIXsVECTOR( &MT, map_data[i].center );
		crd_set( &CRD_BACK[i], MT, &CRD_COURCE );
		obj_set( &DOBJ_BACK[i], &CRD_BACK[i],(u_long *)cource_tmd,(map_data+i)->tmd_num, 0 );
	}
	for (i=0 ; i<k ; i++ )
	{
		_setMATRIXsVECTOR( &MT, map_data[i].center );
		crd_set( &CRD_BACK[i+k], MT, &CRD_COURCE );
		obj_set( &DOBJ_BACK[i+k], &CRD_BACK[i+k],(u_long *)cource_tmd,(map_data+i)->tmd_num+k, 0  );
	}
	Gsys.cource_tnum_div=k;
}

void cource_draw( GsOT *ot, int ot_length )
{
	int k, c, i, sw=0, bsw=0, dr_back=0, dr_front=0;
	int kx, fbsw=0;
	static int mk[2]={0,0}, tm[2]={0,0};
	VECTOR VN, VS, VE={0,0,4096};
	SVECTOR *Vp;
	int a=0;
	if (Gsys.GameMode==3) a=Gsys.draw_player;
	c=Gsys.view_now_on;
	ApplyMatrixLV( &CRD_C[a].coord, &VE, &VN );
	Vp=cars_scra[a]->VP;
	Vp+=cars_scra[a]->now_chip_x+(map_data[c].xdiv+1)*2;
	_subVECTOR( &VS, Vp[map_data[c].xdiv+1], Vp[0] );
	kx=VS.vx*VN.vz-VN.vx*VS.vz;

//	if (Gsys.replaying && Gsys.replay_view_mode==17) kx=~kx;
	if (tm[a]) tm[a]--;
	else mk[a]=kx;
	if (mk[a]>0 && kx<0 && tm[a]==0) tm[a]=16>>(Gsys.GameMode==3);

	if ( Gsys.view_type==17 ) mk[a]*=-1;

	if (mk[a]>0)
	{
		dr_front=map_data[c].write_f;
		if (cars_scra[a]->now_chip_x>=(map_data[c].xdiv>>1)) sw++;
		if (cars_scra[a]->now_chip_x<(map_data[c].xdiv>>1))
		{
			dr_back++;
			if (cars_scra[a]->now_chip_x<(map_data[c].xdiv>>2))
				bsw++;
		}
	}
	else
	{
		fbsw=4;
		dr_back=map_data[c].write_b;
		if (cars_scra[a]->now_chip_x<=(map_data[c].xdiv>>1)) bsw++;
		if (cars_scra[a]->now_chip_x>((map_data[c].xdiv)>>1))
		{
			dr_front++;
			if (cars_scra[a]->now_chip_x>((map_data[c].xdiv*3)>>2))
				sw++;
		}
	}
	if (Gsys.goal_count && Gsys.GameMode==0) sw=bsw=1, dr_front++;
	if ((Gsys.replaying && Gsys.replay_view_mode==33) || (Gsys.start_count>120))
	{
		dr_front=2;
		dr_back=2;
		sw=0;
		bsw=0;
	}
	k=c;
	if (cars_scra[a]->over>=0)
	{
		_DrawObject( ot, ot_length, DOBJ_BACK[k] );
	}
	else
	{
		_DrawObject( ot, ot_length, DOBJ_BACK[k+(Gsys.cource_tmd_num>>1)] );
	}

	for (i=0 ; i<dr_front ; i++)
	{
		k=map_data[k].next;
		if (i>=sw)
			_DrawObject( ot, ot_length, DOBJ_BACK[k+(Gsys.cource_tmd_num>>1)] )
		else
			_DrawObject( ot, ot_length, DOBJ_BACK[k] )
	}
	k=c;
	for (i=0 ; i<dr_back ; i++)
	{
		k=map_data[k].before;
		if (i>=bsw)
			_DrawObject( ot, ot_length, DOBJ_BACK[k+(Gsys.cource_tmd_num>>1)] )
		else
			_DrawObject( ot, ot_length, DOBJ_BACK[k] )
	}
	if (Gsys.start_count<120)
	{
		for (i=fbsw ; i<4+fbsw ; i++)
		{
			k = map_data[c].tmd_put[i];
			if (k==-1) break;
			_DrawObject( ot, ot_length, DOBJ_BACK[k+(Gsys.cource_tmd_num>>1)] );
		}
	}
	else
	{
		for (i=0 ; i<8 ; i++)
		{
			k = map_data[c].tmd_put[i];
			if (k==-1) continue;
			_DrawObject( ot, ot_length, DOBJ_BACK[k+(Gsys.cource_tmd_num>>1)] );
		}
	}
}