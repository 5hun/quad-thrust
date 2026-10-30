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
    await page.goto(baseURL);
    const wait = (state) =>
      page.waitForFunction(
        (state) => window.hoverDiagnostics?.().state === state,
        state,
      );
    const snap = () => page.evaluate(() => window.hoverDiagnostics());
    const click = (name) =>
      page.getByRole("button", { name, exact: true }).click();
    const press = (key) => page.keyboard.press(key);
    await wait("demo");
    await press("Enter");
    await press("Enter");
    await click("OPTION");
    await click("VIEW REPLAY");
    assert.match(
      await page.locator("#menu").getAttribute("aria-label"),
      /リプレイデータがありません/,
    );
    await press("Escape");
    assert.equal((await snap()).menuSelection, 2);
    await press("Escape");
    await click("START");
    await click("TIME ATTACK");
    await press("Enter");
    await press("Enter");
    await wait("running");
    // Observe real engine frames. The only injected event is the finish needed
    // to reach VIEW REPLAY quickly; the recorded prefix remains ordinary play.
    await page.evaluate(() => {
      window.replayTrace = [];
      const step = window.HoverEngine.step;
      window.savedReplayStep = step;
      window.HoverEngine.step = (car, ...args) => {
        step(car, ...args);
        window.replayTrace.push({
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
    await page.waitForFunction(() => window.replayTrace.length >= 90);
    await page.keyboard.up("Space");
    await page.evaluate(() => {
      window.HoverEngine.step = (car, ...args) => {
        window.savedReplayStep(car, ...args);
        car.finished = true;
        car.reason = "finish";
        car.laps = [10, 11, 12];
        car.time = 33;
        window.HoverEngine.step = window.savedReplayStep;
      };
    });
    await wait("finished");
    await page.waitForFunction(
      () => window.hoverDiagnostics().postrace === "name",
    );
    await press("Enter");
    await press("Enter");
    await press("Enter");
    await press("Escape");
    await wait("menu");
    assert.ok((await snap()).lastReplay.bytes > 0);
    assert.ok((await snap()).lastReplay.frames >= 270);
    // Return from machine selection, preserving the recording independently
    // of the currently selected preview car/track.
    await press("Escape");
    await press("Escape");
    await click("OPTION");
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...window.localStorage }),
    );
    // Capture playback prefixes on the same engine call boundary as live play.
    await page.evaluate(() => {
      const step = window.HoverEngine.step;
      window.replayedTrace = [];
      window.HoverEngine.step = (car, ...args) => {
        step(car, ...args);
        if (window.hoverDiagnostics().state === "replay")
          window.replayedTrace.push({
            x: car.x,
            y: car.y,
            z: car.z,
            heading: car.heading,
            front: car.front.slice(),
            rear: car.rear.slice(),
          });
      };
    });
    await click("VIEW REPLAY");
    await wait("replay");
    assert.equal(await page.locator("#hud").isVisible(), false);
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(() => window.replayedTrace.length >= 40);
    await page.keyboard.up("ArrowRight");
    const traces = await page.evaluate(() => ({
      live: window.replayTrace,
      replay: window.replayedTrace,
    }));
    // A few live ticks can precede installing the observer. Align at the
    // first common unchanged stationary frame, then compare moving inertia.
    const offset =
      (await snap()).lastReplay.frames - 180 - traces.live.length - 1;
    assert.ok(offset >= 0 && offset < 20, `observer offset ${offset}`);
    assert.deepEqual(
      traces.replay.slice(offset, offset + 35),
      traces.live.slice(0, 35),
    );
    assert.equal(
      await page.evaluate(() => JSON.stringify({ ...window.localStorage })),
      stored,
      "replay must not save records or progression",
    );
    assert.ok([1, 17, 33].includes((await snap()).replayCameraMode));
    await page.screenshot({ path: "/tmp/hover-view-replay.png" });
    await page.waitForFunction(
      () => window.hoverDiagnostics().replay.frame < 10,
    );
    assert.equal(
      (await snap()).state,
      "replay",
      "VIEW REPLAY loops at the end of the tape",
    );
    await click("再生を終了");
    await wait("menu");
    assert.equal((await snap()).menuScreen, "option");
    assert.equal((await snap()).menuSelection, 2);
    await page.evaluate(() => window.HoverRules.completeCup(0));
    await click("MEMORY CARD");
    assert.deepEqual(await page.locator("#menu nav button").allTextContents(), [
      "SLOT 1",
      "SLOT 2",
      "ENDING",
    ]);
    await click("ENDING");
    await wait("replay");
    assert.equal((await snap()).replay.kind, "ending");
    assert.equal((await snap()).postrace, "credits");
    assert.equal((await snap()).musicLoop, false, "ENDING SEQ plays once");
    await press("Escape");
    assert.equal(
      (await snap()).state,
      "replay",
      "ENDING only skips with Start",
    );
    await page.evaluate(() =>
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [
          {
            axes: [0, 0],
            buttons: Array.from({ length: 16 }, (_, i) => ({
              pressed: i === 0,
            })),
          },
        ],
      }),
    );
    await page.waitForTimeout(120);
    assert.equal((await snap()).state, "replay");
    await page.evaluate(() =>
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [],
      }),
    );
    await press("Enter");
    await wait("menu");
    assert.equal((await snap()).menuScreen, "slots");
    assert.equal((await snap()).menuSelection, 2);
    await click("ENDING");
    await wait("replay");
    await wait("menu"); // Source ending also stops at the recording's end.
    assert.equal((await snap()).menuScreen, "slots");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: missing replay notice, native input recording/playback, exact live physics prefix, live input isolation, no record writes, replay camera/exit, unlocked ENDING, Start-only skip and recording-end return",
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
