#include <libps.h>
#include <memory.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include "GP1.h"

unsigned char *script=PACKED_WORK_ADDR;
unsigned char *p_script=(PACKED_WORK_ADDR+0x4000);
unsigned char *cource_buff=COURCETMD_ADDR, *cp, *cp2, pn;
unsigned char *cource_data=COURCE_DATA_ADDR;

struct MAP_COURCE_DATA {
	unsigned char pat[MAX_COURCE_PARTS][16][32];
	int xs[MAX_COURCE_PARTS], ys[MAX_COURCE_PARTS];
	unsigned char *p[3][MAX_COURCE_PARTS];
	VECTOR VBi[MAX_COURCE_PARTS];
	int write_map[8][MAX_COURCE_PARTS*2];
	int type[32];
	int tmd_n, num_pri, bput, nmax;
} *Mp;

#define TEX_X 320
#define TEX_Y 256
#define TEX_X2 (320+128)
#define TEX_Y2 (256)
#define K_HIGHT 512
#define SIDE_SIZE 1024
#define WALL_LONG2 1524
#define WALL_LONG 2048
#define WALL_HIGHT 2048

extern struct s_MAP_DATA *map_data;
extern struct s_SYSTEM_DATA Gsys;

int m_mode;

void pattern_get()
{
	int i, num=0, xs, ys, x, y;
	unsigned char *red;

	for( i=0 ; i<0x4000 ; i++ )
	{
		if ( (p_script[i]+(p_script[i+1]<<8) )==0x0a0d)
			p_script[i]=0;
		if (p_script[i]==',') p_script[i]=0;
	}
	i=0;
	red=p_script;
	while( red<p_script+0x4000 )
	{
//		if (*red=='/' && *(red+1)=='/') continue;
		if (*red=='*')
		{
			num = atoi( red+1 );
			red+=strlen(red)+2;
			xs = atoi( red );
			red+=strlen(red)+1;
			ys = atoi( red );
			for ( y=0 ; y<ys ; y++ )
			{
				red+=strlen(red)+2;
				for ( x=0 ; x<xs ; x++ )
					Mp->pat[num][y][x]=red[x];
			}
			Mp->xs[num]=xs;
			Mp->ys[num]=ys;
		}
		if (strcmp(red,"END")==0) break;
		red+=strlen(red)+2;
	}
	Mp->num_pri=num+1;
}

unsigned char *pat2primitive( unsigned char *wp )
{
	int i, x, y=0, t, l, nn;
	int xs;
	unsigned char *p;
	int tex[256];
	memset((char *)tex,0,sizeof(tex));
	tex['.']=0;
	tex['s']=0;
	tex['*']=1;
	tex['>']=2;
	tex['g']=3;
	tex['d']=4;
	tex['J']=5;
	tex['P']=6;
	tex['B']=7;
	tex['&']=16;
	tex['+']=17;
	tex['Y']=18;
	tex['?']=19;
	tex['%']=20;
	tex['#']=21;
	tex['T']=22;
	tex['E']=23;
	p=wp;
	for ( i=0 ; i<Mp->num_pri ; i++ )
	{
		Mp->p[0][i]=p;
		xs=Mp->xs[i];
		for (y=0 ; y<Mp->ys[i] ; y++)
		{
			for (x=0 ; x<Mp->xs[i] ; x++)
			{
				DWORD(p)=0x2c000709;
				t=tex[Mp->pat[i][y][x]];
				WORD(p+6)=(484+t/16)<<6;
				p[4]=((t & 15)>>2)*32;
				p[5]=(t>>4)*128+(t & 3)*32;
				p[8]=p[4];
				p[9]=p[5]+31;
				p[12]=p[4]+31;
				p[13]=p[5];
				p[16]=p[4]+31;
				p[17]=p[5]+31;
				WORD(p+10)=(1<<7)+((TEX_Y>>8)<<4)+(TEX_X>>6);
				WORD(p+20)=x+(y*xs);
				WORD(p+22)=x+(y*(xs+1));
				WORD(p+24)=x+1+(y*(xs+1));
				WORD(p+26)=x+((y+1)*(xs+1));
				WORD(p+28)=x+1+((y+1)*(xs+1));
				p+=32;
			}
		}
		nn=(xs/6)+1;
		for ( x=0 ; x<nn ; x++ )
		{
			DWORD(p)=0x29010305;
			DWORD(p+4)=0x29000000+0x080808;
			WORD(p+8)=((x+1)*(xs))/nn;
			WORD(p+10)=(x*(xs))/nn;
			WORD(p+12)=((x+1)*(xs))/nn+(Mp->ys[i]+1)*(xs+1);
			WORD(p+14)=(x*(xs))/nn+(Mp->ys[i]+1)*(xs+1);
			p+=16;
			DWORD(p)=0x29010305;
			DWORD(p+4)=0x29000000+0x080808;
			WORD(p+8)=((x+1)*(xs))/nn+(Mp->ys[i]+1)*(xs+1);
			WORD(p+10)=(x*(xs))/nn+(Mp->ys[i]+1)*(xs+1);
			WORD(p+12)=((x+1)*(xs))/nn+(Mp->ys[i])*(xs+1);
			WORD(p+14)=(x*(xs))/nn+(Mp->ys[i])*(xs+1);
			p+=16;
		}
	}

//DIV_MAP
	for ( i=0 ; i<Mp->num_pri ; i++ )
	{
		xs=Mp->xs[i];
		Mp->p[1][i]=p;
//		printf("Primitives p1");
		for (y=0 ; y<Mp->ys[i] ; y++)
		{
			for (x=0 ; x<Mp->xs[i] ; x+=2)
			{
				DWORD(p)=0x2c000709;
				t=tex[Mp->pat[i][y][x]];
				WORD(p+6)=(484+t/16)<<6;
				l=tex[Mp->pat[i][y][x+1]];
				p[4]=(t & 7)*32+((l & 7)/4)*16;
				p[5]=(t/16)*128+(l & 3)*32;
				p[8]=p[4];
				p[9]=p[5]+31;
				p[12]=p[4]+15;
				p[13]=p[5];
				p[16]=p[4]+15;
				p[17]=p[5]+31;
				WORD(p+10)=(1<<7)+((TEX_Y2>>8)<<4)+(TEX_X2>>6);
				WORD(p+20)=x+(y*xs);
				WORD(p+22)=x+(y*(xs+1));
				WORD(p+24)=x+2+(y*(xs+1));
				WORD(p+26)=x+((y+1)*(xs+1));
				WORD(p+28)=x+2+((y+1)*(xs+1));
				p+=32;
			}
		}
		for ( x=0 ; x<xs ; x+=2 )
		{
			DWORD(p)=0x29010305;
			DWORD(p+4)=0x29000000+(0x080808)+(x & 3)*(0x040404);
			WORD(p+8)=x+2;
			WORD(p+10)=x;
			WORD(p+12)=x+2+(Mp->ys[i]+1)*(xs+1);
			WORD(p+14)=x+(Mp->ys[i]+1)*(xs+1);
			p+=16;
			DWORD(p)=0x29010305;
			DWORD(p+4)=0x29000000+(0x080808)+((x+2) & 3)*(0x040404);
			WORD(p+8)=x+2+(Mp->ys[i]+1)*(xs+1);
			WORD(p+10)=x+(Mp->ys[i]+1)*(xs+1);
			WORD(p+12)=x+2+(Mp->ys[i])*(xs+1);
			WORD(p+14)=x+(Mp->ys[i])*(xs+1);
			p+=16;
		}
/*		for ( x=0 ; x<xs ; x+=2 )
		{
			DWORD(p)=0x29010305;
			DWORD(p+4)=0x29000000+(0x080808)+(x & 3)*(0x040404);
			WORD(p+8)=x+2;
			WORD(p+10)=x;
			WORD(p+12)=x+2+(Mp->ys[i])*(xs+1);
			WORD(p+14)=x+(Mp->ys[i])*(xs+1);
			p+=16;
		}
*/	}
	return( p );
}

unsigned char *primitive_cs( unsigned char *wp, int num )
{
	int i;
	unsigned char *p;

	p=wp;
	for ( i=0 ; i<num ; i++ )
	{
		DWORD(p)=0x2c000709;
		WORD(p+6)=(484)<<6;
		p[4]=0;
		p[5]=0;
		p[8]=0;
		p[9]=31;
		p[12]=31;
		p[13]=0;
		p[16]=31;
		p[17]=31;
		WORD(p+10)=(1<<7)+((TEX_Y>>8)<<4)+(TEX_X>>6);
		WORD(p+20)=i;
		WORD(p+22)=i*4;
		WORD(p+24)=i*4+1;
		WORD(p+26)=i*4+2;
		WORD(p+28)=i*4+3;
		p+=32;
	}
	return( p );
}

unsigned char *tmd_init( unsigned char *p, int num )
{
	DWORD( p )=0x41;
	DWORD( p+4 )=0;
	DWORD( p+8 )=num;
	return( p+12 );
}

void add_tmd( int n, int pat, unsigned char *vp, int vnum, unsigned char *np, int nnum, int scale )
{
	unsigned char *p=cource_buff+12+n*28;
	unsigned char *p2=cource_buff+12+(Mp->nmax+n)*28;

	DWORD( p )=(unsigned int)(vp-cource_buff-12);
	DWORD( p+4 )=vnum;
	DWORD( p+8 )=(unsigned int)(np-cource_buff-12);
	DWORD( p+12 )=nnum;
	DWORD( p+16 )=(unsigned int)(Mp->p[0][pat]-cource_buff-12);
	DWORD( p+20 )=nnum+((Mp->xs[pat]/6)+1)*2;
	DWORD( p+24 )=(unsigned int)scale;

	DWORD( p2 )=(unsigned int)(vp-cource_buff-12);
	DWORD( p2+4 )=vnum;
	DWORD( p2+8 )=(unsigned int)(np-cource_buff-12);
	DWORD( p2+12 )=nnum;
	DWORD( p2+16 )=(unsigned int)(Mp->p[1][pat]-cource_buff-12);
	DWORD( p2+20 )=nnum/2+Mp->xs[pat];
	DWORD( p2+24 )=(unsigned int)scale;
//	printf("addr=%x\n",(int)((char *)np));
}

void add_tmd_cs( int pnum, VECTOR VC )
{
	unsigned char *p=cource_buff+12;
	SVECTOR *V;
	int i;

	V=(SVECTOR *)(p+28+4*32*MAX_COURCE_PARTS);
	DWORD( p )=(unsigned int)(28+4*32*MAX_COURCE_PARTS);
	DWORD( p+4 )=pnum*4;
	DWORD( p+8 )=(unsigned int)(28+4*32*MAX_COURCE_PARTS+8*4*4*MAX_COURCE_PARTS);
	DWORD( p+12 )=pnum;
	DWORD( p+16 )=(unsigned int)(28);
	DWORD( p+20 )=pnum;
	DWORD( p+24 )=(signed int)0;
	for ( i=0 ; i<pnum*4 ; i++, V++ )
	{
		V->vx-=VC.vx;
		V->vy-=VC.vy;
		V->vz-=VC.vz;
	}
	Gsys.map_cx=VC.vx<<6;
	Gsys.map_cy=VC.vz<<6;
}

int normal_set(int pat, unsigned char *vi )
{
	int x,y;
	VECTOR A,B;
	int nnum=0;
//	float xf, yf, zf, ln;
	int xf, yf, zf, ln;
#define VP(x,y,t) (S_WORD(vi+(x)*8+(y)*8*(Mp->xs[pat]+1)+(t)*2))
	for( y=0 ; y<Mp->ys[pat] ; y++ )
	{
		for( x=0 ; x<Mp->xs[pat] ; x++ )
		{
			A.vx=VP(x+1,y,0)-VP(x,y,0);
			A.vy=VP(x+1,y,1)-VP(x,y,1);
			A.vz=VP(x+1,y,2)-VP(x,y,2);
			B.vx=VP(x,y+1,0)-VP(x,y,0);
			B.vy=VP(x,y+1,1)-VP(x,y,1);
			B.vz=VP(x,y+1,2)-VP(x,y,2);
			xf=(A.vy*B.vz-A.vz*B.vy)>>7;
			yf=(A.vz*B.vx-A.vx*B.vz)>>7;
			zf=(A.vx*B.vy-A.vy*B.vx)>>7;
			ln=sqr_i( (1<<16), (xf*xf+yf*yf+zf*zf) );
			if (ln==0)
			{
				printf("div error\n");
				exit(1);
			}
			xf=(xf*4096/ln);
			yf=(yf*4096/ln);
			zf=(zf*4096/ln);
			S_WORD(cp)=-((short int)xf);
			S_WORD(cp+2)=-((short int)yf);
			S_WORD(cp+4)=-((short int)zf);
			cp+=8;
			nnum++;
		}
	}
	return(nnum);
}

void normal_set2( unsigned char *vi)
{
	VECTOR A,B;
	int nnum=0;
	int y;
	int xf, yf, zf, ln;
#define VP2(i,t) (S_WORD(vi+(i)*8+(t)*2))
	for (y=0 ; y<16 ; y+=4 )
	{
		A.vx=VP2(y+1,0)-VP2(y,0);
		A.vy=VP2(y+1,1)-VP2(y,1);
		A.vz=VP2(y+1,2)-VP2(y,2);
		B.vx=VP2(y+2,0)-VP2(y,0);
		B.vy=VP2(y+2,1)-VP2(y,1);
		B.vz=VP2(y+2,2)-VP2(y,2);
		xf=(A.vy*B.vz-A.vz*B.vy)>>3;
		yf=(A.vz*B.vx-A.vx*B.vz)>>3;
		zf=(A.vx*B.vy-A.vy*B.vx)>>3;
		ln=sqr_i( (1<<16), (xf*xf+yf*yf+zf*zf) );
		if (ln==0)
		{
			printf("div error\n");
			exit(0);
		}
		xf=-(xf*4096/ln);
		yf=-(yf*4096/ln);
		zf=-(zf*4096/ln);
		S_WORD(cp2)=-((short int)xf);
		S_WORD(cp2+2)=-((short int)yf);
		S_WORD(cp2+4)=-((short int)zf);
		cp2+=8;
		nnum++;
	}
}

VECTOR make_tmd_line(int r0x,int r0y,int r0z,int r1x,int r1y,int r1z
					,int l0x,int l0y,int l0z,int l1x,int l1y,int l1z,int pat)
{
	int n, x, y, vnum=0, nnum=0;
	unsigned char *vi, *vn;
	VECTOR VS={0,0,0};
	int ln;
	int xa, ya, za;
	int xb, yb, zb;
	int xc, yc, zc;

	vi=cp;

	VS.vx=(l0x+l1x+r0x+r1x)/4;
	VS.vy=(l0y+l1y+r0y+r1y)/4;
	VS.vz=(l0z+l1z+r0z+r1z)/4;

//	printf("xss=%d,%d,%d,%d_%d\n",l0x,l1x,r0x,r1x,(int)VS.vx);

	r0x-=l0x;
	r0y-=l0y;
	r0z-=l0z;
	r1x-=l0x;
	r1y-=l0y;
	r1z-=l0z;
	l1x-=l0x;
	l1y-=l0y;
	l1z-=l0z;
	l0x=0;
	l0y=0;
	l0z=0;

	n=(DWORD( cource_buff+8 )++);
//	printf("pat=%d\n", pat );
//	printf("size(%d,%d)\n",Mp->xs[pat] ,Mp->ys[pat] );
	for( y=0 ; y<=Mp->ys[pat]+1 ; y++ )
	{
		for( x=0 ; x<=Mp->xs[pat] ; x++ )
		{
			xa=(l1x*x+l0x*(Mp->xs[pat]-x))/Mp->xs[pat];
			ya=(l1y*x+l0y*(Mp->xs[pat]-x))/Mp->xs[pat];
			za=(l1z*x+l0z*(Mp->xs[pat]-x))/Mp->xs[pat];
			xb=(r1x*x+r0x*(Mp->xs[pat]-x))/Mp->xs[pat];
			yb=(r1y*x+r0y*(Mp->xs[pat]-x))/Mp->xs[pat];
			zb=(r1z*x+r0z*(Mp->xs[pat]-x))/Mp->xs[pat];
			if (y==Mp->ys[pat]+1)
			{
				xc=(xa+xb)>>1;
				yc=(ya+yb)>>1;
				zc=(za+zb)>>1;
				yc+=1024;
				S_WORD(cp)=(int)(xc)/2;
				S_WORD(cp+2)=(int)(yc)/2;
				S_WORD(cp+4)=(int)(zc)/2;
				cp+=8;
				vnum++;
				continue;
			}
			if (y<2 || y>Mp->ys[pat]-2)
			{
				xc=(xa-xb)>>4;
				yc=(ya-yb)>>4;
				zc=(za-zb)>>4;
				ln=sqr_i((1<<16), xc*xc+yc*yc+zc*zc);
				xc=xc*(SIDE_SIZE)/ln;
				yc=yc*(SIDE_SIZE)/ln;
				zc=zc*(SIDE_SIZE)/ln;
				if (y==0)
					xc+=xa, yc+=ya, zc+=za;
				if (y==1)
					xc=xa, yc=ya, zc=za;
				if (y==Mp->ys[pat]-1) xc=xb, yc=yb, zc=zb;
				if (y==Mp->ys[pat]) xc=xb-xc, yc=yb-yc, zc=zb-zc;
				S_WORD(cp)=(int)(xc)/2;
				if (y==1 || y==Mp->ys[pat]-1)
					S_WORD(cp+2)=(int)(yc-K_HIGHT)/2;
				else
					S_WORD(cp+2)=(int)(yc+K_HIGHT/2)/2;
				S_WORD(cp+4)=(int)(zc)/2;
				cp+=8;
				vnum++;
				continue;
			}
			S_WORD(cp)=(xb*(y-2)+xa*(Mp->ys[pat]-2-y))/(Mp->ys[pat]-4)/2;
			S_WORD(cp+2)=(yb*(y-2)+ya*(Mp->ys[pat]-2-y))/(Mp->ys[pat]-4)/2;
			S_WORD(cp+4)=(zb*(y-2)+za*(Mp->ys[pat]-2-y))/(Mp->ys[pat]-4)/2;
			cp+=8;
			vnum++;
		}
	}

	vn=cp;

	nnum=normal_set( pat, vi );

	add_tmd( n, pat, vi, vnum, vn, nnum, 0 );
//	printf("LINE VS=%d,%d,%d\n",(int )VS.vx,(int )VS.vy,(int)VS.vz);
	return( VS );
}

void make_tmd_line_cs(int r0x,int r0y,int r0z,int r1x,int r1y,int r1z
					,int l0x,int l0y,int l0z,int l1x,int l1y,int l1z)
{
	int x, y, i;
	unsigned char *vi;
	int xa, ya, za;
	int xb, yb, zb;

	pn+=4;
	vi=cp;
	for( i=0 ; i<4 ; i++ )
	{
		for( x=0 ; x<2 ; x++ )
		{
			y=x+i;
			xa=(l1x*y+l0x*(4-y))/4;
			ya=(l1y*y+l0y*(4-y))/4;
			za=(l1z*y+l0z*(4-y))/4;
			xb=(r1x*y+r0x*(4-y))/4;
			yb=(r1y*y+r0y*(4-y))/4;
			zb=(r1z*y+r0z*(4-y))/4;
			S_WORD(cp)=xb>>6;
			S_WORD(cp+2)=yb>>6;
			S_WORD(cp+4)=zb>>6;
			cp+=8;
			S_WORD(cp)=xa>>6;
			S_WORD(cp+2)=ya>>6;
			S_WORD(cp+4)=za>>6;
			cp+=8;
		}
	}
	normal_set2( vi );
}

VECTOR make_tmd_circle(int cird[2][16],int pat)
{
	int n, x, y, vnum=0, nnum=0;
	unsigned char *vi, *vn;
	VECTOR VS={0,0,0};

	int ln;
	int rr, rl;
	int xa, ya, za;
	int xb, yb, zb;
	int xc, yc, zc;

	vi=cp;

	n=(DWORD( cource_buff+8 )++);
	for( y=0 ; y<=Mp->ys[pat]+1 ; y++ )
	{
		for( x=0 ; x<=Mp->xs[pat] ; x++ )
		{
			rr=((cird[1][5]*x+cird[1][4]*(Mp->xs[pat]-x))*2)/(Mp->xs[pat]);
			rl=((cird[0][5]*x+cird[0][4]*(Mp->xs[pat]-x))*2)/(Mp->xs[pat]);
			rr%=720;
			rl%=720;
			if (rr<0) rr+=720;
			if (rl<0) rl+=720;
			xa=(cird[0][2]*Gsys.cosd[rr])>>10;
			ya=(cird[0][7]*x+cird[0][6]*(Mp->xs[pat]-x))/(Mp->xs[pat]);
			za=(cird[0][3]*Gsys.sind[rr])>>10;
			xb=((cird[1][2]*Gsys.cosd[rl])>>10)+cird[1][0]-cird[0][0];
			yb=(cird[1][7]*x+cird[1][6]*(Mp->xs[pat]-x))/(Mp->xs[pat]);
			zb=((cird[1][3]*Gsys.sind[rl])>>10)+cird[1][1]-cird[0][1];
			if (y==Mp->ys[pat]+1)
			{
				xc=(xa+xb)>>1;
				yc=(ya+yb)>>1;
				zc=(za+zb)>>1;
				yc+=1024;
				S_WORD(cp)=(int)(xc)/2;
				S_WORD(cp+2)=(int)(yc)/2;
				S_WORD(cp+4)=(int)(zc)/2;
				cp+=8;
				vnum++;
				continue;
			}
			if (y<2 || y>Mp->ys[pat]-2)
			{
				xc=(xa-xb)>>4;
				yc=(ya-yb)>>4;
				zc=(za-zb)>>4;
				ln=sqr_i(1<<16, xc*xc+yc*yc+zc*zc);
				xc=xc*(SIDE_SIZE)/ln;
				yc=yc*(SIDE_SIZE)/ln;
				zc=zc*(SIDE_SIZE)/ln;
				if (y==0)
					xc+=xa, yc+=ya, zc+=za;
				if (y==1)
					xc=xa, yc=ya, zc=za;
				if (y==Mp->ys[pat]-1) xc=xb, yc=yb, zc=zb;
				if (y==Mp->ys[pat]) xc=xb-xc, yc=yb-yc, zc=zb-zc;
				S_WORD(cp)=(int)(xc)/2;
				if (y==1 || y==Mp->ys[pat]-1)
					S_WORD(cp+2)=(int)(yc-K_HIGHT)/2;
				else
					S_WORD(cp+2)=(int)(yc+K_HIGHT/2)/2;
				S_WORD(cp+4)=(int)(zc)/2;
				VS.vx+=S_WORD(cp);
				VS.vy+=S_WORD(cp+2);
				VS.vz+=S_WORD(cp+4);
				cp+=8;
				vnum++;
				continue;
			}
			S_WORD(cp)=(xb*(y-2)+xa*(Mp->ys[pat]-2-y))/(Mp->ys[pat]-4)/2;
			S_WORD(cp+2)=(yb*(y-2)+ya*(Mp->ys[pat]-2-y))/(Mp->ys[pat]-4)/2;
			S_WORD(cp+4)=(zb*(y-2)+za*(Mp->ys[pat]-2-y))/(Mp->ys[pat]-4)/2;
			VS.vx+=S_WORD(cp);
			VS.vy+=S_WORD(cp+2);
			VS.vz+=S_WORD(cp+4);
			cp+=8;
			vnum++;
		}
	}
	vn=cp;
	nnum=normal_set( pat, vi );
	add_tmd( n, pat, vi, vnum, vn, nnum, 0 );
	VS.vx=VS.vx/vnum+cird[0][0];
	VS.vy=VS.vy/vnum;
	VS.vz=VS.vz/vnum+cird[0][1];
//	printf("CIRCLE VS=%d,%d,%d\n",(int)VS.vx,(int)VS.vy,(int)VS.vz);
	return( VS );
}

void make_tmd_circle_cs(int cird[2][16])
{
	int x, y, i;
	unsigned char *vi;

	int rr, rl;
	int xa, ya, za;
	int xb, yb, zb;

	pn+=4;
	vi=cp;
	for( i=0 ; i<4 ; i++ )
	{
		for( y=0 ; y<2 ; y++ )
		{
			x=i+y;
			rr=((cird[1][5]*x+cird[1][4]*(4-x))*2)/4;
			rl=((cird[0][5]*x+cird[0][4]*(4-x))*2)/4;
			rr%=720;
			rl%=720;
			if (rr<0) rr+=720;
			if (rl<0) rl+=720;
			xa=((cird[0][2]*Gsys.cosd[rr])>>10)+cird[0][0];
			ya=(cird[0][7]*x+cird[0][6]*(4-x))/4;
			za=((cird[0][3]*Gsys.sind[rr])>>10)+cird[0][1];
			xb=((cird[1][2]*Gsys.cosd[rl])>>10)+cird[1][0];
			yb=(cird[1][7]*x+cird[1][6]*(4-x))/4;
			zb=((cird[1][3]*Gsys.sind[rl])>>10)+cird[1][1];
			S_WORD(cp)=xb>>6;
			S_WORD(cp+2)=yb>>6;
			S_WORD(cp+4)=zb>>6;
			cp+=8;
			S_WORD(cp)=xa>>6;
			S_WORD(cp+2)=ya>>6;
			S_WORD(cp+4)=za>>6;
			cp+=8;
		}
	}
	normal_set2( vi );
}

void max_check()
{
	unsigned char *p;
	int num, i;

//	printf("MaxCheck");

	for( i=0 ; i<0x4000 ; i++ )
	{
		if (( script[i]+(script[i+1]<<8) )==0x0a0d)
			script[i]=0;
	}

	p=script;
	Mp->nmax=0;

//	printf("MaxCheck2");

	while( strcmp(p,"END") )
	{
		if (p[0]=='*')
		{
			num=atoi(p+1);
//			printf("num=%d, Mp->nmax=%d\n", num, Mp->nmax);
			if (num>Mp->nmax) Mp->nmax=num;
		}
		p+=strlen(p)+2;
	}
//	printf("MaxCheck3");
	Mp->nmax++;
//	printf("max number = %d\n", Mp->nmax);
}

VECTOR make_tmd()
{
	char *p, *p2, temp[256];
	VECTOR VC={0,0,0};
	int i, nex=0, bef=0, co0=0,co1=0, write_f_num=3,write_b_num=3;
	int mode=0, pat=0, num=0, n2=0;
	int l0x=-1,l0y=-1,l1x=-1,l1y=-1,r0x=-1,r0y=-1,r1x=-1,r1y=-1;
	int r0z=-1, r1z=-1, l0z=-1, l1z=-1;
	int cird[2][16], lr, doi=0, bnum=0;
	struct s_MAP_DATA *map_d;

	for( i=0 ; i<0x4000 ; i++ )
		if ( (script[i]+(script[i+1]<<8) )==0x0a0d)
			script[i]=0;

	p=script;
	map_d=&map_data[0];
	while( strcmp(p,"END") )
	{
		switch( p[0] )
		{
		case '/':
			break;
		case '#':
			if (strcmp(p+1,"LINE")==0) mode=0;
			if (strcmp(p+1,"CIRCLE")==0) mode=1;
			break;
		case '*':
			co0=0;
			co1=4;
			num=atoi(p+1);
//			printf("DATA = %d\n",num);
			nex=num+1;
			bef=num-1;
			Mp->write_map[0][num]=-1;
			Mp->write_map[1][num]=-1;
			Mp->write_map[2][num]=-1;
			Mp->write_map[3][num]=-1;
			Mp->write_map[4][num]=-1;
			Mp->write_map[5][num]=-1;
			Mp->write_map[6][num]=-1;
			Mp->write_map[7][num]=-1;
			map_d=&map_data[num];
			map_d->write_f=write_f_num;
			map_d->write_b=write_b_num;
			break;
		case 'A':
			if (p[8]=='F')
				write_f_num=atoi(p+10);
			if (p[8]=='B')
				write_b_num=atoi(p+10);
			map_d->write_f=write_f_num;
			map_d->write_b=write_b_num;
			break;
		case 'D':
			if (p[8]=='F')
				map_d->write_f=atoi(p+10);
			if (p[8]=='B')
				map_d->write_b=atoi(p+10);
			break;
		case 'P':
			pat=atoi(p+4);
			bnum=0;
			break;
		case 'B':
			bef=atoi(p+7);
			break;
		case 'W':
			if (p[6]=='F')
				Mp->write_map[co0++][num]=atoi(p+8);
			if (p[6]=='B')
				Mp->write_map[co1++][num]=atoi(p+8);
			if (p[6]!='F' && p[6]!='B')
			{
				Mp->write_map[co0++][num]=atoi(p+6);
				Mp->write_map[co1++][num]=atoi(p+6);
			}
			break;
		case 'N':
			nex=atoi(p+5);
			break;
		case 'C':
//			printf("CIRCLE \n");
			strcpy(temp,p+10);
			p2=temp;
			for ( i=0 ; i<256 ; i++ )
			{
				if (temp[i]==')' || temp[i]==',')
					temp[i]=0;
			}
			if (p[7]=='L') lr=0; else lr=1;
			doi|=(1<<lr);
//			printf("CIRCLE doi=%d\n", doi);
			for (i=0 ; i<10 ; i++ )
			{
				cird[lr][i]=atoi( p2 );
				p2+=strlen(p2)+1;
				if (p2[0]==0) p2+=2;
			}
			break;
		case 'L':
			strcpy(temp,p+2);
			p2=temp+1;
			for ( i=0 ; i<256 ; i++ )
			{
				if (temp[i]==')' || temp[i]==',')
					temp[i]=0;
			}
			l0x=atoi( p2 );
			p2+=strlen(p2)+1;
			l0y=atoi( p2 );
			p2+=strlen(p2)+1;
			l0z=atoi( p2 );
			p2+=strlen(p2)+3;
			l1x=atoi( p2 );
			p2+=strlen(p2)+1;
			l1y=atoi( p2 );
			p2+=strlen(p2)+1;
			l1z=atoi( p2 );
			break;
		case 'R':
			strcpy(temp,p+2);
			p2=temp+1;
			for ( i=0 ; i<256 ; i++ )
			{
				if (temp[i]==')' || temp[i]==',')
					temp[i]=0;
			}
			r0x=atoi( p2 );
			p2+=strlen(p2)+1;
			r0y=atoi( p2 );
			p2+=strlen(p2)+1;
			r0z=atoi( p2 );
			p2+=strlen(p2)+3;
			r1x=atoi( p2 );
			p2+=strlen(p2)+1;
			r1y=atoi( p2 );
			p2+=strlen(p2)+1;
			r1z=atoi( p2 );
			break;
		default:
			printf("ERROR:%s\n",p);
			break;
		}
//		printf("%s\n",p);
		if (doi==3 && mode==1)
		{
//			printf("CIRCLE R %d,%d,%d,%d\n",cird[1][4],cird[1][5],cird[1][6],cird[1][7]);
//			printf("CIRCLE L %d,%d,%d,%d\n",cird[0][4],cird[0][5],cird[0][6],cird[0][7]);
			doi=0;
			map_d->tmd_num=Mp->tmd_n;
			map_d->pat=pat;
			Mp->tmd_n++;
			if (m_mode==0)
				map_d->Va[0]=make_tmd_circle( cird, pat );
			else
				make_tmd_circle_cs( cird );
//			printf("circle %d=%d,%d,%d\n",num,map_d->Va[0].vx,map_d->Va[0].vy,map_d->Va[0].vz);
			if (cird[0][4]>cird[0][5])
				map_d->attribute=1;
			if (cird[0][4]<cird[0][5])
				map_d->attribute=2;
			map_d->center.vx=cird[0][0];
			map_d->center.vy=0;
			map_d->center.vz=cird[0][1];
			n2++;
			_addVECTOR( &VC, VC, map_d->center );
			map_d->xdiv=Mp->xs[pat];
			map_d->ydiv=Mp->ys[pat];
			map_d->next=nex;
			map_d->before=bef;
			r0x=l0x=-1;
		}
		if (r0x!=-1 && l0x!=-1 && mode==0)
		{
//			printf("R (%d,%d,%d,%d,%d,%d)\n",r0x,r0y,r0z,r1x,r1y,r1z);
//			printf("L (%d,%d,%d,%d,%d,%d)\n",l0x,l0y,l0z,l1x,l1y,l1z);
			map_d->tmd_num=Mp->tmd_n;
			Mp->tmd_n++;
			if (m_mode==0)
				map_d->Va[0]=make_tmd_line( r0x,r0y,r0z,r1x,r1y,r1z,l0x,l0y,l0z,l1x,l1y,l1z,pat );
			else
				make_tmd_line_cs( r0x,r0y,r0z,r1x,r1y,r1z,l0x,l0y,l0z,l1x,l1y,l1z );
			map_d->attribute=0;
			map_d->pat=pat;
			map_d->center.vx=l0x;
			map_d->center.vy=l0y;
			map_d->center.vz=l0z;
			n2++;
			map_d->xdiv=Mp->xs[pat];
			map_d->ydiv=Mp->ys[pat];
			map_d->next=nex;
			map_d->before=bef;
			_addVECTOR( &VC, VC, map_d->center );
			r0x=l0x=-1;
		}
		p+=strlen(p)+2;
	}
	if (n2!=0)
	{
		VC.vx=(VC.vx/n2)>>6;
		VC.vy=(VC.vy/n2)>>6;
		VC.vz=(VC.vz/n2)>>6;
//		printf("%d,%d,%d\n",VC.vx,VC.vy,VC.vz);
	}
	return(VC);
}

void save_datas()
{
	unsigned char *a=COURCE_DATA_ADDR+sizeof(struct s_MAP_DATA)*MAX_COURCE_PARTS;
#ifdef D_ROTATION
	DWORD( cource_buff+8 )=DWORD( cource_buff+8 )*2;
#else
	DWORD( cource_buff+8 )=DWORD( cource_buff+8 )*3;
#endif
//	printf("Number Tmd is %d\n", (int)DWORD( cource_buff+8 ) );
	memcpy( a, Mp->pat, sizeof(Mp->pat) );
}

void map_data_set()
{
#define longe(x,y,l,m) \
{\
	int ax,bx,az,bz;\
	ax=x.vx>>8,bx=y.vx>>8,az=x.vz>>8,bz=y.vz>>8;\
	l=sqr_i(1<<16, (ax-bx)*(ax-bx)+(az-bz)*(az-bz));\
}
#define longe2(x,y,l) \
{\
	int ax,bx,az,bz;\
	ax=x.vx>>8,bx=y.vx>>8,az=x.vz>>8,bz=y.vz>>8;\
	l=sqr_i(1<<16, (ax-bx)*(ax-bx)+(az-bz)*(az-bz));\
}
	int i, t;
	for (i=0 ; i<Mp->tmd_n ; i++ )
	{
		for( t=0 ; t<8 ; t++ )
		{
			map_data[i].tmd_put[t]=-1;
			if (Mp->write_map[t][i]!=-1)
				map_data[i].tmd_put[t]=Mp->write_map[t][i];
		}
	}
}

int makemap( int stage, int mn )
{
	unsigned char *name[]={
	"STG1_1.TXT","PTN1_1.TXT",
	"STG1_2.TXT","PTN1_2.TXT",
	"STG1_3.TXT","PTN1_3.TXT",
	"STG2_1.TXT","PTN2_1.TXT",
	"STG2_2.TXT","PTN2_2.TXT",
	"STG2_3.TXT","PTN2_3.TXT",
	"STG3_1.TXT","PTN3_1.TXT",
	"STG3_2.TXT","PTN3_2.TXT",
	"STG3_3.TXT","PTN3_3.TXT"
	};

	unsigned char *namet[]={
	"TSTG1_1.TXT","TPTN1_1.TXT",
	"TSTG1_2.TXT","TPTN1_2.TXT",
	"TSTG1_3.TXT","TPTN1_3.TXT",
	"TSTG1_4.TXT","TPTN1_4.TXT",
	"TSTG1_5.TXT","TPTN1_5.TXT",
	"TSTG2_1.TXT","TPTN2_1.TXT",
	"TSTG2_2.TXT","TPTN2_2.TXT",
	"TSTG2_3.TXT","TPTN2_3.TXT",
	"TSTG2_4.TXT","TPTN2_4.TXT",
	"TSTG2_5.TXT","TPTN2_5.TXT",
	"TSTG3_1.TXT","TPTN3_1.TXT",
	"TSTG3_2.TXT","TPTN3_2.TXT",
	"TSTG3_3.TXT","TPTN3_3.TXT",
	"TSTG3_4.TXT","TPTN3_4.TXT",
	"TSTG3_5.TXT","TPTN3_5.TXT"
	};

	VECTOR VC;
	struct MAP_COURCE_DATA mapd;
	unsigned char *a;
	RECT rect;

	m_mode=mn & 1;

//	printf("map data addr %x\n", (int)map_data);

	setRECT( &rect, 1024-256, 512-128, 128, 128 );
	StoreImage( &rect, (u_long *)COURCETMD_ADDR );
	VSync(0);
	DrawSync(0);
	memset( script, 0, 0x8000 );

	if (mn>=2)
	{
		LZS_unpack_one( COURCETMD_ADDR, script, 0x4000, namet[stage*2] );
		LZS_unpack_one( COURCETMD_ADDR, p_script, 0x4000, namet[stage*2+1] );
	}
	else
	{
		LZS_unpack_one( COURCETMD_ADDR, script, 0x4000, name[stage*2] );
		LZS_unpack_one( COURCETMD_ADDR, p_script, 0x4000, name[stage*2+1] );
	}
	
	memset( (unsigned char *)&mapd, 0, sizeof(struct MAP_COURCE_DATA) );

	Mp=&mapd;
	a = cource_buff;

	if (m_mode==0)
	{
		max_check();
		a=tmd_init( a, 0 );
		pattern_get();
		a+=28*Mp->nmax*2;
		a=pat2primitive( a );
		cp=a;
		make_tmd();
		map_data_set();
		save_datas();
	}
	else
	{
		a=tmd_init( a, 1 );
		pn=0;
		a+=28;
		a=primitive_cs( a, 4*MAX_COURCE_PARTS );
		cp=a;
		cp2=a+4*4*8*MAX_COURCE_PARTS;
		VC=make_tmd();
		add_tmd_cs( pn, VC );
	}
	return(0);
}