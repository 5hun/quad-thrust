// <Hover Racing> 1997.4.23
// GP1.h
#include <libps.h>
#include <stdio.h>
#include <rand.h>
#include <memory.h>
#include "macro.h"
#include "s_types.h"
#include "PAD.H"
#include "LZS.H"

#define D_ROTATION
//#define printf ;//

#define M_PI		3.14159265358979323846

#define DWORD(x) (*((unsigned int *)(x)))
#define WORD(x) (*((unsigned short int *)(x)))
#define S_DWORD(x) (*(signed long *)(x))
#define S_WORD(x) (*((signed short int *)((char *)(x))))

#define OT_LENGTH_CAR 10
#define OT_LENGTH_BACK 2
#define NUMBER_BTMD 6
#define NUMBER_SEARCHLIGHT 5
//#define TITLE 1

//#define OMAKE

#define NUMBER_COURCE 4
#define MAX_CHIP 64

#define OT_LENGTH 12
#define PACKET_MAX 2300

#define MAX_CAR_NUM 4
#define MAX_BILLS 32
#define MAX_COURCE_PARTS 48

//#define PROJECTION_LONG 580
#define PROJECTION_LONG 320

#define MEMORY_CARD_PUT ((char *)0x800FC000)
#define MEMORY_CARD_GET ((char *)0x800FE000)
#define C_TIM_PAC ((char *)0x80100000)
#define DATA_HEAD ((char *)0x80100000)

#define SE_VH ((char *)0x80160000)
#define BGM_VH ((char *)0x80162100)

#define CARTMD_XVN_ADDR ((char *)0x80164000)
#define CARTMD_PVN_ADDR ((char *)0x80166000)
#define CARTMD_SVS_ADDR ((char *)0x80168000)
#define CARTMD_AAA_ADDR ((char *)0x8016A000)
#define CARTMD_XXX_ADDR ((char *)0x8016C000)
#define OTHER_TMD_ADDR ((char *)0x8016E000)
#define APHA_TMD_A_O_ADDR ((char *)0x80170000)
#define APHA_TMD_P_O_ADDR ((char *)0x80174000)
#define APHA_TMD_0_9_ADDR ((char *)0x80178000)
#define BACKTMD_ADDR ((char *)0x80180000)
#define DIVIDE_CAR_ADDR ((char *)0x80184000)

#define SEQ0_ADDR ((char *)0x80188000)
#define COURCETMD_ADDR ((char *)0x80190000)
#define COURCE_DATA_ADDR ((char *)0x801C8000)
#define COURCE_PAT_ADDR (COURCE_DATA_ADDR+sizeof(struct s_MAP_DATA)*MAX_COURCE_PARTS)
#define REPLAY_DATA ((unsigned short int *)((char *)0x801D0000))
#define REPLAY_DATA_G ((unsigned short int *)((char *)0x801D2000))
#define REPLAY_BUFF ((unsigned short int *)((char *)0x801D4000))
#define PACKED_WORK_ADDR ((char *)0x801D8000)
#define REPLAY_SIZE 0x2000
#define YMAN_TMD_ADDR ((char *)0x8015C000)

#define SIZE_SE_VH 0x2100
#define SIZE_BGM_VH 0x1F00
#define SIZE_BGM_VB 0x40000
#define SIZE_CARTMD_XVN 0x2000
#define SIZE_CARTMD_PVN 0x2000
#define SIZE_CARTMD_SVS 0x2000
#define SIZE_CARTMD_AAA 0x2000
#define SIZE_CARTMD_XXX 0x2000
#define SIZE_APHA_TMD_A_O 0x4000
#define SIZE_APHA_TMD_P_O 0x4000
#define SIZE_APHA_TMD_0_9 0x6000
#define SIZE_COUNTTMD 0x2000
#define SIZE_OTHERTMD 0x2000
#define SIZE_SEQ0 0x8000
#define SIZE_COURCETMD 0x38000
#define SIZE_COURCE_DATA 0x8000
#define SIZE_YMAN_TMD 0x4000

#define U_CoTIM ((char *)0x800F4000)
#define U_TIM_TMDoPAC ((char *)0x80170000)
#define U_SCRIPToPAC ((char *)0x80180000)
#define U_SEQ_VHoPAC ((char *)0x80188000)
#define U_BGMoVB_ ((char *)0x801A0000)

#define SIZE_TIM_TMDoPAC 0x20000

#define BILLS_VECTOR (VECTOR *)(COURCE_PAT_ADDR+32*16*32)
#define BILLS_DATA (int *)(BILLS_VECTOR+32)

#define SND_BEEP 64
#define SND_WIND 65
#define SND_BOOST 66
#define SND_WALL 67
#define SND_BOMB 68
#define SND_POWUP 69
#define SND_WARN 70
#define SND_DAMAGE 71
#define BOOST_TONE 20
#define SND_OK 72
#define SND_CHANGE 73
#define SND_CANCEL 74

#define SIDE_HIGHT 100

#define LIGHT_AMBIENT (4096/2)

#define INERTIA_KETA 4
#define INERTIA_KETA2 2
#define POS_KETA 2
#define BOOST_LEV 150

#define BOOST_R1 0
#define BOOST_L1 1
#define BOOST_R2 2
#define BOOST_L2 3

#define JIS_TOP_X (320+256)
#define JIS_TOP_Y (0)

//#define PER_RESIST0 800
#define PER_RESIST0 800
#define PER_RESIST1 3
#define PER_BREAK 8

//GP1_MAIN.C	MAIN PROGRAM
void init_system();
void memory_init();
void init_datas();
void stop_sound();
void SeqPlay( char *name, int play_switch );

//LIB.C
unsigned short int padd( volatile u_char *bb );
unsigned char analog( volatile u_char *bb, int port );
void obj_set( GsDOBJ2 *obj, GsCOORDINATE2 *crd2, u_long *tmd_addr, int num, int attribute );
void crd_set( GsCOORDINATE2 *coord2, MATRIX mat, GsCOORDINATE2 *super );
void loadTim( u_long *addr );
int sqr_i( int max, int a );

//GAME.C		GAME PROGRAM
void view_set();
int game( int mode );
void game_init( int mode, int last_mode );
int gamedemo();
void rank_draw( GsOT *ot, int ot_length );
void add_crash_chip( VECTOR V, SVECTOR VN, int wi, int addnum, int mode, int n );
void back_draw( GsOT *ot, int ot_length );
void ending();
void grandprix_entry_mode( int stg, int mode );
int pause( int active );
int game_draw( GsOT *ot, int active );
void make_chip_tmd( int n );
void sort_position( int p );
int sel_continue( GsOT *ot, int ot_length, int timm, int mode );
void goal_count( GsOT *ot, int ot_length );
void crash_chip( GsOT *ot, int ot_length );
void start_count( GsOT *ot, int ot_length );

//CAR_CTR.C		CAR CONTROL FUNCTION
void car_init( int n, int attribute, int car_type, int turn_max_speed, GsCOORDINATE2 *a, int r );
void car_divide_tmd( int n );
void car_draw( GsOT *ot, int ot_length );
void car_position( int i, VECTOR *Vp, int ret );
void car_action( int n, int pd );
void car_enemy( int n, unsigned int mask );
void car_preope( int n );
void car_resistance( int n );
void car_acceralate( int n, int mode );
void car_rotation( int n );
void car_getplate( int n );
void cars_distance_set();
void car_fire( int n, int size );
void warning( int ref, int n );

//CAR_CTR2.C
void car_hitsound( int tone, int vol, int n );
void car_rotation( int n );
void car_bank( int n );
void car_boost( int n, int r );
void car_radder( int n, int i, int m );

//COURCE.C
u_long *alphabet_addr( char u, int *b );
void cource_init( int cource_n, int mode );
void cource_draw();
void get_bgcolor();

//UNPACK.C
int LZS_unpack0( u_char *unpack_data, int size, char *workt );
int LZS_unpack_one( u_char *packed, u_char *unpack, int size, u_char *file );

//MENU_ETC.C
void alphabet16( int x, int y, char *a );
void pcm( int mode );
int car_select( int md );
int cource_select( int mode );
int title( int mode );
int enter_name( GsOT *ot, int ot_length, int flash );
int sort_betlap( int mode, int best, char a[3] );
int entry_check( int best, int best2 );
int memory_card( int slot );
void alphabet88( int x, int y, char *a );
void draw_words_ot( GsOT *ot, int x, int y, int lng, int n, int z, int col );
void draw_words_ot16( GsOT *ot, int x, int y, int lng, int n, int z, int col );
void draw_words_ot_j( GsOT *ot, int x, int y, int lng, int n, int z, int col );
void draw_words_ot_j2( GsOT *ot, int x, int y, int lng, int n, int z, int col, int mode );
void draw_message( int x, int y, char *message );
void get_record_time( char *a, int dat );
void get_record_name( char *a, char *b );
void make_minimap( int x, int y, int h, int w );

//DRAW_SP.C
void front_draw_replay( GsOT *ot, int ot_length );
void front_draw( GsOT *ot, int ot_length );
void front_draw_time( GsOT *ot, int ot_length );
void front_draw_dv( GsOT *ot, int ot_length );
void draw_bomb( GsOT *ot, int player, int timm );
void best_draw( GsOT *ot, int ot_length, int mode );
void total_draw( GsOT *ot, int ot_length, int mode );
void draw_speed( GsOT *ot, int ot_length, int speed, int yp );
void draw_position( GsOT *ot, int ot_length, int n, int yp );
void draw_damage( GsOT *ot, int ot_length, int n, int yp );
void draw_map( GsOT *ot, int ot_length, int n, int yp );

//MAKEMAP.C
int makemap( int stage, int m_mode );

//MEMORY_C.c
int memory_card( int slot );
void mcard_autoload();
int save( int slot );
void error_message( char *message );
void memorycard_put();

//OTR_MODE.C
int view_records( int mode );
void online_help();
void music_mode();
void draw_minicar( GsOT *ot, int x, int y, int n, int z );
void japanese( int xp, int yp, char *ch, int mode );

//OMAKE.C
void man_draw(GsOT *ot , int n);
void man_set();

//TRAINING.C
int training_select( int lev, int ini_sel );
void training( int stage );
void game_init_tr();
void game_init2_tr();
int game_end_tr( int stage, int endd );
int game_tr( int stage );

