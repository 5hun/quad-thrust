import type {} from "./types";
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
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const wait = (state: string) =>
      page.waitForFunction(
        (state) => window.hoverDiagnostics?.().state === state,
        state,
      );
    const snapshot = () => page.evaluate(() => window.hoverDiagnostics());
    const fullscreen = (active: boolean) =>
      page.waitForFunction(
        (active) =>
          (document.fullscreenElement?.id === "fullscreen-host") === active,
        active,
      );
    const enter = async () => {
      await page.getByRole("button", { name: "全画面", exact: true }).click();
      await fullscreen(true);
    };
    const exit = async () => {
      // Also exercise the native fullscreenchange path without a game keydown.
      await page.evaluate(() => document.exitFullscreen());
      await fullscreen(false);
    };
    await page.goto(baseURL);
    await wait("demo");
    await page.locator("#fullscreen").focus();
    await page.keyboard.press("Enter");
    await fullscreen(true);
    assert.equal((await snapshot()).state, "demo");
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 800, height: 1000 },
      { width: 1280, height: 600 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(() => {
        const rect = document
          .querySelector(".game-wrap")!
          .getBoundingClientRect();
        const width = Math.min(innerWidth, (innerHeight * 4) / 3);
        return (
          Math.abs(rect.width - width) < 1 &&
          Math.abs(rect.height - (width * 3) / 4) < 1
        );
      });
      const layout = await page.evaluate(() => {
        const host = document.fullscreenElement!;
        const rect = host.querySelector(".game-wrap")!.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          background: getComputedStyle(host).backgroundColor,
          hud: host.contains(document.getElementById("hud")),
          controls: host.contains(document.getElementById("menu-controls")),
          settings: !!host.querySelector(".browser-options"),
        };
      });
      assert.ok(
        Math.abs(layout.x * 2 + layout.width - layout.viewportWidth) < 1,
      );
      assert.ok(
        Math.abs(layout.y * 2 + layout.height - layout.viewportHeight) < 1,
      );
      assert.equal(layout.background, "rgb(0, 0, 0)");
      assert.equal(layout.hud, true);
      assert.equal(layout.controls, false);
      assert.equal(layout.settings, false);
    }
    await page.keyboard.press("Escape");
    await fullscreen(false);
    assert.equal((await snapshot()).state, "demo");
    await page.locator("#fullscreen-host").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await wait("menu");
    await enter();
    await page.getByRole("button", { name: "START", exact: true }).click();
    await page
      .getByRole("button", { name: "TIME ATTACK", exact: true })
      .click();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await wait("countdown");
    await fullscreen(true);
    await exit();
    await wait("paused");
    const paused = await snapshot();
    await page.waitForTimeout(200);
    assert.equal((await snapshot()).ticks, paused.ticks);
    await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
    await wait("running");
    await enter();
    await page.keyboard.down("Space");
    await page.keyboard.press("Escape");
    await fullscreen(false);
    await page.keyboard.up("Space");
    await wait("paused");
    const stopped = await snapshot();
    await page.waitForTimeout(200);
    assert.equal((await snapshot()).ticks, stopped.ticks);
    assert.equal((await snapshot()).time, stopped.time);
    // Leaving fullscreen while already paused must never toggle into a race.
    await enter();
    assert.equal((await snapshot()).state, "paused");
    await page.keyboard.press("Escape");
    await fullscreen(false);
    assert.equal((await snapshot()).state, "paused");
    await enter();
    await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
    await wait("running");
    await page.evaluate(() => {
      const step = window.HoverEngine.step;
      window.HoverEngine.step = (car, ...args) => {
        step(car, ...args);
        car.finished = true;
        car.reason = "finish";
        car.laps = [10, 11, 12];
        car.time = 33;
      };
    });
    await wait("finished");
    await page.waitForFunction(() => !!window.hoverDiagnostics().postrace);
    await fullscreen(true);
    const postrace = (await snapshot()).postrace;
    await page.keyboard.press("Escape");
    await fullscreen(false);
    assert.equal((await snapshot()).postrace, postrace);
    // A refused fullscreen request leaves the regular game available.
    await page.evaluate(() => {
      document.getElementById("fullscreen-host")!.requestFullscreen = () =>
        Promise.reject(new Error("Fullscreen denied"));
    });
    await page.locator("#fullscreen").click();
    await page.locator("#fullscreen-status").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    const unsupported = await browser.newPage();
    await unsupported.addInitScript(() => {
      Object.defineProperty(document, "fullscreenEnabled", { value: false });
    });
    await unsupported.goto(baseURL);
    await unsupported.waitForFunction(() => !!window.hoverDiagnostics);
    assert.equal(await unsupported.locator("#fullscreen").isVisible(), false);
    await unsupported.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: game-only fullscreen; centered 4:3 sizing; keyboard activation; menu/result continuity; native and Esc exits pause races; manual resume; denied/unsupported fullscreen",
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
