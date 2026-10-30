/* global window */
const assert = require("node:assert/strict"),
  fs = require("node:fs");
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
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const click = (name) =>
        page.getByRole("button", { name, exact: true }).click(),
      press = (key) => page.keyboard.press(key);
    const snap = () => page.evaluate(() => window.hoverDiagnostics());
    const idle = () =>
      page.waitForFunction(() => {
        const c = window.hoverDiagnostics().card;
        return c && !c.busy && !c.errorFrames;
      });
    const title = async () => {
      await page.waitForFunction(
        () => window.hoverDiagnostics?.().state === "demo",
      );
      await press("Enter");
      await press("Enter");
    };
    const open = async (slot) => {
      await click("OPTION");
      await click("MEMORY CARD");
      await click("SLOT " + slot);
      await idle();
    };
    const read = (slot) =>
      page.evaluate(async (slot) => {
        const { MemoryCards } = await import("./card-data.js");
        return new MemoryCards(window.localStorage).read(slot);
      }, slot);
    await page.goto(baseURL);
    await title();
    await open(1);
    assert.deepEqual(
      (await page.locator("#menu nav button").allTextContents()).slice(0, 8),
      [
        "SAVE SYSTEM DATA",
        "LOAD SYSTEM DATA",
        "AUTO SAVE",
        "AUTO LOAD",
        "GAME LEVEL",
        "SAVE REPLAY DATA",
        "LOAD REPLAY DATA",
        "DELETE REPLAY DATA",
      ],
    );
    await click("LOAD SYSTEM DATA");
    assert.equal((await snap()).card.error, "データがありません");
    await idle();
    await page.evaluate(() =>
      window.HoverRecords.save("time", 8, "lap", 1, 0, "TMP"),
    );
    await page.reload();
    await title();
    assert.equal(
      await page.evaluate(
        () => window.HoverRecords.read("time", 8, "lap")[0].time,
      ),
      600,
      "AUTO LOAD OFF does not silently restore unsaved RAM records",
    );
    await open(1);
    await click("AUTO SAVE");
    assert.equal((await snap()).autoLoadSave, 2);
    assert.equal((await snap()).autoSaveSlot, 0);
    await press("Enter");
    assert.equal(
      (await snap()).autoLoadSave,
      2,
      "confirm does not toggle source settings",
    );
    await click("AUTO LOAD");
    assert.equal((await snap()).autoLoadSave, 3);
    await click("GAME LEVEL");
    await press("ArrowLeft");
    await press("ArrowLeft");
    assert.equal(await page.locator("#difficulty").inputValue(), "0");
    await press("ArrowRight");
    await press("ArrowRight");
    await press("ArrowRight");
    await press("ArrowRight");
    assert.equal(await page.locator("#difficulty").inputValue(), "3");
    await page.evaluate(() => {
      window.HoverRules.completeCup(0);
      window.HoverRules.completeCup(1);
      window.HoverTraining.saveMark(2, 1);
      window.HoverRecords.save("time", 0, "lap", 33, 1, "SAT");
    });
    await press("Escape");
    await click("SLOT 1");
    assert.ok(
      (await page.locator("#menu nav button").allTextContents()).includes(
        "LOAD SPECIAL REPLAY",
      ),
    );
    const bounds = await page.locator(".game-wrap").boundingBox();
    assert.ok(
      bounds.y + bounds.height <= 720 - 64,
      "the last source card row stays inside a short viewport",
    );
    await page.screenshot({ path: "/tmp/hover-card-system.png" });
    await click("SAVE SYSTEM DATA");
    await idle();
    const first = await read(0);
    assert.equal(first.system.level, 2);
    assert.equal(first.system.auto, 3);
    assert.equal(first.system.unlocks, 3);
    assert.equal(first.system.training[2], 2);
    assert.equal(first.system.records["time:0:lap"][0].time, 33);
    await page.evaluate(() => {
      window.HoverRules.completeCup(2);
      window.HoverTraining.saveMark(4, 3);
      window.HoverRecords.save("time", 0, "lap", 5, 2, "XYZ");
    });
    await click("LOAD SYSTEM DATA");
    await idle();
    assert.equal(
      await page.evaluate(() => window.HoverRules.unlocks()),
      3,
      "loading can remove later unlocks",
    );
    assert.equal(
      await page.evaluate(() => window.HoverTraining.loadMarks()[4]),
      0,
    );
    assert.equal(
      await page.evaluate(
        () => window.HoverRecords.read("time", 0, "lap")[0].time,
      ),
      33,
    );
    await press("Escape");
    await click("SLOT 2");
    await click("GAME LEVEL");
    await press("ArrowLeft");
    await press("ArrowLeft");
    await press("ArrowLeft");
    await click("SAVE SYSTEM DATA");
    await idle();
    assert.equal((await read(1)).system.level, -1);
    assert.equal((await read(0)).system.level, 2);
    await page.reload();
    await title();
    assert.equal(
      await page.locator("#difficulty").inputValue(),
      "3",
      "AUTO LOAD scans slot 1 before slot 2",
    );
    assert.equal((await snap()).autoSaveSlot, 0);
    await open(1);
    await click("LOAD SPECIAL REPLAY");
    assert.equal((await snap()).card.page, "replays");
    assert.equal((await snap()).card.action, 8);
    await page.screenshot({ path: "/tmp/hover-card-special.png" });
    await click("REPLAY 1");
    await idle();
    assert.equal((await snap()).lastReplay.machine, 3);
    assert.equal((await snap()).lastReplay.course, 2);
    await click("SAVE REPLAY DATA");
    assert.equal((await snap()).card.cursor, 0);
    await press("ArrowUp");
    await press("p");
    assert.equal((await snap()).card.cursor, null);
    await page.screenshot({ path: "/tmp/hover-card-replay.png" });
    await click("REPLAY 2");
    await idle();
    const saved = await read(0);
    assert.equal(saved.replays[1].name.trim(), "HHOST 01");
    assert.equal(saved.replays[1].machine, 3);
    await click("DELETE REPLAY DATA");
    await click("REPLAY 1");
    assert.equal(
      (await snap()).card.page,
      "replays",
      "selecting an empty file stays in source list",
    );
    await click("REPLAY 2");
    await idle();
    assert.equal((await read(0)).replays[1], null);
    assert.equal(
      (await snap()).lastReplay.machine,
      3,
      "delete does not erase RAM replay",
    );
    await click("LOAD SPECIAL REPLAY");
    await click("REPLAY 1");
    await idle();
    await click("SAVE REPLAY DATA");
    await press("p");
    await click("REPLAY 1");
    await idle();
    assert.equal(
      (await read(0)).replays[0].name.trim(),
      "GHOST 01",
      "editing a loaded replay does not modify the embedded pack",
    );
    await click("LOAD REPLAY DATA");
    await click("REPLAY 1");
    await idle();
    await press("Escape");
    await press("Escape");
    await press("Escape");
    await click("START");
    await click("TIME ATTACK");
    await press("Enter");
    await press("ArrowRight");
    await press("ArrowRight");
    await press("Enter");
    await page.waitForFunction(
      () => window.hoverDiagnostics().state === "countdown",
    );
    assert.equal((await snap()).ghost.machine, 3);
    assert.equal(
      (await snap()).sourceMode,
      5,
      "loaded native special recording is eligible as the TA ghost",
    );
    await press("Escape");
    await page.locator("#back").click();
    await page.waitForFunction(
      () => window.hoverDiagnostics().state === "menu",
    );
    assert.equal(
      (await read(0)).replays[0].name.trim(),
      "GHOST 01",
      "AUTO SAVE preserves replay slots",
    );
    await page.waitForTimeout(100);
    await click("START");
    await click("TIME ATTACK");
    await press("Enter");
    await press("Enter");
    await page.waitForFunction(
      () => window.hoverDiagnostics().state === "running",
    );
    await page.evaluate(() => {
      const step = window.HoverEngine.step;
      window.HoverEngine.step = (car, ...args) => {
        step(car, ...args);
        car.finished = true;
        car.reason = "finish";
        car.laps = [10, 11, 12];
        car.time = 33;
        window.HoverEngine.step = step;
      };
    });
    await page.waitForFunction(
      () => window.hoverDiagnostics().postrace === "name",
    );
    await press("Enter");
    await press("Enter");
    await press("Enter");
    await press("Escape");
    await page.waitForFunction(
      () => window.hoverDiagnostics().menuScreen === "car",
    );
    assert.equal(
      await page.evaluate(
        () => window.HoverRecords.read("time", 0, "lap")[0].time,
      ),
      10,
    );
    assert.equal(
      (await read(0)).system.records["time:0:lap"][0].time,
      33,
      "AUTO SAVE waits until leaving selection for the title tree",
    );
    await press("Escape");
    assert.equal((await read(0)).system.records["time:0:lap"][0].time, 10);
    await page.waitForTimeout(100);
    await press("Escape");
    await page.locator(".browser-options summary").click();
    const downloaded = page.waitForEvent("download");
    await click("SLOT 1 ゲームデータを書き出す");
    const download = await downloaded,
      bytes = fs.readFileSync(await download.path());
    assert.equal(bytes.length, 8192);
    assert.equal(bytes.subarray(0, 2).toString(), "SC");
    await page.getByLabel("SLOT 2 ゲームデータを取り込む").setInputFiles({
      name: "hover.bin",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
    await page
      .getByRole("status")
      .filter({ hasText: "取り込みました" })
      .waitFor();
    assert.equal((await read(1)).replays[0].machine, 3);
    const old = await page.evaluate(() =>
      window.localStorage.getItem("hover-card-v1-1"),
    );
    const damaged = Buffer.from(bytes);
    damaged[400] ^= 1;
    await page.getByLabel("SLOT 2 ゲームデータを取り込む").setInputFiles({
      name: "bad.bin",
      mimeType: "application/octet-stream",
      buffer: damaged,
    });
    await page
      .getByRole("status")
      .filter({ hasText: "セーブデータが不正です" })
      .waitFor();
    assert.equal(
      await page.evaluate(() => window.localStorage.getItem("hover-card-v1-1")),
      old,
      "invalid imports do not change the card",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: source card menu/settings, empty-data blink, two independent slots, system rollback, AUTO LOAD priority, special replay pack, 21-character editor, native replay save/load/delete, TA ghost restoration, AUTO SAVE, binary file exchange and atomic invalid import",
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
