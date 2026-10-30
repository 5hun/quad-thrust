const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  E = require("../dist/engine.js");
const box = { window: {} };
vm.runInNewContext(
  fs.readFileSync(__dirname + "/../dist/tracks.js", "utf8"),
  box,
);
const tracks = box.window.HOVER_TRACKS.map(E.prepare);
assert.equal(tracks.length, 9);
const t = tracks[0];
const near = (a, b, e = 0.000001) =>
  assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
for (const tr of tracks) {
  assert.ok(tr.length > 1000);
  for (const n of tr.nodes) {
    assert.ok(Number.isFinite(n.x + n.y + n.z));
    assert.ok(n.width > 5);
    assert.equal(n.allTiles.length, n.tiles.length + 4);
  }
}
// First tick: CAR_CTR.C (240 >> 2)*128/128 =60 on EACH inertia vector.
let c = E.create(t);
E.step(c, t, { accel: true }, 1 / 60);
assert.equal(c.front[2], 60);
assert.equal(c.rear[2], 60);
near(c.vz, 4.5);
// (60+60)>>2 adds 30 quarter-units to posr; the displayed position
// uses posr>>2, so seven PS1 units are visible and half a unit is retained.
near(c.z - E.create(t).z, 0.07);
assert.equal(c.sourcePosition[2] - Math.round(E.create(t).z * 400), 30);
assert.equal(c.sourcePosition[2] & 3, 2);
c = E.create(t);
E.step(c, t, { l1: true, l2: true }, 1 / 60);
near(c.heading, 0);
assert.equal(c.front[0], 37);
assert.equal(c.rear[0], 37);
c = E.create(t);
E.step(c, t, { r1: true, l2: true }, 1 / 60);
near(c.heading, (-22 * Math.PI * 2) / 4096);
assert.equal(c.front[0], -38);
assert.equal(c.rear[0], 37);
c = E.create(t, 2);
for (let i = 0; i < 60; i++) E.step(c, t, { accel: true, steer: 1 }, 1 / 60);
near(c.heading, 0);
c = E.create(t, 5);
E.step(c, t, { l1: true, l2: true, r2: true }, 1 / 60);
near(c.heading, 0);
assert.equal(c.front[0], 0);
c = E.create(t);
E.step(c, t, { turbo: true }, 1 / 60);
assert.equal(c.damage, 48);
assert.equal(c.front[2], 122);
c = E.create(t, 4);
E.step(c, t, { turbo: true }, 1 / 60);
assert.equal(c.damage, 0);
assert.equal(c.turbo, false);
// Resistance, raw PS1 units (sum=3200 => source speed283; drag140; 240 brake).
c = E.create(t);
c.front[2] = c.rear[2] = 1600;
E.step(c, t, { brake: true }, 1 / 60);
assert.equal(c.sourceSpeed, 283);
const sp = 283,
  drag = Math.trunc((sp * 18000) / (128 * (sp + 1)));
assert.equal(c.front[2], 1600 - ((1600 * (drag + 240)) >> 13));
// Clone stage: place effect underneath stationary ship; repeated P doesn't re-fire.
function floor(symbol) {
  const raw = JSON.parse(JSON.stringify(box.window.HOVER_TRACKS[0]));
  raw.samples.forEach((p) => (p.tiles = symbol.repeat(p.tiles.length)));
  return E.prepare(raw);
}
let tr = floor("P");
c = E.create(tr);
c.damage = 12000;
E.step(c, tr, {}, 1 / 60);
const d = c.damage;
assert.ok(d < 6000);
E.step(c, tr, {}, 1 / 60);
assert.ok(c.damage > d - 20);
tr = floor("+");
c = E.create(tr);
c.damage = 12000;
E.step(c, tr, {}, 1 / 60);
assert.ok(c.damage > 11980, "+ is not repair");
tr = floor("J");
c = E.create(tr);
E.step(c, tr, {}, 1 / 60);
assert.ok(c.front[1] < -1400);
assert.ok(c.y > 3);
for (let i = 0; i < 10; i++) E.step(c, tr, {}, 1 / 60);
assert.equal(c.grip, false);
assert.ok(c.y > 15);
tr = floor("B");
c = E.create(tr);
E.step(c, tr, {}, 1 / 60);
assert.equal(c.reason, "destroyed");
c = E.create(t);
c.x -= 100;
c.y = -75;
E.step(c, t, {}, 1 / 60);
assert.equal(c.reason, "course-out");
// car_chipeffect uses the previous grip, then car_gravide updates it.
// The sound must retain that same floor decision instead of reading new grip.
const damageTrack = floor("d"),
  edgeCar = E.create(damageTrack);
edgeCar.y = 3.51;
edgeCar.grip = true;
E.step(edgeCar, damageTrack, {}, 1 / 60);
assert.equal(edgeCar.damage, 100);
assert.equal(edgeCar.grip, false);
assert.equal(edgeCar.damageFloorActive, true);
E.step(edgeCar, damageTrack, {}, 1 / 60);
assert.equal(edgeCar.grip, true);
assert.equal(edgeCar.damageFloorActive, false);
// Wall crossing vs overflying above the curb.
function hit(height) {
  const c = E.create(t);
  c.x = t.nodes[0].r[0] - 2;
  c.y = height;
  c.front[0] = c.rear[0] = 2500;
  E.step(c, t, {}, 1 / 60);
  return c;
}
assert.ok(hit(2).damage > 0);
assert.equal(hit(12).damage, 0);
let a = E.create(t),
  b = E.create(t);
b.x += 3;
E.collide(a, b);
assert.ok(a.front[0] < 0 && b.front[0] > 0);
assert.ok(a.damage > 0);
a = E.create(t);
b = E.create(t);
for (let i = 0; i < 120; i++) E.step(a, t, { accel: true }, 1 / 60);
for (let i = 0; i < 240; i++) E.step(b, t, { accel: true }, 1 / 120);
near(a.z, b.z);
near(a.time, b.time);
c = E.create(t);
c.progress = t.length - 1;
c.linePosition = t.nodes.length - 1;
c.lastLine = t.nodes.length - 1;
c.previousTile = ".";
c.lastDistance = t.length - 1;
let p = E.at(t, 3);
Object.assign(c, {
  x: p.x,
  z: p.z,
  index: p.index,
  heading: p.heading,
  ticks: 2400,
});
E.step(c, t, {}, 1 / 60);
assert.equal(c.laps.length, 1);
c = E.create(t);
c.lastDistance = 3;
p = E.at(t, t.length - 3);
Object.assign(c, { x: p.x, z: p.z, index: p.index });
E.step(c, t, {}, 1 / 60);
assert.equal(c.laps.length, 0);
// The finish-line tick already has goal_count>0 inside car_wallcheck,
// while movement still follows car_action (mode 0 only) until the next frame.
const finishTrack = E.prepare(
  JSON.parse(JSON.stringify(box.window.HOVER_TRACKS[0])),
);
const finishNode = finishTrack.nodes[0];
finishNode.tiles = "g".repeat(finishNode.tiles.length);
const finishCar = E.create(finishTrack);
Object.assign(finishCar, {
  x: 3,
  z: (finishNode.z + finishNode.end.z) / 2,
  y: 2,
  index: 0,
  lastLine: 0,
  linePosition: 100,
  lastGoal: 0,
  previousTile: ".",
  laps: [10, 10],
  front: [-1600, 0, 0],
  rear: [-1600, 0, 0],
});
E.step(finishCar, finishTrack, {}, 1 / 60);
assert.equal(finishCar.reason, "finish");
assert.ok(
  finishCar.damage > 0,
  "finish tick still resolves the wall and its damage",
);
assert.ok(
  !finishCar.events.includes("wall") &&
    !finishCar.events.includes("wall-sound"),
  "finish tick suppresses wall effects immediately",
);
console.log(
  "PASS: source thrust/drag/yaw formulas, independent inertias, frame-rate invariance, no-rudder/no-thruster machines, one-shot repair/jump, lethal floor, falling, aerial wall clearance, collisions, forward/reverse lap checks.",
);

// A completed distance alone must not count: the source requires a g tile.
const noGoal = E.prepare({
  ...box.window.HOVER_TRACKS[0],
  samples: box.window.HOVER_TRACKS[0].samples.map((n) => ({
    ...n,
    tiles: n.tiles.replaceAll("g", "."),
  })),
});
c = E.create(noGoal);
c.progress = noGoal.length * 2;
c.linePosition = noGoal.nodes.length * 2;
c.previousTile = ".";
E.step(c, noGoal, {}, 1 / 60);
assert.equal(c.laps.length, 0, "distance without g must not award a lap");
// Initial grid and repeated crossings within 32 original rows are not laps.
c = E.create(t);
c.previousTile = ".";
E.step(c, t, {}, 1 / 60);
assert.equal(c.laps.length, 0);
c.linePosition = 32;
c.previousTile = ".";
E.step(c, t, {}, 1 / 60);
assert.equal(c.laps.length, 0);
c.linePosition = 33;
c.previousTile = ".";
E.step(c, t, {}, 1 / 60);
assert.equal(c.laps.length, 1);
c.previousTile = ".";
E.step(c, t, {}, 1 / 60);
assert.equal(
  c.laps.length,
  1,
  "reentering same goal must not award another lap",
);
// Each pair collides once; CPU pair is tested with player far away.
const player = E.create(t),
  cpu1 = E.create(t),
  cpu2 = E.create(t);
player.x += 100;
cpu2.x += 3;
E.collideAll([player, cpu1, cpu2]);
assert.equal(player.damage, 0);
assert.equal(cpu1.damage, 500);
assert.equal(cpu2.damage, 500);
assert.ok(cpu1.vx < 0 && cpu2.vx > 0);
// Original four difficulty rows and slot-based maximum speeds.
assert.deepEqual(E.cpuLevels[0], [1, 1, 2, 3, 4, 5, 6, 4, 6]);
assert.deepEqual(E.cpuLevels[3], [10, 8, 6, 9, 8, 10, 10, 8, 10]);
assert.equal(E.cpuMaxSpeed(2, 1), 500);
assert.equal(E.cpuMaxSpeed(10, 3), 520);
c = E.create(t);
c.cpuLevel = 2;
c.cpuSlot = 1;
c.sourceSpeed = 500;
assert.equal(E.driveCPU(c, t, player).accel, false);
c.sourceSpeed = 499;
assert.equal(E.driveCPU(c, t, player).accel, true);
c.ticks = 601;
player.linePosition = c.linePosition;
E.driveCPU(c, t, player);
assert.equal(c.catchUp, true);
player.linePosition = c.linePosition - 4;
E.driveCPU(c, t, player);
assert.equal(c.catchUp, false);
a = E.create(t);
b = E.create(t);
b.cpuLevel = 2;
E.step(a, t, { accel: true }, 1 / 60);
E.step(b, t, { accel: true }, 1 / 60);
assert.ok(b.vz > a.vz, "level 2 CPU receives original extra thrust");
// Fixed-tick camera follows the short arc across +/-pi and banks with the car.
const camera = { yaw: Math.PI - 0.01, pitch: 0, roll: 0, distance: 0 };
const pose = {
  ...E.create(t),
  heading: -Math.PI + 0.01,
  pitch: 0.1,
  roll: 0.2,
  sourceSpeed: 400,
};
E.cameraStep(camera, pose);
assert.ok(camera.yaw > Math.PI - 0.01);
assert.ok(camera.pitch > 0 && camera.pitch < pose.pitch);
assert.ok(camera.roll > 0 && camera.roll < pose.roll);
assert.equal(camera.distance, 16);
for (let i = 0; i < 600; i++) E.cameraStep(camera, pose);
near(E.angle(camera.yaw - pose.heading), 0);
near(camera.pitch, pose.pitch);
assert.ok(Math.abs(camera.roll - pose.roll) < (Math.PI * 2) / 4096);
assert.ok(Math.abs(camera.distance - 800) <= 16);
console.log(
  "PASS: goal-floor/32-row guards, all racer collision pairs, source CPU difficulty/speed/assistance, camera angle wrap/bank/distance",
);
