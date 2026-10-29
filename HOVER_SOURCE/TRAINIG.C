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
extern struct s_TRAINING Trn;

extern volatile u_char *pd0, *pd1;

extern struct s_SYSTEM_DATA Gsys;
extern struct s_MAP_DATA *map_data;
extern struct s_BESTLAP_RECORD best_data;
extern struct s_REPLAY_HEAD replay_head[8], n_replay_data, n_replay_data_g;
extern char *cource_name[];
extern struct s_SYSTEM_SAVEDATA save_data;
extern GsDOBJ2 DOBJ_BACK[MAX_COURCE_PARTS*2];
extern GsCOORDINATE2 CRD_BACK[MAX_COURCE_PARTS*2];

void cource_init2( int stage )
{
	MATRIX MT;
	VECTOR VS={4096*2,4096*2,4096*2};
	u_long *cource_tmd=(u_long *)COURCETMD_ADDR;
	int i, k;
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
	int stage_type[]={0,1,2,3,4,0,1,2,3,4,0,1,2,3,4};
	Gsys.cource_tmd_addr=(char *)cource_tmd;
	Gsys.cource_type=stage_type[stage];
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
	i=stage_type[stage];
	if (Gsys.GameMode==3)
		FPARA[i].dqa*=2;
	GsSetFogParam( &FPARA[i] );
	GsSetFlatLight(0, &light[i]);
	GsSetFlatLight(1, &light[5]);
	GsSetFlatLight(2, &light[5]);
	Gsys.light=light[i];
	GsSetAmbient( ambi[i*4],ambi[i*4+1],ambi[i*4+2]);//Žü•ÓŒõ
	GsSetLightMode( ambi[i*4+3] );
	for ( i=0 ; i<6 ; i++ )
	{
		LZS_unpack_one( C_TIM_PAC, COURCETMD_ADDR, SIZE_COURCETMD, sfname[stage_type[stage]*6+i] );
		loadTim( (u_long *)COURCETMD_ADDR );
	}
	get_bgcolor();
	DrawSync(0);
	VSync(0);
	makemap( stage, 2 );
	MT=GsIDMATRIX;
	ScaleMatrix( &MT, &VS );
	Gsys.cource_tmd_num=DWORD(cource_tmd+2);
	k=DWORD(cource_tmd+2)/2;
	for (i=0 ; i<k ; i++ )
	{
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

void mini_map_tr( int stage )
{
	int active;
	SVECTOR VR;
	RECT rect;
	short int lng[]={
		10000,
		12000,
		12000,
		12000,
		10000,

		10000,
		12000,
		14000,
		16000,
		15000,

		12000,
		20000,
		18000,
		18000,
		25000
	};
	SetDispMask( 0 );
	DrawSync(0);
	VSync(0);
	GsDefDispBuff( 0,240,0,240 );
	GsSwapDispBuff();
	makemap( stage, 3 );
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
	CRD_BACK[0].coord.t[2]=lng[stage];
	CRD_BACK[0].flg=0;
	Gsys.map_scx=lng[stage]/PROJECTION_LONG;
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

void training( int sel )
{
	int stage=0, re,i;
	do
	{
		SeqPlay( "SELECT.SEQ", 1 );
		while( 1 )
		{
			re=training_select( sel, (stage % 5) );
			if (re==-1) break;
			stage=re;
			Gsys.mine=car_select( 0 );
			if (Gsys.mine==-1) continue;
			break;
		}
		SeqPlay( NULL, 0 );
		SsUtAllKeyOff(0);
		if (re==-1)
			break;
		VSync( 2 );
		DrawSync( 0 );
		mini_map_tr( stage );
		SeqPlay( "B.SEQ", 1 );
		cars_scra[0]->windVoice=SsUtKeyOn( Gsys.vab_se, SND_WIND, 0, 8, 0, 0, 0 );
		cars_scra[0]->boostLVoice=SsUtKeyOn( Gsys.vab_se, SND_WIND, 0, BOOST_TONE, 0,0,0 );
		cars_scra[0]->boostRVoice=SsUtKeyOn( Gsys.vab_se, SND_WIND, 0, BOOST_TONE, 0,0,0 );
		cars_scra[0]->boostBVoice=SsUtKeyOn( Gsys.vab_se, SND_WIND, 0, BOOST_TONE, 0,0,0 );
		while( (re=game_tr( stage ))==1 );
		SeqPlay( NULL, 0 );
		SsUtAllKeyOff(0);
		cars_scra[0]->windVoice=-1;
		cars_scra[0]->wallVoice=-1;
		cars_scra[0]->boostLVoice=-1;
		cars_scra[0]->boostRVoice=-1;
		cars_scra[0]->boostBVoice=-1;
	}
	while( re!=0 );
	for (i=0 ; i<15 ; i++)
		if ((save_data.training[i] & 31)!=31) break;
	if (i==15) save_data.omake|=(1<<3);
}

void start_count_tr( GsOT *ot, int ot_length )
{
	int i, j;
	SVECTOR VX={0,0,0};
	static int voice_beep=-1;

	Gsys.start_count--;
	i=Gsys.start_count/60;
	if (i<4)
	{
		j=Gsys.start_count % 60;
		if (i==0)
		{
			if (voice_beep!=-1)
				SsUtKeyOff( voice_beep, Gsys.vab_se, SND_BEEP, 0, 20 );
		}
		if (j==0 && i)
		{
			if (i<2) SsUtKeyOff( voice_beep, Gsys.vab_se, SND_BEEP, 0, 20 );
			voice_beep=SsUtKeyOn( Gsys.vab_se, SND_BEEP, 0, 20, 0, 127, 127 );
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

int training_select( int lev, int ini_sel )
{
	char *stage_name[][18]={
		{
			"ƒXƒ‰ƒXƒ^[‚Ì‚Ý‚Åˆê‰ñ“]‚¹‚æ","","§ŒÀŽžŠÔ‚U‚O•b",
			"ƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚P‚Q•b",
			"ƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚P‚Q•b",
			"•Ç‚É“–‚½‚ç‚¸ƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚P‚W•b",
			"ƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚P‚W•b",
		},
		{
			"‚P‚W‚O‚j‚^‚ˆˆÈã‚ðˆÛŽ‚µ","•Ç‚É“–‚½‚ç‚¸ƒS[ƒ‹‚¹‚æ","§ŒÀŽžŠÔ‚P‚T•b",
			"Ô‚¢°‚ð”ð‚¯‚ÄƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚P‚U•b",
			"‚Q‚O‚O‚j‚^‚ˆˆÈ‰º‚É—Ž‚Æ‚·‚È","","§ŒÀŽžŠÔ‚Q‚O•b",
			"•Ç‚É“–‚½‚ç‚¸‚PˆÊ‚ÅƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚Q‚T•b",
			"•Ç‚É“–‚½‚ç‚¸ƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚Q‚O•b"
		},
		{
			"ƒm[ƒ_ƒ[ƒW‚ÅA‚PˆÊ‚ÅƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚P‚Q•b",
			"‚PˆÊ‚ÅƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚Q‚V•b",
			"ƒm[ƒ_ƒ[ƒW‚ÅƒS[ƒ‹‚¹‚æ","","§ŒÀŽžŠÔ‚P‚W•b",
			"‚Q‚R‚O‚j‚^‚ˆˆÈ‰º‚É—Ž‚Æ‚·‚È","","§ŒÀŽžŠÔ‚Q‚T•b",
			"•Ç‚É“–‚½‚ç‚¸‚PˆÊ‚ðŽç‚ê","","§ŒÀŽžŠÔ‚R‚R•b"
		}
	};
	int x=0, active, pdd, pd=0xffffffff, sel=0, mu=0;
	int change=16, i;
	char tmp[8];

	sel=ini_sel;

	_BOXFILL( 0,0,320,480,0,0,0 );
	_BOXFILL( 448,0,256,256,0,0,0 );
	VSync( 0 );
	alphabet16( 448+128, 0, "TRAINING MODE" );
	japanese( 448+128, 16, "£", 3 );
	japanese( 448+128, 32, "£", 3 );
	sprintf(tmp,"%d-%d", lev+1, sel+1);
	japanese( 448+128, 256-16, tmp, 3 );
	_BOXFILL( 448+128,48,128,48,0,0,0 );
	japanese( 448+128, 16+32, stage_name[lev][sel*3], 3 );
	japanese( 448+128, 32+32, stage_name[lev][sel*3+1], 3 );
	japanese( 448+128, 48+32, stage_name[lev][sel*3+2], 3 );

	while( 1 )
	{
		pdd=pd;
		active=GsGetActiveBuff();
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		pd=padd(pd0);
		if (pd==(PADR1 | PADR2 | PADL1 | PADL2 | PADRup))
			for (i=0 ; i<16 ; i++)
				save_data.training[i]=0;
		if (change)
		{
			change--;
			if (change<16) x=change;
			if (change>16) x=32-change;
			if (change==16)
			{
				sel+=mu;
				_BOXFILL( 448+128,48,128,48,0,0,0 );
				japanese( 448+128, 16+32, stage_name[lev][sel*3], 3 );
				japanese( 448+128, 32+32, stage_name[lev][sel*3+1], 3 );
				japanese( 448+128, 48+32, stage_name[lev][sel*3+2], 3 );
			}
		}
		else
		{
			x=0;
		}
		if (sel!=0 && change==0)
			draw_words_ot16(&Wot[active],-160,0,1,1,-90,0x008080);
		if (sel!=4 && change==0)
			draw_words_ot16(&Wot[active],160,0,2,2,90,0x008080);
		draw_words_ot16(&Wot[active],-128-16,-32-16-16,3,16-1,4096,0x808080);
		draw_words_ot16(&Wot[active],-128-x*16,-32-16+4,16,3,4096,0x808080);
		draw_words_ot16(&Wot[active],-128-x*16,-32-16+4+24,16,4,4096,0x808080);
		draw_words_ot16(&Wot[active],x*16,32,16,5,4096,0x808080);
		draw_words_ot16(&Wot[active],-160+16,-120+16,16,0,4096,0x800080);
		for (i=0 ; i<5 ; i++)
		{
			if ((save_data.training[lev*5+sel]>>i) & 1)
				draw_minicar(&Wot[active],-160+16+8+i*32+16-x*16,64,i,4096);
		}
		if ((pdd & PADRdown)==0 && (pd & PADRdown))
		{
			pcm( SND_CANCEL );
			sel=-1;
			break;
		}
		if ((pdd & PADRright)==0 && (pd & PADRright))
		{
			pcm( SND_OK );
			break;
		}
		if ((pdd & PADLright)==0 && (pd & PADLright) && sel!=4 && change==0)
		{
			sprintf(tmp,"%d-%d", lev+1, sel+2);
			japanese( 448+128, 256-16, tmp, 3 );
			change=32;
			mu=1;
			pcm( SND_CHANGE );
		}
		if ((pdd & PADLleft)==0 && (pd & PADLleft) && sel!=0 && change==0)
		{
			sprintf(tmp,"%d-%d", lev+1, sel);
			japanese( 448+128, 256-16, tmp, 3 );
			change=32;
			mu=-1;
			pcm( SND_CHANGE );
		}
		DrawSync(0);
		VSync(0);

		GsSwapDispBuff();
		GsSortClear( 0,0,0,&Wot[active] );
		GsDrawOt( &Wot[active] );
	}
	if (sel!=-1) sel+=lev*5;
	while( padd(pd0) );
	return( sel );
}

void game_init2_tr( int stage )
{
	int i, x, y;
	int finish_rank;
	SVECTOR SVZ={0,0,0};
	int v0, v1, v2, v3;

	Gsys.replaying=0;
	Gsys.replay_timming=0;
//	SsUtAllKeyOff(0);
	for ( y=0 ; y<4 ; y++ )
		for ( x=0 ; x<4 ; x++ )
			Gsys.cars_distance[x][y]=1024;
	if (stage<=4)
	{
		Gsys.enemy_number=0;
		Gsys.cars_number=1;
	}
	else
	{
		Gsys.enemy_number=3;
		Gsys.cars_number=4;
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
//Def TMD
	make_chip_tmd( Gsys.mine );
	crd_set( &CRD_CHIP, GsIDMATRIX, &CRD_COURCE );
	obj_set( &DOBJ_CHIP, &CRD_CHIP, (u_long *)DIVIDE_CAR_ADDR, 0, 0 );
	for (i=0 ; i<4 ; i++)
	{
		cars_scra[i]->warnVoice=-1;
		cars_scra[i]->damageVoice=-1;
		finish_rank=cars_scra[i]->finish_rank;
		v0=cars_scra[0]->windVoice;
		v1=cars_scra[0]->boostLVoice;
		v2=cars_scra[0]->boostRVoice;
		v3=cars_scra[0]->boostBVoice;
		memset((u_char *)cars_scra[i],0,sizeof(struct s_CARS_DATA));
		cars_scra[0]->windVoice=v0;
		cars_scra[0]->boostLVoice=v1;
		cars_scra[0]->boostRVoice=v2;
		cars_scra[0]->boostBVoice=v3;

		cars_scra[i]->effect=0;
		cars_scra[i]->lap=0;
		cars_scra[i]->last_lap=1;
		Gsys.viewR[i].super=&CRD_COURCE;
		Gsys.view[i].super=&CRD_COURCE;
		cars_scra[i]->tei=100;
		cars_scra[i]->timming=0;
		cars_scra[i]->boost_tone=BOOST_TONE;
	}
}

void game_init_tr( int stage )
{
	VECTOR COUNT={-500*2,-200*2,3000*2}, FINISH={-2400+300,0,8000},FINISH2={-1200+300,0,8000};
	char *m_finish="COMPLETEMISS";
	u_long *addr;
	int i, j, n;
	int lev[15]={
		1, 1, 2, 3, 4,
		5, 4, 10, 2, 4,
		4, 9, 7, 10, 6
	};
	MATRIX MT=GsIDMATRIX;
	VECTOR VZ[]={
	 {1000,0,0}, {2500,0,3000}, {1000,0,6000}, {2500,0,9000},
	 {1000,0,-60000}, {2500,0,-80000}, {1000,0,-83000}, {2500,0,-86000},
	};

	game_init2_tr( stage );
	if (stage==14 && Gsys.mine==4) VZ[4].vz=20000;
	car_init( 0, 0x1, Gsys.mine, 0, &CRD_COURCE, 0 );
	cource_init2( stage );
	for (i=0,j=0 ; i<4 && j<3 ; i++ )
	{
		if (i==Gsys.mine) continue;
		j++;
		n=lev[stage];
		car_init( j, 0x1, i, n, &CRD_COURCE, 0 );
	}
	for (i=0 ; i<4 ; i++ )
		if (Trn.minimum_rank==4)
			car_position( i, &VZ[i], 0 );
		else
			car_position( i, &VZ[i+4], 0 );
	GsSetProjection(PROJECTION_LONG);
	sort_position( 0 );
	for (i=0 ; i<3 ; i++ )
	{
		_setMATRIXsVECTOR(&MT,COUNT);
		addr=alphabet_addr( "123"[i], &n );
		crd_set(&CRD_ALPHABET[i],MT,WORLD);
		obj_set(&DOBJ_ALPHABET[i],&CRD_ALPHABET[i],addr,n,0);
	}
	for (i=0 ; i<8 ; i++ )
	{
		_setMATRIXsVECTOR(&MT,FINISH);
		addr=alphabet_addr( m_finish[i], &n );
		crd_set(&CRD_ALPHABET[3+i],MT,WORLD);
		obj_set(&DOBJ_ALPHABET[3+i],&CRD_ALPHABET[3+i],addr,n,0);
		FINISH.vx+=600;
	}
	for (i=0 ; i<4 ; i++ )
	{
		_setMATRIXsVECTOR(&MT,FINISH2);
		addr=alphabet_addr( m_finish[i+8], &n );
		crd_set(&CRD_ALPHABET[11+i],MT,WORLD);
		obj_set(&DOBJ_ALPHABET[11+i],&CRD_ALPHABET[11+i],addr,n,0);
		FINISH2.vx+=600;
	}
	Gsys.replay_timming=0;
	Gsys.start_count=300;
	cars_scra[0]->lap_time[3]=0;
	Gsys.total_time=0;
	crd_set(&CRD_BACK_SPRITE,GsIDMATRIX,&CRD_COURCE);
	obj_set(&DOBJ_BACK_SPRITE,&CRD_BACK_SPRITE,(u_long *)BACKTMD_ADDR,0,0);
}

void goal_count_tr( GsOT *ot, int ot_length )
{
	int i, ma, f;
	static SVECTOR VX[12];

	if (Gsys.goal_count==1)
		memset( (char *)&VX, 0, sizeof(SVECTOR)*12 );

	ma=Gsys.goal_count>>3;

	f=(2-Trn.complete);
	if (f==2) f=1;
	for ( i=3 ; i<ma+3 && i<3+4*f+4 ; i++ )
	{
		if (CRD_ALPHABET[i+(1-f)*8].coord.t[2]>6000)
		{
			VX[i-3].vy+=4096/((4000-3000)/200);
			CRD_ALPHABET[i+(1-f)*8].coord.t[2]-=200;
			RotMatrix( &VX[i-3], &CRD_ALPHABET[i+(1-f)*8].coord );
		}
		_DrawObjectNAMA( ot, ot_length, DOBJ_ALPHABET[i+(1-f)*8] );
	}
}

void draw_time_tr( GsOT *ot, int ot_length )
{
	GsSPRITE sp={ 0<<24, 0,0, 0,16, (320>>6),
			 0,0, 0,497, 128,128,128, 0,0, 4096, 4096, 0 };
	int t;
	sp.attribute=0;
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.cy=487;
	sp.x=64+8, sp.y=-120+8;
	sp.w=4*8;
	sp.h=8;
	sp.u=64+4*8, sp.v=24+128;
	GsSortFastSprite( &sp, ot, 0 );
//TOTAL TIME
	sp.attribute=0<<24;
	t=(Trn.time+59)/60;
	sp.tpage=_GetTPage(0,0,576,256 );
	sp.x=64+32-8, sp.y=16-120;
	sp.w=16;
	sp.h=16;
	sp.u = ((t%10) & 7)*16;
	sp.v = ((t%10) / 8)*16+128;
	GsSortFastSprite( &sp, ot, 0 );
	sp.x-=16;
	t/=10;
	sp.y=16-120;
	sp.w=16;
	sp.h=16;
	sp.u = ((t%10) & 7)*16;
	sp.v = ((t%10) / 8)*16+128;
	GsSortFastSprite( &sp, ot, 0 );
/*	sp.x-=16;
	t/=10;
	sp.y=16-120;
	sp.w=16;
	sp.h=16;
	sp.u = ((t%10) & 7)*16;
	sp.v = ((t%10) / 8)*16+128;
	GsSortFastSprite( &sp, ot, 0 );
	sp.x-=16;
*/
}

void front_draw_tr( GsOT *ot, int ot_length, int stage )
{
	draw_speed( ot, ot_length, (cars_scra[0]->speed>>1),0 );
	if (stage>=5) draw_position( ot, ot_length, 0, 0 );
	draw_damage( ot, ot_length, 0, 0 );
	draw_time_tr( ot, ot_length );
	draw_map( ot, ot_length, 0, -32 );
}

int game_draw_tr( GsOT *ot, int active, int stage )
{
	int i, l;
	MATRIX MT;
	if (cars_scra[0]->over)
	{
		if ((cars_scra[0]->over<=120 && cars_scra[0]->over>0)
		 || (cars_scra[0]->over>=-120 && cars_scra[0]->over<0))
			return( 2 );
	}
	if (Gsys.goal_count)
	{
		if (Trn.onest && Gsys.goal_count==1 && cars_scra[0]->finish_rank!=0)
			Trn.complete=2;
		if (Trn.complete==2)
			view_set( 1+16 );
		if (Gsys.goal_count>=(60*2))
			return( 2 );
		else
			goal_count_tr( ot, 4 );
		Gsys.goal_count++;
	}
	else
	{
		if (cars_scra[0]->over>=0) view_set( 0 );
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
		start_count_tr( ot, 4 );
		if (Gsys.start_count>=60*3)
			draw_words_ot16(ot,-160+16,-8,16,0,4096,0x808080);
	}
	car_draw( &Wot_CAR[active<<2], OT_LENGTH_CAR );
	back_draw( ot, OT_LENGTH );
	if (cars_scra[0]->over>64)
	{
		draw_bomb( &Wot_CAR[(active<<2)], 0, cars_scra[0]->over );
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
	if (Gsys.goal_count<=(60*3-3) && cars_scra[0]->over==0)
		front_draw_tr( ot, OT_LENGTH, stage );
	for (i=0 ; i<Gsys.cars_number ; i++)
		if (cars_scra[i]->draw)
			GsSortOt( &Wot_CAR[(active<<2)+i], ot );
	return(0);
}

int game_end_tr( int stage, int endd )
{
	warning( 1, 0 );
	if (Gsys.effectVoice!=-1)
	{
		SsUtKeyOff( Gsys.effectVoice, Gsys.vab_se, SND_BOMB, 0, Gsys.etone );
		Gsys.effectVoice=-1;
	}
	if (cars_scra[0]->damageVoice!=-1)
	{
		SsUtKeyOff( cars_scra[0]->damageVoice, Gsys.vab_se, SND_DAMAGE, 0, 90 );
		cars_scra[0]->damageVoice=-1;
	}
	SsUtSetVVol( cars_scra[0]->windVoice, 0,0 );
	SsUtSetVVol( cars_scra[0]->boostBVoice, 0,0 );
	SsUtSetVVol( cars_scra[0]->boostRVoice, 0,0 );
	SsUtSetVVol( cars_scra[0]->boostLVoice, 0,0 );
	if (Trn.complete==1)
	{
		save_data.training[stage]|=1<<Gsys.mine;
	}
	if (Trn.complete==1 || endd==0) return(2);
	return( 1 );
}

int training_check()
{
	static int las_y=0;
	if (Gsys.start_count) return(0);
	if (Trn.time) Trn.time--;
	if (Trn.damage && cars_scra[0]->damage) return(2);
	if (Trn.minimum_speed>cars_scra[0]->speed) return(2);
	if (Trn.time==0) return(2);
	if (Trn.minimum_rank<cars_scra[0]->rank) return(2);
	if (Trn.wall && Trn.wall_ch) return(2);
	if (Trn.turn)
	{
		if ((cars_scra[0]->status.vy>2048 && las_y<-2048) ||
		 (cars_scra[0]->status.vy<-2048 && las_y>2048)) return(1);
		las_y=cars_scra[0]->status.vy;
	}
	if (Trn.forb_b==2 || Trn.forb_r==2) return(2);
	return(0);
}

void training_set( int stage )
{
	char limit[]={
	60,12,12,18,18,
	15,16,20,25,20,
	12,27,18,25,33
	};

	Trn.minimum_rank=4;
	Trn.max_speed=0;
	Trn.minimum_speed=-500;
	Trn.damage=0;
	Trn.speed=0;
	Trn.time=60*limit[stage];
	Trn.jump=0;
	Trn.complete=0;
	Trn.onest=0;
	Trn.wall_ch=0;
	Trn.stop[0]=0;
	Trn.stop[1]=0;
	Trn.stop[2]=0;
	Trn.stop[3]=0;
	Trn.wall=0;
	Trn.forb_b=0;
	Trn.forb_r=0;
	Trn.turn=0;
	switch( stage )
	{
	case 0:
		Trn.forb_r=1;
		Trn.turn=1;
		break;
	case 3:
		Trn.wall=1;
		break;
	case 5:
		Trn.minimum_speed=180*2;
		Trn.wall=1;
		break;
	case 7:
		Trn.minimum_speed=200*2;
		break;
	case 8:
		Trn.wall=1;
		Trn.onest=1;
		break;
	case 9:
		Trn.wall=1;
		break;
	case 10:
		Trn.damage=1;
		Trn.onest=1;
		break;
	case 11:
		Trn.onest=1;
		break;
	case 12:
		Trn.damage=1;
		break;
	case 13:
		Trn.minimum_speed=230*2;
		break;
	case 14:
		Trn.minimum_rank=0;
		Trn.wall=1;
		break;
	}
}

//endd	0..exit
//		1..re_play
int game_tr( int stage )
{
	int pdd=0, pd=0;
	int active, i, endd=0;
	char tmp[64];

	Gsys.GameMode=0;

	Gsys.replay_mode=0;
	training_set( stage );
	game_init_tr( stage );
	sprintf(tmp, "TRAINING %d-%d ",(stage/5)+1, (stage % 5)+1);
	alphabet16( 576, 0, tmp );

	while( 1 )
	{
		if (Gsys.goal_count==0 && (Trn.complete=training_check()))
			Gsys.goal_count=1;
		if (Gsys.goal_count && Trn.complete==0)
		{
			if (Trn.onest==1 && cars_scra[0]->rank!=0)
				Trn.complete=2;
			else
				Trn.complete=1;
		}
		if (cars_scra[0]->over)
		{
			Gsys.goal_count=0;
			if (cars_scra[0]->over>0)
			{
				cars_scra[0]->over--;
				if (cars_scra[0]->over==1)
				{
					endd=1;
					break;
				}
			}
			else
			{
				cars_scra[0]->over++;
				if (cars_scra[0]->over==-1)
				{
					endd=1;
					break;
				}
			}
			pd=0;
		}
		car_preope( Gsys.cars_number );
		cars_distance_set();
		if (Gsys.start_count==0)
		{
			if (Gsys.goal_count)
			{
				if (Trn.complete<=1)
					cars_scra[0]->lev=10;
				car_enemy( 0, 0xffffffff );
				SsUtSetVVol( cars_scra[0]->boostBVoice, 0,0 );
				SsUtSetVVol( cars_scra[0]->boostRVoice, 0,0 );
				SsUtSetVVol( cars_scra[0]->boostLVoice, 0,0 );
			}
			else
			{
				cars_scra[0]->lev=0;
				car_action(0, pd);
				Gsys.total_time++;
			}
			for (i=1 ; i<Gsys.cars_number ; i++)
			{
				if (Trn.stop[i]==0)
					car_enemy( i, 0xffffffff );
				else
					car_enemy( i, 0 );
			}
			Gsys.time++;
			cars_scra[0]->time++;
		}
		else
		{
			if (stage==5 || stage==7 || stage==13 || stage==14)
			{
				for (i=0 ; i<Gsys.cars_number ; i++)
				{
					cars_scra[0]->lev=1;
					car_enemy( i, 0xffffffff );
					cars_scra[0]->damage=0;
					Gsys.time++;
				}
			}
		}
		
		active=GsGetActiveBuff();
		if (pd & PADstart && (pdd & PADstart)==0)
		{
			endd=pause( active );
			if (endd==1 || endd==2)
			{
				endd=2-endd;
				break;
			}
			active=GsGetActiveBuff();
		}
		GsSetWorkBase( packet[active] );
		GsClearOt( 0, 0, &Wot[active] );
		if (game_draw_tr( &Wot[active], active, stage ))
		{
			endd=1;
			break;
		}
		DrawSync(0);
		VSync(0);
		pdd=pd;
		pd=_padd(pd0);
		GsSwapDispBuff();
		GsDrawOt( &Wot[active] );
	}
	Trn.time=0;
	return( game_end_tr( stage, endd ) );
}
