import type {} from "./types";
/* global window, requestAnimationFrame */
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
    async function saveBeforeReload() {
      while (
        (await page.evaluate(() => window.hoverDiagnostics())).menuScreen !==
        "title"
      )
        await key("Escape");
      for (const name of [
        "OPTION",
        "MEMORY CARD",
        "SLOT 1",
        "SAVE SYSTEM DATA",
      ])
        await page.getByRole("button", { name, exact: true }).click();
      await page.waitForFunction(() => {
        const c = window.hoverDiagnostics().card;
        return c && !c.busy && !c.errorFrames;
      });
    }
    async function loadAfterReload() {
      for (const name of [
        "OPTION",
        "MEMORY CARD",
        "SLOT 1",
        "LOAD SYSTEM DATA",
      ])
        await page.getByRole("button", { name, exact: true }).click();
      await page.waitForFunction(() => {
        const c = window.hoverDiagnostics().card;
        return c && !c.busy && !c.errorFrames;
      });
      await key("Escape");
      await key("Escape");
      await key("Escape");
      await key("ArrowUp");
    }

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
    await page.addInitScript(() => localStorage.setItem("hover-unlocks", "15"));
    await page.goto(baseURL);
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().state === "demo",
    );
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await wait("menu");
    for (const code of ["Enter", "Enter", "Enter", "Enter"]) await key(code);
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
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).continueChoice,
      0,
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
    await key("ArrowRight");
    await page.waitForFunction(
      () => window.hoverDiagnostics().continueChoice === 1,
    );
    await page.waitForTimeout(180);
    await key("Enter");
    await wait("menu");
    // GP defeat uses the three-second rank presentation before CONTINUE?.
    for (const code of ["Enter", "Enter", "Enter", "Enter"]) await key(code);
    await wait("running");
    await force("finish");
    await wait("finished");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).continueChoice,
      null,
    );
    assert.equal(await page.locator("#result").isVisible(), false);
    await page.waitForFunction(
      () => window.hoverDiagnostics().continueChoice === 0,
    );
    await page.locator("#continue-toggle").click();
    await page.waitForTimeout(320);
    await page.locator("#continue-confirm").click();
    await page.waitForFunction(
      () => window.hoverDiagnostics().postrace === "name",
    );
    for (let i = 0; i < 3; i++) await key("Enter");
    await page.waitForFunction(
      () => window.hoverDiagnostics().postrace === "lap",
    );
    await page.waitForTimeout(50);
    await key("KeyP");
    await wait("menu");
    await saveBeforeReload();
    await page.reload();
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().state === "demo",
    );
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await loadAfterReload();
    await wait("menu");
    for (const code of ["Enter", "ArrowDown", "Enter", "Enter", "Enter"])
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
    assert.equal(row.name, "BAA");
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
    // Complete a full GP: automatic rounds, source credits, one name for all courses.
    await saveBeforeReload();
    await page.reload();
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().state === "demo",
    );
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await loadAfterReload();
    await wait("menu");
    for (const code of ["Enter", "Enter", "Enter", "Enter"]) await key(code);
    for (let round = 0; round < 3; round++) {
      await wait("running");
      if (round === 2) {
        await page.keyboard.down("Space");
        await page.waitForTimeout(2000);
        await page.keyboard.up("Space");
      }
      await force("finish", true);
      await wait("finished");
      if (round < 2)
        await page.waitForFunction(
          (round) =>
            window.hoverDiagnostics().state === "countdown" &&
            window.hoverDiagnostics().gpRound === round + 1,
          round,
        );
    }
    await page.waitForFunction(
      () => window.hoverDiagnostics().postrace === "credits",
    );
    await page.waitForFunction(() =>
      [1, 17, 33].includes(window.hoverDiagnostics().replayCameraMode!),
    );
    const motion = await page.evaluate(async () => {
      const poses: string[] = [];
      await new Promise<void>((resolve) => {
        function sample() {
          const pose = window.hoverDiagnostics().replayPose;
          poses.push(
            [pose!.x, pose!.y, pose!.z].map((n) => n.toFixed(6)).join(","),
          );
          if (poses.length >= 40) resolve();
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      return new Set(poses).size;
    });
    assert.ok(motion >= 35, `Only ${motion}/40 credit frames moved`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: "/tmp/hover-gp-credits.png" });
    await key("Enter");
    await page.waitForFunction(
      () => window.hoverDiagnostics().postrace === "name",
    );
    for (let i = 0; i < 3; i++) await key("Enter");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).postrace,
      "gap",
    );
    await page.waitForFunction(
      () => window.hoverDiagnostics().postrace === "lap",
    );
    await page.screenshot({ path: "/tmp/hover-gp-records.png" });
    for (let course = 0; course < 3; course++) {
      const rows = await page.evaluate(
        (course) => window.HoverRecords.read("gp", course, "lap"),
        course,
      );
      assert.ok(rows.some((r) => r.time === 10 && r.name === "BAA"));
      await key("Escape");
      assert.equal(
        (await page.evaluate(() => window.hoverDiagnostics())).postrace,
        "gap",
      );
      await page.waitForFunction(
        () => window.hoverDiagnostics().postrace === "total",
      );
      await key("Enter");
      if (course < 2)
        await page.waitForFunction(
          () => window.hoverDiagnostics().postrace === "lap",
        );
    }
    await wait("demo");
    await key("Enter");
    await key("Enter");
    await wait("menu");
    // Training success returns to the same task; a miss retries automatically.
    await page.getByRole("button", { name: "START", exact: true }).click();
    await page.getByRole("button", { name: "TRAINING", exact: true }).click();
    await page.getByRole("button", { name: "LEVEL 1", exact: true }).click();
    await key("Enter");
    await key("Enter");
    await wait("running");
    await page.evaluate(() => {
      window.HoverTraining.step = (session) => {
        session.status = "miss";
        session.reason = "test";
        return session.status;
      };
    });
    await wait("finished");
    await wait("countdown");
    await page.evaluate(() => {
      window.HoverTraining.step = (session) => {
        session.status = "complete";
        session.reason = "test";
        return session.status;
      };
    });
    await wait("finished");
    await wait("menu");
    assert.equal(
      (await page.evaluate(() => window.hoverDiagnostics())).menuScreen,
      "training",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(
      (await page.evaluate(() => window.hoverDiagnostics())).assetErrors,
      [],
    );
    console.log(
      "PASS: source pause restart; GP fall/destruction/defeat CONTINUE?, YES retry and NO exit, rank delay, touch controls, three-letter entry, named record persistence, mobile records, BESTLAP/TOTAL pages, all GP rounds/credits/batch records, training success/miss transitions",
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
