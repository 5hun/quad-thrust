const assert = require("node:assert/strict");
const fs = require("node:fs");
const E = require("../dist/engine.js");
const flat = (width = 20, rise = 0, bank = 0) =>
  E.prepare({
    name: "fixture",
    theme: 0,
    training: true,
    samples: [
      {
        l: [-width / 2, 0, 0],
        r: [width / 2, bank, 0],
        tiles: "....",
        allTiles: "........",
        end: { l: [-width / 2, rise, 100], r: [width / 2, rise + bank, 100] },
      },
    ],
  });
const t = flat();
// Source collisions use a 512-unit sphere, not a cylinder; Y inertia is down-positive.
let a = E.create(t),
  b = E.create(t, 2);
b.x += 3;
b.y += 4;
E.collide(a, b);
assert.equal(a.damage, 500);
assert.equal(b.damage, 556);
assert.equal(a.front[0], -120);
assert.equal(a.front[1], 160);
assert.equal(b.front[1], -204);
a = E.create(t);
b = E.create(t);
b.x += 4;
b.y += 4;
E.collide(a, b);
assert.equal(a.damage, 0);
a = E.create(t);
b = E.create(t);
b.cpuLevel = 2;
b.x += 3;
E.collide(a, b);
assert.equal(b.damage, 0);
assert.ok(b.front[0] > 0);
a = E.create(t);
b = E.create(t);
E.collide(a, b);
assert.equal(a.damage, 500);
assert.equal(a.front[0], 0);
// Plane height varies across a bank, and slope forces include vertical inertia.
const slope = flat(20, 20, 10);
const n = E.nearest(slope, 0, 30);
assert.ok(Math.abs(n.surface - 11) < 0.01);
a = E.create(slope);
E.step(a, slope, {}, 1 / 60);
assert.ok(a.front[0] < 0 && a.front[2] < 0);
assert.ok(a.front[1] > -25, "bank adds downward Y force to the cushion");
for (let i = 0; i < 30; i++) E.step(a, slope, {}, 1 / 60);
assert.ok(
  a.roll > 0 && a.pitch > 0,
  "attitude follows cross-slope and incline",
);
a = E.create(t);
a.y = -5;
E.step(a, t, {}, 1 / 60);
assert.equal(
  a.reason,
  "course-out",
  "submerged car must not snap back onto road",
);
a = E.create(t);
a.y = 0.9;
E.step(a, t, {}, 1 / 60);
assert.equal(a.damage, 100);
assert.equal(a.front[1], -200);
assert.equal(a.tei, 16);
// Fixed wall clearance must work on both narrow and wide roads.
for (const width of [20, 100]) {
  const tr = flat(width);
  a = E.create(tr);
  a.x = width / 2 - 3;
  a.front[0] = a.rear[0] = 800;
  E.step(a, tr, {}, 1 / 60);
  assert.ok(a.events.includes("wall"));
  assert.ok(width / 2 - a.x >= 2.56);
  a = E.create(tr);
  a.x = width / 2 - 3;
  a.y = 8;
  a.front[0] = a.rear[0] = 800;
  E.step(a, tr, {}, 1 / 60);
  assert.ok(!a.events.includes("wall"));
}
a = E.create(t);
E.emitDebris(a, 80, 2, [0, 1, 0]);
assert.equal(a.debris.length, 64);
const first = { ...a.debris[0] };
E.stepDebris(a);
assert.equal(a.debris[0].vy, first.vy - 16);
assert.equal(a.debris[0].life, 47);
for (let i = 0; i < 47; i++) E.stepDebris(a);
assert.equal(a.debris.length, 0);
(async () => {
  const { SpuEnvelope } = await import(
    "data:text/javascript;base64," +
      Buffer.from(fs.readFileSync("dist/spu-envelope.js", "utf8")).toString(
        "base64",
      )
  );
  // Exercise the actual worklet lifecycle, including naturally ended samples.
  let Processor;
  const vm = require("node:vm");
  vm.runInNewContext(
    fs
      .readFileSync("dist/spu-envelope.js", "utf8")
      .replace("export class", "class"),
    {
      AudioWorkletProcessor: class {
        port = { postMessage() {} };
      },
      registerProcessor(_name, type) {
        Processor = type;
      },
      sampleRate: 48000,
      currentTime: 0,
    },
  );
  for (let i = 0; i < 2000; i++) {
    const processor = new Processor({
      processorOptions: { adsr1: 15, adsr2: 0x1fc0, when: 0 },
    });
    const output = [[new Float32Array(128)]];
    assert.equal(processor.process([], output), true);
    processor.port.onmessage({ data: { dispose: true } });
    assert.equal(
      processor.process([], output),
      false,
      "ended source must retire its worklet even when ADSR sustains forever",
    );
  }
  // Hand-calculated SPU fastest attack: 7<<11 each sample.
  let env = new SpuEnvelope(15, 0x1fc0);
  assert.equal(env.next(), 14336 / 32768);
  assert.equal(env.next(), 28672 / 32768);
  assert.equal(env.next(), 32767 / 32768);
  assert.equal(env.phase, "decay");
  env.next();
  assert.equal(env.phase, "sustain");
  const hold = env.level;
  for (let i = 0; i < 100000; i++) env.next();
  assert.equal(env.level, hold, "all-ones sustain rate holds the level");
  env.keyOff();
  for (let i = 0; i < 3; i++) env.next();
  assert.equal(env.phase, "off");
  const linear = new SpuEnvelope(15, 0x1fc0),
    exponential = new SpuEnvelope(0x800f, 0x1fc0);
  for (let i = 0; i < 3; i++) {
    linear.next();
    exponential.next();
  }
  assert.ok(
    exponential.level < linear.level,
    "exponential attack slows above 0x6000",
  );
  env = new SpuEnvelope(15, 0x1fe0);
  env.level = 16000;
  env.keyOff();
  env.next();
  assert.equal(
    env.level,
    8000,
    "exponential release scales the step by current level",
  );
  console.log(
    "PASS: source 3D collision/weight/CPU exemptions, plane contact, slope Y force and attitude, landing/falling, width-independent walls, debris lifetime, SPU ADSR register cases",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
