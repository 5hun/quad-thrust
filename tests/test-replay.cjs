const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const source = fs.readFileSync(
    require("node:path").join(__dirname, "../dist/replay.js"),
    "utf8",
  );
  const { sampleReplay } = await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
  const frames = [
    [0, 0, 0, 0, Math.PI - 0.1, 0, 0],
    [0.1, 10, 2, 4, -Math.PI + 0.1, 0.2, 0.4],
    [0.35, 35, 7, 14, -Math.PI + 0.6, 0.7, 1.4],
  ];
  assert.equal(sampleReplay([], 0, 0), null);
  assert.equal(sampleReplay([frames[0]], 90, 3).type, 3);
  const middle = sampleReplay(frames, 0.05, 1);
  assert.ok(Math.abs(middle.x - 5) < 1e-9);
  assert.ok(middle.sourceSpeed > 0);
  assert.ok(Math.abs(middle.heading - Math.PI) < 1e-9);
  // 60 Hz output must move on every frame between recorded 10 Hz samples.
  const samples = Array.from({ length: 18 }, (_, i) =>
    sampleReplay(frames, i / 60, 1),
  );
  samples.forEach((p, i) => {
    assert.ok(Math.abs(p.x - (i / 60) * 100) < 1e-8);
    if (i) assert.ok(p.x > samples[i - 1].x);
  });
  assert.ok(Math.abs(sampleReplay(frames, 0.4, 0).x - 5) < 1e-8);
  console.log(
    "PASS: replay timestamps, 60 Hz movement from 10 Hz data, irregular sample intervals, angle wrap, loops, empty/single frames",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
