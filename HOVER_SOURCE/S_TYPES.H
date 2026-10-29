struct s_SYSTEM_DATA {
	int vlong;
	int ana0, ana1;
	int cource_tmd_num;
	int cource_number;
	int cource_type;
	char *cource_tmd_addr;
	int vab_se, SsVoice;
	int vab_bgm, BgmVoice;
	int time, fbest_lap;
	int timming;
	int total_time;
	int best_lap_time[16];
	int cars_number;
	int cource_tnum_div;
	char cars_pos[4];
	int best_draw;
	int cars_distance[4][4];
	int wrong_time;
	int start_count;
	int goal_count;
	int seq;
	int rec_point, rec_last, rec_p2;
	int total_ghost, rec_last_g, rec_p2_g;
	int replaying;
	int replay_view_remain;
	int replay_view_mode;
	int replay_view_now_on;
	int replay_timming;
	int replay_mode;
	int view_now_on;
	u_char bg_r, bg_g, bg_b;
	u_char bg_r2, bg_g2, bg_b2;
	int GameMode;
	int enemy_number;
	char player_name[3];
	int entry_check;
	int cosd[720], sind[720];
	int cosd2[2048], sind2[2048];
	int tand[2048];
	short int rnd[1024];
	VECTOR CHIP_V[64];
	SVECTOR CHIP_AV[64];
	short int chip_rot[64], chip_rot_t[64];
	char chip_delete_timming[64];
	int chip_point;
	int crash_player;
	SVECTOR VCrashChip[8][16][4];
	int effectVoice;
	int etone;
	int mine, mine2;
	int auto_save;
	int BackRotX, BackRotY, BackRotZ;
	int BackTan;
	int map_cx, map_cy, map_scx;
	int draw_player;
	int front_mode;
	int rec_rpl;
	int bestline, totalline;
	int gran_laps[8];
	int TimeMode;
	GsVIEW2 view[4];
	GsRVIEW2 viewR[4];
	SVECTOR vrot[4];
	int replay_buff_sel;
	int ending;
	GsF_LIGHT light;
	int replay_exist, slot;
	char entry_plus;
	char view_type;
};

struct s_CARS_DATA {
	VECTOR pos, posr;//機体位置
	VECTOR npos, nposr;
	VECTOR inertia_forward, inertia_back;//慣性
	SVECTOR status, statusb, statusk;//機体回転度
	SVECTOR *VP;//プレート上の点ベクトル
	SVECTOR *VP2;//プレート上の点ベクトル
	SVECTOR *VN;//プレート上の法線ベクトル
	unsigned int lap_time[4];
	int time;
	int timming;
	int over;
	int line_position, before_line_position;
	int last_goal;
	int damage;

	short int boost_timming, boost_timming2;
	short int view_long;
	short int turbo;
	short int resi0, resi1, brek;
	short int per_rot, per_rot2;
	short int side_boost;
	short int max_speed;
	short int boost_tone;
	short int effect_time;
	short int weight;
	short int lap_draw;
	short int speed;//機体速度
	short int radder_rot;//ラダー回転度
	unsigned short int r_distans, l_distans;
	unsigned short int damage_max;
	unsigned short int now_chip;//乗ってるチップ番号

	char accer;//敵イカサマ用
	char draw;
	char attribute;//1..1表示、0非表示 2..自動操縦 4..ikasama
	char grip;
	char now_chip_x, now_chip_y;
	char breaking, breaking2;
	char rhit, lhit;
	char last;
	char lev;
	char cource_out;
	char effect;
	char tei;
	char windVoice, boostBVoice, boostRVoice, boostLVoice, wallVoice;
	char damageVoice, warnVoice;

	unsigned char rank;
	unsigned char now_on;//乗ってるプレート番号
	unsigned char lap, last_lap, finish_rank;
	unsigned char car_type;
	unsigned char boost_wr;
};

struct s_MAP_DATA {
	int attribute;
	int tmd_num;
	int pat;
	VECTOR center;
	VECTOR Va[4];
	int bills[8];
	int xdiv, ydiv;
	int next;
	int before;
	int write_f;
	int write_b;
	int tmd_put[8];
};

struct s_BESTLAP_RECORD {
	unsigned int used_car[18][2];
	unsigned short int best_lap[18][6];
	unsigned short int total_lap[18][6];
	char best_name[18][6][3];
	char total_name[18][6][3];
	char a[56];
//10flame
};

struct s_CAR_PROPATIE {
	SVECTOR CENTER, RADDER_L, RADDER_R;
	SVECTOR BOOSTER_L1, BOOSTER_L2, BOOSTER_R1, BOOSTER_R2;
	SVECTOR BOOSTER_BL, BOOSTER_BR;
	short int size, hight, weight;
	short int per_accer0, per_accer1;
	short int turbo0, turbo1;
	unsigned int tanc;
	short int side_boost;
	short int resi1, brek, per_rot, per_rot2;
	u_long *tmd_addr;
};

struct s_REPLAY_HEAD {
	short int he;
	char car;
	char cource;
	short int flame_size;
	short int data_size;
	int play_time;
	int c_sam;//plus_all
	char name[16];
	char player_name[8];
	int gamemode;
	int total_time;
	int ichi;
	int level;
	char reserv[80-4-4];
};

struct s_SYSTEM_SAVEDATA {
	unsigned char card_head[96];
	unsigned char tim_clut[32];
	unsigned char tim_data[128];
	unsigned char auto_load_save;// 0bit..autoload 1bit..autosave
	char user_name[3];
	char replay_file[8];
	int last_msize;
	int omake;
	int sam;
	int level;
	char training[16];
	char reserv2[100-16];
//3flame
};

struct s_TRAINING {
	int max_speed;
	int minimum_speed;
	short int time;
	char complete;
	char onest;
	char damage;
	char speed;
	char turn;
	char jump;
	char minimum_rank;
	char stop[4];
	char wall_ch;
	char wall;
	char forb_b;
	char forb_r;
};
