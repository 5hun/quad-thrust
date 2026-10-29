"""Recreate flamebuff_init's VRAM copies, using original FNT1 and FONTS TIMs."""
from convert_models import vram,png,rgba,pixel,OUT,upload
# Copy packed 4-bit glyph words, exactly as alphabet88/alphabet16.
def alphabet(x,y,text,size):
 for i,c in enumerate(text):
  t=ord(c)-32
  sx=384+(t//16)*2 if size==8 else 416+(t//8)*4
  sy=384+(t%16)*8 if size==8 else 384+(t%8)*16
  words=size//4
  for row in range(size):vram[(y+row)*1024+x+i*words:(y+row)*1024+x+(i+1)*words]=vram[(sy+row)*1024+sx:(sy+row)*1024+sx+words]
for x,y,s,n in [(576,384,'01234567',16),(576,400,'89',16),(584,408,'Km/h',8),(582,432,'/',16),(592,400,'TOTAL',8),(592,408,'LAP TIME',8),(576,416,'0123456789\'"',8),(576,424,'POSITIONBEST LAP',8),(576,448,'LASTLAPS',16),(576,464,'WRONGWAY',16),(584,480,'FINAL',16)]:alphabet(x,y,s,n)
for palette in [487,497]:png(OUT/f'hud-{palette}.png',128,256,b''.join(rgba(pixel(25,palette<<6,u,v)) for v in range(256) for u in range(128)))
# Glyph source for countdown and free-run messages, before any recoloring.
png(OUT/'font.png',256,128,b''.join(rgba(pixel(22,487<<6,u,v+128)) for v in range(128) for u in range(256)))

# Red modulated label sprites from draw_time.
png(OUT/"hud-red.png",128,256,b"".join(bytes((c[0],0,0,c[3])) for v in range(256) for u in range(128) for c in [rgba(pixel(25,487<<6,u,v))]))
upload("BOMB")
png(OUT/"bomb.png",64,128,b"".join(rgba(pixel(0x96,492<<6,u,v)) for v in range(128) for u in range(64)))

# MENU_ETC.C title() uses TITLE.TIM (TITLE=1 is disabled in GP1.H).
# The logo is two strips, source Y=128 and Y=206, drawn at (40,8)/(40,58).
png(OUT/'title.png',256,128,b''.join(rgba(pixel(0x85,482<<6,u,v+128)) for v in range(128) for u in range(256)))

# DRAW_SP.C best_draw / total_draw: original 24x16 machine portraits.
png(OUT/'minicars.png',24,96,b''.join(rgba(pixel(0x116,0,u+32,v)) for v in range(96) for u in range(24)))
