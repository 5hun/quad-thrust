//HoverRacing	1997.4.23-
//	GP1_MAIN.C	MAIN PROGRAM
//	Programmed By. Sato Tomokazu
#include <strings.h>
#include "GP1.H"

GsOT Wot[2];
GsOT_TAG zsortTable[2][1<<OT_LENGTH];
PACKET packet[2][PACKET_MAX*24];

GsOT Wot_CAR[8];
GsOT_TAG zsortTable_CAR[8][1<<OT_LENGTH_CAR];
GsOT Wot_BACK[2];
GsOT_TAG zsortTable_BACK[2][1<<OT_LENGTH_BACK];

volatile u_char *pd0, *pd1;

GsCOORDINATE2 CRD_COURCE;

GsDOBJ2 DOBJ_C[MAX_CAR_NUM];
GsDOBJ2 DOBJ_RD_R[MAX_CAR_NUM];
GsDOBJ2 DOBJ_RD_L[MAX_CAR_NUM];
GsDOBJ2 DOBJ_FIRE_R[MAX_CAR_NUM];
GsDOBJ2 DOBJ_FIRE_L[MAX_CAR_NUM];
GsDOBJ2 DOBJ_BACK[MAX_COURCE_PARTS*2];
GsDOBJ2 DOBJ_BOOSTER[MAX_CAR_NUM][4];
GsDOBJ2 DOBJ_KAGE[MAX_CAR_NUM];
GsDOBJ2 DOBJ_ALPHABET[16];
GsDOBJ2 DOBJ_BACK_SPRITE;
GsDOBJ2 DOBJ_CHIP;
GsDOBJ2 DOBJ_EFFECT[MAX_CAR_NUM];
GsCOORDINATE2 CRD_C[MAX_CAR_NUM];
GsCOORDINATE2 CRD_RD_L[MAX_CAR_NUM];
GsCOORDINATE2 CRD_RD_R[MAX_CAR_NUM];
GsCOORDINATE2 CRD_FIRE_R[MAX_CAR_NUM];
GsCOORDINATE2 CRD_FIRE_L[MAX_CAR_NUM];
GsCOORDINATE2 CRD_BACK[MAX_COURCE_PARTS*2];
GsCOORDINATE2 CRD_BOOSTER[MAX_CAR_NUM][4];
GsCOORDINATE2 CRD_KAGE[MAX_CAR_NUM];
GsCOORDINATE2 CRD_VIEW;
GsCOORDINATE2 CRD_ALPHABET[16];
GsCOORDINATE2 CRD_BACK_SPRITE;
GsCOORDINATE2 CRD_CHIP;
GsCOORDINATE2 CRD_EFFECT[MAX_CAR_NUM];

GsDOBJ2 DOBJ_head, DOBJ_body;
GsDOBJ2 DOBJ_Rarm0, DOBJ_Rarm1, DOBJ_Rhand;
GsDOBJ2 DOBJ_Larm0, DOBJ_Larm1, DOBJ_Lhand;
GsDOBJ2 DOBJ_Rleg0, DOBJ_Rleg1, DOBJ_Rshoes;
GsDOBJ2 DOBJ_Lleg0, DOBJ_Lleg1, DOBJ_Lshoes;
GsDOBJ2 DOBJ_kage;
GsCOORDINATE2 CRD_head, CRD_body;
GsCOORDINATE2 CRD_Rarm0, CRD_Rarm1, CRD_Rhand;
GsCOORDINATE2 CRD_Larm0, CRD_Larm1, CRD_Lhand;
GsCOORDINATE2 CRD_Rleg0, CRD_Rleg1, CRD_Rshoes;
GsCOORDINATE2 CRD_Lleg0, CRD_Lleg1, CRD_Lshoes;
GsCOORDINATE2 CRD_kage;

struct s_SYSTEM_DATA Gsys;
//struct s_CARS_DATA cars_data[MAX_CAR_NUM];
struct s_CARS_DATA *cars_scra[4];
struct s_CARS_DATA *car_data;
struct s_MAP_DATA *map_data=(struct s_MAP_DATA *)COURCE_DATA_ADDR;
struct s_BESTLAP_RECORD best_data;
struct s_SYSTEM_SAVEDATA save_data;
struct s_REPLAY_HEAD replay_head[4], n_replay_data, n_replay_data_g;
struct s_TRAINING Trn;
struct s_CAR_PROPATIE CARS_PROPATIE[6]={
	{
		{0,0,0},{-56,-104,-208}, {56,-104,-208},
		{-112,56,48},{-112,56,-128},{112,56,48},{112,56,-128},
		{-64,32,-240},{64,32,-240},
		183,200,128,
		240,0,
		250,5,
		33000,150,
		18000,8,32,4096/360,
		((u_long *)CARTMD_XVN_ADDR)
	},
	{
		{0,0,0},{-57,-134,-249}, {57,-134,-249},
		{-115,28,95},{-115,28,-76},{115,28,95},{115,28,-76},
		{-64,38,-268},{64,38,-268},
		183,200,120,
		325,11,
		258,5,
//		250,5,
		30000,160,
		17000,8,24,6500/360,
		((u_long *)CARTMD_PVN_ADDR)
	},
	{
		{0,0,0},{0,0,0}, {0,0,0},
		{-96,24,96},{-112,24,-114},{96,24,96},{112,24,-114},
		{-96,-16,-288},{96,-16,-288},
		183,200,100,
		135,-6,
		300,10,
		25000,140,
		13000,8,32,5700/360,
		((u_long *)CARTMD_SVS_ADDR)
	},
	{
		{0,0,0},{-64,-104,-160}, {64,-104,-160},
		{-112,56,48},{-112,56,-128},{112,56,48},{112,56,-128},
		{-64,32,-240},{64,32,-240},
		183,200,140,
		553,30,
		220,3,
		38000,155,
		22000,8,33,4096/360,
		((u_long *)CARTMD_AAA_ADDR)
	},
	{
		{0,0,0},{0,0,0}, {0,0,0},
		{-96,24,96},{-112,24,-114},{96,24,96},{112,24,-114},
		{-96,-16,-288},{96,-16,-288},
		183,200,95,
		93,-8,
		0,0,
		10000,140,
		11000,8,32,5700/360,
		((u_long *)CARTMD_XXX_ADDR)
	},
	{
		{0,0,0},{-57,-134,-249}, {57,-134,-249},
		{-115,28,95},{-115,28,-76},{115,28,95},{115,28,-76},
		{-64,38,-268},{64,38,-268},
		183,200,120,
		620,21,
		350,8,
		40000,0,
		32000,8,20,8000/360,
		((u_long *)CARTMD_PVN_ADDR)
	}
};

char *cource_name[]={
		"1-1 Gulf City   ",
		"1-2 Penta Rock  ",
		"1-3 Ice Gate    ",
		"2-1 KNight Town ",
		"2-2 Rollin'Stone",
		"2-3 Misty Arc   ",
		"3-1 White Cutter",
		"3-2 Highway Star",
		"3-3 Desert Gora "
};

void SeqPlay( char *name, int play )
{
	RECT rect;
	setRECT( &rect, 1024-128, 512-128, 128, 128 );
	if (name==NULL)
	{
		SsSeqStop( Gsys.seq );
		VSync(0);
		SsUtAllKeyOff(0);
		VSync(0);
		SsSeqClose( Gsys.seq );
		return;
	}
	StoreImage( &rect, (u_long *)PACKED_WORK_ADDR );
	VSync(0);
	DrawSync(0);
	LZS_unpack_one( PACKED_WORK_ADDR, SEQ0_ADDR, SIZE_SEQ0, name );
	if (play)
	{
		if (Gsys.seq!=-1)
		{
			SsSeqStop( Gsys.seq );
			VSync(0);
			SsUtAllKeyOff(0);
			VSync(0);
			SsSeqClose( Gsys.seq );
		}
		SsUtAllKeyOff(0);
		VSync(8);
		Gsys.seq=SsSeqOpen( (u_long *)SEQ0_ADDR, Gsys.vab_bgm );
//		printf("seqplay %d\n",Gsys.seq);
		if (play==1) SsSeqPlay( Gsys.seq, SSPLAY_PLAY, SSPLAY_INFINITY );
		else SsSeqPlay( Gsys.seq, SSPLAY_PLAY, 1 );
		SsSeqSetVol( Gsys.seq, 127,127 );
	}
}

void init_system()
{
	GsFOGPARAM FPARA;
	GetPadBuf( &pd0, &pd1 );

	ResetGraph( 0 );
	GsInitGraph( 320, 240, 4, 0, 0 );
	GsDefDispBuff( 0,0,0,240 );
	GsInit3D();

	FPARA.dqa=-180000*4096/64/1000;
	FPARA.dqb=4096*4096*1.25;
	FPARA.rfc=20;
	FPARA.gfc=20;
	FPARA.bfc=10;

	GsSetFogParam( &FPARA );
}

void memory_init()
{
	int i;
//OT init
	Wot[0].length = OT_LENGTH;
	Wot[0].org = zsortTable[0];
	Wot[1].length = OT_LENGTH;
	Wot[1].org = zsortTable[1];

	Wot_BACK[0].length = OT_LENGTH_BACK;
	Wot_BACK[0].org = zsortTable_BACK[0];
	Wot_BACK[1].length = OT_LENGTH_BACK;
	Wot_BACK[1].org = zsortTable_BACK[1];

	for (i=0 ; i<4 ; i++)
	{
		Wot_CAR[i].length = OT_LENGTH_CAR;
		Wot_CAR[i].org = zsortTable_CAR[i];
		Wot_CAR[i+4].length = OT_LENGTH_CAR;
		Wot_CAR[i+4].org = zsortTable_CAR[i+4];
	}
//	memset( (char *)&cars_data, 0, sizeof(struct s_CARS_DATA)*MAX_CAR_NUM );
//	memset( (char *)&Gsys, 0, sizeof(struct s_SYSTEM_DATA) );
}

void snd_init()
{
	SsSetMVol( 127, 127 );
	SsUtSetVVol( 0, 127, 127 );
	SsUtSetReverbType( SS_REV_TYPE_HALL );
	SsUtReverbOn();
	VSync(60);
	SsUtSetReverbDepth( 64,64 );
}

void data_locate()
{
	int i;
	GsIMAGE im;
	RECT rect;
	char *TIM_NAME[]={
	"CARS.TIM",
	"ROAD.TIM",
	"BOMB.TIM",
	"KABE.TIM",
	"FONTS.TIM",
	"TITLE.TIM",
	"FNT1.TIM",
	"CAR_MINI.TIM"
	};

	setRECT( &rect, 320, 0, 512, 256 );
	LoadImage( &rect, (u_long *)((u_char *)0x80100000) );
	DrawSync(0);
	VSync(0);

//	printf("DATA_LOCATE\n");
	LZS_unpack_one( U_TIM_TMDoPAC, BGM_VH, SIZE_BGM_VH, "BGM_I.VH" );
	LZS_unpack_one( U_TIM_TMDoPAC, SE_VH, SIZE_SE_VH, "SE.VH" );
	memcpy( (u_char *)0x80100000, U_BGMoVB_, SIZE_BGM_VB );
	LZS_unpack_one( (u_char *)0x80100000, U_BGMoVB_, SIZE_BGM_VB, "BGM_I.VB" );
	Gsys.vab_bgm=SsVabTransfer( BGM_VH, U_BGMoVB_,-1,1);
//	printf("Gsys.vab_bgm=%d\n",Gsys.vab_bgm);
	VSync(10);
	LZS_unpack_one( (u_char *)0x80100000, U_BGMoVB_, SIZE_BGM_VB, "SE.VB" );
	Gsys.vab_se=SsVabTransfer( SE_VH, U_BGMoVB_,-1,1);
//	printf("Gsys.vab_se=%d\n",Gsys.vab_se);
	VSync(10);
	setRECT( &rect, 320, 0, 512, 256 );
	StoreImage( &rect, (u_long *)((u_char *)0x80100000) );
	DrawSync(0);
	VSync(0);
	_BOXFILL( 0,0,1024,512, 0, 0, 0 );
	DrawSync(0);
	VSync(0);

//SEQ.lzs to VRAM
	setRECT( &rect, 1024-128, 512-128, 128, 128 );
	LoadImage( &rect, (u_long *)(U_SEQ_VHoPAC) );
	DrawSync(0);
	VSync(0);
//SCRIPT.lzs to VRAM
	setRECT( &rect, 1024-256, 512-128, 128, 128 );
	LoadImage( &rect, (u_long *)(U_SCRIPToPAC) );
	DrawSync(0);
	VSync(0);
//TIM処理 
//	printf("Unpack TIM");
	for ( i=0 ; i<8 ; i++ )
	{
		LZS_unpack_one( U_TIM_TMDoPAC, U_BGMoVB_, SIZE_BGM_VB, TIM_NAME[i] );
		loadTim( (u_long *)U_BGMoVB_ );
	}
	LZS_unpack_one( U_TIM_TMDoPAC, U_BGMoVB_, SIZE_BGM_VB, "mcard.tim" );
	GsGetTimInfo( ((u_long *)U_BGMoVB_)+1, &im );
	memcpy( save_data.tim_clut, im.clut, 32 );
	memcpy( save_data.tim_data, im.pixel, 128 );
	draw_message(160-8*13,120-20,"Please Wait!");
//TMD
	memcpy( U_BGMoVB_, U_TIM_TMDoPAC, SIZE_TIM_TMDoPAC );

	LZS_unpack_one( U_BGMoVB_, CARTMD_XVN_ADDR, SIZE_CARTMD_XVN, "XVN_CAR.TMD" );
	LZS_unpack_one( U_BGMoVB_, CARTMD_PVN_ADDR, SIZE_CARTMD_PVN, "XVP_CAR.TMD" );
	LZS_unpack_one( U_BGMoVB_, CARTMD_SVS_ADDR, SIZE_CARTMD_SVS, "SVS_CAR.TMD" );
	LZS_unpack_one( U_BGMoVB_, CARTMD_AAA_ADDR, SIZE_CARTMD_AAA, "JUSTER.TMD" );
	LZS_unpack_one( U_BGMoVB_, CARTMD_XXX_ADDR, SIZE_CARTMD_XXX, "XXX_CAR.TMD" );
	LZS_unpack_one( U_BGMoVB_, APHA_TMD_A_O_ADDR, SIZE_APHA_TMD_A_O, "ALP_A_O.TMD" );
	LZS_unpack_one( U_BGMoVB_, APHA_TMD_P_O_ADDR, SIZE_APHA_TMD_P_O, "ALP_P_O.TMD" );
	LZS_unpack_one( U_BGMoVB_, APHA_TMD_0_9_ADDR, SIZE_APHA_TMD_0_9, "ALP_0_9.TMD" );
	LZS_unpack_one( U_BGMoVB_, OTHER_TMD_ADDR, SIZE_OTHERTMD, "OTHER.TMD" );
	LZS_unpack_one( U_BGMoVB_, YMAN_TMD_ADDR, SIZE_YMAN_TMD, "YAKA_MAN.TMD" );
	LZS_unpack_one(  U_BGMoVB_, (char *)Gsys.cosd2, 2048*4, "CSDATA.DAT" );
	memcpy(Gsys.cosd, Gsys.cosd2+1024, 360*4 );
}

void make_sct_table()
{
	int i;
	for ( i=0 ; i<1024 ; i++ )
		Gsys.cosd2[i+1024]=-Gsys.cosd2[i];
	for ( i=0 ; i<2048 ; i++ )
		Gsys.sind2[i]=Gsys.cosd2[(i+2048-512) & 2047];
	for ( i=0 ; i<2048 ; i++ )
		if (Gsys.cosd2[(i-1024) & 2047])
			Gsys.tand[i]=(Gsys.sind2[(i-1024) & 2047]<<12)/Gsys.cosd2[(i-1024) & 2047];
	for ( i=0 ; i<360 ; i++ )
		Gsys.cosd[i+360]=-Gsys.cosd[i];
	for ( i=0 ; i<720 ; i++ )
		Gsys.sind[i]=Gsys.cosd[(i+720-180) % 720];
}

void unpack_datas()
{
	data_locate();
	make_sct_table();
}


void make_back_tmd()
{
	int i, x, y;
	unsigned char *p;
	SVECTOR *v;
	int lcol[]={
		0xffffff, 0x402020,
		0xc0ffff, 0x402020,
		0xffc0c0, 0x402020,
		0xffc0ff, 0x402020,
		0xc0ffff, 0x402020
	};
	

	p=BACKTMD_ADDR;
	DWORD(p)=0x41;
	DWORD(p+4)=0;
	DWORD(p+8)=1;
	p+=12;
	DWORD(p)=(u_long)(28);
	DWORD(p+4)=(NUMBER_BTMD+1)*4+NUMBER_SEARCHLIGHT*3;
	DWORD(p+8)=(u_long)NULL;
	DWORD(p+12)=0;
	DWORD(p+16)=(u_long)(28+DWORD(p+4)*sizeof(SVECTOR));
	DWORD(p+20)=NUMBER_BTMD*3;
	DWORD(p+24)=0;
	p+=28;
	v=(SVECTOR *)p;
	for( x=0 ; x<NUMBER_BTMD+1 ; x++ )
		for( y=0 ; y<4 ; y++, v++ )
			v->vx=(((x-(NUMBER_BTMD/2))*128*(y+2))>>1)*25, v->vy=(y*128-18)*30, v->vz=PROJECTION_LONG*25;
	for( y=0 ; y<NUMBER_SEARCHLIGHT*3 ; y++, v++ )
		v->vx=0, v->vy=0, v->vz=PROJECTION_LONG*25;
	p=(unsigned char *)v;
	for (y=0 ; y<3 ; y++ )
		for( i=0 ; i<NUMBER_BTMD ; i++ )
		{
			DWORD(p)=0x2d010709;
			WORD(p+6)=(489+y)<<6;
			WORD(p+10)=((640+(y>>1)*64)>>6)+(1<<4);
			p[4]=(y & 1)*128;
			p[5]=127+128;
			p[8]=(y & 1)*128;
			p[9]=128;
			p[12]=127+(y & 1)*128;
			p[13]=127+128;
			p[16]=127+(y & 1)*128;
			p[17]=128;
			DWORD(p+20)=(128<<16)+(128<<8)+128;
			WORD(p+24)=i*4+y+1;
			WORD(p+26)=i*4+y;
			WORD(p+28)=i*4+y+5;
			WORD(p+30)=i*4+y+4;
			p+=32;
		}
	for( i=0 ; i<NUMBER_SEARCHLIGHT ; i++ )
	{
		DWORD(p)=0x33010506;
		DWORD(p+4)=0x33000000 | lcol[i*2];
		DWORD(p+8)=lcol[i*2+1];
		DWORD(p+12)=lcol[i*2+1];
		WORD(p+16)=(NUMBER_BTMD+1)*4+i*3;
		WORD(p+18)=(NUMBER_BTMD+1)*4+i*3+1;
		WORD(p+20)=(NUMBER_BTMD+1)*4+i*3+2;
		p+=24;
	}
}

void flamebuff_init()
{
	alphabet16(320+256,384,"01234567");
	alphabet16(320+256,384+16,"89");
	alphabet88(320+256+8,384+16+8,"Km/h");
	alphabet16(320+256+6,384+48,"/");
	alphabet88(320+256+16, 384+16, "TOTAL");
	alphabet88(320+256+16, 384+16+8, "LAP TIME");
	alphabet88(320+256, 384+32, "0123456789\'\"");
	alphabet88(320+256, 384+32+8, "POSITIONBEST LAP");
	alphabet16(320+256, 384+64, "LASTLAPS");
	alphabet16(320+256, 384+64+16, "WRONGWAY");
	alphabet16(320+256+8, 384+64+32, "FINAL");
}

void init_datas()
{
	int i, j;
	SVECTOR o1={0,15,0}, o2={10,-10,0}, o3={-10,-10,0}, on={0,0,4096};
	SVECTOR VR, VRa;
	MATRIX MT;
	GsF_LIGHT light;
	char *name[]={
		"SAT","UME","BEE","UZU","MAS","ZZZ"
	};
	char *blank="               ";
	char *blank2="       ";
	char str[3];

	for (i=0 ; i<4 ; i++)
		cars_scra[i]=(struct s_CARS_DATA *)((char *)(0x1f800000+256*i));

	unpack_datas();
	flamebuff_init();
	memory_init();
	snd_init();
	make_back_tmd();

	if (strcmp(MEMORY_CARD_GET, "HoVeRRePlAy")==0)
		Gsys.replay_exist=1;
	else
		Gsys.replay_exist=0;
//DATA INIT
	srand(1);
	for ( i=0 ; i<1024 ; i++ )
		Gsys.rnd[i]=rand();
	for ( i=0 ; i<8 ; i++ )
	{
		VR.vx=rand() & 4095;
		VR.vy=rand() & 4095;
		VR.vz=rand() & 4095;
		VRa.vx=rand() & 511;
		VRa.vy=rand() & 511;
		VRa.vz=rand() & 511;
		for ( j=0 ; j<16 ; j++ )
		{
			RotMatrix( &VR, &MT );
			ApplyMatrixSV( &MT, &on, &Gsys.VCrashChip[i][j][0] );
			ApplyMatrixSV( &MT, &o1, &Gsys.VCrashChip[i][j][1] );
			ApplyMatrixSV( &MT, &o2, &Gsys.VCrashChip[i][j][2] );
			ApplyMatrixSV( &MT, &o3, &Gsys.VCrashChip[i][j][3] );
			_addVECTOR( &VR, VR, VRa );
		}
	}
	for (i=0 ; i<9*2 ; i++)
	{
		Gsys.best_lap_time[i]=10*60*60;
		best_data.used_car[i][0]=0+(1<<4)+(2<<8)+(3<<12)+(0<<16)+(1<<20);
		best_data.used_car[i][1]=0+(1<<4)+(2<<8)+(3<<12)+(0<<16)+(1<<20);
		for (j=0 ; j<6 ; j++)
		{
			best_data.best_lap[i][j]=10*60*60;
			best_data.total_lap[i][j]=10*60*60;
			str[0]=name[j][0]-'A';
			str[1]=name[j][1]-'A';
			str[2]=name[j][2]-'A';
			memcpy( best_data.best_name[i][j], str, 3 );
			memcpy( best_data.total_name[i][j], str, 3 );
		}
	}
//COORDINATE INIT
	GsInitCoordinate2( WORLD, &CRD_COURCE );
	CRD_COURCE.coord=GsIDMATRIX;
	CRD_COURCE.flg=0;

	GsInitCoordinate2( &CRD_COURCE, &CRD_VIEW );
	CRD_VIEW.coord=GsIDMATRIX;
	CRD_VIEW.flg=0;

//ViewSeting
	GsSetProjection(PROJECTION_LONG);
//	_setVECTOR( &VTmp, 0, 0, -6000 );
//	_setMATRIXsVECTOR( (&(Gsys.view.view)), VTmp );
//光源設定
	light.vx=0;
	light.vy=-256;
	light.vz=128;
	light.r=230;
	light.g=230;
	light.b=230;
	GsSetFlatLight(0, &light);
	GsSetAmbient( LIGHT_AMBIENT*3/4, LIGHT_AMBIENT*3/4, LIGHT_AMBIENT*3/4 );//周辺光
	GsSetLightMode( 1 );
//save_data
	save_data.card_head[0]='S';
	save_data.card_head[1]='C';
	save_data.card_head[2]=(1<<4)+1;
	save_data.card_head[3]=1;

	strcpy( n_replay_data.name,blank );
	strcpy( n_replay_data.player_name,blank2 );
}

void stop_sound()
{
	VSync(0);
	SsVabClose(Gsys.vab_se);			/* VABのクローズ */
	SsVabClose(Gsys.vab_bgm);			/* VABのクローズ */
	VSync(6);
}

void init_flamebuff()
{
	unsigned char buff[32*32*2], buff2[16*16*2];
	int x, y, u, l, xx, yy;
	RECT rect;
	VSync(2);
	for ( y=0 ; y<8 ; y++)
		for ( x=0 ; x<16 ; x++)
		{
			u=x/2+(y/4)*16;
			l=(x & 1)*4+(y & 3)+(y/4)*16;

			setRECT( &rect, ((u & 15)/4)*16+320, (u & 3)*32+(u/16)*128+256, 16,32 );
			StoreImage( &rect, (u_long *)buff );
			DrawSync(0);
			setRECT( &rect, ((l & 15)/4)*16+320, (l & 3)*32+(l/16)*128+256, 16,32 );
			StoreImage( &rect, (u_long *)(buff+32*32) );
			DrawSync(0);
			for ( yy=0 ; yy<16 ; yy++ )
				for ( xx=0 ; xx<16 ; xx++ )
					buff2[xx+yy*16]=buff[xx*2+yy*32*2];
			for ( yy=0 ; yy<16 ; yy++ )
				for ( xx=0 ; xx<16 ; xx++ )
					buff2[xx+yy*16+16*16]=buff[xx*2+yy*32*2+32*32];
			setRECT( &rect, x*8+320+128, y*32+256, 8,16 );
			LoadImage( &rect, (u_long *)buff2 );
			DrawSync(0);
			setRECT( &rect, x*8+320+128, y*32+256+16, 8,16 );
			LoadImage( &rect, (u_long *)(buff2+16*16) );
			DrawSync(0);
		}
}

void locate_data0()
{
	int i;
	unsigned int to_addr[5], org_addr[5], size[5];
	char *dt=DATA_HEAD;
	for( i=0 ; i<5 ; i++ )
	{
		to_addr[i]=DWORD(dt);
		org_addr[i]=((unsigned int)(dt+8));
		size[i]=DWORD(dt+4);
		dt+=((size[i]+8)+4) & (~3);
	}
	for( i=4 ; i>=0 ; i-- )
	{
		memmove( (char *)to_addr[i], (char *)org_addr[i], size[i] );
	}
}

void main()
{
	int re=0, sel, pdemo=0, imi=0;

//	int i=0;

//	for(i=0x801D8000 ; i<0x801F0000 ; i++ )
//		*((char *)i)=111;

	locate_data0();
	init_system();
	init_datas();
//	mcard_autoload();

	VSync( 0 );

	init_flamebuff();

	man_set();

	while( 1 )
	{
		if (pdemo==0)
		{
			gamedemo();
			pdemo=1;
			imi=0;
		}
		re=0;
		Gsys.replay_buff_sel=0;
		sel=title( imi );
		imi=1;
		if (sel==-1)
		{
			pdemo=0;
			continue;
		}
//HELP
		if (sel==2)
		{
			SeqPlay( "SAMPLE26.SEQ", 1 );
			online_help();
			SeqPlay( NULL, 0 );
		}
//EXIT
		if (sel==3)
			break;
//MEMORY CARD
		if (sel==20 || sel==21)
			while( memory_card( sel-20 ) );
		if (sel==22) ending();
//VIEW REPLAY
		if (sel==10)
		{
			if (n_replay_data.he!=('h'+('R'<<8)))
				error_message("リプレイデータがありません");
			else
			{
				re=-1;
				Gsys.entry_check=0;
				while( (re=game( re ))!=-1 );
			}
		}
//VIEW RECORDS
		if (sel==24 || sel==25)
			while( view_records( sel-24 ) );
//MUSIC MODE
		if (sel==11)
			music_mode();
		if (sel==7)//VS MODE
		{
			re=0;
			if ((*pd1)!=0)
			{
				error_message("２Ｐコントローラを挿してください");
			}
			else
			{
				while( re!=-1 )
				{
					Gsys.GameMode=3;
					SeqPlay( "SELECT.SEQ", 1 );
					Gsys.cource_number=-1;
					do
					{
						Gsys.mine=car_select( 1 );
						if (Gsys.mine==-1) break;
						Gsys.mine2=car_select( 2 );
						if (Gsys.mine2==-1) continue;
						Gsys.cource_number=cource_select( 0 );
					}
					while( Gsys.cource_number==-1 );
					SeqPlay( NULL, 0 );
					if (Gsys.mine==-1) break;
					Gsys.replay_mode=0;
					re=game( re );
				}
				if (Gsys.mine!=-1) imi=0;
			}
		}
		if (sel>=16 && sel<=18)
		{
			training( sel-16 );
			if (Gsys.auto_save)
			{
				draw_message(0,120-24,"AUTO SAVE");
				if (save( Gsys.auto_save>>1 )!=0)
				{
					Gsys.auto_save=0;
				}
			}
		}
		if (sel==5 || sel==19 || (sel>=12 && sel<=15)) //GameMode
		{
			if (sel==5) Gsys.GameMode=4;
			if (sel==19) Gsys.GameMode=2;
			if (sel==15) Gsys.GameMode=1;
			SeqPlay( "SELECT.SEQ", 1 );
			switch(sel)
			{
			case 5://TimeAttack
				Gsys.TimeMode=1;
				do
				{
					Gsys.mine=car_select( 0 );
					if (Gsys.mine==-1) break;
					Gsys.cource_number=cource_select( 0 );
				}
				while( Gsys.cource_number==-1 );
				break;
			case 15://PRACTICE(GP)
			case 19://FreeRun
				do
				{
					Gsys.mine=car_select( 0 );
					if (Gsys.mine==-1) break;
					Gsys.cource_number=cource_select( 0 );
				}
				while( Gsys.cource_number==-1 );
				Gsys.TimeMode=0;
				break;
			case 12://Grandprix
			case 13:
			case 14:
				Gsys.gran_laps[0]=60*60*10;
				Gsys.gran_laps[1]=60*60*10;
				Gsys.gran_laps[2]=60*60*10;
				Gsys.gran_laps[3]=60*60*10;
				Gsys.gran_laps[4]=60*60*10;
				Gsys.gran_laps[5]=60*60*10;
				Gsys.mine=car_select( 0 );
				Gsys.cource_number=(sel-12)*3;
				Gsys.GameMode=0;
				Gsys.TimeMode=0;
				Gsys.entry_plus=0;
				break;
			}
			SeqPlay( NULL, 0 );
			if (Gsys.mine==-1) continue;
			Gsys.replay_mode=0;
			re=0;
			while( re!=-1)
			{
				re=game( re );
				if (re==4 && (Gsys.cource_number % 3)==2)
				{
					ending();
					save_data.omake|=(1<<(Gsys.cource_number/3));
					grandprix_entry_mode( 3, 0 );
					pdemo=0;
					re=-1;
				}
			}
			if (Gsys.GameMode!=4) imi=0;
			if (Gsys.auto_save)
			{
				draw_message(0,120-24,"AUTO SAVE");
				if (save( Gsys.auto_save>>1 )!=0)
				{
					Gsys.auto_save=0;
				}
			}
		}
	}
	VSync(0);
	ResetGraph(1);
	DrawSync(0);
	VSync(0);
	stop_sound();
	_BOXFILL(0,0,1024,512,0,0,0);
	memorycard_put();
	VSync(10);
}
