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
    "PASS: original hR/128-byte header, 8KB RLE input, all pad combinations, 32-tick runs, immutable playback, malformed extents, deterministic 60Hz physics/CPU replay and analog sidecar",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
