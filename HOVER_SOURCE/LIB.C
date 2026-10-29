/* for lib   by.sato */

#include <libps.h>
#include "GP1.h"
#include "pad.h"

unsigned short int padd( volatile u_char *bb )
{
	unsigned int p;
	p=~((*(bb+3))+((*(bb+2))<<8));
	return( p );
}

unsigned char analog( volatile u_char *bb, int port )
{
	unsigned char p;
	p=(*(bb+4+port));
	if (((*(bb+1))>>4)!=0x7) p=128;
	return( p );
}

void obj_set( GsDOBJ2 *obj, GsCOORDINATE2 *crd2, u_long *tmd_addr, int num, int attribute )
{
	tmd_addr++;
	GsMapModelingData( tmd_addr );
	tmd_addr+=2;
	GsLinkObject4( (u_long)tmd_addr, obj, num );
	obj->coord2=crd2;
	obj->attribute=attribute;
	obj->coord2->flg=0;
}

void crd_set( GsCOORDINATE2 *coord2, MATRIX mat, GsCOORDINATE2 *super )
{
	GsInitCoordinate2( super, coord2 );
	coord2->coord=mat;
}

void loadTim( u_long *addr )
{
GsIMAGE im;
RECT rect;
	GsGetTimInfo( addr+1, &im );
	rect.x=im.px;
	rect.y=im.py;
	rect.w=im.pw;
	rect.h=im.ph;
	LoadImage( &rect, im.pixel );
//	printf( "timdata (%d,%d)-step(%d,%d):", rect.x, rect.y, rect.w, rect.h );
	if ((im.pmode & 8)==0) return;
	rect.x=im.cx;
	rect.y=im.cy;
	rect.w=im.cw;
	rect.h=im.ch;
	LoadImage( &rect, im.clut );
//	printf( "clut (%d,%d)-step(%d,%d)\n", rect.x, rect.y, rect.w, rect.h );
	DrawSync(0);
}

int sqr_i( int max, int a )
{
	int i, p, j;
	int sw=0, sww;

	if (a==0) return(0);
	i=max>>1;
	p=max>>2;
	while( p!=0 )
	{
		sww=sw;
		j=i*i;
		if (j==a) return(i);
		if (j>a)	i-=p;
		else i+=p;
		p>>=1;
	}
	return(i);
}
