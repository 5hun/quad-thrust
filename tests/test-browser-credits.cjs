/* global window, requestAnimationFrame */
const assert = require("node:assert/strict");
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
    await page.waitForFunction(() => window.hoverDiagnostics);
    const result = await page.evaluate(async () => {
      const { OriginalPostrace } = await import("./postrace.js");
      const { STAFF } = await import("./staff.js");
      const { sampleReplay } = await import("./replay.js");
      const font = {
        g: null,
        text() {},
        jp() {
          throw Error("Credits must not use wrapped text");
        },
        hooks: { sound() {} },
      };
      const p = new OriginalPostrace(font);
      p.credits(() => {});
      const g = p.canvas.getContext("2d");
      let draws = 0;
      // Off-screen entry and exit must clip a single line, not flow into other rows.
      for (let line = 0; line < STAFF.length; line++)
        for (const x of [-400, -160, 32, 240, 400]) {
          g.clearRect(0, 0, 320, 240);
          p.staffText.draw(g, STAFF[line], x, 64);
          const data = g.getImageData(0, 0, 320, 240).data;
          for (let y = 0; y < 240; y++)
            if (y < 64 || y >= 80)
              for (let xx = 0; xx < 320; xx++)
                if (data[(y * 320 + xx) * 4 + 3])
                  throw Error(`Wrapped ${line} at X=${x} into row ${y}`);
          draws++;
        }
      // A line's clipped pixels must remain identical as it crosses either edge.
      for (let line = 0; line < STAFF.length; line++) {
        g.clearRect(0, 0, 320, 240);
        p.staffText.draw(g, STAFF[line], 32, 64);
        const ref = g.getImageData(0, 64, 320, 16).data;
        for (const [x, delta] of [
          [-128, -160],
          [240, 208],
        ]) {
          g.clearRect(0, 0, 320, 240);
          p.staffText.draw(g, STAFF[line], x, 64);
          const data = g.getImageData(0, 64, 320, 16).data;
          for (let y = 0; y < 16; y++)
            for (let xx = 0; xx < 320; xx++) {
              const src = xx - delta;
              if (src >= 32 && src < 288)
                for (let c = 0; c < 4; c++)
                  if (
                    data[(y * 320 + xx) * 4 + c] !==
                    ref[(y * 320 + src) * 4 + c]
                  )
                    throw Error(`Unstable glyph ${line}`);
            }
        }
      }
      // Exercise every original credit section and its entrance/exit positions.
      let line = 6;
      for (let mode = 0; mode <= 23; mode++) {
        p.creditMode = mode;
        p.creditLine = line;
        for (const t of [
          0, 1, 16, 23, 24, 33, 55, 56, 120, 125, 147, 176, 199, 217, 232,
        ]) {
          p.creditFrame = t;
          p.draw();
        }
        if (mode >= 6 && mode < 22 && mode % 2 === 0)
          line += [2, 1, 1, 2, 2, 4, 7, 2][(mode - 6) / 2] + 1;
      }
      p.creditMode = 6;
      p.creditLine = 6;
      p.creditFrame = 24;
      p.draw();
      const frames = Array.from({ length: 101 }, (_, i) => [
        i / 10,
        i,
        0,
        0,
        0,
        0,
        0,
      ]);
      const poses = [],
        times = [];
      const start = performance.now();
      await new Promise((resolve) => {
        function frame(ts) {
          times.push(ts);
          poses.push(sampleReplay(frames, (ts - start) / 1000, 0).x);
          if (times.length >= 60) resolve();
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      return {
        draws,
        cachedLines: p.staffText.lines.size,
        uniquePoses: new Set(poses.map((x) => x.toFixed(5))).size,
        rafFrames: times.length,
        elapsed: times.at(-1) - times[0],
      };
    });
    assert.equal(result.cachedLines, 36);
    assert.equal(result.draws, 190);
    assert.equal(result.uniquePoses, result.rafFrames);
    await page.screenshot({ path: "/tmp/hover-credits-fixed.png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: all 38 staff lines clipped without wrap or glyph changes; all credit sections; replay moves on every rendered frame",
      result,
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
