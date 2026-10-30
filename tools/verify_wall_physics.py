"""Verify the wall solver against the actual CAR_CTR.C car_wallcheck body."""
import ctypes
import json
import subprocess
import tempfile
from track_geometry import ROOT, parse_parts, parse_patterns, trig_tables
from verify_track_geometry import compile_oracle


def main():
    cosine = (ctypes.c_int*720)(*trig_tables()[0])
    jobs = []
    count = 0
    with tempfile.TemporaryDirectory(prefix='hover-original-walls-') as directory:
        oracle = compile_oracle(directory)
        for training, name in [(False,'tracks.js'),(True,'training-tracks.js')]:
            tracks = json.loads((ROOT/'dist'/name).read_text().split('=',1)[1].strip().removesuffix(';'))
            for course, track in enumerate(tracks):
                group, race = divmod(course, 5 if training else 3)
                script = ROOT/'extracted'/f'{"T" if training else ""}STG{group+1}_{race+1}.TXT'
                patterns = parse_patterns(script.with_name(script.name.replace('STG','PTN')).read_text('cp932'))
                oracle.reset_parts()
                for part in parse_parts(script.read_text('cp932')):
                    xs,ys,_ = patterns[part['pat']]
                    left = (ctypes.c_int*8)(*part['left'])
                    right = (ctypes.c_int*8)(*part['right'])
                    data = (ctypes.c_int16*(1024*1024))()
                    size = oracle.generate(part['kind']=='circle',xs,ys,left,right,cosine,data)
                    origin = part['left'][:3] if part['kind']=='line' else [part['left'][0],0,part['left'][1]]
                    oracle.configure_part(part['id'],xs,ys,part['next'],part['before'],(ctypes.c_int*3)(*origin),data,size)
                sizes = {p['id']:sum(n['part']==p['id'] for n in track['samples']) for p in track['parts']}
                cases = []
                for index,node in enumerate(track['samples']):
                    ys = len(node['allTiles'])
                    x = node['partColumn']
                    variants = [(224,0,0,0,400,0)]
                    if x in (0,sizes[node['part']]//2,sizes[node['part']]-1):
                        variants += [(0,0,0,0,400,0),(80,0,0,0,0,0),(81,0,0,0,2,0),
                                     (223,0,0,0,400,0),(2000,0,0,0,400,0),(500,0,1,0,400,0),
                                     (500,8,0,1,-2,0),(500,8,0,0,400,0),(224,0,0,0,2,-256),
                                     (224,0,0,0,1,0),(224,0,0,1,400,0)]
                    origin = node['source']['origin']
                    vertices = node['source']['vertices']
                    end = node['end']['source']['vertices']
                    for right in (False,True):
                        for speed,lev,goal,mode,altitude,over in variants:
                            row = ys-2-mode if right else 2+mode
                            normal = node['sourceNormals'][ys-2 if right else 1]
                            anchor = [origin[k]+vertices[row][k]+end[row][k] for k in range(3)]
                            crest_y = origin[1]+vertices[ys-1 if right else 1][1]*2
                            old = [round(anchor[0]+normal[0]*300/4096),crest_y-200+altitude,round(anchor[2]+normal[2]*300/4096)]
                            proposed = [round((anchor[k]-normal[k]*200/4096)*4)+(index%4) for k in range(3)]
                            proposed[1] = old[1]*4+33
                            front = [x*139-1999,-333,x*307-3501]
                            rear = [x*31-477,217,x*83+911]
                            values = [node['part'],x,*old,*proposed,*front,*rear,speed,lev,goal,mode,over]
                            result = (ctypes.c_int*21)()
                            oracle.wall_probe((ctypes.c_int*len(values))(*values),result)
                            values.extend([v*4+(index%4) for v in old])
                            for enemy in ((False,True) if goal and not lev else (bool(lev or goal),)):
                                routed = [*values,int(enemy)]
                                movement = (ctypes.c_int*21)()
                                oracle.wall_move_probe((ctypes.c_int*len(routed))(*routed),movement)
                                assert movement[0] != -999, (track['name'],index,routed,'original correction loop did not terminate')
                                cases.append([index,routed,list(result),list(movement)])
                                count += 1
                jobs.append({'training':training,'course':course,'cases':cases})
    subprocess.run(['node',str(ROOT/'tests/check-source-wall-cases.cjs')], input=json.dumps(jobs),text=True,check=True,cwd=ROOT)
    print(f'PASS: original car_wallcheck matches {count} wall probes and {count} movement/correction cases on all 24 courses')


if __name__ == '__main__':
    main()
