import type {} from "./types";
const assert: typeof import("node:assert/strict") = require("node:assert/strict");

module.exports = async function verify({
  chromium,
  executablePath,
  baseURL,
}: import("./types").BrowserOptions) {
  for (const autoplay of [true, false]) {
    const browser = await chromium.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        `--autoplay-policy=${autoplay ? "no-user-gesture-required" : "document-user-activation-required"}`,
      ],
    });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        // Pick the same demo course and BGM on every run.
        Math.random = () => 0.01;
        const createCompressor =
          AudioContext.prototype.createDynamicsCompressor;
        AudioContext.prototype.createDynamicsCompressor = function () {
          const compressor = createCompressor.call(this);
          window.demoAudioAnalyser = this.createAnalyser();
          compressor.connect(window.demoAudioAnalyser);
          return compressor;
        };
      });
      await page.goto(baseURL);
      await page.waitForFunction(
        () => window.hoverDiagnostics?.().demoFrames > 5,
      );
      if (!autoplay) {
        assert.equal(
          (await page.evaluate(() => window.hoverDiagnostics())).audioState,
          "suspended",
        );
        // A normal browser setting interaction must unlock audio without
        // navigating the menu or toggling SOUND OFF and ON.
        await page.locator("body").click({ position: { x: 5, y: 5 } });
      }
      await page.waitForFunction(
        () => {
          const d = window.hoverDiagnostics();
          return (
            d.audioState === "running" && d.music === "B" && d.musicNotes > 0
          );
        },
        undefined,
        { timeout: 10000 },
      );
      assert.equal(
        (await page.evaluate(() => window.hoverDiagnostics())).state,
        "menu",
      );
      const audioMatches = (expected: boolean) => {
        const analyser = window.demoAudioAnalyser;
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return samples.some((value) => Math.abs(value) > 0.00001) === expected;
      };
      await page.waitForFunction(audioMatches, true);
      await page.getByRole("button", { name: "OPTION", exact: true }).click();
      await page
        .getByRole("button", { name: "SOUND: ON", exact: true })
        .click();
      await page.waitForFunction(audioMatches, false);
      assert.equal(
        (
          await page.getByRole("button", { name: /^SOUND:/ }).textContent()
        )?.trim(),
        "SOUND: OFF",
      );
      await page.locator("body").click({ position: { x: 5, y: 5 } });
      assert.equal(await page.evaluate(audioMatches, false), true);
      assert.equal(
        (
          await page.getByRole("button", { name: /^SOUND:/ }).textContent()
        )?.trim(),
        "SOUND: OFF",
      );
      await page
        .getByRole("button", { name: "SOUND: OFF", exact: true })
        .click();
      // SELECT BGM resumes only after sound is enabled again.
      await page.keyboard.press("Escape");

      await page
        .getByRole("button", { name: "TIME ATTACK", exact: true })
        .click();
      await page.waitForFunction(audioMatches, true);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "OPTION", exact: true }).click();
      assert.equal(
        (
          await page.getByRole("button", { name: /^SOUND:/ }).textContent()
        )?.trim(),
        "SOUND: ON",
      );
      assert.deepEqual(errors, []);
      console.log(
        `PASS: demo BGM, autoplay ${autoplay ? "allowed" : "blocked then unlocked"}, SOUND toggle`,
      );
    } finally {
      await browser.close();
    }
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
