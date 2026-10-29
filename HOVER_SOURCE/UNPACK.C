/* lzloader vor.3 */
#include <libps.h>
#include <memory.h>
#include <stdio.h>
#include <strings.h>
#include "lzs.h"

//#define printf ;//

unsigned int DWORD( u_char *x )
{
	return(((u_long)x[0])+(((u_long)x[1])<<8)+(((u_long)x[2])<<16)+(((u_long)x[3])<<24));
}

unsigned short int WORD( u_char *x )
{
	return( x[0]+(((u_short)x[1])<<8) );
}

int getkimax( int l, int max )
{
	int i;
	for ( i=0 ; i<max ; i++ )
		if ((1<<i)>l) return( i );
	return( max );
}

int LZS_unpack0( u_char *unpack_data, int size, u_char *workt )
{
unsigned int byte=0,ki=0,hb=0,ii=0;
unsigned int da;
int kimax;
u_char *bh;
int i, sw=0;
unsigned char data[5];

	bh = unpack_data;

	for (i=0;i<5;i++)
	{
		data[i] = (DWORD(&workt[ii/8])>>(ii & 7)) & 7;
		ii+=3;
	}
	while (hb<size)
	{
		kimax=getkimax( hb-2, 14 );
		da = (DWORD(&workt[ii/8])>>(ii & 7));
		if ((da & 1)==0) sw=data[0],	ii++;
		if ((da & 3)==1) sw=data[1],	ii+=2;
		if ((da & 7)==3) sw=data[2],	ii+=3;
		if ((da & 15)==7) sw=data[3],	ii+=4;
		if ((da & 15)==15) sw=data[4],	ii+=4;
		switch( sw )
		{
		case 0:
			bh[hb++]=(DWORD(&workt[ii/8])>>(ii & 7)) & 255;
			ii+=8;
			break;
		case 1:
			byte = ((DWORD(&workt[ii/8])>>(ii & 7)) & 3)+2;
			ii+=2;
			if (kimax>8) kimax=8;
			ki = ((DWORD(&workt[ii/8])>>(ii & 7)) & ((1<<kimax)-1))+2;
			ii+=kimax;
			memcpy( &bh[hb], &bh[hb-ki], byte );
			hb+=byte;
			break;
		case 2:
			byte = ((DWORD(&workt[ii/8])>>(ii & 7)) & 15)+3;
			ii+=4;
			ki = ((DWORD(&workt[ii/8])>>(ii & 7)) & ((1<<kimax)-1))+2;
			ii+=kimax;
			memcpy( &bh[hb], &bh[hb-ki], byte );
			hb+=byte;
			break;
		case 3:
			byte = ((DWORD(&workt[ii/8])>>(ii & 7)) & 511)+19;
			ii+=9;
			ki = ((DWORD(&workt[ii/8])>>(ii & 7)) & ((1<<kimax)-1))+2;
			ii+=kimax;
			memcpy( &bh[hb], &bh[hb-ki], byte );
			hb+=byte;
			break;
		case 4:
			byte = (DWORD(&workt[ii/8])>>(ii & 7)) & 65535;
			ii+=16;
			ki = ((DWORD(&workt[ii/8])>>(ii & 7)) & 4095)*2;
			ii+=12;
			for( da=0 ; da<ki ; da+=2 )
			{
				bh[hb+da]=byte;
				bh[hb+da+1]=byte>>8;
			}
			hb += ki;
			break;
		}
	}
	return(hb);
}

void stra( u_char *bu )
{
	int i;
	for ( i=0 ; i<strlen(bu) ; i++ )
	{
		if (bu[i]>='a' && bu[i]<='z')
			bu[i]+='A'-'a';
	}
}

int LZS_unpack_one( u_char *packed, u_char *unpack, int size, u_char *file )
{
int hit=0, si, sam=0, i;
u_char *mbuf;
struct LZS_ONE_DATA *lzs;
char bbuf[256];

	stra( file );
//	printf("Unpack Check %s!", file);
	mbuf=packed;
	
//‚SƒoƒCƒg‹«ŠE‚É‚»‚ë‚¦‚é
	memcpy( bbuf, mbuf, sizeof(struct LZS_ONE_DATA) );
	lzs=(struct LZS_ONE_DATA *)bbuf;

	while( strncmp( lzs->data_exist, ONE_CHECK_WORD, 4 )==0 )
	{
//		printf("check %12s, %12s, size=%d\n", lzs->name, file, sizeof( struct LZS_ONE_DATA ) );
		if (strncmp( lzs->name, file, 12 )==0)
		{
			hit=1;
			break;
		}
		mbuf+=lzs->data_size+sizeof( struct LZS_ONE_DATA );
		memcpy( bbuf, mbuf, sizeof(struct LZS_ONE_DATA) );
		lzs=(struct LZS_ONE_DATA *)bbuf;
	}
	if (hit==0)
	{
		printf("File %s Not Exists !\n", file);
		return(-1);
	}

	if (lzs->org_size>=size)
	{
		printf("Size Error!\n");
		return(-1);
	}

	if (lzs->pack_flag==0)
	{
//		printf("Non pack!\n");
		memcpy( unpack, mbuf+sizeof(struct LZS_ONE_DATA), lzs->org_size );
		return( lzs->org_size );
	}
//	printf("Unpack!\n");
	si=LZS_unpack0(unpack, lzs->org_size, mbuf+sizeof(struct LZS_ONE_DATA) );
	for( i=0 ; i<lzs->org_size ; i++ )
		sam+=(unsigned char)unpack[i];
	if (sam!=lzs->check_sam)
		printf( "%d, %d------------------Check Sam Error %s\n",sam, lzs->check_sam, file );

//	check_stack();

	return( si );
}
