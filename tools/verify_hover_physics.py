"""Compare hovering, landing, falling and bank forces with original C bodies."""
import ctypes
import json
import subprocess
import tempfile
import random
from track_geometry import ROOT, parse_parts, parse_patterns, trig_tables
from verify_track_geometry import compile_oracle


def main():
    cosine = (ctypes.c_int*720)(*trig_tables()[0])
    variants = [(-151,0,0,0),(-150,0,0,0),(-1,0,0,0),(0,0,0,0),(1,0,0,0),
                (69,0,0,0),(70,0,0,0),(99,0,0,0),(100,0,0,0),(101,0,0,0),
                (612,0,0,0),(611,0,0,0),(100,16,0,0),(99,60,0,0),
                (100,0,8,0),(612,0,8,0),(100,0,0,-256),(612,16,0,-1),
                (100,0,0,300),(-1,1,0,0)]
    jobs=[]
    count=0
    with tempfile.TemporaryDirectory(prefix='hover-original-hover-') as directory:
        oracle=compile_oracle(directory)
        rng=random.Random(31997)
        speeds=[]
        vectors=[[0]*6,[0,0,1600,0,0,1600]]
        vectors += [[v,0,0,0,0,0] for v in range(-300,301)]
        vectors += [[rng.randint(-24000,24000) for _ in range(6)] for _ in range(12000)]
        vectors += [[rng.randint(-2147483648,2147483647) for _ in range(6)] for _ in range(1000)]
        for values in vectors:
            speeds.append([values,oracle.speed_probe((ctypes.c_int*6)(*values))])
        rolls=[[v,oracle.air_roll_probe(v)] for v in range(-32768,32768)]
        for training,name in [(False,'tracks.js'),(True,'training-tracks.js')]:
            tracks=json.loads((ROOT/'dist'/name).read_text().split('=',1)[1].strip().removesuffix(';'))
            for course,track in enumerate(tracks):
                group,race=divmod(course,5 if training else 3)
                script=ROOT/'extracted'/f'{"T" if training else ""}STG{group+1}_{race+1}.TXT'
                patterns=parse_patterns(script.with_name(script.name.replace('STG','PTN')).read_text('cp932'))
                oracle.reset_parts()
                sizes={}
                for part in parse_parts(script.read_text('cp932')):
                    xs,ys,_=patterns[part['pat']]
                    sizes[part['id']]=xs
                    left=(ctypes.c_int*8)(*part['left'])
                    right=(ctypes.c_int*8)(*part['right'])
                    data=(ctypes.c_int16*(1024*1024))()
                    size=oracle.generate(part['kind']=='circle',xs,ys,left,right,cosine,data)
                    origin=part['left'][:3] if part['kind']=='line' else [part['left'][0],0,part['left'][1]]
                    oracle.configure_part(part['id'],xs,ys,part['next'],part['before'],(ctypes.c_int*3)(*origin),data,size)
                cases=[]
                for index,node in enumerate(track['samples']):
                    if node['partColumn'] not in (0,sizes[node['part']]//2,sizes[node['part']]-1):
                        continue
                    ys=len(node['allTiles'])
                    origin=node['source']['origin']
                    for row in sorted({0,1,2,ys//2,ys-3,ys-2,ys-1}):
                        corners=[boundary['source']['vertices'][y] for boundary in (node,node['end']) for y in (row,row+1)]
                        x,z=[origin[k]+sum(v[k] for v in corners)//2 for k in (0,2)]
                        for outside in ((False,True) if row in (0,ys-1) else (False,)):
                            base=[node['part'],node['partColumn'],row,int(outside),x,-1000000,z,-4000000,0,0,0,0,0,0,0,0,-1881,2973,1933,-799,0,0]
                            result=(ctypes.c_int*18)()
                            oracle.gravity_probe((ctypes.c_int*len(base))(*base),result)
                            target=result[8]-200
                            for j,(depth,tei,lev,over) in enumerate(variants):
                                # Outside death is 2048 below hover target, rather than
                                # 612 below it; sample both exact outside boundaries too.
                                depth=2048-(j%2) if outside and depth in (611,612) else depth
                                y=target+depth
                                values=base.copy()
                                values[5]=y;values[7]=y*4+j%4
                                values[8]=[-4096,-2049,-2048,-227,-1,0,1,227,2047,4095][j%10]
                                values[9]=(index+j)%6;values[10]=lev;values[11]=over;values[12]=tei;values[13]=777
                                values[14]=[0,249,250,1000,-1000][j%5];values[15]=[0,250,250,-777,1000][j%5]
                                values[20]=j%2;values[21]=j%2
                                oracle.gravity_probe((ctypes.c_int*len(values))(*values),result)
                                cases.append([index,values,list(result)])
                                count+=1
                jobs.append({'training':training,'course':course,'cases':cases})
    subprocess.run(['node',str(ROOT/'tests/check-source-hover-cases.ts')],input=json.dumps({"jobs":jobs,"speeds":speeds,"rolls":rolls}),text=True,check=True,cwd=ROOT)
    print(f'PASS: original car_gravide / car_bank match {count} cases on all 24 courses; car_preope matches {len(speeds)} speed cases and {len(rolls)} airborne roll cases')


if __name__=='__main__':
    main()
