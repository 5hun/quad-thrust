/* global window */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
    await page.goto(baseURL);
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().state === "demo",
    );
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    const click = (name) =>
      page.getByRole("button", { name, exact: true }).click();
    const snap = () => page.evaluate(() => window.hoverDiagnostics());
    const back = () => page.keyboard.press("Escape");
    await click("HELP");
    const rootItems = [
      "はじめに",
      "操作について",
      "マシン紹介",
      "ゲームモード紹介",
      "路面の記号について",
      "セーブ・ロードについて",
      "このゲームについて",
      "スタッフ",
    ];
    assert.deepEqual(
      await page.locator("#menu nav button").allTextContents(),
      rootItems,
    );
    await page.waitForFunction(
      () => window.hoverDiagnostics().music === "SAMPLE26",
    );
    await page.screenshot({ path: "/tmp/hover-help-index.png" });
    await page.keyboard.press("ArrowRight");
    assert.equal(
      (await snap()).help.selection,
      0,
      "only up/down navigate the source HELP lists",
    );
    const data = await page.evaluate(
      async () => (await import("./help-data.js")).HELP_BOOKS,
    );
    assert.equal(Object.keys(data).length, 18);
    for (const [book, lines] of Object.entries(data)) {
      const bytes = fs.readFileSync(
        path.join(__dirname, "../extracted", book.toUpperCase() + ".TXT"),
      );
      const source = new TextDecoder("shift_jis").decode(bytes).split(/\r?\n/);
      const expected = source.slice(0, source.indexOf("END"));
      if (book === "about") expected[30] = "　　　Ｖｅｒ　１．２００";
      assert.deepEqual(lines, expected, book + " original book, line-for-line");
    }
    async function book(name, expected) {
      await click(name);
      await page.waitForFunction(
        (book) => window.hoverDiagnostics().help?.book === book,
        expected,
      );
      assert.equal(
        (await snap()).help.maxScroll,
        Math.max(0, data[expected].length * 28 - 228),
      );
      assert.ok(
        (await page.locator("#menu").getAttribute("aria-label")).includes(
          data[expected][0],
        ),
      );
    }
    await book("はじめに", "intro");
    await page.keyboard.press("Enter");
    assert.equal(
      (await snap()).help.book,
      "intro",
      "confirm does not leave a book",
    );
    await page.evaluate(async () => {
      const { OriginalHelp } = await import("./help.js");
      const tick = OriginalHelp.prototype.tick;
      window.helpScrollSteps = [];
      OriginalHelp.prototype.tick = function (direction, fast) {
        const before = this.scroll;
        tick.call(this, direction, fast);
        if (direction)
          window.helpScrollSteps.push({ fast, delta: this.scroll - before });
      };
    });
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(180);
    await page.keyboard.down("z");
    await page.waitForTimeout(180);
    await page.keyboard.up("z");
    await page.keyboard.up("ArrowDown");
    const steps = await page.evaluate(() => window.helpScrollSteps);
    assert.ok(steps.filter((s) => !s.fast && s.delta === 2).length >= 3);
    assert.ok(steps.filter((s) => s.fast && s.delta === 4).length >= 3);
    await page.evaluate(() => {
      window.helpScrollSteps = [];
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [
          {
            axes: [0, 0],
            buttons: Array.from({ length: 16 }, (_, i) => ({
              pressed: i === 13 || i === 2,
            })),
          },
        ],
      });
    });
    await page.waitForTimeout(180);
    const padSteps = await page.evaluate(() => window.helpScrollSteps);
    assert.ok(
      padSteps.length >= 3 && padSteps.every((s) => s.fast && s.delta === 4),
      "gamepad square/X accelerates held scrolling",
    );
    await page.evaluate(() =>
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [],
      }),
    );
    await page.screenshot({ path: "/tmp/hover-help-book.png" });
    for (let i = 0; i < 40; i++) await click("下へスクロール");
    assert.equal((await snap()).help.scroll, (await snap()).help.maxScroll);
    for (let i = 0; i < 40; i++) await click("上へスクロール");
    assert.equal((await snap()).help.scroll, 0);
    await back();
    assert.equal((await snap()).help.selection, 0);
    for (const [name, id] of [
      ["ゲームモード紹介", "modes"],
      ["路面の記号について", "sign"],
      ["セーブ・ロードについて", "replay"],
      ["このゲームについて", "about"],
      ["スタッフ", "staff"],
    ]) {
      await book(name, id);
      if (id === "sign")
        await page.screenshot({ path: "/tmp/hover-help-signs.png" });
      if (id === "staff")
        await page.screenshot({ path: "/tmp/hover-help-staff.png" });
      await back();
      assert.equal((await snap()).help.selection, rootItems.indexOf(name));
    }
    await click("操作について");
    const controls = [
      "左右（ラダー）",
      "上下（傾き）",
      "×ボタン（ブースター）",
      "□ボタン（ターボ）",
      "○ボタン（ブレーキ）",
      "Ｒ１Ｒ２・Ｌ１Ｌ２（スラスター）",
    ];
    assert.deepEqual(
      await page.locator("#menu nav button").allTextContents(),
      controls,
    );
    for (const [i, id] of [
      "radder",
      "move",
      "booster",
      "turbo",
      "brake",
      "slaster",
    ].entries()) {
      await book(controls[i], id);
      if (["radder", "booster", "slaster"].includes(id)) {
        await page.waitForTimeout(120);
        const annotations = (await snap()).help.annotations;
        assert.equal(annotations.length, id === "slaster" ? 4 : 1);
        assert.ok(
          annotations.every(
            (a) => Number.isFinite(a.x) && Number.isFinite(a.y),
          ),
        );
        await page.screenshot({ path: `/tmp/hover-help-${id}.png` });
      }
      await back();
      assert.equal((await snap()).help.selection, i);
    }
    await back();
    assert.equal((await snap()).help.selection, 1);
    await click("マシン紹介");
    assert.equal(
      await page.locator("#menu nav button").count(),
      4,
      "hidden machines are absent from help too",
    );
    await back();
    await page.evaluate(() => window.HoverRules.completeCup(2));
    await page.evaluate(() =>
      window.localStorage.setItem(
        "hover-training-marks",
        JSON.stringify(Array(15).fill(31)),
      ),
    );
    await click("マシン紹介");
    const machines = [
      "ＬＵＳＴＥＲ",
      "ＥＸＣＥＬ",
      "ＢＥＴＡ",
      "ＪＵＳＴＥＲ",
      "ＡＬＰＨＡ",
      "ＳＵＺＵＫＩ",
    ];
    assert.deepEqual(
      await page.locator("#menu nav button").allTextContents(),
      machines,
    );
    for (const [i, id] of [
      "luster",
      "excel",
      "beta",
      "juster",
      "alpha",
      "suzuki",
    ].entries()) {
      await book(machines[i], id);
      await page.waitForTimeout(60);
      assert.ok((await snap()).help.frame > 0);
      if (id === "suzuki")
        await page.screenshot({ path: "/tmp/hover-help-suzuki.png" });
      await back();
    }
    await back();
    assert.equal((await snap()).help.selection, 2);
    await back();
    assert.equal((await snap()).menuScreen, "title");
    assert.equal((await snap()).menuSelection, 2);
    assert.notEqual((await snap()).music, "SAMPLE26");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: all 18 original HELP texts, source menu hierarchy, locked machine descriptions, book scrolling at 2/4 pixels/tick, model callouts, road signs, staff alignment, cancel selection and music lifetime",
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
