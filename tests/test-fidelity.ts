import type {} from "./types";
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const fs = require("node:fs") as typeof import("node:fs");
const E = require("../dist/engine.js") as typeof HoverEngine;
const flat = (width = 20, rise = 0, bank = 0) =>
  E.prepare({
    name: "fixture",
    theme: 0,
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
const tileTrack = (symbol: string) => {
  const track = flat();
  track.nodes[0].tiles = symbol.repeat(4);
  return track;
};
// CAR_CTR.C car_chipeffect stores P/> on airborne entry, but defers J
// until grip returns. Adjacent equal letters must still be one trigger.
for (const symbol of ["J", "P", ">"]) {
  const track = tileTrack(symbol),
    car = E.create(track);
  car.previousTile = ".";
  car.y = 10;
  E.step(car, track, {}, 1 / 60);
  assert.equal(car.previousTile === symbol, symbol !== "J");
  car.y = 2;
  car.front.fill(0);
  car.rear.fill(0);
  car.events.length = 0;
  E.step(car, track, {}, 1 / 60);
  assert.equal(car.events.includes("jump"), symbol === "J");
  assert.ok(!car.events.includes("repair") && !car.events.includes("boost"));
  car.events.length = 0;
  E.step(car, track, {}, 1 / 60);
  assert.ok(!car.events.includes("jump"), "J fires once after landing");
}
for (const symbol of ["d", "*", "B"]) {
  const track = tileTrack(symbol),
    car = E.create(track),
    control = E.create(t);
  car.cpuLevel = control.cpuLevel = 2;
  car.front[2] = car.rear[2] = control.front[2] = control.rear[2] = 1600;
  E.step(car, track, {}, 1 / 60);
  E.step(control, t, {}, 1 / 60);
  if (symbol === "B") assert.equal(car.reason, "destroyed");
  else {
    assert.equal(car.damage, 0, "CPU is immune to damage tiles");
    assert.equal(car.front[2], control.front[2], "CPU ignores rough floor");
  }
}
// Widening, banking boost tile: current left cell edge is (0,20,100),
// not the centreline's (10,30,100). VP stores half-scale PS1 vertices.
const boostTrack = tileTrack(">");
boostTrack.nodes[0].end!.r = [30, 40, 100];
boostTrack.nodes[0].end!.l = [-10, 20, 100];
const boost = E.create(boostTrack);
boost.x = -6;
boost.y = E.nearest(boostTrack, boost.x, boost.z).surface + 2;
const unboostedTrack = structuredClone(boostTrack);
unboostedTrack.nodes[0].tiles = "....";
const unboosted = structuredClone(boost);
E.step(boost, boostTrack, {}, 1 / 60);
E.step(unboosted, unboostedTrack, {}, 1 / 60);
assert.ok(boost.events.includes("boost"));
assert.equal(boost.front[0], 0, "boost follows left edge, not centreline");
assert.equal(boost.front[2] - unboosted.front[2], 10000);
assert.equal(
  boost.front[1] - unboosted.front[1],
  -2000,
  "boost includes the current edge's rise",
);
const unit = (Math.PI * 2) / 4096;
const startCamera = { yaw: 0, pitch: 0, roll: 0, distance: 0 };
E.cameraStep(startCamera, E.create(t), 300);
// Wrapped difference to target -2880 is +1216: 5*(1+floor(1216/68)).
assert.equal(startCamera.yaw, 90 * unit);
const raceCamera = { yaw: 0, pitch: 0, roll: 0, distance: 0 };
E.cameraStep(raceCamera, E.create(t), 120);
assert.equal(raceCamera.yaw, 0, "last two seconds track the ship heading");
raceCamera.yaw = -16 * unit;
E.cameraStep(raceCamera, E.create(t), 121);
assert.equal(
  raceCamera.yaw,
  0,
  "source snap branch drops the start yaw offset",
);
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
assert.equal(a.debris!.length, 64);
const first = { ...a.debris![0] };
E.stepDebris(a);
assert.equal(a.debris![0].vy, first.vy - 16);
assert.equal(a.debris![0].life, 47);
for (let i = 0; i < 47; i++) E.stepDebris(a);
assert.equal(a.debris!.length, 0);
(async () => {
  const { SpuEnvelope } = (await import(
    "data:text/javascript;base64," +
      Buffer.from(fs.readFileSync("dist/spu-envelope.js", "utf8")).toString(
        "base64",
      )
  )) as typeof import("../src/spu-envelope");
  // Exercise the actual worklet lifecycle, including naturally ended samples.
  type Worklet = {
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
    port: { onmessage(event: { data: { dispose: boolean } }): void };
  };
  type WorkletConstructor = new (options: {
    processorOptions: { adsr1: number; adsr2: number; when: number };
  }) => Worklet;
  let Processor: WorkletConstructor | undefined;
  const vm = require("node:vm") as typeof import("node:vm");
  vm.runInNewContext(
    fs
      .readFileSync("dist/spu-envelope.js", "utf8")
      .replace("export class", "class"),
    {
      AudioWorkletProcessor: class {
        port = { postMessage() {} };
      },
      registerProcessor(_name: string, type: WorkletConstructor) {
        Processor = type;
      },
      sampleRate: 48000,
      currentTime: 0,
    },
  );
  for (let i = 0; i < 2000; i++) {
    assert.ok(Processor);
    const processor: Worklet = new Processor({
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
})().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});

// The damage floor toggles DOBJ_C lighting on frames 2/3 and transparency
// on even frames. Leaving the tile and being airborne must clear both.
const damageCar = E.create(tileTrack("d"));
for (let tick = 1; tick <= 4; tick++) {
  E.step(damageCar, tileTrack("d"), {}, 1 / 60);
  assert.equal(damageCar.damageLight, (tick & 2) !== 0);
  assert.equal(damageCar.damageSemi, (tick & 1) === 0);
}
damageCar.y = 10;
E.step(damageCar, tileTrack("d"), {}, 1 / 60);
assert.equal(damageCar.damageLight, false);
assert.equal(damageCar.damageSemi, false);
const warningCar = E.create(t);
warningCar.damage = 30000;
E.step(warningCar, t, {}, 1 / 60);
assert.equal(warningCar.warningActive, true);
warningCar.finished = true;
warningCar.reason = "finish";
E.step(warningCar, t, {}, 1 / 60, false, false);
assert.equal(
  warningCar.warningActive,
  false,
  "car_enemy does not add warning lighting",
);
const tail = E.create(t);
E.step(tail, t, { accel: true }, 1 / 60);
for (let size = 64; size >= 0; size--) {
  E.step(tail, t, {}, 1 / 60);
  assert.equal(tail.fireTail, size);
}
const vm = require("node:vm") as typeof import("node:vm"),
  gridData = { window: {} as Window };
vm.runInNewContext(
  fs.readFileSync(__dirname + "/../dist/tracks.js", "utf8"),
  gridData,
);
for (const raw of gridData.window.HOVER_TRACKS) {
  const track = E.prepare(raw);
  for (let slot = 0; slot < 4; slot++) {
    const car = E.placeOnGrid(E.create(track, slot), track, slot);
    assert.deepEqual(
      [car.x, car.y, car.z, car.heading],
      [slot % 2 ? 25 : 10, 2, slot * 30, 0],
    );
    assert.equal(
      car.linePosition,
      0,
      "first crossing of the nearby goal is not a lap",
    );
    assert.ok(
      car.progress < 300,
      "grid rank must not start almost a full lap ahead",
    );
    assert.ok(E.nearest(track, car.x, car.z).lane > 0);
  }
}
console.log(
  "PASS: source starting grid on nine courses, damage lighting/transparency, 64-tick exhaust tail",
);

// GAME.C: goal text keeps car_enemy/physics alive but freezes race records.
{
  const car = E.create(t);
  E.step(car, t, { accel: true }, 1 / 60);
  car.finished = true;
  car.reason = "finish";
  car.laps = [10, 11, 12];
  const time = car.time,
    ticks = car.ticks,
    z = car.z;
  E.step(car, t, { accel: true }, 1 / 60);
  assert.equal(car.ticks, ticks, "normal race stepping stops at the finish");
  for (let i = 0; i < 30; i++)
    E.step(car, t, { accel: true }, 1 / 60, false, false);
  assert.equal(car.ticks, ticks + 30);
  assert.ok(car.z > z, "post-finish physics continues moving the car");
  assert.equal(car.time, time, "presentation ticks do not change total time");
  assert.deepEqual(car.laps, [10, 11, 12]);
  assert.equal(car.reason, "finish");
  for (const reason of ["destroyed", "course-out"] as const) {
    car.reason = reason;
    E.step(car, t, { accel: true }, 1 / 60, false, false);
    assert.equal(car.ticks, ticks + 30, "failures cannot enter goal driving");
  }
  const cpu = E.create(t);
  cpu.cpuLevel = 2;
  E.step(cpu, t, {}, 1 / 60);
  assert.equal(
    cpu.fireTail,
    64,
    "car_enemy draws CPU exhaust even without thrust",
  );
}
{
  const track = tileTrack("g");
  const car = E.create(track);
  car.previousTile = ".";
  car.linePosition = 100;
  car.laps = [10, 11, 12];
  car.finished = true;
  car.reason = "finish";
  E.step(car, track, {}, 1 / 60, false, false);
  assert.deepEqual(
    car.laps,
    [10, 11, 12],
    "goal driving cannot register another lap",
  );
}

{
  const car = E.create(t);
  car.cpuLevel = 0;
  car.cpuSlot = 0;
  const input = E.driveCPU(car, t, car);
  assert.equal(input.brake, true, "lev=0 post-goal controller brakes");
  assert.ok(!input.accel && !input.l1 && !input.l2 && !input.r1 && !input.r2);
  car.fireRemaining = 64;
  E.step(car, t, input, 1 / 60, false, false);
  assert.equal(
    car.fireTail,
    0,
    "lev=0 car_enemy does not draw residual exhaust",
  );
}

// MAKEMAP.C outer rows are physical sloping tiles, including on banked roads.
for (const bank of [0, 10]) {
  const track = flat(20, 0, bank);
  const p = track.nodes[0];
  for (const row of [0, p.allTiles.length - 1]) {
    const a = E.boundaryVertex(p, row, p.allTiles.length);
    const b = E.boundaryVertex(p, row + 1, p.allTiles.length);
    const x = (a[0] + b[0]) / 2;
    const n = E.nearest(track, x, 30);
    assert.equal(n.supported, true, "outer apron supports the ship");
    assert.equal(n.row, row);
    assert.ok(Math.abs(n.surface - (a[1] + b[1]) / 2) < 0.005);
    const car = E.create(track);
    car.x = x;
    car.z = 30;
    car.y = n.surface + 2;
    E.step(car, track, {}, 1 / 60);
    assert.equal(car.finished, false);
    assert.equal(car.onRoad, true);
    assert.ok(!car.events.includes("wall"), "apron is not an invisible wall");
  }
}
// Outside uses the last tile's vertex +5000, not an extrapolated slope plane.
const beyondApron = E.create(t);
beyondApron.x = -30;
beyondApron.y = -70;
E.step(beyondApron, t, {}, 1 / 60);
assert.equal(beyondApron.finished, false);
beyondApron.y = -72;
E.step(beyondApron, t, {}, 1 / 60);
assert.equal(beyondApron.reason, "course-out");
assert.equal(beyondApron.onRoad, false);
// car_resistance checks signed 32-bit products even during the fall wait.
// A floating-point sign check leaves this high inertia running instead.
const fallResistance = E.create(t);
fallResistance.front = [50000, 0, 0];
fallResistance.rear = [50000, 0, 0];
E.stepFalling(fallResistance);
assert.equal(fallResistance.front[0], 0);
assert.equal(fallResistance.rear[0], 0);
const frozenTime = beyondApron.time;
const oldY = beyondApron.y;
for (let i = 0; i < 60; i++) E.stepFalling(beyondApron);
assert.ok(beyondApron.y < oldY);
assert.ok(beyondApron.sourceSpeed > 0, "falling speed drives the wind sound");
assert.equal(beyondApron.time, frozenTime);
assert.equal(beyondApron.fireTail, 0);
assert.equal(beyondApron.onRoad, false);
const mapContext = { window: {} as Window };
(require("node:vm") as typeof import("node:vm")).runInNewContext(
  fs.readFileSync("dist/tracks.js", "utf8"),
  mapContext,
);
// Outside selection retains the clamped source cell. Falling reuses that
// tile and applies continuous effects before updating grip, without entry effects.
const fallFloor = E.prepare(mapContext.window.HOVER_TRACKS[0]);
for (const node of fallFloor.nodes) {
  node.tiles = "d".repeat(node.tiles.length);
  node.allTiles = "d".repeat(node.allTiles.length);
}
const damageFall = E.create(fallFloor);
damageFall.x = -100;
damageFall.z = 0;
damageFall.y = -80;
E.step(damageFall, fallFloor, {}, 1 / 60);
assert.equal(damageFall.reason, "course-out");
assert.equal(damageFall.tile, "outside");
assert.equal(damageFall.sourceTile, "d");
assert.equal(damageFall.damage, 100);
for (const node of fallFloor.nodes) {
  node.tiles = ".".repeat(node.tiles.length);
  node.allTiles = ".".repeat(node.allTiles.length);
}
damageFall.grip = false;
E.stepFalling(damageFall);
assert.equal(damageFall.damage, 100, "floor consumes previous grip");
assert.equal(damageFall.damageFloorActive, false);
assert.equal(
  damageFall.grip,
  true,
  "gravity can set grip while over is negative",
);
for (let i = 0; i < 4; i++) {
  E.stepFalling(damageFall);
  assert.equal(damageFall.damage, 200 + i * 100);
  assert.equal(damageFall.damageFloorActive, true);
  assert.equal(damageFall.damageLight, (damageFall.ticks & 2) !== 0);
  assert.equal(damageFall.damageSemi, (damageFall.ticks & 1) === 0);
}
for (const tile of ["P", "J", ">", "s", "g"]) {
  damageFall.sourceTile = tile;
  damageFall.events.length = 0;
  E.stepFalling(damageFall);
  assert.equal(damageFall.damage, 500);
  assert.ok(
    !damageFall.events.some((event) =>
      ["repair", "jump", "boost", "stop", "goal"].includes(event),
    ),
  );
  assert.equal(damageFall.damageFloorActive, false);
}
damageFall.sourceTile = "B";
E.stepFalling(damageFall);
assert.equal(damageFall.damage, 100500, "B remains continuous during falling");
assert.equal(damageFall.reason, "course-out");
assert.equal(damageFall.warningActive, false);
const fallingBrake = E.create(t),
  fallingCoast = E.create(t);
for (const c of [fallingBrake, fallingCoast]) {
  c.front = [10000, 0, 0];
  c.rear = [10000, 0, 0];
  c.grip = true;
}
fallingBrake.sourceTile = "*";
E.stepFalling(fallingBrake);
E.stepFalling(fallingCoast);
assert.ok(fallingBrake.front[0] < fallingCoast.front[0]);
const desert = E.prepare(mapContext.window.HOVER_TRACKS[8]);
const crossing = E.nearest(desert, 1347.1353648417648, 480.3176647437638, 175);
assert.equal(desert.nodes[crossing.index].part, desert.nodes[175].part);
assert.ok(
  crossing.surface < 0,
  "nearby upper road must not cause false course-out",
);
console.log(
  "PASS: rideable outer slopes, banked collision faces, outside fall datum, falling wind speed, crossing-road selection",
);

// Production source tracks use car_enemy's lev>0 path: no cushion impulse
// or car_bank. Compare on an actual sloped cell rather than a legacy fixture.
const bankTrack = E.prepare(structuredClone(mapContext.window.HOVER_TRACKS[6]));
let bankPose;
for (let index = 0; index < bankTrack.nodes.length; index++) {
  const node = bankTrack.nodes[index],
    end = node.end;
  const x =
    Math.floor((node.l[0] + node.r[0] + end!.l[0] + end!.r[0]) * 25) / 100;
  const z =
    Math.floor((node.l[2] + node.r[2] + end!.l[2] + end!.r[2]) * 25) / 100;
  const contact = E.nearest(bankTrack, x, z, index);
  if (!contact.supported || !(contact.normal[0] || contact.normal[2])) continue;
  bankTrack.nodes[contact.index].tiles = ".".repeat(
    bankTrack.nodes[contact.index].tiles.length,
  );
  bankPose = { x, z, y: contact.surface + 2, index: contact.index, grip: true };
  break;
}
assert.ok(bankPose, "actual source bank fixture exists");
const sourcePlayer = E.create(bankTrack),
  sourceCPU = E.create(bankTrack);
Object.assign(sourcePlayer, bankPose);
Object.assign(sourceCPU, bankPose, { cpuLevel: 2 });
E.step(sourcePlayer, bankTrack, {}, 1 / 60);
E.step(sourceCPU, bankTrack, {}, 1 / 60);
assert.deepEqual(
  sourceCPU.front,
  [0, 0, 0],
  "source CPU gets neither cushion impulse nor bank force",
);
assert.ok(
  sourcePlayer.front[0] || sourcePlayer.front[2],
  "source player receives the original bank force",
);

// CAR_CTR.C guards the input before adding 11; it can cross the integer
// 227-unit boundary by one step instead of clamping to twenty degrees.
for (const [pitch, input, expected] of [
  [226, 1, 237],
  [-226, -1, -237],
  [227, 1, 227],
  [-227, -1, -227],
]) {
  const car = E.placeOnGrid(E.create(bankTrack), bankTrack);
  car.y = 100;
  car.grip = false;
  car.pitch = pitch * unit;
  E.step(car, bankTrack, { pitch: input }, 1 / 60);
  assert.equal(
    Math.round(car.pitch / unit),
    expected,
    "original aerial pitch guard at " + pitch,
  );
}
