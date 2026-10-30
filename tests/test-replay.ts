import type {} from "./types";
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const fs = require("node:fs") as typeof import("node:fs");
(async () => {
  const source = fs.readFileSync(
    (require("node:path") as typeof import("node:path")).join(
      __dirname,
      "../dist/replay.js",
    ),
    "utf8",
  );
  const { sampleReplay, ReplayDirector, captureReplay } = (await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  )) as typeof import("../src/replay");
  const frames = [
    [0, 0, 0, 0, Math.PI - 0.1, 0, 0],
    [0.1, 10, 2, 4, -Math.PI + 0.1, 0.2, 0.4],
    [0.35, 35, 7, 14, -Math.PI + 0.6, 0.7, 1.4],
  ];
  assert.equal(sampleReplay([], 0, 0), null);
  assert.equal(sampleReplay([frames[0]], 90, 3)!.type, 3);
  const middle = sampleReplay(frames, 0.05, 1);
  assert.ok(Math.abs(middle!.x - 5) < 1e-9);
  assert.ok(middle!.sourceSpeed! > 0);
  assert.ok(Math.abs(middle!.heading - Math.PI) < 1e-9);
  // 60 Hz output must move on every frame between recorded 10 Hz samples.
  const samples = Array.from({ length: 18 }, (_, i) =>
    sampleReplay(frames, i / 60, 1),
  );
  samples.forEach((p, i) => {
    assert.ok(Math.abs(p!.x - (i / 60) * 100) < 1e-8);
    if (i) assert.ok(p!.x > samples[i - 1]!.x);
  });
  assert.ok(Math.abs(sampleReplay(frames, 0.4, 0)!.x - 5) < 1e-8);
  // captureReplay reads only the pose and visual state populated here.
  const recorded = {
    time: 0,
    x: 1,
    y: 2,
    z: 3,
    heading: 0,
    pitch: 0,
    roll: 0,
    energy: 10,
    rudderAngle: 0,
    fireTail: 64,
    repairFrames: 20,
    turbo: true,
    tile: "d",
    grip: true,
    active: { accel: true, l1: true, r2: true },
  };
  const first = captureReplay(recorded as Car);
  const second = captureReplay({
    ...recorded,
    time: 0.1,
    energy: 20,
    rudderAngle: 32,
    fireTail: 58,
    repairFrames: 14,
  } as Car);
  const replay = sampleReplay([first, second], 0.05, 0);
  assert.ok(Math.abs(replay!.energy! - 15) < 1e-9);
  assert.ok(Math.abs(replay!.rudderAngle! - 16) < 1e-9);
  assert.ok(Math.abs(replay!.fireTail! - 61) < 1e-9);
  assert.ok(Math.abs(replay!.repairFrames! - 17) < 1e-9);
  assert.deepEqual(replay!.active, {
    accel: true,
    turbo: true,
    l1: true,
    l2: false,
    r1: false,
    r2: true,
  });
  assert.equal(replay!.damageLight, true);
  assert.equal(replay!.damageSemi, false);
  assert.equal(
    middle!.active,
    undefined,
    "legacy seven-field ghost recordings remain readable",
  );
  const track = {
    nodes: [
      { part: 0, l: [0, 0, 0], r: [50, 0, 0] },
      { part: 0, l: [0, 0, 100], r: [50, 0, 100] },
      { part: 1, l: [0, 0, 200], r: [50, 0, 200] },
    ],
  };
  for (const [choice, mode, duration, x] of [
    [0, 33, 120, -10.24],
    [1, 33, 120, 60.24],
    [2, 1, 240, null],
    [3, 17, 240, null],
  ] as const) {
    let draws = 0;
    const director = new ReplayDirector(() => {
      draws++;
      return choice / 4;
    });
    director.step(track as Track, 0);
    assert.equal(director.mode, mode);
    assert.equal(director.remaining, duration - 1);
    if (x !== null) assert.deepEqual(director.anchor, { x, y: 27.44, z: 200 });
    else assert.equal(director.anchor, null);
    const anchor = director.anchor;
    for (let i = 1; i < duration; i++) director.step(track as Track, 2);
    assert.equal(draws, 1, "hold each camera for its source duration");
    assert.equal(
      director.anchor,
      anchor,
      "course-side camera must stay fixed while cars move",
    );
    director.step(track as Track, 2);
    assert.equal(draws, 2);
    director.reset();
    assert.equal(director.remaining, 0);
  }
  console.log(
    "PASS: source replay camera cuts, 120/240-tick durations, fixed outer-corner anchors",
  );
  console.log(
    "PASS: replay timestamps, 60 Hz movement from 10 Hz data, irregular sample intervals, angle wrap, loops, empty/single frames",
  );
})().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
