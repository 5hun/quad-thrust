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
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.stack || error.message));
    const snap = () => page.evaluate(() => window.hoverDiagnostics());
    const click = (name: string) =>
      page.getByRole("button", { name, exact: true }).click();
    const title = async () => {
      await page.waitForFunction(
        () => window.hoverDiagnostics?.().state === "demo",
      );
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => window.hoverDiagnostics().menuScreen === "title",
      );
    };
    await page.goto(baseURL);
    await title();
    assert.equal(
      await page.locator("#browser-settings, input[type=file]").count(),
      0,
    );
    await click("OPTION");
    assert.deepEqual(await page.locator("#menu nav button").allTextContents(), [
      "GAME LEVEL",
      "VIEW RECORDS",
      "SOUND: ON",
      "FULLSCREEN: OFF",
    ]);
    await click("GAME LEVEL");
    assert.equal((await snap()).menuSelection, 1);
    await click("HARD");
    assert.equal((await snap()).cpuDifficulty, 1);
    // Reload directly from OPTION; no manual save or menu exit.
    await page.reload();
    await title();
    assert.equal((await snap()).cpuDifficulty, 1);
    await click("OPTION");
    await click("GAME LEVEL");
    assert.equal((await snap()).menuSelection, 2);
    await click("EXPART");
    await page.evaluate(() => {
      window.HoverRules.completeCup(0);
      window.HoverRules.completeCup(1);
      window.HoverRecords.save("time", 2, "lap", 12.5, 2, "ABC");
      window.HoverRecords.save("time", 2, "total", 40, 2, "ABC");
    });
    await page.reload();
    await title();
    assert.equal((await snap()).cpuDifficulty, 2);
    const progress = await page.evaluate(() => ({
      cups: window.HoverRules.availableCups(),
      lap: window.HoverRecords.read("time", 2, "lap")[0],
      total: window.HoverRecords.read("time", 2, "total")[0],
    }));
    assert.equal(progress.cups, 3);
    assert.deepEqual(progress.lap, { time: 12.5, machine: 2, name: "ABC" });
    assert.deepEqual(progress.total, { time: 40, machine: 2, name: "ABC" });
    assert.equal((await snap()).lastReplay, null);
    await click("OPTION");
    assert.equal(
      await page.getByRole("button", { name: "ENDING", exact: true }).count(),
      0,
    );
    // Ignore all old profiles, including ones with autoload enabled.
    await page.evaluate(() => {
      localStorage.removeItem("hover-autosave-v2");
      localStorage.setItem("hover-unlocks", "15");
      localStorage.setItem("hover-cpu-difficulty", "3");
      localStorage.setItem(
        "hover-card-v1-0",
        JSON.stringify({ bytes: Array(8192).fill(255) }),
      );
    });
    await page.reload();
    await title();
    assert.equal((await snap()).cpuDifficulty, 0);
    assert.equal(await page.evaluate(() => window.HoverRules.unlocks()), 0);
    await page.evaluate(() =>
      localStorage.setItem("hover-autosave-v2", "{broken"),
    );
    await page.reload();
    await title();
    assert.equal((await snap()).cpuDifficulty, 0);
    assert.deepEqual(errors, []);
    // Browsers can deny reads and writes independently of the game's UI.
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw Error("Storage blocked");
      };
      Storage.prototype.setItem = () => {
        throw Error("Storage blocked");
      };
    });
    await page.reload();
    await title();
    await click("OPTION");
    await click("GAME LEVEL");
    await click("EASY");
    assert.equal((await snap()).cpuDifficulty, -1);
    assert.equal((await snap()).saveError, true);
    await click("GAME LEVEL");
    await click("NORMAL");
    assert.equal((await snap()).cpuDifficulty, 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: autosave/autoload without menu exit, progress/records/difficulty, removed card UI, no migration, corrupt/blocked storage fallback",
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
  }).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
