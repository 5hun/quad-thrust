"""Decode SE.VB SPU ADPCM samples, indexed by the original SE.VH VAB programs."""
from pathlib import Path
import struct,wave,json
ROOT=Path(__file__).resolve().parents[1];h=(ROOT/'extracted/SE.VH').read_bytes();vb=(ROOT/'extracted/SE.VB').read_bytes();out=ROOT/'dist/assets';nprog,ntone,nvag=struct.unpack_from('<3H',h,18)
sizes=struct.unpack_from('<256H',h,32+128*16+nprog*16*32);samples={};offset=sizes[0]*8
filters=[(0,0),(60,0),(115,-52),(98,-55),(122,-60)]
for i in range(1,nvag+1):
 data=vb[offset:offset+sizes[i]*8];offset+=sizes[i]*8;pcm=[];last=last2=0;loop_start=0;loop_end=0
 for j in range(0,len(data),16):
  block=data[j:j+16]
  if len(block)<16:break
  shift=block[0]&15;filt=block[0]>>4;flag=block[1];assert filt<5
  if flag&4:loop_start=len(pcm)
  a,b=filters[filt]
  for packed in block[2:]:
   for n in [packed&15,packed>>4]:
    if n>=8:n-=16
    value=((n<<12)>>shift)+((last*a+last2*b+32)>>6);value=max(-32768,min(32767,value));pcm.append(value);last2=last;last=value
  if flag&1:loop_end=len(pcm);break
 path=out/f'se-{i}.wav'
 with wave.open(str(path),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100);w.writeframes(struct.pack('<'+'h'*len(pcm),*pcm))
 samples[i]={'file':path.name,'loop':bool(flag&2),'loopStart':loop_start/44100,'loopEnd':(loop_end or len(pcm))/44100}
meta={};active=0
for i in range(128):
 tones=h[32+i*16]
 if not tones:continue
 tone=h[2080+active*512:2080+active*512+32];vag=struct.unpack_from('<H',tone,22)[0];meta[i]={**samples[vag],'note':tone[4],'shift':tone[5],'volume':h[33+i*16]*tone[2]/127**2,'pan':tone[3],'adsr1':struct.unpack_from('<H',tone,16)[0],'adsr2':struct.unpack_from('<H',tone,18)[0]};active+=1
assert offset==len(vb),(offset,len(vb));(ROOT/'dist/sounds.js').write_text('window.HOVER_SOUNDS='+json.dumps(meta)+';\n');print('Converted',len(meta),'original effect programs')
