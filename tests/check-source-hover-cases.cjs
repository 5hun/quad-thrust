// Invoked by tools/verify_hover_physics.py with original-C oracle results.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const E = require("../dist/engine.js"),
  context = { window: {} };
for (const name of ["tracks", "training-tracks"])
  vm.runInNewContext(
    fs.readFileSync(`${__dirname}/../dist/${name}.js`, "utf8"),
    context,
  );
const { jobs, speeds, rolls } = JSON.parse(fs.readFileSync(0, "utf8"));
for (const [values, expected] of speeds)
  assert.equal(
    E.sourceSpeed(values.slice(0, 3), values.slice(3)),
    expected,
    "original car_preope speed for " + values,
  );
for (const [roll, expected] of rolls) {
  const result = E.sourceAirRoll((-roll * Math.PI * 2) / 4096);
  assert.equal(
    Math.round((-result * 4096) / (Math.PI * 2)),
    expected,
    "original airborne roll " + roll,
  );
}
let count = 0;
for (const { training, course, cases } of jobs) {
  const track = E.prepare(
    context.window[training ? "HOVER_TRAINING_TRACKS" : "HOVER_TRACKS"][course],
  );
  for (const [index, v, expected] of cases) {
    const car = E.create(track, v[9]);
    Object.assign(car, {
      x: v[4] / 100,
      y: -v[5] / 100,
      z: v[6] / 100,
      sourcePosition: [v[4] * 4, v[7], v[6] * 4],
      pitch: (v[8] * Math.PI * 2) / 4096,
      cpuLevel: v[10],
      tei: v[12],
      damage: v[13],
      front: [v[16], v[14], v[17]],
      rear: [v[18], v[15], v[19]],
      grip: !!v[20],
    });
    const contact = E.sourceContact(track.nodes[index], v[2], !v[3]);
    const over = E.sourceGravity(car, contact, v[11]);
    if (v[21]) E.sourceBank(car, contact.normal);
    const actual = [
      over,
      Math.round(-car.y * 100),
      car.sourcePosition[1],
      car.front[1],
      car.rear[1],
      car.tei,
      car.damage,
      +car.grip,
      Math.round(-car.groundY * 100),
      +!car.onRoad,
      +!!car.damageLight,
      +car.events.includes("land"),
      car.events.includes("land") ? 80 : 0,
      car.events.includes("land") ? 127 : 0,
      car.front[0],
      car.front[2],
      car.rear[0],
      car.rear[2],
    ];
    assert.deepEqual(
      actual,
      expected,
      `${track.name} node=${index} row=${v[2]} Y=${v[5]} lev=${v[10]} over=${v[11]} tei=${v[12]} type=${v[9]}`,
    );
    count++;
  }
}
console.log(
  `PASS: original hover, landing, fall entry, shadow visibility and bank force (${count} cases)`,
);
