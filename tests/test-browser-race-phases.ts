import type {} from "./types";
/* global window */
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
module.exports = async function verify({
  chromium,
  executablePath,
  baseURL,
}: import("./types").BrowserOptions) {
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
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const snapshot = () => page.evaluate(() => window.hoverDiagnostics());
    const wait = (state: string) =>
      page.waitForFunction(
        (state: string) => window.hoverDiagnostics?.().state === state,
        state,
      );
    await page.addInitScript(() => {
      if (!localStorage.getItem("hover-autosave-v2"))
        localStorage.setItem(
          "hover-autosave-v2",
          JSON.stringify({
            version: 2,
            values: { "hover-unlocks": "7" },
          }),
        );
    });
    async function start(mode: string) {
      await page.goto(baseURL);
      await page.waitForFunction(
        () => window.hoverDiagnostics?.().state === "menu",
      );
      await wait("menu");
      await page.evaluate(async () => {
        const { HoverRenderer } = (await import(
          "./renderer.js" as string
        )) as typeof import("../src/renderer");
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
      const click = (name: string) =>
        page.getByRole("button", { name, exact: true }).click();

      if (mode === "time") await click("TIME ATTACK");
      else {
        await click("GRANDPRIX");
        await click(mode === "practice" ? "PRACTICE" : "Blue GP");
      }
      await page.keyboard.press("Enter");
      if (mode === "time" || mode === "practice")
        await page.keyboard.press("Enter");
      await wait("countdown");
    }
    async function forceFinish(winner: boolean) {
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
    // Other racers keep moving during the player's destruction/fall wait.
    for (const reason of ["destroyed", "course-out"] as const) {
      await start("practice");
      await wait("running");
      await page.evaluate(async (reason) => {
        const { OriginalSound } = (await import(
          "./sound.js" as string
        )) as typeof import("../src/sound");
        const effect = OriginalSound.prototype.effect;
        window.bombSounds = 0;
        OriginalSound.prototype.effect = function (id, ...args) {
          if (id === 68) window.bombSounds++;
          return effect.call(this, id, ...args);
        };
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
      // A failed practice returns directly to machine selection.
      await wait("menu");
      const bombSounds = await page.evaluate(() => window.bombSounds);
      if (reason === "course-out")
        assert.equal(
          bombSounds,
          0,
          "fall wait ends without an explosion sound",
        );
      else
        assert.ok(
          bombSounds > 1,
          "destruction retains repeated explosion sounds",
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
  const { chromium } = require(
    process.argv[2] || "playwright",
  ) as typeof import("playwright");
  (module.exports as import("./types").BrowserTest)({
    chromium,
    executablePath: process.argv[3],
    baseURL: process.argv[4] || "http://127.0.0.1:8765",
  }).catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  });
}
