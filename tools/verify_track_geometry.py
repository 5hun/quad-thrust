"""Compare all authored course meshes with the original C routines.

The oracle compiles the actual MAKEMAP.C / LIB.C function bodies, without
rewriting their arithmetic. A host compiler with 32-bit int is required.
"""
import ctypes
import json
from pathlib import Path
import re
import subprocess
import tempfile
from track_geometry import ROOT, mesh, parse_parts, parse_patterns, trig_tables


def function(source, name):
    match = re.search(r'(?:void|int|VECTOR)\s+' + name + r'\s*\(', source)
    start = source.index('{', match.start())
    depth = 1
    end = start + 1
    while depth:
        depth += (source[end] == '{') - (source[end] == '}')
        end += 1
    return source[match.start():end]


def compile_oracle(directory):
    original = (ROOT/'HOVER_SOURCE/MAKEMAP.C').read_text('cp932')
    library = (ROOT/'HOVER_SOURCE/LIB.C').read_text('cp932')
    controller = (ROOT/'HOVER_SOURCE/CAR_CTR.C').read_text('cp932')
    controller2 = (ROOT/'HOVER_SOURCE/CAR_CTR2.C').read_text('cp932')
    header = r'''
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
_Static_assert(sizeof(int)==4, "oracle requires 32-bit int");
typedef struct { int vx,vy,vz,pad; } VECTOR;
typedef struct { int16_t vx,vy,vz,pad; } SVECTOR;
typedef uintptr_t u_long;
#define POS_KETA 2
#define _LINE_CHECK(A,B,P) ((B.vx-A.vx)*(P.vz-A.vz)-(B.vz-A.vz)*(P.vx-A.vx))
#define _subVECTOR(R,A,B) ((R)->vx=A.vx-B.vx,(R)->vy=A.vy-B.vy,(R)->vz=A.vz-B.vz)
#define _addVECTOR2(R,A) ((R)->vx+=A.vx,(R)->vy+=A.vy,(R)->vz+=A.vz)
#define _abs(v) abs(v)
#define _addVECTOR(R,A,B) ((R)->vx=A.vx+B.vx,(R)->vy=A.vy+B.vy,(R)->vz=A.vz+B.vz)
#define INERTIA_KETA2 2
struct s_MAP_DATA { VECTOR center; int xdiv,ydiv,next,before,tmd_num,pat; } map_storage[202], *map_data=map_storage+1;
struct car { VECTOR pos,posr,npos,nposr,inertia_forward,inertia_back; SVECTOR status,statusk,statusb;
 int accer,side_boost,per_rot2,per_rot,radder_rot,boost_wr,turbo,breaking,breaking2,boost_timming2,draw;
 int resi1,brek;
 int damageVoice,last_goal,time,lap,lap_time[4],last_lap,lap_draw,finish_rank,effect,effect_time;
 int weight,now_on,now_chip_x,now_chip_y,now_chip,rank,line_position,before_line_position;
 int cource_out,over,lev,tei,damage,grip,car_type,speed,lhit,rhit,l_distans,r_distans; SVECTOR *VP,*VP2,*VN;
} cars[4],*cars_scra[4]={&cars[0],&cars[1],&cars[2],&cars[3]},*car_data;
struct { int hight,weight,per_accer0,per_accer1,turbo0,turbo1; } CARS_PROPATIE[6]={
 {200,128,240,0,250,5},{200,120,325,11,258,5},{200,100,135,-6,300,10},
 {200,140,553,30,220,3},{200,95,93,-8,0,0},{200,120,620,21,350,8}};
struct { uint32_t attribute; } DOBJ_KAGE[4],DOBJ_C[4];
struct { struct { int16_t m[3][3]; int t[3]; } coord; } CRD_KAGE[4],CRD_C[4];
int sound_count,last_tone,last_volume,debris_count,debris_calls;
struct { int wall_ch,stop[4],time; } Trn;
void car_hitsound(int tone,int volume,int n) { sound_count++;last_tone=tone;last_volume=volume; }
void add_crash_chip(VECTOR v,SVECTOR normal,int width,int count,int mode,int player) { debris_count+=count;debris_calls++; }
#define SIDE_HIGHT 100
#define S_WORD(p) (*(int16_t *)(p))
#define DWORD(p) (*(uint32_t *)(p))
#define SIDE_SIZE 1024
#define K_HIGHT 512
struct { int xs[1],ys[1]; } patterns, *Mp=&patterns;
struct { int cosd[720],sind[720],GameMode,goal_count,cars_pos[4],replaying,vab_se,time,best_lap_time[24],cource_number,best_draw,etone,effectVoice; char *cource_tmd_addr; } Gsys;
unsigned char buffer[1024*1024], *cp, cource_buff[16];
unsigned char chip_pattern[512];
#define COURCE_PAT_ADDR chip_pattern
#define SND_DAMAGE 71
#define SND_POWUP 73
int chip_key_on,chip_key_off;
int SsUtKeyOn(int bank,int program,int tone,int note,int fine,int left,int right) { chip_key_on++;return 7; }
void SsUtKeyOff(int voice,int bank,int program,int tone,int note) { chip_key_off++; }
void SsUtSetVVol(int voice,int left,int right) {}
void get_record_time(char *text,int time) {}
void alphabet88(int x,int y,char *text) {}
void add_tmd(int n,int pat,unsigned char *v,int vc,unsigned char *norm,int nc,int scale) {}
'''
    body = '\n'.join([function(library, 'sqr_i'), function(original, 'normal_set'),
                      function(original, 'make_tmd_line'), function(original, 'make_tmd_circle'),
                      function(controller, 'car_getplate'), function(controller, 'car_gravide'),
                      function(controller, 'car_wallcheck'), function(controller2, 'car_bank'),
                      function(controller, 'car_preope'), function(controller2, 'car_rotation'),
                      function(controller, 'car_acceralate'), function(controller, 'car_resistance'),
                      function(controller, 'car_chipeffect')])
    wrapper = r'''
int generate(int circle,int xs,int ys,int *left,int *right,int *cosine,int16_t *out) {
    memset(buffer,0,sizeof(buffer)); memset(cource_buff,0,sizeof(cource_buff)); cp=buffer;
    Mp->xs[0]=xs; Mp->ys[0]=ys;
    for(int i=0;i<720;i++) { Gsys.cosd[i]=cosine[i]; Gsys.sind[i]=cosine[(i+540)%720]; }
    if(circle) {
        int cird[2][16]={{0}};
        for(int i=0;i<8;i++) { cird[0][i]=left[i]; cird[1][i]=right[i]; }
        make_tmd_circle(cird,0);
    } else {
        make_tmd_line(right[0],right[1],right[2],right[3],right[4],right[5],
                      left[0],left[1],left[2],left[3],left[4],left[5],0);
    }
    int count=(cp-buffer)/2;
    memcpy(out,buffer,cp-buffer);
    return count;
}
'''
    wrapper += r'''
unsigned char tables[12+28*200], *meshes[200];
void reset_parts() {
  for(int i=0;i<200;i++) { free(meshes[i]); meshes[i]=0; }
  memset(map_storage,0,sizeof(map_storage)); memset(tables,0,sizeof(tables));
  Gsys.cource_tmd_addr=(char*)tables; Gsys.goal_count=1;
}
void configure_part(int id,int xs,int ys,int next,int before,int *origin,int16_t *data,int count) {
  meshes[id]=malloc(count*2); memcpy(meshes[id],data,count*2);
  *(u_long*)(tables+12+28*id)=(u_long)meshes[id];
  *(u_long*)(tables+20+28*id)=(u_long)(meshes[id]+(xs+1)*(ys+2)*8);
  map_data[id].center=(VECTOR){origin[0],origin[1],origin[2],0};
  map_data[id].xdiv=xs;map_data[id].ydiv=ys;map_data[id].next=next;map_data[id].before=before;map_data[id].tmd_num=id;
}
void probe(int part,int column,int x,int z,int *result) {
  memset(cars,0,sizeof(cars)); cars[0].now_on=part;cars[0].now_chip_x=column;
  cars[0].pos=(VECTOR){x,-1000000,z,0};cars[0].weight=128;
  car_getplate(0);
  result[0]=cars[0].now_on;result[1]=cars[0].now_chip_x;result[2]=cars[0].now_chip_y;result[3]=!cars[0].cource_out;
  if(result[0]>=0) { car_gravide(0); result[4]=CRD_KAGE[0].coord.t[1]; }
}
'''
    wrapper += r'''
void wall_setup(int *input) {
  memset(cars,0,sizeof(cars));
  sound_count=last_tone=last_volume=debris_count=debris_calls=Trn.wall_ch=0;
  int part=input[0];cars[0].now_on=part;cars[0].now_chip_x=input[1];
  cars[0].pos=(VECTOR){input[2],input[3],input[4],0};
  cars[0].nposr=(VECTOR){input[5],input[6],input[7],0};
  cars[0].npos=(VECTOR){input[5]>>2,input[6]>>2,input[7]>>2,0};
  cars[0].inertia_forward=(VECTOR){input[8],input[9],input[10],0};
  cars[0].inertia_back=(VECTOR){input[11],input[12],input[13],0};
  cars[0].speed=input[14];cars[0].lev=input[15];Gsys.goal_count=input[16];cars[0].over=input[18];
  cars[0].VP=(SVECTOR*)meshes[part];
  cars[0].VN=(SVECTOR*)(meshes[part]+(map_data[part].xdiv+1)*(map_data[part].ydiv+2)*8);
}
void wall_result(int hit,int *result) {
  result[0]=hit;
  result[1]=cars[0].nposr.vx;result[2]=cars[0].nposr.vy;result[3]=cars[0].nposr.vz;
  result[4]=cars[0].inertia_forward.vx;result[5]=cars[0].inertia_forward.vy;result[6]=cars[0].inertia_forward.vz;
  result[7]=cars[0].inertia_back.vx;result[8]=cars[0].inertia_back.vy;result[9]=cars[0].inertia_back.vz;
  result[10]=cars[0].damage;result[11]=cars[0].l_distans;result[12]=cars[0].r_distans;
  result[13]=cars[0].lhit;result[14]=cars[0].rhit;result[15]=Trn.wall_ch;
  result[16]=sound_count;result[17]=last_tone;result[18]=last_volume;result[19]=debris_count;result[20]=debris_calls;
}
void wall_probe(int *input,int *result) {
  wall_setup(input); wall_result(car_wallcheck(0,input[17]),result);
}
void wall_move_probe(int *input,int *result) {
  wall_setup(input);
  cars[0].posr=(VECTOR){input[19],input[20],input[21],0};
  VECTOR v={(cars[0].inertia_forward.vx+cars[0].inertia_back.vx)>>2,
            (cars[0].inertia_forward.vy+cars[0].inertia_back.vy)>>2,
            (cars[0].inertia_forward.vz+cars[0].inertia_back.vz)>>2,0};
  cars[0].nposr=(VECTOR){cars[0].posr.vx+v.vx,cars[0].posr.vy+v.vy,cars[0].posr.vz+v.vz,0};
  if(input[22]) {
    cars[0].npos=(VECTOR){cars[0].nposr.vx>>2,cars[0].nposr.vy>>2,cars[0].nposr.vz>>2,0};
    car_wallcheck(0,1);
  }
  int hit,loops=0;
  do {
    cars[0].npos=(VECTOR){cars[0].nposr.vx>>2,cars[0].nposr.vy>>2,cars[0].nposr.vz>>2,0};
    hit=car_wallcheck(0,0);
    if(++loops>128) { result[0]=-999;return; }
  } while(hit);
  wall_result(0,result);
}

'''
    wrapper += r'''
void gravity_probe(int *input,int *result) {
  static int weight[6]={128,120,100,140,95,120};
  memset(cars,0,sizeof(cars));
  sound_count=last_tone=last_volume=0;
  DOBJ_KAGE[0].attribute=0x80000000;DOBJ_C[0].attribute=0;
  int part=input[0],xs=map_data[part].xdiv,ys=map_data[part].ydiv;
  cars[0].now_on=part;cars[0].now_chip_x=input[1];cars[0].now_chip_y=input[2];
  cars[0].now_chip=input[1]+input[2]*(xs+1);cars[0].cource_out=input[3];
  cars[0].VP=(SVECTOR*)meshes[part];cars[0].VN=(SVECTOR*)(meshes[part]+(xs+1)*(ys+2)*8);
  cars[0].pos=(VECTOR){input[4],input[5],input[6],0};
  cars[0].posr=(VECTOR){input[4]<<2,input[7],input[6]<<2,0};
  cars[0].status.vx=input[8];cars[0].car_type=input[9];cars[0].weight=weight[input[9]];
  cars[0].lev=input[10];cars[0].over=input[11];cars[0].tei=input[12];cars[0].damage=input[13];
  cars[0].inertia_forward=(VECTOR){input[16],input[14],input[17],0};
  cars[0].inertia_back=(VECTOR){input[18],input[15],input[19],0};cars[0].grip=input[20];
  car_gravide(0);
  if(input[21]) car_bank(0);
  result[0]=cars[0].over;result[1]=cars[0].pos.vy;result[2]=cars[0].posr.vy;
  result[3]=cars[0].inertia_forward.vy;result[4]=cars[0].inertia_back.vy;
  result[5]=cars[0].tei;result[6]=cars[0].damage;result[7]=cars[0].grip;
  result[8]=CRD_KAGE[0].coord.t[1];result[9]=(DOBJ_KAGE[0].attribute>>31)&1;result[10]=(DOBJ_C[0].attribute>>6)&1;
  result[11]=sound_count;result[12]=last_tone;result[13]=last_volume;
  result[14]=cars[0].inertia_forward.vx;result[15]=cars[0].inertia_forward.vz;
  result[16]=cars[0].inertia_back.vx;result[17]=cars[0].inertia_back.vz;
}
'''
    wrapper += r'''
int speed_probe(int *v) {
  cars[0].inertia_forward=(VECTOR){v[0],v[1],v[2],0};
  cars[0].inertia_back=(VECTOR){v[3],v[4],v[5],0};
  car_preope(1);return cars[0].speed;
}
'''
    wrapper += r'''
int air_roll_probe(int roll) {
  memset(cars,0,sizeof(cars));cars[0].status.vz=roll;cars[0].VN=(SVECTOR*)buffer;
  car_rotation(0);return cars[0].status.vz;
}
'''
    wrapper += r'''
void rotation_probe(int *input,int *result) {
  static int rudder[6]={32,24,32,33,32,20};
  memset(cars,0,sizeof(cars));
  cars[0].status=(SVECTOR){input[0],input[1],input[2],0};
  cars[0].statusk=(SVECTOR){input[3],input[4],input[5],0};
  cars[0].statusb=(SVECTOR){input[6],input[7],input[8],0};
  cars[0].speed=input[9];cars[0].radder_rot=input[10];cars[0].grip=input[11];cars[0].lev=input[12];
  cars[0].boost_wr=(input[13]==2 || input[13]==4) ? 0:64;cars[0].per_rot=rudder[input[13]];
  static SVECTOR normal;
  normal=(SVECTOR){input[14],input[15],input[16],0};cars[0].VN=&normal;map_data[0].xdiv=1;
  for(int i=0;i<9;i++) { CRD_C[0].coord.m[i/3][i%3]=input[17+i];CRD_KAGE[0].coord.m[i/3][i%3]=input[26+i]; }
  car_rotation(0);
  result[0]=cars[0].status.vx;result[1]=cars[0].status.vy;result[2]=cars[0].status.vz;
  result[3]=cars[0].statusk.vx;result[4]=cars[0].statusk.vy;result[5]=cars[0].statusk.vz;
  result[6]=cars[0].statusb.vx;result[7]=cars[0].statusb.vy;result[8]=cars[0].statusb.vz;
}
'''
    wrapper += r'''
void acceleration_probe(int *input,int *result) {
  static int side[6]={150,160,140,155,140,0},turn[6]={11,18,15,11,15,22};
  memset(cars,0,sizeof(cars));int type=input[0];
  cars[0].car_type=type;cars[0].speed=input[1];cars[0].turbo=input[2];cars[0].lev=input[3];cars[0].accer=input[4];
  cars[0].grip=input[5];cars[0].status.vy=input[6];cars[0].side_boost=side[type];cars[0].per_rot2=turn[type];cars[0].damage=input[7];
  cars[0].inertia_forward=(VECTOR){input[8],input[9],input[10],0};
  cars[0].inertia_back=(VECTOR){input[11],input[12],input[13],0};
  for(int i=0;i<9;i++) CRD_C[0].coord.m[i/3][i%3]=input[14+i];
  car_acceralate(0,input[23]);
  result[0]=cars[0].status.vy;result[1]=cars[0].damage;
  result[2]=cars[0].inertia_forward.vx;result[3]=cars[0].inertia_forward.vy;result[4]=cars[0].inertia_forward.vz;
  result[5]=cars[0].inertia_back.vx;result[6]=cars[0].inertia_back.vy;result[7]=cars[0].inertia_back.vz;
}
'''
    wrapper += r'''
void resistance_probe(int *input,int *result) {
  static int weights[6]={128,120,100,140,95,120},drag[6]={18000,17000,13000,22000,11000,32000};
  memset(cars,0,sizeof(cars));int type=input[0];
  cars[0].weight=weights[type];cars[0].resi1=drag[type];cars[0].brek=8;
  cars[0].speed=input[1];cars[0].breaking=input[2];cars[0].breaking2=input[3];
  cars[0].inertia_forward=(VECTOR){input[4],input[5],input[6],0};
  cars[0].inertia_back=(VECTOR){input[7],input[8],input[9],0};
  car_resistance(0);
  result[0]=cars[0].inertia_forward.vx;result[1]=cars[0].inertia_forward.vy;result[2]=cars[0].inertia_forward.vz;
  result[3]=cars[0].inertia_back.vx;result[4]=cars[0].inertia_back.vy;result[5]=cars[0].inertia_back.vz;
}
'''
    wrapper += r'''
void continuous_tile_probe(int *input,int *result) {
  memset(cars,0,sizeof(cars));memset(DOBJ_C,0,sizeof(DOBJ_C));
  memset(chip_pattern,input[0],sizeof(chip_pattern));
  int n=input[1];cars[n].grip=input[2];cars[n].lev=input[3];cars[n].damage=input[4];
  cars[n].over=input[5];cars[n].damageVoice=input[7];
  Gsys.time=input[6];Gsys.GameMode=0;Gsys.replaying=input[8];
  map_data[0].pat=0;map_data[0].xdiv=1;map_data[0].ydiv=1;
  DOBJ_C[n].attribute=(1<<6)+(1<<30);chip_key_on=chip_key_off=0;
  car_chipeffect(n);
  result[0]=cars[n].damage;result[1]=!!(DOBJ_C[n].attribute & (1<<6));
  result[2]=!!(DOBJ_C[n].attribute & (1<<30));result[3]=cars[n].breaking2;
  result[4]=cars[n].damageVoice;result[5]=chip_key_on;result[6]=chip_key_off;
}
'''
    source = Path(directory)/'original-geometry.c'
    source.write_text(header+body+wrapper)
    target = Path(directory)/'original-geometry.so'
    subprocess.run(['cc', '-std=c11', '-shared', '-fPIC', '-fwrapv', '-O0', str(source), '-o', str(target)], check=True)
    lib = ctypes.CDLL(str(target))
    lib.generate.argtypes = [ctypes.c_int]*3 + [ctypes.POINTER(ctypes.c_int)]*3 + [ctypes.POINTER(ctypes.c_int16)]
    lib.configure_part.argtypes = [ctypes.c_int]*5 + [ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int16), ctypes.c_int]
    lib.probe.argtypes = [ctypes.c_int]*4 + [ctypes.POINTER(ctypes.c_int)]
    lib.wall_probe.argtypes = [ctypes.POINTER(ctypes.c_int)]*2
    lib.wall_move_probe.argtypes = lib.wall_probe.argtypes
    lib.gravity_probe.argtypes = [ctypes.POINTER(ctypes.c_int)]*2
    lib.speed_probe.argtypes = [ctypes.POINTER(ctypes.c_int)]
    lib.air_roll_probe.argtypes = [ctypes.c_int]
    lib.rotation_probe.argtypes = [ctypes.POINTER(ctypes.c_int)]*2
    lib.acceleration_probe.argtypes = [ctypes.POINTER(ctypes.c_int)]*2
    lib.resistance_probe.argtypes = [ctypes.POINTER(ctypes.c_int)]*2
    lib.continuous_tile_probe.argtypes = [ctypes.POINTER(ctypes.c_int)]*2
    return lib


def main():
    tables = trig_tables()
    cos = (ctypes.c_int*720)(*tables[0])
    def asset(name):
        return json.loads((ROOT/'dist'/name).read_text().split('=',1)[1].removesuffix('\n').removesuffix(';'))
    exported = asset('tracks.js')
    vertices = normals = parts = contacts = 0
    jobs = []
    with tempfile.TemporaryDirectory(prefix='hover-original-geometry-') as directory:
        oracle = compile_oracle(directory)
        for script in sorted((ROOT/'extracted').glob('STG*.TXT')):
            patterns = parse_patterns(script.with_name(script.name.replace('STG','PTN')).read_text('cp932'))
            oracle.reset_parts()
            source_parts = parse_parts(script.read_text('cp932'))
            all_geometry = {}
            match = re.search(r'STG(\d)_(\d)', script.name)
            course = (int(match[1])-1)*3+int(match[2])-1
            track = exported[course]
            nodes = {(node['part'],node['partColumn']): (index,node) for index,node in enumerate(track['samples'])}
            for part in source_parts:
                xs, ys, _ = patterns[part['pat']]
                result = mesh(part['kind'], part['left'], part['right'], xs, ys, tables)
                left = (ctypes.c_int*8)(*part['left'])
                right = (ctypes.c_int*8)(*part['right'])
                out = (ctypes.c_int16*(1024*1024))()
                count = oracle.generate(part['kind']=='circle', xs, ys, left, right, cos, out)
                assert count == ((xs+1)*(ys+2)+xs*ys)*4
                for x, column in enumerate(result['columns']):
                    for y, vertex in enumerate(column):
                        offset = (y*(xs+1)+x)*4
                        expected = list(out[offset:offset+3])
                        assert vertex == expected, (script.name, part['id'], x, y, vertex, expected)
                        vertices += 1
                start = (xs+1)*(ys+2)*4
                for x, column in enumerate(result['normals']):
                    for y, normal in enumerate(column):
                        offset = start+(y*xs+x)*4
                        expected = list(out[offset:offset+3])
                        assert normal == expected, (script.name, part['id'], x, y, normal, expected)
                        normals += 1
                origin = (ctypes.c_int*3)(*result['origin'])
                oracle.configure_part(part['id'],xs,ys,part['next'],part['before'],origin,out,count)
                all_geometry[part['id']] = result
                for x in range(xs):
                    _, node = nodes[(part['id'],x)]
                    assert node['source'] == {'origin':result['origin'], 'vertices':result['columns'][x]}
                    assert node['end']['source'] == {'origin':result['origin'], 'vertices':result['columns'][x+1]}
                    assert node['sourceNormals'] == result['normals'][x]
                parts += 1
            cases = []
            for part in source_parts:
                data = all_geometry[part['id']]
                xs,ys,_ = patterns[part['pat']]
                for x in range(xs):
                    points = []
                    for y in range(ys):
                        corners = [data['columns'][col][row] for col,row in [(x,y),(x+1,y),(x,y+1),(x+1,y+1)]]
                        points.append([data['origin'][k]+sum(v[k] for v in corners)//2 for k in [0,2]])
                    if x in (0,xs-1):
                        for col in (x,x+1):
                            for row in (0,1,2,ys-2,ys-1,ys):
                                v=data['columns'][col][row]
                                for delta in (-1,0,1):
                                    points.append([data['origin'][0]+v[0]*2+delta,data['origin'][2]+v[2]*2+delta])
                    for px,pz in points:
                        result = (ctypes.c_int*5)()
                        oracle.probe(part['id'],x,px,pz,result)
                        if result[0]<0:
                            continue  # Outside the connected course.
                        index,_ = nodes[(part['id'],x)]
                        cases.append([index,px/100,pz/100,*list(result)])
                        contacts += 1
            jobs.append({'course':course,'cases':cases})
    subprocess.run(['node',str(ROOT/'tests/check-source-track-cases.ts')], input=json.dumps(jobs), text=True, check=True, cwd=ROOT)
    print(f'PASS: original C matches every vertex ({vertices}) and normal ({normals}) in {parts} parts / 9 courses, including {contacts} contact probes')


if __name__ == '__main__':
    main()
