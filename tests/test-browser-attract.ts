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
    await page.goto(baseURL);
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().demoFrames > 5,
    );
    const snapshot = () => page.evaluate(() => window.hoverDiagnostics());
    const first = await snapshot();
    await page.screenshot({ path: "/tmp/hover-startup-demo.png" });
    assert.equal(first.state, "demo");
    assert.deepEqual(first.opponentTypes, [0, 1, 2]);
    assert.deepEqual(first.cpuLevels, [8, 8, 8]);
    assert.ok([1, 17, 33].includes(first.replayCameraMode!));
    assert.equal(await page.locator("#hud").isVisible(), false);
    assert.equal(await page.locator("#menu-controls").count(), 0);
    await page.waitForTimeout(500);
    assert.notEqual((await snapshot()).opponents[0].z, first.opponents[0].z);
    // Any key exits the demo, but cannot also navigate the title.
    await page.keyboard.press("a");
    assert.equal((await snapshot()).state, "menu");
    assert.ok((await snapshot()).titleIntroFrames > 60);
    await page.keyboard.press("ArrowDown");
    assert.equal((await snapshot()).menuSelection, 0);
    await page.keyboard.press("Enter");
    assert.equal((await snapshot()).menuScreen, "title");
    assert.equal((await snapshot()).titleIntroFrames, 0);
    const click = (name: string) =>
      page.getByRole("button", { name, exact: true }).click();
    await click("START");
    await click("GRANDPRIX");
    assert.deepEqual(await page.locator("#menu nav button").allTextContents(), [
      "Blue GP",
      "PRACTICE",
    ]);
    await click("PRACTICE");
    assert.equal(await page.locator("#machine option").count(), 4);
    await page.keyboard.press("Escape");
    assert.equal((await snapshot()).menuSelection, 1);
    // Exercise the real fixed-step loop quickly, without drawing 1800 frames.
    await page.evaluate(async () => {
      const { HoverRenderer } = (await import(
        "./renderer.js" as string
      )) as typeof import("../src/renderer");
      const { OriginalMenu } = (await import(
        "./menu.js" as string
      )) as typeof import("../src/menu");
      HoverRenderer.prototype.drawMenu = () => {};
      OriginalMenu.prototype.draw = () => {};
      const raf = window.requestAnimationFrame;
      let virtualTime = performance.now();
      window.requestAnimationFrame = (callback) =>
        raf(() => {
          virtualTime += 100;
          callback(virtualTime);
        });
    });
    await page.waitForFunction(
      () => window.hoverDiagnostics().state === "demo",
    );
    // Touch/mouse has the same one-action transition as the keyboard.
    await click("PRESS ANY BUTTON");
    await page.keyboard.press("Enter");
    assert.equal((await snapshot()).menuScreen, "title");
    const progress = await page.evaluate(() => {
      const r = window.HoverRules;
      r.completeCup(0);
      const blue = [r.availableCups(), r.machineCount()];
      r.completeCup(1);
      const yellow = [r.availableCups(), r.machineCount()];
      r.completeCup(2);
      const red = [r.availableCups(), r.machineCount()];
      for (let stage = 0; stage < 15; stage++)
        for (let machine = 0; machine < 4; machine++)
          window.HoverTraining.saveMark(stage, machine);
      const incomplete = r.machineCount();
      for (let stage = 0; stage < 15; stage++)
        window.HoverTraining.saveMark(stage, 4);
      r.completeTraining();
      return { blue, yellow, red, incomplete, complete: r.machineCount() };
    });
    assert.deepEqual(progress, {
      blue: [2, 4],
      yellow: [3, 4],
      red: [3, 5],
      incomplete: 5,
      complete: 6,
    });
    await page.reload();
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().state === "demo",
    );
    await page.evaluate(() => {
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
      });
    });
    await page.waitForFunction(
      () => window.hoverDiagnostics().state === "menu",
    );
    await page.waitForTimeout(250);
    assert.equal(
      (await snapshot()).menuScreen,
      "title",
      "held gamepad button cannot also select START",
    );
    await page.evaluate(() =>
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [],
      }),
    );
    await page.keyboard.press("Enter");
    await click("START");
    await click("GRANDPRIX");
    assert.deepEqual(await page.locator("#menu nav button").allTextContents(), [
      "Blue GP",
      "Yellow GP",
      "Red GP",
      "PRACTICE",
    ]);
    await click("Red GP");
    assert.equal(await page.locator("#machine option").count(), 6);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: live startup demo, four CPU racers, replay camera, any-button dismissal, title intro, submenu idle demo, pointer dismissal, fresh/save unlock progression",
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
