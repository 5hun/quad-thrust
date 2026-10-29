"""Port of HOVER_SOURCE/UNPACK.C; validates the original additive checksums."""
from pathlib import Path
import struct
ROOT=Path(__file__).resolve().parents[1]
def unpack(data,size):
 bit=0; out=bytearray()
 def take(n):
  nonlocal bit
  v=(int.from_bytes(data[bit//8:bit//8+5],'little')>>(bit%8))&((1<<n)-1);bit+=n;return v
 table=[take(3) for _ in range(5)]
 while len(out)<size:
  k=next((i for i in range(14) if 1<<i>len(out)-2),14)
  code=0
  while code<4 and take(1):code+=1
  mode=table[code]
  if mode==0:out.append(take(8));continue
  if mode==4:
   word=take(16).to_bytes(2,'little');out.extend(word*take(12));continue
  n=take([0,2,4,9][mode])+[0,2,3,19][mode]
  back=take(min(k,8) if mode==1 else k)+2
  assert back<=len(out)
  for _ in range(n):out.append(out[-back])
 return bytes(out[:size])
def scan(data):
 pos=0
 while True:
  pos=data.find(b'Lzs5',pos)
  if pos<0:return
  name=data[pos+4:pos+16].split(b'\0')[0].decode('ascii')
  flag,date,size,packed,check=struct.unpack_from('<5I',data,pos+16)
  if size>5000000 or packed>len(data)-pos-36:pos+=4;continue
  raw=data[pos+36:pos+36+packed];raw=unpack(raw,size) if flag else raw[:size]
  assert sum(raw)==check,(name,sum(raw),check)
  (ROOT/'extracted'/name).write_bytes(raw)
  print(name,len(raw))
  if b'Lzs5' in raw:scan(raw)
  pos+=36+packed
if __name__=='__main__':scan((ROOT.parent/'HOVER120/HOVER.PAC').read_bytes())
