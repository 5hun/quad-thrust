import type {} from "./types";
/* global window, getComputedStyle */
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
    const click = (name: string) =>
      page.getByRole("button", { name, exact: true }).click();
    const assertTitle = async () => {
      assert.equal((await snapshot()).state, "menu");
      assert.equal((await snapshot()).menuScreen, "title");
      assert.deepEqual(
        await page.locator("#menu nav button").allTextContents(),
        ["GRANDPRIX", "TIME ATTACK", "OPTIONS"],
      );
      await page.getByRole("heading", { name: "QUAD THRUST" }).waitFor();
    };
    await assertTitle();
    const first = await snapshot();
    assert.deepEqual(
      [first.demo.cameraType, ...first.demo.opponentTypes].sort(),
      [0, 1, 2, 3],
    );
    assert.deepEqual(first.demo.cpuLevels, [8, 8, 8, 8]);
    assert.equal(await page.locator("#hud").isVisible(), false);
    assert.equal(
      await page.getByRole("button", { name: "START", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: "PRESS ANY BUTTON" }).count(),
      0,
    );
    await page.waitForFunction(
      (frames) => window.hoverDiagnostics().demoFrames > frames + 10,
      first.demoFrames,
    );
    const next = await snapshot();
    assert.notDeepEqual(next.demo.positions, first.demo.positions);
    // Unrelated input leaves the menu and the ongoing demo intact.
    await page.keyboard.press("a");
    await assertTitle();
    // The first navigation and confirmation work immediately.
    await page.keyboard.press("ArrowDown");
    assert.equal((await snapshot()).menuSelection, 1);
    await page.keyboard.press("Enter");
    assert.equal((await snapshot()).menuScreen, "car");
    await page.keyboard.press("ArrowRight");
    const selectedMachine = await page.locator("#machine").inputValue();
    await page.keyboard.press("Escape");
    await assertTitle();
    assert.equal((await snapshot()).menuSelection, 1);
    const resumed = await snapshot();
    await page.waitForFunction(
      (frames) => window.hoverDiagnostics().demoFrames > frames + 5,
      resumed.demoFrames,
    );
    assert.equal(await page.locator("#machine").inputValue(), selectedMachine);
    await click("GRANDPRIX");
    assert.deepEqual(await page.locator("#menu nav button").allTextContents(), [
      "Blue GP",
      "PRACTICE",
    ]);
    await click("PRACTICE");
    assert.equal(await page.locator("#machine option").count(), 4);
    await page.keyboard.press("Escape");
    assert.equal((await snapshot()).menuSelection, 1);
    await page.keyboard.press("Escape");
    await assertTitle();
    // A held gamepad confirmation must open only one level of the tree.
    await page.evaluate(() => {
      window.menuTestPad = {
        axes: [0, 0],
        buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 })),
      };
      navigator.getGamepads = () => [window.menuTestPad as unknown as Gamepad];
    });
    await page.waitForFunction(
      () => window.hoverDiagnostics().menuScreen === "gp",
    );
    await page.waitForTimeout(200);
    assert.equal((await snapshot()).menuScreen, "gp");
    await page.evaluate(() => {
      window.menuTestPad.buttons[0].pressed = false;
    });
    await page.keyboard.press("Escape");
    // The title remains usable on narrow, normal, and ultrawide screens.
    for (const viewport of [
      { width: 375, height: 780 },
      { width: 960, height: 720 },
      { width: 1600, height: 900 },
      { width: 2560, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const buttons = page.locator("#menu nav button");
      for (let i = 0; i < 3; i++) {
        const box = await buttons.nth(i).boundingBox();
        assert.ok(
          box &&
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= viewport.width &&
            box.y + box.height <= viewport.height,
        );
      }
      await click("OPTIONS");
      const lastOption = await page
        .locator("#menu nav button")
        .last()
        .boundingBox();
      const guide = await page.locator("#menu .title-guide").boundingBox();
      assert.ok(
        lastOption && guide && lastOption.y + lastOption.height <= guide.y,
      );
      await page.keyboard.press("Escape");
      await assertTitle();
    }
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.screenshot({ path: "/tmp/quad-thrust-title-c1.png" });
    // Every list and record page shares the same uninterrupted CPU race.
    let previous = await snapshot();
    const assertContinuingDemo = async (screen: string, list = true) => {
      await page.waitForFunction(
        (frames) => window.hoverDiagnostics().demoFrames > frames + 4,
        previous.demoFrames,
      );
      const current = await snapshot();
      assert.equal(current.menuScreen, screen);
      assert.equal(current.demo.course, previous.demo.course);
      assert.equal(current.music, previous.music);
      assert.notDeepEqual(current.demo.positions, previous.demo.positions);
      if (list) {
        const selected = page.locator('#menu nav button[aria-current="true"]');
        assert.equal(
          await selected.evaluate((b) => getComputedStyle(b).color),
          "rgb(32, 229, 236)",
        );
        assert.equal(
          await selected.evaluate(
            (b) => getComputedStyle(b, "::before").opacity,
          ),
          "1",
        );
      }
      previous = current;
    };
    await click("GRANDPRIX");
    await assertContinuingDemo("gp");
    await page.screenshot({ path: "/tmp/quad-thrust-gp-c1.png" });
    await page.keyboard.press("Escape");
    await assertContinuingDemo("title");
    await click("OPTIONS");
    await assertContinuingDemo("option");
    await page.screenshot({ path: "/tmp/quad-thrust-option-c1.png" });
    await click("VIEW RECORDS");
    await assertContinuingDemo("records", false);
    for (let i = 0; i < 2; i++) await page.keyboard.press("Escape");
    await assertContinuingDemo("title");
    const progress = await page.evaluate(() => {
      const r = window.HoverRules;
      r.completeCup(0);
      const blue = [r.availableCups(), r.machineCount()];
      r.completeCup(1);
      const yellow = [r.availableCups(), r.machineCount()];
      r.completeCup(2);
      const red = [r.availableCups(), r.machineCount()];
      return { blue, yellow, red };
    });
    assert.deepEqual(progress, { blue: [2, 4], yellow: [3, 4], red: [3, 5] });
    await page.reload();
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().demoFrames > 5,
    );
    await click("GRANDPRIX");
    assert.deepEqual(await page.locator("#menu nav button").allTextContents(), [
      "Blue GP",
      "Yellow GP",
      "Red GP",
      "PRACTICE",
    ]);
    await click("Red GP");
    assert.equal(await page.locator("#machine option").count(), 5);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: immediate C1 title, live independent demo, direct modes, keyboard/gamepad/pointer, responsive layout and unlock progression",
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
