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
    const wait = (state: string) =>
      page.waitForFunction(
        (state: string) => window.hoverDiagnostics?.().state === state,
        state,
      );
    const key = (code: string) => page.keyboard.press(code);
    async function force(reason: Car["reason"], winner = false) {
      await page.evaluate(
        ({ reason, winner }) => {
          const step = window.HoverEngine.step;
          let first = true;
          window.HoverEngine.step = (car, ...args) => {
            step(car, ...args);
            if (first) {
              first = false;
              car.finished = true;
              car.reason = reason;
              car.laps = reason === "finish" ? [10, 11, 12] : [];
              car.time = 33;
              car.progress = winner ? 1e9 : -1e9;
            }
          };
        },
        { reason, winner },
      );
    }
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
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().state === "menu",
    );
    await wait("menu");
    for (const code of ["Enter", "Enter", "Enter"]) await key(code);
    await wait("running");
    await key("Escape");
    await key("ArrowDown");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).pauseSelection,
      1,
    );
    await key("Enter");
    await wait("countdown");
    await wait("running");
    await force("course-out");
    await wait("falling");
    const falling = await page.evaluate(() => window.hoverDiagnostics().height);
    await page.waitForTimeout(300);
    assert.ok(
      (await page.evaluate(() => window.hoverDiagnostics().height)) < falling,
    );
    await wait("finished");
    // A retirement goes straight to the result, with RETRY selected.
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "result",
    );
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).gpSelection,
      0,
    );
    assert.match(
      await page.locator("#gp-panel").innerText(),
      /COURSE OUT[\s\S]*RETRY[\s\S]*QUIT GRAND PRIX/,
    );
    assert.equal(await page.locator("#result").isVisible(), false);
    await key("Enter");
    await wait("countdown");
    await wait("running");
    await page.evaluate(async () => {
      const { OriginalSound } = (await import(
        "./sound.js" as string
      )) as typeof import("../src/sound");
      const effect = OriginalSound.prototype.effect;
      window.bombEvents = [];
      OriginalSound.prototype.effect = function (id, note, volume, sustained) {
        if (id === 68) window.bombEvents.push({ note, volume });
        return effect.call(this, id, note, volume, sustained);
      };
    });
    await force("destroyed");
    await wait("destroyed");
    await wait("finished");
    const bursts = await page.evaluate(() => window.bombEvents);
    assert.equal(
      bursts.length,
      30,
      "initial burst plus 29 retriggers at eight-tick intervals",
    );
    assert.ok(bursts.every((b) => b.note === 30 && b.volume === 90));
    // QUIT GRAND PRIX asks first; NO is selected and ESC goes back.
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "result",
    );
    await key("ArrowDown");
    await key("Enter");
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "quit",
    );
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).gpSelection,
      1,
    );
    await key("Escape");
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "result",
    );
    await key("ArrowDown");
    await key("Enter");
    await key("ArrowUp");
    await key("Enter");
    // No finished race in this cup, so there are no records to show.
    await wait("menu");
    // GP defeat shows the goal banner for three seconds before the result.
    for (const code of ["Enter", "Enter", "Enter"]) await key(code);
    await wait("running");
    await force("finish");
    await wait("finished");
    const goal = await page.evaluate(() => window.hoverDiagnostics());
    assert.equal(goal.goalBanner, true);
    assert.equal(goal.gpScreen, null);
    assert.match(await page.locator("#goal-banner").innerText(), /FINISH/);
    assert.equal(await page.locator("#result").isVisible(), false);
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "result",
    );
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).goalBanner,
      false,
    );
    await page.screenshot({ path: "/tmp/hover-gp-result-defeat.png" });
    // Pointer input: the menu rows and confirmation are buttons.
    await page
      .getByRole("button", { name: "QUIT GRAND PRIX", exact: true })
      .click();
    await page.getByRole("button", { name: "YES", exact: true }).click();
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "name",
    );
    // Letters are typed directly; ENTER on the last letter registers them.
    for (const code of ["KeyN", "KeyK", "KeyA", "Enter"]) await key(code);
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "records",
    );
    const defeatRow = await page.evaluate(
      () => window.HoverRecords.read("gp", 0, "lap")[0],
    );
    assert.equal(defeatRow.name, "NKA");
    assert.equal(defeatRow.time, 10);
    assert.match(await page.locator("#gp-panel").innerText(), /NKA\s*NEW/);
    await key("Enter");
    await wait("menu");
    await page.reload();
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().state === "menu",
    );
    await wait("menu");
    for (const code of ["ArrowDown", "Enter", "Enter", "Enter"])
      await key(code);
    await wait("running");
    await force("finish");
    await wait("finished");
    await page.waitForFunction(
      () => window.hoverDiagnostics().postrace === "name",
    );
    await page.setViewportSize({ width: 375, height: 780 });
    const mobile = await page.locator(".game-wrap").boundingBox();
    assert.ok(Math.abs(mobile!.width / mobile!.height - 4 / 3) < 0.01);
    await key("ArrowRight");
    await page.waitForTimeout(320);
    await page.screenshot({ path: "/tmp/hover-name-entry.png" });
    for (let i = 0; i < 3; i++) await key("Enter");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).postrace,
      "laps",
    );
    const row = await page.evaluate(
      () => window.HoverRecords.read("time", 0, "lap")[0],
    );
    // Starts from the name saved by the GP (NKA); the first letter turned to O.
    assert.equal(row.name, "OKA");
    assert.equal(row.time, 10);
    await key("Enter");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).postrace,
      "lap",
    );
    await page.screenshot({ path: "/tmp/hover-best-records.png" });
    await key("Enter");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).postrace,
      "total",
    );
    await key("Escape");
    await wait("menu");
    await page.setViewportSize({ width: 1100, height: 900 });
    // Complete a full GP: result, intro, cup clear, one name for all courses.
    await page.reload();
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().state === "menu",
    );
    await wait("menu");
    for (const code of ["Enter", "Enter", "Enter"]) await key(code);
    for (let round = 0; round < 3; round++) {
      await wait("running");
      await force("finish", true);
      await wait("finished");
      if (round === 2) break;
      await page.waitForFunction(
        () => window.hoverDiagnostics().gpScreen === "result",
      );
      const text = await page.locator("#gp-panel").innerText();
      assert.match(text, /NEXT RACE/);
      assert.match(text, new RegExp(`RACE ${round + 1} / 3`));
      if (round === 0)
        await page.screenshot({ path: "/tmp/hover-gp-result-win.png" });
      // The result waits for input; the cars keep driving behind it.
      await page.waitForTimeout(400);
      assert.equal(
        (await page.evaluate(() => window.hoverDiagnostics())).gpScreen,
        "result",
      );
      await key("Enter");
      await page.waitForFunction(
        (round) =>
          window.hoverDiagnostics().state === "intro" &&
          window.hoverDiagnostics().gpRound === round + 1,
        round,
      );
      assert.match(
        await page.locator("#gp-panel").innerText(),
        new RegExp(`RACE\\s*${round + 2}`),
      );
      // ENTER skips the flyover; otherwise it runs into the countdown.
      if (round === 0) {
        await page.waitForTimeout(600);
        await page.screenshot({ path: "/tmp/hover-gp-intro.png" });
        await key("Enter");
      }
      await wait("countdown");
      assert.equal(
        (await page.evaluate(() => window.hoverDiagnostics())).gpScreen,
        null,
      );
    }
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "clear",
    );
    assert.match(await page.locator("#gp-panel").innerText(), /CLEAR/);
    await page.screenshot({ path: "/tmp/hover-gp-clear.png" });
    await key("Enter");
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "name",
    );
    // The last saved name (from Time Attack) comes back; ENTER confirms each letter.
    assert.deepEqual(await page.locator(".gp-letter").allInnerTexts(), [
      "O",
      "K",
      "A",
    ]);
    await page.screenshot({ path: "/tmp/hover-gp-name.png" });
    for (let i = 0; i < 3; i++) await key("Enter");
    await page.waitForFunction(
      () => window.hoverDiagnostics().gpScreen === "records",
    );
    await page.screenshot({ path: "/tmp/hover-gp-records.png" });
    for (let course = 0; course < 3; course++) {
      const rows = await page.evaluate(
        (course) => window.HoverRecords.read("gp", course, "lap"),
        course,
      );
      assert.ok(rows.some((r) => r.time === 10 && r.name === "OKA"));
      assert.match(
        await page.locator("#gp-panel .gp-title").innerText(),
        new RegExp(
          ["GULF CITY", "PENTA ROCK", "ICE GATE"][course].replace(" ", "\\s"),
          "i",
        ),
      );
      if (course < 2) await key("ArrowRight");
    }
    await key("Enter");
    await wait("menu");
    assert.deepEqual(errors, []);
    assert.deepEqual(
      (await page.evaluate(() => window.hoverDiagnostics())).assetErrors,
      [],
    );
    console.log(
      "PASS: source pause restart; GP fall/destruction/defeat results, RETRY and confirmed QUIT, goal banner delay, pointer controls, typed and confirmed names, named record persistence, mobile records, BESTLAP/TOTAL pages, all GP rounds with intros, cup clear and records",
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
