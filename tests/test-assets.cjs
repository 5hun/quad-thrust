const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
global.window = global;
require("../dist/music.js");
require("../dist/models.js");
for (const [name, song] of Object.entries(HOVER_MUSIC.songs)) {
  const programs = Array(16).fill(0);
  let last = 0,
    notes = 0;
  for (const [time, status, a, b] of song.events) {
    assert.ok(time >= last && time <= song.duration);
    last = time;
    const ch = status & 15;
    if (status >> 4 === 12) programs[ch] = a;
    if (status >> 4 === 9 && b) {
      const tones = HOVER_MUSIC.programs[programs[ch]];
      assert.ok(tones, `${name}: missing program ${programs[ch]}`);
      const intentionalSilence =
        (name === "HOVER2" && programs[ch] === 127 && a === 28) ||
        (name === "SAMPLE16" && programs[ch] === 127 && a === 51) ||
        // SELECT.SEQ also contains percussion keys absent from the supplied VAB.
        (name === "SELECT" && programs[ch] === 127 && [36, 56].includes(a));
      assert.ok(
        intentionalSilence || tones.some((t) => a >= t.min && a <= t.max),
        `${name}: unexpected unmapped note ${a}`,
      );
      notes++;
    }
  }
  assert.ok(notes > 100);
  console.log(name, notes, "notes: instruments and timing valid");
}
for (const sample of Object.values(HOVER_MUSIC.samples)) {
  const b = fs.readFileSync(
    path.join(__dirname, "../dist/assets", sample.file),
  );
  assert.equal(b.toString("ascii", 0, 4), "RIFF");
  assert.ok(sample.loopEnd > sample.loopStart);
  assert.ok(b.length > 44);
}
assert.equal(HOVER_MUSIC.courses.length, 9);
assert.equal(Object.keys(HOVER_MUSIC.samples).length, 17);
assert.ok(HOVER_MODELS.OTHER[0]["solid|semi"]);
assert.equal(HOVER_MODELS.ALP_0_9.length, 15);
console.log(
  "PASS: 12 original sequences, 17 original samples, 9 course mappings, translucent POWER UP and countdown models",
);

require("../dist/backgrounds.js");
assert.equal(HOVER_BACKGROUNDS.length, 5);
for (const bank of HOVER_BACKGROUNDS) {
  for (const [names, width, height] of [
    [bank.sky, 640, 120],
    [bank.ground, 128, 128],
  ]) {
    assert.equal(names.length, 3);
    for (const name of names) {
      const b = fs.readFileSync(
        path.join(__dirname, "../dist/assets", name + ".png"),
      );
      assert.equal(b.readUInt32BE(16), width);
      assert.equal(b.readUInt32BE(20), height);
    }
  }
}
console.log("PASS: all 30 original background images and their dimensions");
