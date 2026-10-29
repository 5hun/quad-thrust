"""Original PS1 SEQ events and BGM_I VAB samples; no replacement music."""
from pathlib import Path
import struct,wave,json
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'dist/assets'
h=(ROOT/'extracted/BGM_I.VH').read_bytes();vb=(ROOT/'extracted/BGM_I.VB').read_bytes()
np,nt,nv=struct.unpack_from('<3H',h,18);sizes=struct.unpack_from('<256H',h,2080+np*512);offset=sizes[0]*8;samples={}
for i in range(1,nv+1):
 data=vb[offset:offset+sizes[i]*8];offset+=sizes[i]*8;pcm=[];last=last2=0;start=0;repeat=False
 for j in range(0,len(data),16):
  b=data[j:j+16];shift=b[0]&15;a,c=[(0,0),(60,0),(115,-52),(98,-55),(122,-60)][b[0]>>4]
  if b[1]&4:start=len(pcm)
  for v in b[2:]:
   for n in [v&15,v>>4]:
    if n>=8:n-=16
    s=max(-32768,min(32767,((n<<12)>>shift)+((last*a+last2*c+32)>>6)));pcm.append(s);last2,last=last,s
  if b[1]&1:repeat=bool(b[1]&2);break
 name=f'bgm-{i}.wav'
 with wave.open(str(out/name),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100);w.writeframes(struct.pack('<'+'h'*len(pcm),*pcm))
 samples[i]=dict(file=name,loop=repeat,loopStart=start/44100,loopEnd=len(pcm)/44100)
assert offset==len(vb)
programs={};active=0
for i in range(128):
 p=h[32+i*16:48+i*16]
 if not p[0]:continue
 tones=[]
 for j in range(p[0]):
  t=h[2080+active*512+j*32:2112+active*512+j*32]
  tones.append(dict(sample=struct.unpack_from('<H',t,22)[0],volume=p[1]*t[2]/127**2,pan=t[3],center=t[4],shift=t[5],min=t[6],max=t[7],adsr1=struct.unpack_from('<H',t,16)[0],adsr2=struct.unpack_from('<H',t,18)[0]))
 programs[i]=tones;active+=1
songs={}
for name in ['SAMPLE15','HOVER2','TO7','HOVER4','SAMPLE16','B','SELECT','ENTRY1','SAMPLE19','CANION','SAMPLE26','SAMPLE21']:
 d=(ROOT/'extracted'/f'{name}.SEQ').read_bytes();assert d[:4]==b'pQES';ppqn=int.from_bytes(d[8:10],'big');tempo=int.from_bytes(d[10:13],'big');pos=15;status=0;seconds=0;events=[];end=False
 def byte():
  global pos
  v=d[pos];pos+=1;return v
 def vlq():
  v=0
  while True:
   b=byte();v=(v<<7)|(b&127)
   if b<128:return v
 while pos<len(d):
  seconds+=vlq()*tempo/ppqn/1e6
  if d[pos]&128:status=byte()
  if status==255:
   meta=byte()
   # Sony SEQ omits the standard MIDI meta-event length byte.
   if meta==81:tempo=int.from_bytes(d[pos:pos+3],'big');pos+=3
   elif meta==47:
    if pos<len(d) and d[pos]==0:pos+=1
    end=True;break
   else:raise ValueError((name,pos,meta))
  else:
   assert 0x80<=status<0xf0,(name,pos,status)
   size=1 if status>>4 in (12,13) else 2
   args=[byte() for _ in range(size)];assert all(x<128 for x in args),(name,pos,args)
   events.append([round(seconds,6),status,*args])
 assert end and seconds>0
 songs[name]=dict(duration=round(seconds,6),events=events)
 print(name,round(seconds,2),'seconds',len(events),'events')
(ROOT/'dist/music.js').write_text('window.HOVER_MUSIC='+json.dumps(dict(samples=samples,programs=programs,songs=songs,courses=['SAMPLE15','HOVER2','TO7','SAMPLE15','HOVER2','HOVER4','TO7','HOVER4','SAMPLE16']),separators=(',',':'))+';\n')
