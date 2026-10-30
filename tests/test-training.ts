import type {} from "./types";
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
Object.assign(globalThis, { window: globalThis });
window.HoverEngine = require("../dist/engine.js") as typeof HoverEngine;
require("../dist/training-tracks.js");
const T = require("../dist/training.js") as typeof HoverTraining,
  R = require("../dist/rules.js") as typeof HoverRules,
  E = HoverEngine;
const tracks = HOVER_TRAINING_TRACKS.map(E.prepare);
assert.equal(tracks.length, 15);
const car = () => ({
  ...E.create(tracks[0]),
  type: 0,
  damage: 0,
  sourceSpeed: 1000,
  heading: 0,
  finished: false,
});
for (let id = 0; id < 15; id++) {
  const t = tracks[id],
    task = T.tasks[id];
  assert.equal(t.theme, id % 5);
  assert.ok(t.nodes.every((p) => p.end && p.len < 100));
  assert.ok(t.nodes.some((p) => p.tiles.includes("g")) || id === 0);
  const c = T.spawn(t, 0, 0, id);
  assert.ok(Number.isFinite(c.x + c.y + c.z + c.progress));
  assert.equal(c.z, id === 14 ? -600 : 0);
  let session = T.create(id);
  const p = car();
  assert.equal(T.step(session, p, {}, 1, ["goal"]), "complete");
  session = T.create(id);
  session.remaining = 1;
  assert.equal(T.step(session, p, {}, 1, []), "miss");
  assert.match(session.reason, /時間/);
  if (task.noWall) {
    session = T.create(id);
    assert.equal(T.step(session, p, {}, 1, ["wall"]), "miss");
  }
  if (task.noDamage) {
    session = T.create(id);
    p.damage = 1;
    assert.equal(T.step(session, p, {}, 1, []), "miss");
    p.damage = 0;
  }
  if (task.minSpeed) {
    session = T.create(id);
    p.sourceSpeed = task.minSpeed - 1;
    assert.equal(T.step(session, p, {}, 1, []), "miss");
    p.sourceSpeed = 1000;
  }
  if (task.firstAtGoal) {
    session = T.create(id);
    assert.equal(T.step(session, p, {}, 2, ["goal"]), "miss");
  }
  if (task.rolling) {
    const c = T.spawn(t, 0, 0, id);
    for (let i = 0; i < 300; i++) {
      E.step(c, t, T.drive(c, t), 1 / 60);
      c.damage = 0;
      c.finished = false;
      c.events = [];
    }
    assert.ok(c.sourceSpeed >= task.minSpeed, `rolling start ${id}`);
  }
}
let session = T.create(0);
const c = car();
for (let i = 1; i <= 360; i++) {
  c.heading = (i * Math.PI) / 180;
  T.step(session, c, {}, 1, []);
}
assert.equal(session.status, "complete");
session = T.create(0);
T.step(session, car(), { steer: 1 }, 1, []);
assert.equal(session.status, "miss");
session = T.create(14);
assert.equal(T.step(session, car(), {}, 2, []), "miss");
assert.equal(R.recordKey("practice", 2), R.recordKey("gp0", 2));
assert.notEqual(R.recordKey("practice", 2), R.recordKey("time", 2));
assert.equal(R.recordKey("train0", 0), null);
assert.equal(R.recordKey("free", 0), null);
assert.equal(R.nextCourse("practice", 0, 1, true), null);
assert.equal(R.nextCourse("gp0", 0, 1, true), 1);
assert.equal(R.nextCourse("gp0", 0, 2, true), null);
assert.deepEqual(R.opponents(2), [0, 1, 3]);
assert.deepEqual(R.opponents(5), [0, 1, 2]);
const data: Record<string, string> = {};
const storage = {
  getItem: (k: string) => data[k] ?? null,
  setItem: (k: string, v: string) => {
    data[k] = v;
  },
};
T.useStorage(storage);
R.useStorage(storage);
Object.assign(globalThis, { localStorage: storage });
T.saveMark(2, 0);
T.saveMark(2, 3);
assert.equal(T.loadMarks()[2], 9);
assert.equal(T.loadMarks()[1], 0);
console.log(
  "PASS: all 15 source courses and rule sets; timeouts, goals, rank, damage, wall, speed, full turn, rolling starts, machine-specific marks; mode/record separation",
);
// Goal detection uses original g tiles, rather than a synthetic lap around an open course.
for (let id = 1; id < 15; id++) {
  const t = tracks[id],
    i = t.nodes.findIndex((p) => p.tiles.includes("g")),
    p = t.nodes[i],
    q = p.end,
    c = T.spawn(t, 0, 0, id);
  Object.assign(c, {
    x: (p.x + q!.x) / 2,
    z: (p.z + q!.z) / 2,
    y: (p.y + q!.y) / 2 + 2,
    index: i,
    previousTile: ".",
    lastDistance: p.distance,
    progress: p.distance,
  });
  E.step(c, t, {}, 1 / 60);
  assert.ok(c.events.includes("goal"), `goal tile ${id}`);
}
const Records = require("../dist/records.js") as typeof HoverRecords;
for (let i = 0; i < 9; i++) Records.save("gp", 0, "lap", 100 - i, i % 5);
assert.deepEqual(
  Records.read("gp", 0, "lap").map((x) => x.time),
  [92, 93, 94, 95, 96, 97],
);
assert.deepEqual(Records.read("time", 0, "lap"), []);
assert.deepEqual(Records.read("gp", 0, "total"), []);
console.log(
  "PASS: actual goal tiles in all 14 goal courses; top-six record sorting and category separation",
);
