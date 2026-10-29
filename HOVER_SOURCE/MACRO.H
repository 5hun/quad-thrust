#define _setMATRIXsVECTOR( a, x )	\
	(a)->t[0]=x.vx,	(a)->t[1]=x.vy,	(a)->t[2]=x.vz

#define _DrawObject( ot, ot_length, obj )	\
{\
	MATRIX MT,MT2;\
	GsGetLws( obj.coord2,&MT2,&MT );\
	GsSetLightMatrix( &MT2 );\
	GsSetLsMatrix( &MT );\
	GsSortObject4(&obj,ot,14-ot_length,NULL);\
}

#define _DrawObject_NL( ot, ot_length, obj )	\
{\
	MATRIX MT;\
	GsGetLs( obj.coord2,&MT );\
	GsSetLightMatrix( &MT );\
	GsSetLsMatrix( &MT );\
	GsSortObject4(&obj,ot,14-ot_length,NULL);\
}

#define _DrawObjectNAMA( ot, ot_length, obj )	\
{\
	GsSetLightMatrix( &(obj.coord2->coord) );\
	GsSetLsMatrix( &(obj.coord2->coord) );\
	GsSortObject4(&obj,ot,14-ot_length,NULL);\
}

#define _DrawObject_cut( ot, ot_length, obj, n )	\
{\
	MATRIX MT;\
	GsGetLs( obj.coord2, &MT );\
	if (MT.t[2]>n)\
	{\
		GsSetLightMatrix( &MT );\
		GsSetLsMatrix( &MT );\
		GsSortObject4(&obj,ot,14-ot_length,NULL);\
	}\
}

#define _DrawObject_cut2( ot, ot_length, obj, n, j )	\
{\
	MATRIX MT;\
	GsGetLs( obj.coord2, &MT );\
	if (MT.t[2]>n)\
	{\
		GsSetLightMatrix( &MT );\
		GsSetLsMatrix( &MT );\
		GsSortObject4(&obj,ot,14-ot_length,NULL);\
	}\
	else\
	{\
		j++;\
	}\
}

#define _BOXFILL( x, y, x2, y2, r, g, b ) \
{\
	RECT rect={ x,y,x2,y2 };\
	ClearImage( &rect, r, g, b );\
}

#define _LINE_CHECK( A, B, Vl ) \
	((B.vx-A.vx)*(Vl.vz-A.vz)-(B.vz-A.vz)*(Vl.vx-A.vx))

#define _setVECTOR(r, _x, _y, _z ) \
	(r)->vx = (_x),(r)->vy = (_y),(r)->vz = (_z)

#define _printVECTOR( a, c ) \
	printf("%s=(%d,%d,%d)", a, (int)c.vx, (int)c.vy, (int)c.vz);

#define _addVECTOR( c, d, e ) \
	(c)->vx=((d).vx)+((e).vx),\
	(c)->vy=((d).vy)+((e).vy),\
	(c)->vz=((d).vz)+((e).vz)

#define _subVECTOR( c, d, e ) \
	(c)->vx=((d).vx)-((e).vx),\
	(c)->vy=((d).vy)-((e).vy),\
	(c)->vz=((d).vz)-((e).vz)

#define _addVECTOR2( c, e ) \
	(c)->vx+=((e).vx),\
	(c)->vy+=((e).vy),\
	(c)->vz+=((e).vz)

#define _addMATRIXsVECTOR( c, e ) \
	(c)->coord.t[0]+=((e).vx),\
	(c)->coord.t[1]+=((e).vy),\
	(c)->coord.t[2]+=((e).vz)

#define _pcmplay( ch, vol, tone ) \
{\
	Gsys.SsVoice=SsUtKeyOn( Gsys.vab_se, ch, 0, tone/2, 0, vol, vol );\
	SsUtSetVVol( Gsys.SsVoice, vol, vol );\
}

#define _abs( __x ) ((__x)>0?(__x):-(__x))

#define _GetTPage(m,n,x,y) ((((((x)>>6) & 63)+(((y) & (~255))>>4))+((m)<<7))+((n)<<5))

#define _PAD( _pdd, _pd, _push ) (((_pdd) & (_push))==0 && ((_pd) & (_push)))

#define _padd( bb ) ((unsigned int)(~((*(bb+3))+((*(bb+2))<<8))))
