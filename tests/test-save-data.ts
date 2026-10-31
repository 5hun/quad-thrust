import type {} from "./types";
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const fs: typeof import("node:fs") = require("node:fs");
(async () => {
  const { SaveStore, SAVE_KEY } = (await import(
    "data:text/javascript;base64," +
      fs.readFileSync(__dirname + "/../dist/save-data.js").toString("base64")
  )) as typeof import("../src/save-data");
  const disk = new Map<string, string>();
  let writes = 0,
    blocked = false;
  const storage = {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem(key: string, value: string) {
      if (blocked) throw Error("Quota exceeded");
      writes++;
      disk.set(key, value);
    },
  };
  // Old direct keys and card slots are deliberately ignored and left untouched.
  disk.set("hover-unlocks", "15");
  disk.set("hover-card-v1-0", "old card");
  const save = new SaveStore(storage);
  assert.equal(save.getItem("hover-unlocks"), "0");
  assert.equal(save.getItem("hover-cpu-difficulty"), null);
  assert.equal(writes, 0, "startup does not overwrite existing storage");
  const values = {
    "hover-unlocks": "7",
    "hover-player-name": "B9!",
    "hover-records-time-8-lap": JSON.stringify([
      { time: 10.25, machine: 4, name: "B9!" },
    ]),
    "hover-v3-record-time-8": "10.25",
  };
  for (const [key, value] of Object.entries(values)) {
    save.setItem(key, value);
    // Each mutation is durable immediately, with no menu exit/unload callback.
    const restored = new SaveStore(storage);
    assert.equal(restored.getItem(key), value);
  }
  const restored = new SaveStore(storage);
  for (const [key, value] of Object.entries(values))
    assert.equal(restored.getItem(key), value);
  assert.equal(disk.get("hover-unlocks"), "15");
  assert.equal(disk.get("hover-card-v1-0"), "old card");
  assert.equal([...disk.keys()].filter((key) => key === SAVE_KEY).length, 1);
  const count = writes;
  save.setItem("hover-player-name", "B9!");
  assert.equal(writes, count, "unchanged values do not write");
  save.setItem("hover-cpu-difficulty", "3");
  assert.equal(writes, count, "removed GAME LEVEL setting is not stored");
  const before = disk.get(SAVE_KEY);
  blocked = true;
  save.setItem("hover-player-name", "ZZZ");
  assert.equal(save.saveError, true);
  assert.equal(save.getItem("hover-player-name"), "ZZZ", "RAM stays usable");
  assert.equal(disk.get(SAVE_KEY), before, "failed write preserves prior save");
  blocked = false;
  save.setItem("hover-player-name", "ZZZ");
  assert.equal(save.saveError, false, "future mutations retry persistence");
  assert.equal(new SaveStore(storage).getItem("hover-player-name"), "ZZZ");
  // Saves from before GAME LEVEL was removed still load their progress.
  const legacy = new SaveStore({
    getItem: () =>
      JSON.stringify({
        version: 2,
        values: { "hover-unlocks": "3", "hover-cpu-difficulty": "2" },
      }),
    setItem() {},
  });
  assert.equal(legacy.getItem("hover-unlocks"), "3");
  assert.equal(legacy.getItem("hover-cpu-difficulty"), null);
  const disabled = new SaveStore({
    getItem() {
      throw Error("Disabled");
    },
    setItem() {
      throw Error("Disabled");
    },
  });
  disabled.setItem("hover-unlocks", "1");
  assert.equal(disabled.getItem("hover-unlocks"), "1");
  for (const raw of [
    "{",
    "null",
    JSON.stringify({ version: 1, values }),
    JSON.stringify({ version: 99, values }),
    JSON.stringify({ version: 2, values: [] }),
    ...[null, 4, "4", "NaN"].map((value) =>
      JSON.stringify({
        version: 2,
        values: { "hover-cpu-difficulty": value },
      }),
    ),
    JSON.stringify({ version: 2, values: { "hover-training-marks": "{}" } }),
    JSON.stringify({ version: 2, values: { "hover-unlocks": "8" } }),
    JSON.stringify({
      version: 2,
      values: { "hover-records-time-0-lap": '[{"time":10,"machine":5}]' },
    }),
    JSON.stringify({
      version: 2,
      values: { "hover-records-time-0-lap": '[{"time":-1,"machine":0}]' },
    }),
  ]) {
    disk.set(SAVE_KEY, raw);
    const recovered = new SaveStore(storage);
    assert.equal(recovered.getItem("hover-player-name"), "AAA");
    assert.equal(recovered.getItem("hover-unlocks"), "0");
    recovered.setItem("hover-unlocks", "2");
    assert.equal(new SaveStore(storage).getItem("hover-unlocks"), "2");
  }
  console.log(
    "PASS: immediate single autosave/reload, defaults, no legacy import, validation, storage failure and retry",
  );
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
