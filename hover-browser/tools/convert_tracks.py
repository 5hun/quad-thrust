"""Convert original STG/PTN line/ellipse commands from MAKEMAP.C to browser data."""
from pathlib import Path
import re,json,math
ROOT=Path(__file__).resolve().parents[1]
names=['Gulf City','Penta Rock','Ice Gate','KNight Town',"Rollin’Stone",'Misty Arc','White Cutter','Highway Star','Desert Gora']
tracks=[];training=[]
work=[(i,n,False) for i,n in enumerate(names)]+[(i,f'TRAINING {i//5+1}-{i%5+1}',True) for i in range(15)]
for idx,name,is_training in work:
 key=f'{idx//5+1}_{idx%5+1}' if is_training else f'{idx//3+1}_{idx%3+1}'
 prefix='T' if is_training else ''
 text=(ROOT/'extracted'/f'{prefix}STG{key}.TXT').read_text('cp932')
 ptn=(ROOT/'extracted'/f'{prefix}PTN{key}.TXT').read_text('cp932')
 patterns={}
 for b in re.split(r'^\*(?=\d)' ,ptn,flags=re.M)[1:]:
  lines=b.splitlines(); n=int(lines[0]);xs,ys=map(int,lines[1].split(','));patterns[n]=(xs,ys,lines[2:2+ys])
 parts={}
 for b in re.split(r'^\*(?=\d)' ,text,flags=re.M)[1:]:
  lines=b.splitlines(); n=int(lines[0]);pat=int(re.search(r'^PAT[ \t]*(\d*)',b,re.M)[1] or 0); xs,ys,rows=patterns[pat]
  circle='#CIRCLE' in b
  sides=[]
  for side in 'LR':
   line=next(l for l in lines if l.startswith('CIRCLE-'+side if circle else side+' '))
   v=list(map(int,re.findall(r'-?\d+',line)))
   points=[]
   for j in range(xs+1):
    t=j/xs
    if circle:
     # The original uses the opposite boundary's angle; authored tracks share angles.
     other=next(l for l in lines if l.startswith('CIRCLE-'+('R' if side=='L' else 'L')))
     ov=list(map(int,re.findall(r'-?\d+',other)));a=math.radians(ov[4]+(ov[5]-ov[4])*t)
     p=[v[0]+v[2]*math.cos(a),v[6]+(v[7]-v[6])*t,v[1]+v[3]*math.sin(a)]
    else:p=[v[k]+(v[k+3]-v[k])*t for k in range(3)]
    points.append([round(p[0]/100,4),round(-p[1]/100,4),round(p[2]/100,4)])
   sides.append(points)
  nxt=re.search(r'^NEXT (\d+)',b,re.M)
  parts[n]={'next':int(nxt[1]) if nxt else n+1,'samples':[{'l':sides[0][j],'r':sides[1][j],'tiles':''.join(rows[y][j] for y in range(2,ys-2)),'allTiles':''.join(rows[y][j] for y in range(ys)),'part':n,**({'end':{'l':sides[0][j+1],'r':sides[1][j+1]}} if is_training else {})} for j in range(xs)]}
 samples=[];i=0;seen=set()
 while i not in seen and i in parts:
  seen.add(i);samples+=parts[i]['samples'];i=parts[i]['next']
 assert len(seen)==len(parts),(name,len(seen),len(parts))
 start=next((i for i,s in enumerate(samples) if 'g' in s['tiles']),0)
 if not is_training:samples=samples[start:]+samples[:start]
 (training if is_training else tracks).append({'name':name,'theme':idx%5 if is_training else [0,1,2,0,1,3,2,3,4][idx],'training':is_training,'samples':samples})
 print(name,len(samples))
(ROOT/'dist'/'tracks.js').write_text('window.HOVER_TRACKS='+json.dumps(tracks,separators=(',',':'))+';\n')

(ROOT/'dist'/'training-tracks.js').write_text('window.HOVER_TRAINING_TRACKS='+json.dumps(training,separators=(',',':'))+';\n')
