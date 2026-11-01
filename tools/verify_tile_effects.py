"""Compare continuous tile effects, including the original falling wait."""
import ctypes
import json
import subprocess
import tempfile
from track_geometry import ROOT
from verify_track_geometry import compile_oracle


def main():
    cases = []
    with tempfile.TemporaryDirectory(prefix='hover-tile-effects-') as directory:
        oracle = compile_oracle(directory)
        for tile in 'd*.PJ>gs':
            for slot in range(4):
                for grip in (0, 1):
                    for lev in (0, 1, 8, 10):
                        for damage in (0, 32999, 2147483640, -2147483648):
                            for over in (-256, -128, -2, 1, 64, 300, 0):
                                # Entry effects have a separate state machine;
                                # isolate the continuous branch for this oracle.
                                if over == 0 and tile not in 'd*.':
                                    continue
                                for time in range(4):
                                    values = [ord(tile), slot, grip, lev, damage, over, time, -1, 0]
                                    result = (ctypes.c_int * 7)()
                                    oracle.continuous_tile_probe((ctypes.c_int * 9)(*values), result)
                                    cases.append([values, list(result)])
    subprocess.run(['node', str(ROOT/'tests/check-source-tile-cases.ts')],
                   input=json.dumps(cases), text=True, check=True, cwd=ROOT)
    print(f'PASS: original car_chipeffect continuous branch matches {len(cases)} cases')


if __name__ == '__main__':
    main()
