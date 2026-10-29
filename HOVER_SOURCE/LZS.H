/* ‚k‚yˆ³k‚e‚h‚k‚d ‚k‚n‚`‚c‚d‚q & ‚r‚`‚u‚d‚q */

#define LZS_CHECK_WORD "2tolzs"
#define ONE_CHECK_WORD "Lzs5"
#define DATA_TOP 25

struct LZS_ONE_DATA {
	unsigned char data_exist[4];
	unsigned char name[12];
	unsigned int pack_flag;
	unsigned int date;
	unsigned int org_size;
	unsigned int data_size;
	unsigned int check_sam;
};
