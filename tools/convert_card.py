"""Original PS1 card icon/title and embedded replay pack, without BIOS data."""
from pathlib import Path
import struct
root = Path(__file__).resolve().parents[1]
b = (root / 'extracted/MCARD.TIM').read_bytes()
size = struct.unpack_from('<I', b, 8)[0]
header = bytearray(256)
header[:4] = b'SC\x11\x01'
# Copy the actual release title, including its original spelling.
source = (root / 'HOVER_SOURCE/MEMORY_C.C').read_text('cp932')
marker = 'strcpy((save_data.card_head+4),"'
title = source.split(marker)[1].split('"')[0].encode('cp932')
header[4:4+len(title)] = title
header[96:128] = b[20:52]
header[128:256] = b[8+size+12:8+size+12+128]
(root / 'dist/assets/card-template.bin').write_bytes(header)
(root / 'dist/assets/special-replays.bin').write_bytes((root / 'extracted/REPLAY.DAT').read_bytes())
