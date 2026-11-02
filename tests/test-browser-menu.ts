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
            values: {
              "hover-unlocks": "7",
            },
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
    assert.deepEqual(
      await page
        .locator("#menu nav button")
        .evaluateAll((buttons) =>
          buttons.map((b) => b.getAttribute("aria-label")),
        ),
      ["GRANDPRIX", "TIME ATTACK", "OPTIONS"],
    );
    const titleMusic = await page.evaluate(
      () => window.hoverDiagnostics().music,
    );
    await press("ArrowDown");
    await press("Enter");
    await screen("car");
    assert.deepEqual(
      await page
        .locator("#menu nav button")
        .evaluateAll((buttons) =>
          buttons.map((b) => b.getAttribute("aria-label")),
        ),
      ["WHITE HARE", "EXCEL", "BETA", "JUSTER", "ALPHA"],
    );
    assert.equal(await page.locator("#mode").inputValue(), "time");
    await click("BETA");
    assert.equal(await page.locator("#machine").inputValue(), "2");
    await page.waitForFunction(
      () => document.querySelector(".machine-info h3")?.textContent === "BETA",
    );
    await screen("car");
    assert.equal(
      await page.locator("#menu nav button[aria-current=true]").textContent(),
      "BETA",
    );
    assert.deepEqual(await page.locator(".machine-info dt").allTextContents(), [
      "Engine",
      "Side Thrusters",
      "Rudder",
      "Drag",
      "Turbo",
      "Weight",
      "Energy Capacity",
    ]);
    assert.match(
      await page.locator(".machine-description").innerText(),
      /four thrusters and no rudder/,
    );
    assert.equal(
      await page
        .locator(".machine-info dd i")
        .nth(2)
        .evaluate((bar) => bar.style.width),
      "0%",
    );
    assert.equal(await page.locator(".machine-confirm").count(), 0);
    const demoFrame = await page.evaluate(
      () => window.hoverDiagnostics().demoFrames,
    );
    await page.waitForFunction(
      (frame) => window.hoverDiagnostics().demoFrames > frame,
      demoFrame,
    );
    await page.screenshot({ path: "/tmp/hover-machine-select-desktop.png" });
    await click("WHITE HARE");
    assert.equal(
      await page
        .locator("#menu nav")
        .evaluate((nav) => getComputedStyle(nav).scrollbarWidth),
      "none",
    );
    await page.getByRole("button", { name: "一覧を下へ", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#menu nav")!.scrollTop > 0,
    );
    assert.equal(await page.locator("#machine").inputValue(), "0");
    await page.getByRole("button", { name: "一覧を上へ", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#menu nav")!.scrollTop < 1,
    );
    // The last label can be fully visible before its row padding finishes
    // scrolling into view. That padding must not keep the down arrow visible.
    await page
      .locator("#menu nav")
      .evaluate((nav) =>
        nav.scrollTo({ top: nav.scrollHeight, behavior: "smooth" }),
      );
    await page.waitForFunction(
      () => {
        const nav = document.querySelector("#menu nav")!;
        const range = document.createRange();
        range.selectNodeContents(nav.lastElementChild!);
        return (
          range.getBoundingClientRect().bottom <=
          nav.getBoundingClientRect().bottom
        );
      },
      null,
      { polling: "raf" },
    );
    assert.equal(
      await page
        .getByRole("button", { name: "一覧を下へ", exact: true })
        .isVisible(),
      false,
    );
    assert.equal(
      await page
        .locator(".selection-scroll")
        .first()
        .evaluate((arrow) => getComputedStyle(arrow).color),
      "rgb(255, 255, 255)",
    );
    await page
      .locator("#menu nav")
      .evaluate((nav) => nav.scrollTo({ top: 0, behavior: "instant" }));
    for (const viewport of [
      { width: 375, height: 780 },
      { width: 1600, height: 900 },
      { width: 2560, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const info = await page.locator(".machine-info").boundingBox();
      const list = await page.locator("#menu nav").boundingBox();
      const guide = await page.locator("#menu .title-guide").boundingBox();
      const menu = await page.locator("#menu").boundingBox();
      assert.ok(info && menu && info.y + info.height <= menu.y + menu.height);
      assert.ok(list && guide && list.y + list.height <= guide.y);
      assert.ok(info.x + info.width <= viewport.width);
      const positions = async () =>
        (
          await Promise.all([
            page.locator(".title-brand").boundingBox(),
            page.locator("#menu .menu-caption").boundingBox(),
            page.locator("#menu nav button").first().boundingBox(),
          ])
        ).map((box) => ({ x: box!.x, y: box!.y }));
      const machinePositions = await positions();
      await press("Escape");
      await click("GRANDPRIX");
      await screen("gp");
      assert.deepEqual(
        await positions(),
        machinePositions,
        "machine menu shares the GP menu placement",
      );
      await press("Escape");
      await click("TIME ATTACK");
      await screen("car");
    }
    await page.setViewportSize({ width: 1100, height: 900 });
    await press("Escape");
    await screen("title");
    await page.waitForFunction(
      (music) => window.hoverDiagnostics().music === music,
      titleMusic,
    );
    await click("TIME ATTACK");
    await screen("car");
    for (let i = 0; i < 5; i++) {
      assert.equal(await page.locator("#machine").inputValue(), String(i));
      await press("ArrowRight");
    }
    await press("Enter");
    await screen("course");
    assert.equal(await page.locator("#menu nav button").count(), 9);
    const previewPixels = await page.evaluate(async () => {
      const { HoverRenderer } = (await import(
        "./renderer.js" as string
      )) as typeof import("../src/renderer");
      const canvas = document.createElement("canvas");
      canvas.style.cssText =
        "position:fixed;left:-10000px;width:1600px;height:900px";
      document.body.append(canvas);
      const renderer = new HoverRenderer(canvas);
      try {
        renderer.resize();
        renderer.drawCoursePreview(
          window.HoverEngine.prepare(window.HOVER_TRACKS[0]),
          0,
        );
        const target = Reflect.get(renderer, "coursePreviewTarget");
        const pixels = new Uint8Array(target.width * target.height * 4);
        renderer.renderer.readRenderTargetPixels(
          target,
          0,
          0,
          target.width,
          target.height,
          pixels,
        );
        let dark = 0,
          solid = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i + 3] > 250) {
            solid++;
            if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 240) dark++;
          }
        return { dark, solid };
      } finally {
        renderer.renderer.dispose();
        canvas.remove();
      }
    });
    assert.ok(previewPixels.solid > 1000);
    assert.ok(
      previewPixels.dark / previewPixels.solid < 0.02,
      "the overview road must not be speckled by its underside",
    );
    assert.equal(
      await page
        .locator("#menu nav")
        .evaluate((nav) => getComputedStyle(nav).scrollbarWidth),
      "none",
    );
    await page.getByRole("button", { name: "一覧を下へ", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#menu nav")!.scrollTop > 0,
    );
    await page.getByRole("button", { name: "一覧を上へ", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#menu nav")!.scrollTop < 1,
    );
    assert.deepEqual(
      await page.locator(".course-records h3").allTextContents(),
      ["BEST LAP", "TOTAL TIME"],
    );
    assert.equal(await page.locator(".course-records [role=img]").count(), 0);
    assert.deepEqual(
      await page.locator(".course-record-time").allTextContents(),
      ["--'--\"--", "--'--\"--"],
    );
    await page.evaluate(() => {
      window.HoverRecords.save("time", 0, "lap", 12.5, 0, "AAA");
      window.HoverRecords.save("time", 0, "total", 45, 1, "BBB");
    });
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".course-records [role=img]").length === 2,
    );
    assert.deepEqual(
      await page
        .locator(".record-machine-icon")
        .evaluateAll((icons) =>
          icons.map((icon) => icon.getAttribute("aria-label")),
        ),
      ["WHITE HARE", "EXCEL"],
    );
    assert.deepEqual(
      await page.locator(".course-record-time").allTextContents(),
      ["00'12\"50", "00'45\"00"],
    );
    const courseDemo = await page.evaluate(
      () => window.hoverDiagnostics().demo,
    );
    for (const viewport of [
      { width: 375, height: 780 },
      { width: 1600, height: 900 },
      { width: 2560, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      await page.locator("#menu nav button").last().click();
      assert.equal(await page.locator("#course").inputValue(), "8");
      const selected = await page
        .locator('#menu nav button[aria-current="true"]')
        .boundingBox();
      const nav = await page.locator("#menu nav").boundingBox();
      const records = await page.locator(".course-records").boundingBox();
      const menu = await page.locator("#menu").boundingBox();
      assert.ok(
        selected &&
          nav &&
          selected.y >= nav.y &&
          selected.y + selected.height <= nav.y + nav.height + 1,
      );
      assert.ok(
        records &&
          menu &&
          records.x + records.width <= menu.x + menu.width &&
          records.y + records.height <= menu.y + menu.height,
      );
      await page.locator("#menu nav button").first().click();
      await page.screenshot({
        path: `/tmp/hover-course-select-${viewport.width}.png`,
      });
    }
    await page.setViewportSize({ width: 1100, height: 900 });
    const continuingDemo = await page.evaluate(
      () => window.hoverDiagnostics().demo,
    );
    assert.equal(continuingDemo.course, courseDemo.course);
    assert.notDeepEqual(continuingDemo.positions, courseDemo.positions);
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
    // The pause list replaces the HUD and keeps the race mix suspended while
    // menu sounds use their own running output.
    const pauseState = () =>
      page.evaluate(() => {
        const d = window.hoverDiagnostics();
        return {
          state: d.state,
          screen: d.pauseScreen,
          selection: d.pauseSelection,
          caption: document.querySelector("#pause-panel .menu-caption")!
            .textContent,
          items: Array.from(
            document.querySelectorAll("#pause-panel nav button"),
            (b) => b.getAttribute("aria-label"),
          ),
          hud: document.getElementById("hud")!.hidden,
        };
      });
    assert.deepEqual(await pauseState(), {
      state: "paused",
      screen: "top",
      selection: 0,
      caption: "PAUSED",
      items: ["RESUME", "RESTART", "OPTIONS", "QUIT"],
      hud: true,
    });
    await press("ArrowDown");
    await press("ArrowDown");
    await press("Enter");
    assert.deepEqual(
      (({ screen, caption, items }) => ({ screen, caption, items }))(
        await pauseState(),
      ),
      {
        screen: "options",
        caption: "OPTIONS",
        items: ["SOUND: ON", "VOLUME: 10", "FULLSCREEN: OFF"],
      },
    );
    // AudioContext resume() settles asynchronously.
    await page.waitForFunction(() => {
      const d = window.hoverDiagnostics();
      return d.audioState === "suspended" && d.menuAudioState === "running";
    });
    await press("Enter");
    assert.deepEqual((await pauseState()).items, [
      "SOUND: OFF",
      "VOLUME: 10",
      "FULLSCREEN: OFF",
    ]);
    await press("Enter");
    assert.equal(
      await page.evaluate(() => window.hoverDiagnostics().audioState),
      "suspended",
    );
    await press("ArrowDown");
    await press("ArrowLeft");
    assert.equal((await pauseState()).items[1], "VOLUME: 9");
    await press("ArrowRight");
    assert.equal((await pauseState()).items[1], "VOLUME: 10");
    assert.equal((await pauseState()).screen, "options");
    await press("ArrowUp");
    await press("Escape");
    assert.equal((await pauseState()).screen, "top");
    assert.equal((await pauseState()).selection, 2);
    await press("Escape");
    assert.equal((await pauseState()).state, "running");
    assert.equal((await pauseState()).hud, false);
    await press("Escape");
    // Time Attack quits without a confirmation.
    await click("QUIT");
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
      await click("QUIT");
      if (mode.startsWith("gp")) {
        // Quitting a Grand Prix asks first, with NO preselected.
        assert.deepEqual(
          (({ screen, selection, caption, items }) => ({
            screen,
            selection,
            caption,
            items,
          }))(await pauseState()),
          {
            screen: "quit",
            selection: 1,
            caption: "QUIT GRAND PRIX?",
            items: ["YES", "NO"],
          },
        );
        if (mode === "gp0") {
          await press("Enter");
          assert.equal((await pauseState()).screen, "top");
          assert.equal((await pauseState()).selection, 3);
          await press("Enter");
          await press("Escape");
          assert.equal((await pauseState()).screen, "top");
          await click("QUIT");
        }
        await click("YES");
      }
      await screen("title");
    }
    await title();
    await click("OPTIONS");
    await click("VIEW RECORDS");
    await screen("records");
    // VIEW RECORDS is one screen: GP / TIME ATTACK tabs, the nine courses
    // grouped by cup, and the selected course's six BEST LAP and TOTAL rows.
    // The panel follows the selection on the next rendered frame.
    const recordsView = async () => {
      await page.waitForFunction(
        () =>
          document.querySelector("#menu .records-title")?.textContent ===
          window.HOVER_TRACKS[
            window.hoverDiagnostics().menuSelection
          ].name.toUpperCase(),
      );
      return page.evaluate(() => ({
        tab: document.querySelector(
          '#menu [data-record-class][aria-current="true"]',
        )?.textContent,
        selection: window.hoverDiagnostics().menuSelection,
        cups: Array.from(
          document.querySelectorAll("#menu .records-cup"),
          (h) => h.textContent,
        ),
        courses: document.querySelectorAll("#menu nav button[data-index]")
          .length,
        title: document.querySelector("#menu .records-title")?.textContent,
        empty: document.querySelector("#menu .records-empty") !== null,
        rows: Array.from(
          document.querySelectorAll("#menu .records-rows"),
          (ol) =>
            Array.from(ol.children, (li) => [
              li.querySelector(".gp-machine")!.textContent,
              li.querySelector(".gp-gap")!.textContent,
              li.querySelector(".gp-time")!.textContent,
              li
                .querySelector(".record-machine-icon img")
                ?.getAttribute("style") ?? null,
            ]),
        ),
        bests: Array.from(
          document.querySelectorAll("#menu .records-course-best"),
          (b) => b.textContent,
        ),
      }));
    };
    let view = await recordsView();
    assert.equal(view.tab, "GRAND PRIX");
    assert.equal(view.selection, 0);
    assert.deepEqual(view.cups, ["BLUE GP", "YELLOW GP", "RED GP"]);
    assert.equal(view.courses, 9);
    assert.deepEqual(
      await page
        .locator("#menu .title-guide > :visible")
        .evaluateAll((items) =>
          items.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ")),
        ),
      ["↑ ↓ COURSE", "← → MODE", "ESC BACK"],
    );
    await press("ArrowUp");
    for (let i = 0; i < 9; i++) await press("ArrowDown");
    view = await recordsView();
    assert.equal(view.selection, 8);
    assert.deepEqual(
      await page.evaluate(() => [
        window.HoverRecords.read("gp", 8, "lap"),
        window.HoverRecords.read("gp", 8, "total"),
      ]),
      [[], []],
    );
    assert.equal(view.empty, true);
    assert.deepEqual(view.rows, []);
    assert.equal(
      view.title,
      await page.evaluate(() => window.HOVER_TRACKS[8].name.toUpperCase()),
    );
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
    });
    // Left and right switch the record class; a click picks a course.
    await press("ArrowRight");
    await page.locator('#menu nav button[data-index="1"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll("#menu .records-rows").length === 2,
    );
    view = await recordsView();
    assert.equal(view.tab, "TIME ATTACK");
    assert.equal(view.selection, 1);
    assert.equal(view.empty, false);
    const machineNames = await page.evaluate(() =>
      window.HoverEngine.MACHINES.slice(0, 5).map((m) => m.name),
    );
    for (const [column, name, base] of [
      [0, "ABC", 10],
      [1, "DEF", 30],
    ] as const)
      assert.deepEqual(view.rows[column], [
        ...machineNames.map((machine, i) => [
          name,
          machine,
          `00'${base + i}"00`,
          `top: ${-i * 100}%`,
        ]),
        ["---", "", "--'--\"--", null],
      ]);
    assert.equal(view.bests[1], `00'30"00`);
    assert.equal(
      await page
        .locator("#menu .records-rows li")
        .first()
        .getAttribute("data-top"),
      "",
    );
    await page.screenshot({ path: "/tmp/hover-view-records.png" });
    await press("ArrowLeft");
    await press("ArrowLeft");
    assert.equal((await recordsView()).tab, "GRAND PRIX");
    await click("TIME ATTACK");
    assert.equal((await recordsView()).tab, "TIME ATTACK");
    // ENTER has nothing further to open; ESC returns to OPTIONS.
    await press("Enter");
    await screen("records");
    await press("Escape");
    await screen("option");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).menuSelection,
      0,
    );
    await title();
    await click("OPTIONS");
    assert.deepEqual(
      await page
        .locator("#menu nav button")
        .evaluateAll((buttons) =>
          buttons.map((b) => b.getAttribute("aria-label")),
        ),
      ["VIEW RECORDS", "SOUND: ON", "VOLUME: 10", "FULLSCREEN: OFF"],
    );
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
    // VOLUME: left/right step the level on its row, clamped to 0..10;
    // the arrows step it by pointer and Enter cycles through the levels.
    const volume = () =>
      page.evaluate(() => ({
        label: document
          .querySelector("#menu nav button.volume-option")!
          .getAttribute("aria-label"),
        fill: (document.querySelector("#menu .volume-meter i") as HTMLElement)
          .style.width,
        gain: window.hoverDiagnostics().volume,
      }));
    await press("ArrowDown");
    await press("ArrowLeft");
    await press("ArrowLeft");
    assert.deepEqual(await volume(), {
      label: "VOLUME: 8",
      fill: "80%",
      gain: 0.8,
    });
    await press("ArrowRight");
    await press("ArrowRight");
    await press("ArrowRight");
    assert.deepEqual(await volume(), {
      label: "VOLUME: 10",
      fill: "100%",
      gain: 1,
    });
    await page.locator("#menu .volume-arrow").first().click();
    assert.equal((await volume()).label, "VOLUME: 9");
    await press("Enter");
    await press("Enter");
    assert.equal((await volume()).label, "VOLUME: 0");
    await click("VOLUME: 0");
    assert.equal((await volume()).label, "VOLUME: 1");
    // The level survives a reload.
    await page.reload();
    await enterTitle();
    await click("OPTIONS");
    assert.equal((await volume()).label, "VOLUME: 1");
    for (let i = 0; i < 9; i++)
      await page.locator("#menu .volume-arrow").last().click();
    assert.equal((await volume()).label, "VOLUME: 10");
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
    await page.locator("#menu .title-layout").evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      );
    });
    await page.screenshot({ path: "/tmp/hover-machine-select-mobile.png" });
    await press("ArrowRight");
    await click("ENTER CONFIRM");
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
