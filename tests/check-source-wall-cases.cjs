// Invoked by tools/verify_wall_physics.py with original-C car_wallcheck results.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const E = require("../dist/engine.js");
const context = { window: {} };
for (const name of ["tracks", "training-tracks"])
  vm.runInNewContext(
    fs.readFileSync(`${__dirname}/../dist/${name}.js`, "utf8"),
    context,
  );
let contacts = 0;
for (const { training, course, cases } of JSON.parse(
  fs.readFileSync(0, "utf8"),
)) {
  const track = E.prepare(
    context.window[training ? "HOVER_TRAINING_TRACKS" : "HOVER_TRACKS"][course],
  );
  for (const [index, input, expected, movement] of cases) {
    const car = E.create(track);
    Object.assign(car, {
      x: input[2] / 100,
      y: -input[3] / 100,
      z: input[4] / 100,
      front: input.slice(8, 11),
      rear: input.slice(11, 14),
      sourceSpeed: input[14],
      cpuLevel: input[15],
      reason: input[18] < 0 ? "course-out" : null,
      leftDistance: 0,
      rightDistance: 0,
    });
    const next = input.slice(5, 8);
    const hit = E.sourceWallCheck(
      car,
      track.nodes[index],
      next,
      input[16] === 0,
      input[17],
    );
    const actual = [
      hit,
      ...next,
      ...car.front,
      ...car.rear,
      car.damage,
      car.leftDistance,
      car.rightDistance,
      car.leftHit,
      car.rightHit,
      +car.events.includes("wall"),
      +car.events.includes("wall-sound"),
    ];
    const reference = expected.slice(0, 17);
    assert.deepEqual(
      actual,
      reference,
      `${track.name} index=${index} speed=${input[14]} lev=${input[15]} mode=${input[17]} goal=${input[16]} over=${input[18]}`,
    );
    if (expected[16]) assert.deepEqual(expected.slice(17, 19), [45, 127]);
    assert.equal(car.debris?.length || 0, Math.min(64, expected[19]));
    const moving = E.create(track);
    Object.assign(moving, {
      x: input[2] / 100,
      y: -input[3] / 100,
      z: input[4] / 100,
      sourcePosition: input.slice(19, 22),
      front: input.slice(8, 11),
      rear: input.slice(11, 14),
      sourceSpeed: input[14],
      cpuLevel: input[15],
      reason: input[18] < 0 ? "course-out" : null,
      leftDistance: 0,
      rightDistance: 0,
    });
    E.sourceMove(moving, track.nodes[index], input[16] === 0, !!input[22]);
    const moved = [
      0,
      ...moving.sourcePosition,
      ...moving.front,
      ...moving.rear,
      moving.damage,
      moving.leftDistance,
      moving.rightDistance,
      moving.leftHit,
      moving.rightHit,
      +moving.events.includes("wall"),
      moving.events.filter((e) => e === "wall-sound").length,
    ];
    assert.deepEqual(
      moved,
      movement.slice(0, 17),
      `${track.name} full source movement / wall correction at ${index}`,
    );
    assert.deepEqual(
      [moving.x, moving.y, moving.z],
      [
        (movement[1] >> 2) / 100,
        -(movement[2] >> 2) / 100,
        (movement[3] >> 2) / 100,
      ],
    );
    assert.equal(moving.debris?.length || 0, Math.min(64, movement[19]));
    if (hit) contacts++;
  }
}
assert.ok(contacts > 1000, "exercise actual contacts, not just non-collisions");
console.log(
  `PASS: original wall position, inertia, damage, distances, hit flags and effects (${contacts} contacts)`,
);
