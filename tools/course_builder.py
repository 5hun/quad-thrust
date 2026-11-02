"""Compile a turtle-style course script (courses/*.course) into course parts.

The result is the same part and tile-pattern structure that MAKEMAP.C reads,
so track_geometry.mesh and the engine treat it exactly like any other course.

Script lines (units are TMD units, 100 per world unit; # starts a comment):
  name <text>          course name
  theme <n>            background/lighting theme
  width <n>            road width between the walls
  lanes <n>            tile lanes across the road
  straight <len|?> [options]
  arc right|left <degrees> r=<centre radius> [options]

Options, all optional:
  rise=<n>    height gained over the segment
  tilt=<n>    left edge height minus right edge height at the segment end
  bank=<n>    arcs only: tilt with the outer edge <n> higher
  width=<n>   straights only: road width at the segment end
  lanes=<n>   lanes from this segment on
  goal|boost|repair|jump|slow|damage=<cells>
              tiles to place; <cells> is a comma list of column[-column]
              optionally followed by :lane[-lane] (0 = left lane)

Width, lanes and tilt carry over to the next segment unless changed. The
script starts at the origin heading +z with the left edge at x=0, and the
last segment must be a straight that returns there. Exactly two straights
may have the length ?, solved so that the course closes.
"""
from pathlib import Path
import math
import re
from track_geometry import div, trig_tables

COLUMN = 2000          # target column length
MAX_COLUMNS = 30       # CAR_CTR.C searches at most 31 columns per part
LIMIT = 62000          # local vertex coordinates must stay inside int16 * 2
MAX_STRAIGHT = 50000   # longest straight part that keeps its far corners inside
SLOPE_COLUMNS = 4      # part size on slopes, so the height profile can curve
TILES = {"goal": "g", "boost": ">", "repair": "P", "jump": "J",
         "slow": "*", "damage": "d"}


def heading_vector(h):
    return math.sin(math.radians(h)), math.cos(math.radians(h))


def parse(text):
    course = {"name": "", "theme": 0, "width": 7000, "lanes": 4}
    segments = []
    for number, raw in enumerate(text.splitlines(), 1):
        words = raw.split("#")[0].split()
        if not words:
            continue
        key, args = words[0], words[1:]
        if key == "name":
            course["name"] = " ".join(args)
        elif key in ("theme", "width", "lanes"):
            course[key] = int(args[0])
        elif key in ("straight", "arc"):
            seg = {"kind": key, "line": number, "tiles": []}
            if key == "arc":
                assert args[0] in ("right", "left"), f"line {number}: arc right|left"
                seg["turn"] = int(args[1]) * (1 if args[0] == "right" else -1)
                args = args[2:]
            else:
                seg["length"] = None if args[0] == "?" else int(args[0])
                args = args[1:]
            for arg in args:
                name, value = arg.split("=")
                if name in TILES:
                    seg["tiles"] += [(TILES[name], cell) for cell in value.split(",")]
                else:
                    seg[name] = int(value)
            segments.append(seg)
        else:
            raise ValueError(f"line {number}: unknown command {key}")
    return course, segments


def arc_length(seg):
    return abs(seg["turn"]) * math.pi / 180 * seg["r"]


def solve_lengths(segments):
    """Fill in the two ? straights so that the centre line closes."""
    h, known, unknown = 0, [0.0, 0.0], []
    for seg in segments:
        if seg["kind"] == "arc":
            # Chord of the arc from the centre line, independent of position.
            a, t = math.radians(h), math.radians(seg["turn"])
            r = seg["r"]
            sx, sz = (r * (1 - math.cos(t)), r * math.sin(t)) if t > 0 else \
                     (-r * (1 - math.cos(-t)), r * math.sin(-t))
            known[0] += sx * math.cos(a) + sz * math.sin(a)
            known[1] += -sx * math.sin(a) + sz * math.cos(a)
            h += seg["turn"]
        elif seg["length"] is None:
            unknown.append((seg, heading_vector(h)))
        else:
            dx, dz = heading_vector(h)
            known[0] += dx * seg["length"]
            known[1] += dz * seg["length"]
    assert h % 360 == 0, f"turns sum to {h}, not a multiple of 360"
    assert len(unknown) == 2, "exactly two straights need the length ?"
    (s1, (ax, az)), (s2, (bx, bz)) = unknown
    det = ax * bz - az * bx
    assert abs(det) > 1e-6, "the two ? straights must not be parallel"
    u = (-known[0] * bz + known[1] * bx) / det
    v = (-ax * known[1] + az * known[0]) / det
    s1["length"], s2["length"] = round(u), round(v)
    for seg in (s1, s2):
        assert seg["length"] > 0, f"line {seg['line']}: solved length {seg['length']}"


def pieces_for(length, turn=0, columns=MAX_COLUMNS):
    """Split a segment into parts: [(columns, end fraction, whole degrees)]."""
    total = max(1, round(length / COLUMN))
    count = max(-(-total // columns), math.ceil(length / MAX_STRAIGHT))
    if not turn:
        base, extra = divmod(total, count)
        sizes = [base + (i < extra) for i in range(count)]
        return [(n, sum(sizes[:i + 1]) / total, 0) for i, n in enumerate(sizes)]
    # Arc parts need whole degrees, so divide the angle and size the columns.
    count = max(count, 1)
    count = min(count, abs(turn))
    base, extra = divmod(abs(turn), count)
    degrees = [base + (i < extra) for i in range(count)]
    sign = 1 if turn > 0 else -1
    return [(max(1, round(total * d / abs(turn))), sum(degrees[:i + 1]) / abs(turn),
             sign * d) for i, d in enumerate(degrees)]


def junction_slopes(segments):
    """Grade at the start of each segment, shared with the previous one.

    Like a monotone cubic (Fritsch-Butland), a crest or dip gets slope 0 and
    consecutive slopes meet at their harmonic mean, so heights never overshoot.
    """
    grades = [seg.get("rise", 0) / seg["length"] for seg in segments]
    slopes = []
    for i, g in enumerate(grades):
        p = grades[i - 1]
        slopes.append(0 if p * g <= 0 else 2 / (1 / p + 1 / g))
    return slopes


def hermite(h0, h1, m0, m1, f):
    """Height at fraction f with end slopes m0, m1 scaled to the segment."""
    return (h0 * (2*f**3 - 3*f**2 + 1) + m0 * (f**3 - 2*f**2 + f)
            + h1 * (-2*f**3 + 3*f**2) + m1 * (f**3 - f**2))


def cell_set(spec, lanes, columns):
    cols, _, lane_text = spec.partition(":")
    c0, _, c1 = cols.partition("-")
    c0 = int(c0)
    c1 = int(c1) if c1 else c0
    if lane_text:
        l0, _, l1 = lane_text.partition("-")
        l0 = int(l0)
        l1 = int(l1) if l1 else l0
    else:
        l0, l1 = 0, lanes - 1
    assert 0 <= c0 <= c1 < columns, f"column {spec} outside 0..{columns-1}"
    assert 0 <= l0 <= l1 < lanes, f"lane {spec} outside 0..{lanes-1}"
    return [(c, l) for c in range(c0, c1 + 1) for l in range(l0, l1 + 1)]


def pattern(columns, lanes, tiles):
    rows = [["E"] * columns, ["#"] * columns]
    rows += [["."] * columns for _ in range(lanes)]
    rows += [["#"] * columns, ["E"] * columns]
    for (c, lane), code in tiles.items():
        rows[2 + lane][c] = code
    return columns, lanes + 4, ["".join(r) for r in rows]


def build(text):
    """Return (course settings, parts, patterns) for convert_tracks."""
    course, segments = parse(text)
    solve_lengths(segments)
    for seg in segments:
        if seg["kind"] == "arc":
            seg["length"] = arc_length(seg)
    slopes = junction_slopes(segments)
    cos, sin = trig_tables()
    width, lanes, tilt = course["width"], course["lanes"], 0
    # Exact integer edge points carried from part to part; y is TMD (down).
    left, right = [0, 0, 0], [width, 0, 0]
    h, height = 0, 0
    parts, patterns = [], {}

    def edge_y(centre, tilt_value):
        return -(centre + div(tilt_value, 2)), -(centre - div(tilt_value, 2))

    for number, seg in enumerate(segments):
        try:
            end_lanes = seg.get("lanes", lanes)
            if seg["kind"] == "arc":
                assert "width" not in seg, "arcs keep a constant width"
                end_tilt = seg.get("tilt", tilt)
                if "bank" in seg:
                    end_tilt = seg["bank"] * (1 if seg["turn"] > 0 else -1)
            else:
                end_tilt = seg.get("tilt", tilt)
            length = seg["length"]
            end_width = seg.get("width", width)
            end_height = height + seg.get("rise", 0)
            m0 = slopes[number] * length
            m1 = slopes[(number + 1) % len(segments)] * length
            sloped = end_height != height or m0 or m1
            split = pieces_for(length, seg.get("turn", 0),
                               SLOPE_COLUMNS if sloped else MAX_COLUMNS)
            total = sum(n for n, _, _ in split)
            tiles = {}
            for code, spec in seg["tiles"]:
                for cell in cell_set(spec, end_lanes, total):
                    tiles[cell] = code
            done = 0
            for count, f1, turn in split:
                assert count <= MAX_COLUMNS, "arc too long; split it"
                t1 = round(tilt + (end_tilt - tilt) * f1)
                c1 = round(hermite(height, end_height, m0, m1, f1))
                yl1, yr1 = edge_y(c1, t1)
                yl0, yr0 = left[1], right[1]
                part = {"id": len(parts), "next": len(parts) + 1,
                        "before": len(parts) - 1, "writeF": 3, "writeB": 3,
                        "extraF": [], "extraB": [], "pat": len(parts)}
                if seg["kind"] == "arc":
                    r = seg["r"]
                    cx0 = (left[0] + right[0]) / 2
                    cz0 = (left[2] + right[2]) / 2
                    nx, nz = math.cos(math.radians(h)), -math.sin(math.radians(h))
                    side = 1 if turn > 0 else -1
                    cx, cz = round(cx0 + side * r * nx), round(cz0 + side * r * nz)
                    a0 = (180 - h) if turn > 0 else -h
                    a1 = a0 - turn
                    rl, rr = (r + width // 2, r - width // 2) if turn > 0 else \
                             (r - width // 2, r + width // 2)
                    assert rr > 0 and rl > 0, "radius smaller than half the width"
                    assert max(rl, rr) + 2048 < LIMIT, "radius too large for int16 vertices"
                    part["kind"] = "circle"
                    part["left"] = [cx, cz, rl, rl, a0, a1, yl0, yl1]
                    part["right"] = [cx, cz, rr, rr, a0, a1, yr0, yr1]
                    idx = (a1 * 2) % 720
                    left = [cx + ((rl * cos[idx]) >> 10), yl1, cz + ((rl * sin[idx]) >> 10)]
                    right = [cx + ((rr * cos[idx]) >> 10), yr1, cz + ((rr * sin[idx]) >> 10)]
                    h += turn
                else:
                    w1 = round(width + (end_width - width) * f1)
                    piece = length * count / total
                    dx, dz = heading_vector(h)
                    nx, nz = dz, -dx
                    cx = (left[0] + right[0]) / 2 + dx * piece
                    cz = (left[2] + right[2]) / 2 + dz * piece
                    new_left = [round(cx - nx * w1 / 2), yl1, round(cz - nz * w1 / 2)]
                    new_right = [round(cx + nx * w1 / 2), yr1, round(cz + nz * w1 / 2)]
                    assert piece + w1 + 2048 < LIMIT, "straight part too long"
                    part["kind"] = "line"
                    part["left"] = left + new_left
                    part["right"] = right + new_right
                    left, right = new_left, new_right
                local = {(c - done, l): code for (c, l), code in tiles.items()
                         if done <= c < done + count}
                patterns[part["pat"]] = pattern(count, end_lanes, local)
                parts.append(part)
                done += count
            width, lanes, tilt, height = end_width, end_lanes, end_tilt, end_height
        except AssertionError as error:
            raise ValueError(f"line {seg['line']}: {error}") from None
    assert h % 360 == 0
    assert height == 0 and tilt == 0, "the course must end level at height 0"
    # Snap the closing straight onto the start so the loop is watertight.
    error = math.dist(parts[-1]["left"][3:], [0, 0, 0])
    # Truncated cosines shorten each arc by up to radius/1024.
    assert error < 500, f"course does not close ({error:.0f} units)"
    assert parts[-1]["kind"] == "line", "the last segment must be a straight"
    parts[-1]["left"][3:] = [0, 0, 0]
    parts[-1]["right"][3:] = [course["width"], 0, 0]
    parts[-1]["next"] = 0
    parts[0]["before"] = len(parts) - 1
    return course, parts, patterns


if __name__ == "__main__":
    import sys
    for path in sys.argv[1:]:
        course, parts, patterns = build(Path(path).read_text())
        print(course["name"], len(parts), "parts",
              sum(p[0] for p in patterns.values()), "columns")
