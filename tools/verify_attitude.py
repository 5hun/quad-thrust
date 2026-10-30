"""Compare the complete car_rotation controller against the supplied original C.

Matrices are explicit inputs: this proves the controller's arithmetic and
ordering, independently of the still-unverified Net Yaroze SDK trig routines.
"""
import ctypes
import json
import math
import random
import subprocess
import tempfile
from track_geometry import ROOT
from verify_track_geometry import compile_oracle


def matrix(rng):
    # Valid rotated bases sampled independently in double precision, then
    # quantized as input. They are not an oracle for SDK matrix construction.
    x,y,z=[rng.uniform(-math.pi,math.pi) for _ in range(3)]
    sx,cx,sy,cy,sz,cz=math.sin(x),math.cos(x),math.sin(y),math.cos(y),math.sin(z),math.cos(z)
    return [round(v*4096) for v in [cy*cz+sy*sx*sz,-cy*sz+sy*sx*cz,sy*cx,
            cx*sz,cx*cz,-sx,-sy*cz+cy*sx*sz,sy*sz+cy*sx*cz,cy*cx]]


def main():
    rng=random.Random(1997)
    cases=[]
    identity=[4096,0,0,0,4096,0,0,0,4096]
    with tempfile.TemporaryDirectory(prefix='hover-original-attitude-') as directory:
        oracle=compile_oracle(directory)
        values=[]
        for side in (-601,-600,-599,-41,-40,-39,0,39,40,41,599,600,601):
            for forward in (-41,-40,-39,0,39,40,41):
                for speed in (0,4,5,80,224,2047):
                    for grip,lev in ((0,0),(1,0),(0,8),(1,8)):
                        values.append([0,2047,0,0,0,0,0,-2048,0,speed,242,grip,lev,0,side,-4096,forward,*identity,*identity])
        for i in range(24000):
            angles=[rng.randint(-32768,32767) for _ in range(9)]
            speed=rng.randint(0,2047);rudder=rng.randint(-242,242)
            normal=[rng.randint(-4096,4096) for _ in range(3)]
            if i%5==0:
                body=[rng.randint(-32768,32767) for _ in range(9)]
                shadow=[rng.randint(-32768,32767) for _ in range(9)]
            else:
                body,shadow=matrix(rng),matrix(rng)
            values.append([*angles,speed,rudder,i%2,0 if i%3 else 8,i%6,*normal,*body,*shadow])
        for v in values:
            result=(ctypes.c_int*9)()
            oracle.rotation_probe((ctypes.c_int*35)(*v),result)
            cases.append([v,list(result)])
        accelerations=[]
        speeds=(0,4,5,63,64,80,81,223,224,1000,1999,2000,2001,2047)
        inputs=[]
        for machine in range(6):
            for speed in speeds:
                for mode in range(5):
                    for grip in (0,1):
                        for turbo in (0,1,2,128,255,256):
                            for lev in (0,1,2,8):
                                for catch in (0,1):
                                    inputs.append([machine,speed,turbo,lev,catch,grip,32767,777,101,-217,331,-443,557,-661,*matrix(rng),mode])
        for i in range(10000):
            m=[rng.randint(-32768,32767) for _ in range(9)] if i%5==0 else matrix(rng)
            inputs.append([i%6,rng.randint(-4,2500),rng.randint(0,300),[0,1,2,8][i%4],i%2,(i//2)%2,rng.randint(-32768,32767),rng.randint(-2147483648,2147483647),
                *[rng.randint(-2147483648,2147483647) for _ in range(6)],*m,i%5])
        for v in inputs:
            result=(ctypes.c_int*8)()
            oracle.acceleration_probe((ctypes.c_int*24)(*v),result)
            accelerations.append([v,list(result)])
    subprocess.run(['node',str(ROOT/'tests/check-source-attitude-cases.ts')],input=json.dumps({'rotations':cases,'accelerations':accelerations}),text=True,check=True,cwd=ROOT)
    print(f'PASS: original car_rotation matches {len(cases)} cases and car_acceralate matches {len(accelerations)} cases with explicit matrices')


if __name__=='__main__':
    main()
