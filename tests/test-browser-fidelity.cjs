/* global window, document */
const assert = require("node:assert/strict");
// Caller supplies its installed Playwright and browser; no runtime dependency.
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
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(baseURL);
    await page.waitForFunction(() => window.hoverDiagnostics?.().triangles > 0);
    await page.evaluate(async () => {
      const { HoverRenderer } = await import("./renderer.js");
      const { OriginalSound } = await import("./sound.js");
      const canvas = document.createElement("canvas");
      canvas.style.cssText =
        "width:640px;height:480px;position:fixed;top:0;left:0;z-index:9999";
      document.body.append(canvas);
      const E = window.HoverEngine,
        r = new HoverRenderer(canvas),
        t = E.prepare(window.HOVER_TRACKS[0]),
        c = E.create(t);
      r.resize();
      E.step(c, t, {}, 1 / 60);
      E.emitDebris(c, 64, 2, [0, 1, 0]);
      c.explosionFrames = 32;
      r.draw(t, c, [], "destroyed", 0, {});
      window.fidelity = { r, t, c, canvas, sound: new OriginalSound() };
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const { r, t, c } = window.fidelity;
      r.draw(t, c, [], "destroyed", 0, {});
    });
    let result = await page.evaluate(() => {
      const { r } = window.fidelity;
      return {
        debris: r.ships[0].debris.count,
        bombs: r.ships[0].explosions.filter((s) => s.visible).length,
        retro: r.retroUniform.value,
        errors: r.errors,
      };
    });
    assert.equal(result.debris, 64);
    assert.equal(result.bombs, 4);
    assert.equal(result.retro, 1);
    assert.deepEqual(result.errors, []);
    // Put an opaque plane in front of every world object. Original OT=0
    // explosions must still change the rendered pixels over that plane.
    const overlayPixels = await page.evaluate(async () => {
      const THREE = await import("./vendor/three.module.js");
      const { r } = window.fidelity;
      const target = new THREE.WebGLRenderTarget(320, 240);
      const blocker = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshBasicMaterial({
          color: 0x0000ff,
          side: THREE.DoubleSide,
        }),
      );
      blocker.position
        .copy(r.camera.position)
        .add(r.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(2));
      blocker.quaternion.copy(r.camera.quaternion);
      r.scene.add(blocker);
      const bombs = r.ships[0].explosions;
      const before = new Uint8Array(320 * 240 * 4),
        after = new Uint8Array(before.length);
      r.renderer.setRenderTarget(target);
      r.renderer.autoClear = true;
      bombs.forEach((s) => (s.visible = false));
      r.renderer.render(r.scene, r.camera);
      r.renderer.readRenderTargetPixels(target, 0, 0, 320, 240, before);
      bombs.forEach((s) => (s.visible = true));
      r.renderer.render(r.scene, r.camera);
      r.renderer.readRenderTargetPixels(target, 0, 0, 320, 240, after);
      let changed = 0;
      for (let i = 0; i < after.length; i += 4)
        if (
          after[i] !== before[i] ||
          after[i + 1] !== before[i + 1] ||
          after[i + 2] !== before[i + 2]
        )
          changed++;
      r.renderer.setRenderTarget(null);
      r.scene.remove(blocker);
      blocker.geometry.dispose();
      blocker.material.dispose();
      target.dispose();
      return changed;
    });
    assert.ok(
      overlayPixels > 20,
      `explosion hidden behind opaque geometry: ${overlayPixels}`,
    );
    await page.screenshot({ path: "/tmp/hover-source-retro.png" });
    await page.evaluate(() => {
      const { r, t, c } = window.fidelity;
      c.explosionFrames = 200;
      r.retro = false;
      r.resize();
      r.draw(t, c, [], "destroyed", 1, {});
    });
    assert.equal(
      await page.evaluate(() => window.fidelity.r.ships[0].body.visible),
      false,
    );
    assert.equal(
      await page.evaluate(() => window.fidelity.r.retroUniform.value),
      0,
    );
    await page.evaluate(() => {
      const { r, t, c } = window.fidelity;
      delete c.explosionFrames;
      c.type = 5;
      c.sourceSpeed = 200;
      c.ticks = 30;
      r.draw(t, c, [], "running", 1, {});
      c.ticks = 40;
      r.draw(t, c, [], "running", 1, {});
    });
    assert.equal(
      await page.evaluate(
        () =>
          window.fidelity.r.ships[0].limbs[0].fore.parent ===
          window.fidelity.r.ships[0].limbs[0].arm,
      ),
      true,
    );
    assert.notEqual(
      await page.evaluate(
        () => window.fidelity.r.ships[0].limbs[0].knee.rotation.x,
      ),
      0,
    );
    await page.screenshot({ path: "/tmp/hover-source-suzuki.png" });
    for (const text of ["COMPLETE", "MISS"]) {
      await page.evaluate((text) => {
        const { r, t, c } = window.fidelity;
        r.result = { text, frame: 80 };
        r.draw(t, c, [], "finished", 1, {});
      }, text);
      assert.equal(
        await page.evaluate(
          () =>
            window.fidelity.r.resultLetters.children.filter((x) => x.visible)
              .length,
        ),
        text.length,
      );
      await page.screenshot({
        path: "/tmp/hover-source-" + text.toLowerCase() + ".png",
      });
    }
    // A real browser AudioWorklet must produce signal, release voices, and pause.
    await page.locator("body").click({ position: { x: 1000, y: 850 } });
    await page.evaluate(async () => {
      const f = window.fidelity;
      await f.sound.enable(true);
      f.analyser = f.sound.context.createAnalyser();
      f.sound.master.connect(f.analyser);
      f.sound.playCourse(0);
    });
    await page.waitForTimeout(1000);
    result = await page.evaluate(() => {
      const f = window.fidelity,
        samples = new Float32Array(2048);
      f.analyser.getFloatTimeDomainData(samples);
      return {
        peak: Math.max(...samples.map(Math.abs)),
        notes: f.sound.notesPlayed,
        voices: f.sound.voices.size,
      };
    });
    assert.ok(result.peak > 0.00001, JSON.stringify(result));
    assert.ok(result.notes > 0);
    await page.evaluate(() => {
      const f = window.fidelity;
      f.sound.update({ ...f.c, energy: 5, grip: true, tile: "d" }, {}, true);
    });
    assert.deepEqual(
      await page.evaluate(() =>
        [...window.fidelity.sound.effects.keys()].sort(),
      ),
      [70, 71],
    );
    await page.evaluate(() => {
      const f = window.fidelity;
      f.sound.update({ ...f.c, energy: 100, tile: "." }, {}, false);
    });
    assert.deepEqual(
      await page.evaluate(() => [...window.fidelity.sound.effects.keys()]),
      [],
    );
    // Sustained playback plus thousands of naturally ending effects catches
    // processors that survive source.onended and accumulate audio-thread work.
    await page.evaluate(() => {
      const f = window.fidelity;
      f.effectStress = setInterval(() => {
        for (let i = 0; i < 8; i++) f.sound.effect(67, 80);
      }, 100);
    });
    const peaks = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(10000);
      const snapshot = await page.evaluate(() => {
        const f = window.fidelity,
          samples = new Float32Array(2048);
        f.analyser.getFloatTimeDomainData(samples);
        return {
          peak: Math.max(...samples.map(Math.abs)),
          voices: f.sound.voices.size,
          notes: f.sound.notesPlayed,
        };
      });
      peaks.push(snapshot);
      assert.ok(snapshot.peak > 0.00001, JSON.stringify(snapshot));
      assert.ok(snapshot.voices < 100, JSON.stringify(snapshot));
    }
    await page.evaluate(() => clearInterval(window.fidelity.effectStress));
    console.log(
      "60-second audio stress (4800 effects):",
      JSON.stringify(peaks),
    );
    await page.evaluate(async () => {
      await window.fidelity.sound.context.suspend();
    });
    const time = await page.evaluate(
      () => window.fidelity.sound.context.currentTime,
    );
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => window.fidelity.sound.context.currentTime),
      time,
    );
    await page.evaluate(async () => {
      const f = window.fidelity;
      f.sound.cancel();
      clearInterval(f.sound.timer);
      await f.sound.context.close();
    });
    await page.evaluate(() => window.fidelity.canvas.remove());
    await page.selectOption("#mode", "train0");
    await page.evaluate(() => {
      window.HoverTraining.step = (session) => {
        session.status = "complete";
        session.reason = "test";
      };
    });
    await page.click("#start");
    await page.waitForFunction(
      () => window.hoverDiagnostics().state === "finished",
    );
    assert.equal(await page.locator("#result").isVisible(), false);
    await page.waitForFunction(() => !document.querySelector("#result").hidden);
    assert.equal(await page.locator("#result-title").textContent(), "COMPLETE");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real Chromium RETRO/HD shader compilation, 64 debris particles, bomb visibility, articulated Suzuki, audible AudioWorklet output, warning/damage key-on/off, audio pause; no console/page errors",
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
