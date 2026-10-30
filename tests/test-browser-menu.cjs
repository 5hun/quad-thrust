/* global window, document */
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
    const page = await browser.newPage({
      viewport: { width: 1100, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const screen = async (name) => {
      await page.waitForFunction(
        (name) =>
          window.hoverDiagnostics?.().menuScreen === name &&
          window.hoverDiagnostics().state === "menu",
        name,
      );
      assert.equal(
        await page.locator("#menu-controls").isVisible(),
        true,
        name + " controls visible",
      );
    };
    const press = (key) => page.keyboard.press(key);
    const click = (name) =>
      page.getByRole("button", { name, exact: true }).click();
    const enterTitle = async () => {
      await page.waitForFunction(
        () => window.hoverDiagnostics?.().state === "demo",
      );
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
    };
    const title = async () => {
      await page.reload();
      await enterTitle();
      await screen("title");
    };
    const choose = async (mode) => {
      await click("START");
      await click(mode);
    };
    await page.addInitScript(() => localStorage.setItem("hover-unlocks", "15"));
    await page.goto(baseURL);
    await enterTitle();
    await screen("title");
    assert.deepEqual(await page.locator("#menu nav button").allTextContents(), [
      "START",
      "OPTION",
      "HELP",
      "EXIT",
    ]);
    await press("Enter");
    await screen("modes");
    await press("ArrowDown");
    await press("Enter");
    await screen("car");
    assert.equal(await page.locator("#mode").inputValue(), "time");
    for (let i = 0; i < 6; i++) {
      assert.equal(await page.locator("#machine").inputValue(), String(i));
      await press("ArrowRight");
    }
    await press("Enter");
    await screen("course");
    for (let i = 0; i < 9; i++) {
      assert.equal(await page.locator("#course").inputValue(), String(i));
      await press("ArrowRight");
      await page.waitForTimeout(40);
    }
    await press("Escape");
    await screen("car");
    await press("Enter");
    await screen("course");
    await click("決定 Enter / Z");
    await page.waitForFunction(
      () => window.hoverDiagnostics().state === "running",
    );
    await press("Escape");
    await page.locator("#back").click();
    await screen("title");
    for (const [label, mode] of [
      ["Blue GP", "gp0"],
      ["Yellow GP", "gp1"],
      ["Red GP", "gp2"],
      ["PRACTICE", "practice"],
    ]) {
      await choose("GRANDPRIX");
      await screen("gp");
      await click(label);
      await screen("car");
      assert.equal(await page.locator("#mode").inputValue(), mode);
      await page.locator("#menu-confirm").click();
      if (mode === "practice") {
        await screen("course");
        await page.locator("#menu-confirm").click();
      }
      await page.waitForFunction(
        () => window.hoverDiagnostics().state === "countdown",
      );
      assert.equal(
        (await page.evaluate(() => window.hoverDiagnostics())).opponentTypes
          .length,
        3,
      );
      await press("Escape");
      await page.locator("#back").click();
      await screen("title");
    }
    for (let level = 1; level <= 3; level++) {
      await choose("TRAINING");
      await click("LEVEL " + level);
      await screen("training");
      await press("ArrowRight");
      assert.equal(
        await page.locator("#course").inputValue(),
        String((level - 1) * 5 + 1),
      );
      await press("Enter");
      await screen("car");
      await press("Escape");
      await screen("training");
      await press("Enter");
      await press("Enter");
      await page.waitForFunction(
        () => window.hoverDiagnostics().state === "countdown",
      );
      assert.equal(
        (await page.evaluate(() => window.hoverDiagnostics())).training.stage,
        (level - 1) * 5 + 1,
      );
      await press("Escape");
      await page.locator("#back").click();
      await screen("training");
      await press("Escape");
      await press("Escape");
      await press("Escape");
      await screen("title");
    }
    await choose("TRAINING");
    await click("FREE RUN");
    await screen("car");
    await press("Enter");
    await screen("course");
    assert.equal(await page.locator("#mode").inputValue(), "free");
    await title();
    await click("OPTION");
    await click("VIEW RECORDS");
    await click("TIME ATTACK'S");
    await screen("records");
    await press("ArrowDown");
    await press("Enter");
    await screen("record-detail");
    await press("Escape");
    await screen("records");
    await title();
    await click("OPTION");
    await click("MUSIC MODE");
    await screen("music");
    await press("Enter");
    await page.waitForFunction(
      () => window.hoverDiagnostics().music === "SAMPLE16",
    );
    await press("Escape");
    await screen("option");
    await title();
    await choose("2P BATTLE");
    await screen("notice");
    assert.match(
      await page.locator("#menu").getAttribute("aria-label"),
      /未対応/,
    );
    await title();
    await click("HELP");
    await screen("help");
    await press("Escape");
    await screen("title");
    await press("ArrowUp");
    await press("ArrowUp");
    // Gamepad button edges follow the same menu path, without race controls firing.
    await page.evaluate(() => {
      window.menuTestPad = {
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0],
      };
      navigator.getGamepads = () => [window.menuTestPad];
      window.menuTestPad.buttons[0].pressed = true;
    });
    await screen("modes");
    await page.evaluate(() => {
      window.menuTestPad.buttons[0].pressed = false;
    });
    await page.setViewportSize({ width: 375, height: 780 });
    await page.locator("#menu-back").click();
    await screen("title");
    await click("START");
    await click("TIME ATTACK");
    await screen("car");
    await page.locator("#menu-next").click();
    await page.locator("#menu-confirm").click();
    await screen("course");
    const size = await page.locator(".game-wrap").boundingBox();
    assert.ok(Math.abs(size.width / size.height - 4 / 3) < 0.01);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    assert.deepEqual(
      (await page.evaluate(() => window.hoverDiagnostics())).assetErrors,
      [],
    );
    await page.locator("#menu-back").click();
    await screen("car");
    await page.locator("#menu-back").click();
    await screen("modes");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).menuSelection,
      1,
    );
    await title();
    await click("EXIT");
    await page.waitForFunction(
      () => window.hoverDiagnostics().state === "exited",
    );
    assert.equal(await page.locator("#menu-controls").isVisible(), false);
    assert.equal(await page.locator("#menu nav button").count(), 0);
    assert.equal(
      await page.evaluate(() => window.hoverDiagnostics().music),
      null,
    );
    assert.equal(
      await page.evaluate(() => {
        const data = document
          .getElementById("original-menu")
          .getContext("2d")
          .getImageData(0, 0, 320, 240).data;
        return data.every((value, i) => i % 4 !== 3 || value === 0);
      }),
      true,
      "no substitute notice is drawn after EXIT",
    );
    await press("Enter");
    await press("Escape");
    assert.equal(
      await page.evaluate(() => window.hoverDiagnostics().state),
      "exited",
    );
    await page.screenshot({ path: "/tmp/hover-exited.png" });
    await title();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: original title tree; all machines/courses; GP, practice, training and free-run selection order; cancel; race start; records/music/help; keyboard, gamepad and mobile controls",
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
