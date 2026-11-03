"""Convert MAKEMAP.C course geometry using its integer math and original tables."""
from pathlib import Path
import json
from course_builder import build
from track_geometry import mesh, parse_parts, parse_patterns, trig_tables

ROOT = Path(__file__).resolve().parents[1]
# New courses replace the original ones slot by slot.
COURSES = {0: 'blue-1', 1: 'blue-2', 2: 'blue-3', 3: 'yellow-1'}
NAMES = ['Gulf City', 'Penta Rock', 'Ice Gate', 'KNight Town', 'Rollin’Stone',
         'Misty Arc', 'White Cutter', 'Highway Star', 'Desert Gora']


def convert(idx, name, tables, courses):
    if idx in courses:
        course, part_list, patterns = build(
            (ROOT/'courses'/f'{courses[idx]}.course').read_text())
        name, theme = course['name'], course['theme']
    else:
        key = f'{idx//3+1}_{idx%3+1}'
        text = (ROOT/'extracted'/f'STG{key}.TXT').read_text('cp932')
        ptn = (ROOT/'extracted'/f'PTN{key}.TXT').read_text('cp932')
        patterns = parse_patterns(ptn)
        part_list = parse_parts(text)
        theme = [0, 1, 2, 0, 1, 3, 2, 3, 4][idx]
    parts = {}
    for part in part_list:
        xs, ys, rows = patterns[part['pat']]
        data = mesh(part['kind'], part['left'], part['right'], xs, ys, tables)
        origin = data['origin']
        def world(vertex):
            return [round((origin[k]+2*vertex[k])*(-1 if k == 1 else 1)/100, 4) for k in range(3)]
        def boundary(column):
            return {'l': world(column[2]), 'r': world(column[ys-2]),
                    'source': {'origin': origin, 'vertices': column}}
        samples = [{**boundary(data['columns'][x]),
                    'tiles': ''.join(rows[y][x] for y in range(2, ys-2)),
                    'allTiles': ''.join(rows[y][x] for y in range(ys)),
                    'part': part['id'], 'partColumn': x,
                    'sourceNormals': data['normals'][x],
                    'end': boundary(data['columns'][x+1])} for x in range(xs)]
        parts[part['id']] = {**part, 'samples': samples}
    samples, seen, i = [], set(), 0
    while i not in seen and i in parts:
        seen.add(i)
        samples += parts[i]['samples']
        i = parts[i]['next']
    assert len(seen) == len(parts), (name, len(seen), len(parts))
    start = next((i for i, s in enumerate(samples) if 'g' in s['tiles']), 0)
    samples = samples[start:]+samples[:start]
    print(name, len(samples))
    return {'name': name, 'theme': theme,
            'samples': samples,
            'parts': [{k: p[k] for k in ['id', 'next', 'before', 'writeF', 'writeB', 'extraF', 'extraB']} for p in parts.values()]}


def main():
    tables = trig_tables()
    # tracks-classic.js keeps every original course for ?classiccourses.
    for file, courses in (('tracks.js', COURSES), ('tracks-classic.js', {})):
        tracks = [convert(i, n, tables, courses) for i, n in enumerate(NAMES)]
        (ROOT/'dist'/file).write_text('window.HOVER_TRACKS='+json.dumps(tracks, separators=(',', ':'))+';\n')


if __name__ == '__main__':
    main()
