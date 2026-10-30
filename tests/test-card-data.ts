import type {} from "./types";
const assert: typeof import("node:assert/strict") = require("node:assert/strict"),
  fs = require("node:fs") as typeof import("node:fs");
(async () => {
  const inputURL =
    "data:text/javascript;base64," +
    fs.readFileSync(__dirname + "/../dist/input-replay.js").toString("base64");
  const source = fs
    .readFileSync(__dirname + "/../dist/card-data.js", "utf8")
    .replace('"./input-replay.js"', JSON.stringify(inputURL));
  const {
    defaultSystem,
    encodeCard,
    decodeCard,
    decodeReplayPack,
    recordChecksum,
    MemoryCards,
    SessionStore,
  } = (await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  )) as typeof import("../src/card-data");
  const template = Array.from(
    fs.readFileSync(__dirname + "/../dist/assets/card-template.bin"),
  );
  assert.equal(template.length, 256);
  assert.deepEqual(template.slice(0, 4), [83, 67, 17, 1]);
  const pack = fs.readFileSync(
    __dirname + "/../dist/assets/special-replays.bin",
  );
  const special = decodeReplayPack(pack);
  assert.deepEqual(
    special.map((t) => [t!.machine, t!.course, t!.frames, t!.totalTicks]),
    [
      [3, 2, 4665, 4489],
      [0, 3, 3239, 3063],
      [2, 6, 7304, 7128],
    ],
    "original REPLAY.DAT golden headers",
  );
  assert.deepEqual(
    special.map((t) => t!.name!.trim()),
    ["GHOST 01", "GHOST 02", "GHOST 03"],
  );
  const system = defaultSystem();
  system.level = -1;
  system.auto = 3;
  system.unlocks = 15;
  system.userName = "UZU";
  system.training = Array(16).fill(31);
  system.records["time:8:total"][0] = { time: 12.5, machine: 5, name: "A?1" };
  const card = { system, replays: special, template },
    bytes = encodeCard(card),
    view = new DataView(bytes.buffer);
  assert.equal(bytes.length, 8192);
  assert.deepEqual(Array.from(bytes.slice(0, 256)), template);
  assert.equal(bytes[256], 3);
  assert.equal(view.getInt32(280, true), -1);
  assert.equal(view.getInt32(272, true), 15);
  assert.deepEqual(Array.from(bytes.slice(257, 260)), [20, 25, 20]);
  assert.equal(view.getUint16(384 + 144 + 216 + 17 * 6 * 2, true), 750);
  assert.equal(view.getUint32(384 + (17 * 2 + 1) * 4, true) & 15, 5);
  assert.deepEqual(
    Array.from(
      bytes.slice(
        384 + 576 + 324 + 17 * 6 * 3,
        384 + 576 + 324 + 17 * 6 * 3 + 3,
      ),
    ),
    [0, 42, 31],
  );
  assert.equal(view.getUint16(1664, true), 0x5268);
  assert.equal(view.getUint16(1792, true), 0x5268);
  assert.equal(view.getUint16(2048, true), special[0]!.words[0]);
  assert.deepEqual(decodeCard(bytes).system, system);
  assert.deepEqual(
    decodeCard(bytes).replays.map((t) => t!.words),
    special.map((t) => t!.words),
  );
  // The MIPS binary uses signed lb at 0x800af8b8/0x800af8bc in sam_set.
  // Exercise high bytes independently of the encoder's record construction.
  const checksumBytes = new Uint8Array(1280);
  checksumBytes[0] = 255;
  checksumBytes[1279] = 128;
  let oracle = 0;
  for (let i = 0; i < 1280; i++) {
    const a = i === 0 ? -1 : i === 1279 ? -128 : 0,
      b = i === 0 ? -128 : i === 1279 ? -1 : 0;
    oracle = (oracle + a + 8 + i + a * b) | 0;
  }
  assert.equal(recordChecksum(checksumBytes), oracle);
  for (const offset of [0, 384, 800, 1663]) {
    const bad = bytes.slice();
    bad[offset] ^= 1;
    assert.throws(() => decodeCard(bad), /不正/);
  }
  assert.throws(() => decodeCard(bytes.slice(0, 2047)), /不正/);
  const records = new SessionStore();
  records.apply(system);
  assert.equal(
    records.snapshot().level,
    -1,
    "EASY must not become NORMAL through falsy zero",
  );
  assert.deepEqual(records.snapshot(), system);
  const storage = new SessionStore(),
    cards = new MemoryCards(storage, template);
  assert.equal(cards.read(0), null);
  cards.saveSystem(0, system);
  cards.saveReplay(0, 1, { ...special[0]!, axes: { 0: [0.3, 0.5] } }, system);
  cards.saveSystem(0, { ...system, level: 2 });
  assert.equal(cards.read(0)!.system.level, 2);
  assert.equal(cards.read(0)!.replays[1]!.name!.trim(), "GHOST 01");
  assert.deepEqual(cards.read(0)!.replays[1]!.axes, { 0: [0.3, 0.5] });
  cards.saveSystem(1, defaultSystem());
  assert.equal(cards.read(1)!.system.unlocks, 0);
  const large = { ...special[0]!, frames: 3000, words: Array(3000).fill(0) };
  cards.saveReplay(1, 0, large, system);
  cards.saveReplay(1, 1, { ...special[0]!, frames: 1, words: [0] }, system);
  const before = storage.getItem("hover-card-v1-1");
  assert.throws(
    () =>
      cards.saveReplay(1, 2, { ...special[0]!, frames: 1, words: [0] }, system),
    /空き/,
  );
  assert.equal(
    storage.getItem("hover-card-v1-1"),
    before,
    "failed capacity check is atomic",
  );
  cards.deleteReplay(1, 0);
  assert.equal(cards.read(1)!.replays[0], null);
  assert.equal(cards.read(1)!.replays[1]!.words.length, 1);
  cards.saveReplay(1, 2, special[2]!, system);
  assert.equal(cards.read(1)!.replays[2]!.machine, 2);
  const old = new SessionStore();
  old.setItem("hover-unlocks", "7");
  old.setItem("hover-training-marks", JSON.stringify(Array(15).fill(31)));
  old.setItem("hover-player-name", "SAT");
  const migrate = new MemoryCards(old, template);
  migrate.migrateLegacy();
  assert.equal(migrate.read(0)!.system.unlocks, 15);
  assert.equal(old.getItem("hover-unlocks"), "7");
  migrate.saveSystem(0, defaultSystem());
  migrate.migrateLegacy();
  assert.equal(
    migrate.read(0)!.system.unlocks,
    0,
    "legacy migration does not overwrite a card on later boots",
  );
  const R = require("../dist/rules.js") as typeof HoverRules,
    T = require("../dist/training.js") as typeof HoverTraining;
  const trainingState = new SessionStore();
  trainingState.apply({
    ...defaultSystem(),
    unlocks: 7,
    training: Array(16).fill(31),
  });
  R.useStorage(trainingState);
  T.useStorage(trainingState);
  assert.equal(
    R.machineCount(),
    5,
    "TRAINIG.C does not award the final machine during task selection",
  );
  R.completeTraining();
  assert.equal(R.machineCount(), 6, "the training-exit gate awards SUZUKI");
  const denied = new MemoryCards(
    {
      getItem: () => null,
      setItem: () => {
        throw Error("quota internals");
      },
    },
    template,
  );
  assert.throws(
    () => denied.saveSystem(0, system),
    /^Error: カードに保存できません$/,
  );
  console.log(
    "PASS: original SC/icon, 384/1280/3x128-byte layout, signed checksum, native special replays, record nibbles/names, 8KB/6144-byte capacity, independent slots, transactional save/delete, analog sidecar and nondestructive legacy migration",
  );
})().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
