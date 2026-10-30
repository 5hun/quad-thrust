"""Integer course mesh generation from MAKEMAP.C and the supplied CSDATA.DAT.

Coordinates here remain in PS1 TMD units (half PS1 world units, Y down).
Do not replace integer division, shifts or sqr_i with floating point math.
"""
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]


def div(value, denominator):
    """C signed division truncates toward zero."""
    result = abs(value) // abs(denominator)
    return -result if (value < 0) != (denominator < 0) else result


def i32(value):
    return ((value + (1 << 31)) % (1 << 32)) - (1 << 31)


def i16(value):
    return ((value + (1 << 15)) % (1 << 16)) - (1 << 15)


def sqr_i(value):
    # LIB.C sqr_i(1<<16, value), including its last binary-search step.
    if value == 0:
        return 0
    current, step = 32768, 16384
    while step:
        square = i32(current * current)
        if square == value:
            return current
        current += -step if square > value else step
        step >>= 1
    return current


def trig_tables():
    data = (ROOT / "extracted/CSDATA.DAT").read_bytes()
    first_half = list(struct.unpack_from("<360i", data, 1024 * 4))
    cos = first_half + [-v for v in first_half]
    sin = [cos[(i + 720 - 180) % 720] for i in range(720)]
    return cos, sin


def cross(a, b):
    return [i32(a[1]*b[2] - a[2]*b[1]),
            i32(a[2]*b[0] - a[0]*b[2]),
            i32(a[0]*b[1] - a[1]*b[0])]


def mesh(kind, left, right, xs, ys, tables=None):
    """Return original local TMD columns and flat per-cell normals."""
    if kind == "circle":
        cos, sin = tables or trig_tables()
        origin = [left[0], 0, left[1]]
    else:
        origin = left[:3]
        l0 = [0, 0, 0]
        l1 = [left[k+3] - origin[k] for k in range(3)]
        r0 = [right[k] - origin[k] for k in range(3)]
        r1 = [right[k+3] - origin[k] for k in range(3)]
    columns = []
    for x in range(xs + 1):
        if kind == "circle":
            # MAKEMAP.C deliberately uses the opposite boundary's angle.
            rr = div((right[5]*x + right[4]*(xs-x))*2, xs) % 720
            rl = div((left[5]*x + left[4]*(xs-x))*2, xs) % 720
            a = [(left[2]*cos[rr]) >> 10,
                 div(left[7]*x + left[6]*(xs-x), xs),
                 (left[3]*sin[rr]) >> 10]
            b = [((right[2]*cos[rl]) >> 10) + right[0] - left[0],
                 div(right[7]*x + right[6]*(xs-x), xs),
                 ((right[3]*sin[rl]) >> 10) + right[1] - left[1]]
        else:
            a = [div(l1[k]*x + l0[k]*(xs-x), xs) for k in range(3)]
            b = [div(r1[k]*x + r0[k]*(xs-x), xs) for k in range(3)]
        direction = [(a[k]-b[k]) >> 4 for k in range(3)]
        length = sqr_i(sum(v*v for v in direction))
        assert length > 0
        outward = [div(v*1024, length) for v in direction]
        rows = []
        for y in range(ys + 2):
            if y == ys + 1:
                v = [(a[k]+b[k]) >> 1 for k in range(3)]
                v[1] += 1024
            elif y < 2 or y > ys - 2:
                v = (outward.copy() if y == 0 else
                     a.copy() if y == 1 else
                     b.copy() if y == ys - 1 else
                     [b[k]-outward[k] for k in range(3)])
                if y == 0:
                    v = [v[k]+a[k] for k in range(3)]
                v[1] += -512 if y in (1, ys-1) else 256
            else:
                v = [div(b[k]*(y-2) + a[k]*(ys-2-y), ys-4) for k in range(3)]
            rows.append([i16(div(c, 2)) for c in v])
        columns.append(rows)
    normals = []
    for x in range(xs):
        rows = []
        for y in range(ys):
            base = columns[x][y]
            a = [columns[x+1][y][k]-base[k] for k in range(3)]
            b = [columns[x][y+1][k]-base[k] for k in range(3)]
            n = [v >> 7 for v in cross(a, b)]
            length = sqr_i(i32(sum(v*v for v in n)))
            assert length != 0
            rows.append([i16(-div(i32(v*4096), length)) for v in n])
        normals.append(rows)
    return {"origin": origin, "columns": columns, "normals": normals}


def parse_patterns(text):
    patterns = {}
    for block in re.split(r"^\*(?=\d)", text, flags=re.M)[1:]:
        lines = block.splitlines()
        xs, ys = map(int, lines[1].split(","))
        patterns[int(lines[0])] = (xs, ys, lines[2:2+ys])
    return patterns


def parse_parts(text):
    """Preserve script inheritance for PAT, kind and drawing parameters."""
    parts = []
    pat, kind, forward, backward = 0, "line", 3, 3
    for block in re.split(r"^\*(?=\d)", text, flags=re.M)[1:]:
        lines = block.splitlines()
        number = int(lines[0])
        part = {"id": number, "next": number+1, "before": number-1,
                "writeF": forward, "writeB": backward, "extraF": [], "extraB": []}
        for line in lines[1:]:
            if line.startswith("#LINE"):
                kind = "line"
            elif line.startswith("#CIRCLE"):
                kind = "circle"
            elif line.startswith("PAT"):
                pat = int(line[4:] or 0)
            elif line.startswith("NEXT "):
                part["next"] = int(line[5:])
            elif line.startswith("BEFORE "):
                part["before"] = int(line[7:])
            elif line.startswith("A_WRITE_F "):
                forward = part["writeF"] = int(line[10:])
            elif line.startswith("A_WRITE_B "):
                backward = part["writeB"] = int(line[10:])
            elif line.startswith("D_WRITE_F "):
                part["writeF"] = int(line[10:])
            elif line.startswith("D_WRITE_B "):
                part["writeB"] = int(line[10:])
            elif line.startswith("WRITE_F "):
                part["extraF"].append(int(line[8:]))
            elif line.startswith("WRITE_B "):
                part["extraB"].append(int(line[8:]))
            elif line.startswith("WRITE "):
                part["extraF"].append(int(line[6:]))
                part["extraB"].append(int(line[6:]))
            elif line.startswith("L ") or line.startswith("CIRCLE-L"):
                part["left"] = list(map(int, re.findall(r"-?\d+", line)))
            elif line.startswith("R ") or line.startswith("CIRCLE-R"):
                part["right"] = list(map(int, re.findall(r"-?\d+", line)))
        part.update(pat=pat, kind=kind)
        parts.append(part)
    return parts
