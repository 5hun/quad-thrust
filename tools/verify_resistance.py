"""Compare car_resistance with the supplied original C, including int32 wrap."""
import ctypes
import json
import random
import subprocess
import tempfile
from track_geometry import ROOT
from verify_track_geometry import compile_oracle


def main():
    rng = random.Random(1997)
    cases = []
    velocities = [0, 1, -1, 8191, -8191, 8192, -8192, 32767, -32768,
                  46340, 46341, -46341, 65535, -65536, 2147483647, -2147483648]
    with tempfile.TemporaryDirectory(prefix='hover-resistance-') as directory:
        oracle = compile_oracle(directory)
        inputs = []
        for machine in range(6):
            for speed in (0, 1, 4, 80, 224, 1000, 2000, 2047):
                for brake in (0, 1):
                    for floor in (0, 1):
                        for v in velocities:
                            inputs.append([machine, speed, brake, floor, v, v, v, -v if v != -2147483648 else v, v, 1])
        for i in range(20000):
            inputs.append([i % 6, rng.randint(0, 2047), i % 2, (i // 2) % 2,
                           *[rng.randint(-2147483648, 2147483647) for _ in range(6)]])
        for values in inputs:
            result = (ctypes.c_int * 6)()
            oracle.resistance_probe((ctypes.c_int * 10)(*values), result)
            cases.append([values, list(result)])
    subprocess.run(['node', str(ROOT/'tests/check-source-resistance-cases.cjs')],
                   input=json.dumps(cases), text=True, check=True, cwd=ROOT)
    print(f'PASS: original car_resistance matches {len(cases)} cases')


if __name__ == '__main__':
    main()
