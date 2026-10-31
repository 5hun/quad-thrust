"""Decode original TMD packets and TIM VRAM; preserve faces, normals, UVs and CLUTs.
Packet layout is cross-checked against MAKEMAP.C and PS1 TMD documentation.
"""
from pathlib import Path
import struct,json,zlib,collections
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'dist/assets';OUT.mkdir(exist_ok=True)
vram=[0]*(1024*512)
def upload(name):
 d=(ROOT/'extracted'/f'{name}.TIM').read_bytes();p=8
 while p<len(d):
  size,x,y,w,h=struct.unpack_from('<I4H',d,p);values=struct.unpack_from('<'+'H'*(w*h),d,p+12)
  for r in range(h):vram[(y+r)*1024+x:(y+r)*1024+x+w]=values[r*w:(r+1)*w]
  p+=size
for name in ['CARS','ROAD','KABE','FONTS','TITLE','FNT1','CAR_MINI']:upload(name)
def rgba(v):return bytes(((v&31)*255//31,((v>>5)&31)*255//31,((v>>10)&31)*255//31,0 if v==0 else 255))
def png(path,w,h,data):
 raw=b''.join(b'\0'+data[y*w*4:(y+1)*w*4] for y in range(h))
 def ch(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
 path.write_bytes(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>2I5B',w,h,8,6,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b''))
def pixel(page,clut,u,v):
 x=(page&15)*64;y=((page>>4)&1)*256;depth=(page>>7)&3
 if depth==2:return vram[(y+v)*1024+x+u]
 div=4 if depth==0 else 2;word=vram[(y+v)*1024+x+u//div];index=(word>>((u%div)*(4 if depth==0 else 8)))& (15 if depth==0 else 255)
 return vram[(clut>>6)*1024+(clut&63)*16+index]
texs={}
def texture(page,clut):
 key=f'tpage-{page:03x}-{clut:04x}'
 if key not in texs:
  data=b''.join(rgba(pixel(page,clut,u,v)) for v in range(256) for u in range(256));png(OUT/(key+'.png'),256,256,data);texs[key]=True
 return key+'.png'
models={}
for name in ['XVN_CAR','XVP_CAR','SVS_CAR','JUSTER','XXX_CAR','OTHER','ALP_0_9','ALP_A_O','ALP_P_O']:
 d=(ROOT/'extracted'/f'{name}.TMD').read_bytes();magic,flags,count=struct.unpack_from('<III',d);assert magic==65 and flags==0
 objects=[]
 for obj in range(count):
  vp,nv,np,nn,pp,nprim,scale=struct.unpack_from('<7I',d,12+obj*28)
  verts=[struct.unpack_from('<3h',d,12+vp+i*8) for i in range(nv)]
  normals=[struct.unpack_from('<3h',d,12+np+i*8) for i in range(nn)]
  groups={};ptr=12+pp
  for j in range(nprim):
   olen,ilen,flag,mode=struct.unpack_from('4B',d,ptr);packet=d[ptr+4:ptr+4+ilen*4];ptr+=4+ilen*4
   assert mode&0xe0==0x20,(name,obj,hex(mode))
   n=4 if mode&8 else 3;tex=bool(mode&4);gouraud=bool(mode&16);pos=0;uv=[];color=[1,1,1];key='solid'
   if tex:
    for k in range(n):uv.append([packet[pos]/256,1-packet[pos+1]/256]);pos+=4
    clut=struct.unpack_from('<H',packet,2)[0];page=struct.unpack_from('<H',packet,6)[0];key=texture(page,clut)
   else:color=[x/255 for x in packet[:3]];pos=4
   ids=[];ns=[];normal=0
   for k in range(n):
    if not flag&1 and (k==0 or gouraud):normal=struct.unpack_from('<H',packet,pos)[0];pos+=2
    vi=struct.unpack_from('<H',packet,pos)[0];pos+=2;assert vi<nv,(name,obj,j,vi,nv);ids.append(vi);ns.append(normal)
   if mode&2:key+='|semi'
   group=groups.setdefault(key,{'position':[],'normal':[],'color':[],'uv':[]})
   # Quads are stored as a strip 0,1,2,3; Y reflection reverses winding.
   for k in ([0,2,1,1,2,3] if n==4 else [0,2,1]):
    x,y,z=verts[ids[k]];group['position'] += [x/100,-y/100,z/100]
    if normals:
     x,y,z=normals[ns[k]];group['normal'] += [x/4096,-y/4096,z/4096]
    else:group['normal'] += [0,1,0]
    group['color']+=color;group['uv']+=uv[k] if tex else [0,0]
  objects.append(groups)
 models[name]=objects
 print(name, 'objects',len(objects),'triangles',sum(len(g['position'])//9 for o in objects for g in o.values()))
# Original 24 tiles, including four curb/wall rows omitted by v1.
for t in range(24):
 u=((t&15)>>2)*32;v=(t>>4)*128+(t&3)*32
 data=b''.join(rgba(pixel(0x95,(484+t//16)<<6,u+x,v+y)) for y in range(32) for x in range(32));png(OUT/f'tile-{t}.png',32,32,data)
(ROOT/'dist/models.js').write_text('window.HOVER_MODELS='+json.dumps(models,separators=(',',':'))+';\n')
print('Texture pages',len(texs))
