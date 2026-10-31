import type {} from "./types";
/* global window, document */
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
      viewport: { width: 1100, height: 900 },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const screen = async (name: string) => {
      await page.waitForFunction(
        (name: string) =>
          window.hoverDiagnostics?.().menuScreen === name &&
          window.hoverDiagnostics().state === "menu",
        name,
      );
      assert.equal(
        await page.locator("#menu-controls").count(),
        0,
        name + " has no external menu controls",
      );
    };
    const press = (key: string) => page.keyboard.press(key);
    const click = (name: string) =>
      page.getByRole("button", { name, exact: true }).click();
    const enterTitle = async () => {
      await page.waitForFunction(
        () => window.hoverDiagnostics?.().state === "menu",
      );
    };
    const title = async () => {
      await page.reload();
      await enterTitle();
      await screen("title");
    };
    const choose = async (mode: string) => {
      await click(mode);
    };
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
    await page.goto(baseURL);
    await enterTitle();
    await screen("title");
    assert.equal(await page.locator(".browser-options").count(), 0);
    assert.equal(await page.locator(".browser-options summary").count(), 0);
    assert.equal(
      await page.locator("#difficulty, #ghost-enabled, #pause").count(),
      0,
    );
    assert.equal(await page.locator("#quality, label[for=quality]").count(), 0);
    assert.equal(await page.locator("#sound, #fullscreen").count(), 0);
    assert.equal(
      await page.locator("#browser-settings, input[type=file]").count(),
      0,
    );
    assert.deepEqual(await page.locator("#menu nav button").allTextContents(), [
      "GRANDPRIX",
      "TIME ATTACK",
      "OPTION",
    ]);
    await press("ArrowDown");
    await press("Enter");
    await screen("car");
    assert.equal(await page.locator("#menu nav button").count(), 0);
    assert.equal(await page.locator("#mode").inputValue(), "time");
    for (let i = 0; i < 5; i++) {
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
    await press("Enter");
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
      await press("Enter");
      if (mode === "practice") {
        await screen("course");
        await press("Enter");
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
    await title();
    await click("OPTION");
    await click("VIEW RECORDS");
    await click("TIME ATTACK'S");
    await screen("records");
    await press("ArrowDown");
    await press("Enter");
    await screen("record-detail");
    await page.evaluate(() => {
      for (let machine = 0; machine < 5; machine++) {
        window.HoverRecords.save(
          "time",
          1,
          "lap",
          10 + machine,
          machine,
          "ABC",
        );
        window.HoverRecords.save(
          "time",
          1,
          "total",
          30 + machine,
          machine,
          "DEF",
        );
      }
      window.recordPortraitRows = [];
      const drawImage = window.CanvasRenderingContext2D.prototype.drawImage;
      window.CanvasRenderingContext2D.prototype.drawImage = function (
        image: CanvasImageSource,
        ...coords: number[]
      ) {
        const args = [image, ...coords] as Parameters<
          CanvasRenderingContext2D["drawImage"]
        >;
        if ((args[0] as HTMLImageElement)?.src?.endsWith("/minicars.png"))
          window.recordPortraitRows.push(args[2]);
        return drawImage.apply(this, args);
      };
    });
    await page.waitForFunction(
      () => new Set(window.recordPortraitRows).size === 5,
    );
    assert.deepEqual(
      await page.evaluate(() =>
        [...new Set(window.recordPortraitRows)].sort((a, b) => a - b),
      ),
      [0, 16, 32, 48, 64],
    );
    await page.screenshot({ path: "/tmp/hover-view-records-fixed.png" });
    await press("Enter");
    await screen("record-detail");
    await press("Escape");
    await screen("records");
    // The course overview has separate half-size portraits for the two
    // winning machines; cover every course, machine and record category.
    for (const [category, offset] of [
      ["time", 0],
      ["gp", 2],
    ] as const) {
      if (category === "gp") {
        await press("Escape");
        await click("GRANDPRIX'S");
        await screen("records");
      }
      await page.evaluate(
        ({ category, offset }) => {
          for (let course = 0; course < 9; course++)
            for (const [kind, line] of [
              ["lap", 0],
              ["total", 1],
            ] as const)
              window.HoverRecords.save(
                category,
                course,
                kind,
                0.01,
                (course + line + offset) % 5,
                "WIN",
              );
          window.recordListPortraits = {};
          window.recordListDrawImage =
            window.CanvasRenderingContext2D.prototype.drawImage;
          window.CanvasRenderingContext2D.prototype.drawImage = function (
            image: CanvasImageSource,
            ...coords: number[]
          ) {
            const args = [image, ...coords] as Parameters<
              CanvasRenderingContext2D["drawImage"]
            >;
            if (
              this.canvas.id === "original-menu" &&
              (args[0] as HTMLImageElement)?.src?.endsWith("/minicars.png")
            )
              window.recordListPortraits[args[6]] = coords;
            return window.recordListDrawImage.apply(this, args);
          };
        },
        { category, offset },
      );
      await page.waitForFunction(
        () => Object.keys(window.recordListPortraits).length === 18,
      );
      const portraits = await page.evaluate(() => {
        window.CanvasRenderingContext2D.prototype.drawImage =
          window.recordListDrawImage;
        return window.recordListPortraits;
      });
      for (let course = 0; course < 9; course++)
        for (let line = 0; line < 2; line++) {
          const y = 24 + course * 24 + line * 10;
          assert.deepEqual(portraits[y], [
            0,
            ((course + line + offset) % 5) * 16,
            24,
            16,
            160,
            y,
            12,
            8,
          ]);
        }
    }
    await page.screenshot({ path: "/tmp/hover-record-list-fixed.png" });
    await title();
    await click("OPTION");
    assert.deepEqual(await page.locator("#menu nav button").allTextContents(), [
      "VIEW RECORDS",
      "SOUND: ON",
      "FULLSCREEN: OFF",
    ]);
    await click("SOUND: ON");
    assert.equal(
      await page
        .getByRole("button", { name: "SOUND: OFF", exact: true })
        .count(),
      1,
    );
    await press("Enter");
    assert.equal(
      await page
        .getByRole("button", { name: "SOUND: ON", exact: true })
        .count(),
      1,
    );
    await press("Escape");
    await screen("title");
    await press("ArrowUp");
    // Gamepad button edges follow the same menu path, without race controls firing.
    await page.evaluate(() => {
      window.menuTestPad = {
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0],
      };
      navigator.getGamepads = () => [window.menuTestPad as unknown as Gamepad];
      window.menuTestPad.buttons[0].pressed = true;
    });
    await screen("car");
    await page.evaluate(() => {
      window.menuTestPad.buttons[0].pressed = false;
    });
    await page.setViewportSize({ width: 375, height: 780 });
    await press("Escape");
    await screen("title");
    await click("TIME ATTACK");
    await screen("car");
    await press("ArrowRight");
    await press("Enter");
    await screen("course");
    const size = await page.locator(".game-wrap").boundingBox();
    assert.ok(Math.abs(size!.width / size!.height - 4 / 3) < 0.01);
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
    await press("Escape");
    await screen("car");
    await press("Escape");
    await screen("title");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).menuSelection,
      1,
    );
    await title();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: simplified title tree; all machines/courses; GP/practice selection order; cancel; race start; records/settings; keyboard, gamepad and narrow-screen layout",
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
