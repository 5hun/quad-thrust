const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const { GPRecordSequence } = await import(
    "data:text/javascript;base64," +
      fs
        .readFileSync(__dirname + "/../dist/gp-record-sequence.js")
        .toString("base64")
  );
  // Independent checkpoints from GAME.C grandprix_entry_mode's timm ranges.
  const pages = new GPRecordSequence(3, true);
  for (let i = 0; i < 200; i++) pages.tick();
  assert.equal(pages.frame, 0, "name entry holds the presentation clock");
  pages.start();
  assert.equal(pages.done, false, "Start cannot bypass name entry");
  pages.finishName();
  const checkpoints = new Map([
    [59, [0, "gap"]],
    [60, [0, "lap"]],
    [479, [0, "lap"]],
    [480, [0, "gap"]],
    [539, [0, "gap"]],
    [540, [0, "total"]],
    [959, [0, "total"]],
    [960, [1, "gap"]],
    [1020, [1, "lap"]],
    [1500, [1, "total"]],
    [1920, [2, "gap"]],
    [1980, [2, "lap"]],
    [2460, [2, "total"]],
  ]);
  while (!pages.done) {
    const expected = checkpoints.get(pages.frame);
    if (expected)
      assert.deepEqual(
        [pages.course, pages.page],
        expected,
        `tick ${pages.frame}`,
      );
    pages.tick();
  }
  assert.equal(pages.frame, 2880);
  const skipped = new GPRecordSequence(2, false);
  skipped.skipPage();
  assert.equal(skipped.frame, 0);
  for (let i = 0; i < 60; i++) skipped.tick();
  skipped.start();
  assert.equal(skipped.done, false, "source requires timm > 60 for Start");
  skipped.skipPage();
  assert.equal(skipped.frame, 480);
  assert.equal(
    skipped.page,
    "gap",
    "skipping BESTLAP preserves the one-second gap",
  );
  for (let i = 0; i < 60; i++) skipped.tick();
  assert.equal(skipped.page, "total");
  skipped.skipPage();
  assert.equal(skipped.course, 1);
  assert.equal(skipped.page, "gap");
  for (let i = 0; i < 60; i++) skipped.tick();
  assert.equal(skipped.page, "lap");
  skipped.tick();
  skipped.start();
  assert.equal(skipped.done, true);
  console.log(
    "PASS: source GP record clock, held name entry, one-second transitions, seven-second tables, three-course order, button skips and Start boundary",
  );
})();
