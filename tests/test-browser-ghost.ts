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
    const page = await browser.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const wait = (state: string) =>
      page.waitForFunction(
        (state: string) => window.hoverDiagnostics?.().state === state,
        state,
      );
    const snap = () => page.evaluate(() => window.hoverDiagnostics());
    const press = (key: string) => page.keyboard.press(key);
    const click = (name: string) =>
      page.getByRole("button", { name, exact: true }).click();
    await page.goto(baseURL);
    await wait("menu");
    await page.evaluate(() =>
      window.localStorage.setItem(
        "hover-v2-0-0-ghost",
        JSON.stringify({
          time: 10,
          frames: [
            [0, 10, 2, 0, 0, 0, 0],
            [10, 10, 2, 100, 0, 0, 0],
          ],
        }),
      ),
    );
    await click("TIME ATTACK");
    await press("Enter");
    await press("Enter");
    await wait("countdown");
    assert.equal(
      (await snap()).ghost,
      null,
      "legacy per-machine positions must not create a source-format ghost",
    );
    await page.evaluate(() => {
      const step = window.HoverEngine.step;
      window.originalGhostStep = step;
      window.firstRunTrace = [];
      window.HoverEngine.step = (car, ...args) => {
        step(car, ...args);
        if (window.hoverDiagnostics().state === "running")
          window.firstRunTrace.push({
            x: car.x,
            y: car.y,
            z: car.z,
            heading: car.heading,
            front: car.front.slice(),
            rear: car.rear.slice(),
          });
      };
    });
    await page.keyboard.down("Space");
    await page.keyboard.down("q");
    await page.waitForFunction(() => window.firstRunTrace.length >= 16);
    await page.keyboard.up("q");
    await page.waitForFunction(() => window.firstRunTrace.length >= 90);
    await page.keyboard.up("Space");
    await page.evaluate(
      () => (window.HoverEngine.step = window.originalGhostStep),
    );
    async function finish(total: number) {
      await page.evaluate((total) => {
        const step = window.HoverEngine.step;
        window.HoverEngine.step = (car, ...args) => {
          step(car, ...args);
          if (!car.ghost) {
            car.finished = true;
            car.reason = "finish";
            car.laps = [total / 3, total / 3, total / 3];
            car.time = total;
            window.HoverEngine.step = step;
          }
        };
      }, total);
      await wait("finished");
      await page.waitForFunction(
        () => window.hoverDiagnostics().postrace === "name",
      );
    }
    async function selection() {
      await press("Enter");
      await press("Enter");
      await press("Enter");
      await press("Escape");
      await wait("menu");
      assert.equal((await snap()).menuScreen, "car");
    }
    await finish(30);
    await selection();
    assert.equal((await snap()).lastReplay!.machine, 0);
    await press("ArrowRight");
    await press("Enter");
    await press("Enter");
    await wait("countdown");
    const start = await snap();
    assert.equal(start.sourceMode, 5);
    assert.equal(start.ghost!.machine, 0);
    assert.equal(start.ghost!.ticks, 0);
    await page.waitForTimeout(150);
    assert.equal(
      (await snap()).ghost!.ticks,
      0,
      "ghost stays on the grid during countdown",
    );
    await page.evaluate(async () => {
      const { HoverRenderer } = (await import(
          "./renderer.js" as string
        )) as typeof import("../src/renderer"),
        update = HoverRenderer.prototype.updateShip;
      const { OriginalHUD } = (await import(
        "./hud.js" as string
      )) as typeof import("../src/hud");
      const drawHUD = OriginalHUD.prototype.draw;
      window.ghostMapMachines = [];
      OriginalHUD.prototype.draw = function (...args) {
        if (args[6]) window.ghostMapMachines.push(args[6].type);
        return drawHUD.apply(this, args);
      };
      window.ghostVisuals = [];
      window.ghostMismatches = [];
      HoverRenderer.prototype.updateShip = function (ship, pose, input, time) {
        update.call(this, ship, pose, input, time);
        if (!ship.ghost) return;
        const expected = window.firstRunTrace[pose.ticks! - 1];
        const actual = {
          x: pose.x,
          y: pose.y,
          z: pose.z,
          heading: pose.heading,
          front: (pose as Car).front?.slice(),
          rear: (pose as Car).rear?.slice(),
        };
        if (expected && JSON.stringify(expected) !== JSON.stringify(actual))
          window.ghostMismatches.push({ expected, actual });
        const hull = (
          ship.hull?.children[0] as
            | import("three").Mesh<
                import("three").BufferGeometry,
                import("three").MeshBasicMaterial
              >
            | undefined
        )?.material;
        window.ghostVisuals.push({
          ticks: pose.ticks!,
          l1: !!input.l1,
          accel: !!input.accel,
          sides: ship.sides.map((s) => s.visible),
          rear: ship.flames.some((s) => s.visible),
          semi: hull?.transparent,
          opacity: hull?.opacity,
        });
      };
    });
    await wait("running");
    await page.waitForFunction(
      () => window.hoverDiagnostics().ghost!.ticks >= 55,
    );
    await press("Escape");
    await wait("paused");
    const paused = (await snap()).ghost!.ticks;
    await page.waitForTimeout(180);
    assert.equal((await snap()).ghost!.ticks, paused);
    await press("Escape");
    await wait("running");
    const observations = await page.evaluate(() => ({
      mismatches: window.ghostMismatches,
      visuals: window.ghostVisuals.filter((v) => v.ticks > 0 && v.ticks < 70),
    }));
    assert.deepEqual(
      observations.mismatches,
      [],
      "native ghost matches every recorded live physics frame",
    );
    assert.ok(observations.visuals.length > 10);
    assert.ok(
      await page.evaluate(() => window.ghostMapMachines.includes(0)),
      "source HUD map includes the ghost machine",
    );
    for (const v of observations.visuals) {
      assert.equal(v.semi, true);
      assert.equal(v.opacity, 0.5);
      assert.equal(
        v.sides[0],
        v.l1 && ((v.ticks + 1) & 1) === 1,
        "slot-1 side jets use their source phase",
      );
      if (v.accel) assert.equal(v.rear, ((v.ticks + 1) & 1) === 0);
    }
    await page.screenshot({ path: "/tmp/hover-input-ghost.png" });
    await page.waitForFunction(() => {
      const d = window.hoverDiagnostics();
      return d.ghost!.ticks > d.lastReplay!.frames + 8;
    });
    const ended = await snap();
    assert.equal(ended.ghost!.frame, ended.lastReplay!.frames);
    assert.equal(ended.ghost!.finished, false);
    assert.equal(ended.ghost!.laps, 0);
    assert.equal(!!ended.ghost!.active.accel, false);
    await finish(35);
    assert.equal(
      (await snap()).lastReplay!.machine,
      0,
      "slower current attempt does not replace source ghost",
    );
    assert.equal(
      (await snap()).replayPose!.type,
      1,
      "postrace background uses the current attempt, not the older ghost",
    );
    await selection();
    await press("ArrowRight");
    await press("Enter");
    await press("Enter");
    await wait("countdown");
    assert.equal((await snap()).ghost!.machine, 0);
    await wait("running");
    await finish(29);
    await selection();
    assert.equal(
      (await snap()).lastReplay!.machine,
      2,
      "a faster run with another machine becomes the source ghost",
    );
    assert.ok(
      await page.evaluate(() =>
        window.localStorage.getItem("hover-v2-0-0-ghost"),
      ),
      "old local data is not deleted",
    );
    await page.reload();
    await wait("menu");
    assert.equal(
      (await snap()).lastReplay,
      null,
      "source replay buffer is volatile until card load",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: source TA ghost eligibility across machines, 60Hz live path equality, translucent hull and slot-1 jets, countdown/pause, tape-end coasting, separate slower attempt replay, faster replacement and preserved legacy data",
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
