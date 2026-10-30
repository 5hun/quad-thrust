const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const E = require("../dist/engine.js");
(async () => {
  const source = fs.readFileSync(
    __dirname + "/../dist/input-replay.js",
    "utf8",
  );
  const {
    ReplayRecorder,
    ReplayReader,
    InputReplay,
    GhostReplay,
    inputPad,
    padInput,
    encodeOriginalReplay,
    decodeOriginalReplay,
  } = await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
  const meta = {
    machine: 3,
    course: 0,
    level: 1,
    gameMode: 1,
    totalTicks: 3456,
    name: "A RUN",
    playerName: "SAT",
  };
  const r = new ReplayRecorder();
  for (let i = 0; i < 33; i++) r.record({ accel: true });
  assert.deepEqual(
    r.words,
    [0x41f, 0x400],
    "GAME.C 11-bit pad / 5-bit count, split after 32 ticks",
  );
  r.record({ turbo: true });
  r.record({ brake: true });
  assert.deepEqual(r.words.slice(2), [0x800, 0x200]);
  const tape = r.tape(meta),
    bytes = encodeOriginalReplay(tape);
  const view = new DataView(bytes.buffer);
  assert.equal(bytes.length, 256);
  assert.equal(view.getUint16(0, true), 0x5268);
  assert.equal(view.getUint16(4, true), 128);
  assert.equal(view.getUint16(6, true), 8);
  assert.equal(view.getInt32(8, true), 35);
  assert.equal(view.getInt32(40, true), 1);
  assert.equal(view.getInt32(44, true), 3456);
  assert.equal(view.getInt32(52, true), 1);
  assert.equal(bytes[16], 65);
  assert.equal(bytes[32], 83);
  const decoded = decodeOriginalReplay(bytes);
  assert.deepEqual(decoded.words, tape.words);
  assert.equal(decoded.frames, 35);
  const read = new ReplayReader(decoded);
  for (let i = 0; i < 33; i++) assert.equal(read.next().accel, true);
  assert.equal(read.next().turbo, true);
  assert.equal(read.next().brake, true);
  assert.equal(read.next(), null);
  assert.deepEqual(
    decoded.words,
    tape.words,
    "replay must not decrement its source data",
  );
  for (let code = 0; code < 2048; code++) {
    const pad =
      (code & 15) | ((code & (7 << 4)) << 1) | ((code & (15 << 7)) << 5);
    // Opposing D-pad directions cancel in the browser Input API.
    const input = padInput(pad),
      recorder = new ReplayRecorder();
    recorder.record(input);
    const restored = new ReplayReader(recorder.tape(meta)).next();
    assert.deepEqual(restored, input, `pad ${pad}`);
    assert.equal(inputPad(restored), inputPad(input));
  }
  const saturated = new ReplayRecorder();
  for (let i = 0; i < 4096; i++) saturated.record({ accel: !!(i & 1) });
  saturated.record({ accel: true });
  assert.equal(saturated.words.length, 4096);
  assert.equal(saturated.frames, 4096);
  assert.equal(saturated.full, true);
  for (const [offset, value] of [
    [0, 0],
    [2, 6],
    [3, 9],
    [6, 7],
    [40, 3],
    [52, 3],
  ]) {
    const invalid = bytes.slice();
    invalid[offset] = value;
    assert.throws(() => decodeOriginalReplay(invalid), /replay/i);
  }
  assert.throws(() => decodeOriginalReplay(bytes.slice(0, 130)), /extent/i);
  const box = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(__dirname + "/../dist/tracks.js", "utf8"),
    box,
  );
  const track = E.prepare(box.window.HOVER_TRACKS[0]);
  // Independently drive the actual engine, including all CPU slots/collisions,
  // then replay its input tape. Compare every frame, including fractional axes.
  for (const gameMode of [1, 4]) {
    const recorder = new ReplayRecorder(),
      saved = [];
    const car = E.placeOnGrid(E.create(track, 3), track);
    const bots =
      gameMode === 4
        ? []
        : [0, 1, 2].map((type, i) => {
            const bot = E.placeOnGrid(E.create(track, type), track, i + 1);
            bot.cpuLevel = E.cpuLevels[2][0];
            bot.cpuSlot = i + 1;
            return bot;
          });
    for (let frame = 0; frame < 300; frame++) {
      const input = {
        accel: true,
        steer: frame < 150 ? 0 : 0.13,
        pitch: 0,
        l1: frame % 40 < 8,
      };
      recorder.record(input);
      E.step(car, track, input, 1 / 60);
      for (const bot of bots)
        E.step(
          bot,
          track,
          E.driveCPU(bot, track, car),
          1 / 60,
          true,
          !bot.finished,
        );
      E.collideAll([car, ...bots]);
      saved.push(
        [car, ...bots].map((c) => [
          c.x,
          c.y,
          c.z,
          c.heading,
          c.damage,
          ...c.front,
          ...c.rear,
        ]),
      );
    }
    const session = new InputReplay(
      recorder.tape({ ...meta, gameMode }),
      track,
    );
    saved.forEach((expected, i) => {
      assert.equal(session.step(), true);
      assert.deepEqual(
        [session.car, ...session.bots].map((c) => [
          c.x,
          c.y,
          c.z,
          c.heading,
          c.damage,
          ...c.front,
          ...c.rear,
        ]),
        expected,
        `mode ${gameMode} frame ${i}`,
      );
    });
    assert.equal(session.step(), false);
  }
  const memorySource = fs.readFileSync(
    __dirname + "/../dist/replay-memory.js",
    "utf8",
  );
  const { ReplayMemory } = await import(
    "data:text/javascript;base64," +
      Buffer.from(memorySource).toString("base64")
  );
  const memory = new ReplayMemory();
  const firstTape = {
    ...tape,
    gameMode: 4,
    course: 0,
    machine: 0,
    totalTicks: 1000,
  };
  assert.equal(memory.beginRace(0, 0, 4), null);
  memory.complete(firstTape);
  assert.equal(
    memory.beginRace(0, 1, 4),
    firstTape,
    "different machine uses the same source ghost",
  );
  const slower = { ...firstTape, machine: 1, totalTicks: 1100 };
  memory.complete(slower);
  assert.equal(memory.saved, firstTape);
  assert.equal(memory.recent, slower);
  memory.complete({ ...slower, frames: slower.frames + 1 });
  assert.equal(
    memory.saved,
    firstTape,
    "repeated finish snapshots retain the race's starting ghost",
  );
  memory.beginRace(0, 2, 4);
  memory.complete({ ...slower, machine: 2, totalTicks: 1000 });
  assert.equal(memory.saved, firstTape, "ties do not replace the ghost buffer");
  memory.beginRace(0, 3, 4);
  const faster = { ...firstTape, machine: 3, totalTicks: 900 };
  memory.complete(faster);
  assert.equal(memory.saved, faster);
  assert.equal(memory.beginRace(1, 0, 4), null);
  assert.equal(
    memory.saved,
    faster,
    "choosing/aborting another course preserves the existing replay",
  );
  const otherCourse = { ...firstTape, course: 1, totalTicks: 1200 };
  memory.complete(otherCourse);
  assert.equal(
    memory.beginRace(0, 0, 4),
    null,
    "there is one source buffer, not a per-course cache",
  );
  memory.beginRace(1, 0, 4, false);
  const disabled = { ...otherCourse, totalTicks: 1300 };
  memory.complete(disabled);
  assert.equal(
    memory.saved,
    disabled,
    "a run without a ghost records unconditionally",
  );
  const suzuki = { ...firstTape, machine: 5 };
  memory.beginRace(0, 5, 4);
  memory.complete(suzuki);
  assert.equal(
    memory.beginRace(0, 5, 4),
    null,
    "SUZUKI versus SUZUKI has no ghost",
  );
  const slowSuzuki = { ...suzuki, totalTicks: 2000 };
  memory.complete(slowSuzuki);
  assert.equal(
    memory.saved,
    slowSuzuki,
    "the source's SUZUKI exception also affects replacement",
  );
  assert.equal(memory.beginRace(0, 0, 4), slowSuzuki);
  assert.equal(memory.beginRace(0, 0, 1), null);
  const practice = { ...firstTape, gameMode: 1 };
  memory.complete(practice);
  assert.equal(
    memory.beginRace(0, 0, 4),
    null,
    "a completed GP/practice replay replaces the TA buffer",
  );
  // A source posr fraction must survive movement, and replay/ghost falling
  // must use the same drag, gravity, attitude and integer movement as live play.
  const fallingTape = { ...firstTape, machine: 0, gameMode: 4 };
  const fallingRun = new InputReplay(fallingTape, track);
  const fallingGhost = new GhostReplay(fallingTape, track);
  const fallingCar = E.placeOnGrid(E.create(track, 0), track);
  E.step(fallingCar, track, { accel: true }, 1 / 60);
  fallingCar.finished = true;
  fallingCar.reason = "course-out";
  fallingCar.front = [777, 1234, -555];
  fallingCar.rear = [212, 654, -124];
  fallingCar.roll = 0.1;
  fallingRun.car = structuredClone(fallingCar);
  fallingGhost.car = structuredClone(fallingCar);
  const fallSnapshot = (car) => [
    car.x,
    car.y,
    car.z,
    car.ticks,
    car.time,
    car.sourceSpeed,
    car.roll,
    ...car.front,
    ...car.rear,
    ...car.sourcePosition,
  ];
  for (let frame = 0; frame < 16; frame++) {
    E.stepFalling(fallingCar);
    assert.equal(fallingRun.step(), true);
    fallingGhost.step();
    assert.deepEqual(
      fallSnapshot(fallingRun.car),
      fallSnapshot(fallingCar),
      "replay source falling prefix",
    );
    assert.deepEqual(
      fallSnapshot(fallingGhost.car),
      fallSnapshot(fallingCar),
      "ghost source falling prefix",
    );
  }
  // Ghost simulation follows the recorded physics and keeps coasting when
  // the input stream ends. It does not wrap, freeze, or finish its own laps.
  const gr = new ReplayRecorder(),
    ghostBaseline = E.placeOnGrid(E.create(track, 0), track),
    positions = [];
  for (let i = 0; i < 120; i++) {
    const input = { accel: true, l1: i % 20 < 3 };
    gr.record(input);
    E.step(ghostBaseline, track, input, 1 / 60);
    positions.push([
      ghostBaseline.x,
      ghostBaseline.y,
      ghostBaseline.z,
      ...ghostBaseline.front,
      ...ghostBaseline.rear,
    ]);
  }
  const ghost = new GhostReplay(
    gr.tape({ ...meta, machine: 0, gameMode: 4 }),
    track,
  );
  for (let i = 0; i < 119; i++) {
    ghost.step();
    assert.deepEqual(
      [
        ghost.car.x,
        ghost.car.y,
        ghost.car.z,
        ...ghost.car.front,
        ...ghost.car.rear,
      ],
      positions[i],
    );
  }
  ghost.step();
  assert.equal(
    ghost.car.active.accel,
    false,
    "the source clears the final tick's ghost input",
  );
  const endZ = ghost.car.z;
  ghost.step();
  ghost.step();
  assert.equal(ghost.reader.frame, 120);
  assert.equal(ghost.car.ticks, 122);
  assert.notEqual(ghost.car.z, endZ);
  const beforeCollision = JSON.stringify([
    ghost.car.front,
    ghost.car.rear,
    ghost.car.damage,
  ]);
  const collisionPlayer = E.create(track);
  Object.assign(collisionPlayer, {
    x: ghost.car.x,
    y: ghost.car.y,
    z: ghost.car.z,
  });
  E.collide(ghost.car, collisionPlayer);
  assert.equal(
    JSON.stringify([ghost.car.front, ghost.car.rear, ghost.car.damage]),
    beforeCollision,
  );
  const flatTile = (tile) =>
    E.prepare({
      name: "ghost floor",
      theme: 0,
      samples: [
        {
          l: [-100, 0, -100],
          r: [100, 0, -100],
          end: { l: [-100, 0, 1000], r: [100, 0, 1000] },
          tiles: tile.repeat(4),
          allTiles: tile.repeat(8),
        },
      ],
    });
  for (const tile of ["g", "d", "P"]) {
    const floor = flatTile(tile),
      gp = new GhostReplay(
        gr.tape({ ...meta, machine: 0, gameMode: 4 }),
        floor,
      ),
      player = E.placeOnGrid(E.create(floor, 0), floor);
    gp.car.linePosition = player.linePosition = 64;
    gp.car.previousTile = player.previousTile = ".";
    gp.car.laps = [1, 1];
    player.laps = [1, 1];
    if (tile === "P") gp.car.damage = player.damage = 12000;
    gp.step();
    E.step(player, floor, {}, 1 / 60);
    if (tile === "g") {
      assert.equal(gp.car.laps.length, 2);
      assert.equal(gp.car.finished, false);
      assert.equal(player.finished, true);
    }
    if (tile === "d") {
      assert.equal(gp.car.damage, 0);
      assert.ok(player.damage > 0);
      assert.equal(gp.car.damageSemi, false);
    }
    if (tile === "P") {
      assert.equal(gp.car.damage, player.damage);
      assert.equal(gp.car.repairFrames || 0, 0);
      assert.ok(player.events.includes("repair"));
    }
  }
  const soundSource = fs.readFileSync(__dirname + "/../dist/sound.js", "utf8");
  const { OriginalSound } = await import(
    "data:text/javascript;base64," + Buffer.from(soundSource).toString("base64")
  );
  for (const loop of [false, true]) {
    const sound = new OriginalSound();
    sound.context = { state: "running", currentTime: 0 };
    sound.song = { events: [[0, 192, 7, 0]], duration: 0.1 };
    sound.channels = [{ program: 0 }];
    sound.cursor = 0;
    sound.epoch = 0;
    sound.musicLoop = loop;
    sound.pendingCourse = "SAMPLE19";
    sound.schedule();
    assert.equal(
      sound.song !== null,
      loop,
      "ending music plays once, menus loop",
    );
    if (!loop) assert.equal(sound.pendingCourse, null);
  }
  console.log(
    "PASS: original hR/128-byte header, 8KB RLE input, all pad combinations, 32-tick runs, immutable playback, malformed extents, deterministic 60Hz physics/CPU replay, TA buffer policy, ghost floors/collisions/end coasting and analog sidecar",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
