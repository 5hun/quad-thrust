"""Decode PS1 4/8/16-bit TIM images to PNG without dependencies."""
from pathlib import Path
import struct,zlib
ROOT=Path(__file__).resolve().parents[1]
def convert(name):
 d=(ROOT/'extracted'/f'{name}.TIM').read_bytes();magic,flags=struct.unpack_from('<II',d);assert magic==16
 pos=8;pal=[]
 def rgba(v):return bytes(((v&31)*255//31,((v>>5)&31)*255//31,((v>>10)&31)*255//31,255))
 if flags&8:
  size,x,y,w,h=struct.unpack_from('<I4H',d,pos);pal=[rgba(struct.unpack_from('<H',d,pos+12+i*2)[0]) for i in range(w*h)];pos+=size
 size,x,y,w,h=struct.unpack_from('<I4H',d,pos);data=d[pos+12:pos+size];mode=flags&7;out=bytearray();width=w*(4 if mode==0 else 2 if mode==1 else 1)
 for row in range(h):
  out.append(0)
  for col in range(width):
   if mode==0:v=data[row*w*2+col//2];out.extend(pal[(v>>(4*(col%2)))&15])
   elif mode==1:out.extend(pal[data[row*w*2+col]])
   elif mode==2:out.extend(rgba(struct.unpack_from('<H',data,(row*width+col)*2)[0]))
   else:raise ValueError(mode)
 def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',width,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(out))+chunk(b'IEND',b'')
 (ROOT/'dist/assets').mkdir(exist_ok=True);(ROOT/'dist/assets'/f'{name}.png').write_bytes(png)
for name in ['NIGHT0A','NIGHT0B','NIGHT0C','ROCK_U0','ROCK_U1','ROCK_U2','SEA_KEIA','SKY13A','SKY13B','SKY13C','BGT0','BGT1','BGT2','SABAKU0','SABAKU1','SABAKU2']:convert(name)
