const E = require("../dist/engine.js"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const b = { window: {} };
vm.runInNewContext(
  fs.readFileSync(__dirname + "/../dist/tracks.js", "utf8"),
  b,
);
for (const raw of b.window.HOVER_TRACKS) {
  const t = E.prepare(raw),
    c = E.placeOnGrid(E.create(t), t);
  for (let i = 0; i < 60000 && !c.finished; i++) {
    E.step(c, t, E.drive(c, t), 1 / 60, true);
    if (c.laps.length >= 3) break;
  }
  assert.equal(c.laps.length, 3, t.name + " must be completable");
  console.log(t.name, "laps", c.laps.length, "seconds", c.time.toFixed(1));
}

// Exercise the actual race CPU controller, including the KNight Town wall trap.
for (let difficulty = 0; difficulty < 4; difficulty++) {
  for (const [course, raw] of b.window.HOVER_TRACKS.entries()) {
    const t = E.prepare(raw);
    for (let slot = 1; slot <= 3; slot++) {
      const c = E.placeOnGrid(E.create(t, slot), t, slot);
      c.cpuLevel = E.cpuLevels[difficulty][course];
      c.cpuSlot = slot;
      let recoveries = 0;
      for (let i = 0; i < 60000 && c.laps.length < 3; i++) {
        if (c.finished) {
          E.recover(c, t);
          recoveries++;
        }
        E.step(c, t, E.driveCPU(c, t, c), 1 / 60, true);
      }
      assert.equal(
        c.laps.length,
        3,
        `${t.name} difficulty ${difficulty} CPU slot ${slot} must finish`,
      );
      assert.ok(recoveries < 20, `${t.name} CPU repeatedly fell off`);
    }
    console.log(
      t.name,
      "all three CPU slots complete at difficulty",
      difficulty,
    );
  }
}
