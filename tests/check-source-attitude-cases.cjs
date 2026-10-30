// Original C oracle supplies explicit matrices, independently of SDK construction.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const E = require("../dist/engine.js"),
  box = { window: {} };
vm.runInNewContext(
  fs.readFileSync(`${__dirname}/../dist/tracks.js`, "utf8"),
  box,
);
const track = E.prepare(box.window.HOVER_TRACKS[0]),
  unit = (Math.PI * 2) / 4096;
const { rotations, accelerations } = JSON.parse(fs.readFileSync(0, "utf8"));
let count = 0;
for (const [v, expected] of rotations) {
  const car = E.create(track, v[13]);
  Object.assign(car, {
    pitch: v[0] * unit,
    heading: v[1] * unit,
    roll: -v[2] * unit,
    sourceShadowAngles: v.slice(3, 6),
    sourcePreviousAngles: v.slice(6, 9),
    sourceSpeed: v[9],
    rudderAngle: v[10],
    grip: !!v[11],
    cpuLevel: v[12],
    sourceMatrix: v.slice(17, 26),
    sourceShadowMatrix: v.slice(26, 35),
  });
  E.sourceRotation(car, v.slice(14, 17));
  const actual = [
    Math.round(car.pitch / unit),
    Math.round(car.heading / unit),
    Math.round(-car.roll / unit),
    ...car.sourceShadowAngles,
    ...car.sourcePreviousAngles,
  ];
  assert.deepEqual(
    actual,
    expected,
    `original car_rotation case ${count}: ${v.slice(0, 17)}`,
  );
  count++;
}
console.log(
  `PASS: original body/shadow attitude, saved heading, wrap, rudder and bank thresholds (${count} cases)`,
);
for (const [v, expected] of accelerations) {
  const car = E.create(track, v[0]);
  Object.assign(car, {
    sourceSpeed: v[1],
    turbo: v[2],
    cpuLevel: v[3],
    catchUp: !!v[4],
    grip: !!v[5],
    heading: v[6] * unit,
    damage: v[7],
    front: v.slice(8, 11),
    rear: v.slice(11, 14),
    sourceMatrix: v.slice(14, 23),
  });
  E.sourceAcceleration(car, v[23]);
  assert.deepEqual(
    [Math.round(car.heading / unit), car.damage, ...car.front, ...car.rear],
    expected,
    "original acceleration " + v.slice(0, 8) + " mode=" + v[23],
  );
}
console.log(
  `PASS: original forward/lateral thrust, matrix projection, weight, turbo, CPU and speed limit (${accelerations.length} cases)`,
);
// The library specification fixes these bases exactly at quarter turns.
assert.deepEqual(E.sourceMatrix(0, 0, 0), [4096, 0, 0, 0, 4096, 0, 0, 0, 4096]);
assert.deepEqual(
  E.sourceMatrix(1024, 0, 0),
  [4096, 0, 0, 0, 0, -4096, 0, 4096, 0],
);
assert.deepEqual(
  E.sourceMatrix(0, 1024, 0),
  [0, 0, 4096, 0, 4096, 0, -4096, 0, 0],
);
assert.deepEqual(
  E.sourceMatrix(0, 0, 1024),
  [0, -4096, 0, 4096, 0, 0, 0, 0, 4096],
);
