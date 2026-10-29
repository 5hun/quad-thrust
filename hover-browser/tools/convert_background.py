"""COURCE.C sfname / get_bgcolor; GAME.C back_draw source image bank."""
import struct,json
from convert_tim import convert,ROOT
banks=[(['NIGHT0A','NIGHT0B','NIGHT0C'],['SEA01','SEA01B','SEA01C']),(['ROCK_U0','ROCK_U1','ROCK_U2'],['ROCK_D0','ROCK_D1','ROCK_D2']),(['SKY13A','SKY13B','SKY13C'],['SEA_KEIA','SEA_KEIB','SEA_KEIC']),(['BGT0','BGT1','BGT2'],['TOWNA','TOWNB','TOWNC']),(['SABAKU0','SABAKU1','SABAKU2'],['SABA_T1','SABA_T2','SABA_T3'])]
def tim(name):
 d=(ROOT/'extracted'/f'{name}.TIM').read_bytes();size,x,y,w,h=struct.unpack_from('<I4H',d,8);palette=struct.unpack_from('<'+'H'*(w*h),d,20);p=8+size;size,x,y,w,h=struct.unpack_from('<I4H',d,p);return palette,d[p+12:p+size]
def rgb(word):return [(word&31)<<3,((word>>5)&31)<<3,((word>>10)&31)<<3]
result=[]
for sky,ground in banks:
 for n in sky+ground:convert(n)
 pal,data=tim(sky[0]);gp,_=tim(ground[2]);result.append(dict(sky=sky,ground=ground,top=rgb(pal[data[56]]),bottom=rgb(gp[5])))
(ROOT/'dist/backgrounds.js').write_text('window.HOVER_BACKGROUNDS='+json.dumps(result,separators=(',',':'))+';\n')
print('Converted all 5 original sky / ground banks (30 TIM files)')
