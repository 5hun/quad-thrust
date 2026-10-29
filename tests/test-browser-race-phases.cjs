/* global window */
const assert = require("node:assert/strict");
module.exports = async function verify({ chromium, executablePath, baseURL }) {
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const snapshot = () => page.evaluate(() => window.hoverDiagnostics());
    const wait = (state) =>
      page.waitForFunction(
        (state) => window.hoverDiagnostics?.().state === state,
        state,
      );
    async function start(mode) {
      await page.goto(baseURL);
      await wait("menu");
      await page.evaluate(async () => {
        const { HoverRenderer } = await import("./renderer.js");
        const draw = HoverRenderer.prototype.draw;
        HoverRenderer.prototype.draw = function (...args) {
          draw.apply(this, args);
          window.phaseView = {
            flames: this.ships.map((s) => s.flames.some((f) => f.visible)),
            sides: this.ships.map((s) => s.sides.some((f) => f.visible)),
            camera: this.camera.position.toArray(),
          };
        };
      });
      const click = (name) =>
        page.getByRole("button", { name, exact: true }).click();
      await click("START");
      if (mode === "time") await click("TIME ATTACK");
      else if (mode.startsWith("train")) {
        await click("TRAINING");
        await click(mode === "train1" ? "LEVEL 2" : "LEVEL 1");
        await page.keyboard.press("Enter");
      } else {
        await click("GRANDPRIX");
        await click(mode === "practice" ? "PRACTICE" : "Blue GP");
      }
      await page.keyboard.press("Enter");
      if (mode === "time" || mode === "practice")
        await page.keyboard.press("Enter");
      await wait("countdown");
    }
    async function forceFinish(winner) {
      await page.evaluate((winner) => {
        const step = window.HoverEngine.step;
        let first = true;
        window.HoverEngine.step = (car, ...args) => {
          step(car, ...args);
          if (first) {
            first = false;
            car.finished = true;
            car.reason = "finish";
            car.laps = [10, 11, 12];
            car.time = 33;
            car.progress = winner ? 1e6 : -1e6;
          } else if (args[4] === false) {
            // Change the running order after the finish. The podium and
            // progression must still use the order at the finish line.
            car.progress = car.cpuSlot ? (winner ? 2e6 : -2e6) : 0;
          }
        };
      }, winner);
      await wait("finished");
    }
    await start("gp0");
    await page.keyboard.down("Space");
    await page.keyboard.down("Shift");
    await page.keyboard.down("q");
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(35);
      const d = await snapshot();
      const view = await page.evaluate(() => window.phaseView);
      assert.equal(d.state, "countdown");
      assert.equal(d.time, 0);
      assert.equal(d.fireTail, 0);
      assert.ok(
        view.flames.every((v) => !v),
        "no player or CPU exhaust before the start",
      );
      assert.ok(
        view.sides.every((v) => !v),
        "thruster buttons cannot draw startup flames",
      );
    }
    await page.keyboard.up("Shift");
    await page.keyboard.up("q");
    await wait("running");
    await page.waitForTimeout(200);
    assert.ok(
      (await snapshot()).speed > 0,
      "held accelerator starts working after countdown",
    );
    await page.keyboard.up("Space");
    await forceFinish(false);
    const before = await snapshot();
    const viewBefore = await page.evaluate(() => window.phaseView);
    await page.keyboard.down("s");
    await page.keyboard.down("Shift");
    await page.waitForTimeout(600);
    await page.keyboard.up("s");
    await page.keyboard.up("Shift");
    const after = await snapshot();
    const viewAfter = await page.evaluate(() => window.phaseView);
    assert.equal(after.finishRank, 4);
    assert.equal(after.finishCamera, true);
    assert.equal(after.time, before.time);
    assert.equal(after.lap, 3);
    assert.notDeepEqual(
      after.front,
      before.front,
      "autopilot continues after finishing",
    );
    assert.notDeepEqual(
      viewAfter.camera,
      viewBefore.camera,
      "camera keeps moving during rank text",
    );
    assert.ok(
      after.opponents.every((b, i) => b.ticks > before.opponents[i].ticks),
    );
    await page.waitForFunction(
      () => window.hoverDiagnostics().continueChoice === 0,
    );
    const continued = await snapshot();
    await page.waitForTimeout(250);
    assert.ok(
      (await snapshot()).opponents.every(
        (b, i) => b.ticks > continued.opponents[i].ticks,
      ),
    );
    await start("gp0");
    await wait("running");
    await forceFinish(true);
    await page.waitForTimeout(350);
    assert.equal(
      (await snapshot()).finishCamera,
      false,
      "winning GP retains normal chase camera",
    );
    await page.waitForFunction(() => window.hoverDiagnostics().gpRound === 1);
    for (const mode of ["time", "practice"]) {
      await start(mode);
      await wait("running");
      await forceFinish(true);
      await page.waitForTimeout(350);
      const d = await snapshot();
      assert.equal(
        d.finishCamera,
        true,
        mode + " uses front chase after finish",
      );
      assert.equal(d.time, 33);
      await page.waitForFunction(() => !!window.hoverDiagnostics().postrace);
    }
    // Rolling training retains its source autopilot before the start, and
    // continues animating under the COMPLETE/MISS text with a frozen timer.
    for (const status of ["complete", "miss"]) {
      await start("train1");
      const rolling = await snapshot();
      await page.waitForTimeout(200);
      assert.ok((await snapshot()).ticks > rolling.ticks);
      assert.ok((await snapshot()).speed > 0);
      await wait("running");
      await page.evaluate((status) => {
        window.HoverTraining.step = (session) => {
          session.status = status;
          session.reason = "test";
        };
      }, status);
      await wait("finished");
      const a = await snapshot();
      await page.waitForTimeout(300);
      const b = await snapshot();
      assert.ok(b.ticks > a.ticks, "training result keeps simulation alive");
      assert.equal(b.time, a.time);
      assert.equal(b.training.remaining, a.training.remaining);
      assert.equal(b.finishCamera, status === "miss");
    }
    // Other racers keep moving during the player's destruction/fall wait.
    for (const reason of ["destroyed", "course-out"]) {
      await start("practice");
      await wait("running");
      await page.evaluate((reason) => {
        const step = window.HoverEngine.step;
        let first = true;
        window.HoverEngine.step = (car, ...args) => {
          step(car, ...args);
          if (first) {
            first = false;
            car.finished = true;
            car.reason = reason;
          }
        };
      }, reason);
      await wait(reason === "destroyed" ? "destroyed" : "falling");
      const a = await snapshot();
      await page.waitForTimeout(300);
      const b = await snapshot();
      assert.ok(
        b.opponents.every((car, i) => car.ticks > a.opponents[i].ticks),
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: countdown input/exhaust; live goal autopilot/cameras; fixed records/rank; GP progression and CONTINUE; time/practice entry; opponents during destruction/fall",
    );
  } finally {
    await browser.close();
  }
};
if (require.main === module) {
  const { chromium } = require(process.argv[2] || "playwright");
  module
    .exports({
      chromium,
      executablePath: process.argv[3],
      baseURL: process.argv[4] || "http://127.0.0.1:8765",
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
}
