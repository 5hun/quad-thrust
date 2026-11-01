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
    const click = (name: string) =>
      page.getByRole("button", { name, exact: true }).click();
    const enter = async () => {
      await click("FULLSCREEN: OFF");
      await fullscreen(true);
      await page
        .getByRole("button", { name: "FULLSCREEN: ON", exact: true })
        .waitFor();
    };
    const exit = async () => {
      await page.evaluate(() => document.exitFullscreen());
      await fullscreen(false);
    };
    await page.goto(baseURL);
    await wait("menu");
    await click("OPTIONS");
    const viewports = [
      { width: 960, height: 720 },
      { width: 1280, height: 720 },
      { width: 1680, height: 720 },
      { width: 2560, height: 720 },
      { width: 1440, height: 900 },
      { width: 800, height: 1000 },
      { width: 1280, height: 600 },
    ];
    const verifyLayout = async (
      viewport: { width: number; height: number },
      resize = true,
    ) => {
      if (resize) await page.setViewportSize(viewport);
      await page.waitForFunction(() => {
        const rect = document
          .querySelector(".game-wrap")!
          .getBoundingClientRect();
        const canvas = document.getElementById("game") as HTMLCanvasElement;
        return (
          Math.abs(rect.width - innerWidth) < 1 &&
          Math.abs(rect.height - Math.min(innerHeight, (innerWidth * 3) / 4)) <
            1 &&
          Math.abs(canvas.width / canvas.height - rect.width / rect.height) <
            0.01
        );
      });
      const layout = await page.evaluate(() => {
        const rect = document
          .querySelector(".game-wrap")!
          .getBoundingClientRect();
        const menu = document.getElementById("menu")!.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          y: rect.y,
          menuWidth: menu.width,
          menuHeight: menu.height,
          menuX: menu.x,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
        };
      });
      assert.ok(Math.abs(layout.width - viewport.width) < 1);
      assert.ok(Math.abs(layout.y * 2 + layout.height - viewport.height) < 1);
      assert.ok(Math.abs(layout.menuWidth - layout.width) < 1);
      assert.ok(Math.abs(layout.menuHeight - layout.height) < 1);
      assert.ok(
        Math.abs(layout.menuX * 2 + layout.menuWidth - viewport.width) < 1,
      );
      assert.ok(layout.scrollWidth <= viewport.width);
      assert.ok(layout.scrollHeight <= viewport.height);
      // Exercise real pointer targets after each resize, not just their boxes.
      await click("SOUND: ON");
      await click("SOUND: OFF");
    };
    for (const viewport of viewports) await verifyLayout(viewport);
    await page
      .getByRole("button", { name: "FULLSCREEN: OFF", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await fullscreen(true);
    assert.equal((await snapshot()).menuScreen, "option");
    for (const viewport of viewports) {
      // Chromium forbids changing native window bounds while fullscreen.
      await exit();
      await verifyLayout(viewport);
      await enter();
      await verifyLayout(viewport, false);
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
          controls: !!host.querySelector("#fullscreen"),
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
    await click("FULLSCREEN: ON");
    await fullscreen(false);
    assert.equal((await snapshot()).menuSelection, 2);
    await enter();
    await page.keyboard.press("Escape");
    await fullscreen(false);
    assert.equal((await snapshot()).menuScreen, "option");
    await enter();
    await page.keyboard.press("KeyX");
    await page
      .getByRole("button", { name: "TIME ATTACK", exact: true })
      .click();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await wait("countdown");
    await fullscreen(true);
    await exit();
    await wait("paused");
    // The HUD hides while paused; the pause list uses the same 16:9 area.
    assert.equal(await page.locator("#hud").isHidden(), true);
    for (const viewport of viewports.slice(0, 4)) {
      await page.setViewportSize(viewport);
      const layout = await page
        .locator("#pause-panel .title-layout")
        .boundingBox();
      assert.ok(
        Math.abs(
          layout!.width - Math.min(viewport.width, (viewport.height * 16) / 9),
        ) < 1,
      );
      assert.ok(Math.abs(layout!.x * 2 + layout!.width - viewport.width) < 1);
    }
    const paused = await snapshot();
    await page.waitForTimeout(200);
    assert.equal((await snapshot()).ticks, paused.ticks);
    await page.getByRole("button", { name: "RESUME", exact: true }).click();
    await wait("running");
    const hud = await page.locator(".race-hud").boundingBox();
    const viewport = page.viewportSize()!;
    assert.ok(
      Math.abs(
        hud!.width - Math.min(viewport.width, (viewport.height * 16) / 9),
      ) < 1,
    );
    await page.screenshot({ path: "/tmp/hover-widescreen-race.png" });
    // Re-enter from OPTIONS and verify native exit pauses an active race.
    await page.keyboard.press("Escape");
    await click("QUIT");
    await click("OPTIONS");
    await enter();
    await page.keyboard.press("KeyX");
    await click("TIME ATTACK");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await wait("running");
    await page.keyboard.down("Space");
    await page.keyboard.press("Escape");
    await fullscreen(false);
    await page.keyboard.up("Space");
    await wait("paused");
    const stopped = await snapshot();
    await page.waitForTimeout(200);
    assert.equal((await snapshot()).ticks, stopped.ticks);
    await click("QUIT");
    await click("OPTIONS");
    // A refused fullscreen request leaves the regular game available.
    await page.evaluate(() => {
      document.getElementById("fullscreen-host")!.requestFullscreen = () =>
        Promise.reject(new Error("Fullscreen denied"));
    });
    await click("FULLSCREEN: OFF");
    await page.locator("#fullscreen-status").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    const unsupported = await browser.newPage();
    await unsupported.addInitScript(() => {
      Object.defineProperty(document, "fullscreenEnabled", { value: false });
    });
    await unsupported.goto(baseURL);
    await unsupported.waitForFunction(() => !!window.hoverDiagnostics);
    await unsupported
      .getByRole("button", { name: "OPTIONS", exact: true })
      .click();
    assert.deepEqual(
      await unsupported.locator("#menu nav button").allTextContents(),
      ["VIEW RECORDS", "SOUND: ON"],
    );
    await unsupported.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: responsive 4:3/16:9/21:9/32:9 windowed and fullscreen; centered menu pointer targets and HUD safe area; keyboard activation; menu/result continuity; native and Esc exits pause races; manual resume; denied/unsupported fullscreen",
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
