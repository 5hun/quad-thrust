import type {} from "./types";
/* global window, document */
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
// The caller may override the development Playwright and Chromium paths.
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
    page.on("console", (m) => {
      // The local HTTP fixture has no favicon; keep game resource errors strict.
      if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico"))
        errors.push(m.text());
    });
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
    await page.waitForFunction(
      () => window.hoverDiagnostics?.().menuScreen === "title",
    );
    await page.evaluate(async () => {
      const { HoverRenderer } = (await import(
        "./renderer.js" as string
      )) as typeof import("../src/renderer");
      const { OriginalSound } = (await import(
        "./sound.js" as string
      )) as typeof import("../src/sound");
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
    const result = await page.evaluate(() => {
      const { r } = window.fidelity;
      return {
        debris: r.ships[0].debris.count,
        chipVertices: Array.from(
          r.ships[0].debris.geometry.attributes.position.array,
          (v) => Math.round(v * 100),
        ),
        sourceFov: r.camera.fov,
        bombs: r.ships[0].explosions.filter((s) => s.visible).length,
        width: r.canvas.width,
        height: r.canvas.height,
        errors: r.errors,
      };
    });
    const storedMatrices = await page.evaluate(() => {
      const { r, t, c } = window.fidelity;
      const pose = {
        ...c,
        type: 0,
        x: 10,
        y: 2,
        z: 20,
        groundY: 0,
        sourceMatrix: [4096, 0, 64, 0, 4096, 0, -64, 0, 4095],
        sourceShadowMatrix: [4096, 0, 0, 0, 0, -4096, 0, 4096, 0],
      };
      r.draw(t, pose, [], "running", 0, {});
      const ship = r.ships[0];
      const body = ship.body.matrixWorld.toArray(),
        shadow = ship.shadow!.matrixWorld.toArray();
      const flags = [ship.body.matrixAutoUpdate, ship.shadow!.matrixAutoUpdate];
      pose.x = 14;
      r.draw(t, pose, [], "running", 0, {});
      const shadowX = ship.shadow!.matrixWorld.elements[12];
      r.draw(
        t,
        { ...c, sourceMatrix: undefined, sourceShadowMatrix: undefined },
        [],
        "running",
        0,
        {},
      );
      const fallback = [
        ship.body.matrixAutoUpdate,
        ship.shadow!.matrixAutoUpdate,
      ];
      r.draw(t, c, [], "destroyed", 0, {});
      return { body, shadow, flags, shadowX, fallback };
    });
    assert.deepEqual(
      storedMatrices.body,
      [
        1,
        0,
        64 / 4096,
        0,
        0,
        1,
        0,
        0,
        -64 / 4096,
        0,
        4095 / 4096,
        0,
        10,
        2,
        -20,
        1,
      ],
      "render saved matrix without quaternion normalization",
    );
    assert.deepEqual(
      storedMatrices.shadow,
      [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 10, 0.06, -20, 1],
      "shadow follows its independent saved attitude",
    );
    assert.deepEqual(storedMatrices.flags, [false, false]);
    assert.equal(
      storedMatrices.shadowX,
      14,
      "manually managed shadow matrices keep moving",
    );
    assert.deepEqual(storedMatrices.fallback, [true, true]);
    assert.equal(result.debris, 64);
    assert.deepEqual(result.chipVertices, [0, -15, 0, -10, 10, 0, 10, 10, 0]);
    assert.ok(
      Math.abs(result.sourceFov - (2 * Math.atan(120 / 320) * 180) / Math.PI) <
        1e-10,
    );
    assert.equal(result.bombs, 4);
    assert.equal(result.width, 640);
    assert.equal(result.height, 480);
    assert.deepEqual(result.errors, []);
    const widescreen = await page.evaluate(() => {
      const { r, t, c, canvas } = window.fidelity;
      const gl = r.renderer.getContext();
      const samples = [];
      let original: Uint8Array | null = null;
      const originalFov = r.camera.fov;
      r.holdCamera = true;
      for (const width of [960, 1280, 1680, 2560]) {
        canvas.style.width = `${width}px`;
        canvas.style.height = "720px";
        r.resize();
        r.draw(t, c, [], "destroyed", 0, {});
        const pixels = new Uint8Array(960 * 720 * 4);
        gl.readPixels(
          (width - 960) / 2,
          0,
          960,
          720,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        let changed = 0;
        if (original) {
          for (let i = 0; i < pixels.length; i += 4)
            if (
              [0, 1, 2].some(
                (channel) =>
                  Math.abs(pixels[i + channel] - original![i + channel]) > 4,
              )
            )
              changed++;
        } else original = pixels;
        samples.push({
          width,
          changed,
          fov: r.camera.fov,
          countAspect: r.countCamera.aspect,
          menuAspect: r.menuCamera.aspect,
        });
      }
      const coverage = [];
      for (let theme = 0; theme < 5; theme++) {
        for (const yaw of [-2.8, 0, 2.8]) {
          r.camera.rotation.set(0, yaw, 0);
          r.background.draw(r.renderer, r.camera, theme, 0);
          const b = r.background;
          const sky = b.sky.filter((mesh) => mesh.visible);
          const ground = b.ground[0].filter((mesh) => mesh.visible);
          coverage.push({
            skyLeft: Math.min(
              ...sky.map((mesh) => mesh.geometry.attributes.position.getX(0)),
            ),
            skyRight: Math.max(
              ...sky.map((mesh) => mesh.geometry.attributes.position.getX(1)),
            ),
            groundLeft: Math.min(
              ...ground.map((mesh) =>
                mesh.geometry.attributes.position.getX(0),
              ),
            ),
            groundRight: Math.max(
              ...ground.map((mesh) =>
                mesh.geometry.attributes.position.getX(1),
              ),
            ),
            left: b.camera.left,
            right: b.camera.right,
          });
        }
      }
      canvas.style.width = "7680px";
      canvas.style.height = "2160px";
      r.resize();
      const capped = { width: canvas.width, height: canvas.height };
      canvas.style.width = "640px";
      canvas.style.height = "480px";
      r.resize();
      r.holdCamera = false;
      r.draw(t, c, [], "destroyed", 0, {});
      return { samples, coverage, originalFov, capped };
    });
    for (const sample of widescreen.samples) {
      assert.equal(sample.fov, widescreen.originalFov);
      assert.equal(sample.countAspect, sample.width / 720);
      assert.equal(sample.menuAspect, sample.width / 720);
      assert.ok(
        sample.changed < 960 * 720 * 0.005,
        `center crop preserved at ${sample.width}px: ${sample.changed} changed pixels`,
      );
    }
    for (const coverage of widescreen.coverage) {
      assert.ok(
        coverage.skyLeft <= coverage.left &&
          coverage.skyRight >= coverage.right,
        "sky covers wide viewport for every theme and yaw",
      );
      assert.ok(
        coverage.groundLeft <= coverage.left &&
          coverage.groundRight >= coverage.right,
        "ground covers wide viewport for every theme and yaw",
      );
    }
    assert.ok(
      widescreen.capped.width * widescreen.capped.height <= 3840 * 1080,
    );
    assert.ok(widescreen.capped.height <= 1080);
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
    // Test actual GPU output: the source reciprocal depth curve starts at
    // 76.8 units in CITY and reaches full depth cue at 384, in HD.
    const depthPixels = await page.evaluate(async () => {
      const THREE = await import("./vendor/three.module.js");
      const { r } = window.fidelity;
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x202020);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
      const texture = new THREE.DataTexture(
        new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]),
        2,
        1,
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      const mat = new THREE.MeshBasicMaterial({ map: texture });
      r.sourceMaterial(mat);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), mat);
      scene.add(plane);
      const values = [];
      r.renderer.setRenderTarget(null);
      r.renderer.setSize(16, 16, false);
      const gl = r.renderer.getContext();
      for (const depth of [50, 96, 192, 384]) {
        plane.position.z = -depth;
        r.renderer.render(scene, camera);
        const white = new Uint8Array(4),
          black = new Uint8Array(4);
        gl.readPixels(2, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, white);
        gl.readPixels(13, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, black);
        values.push({ depth, white: white[0], black: black[0] });
      }
      mat.userData.sourceUnlit.value = 1;
      r.renderer.render(scene, camera);
      const unlit = new Uint8Array(4);
      gl.readPixels(2, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, unlit);
      values.push({ depth: 384, white: unlit[0], black: 0 });
      r.resize();
      plane.geometry.dispose();
      mat.dispose();
      texture.dispose();
      return values;
    });
    assert.equal(
      depthPixels.at(-1)!.white,
      255,
      "unlit damage attribute bypasses depth cueing",
    );
    {
      const pixels = depthPixels.slice(0, -1);
      assert.ok(pixels[0].white > 245, JSON.stringify(pixels));
      assert.ok(
        pixels[1].white > pixels[2].white && pixels[2].white > pixels[3].white,
        JSON.stringify(pixels),
      );
      assert.ok(Math.abs(pixels[3].white - 64) < 6, JSON.stringify(pixels));
      assert.ok(
        pixels.every((p) => p.black === 0),
        "depth cue must preserve texture contrast",
      );
    }
    const themes = await page.evaluate(() => {
      const { r, t } = window.fidelity;
      const values = [];
      for (let theme = 0; theme < 5; theme++) {
        r.setTrack({ ...t, theme });
        values.push({
          fog: !!r.scene.fog,
          ambient: r.ambient.color.toArray(),
          light: r.sunlight.color.toArray(),
        });
      }
      r.setTrack(t);
      return values;
    });
    assert.deepEqual(
      themes.map((t) => t.fog),
      [true, false, true, true, true],
    );
    assert.deepEqual(themes[2].ambient, [0.375, 0.375, 0.375]);
    assert.deepEqual(themes[4].ambient, [0.4375, 0.375, 0.375]);
    assert.deepEqual(themes[4].light, [90 / 255, 60 / 255, 60 / 255]);
    const ghostHull = await page.evaluate(() => {
      const { r, c } = window.fidelity;
      const ghost = r.makeShip(0, true);
      r.updateShip(ghost, { ...c, explosionFrames: undefined }, {}, 0);
      const hull = (
        ghost.hull!.children[0] as import("three").Mesh<
          import("three").BufferGeometry,
          import("three").MeshBasicMaterial
        >
      ).material;
      const rudder = (
        ghost.rudders[0].children[0] as import("three").Mesh<
          import("three").BufferGeometry,
          import("three").MeshBasicMaterial
        >
      ).material;
      const result = {
        color: hull.color.getHex(),
        opacity: hull.opacity,
        rudder: rudder.opacity,
      };
      r.scene.remove(ghost.root, ghost.shadow!);
      r.clear(ghost.root);
      r.clear(ghost.shadow!);
      return result;
    });
    assert.deepEqual(
      ghostHull,
      { color: 0xffffff, opacity: 0.5, rudder: 1 },
      "source ghost changes hull blend only",
    );
    const bombLifetime = await page.evaluate(() => {
      const { r, c } = window.fidelity;
      return [235, 236, 299].map((explosionFrames) => {
        r.updateShip(r.ships[0], { ...c, explosionFrames }, {}, 0);
        return r.ships[0].explosions.filter((s) => s.visible).length;
      });
    });
    assert.deepEqual(
      bombLifetime,
      [4, 0, 0],
      "bomb sprites stop when source over <= 64",
    );
    const damageDisplay = await page.evaluate(() => {
      const { r, c } = window.fidelity;
      const ship = r.ships[0];
      delete c.explosionFrames;
      const material = (
        ship.hull!.children[0] as import("three").Mesh<
          import("three").BufferGeometry,
          import("three").MeshBasicMaterial
        >
      ).material;
      const result = [];
      for (const p of [
        { ticks: 2, damageLight: true, damageSemi: true, energy: 100 },
        { ticks: 3, damageLight: true, damageSemi: false, energy: 100 },
        { ticks: 8, damageLight: false, damageSemi: false, energy: 5 },
        { ticks: 9, damageLight: false, damageSemi: false, energy: 5 },
        { ticks: 16, damageLight: false, damageSemi: false, energy: 100 },
        {
          ticks: 16,
          damageLight: false,
          damageSemi: false,
          energy: 5,
          warningActive: false,
        },
        {
          ticks: 16,
          damageLight: true,
          damageSemi: true,
          energy: 5,
          warningActive: false,
        },
      ]) {
        r.updateShip(ship, { ...c, warningActive: undefined, ...p }, {}, 0);
        result.push([material.userData.sourceUnlit.value, material.opacity]);
      }
      const tail = [];
      for (const slot of [0, 1, 2, 3]) {
        r.updateShip(
          ship,
          { ...c, ticks: 2, cpuSlot: slot, fireTail: 32 },
          {},
          0,
        );
        tail.push(ship.flames[0].visible);
      }
      return { result, tail };
    });
    assert.deepEqual(damageDisplay.result, [
      [1, 0.5],
      [1, 1],
      [1, 1],
      [0, 1],
      [0, 1],
      [0, 1],
      [1, 0.5],
    ]);
    assert.deepEqual(
      damageDisplay.tail,
      [true, true, true, true],
      "rear jets draw every tick in every CPU slot",
    );
    const turboFlame = await page.evaluate(() => {
      const { r, c } = window.fidelity,
        ship = r.ships[0];
      return [false, true, false].map((turbo) => {
        r.updateShip(ship, { ...c, turbo, ticks: 2 }, { accel: true }, 0);
        const mat = (
          ship.flames[0].children[0] as import("three").Mesh<
            import("three").BufferGeometry,
            import("three").MeshBasicMaterial
          >
        ).material;
        return [
          mat.opacity,
          mat.transparent,
          mat.userData.sourceUnlit.value,
          mat.userData.sourceCameraLight.value,
        ];
      });
    });
    assert.deepEqual(
      turboFlame,
      [
        [1, false, 0, 1],
        [1, false, 1, 1],
        [1, false, 0, 1],
      ],
      "turbo disables flame lighting without changing blend mode",
    );
    // CAR_CTR.C uses TMD object 2. Its three nested blue shells have
    // single-sided packets (flag=0); drawing their backs hides the inner colours.
    const jetColours = await page.evaluate(async () => {
      const THREE = await import("./vendor/three.module.js");
      const { r, c } = window.fidelity;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 13);
      camera.lookAt(0, 0, 2);
      const target = new THREE.WebGLRenderTarget(256, 256);
      const pixels = new Uint8Array(256 * 256 * 4);
      const results: { type: number; turbo: boolean; bands: number[] }[] = [];
      r.renderer.setRenderTarget(target);
      for (let type = 0; type < 5; type++) {
        const ship = r.makeShip(type);
        for (const turbo of [false, true]) {
          r.updateShip(
            ship,
            { ...c, type, turbo, ticks: 2 },
            { accel: true },
            0,
          );
          const flame = ship.flames[0];
          flame.position.set(0, 0, 0);
          scene.add(flame);
          r.renderer.render(scene, camera);
          r.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels);
          const bands = [0, 0, 0];
          for (let i = 0; i < pixels.length; i += 4) {
            const red = pixels[i],
              blue = pixels[i + 2];
            if (blue > 0) bands[red / blue > 0.4 ? 0 : red > 0 ? 1 : 2]++;
          }
          results.push({ type, turbo, bands });
          ship.body.add(flame);
        }
        r.clear(ship.root);
      }
      r.renderer.setRenderTarget(null);
      target.dispose();
      return results;
    });
    for (const { type, turbo, bands } of jetColours)
      assert.ok(
        bands.every((count) => count > 20),
        `machine ${type}, turbo=${turbo}: all three jet colours visible (${bands})`,
      );
    const replayView = await page.evaluate(async () => {
      const { ReplayDirector } = (await import(
        "./replay.js" as string
      )) as typeof import("../src/replay");
      const { r, t, c } = window.fidelity;
      r.replayView = true;
      r.replayDirector = new ReplayDirector(() => 0);
      r.updateCamera(c);
      r.draw(t, c, [], "finished", 0, {});
      const before = r.camera.position.toArray();
      c.x += 2;
      r.updateCamera(c);
      r.draw(t, c, [], "finished", 0, {});
      const after = r.camera.position.toArray();
      c.x -= 2;
      r.replayDirector = new ReplayDirector(() => 0.75);
      for (let i = 0; i < 240; i++) r.updateCamera(c);
      r.draw(t, c, [], "finished", 0, {});
      const frontZ = r.camera.position.z + c.z;
      r.replayView = false;
      r.updateCamera(c);
      return { before, after, frontZ };
    });
    assert.deepEqual(replayView.before, replayView.after);
    assert.ok(
      replayView.frontZ < 0,
      "front chase camera must look back toward the ship",
    );
    const startView = await page.evaluate(() => {
      const { r, t, c } = window.fidelity;
      c.explosionFrames = 32;
      c.heading = 0;
      r.follow = { yaw: 0, pitch: 0, roll: 0, distance: 0 };
      r.yaw = 0;
      r.countdown = 300;
      r.draw(t, c, [], "countdown", 0, {});
      const start = r.camera.position.clone();
      r.countdown = null;
      r.draw(t, c, [], "running", 0, {});
      const distance = start.distanceTo(r.camera.position);
      r.updateCamera(c, 300);
      const startYaw = r.follow.yaw;
      r.follow.yaw = 0;
      r.updateCamera(c, 120);
      return { distance, startYaw, raceYaw: r.follow.yaw };
    });
    assert.ok(
      Math.abs(startView.distance - 300) < 1e-9,
      "start_count*100 along rotated camera axis",
    );
    assert.ok(Math.abs(startView.startYaw - (90 * Math.PI * 2) / 4096) < 1e-10);
    assert.equal(startView.raceYaw, 0);
    const redOcclusions = await page.evaluate(async () => {
      const THREE = await import("./vendor/three.module.js");
      const { r, t } = window.fidelity,
        E = window.HoverEngine;
      const red = E.prepare(window.HOVER_TRACKS[6]);
      const car = E.placeOnGrid(E.create(red), red);
      r.setTrack(red);
      r.replayView = r.finishCamera = r.holdCamera = false;
      r.countdown = null;
      let samples = 0,
        occlusions = 0;
      for (let frame = 0; frame < 3600; frame++) {
        E.step(car, red, E.drive(car, red), 1 / 60, true);
        if (car.finished) throw Error("RED GP camera fixture fell off");
        r.updateCamera(car);
        if (frame % 30) continue;
        r.draw(red, car, [], "running", frame / 60, {});
        const target = new THREE.Vector3(car.x, car.y, -car.z);
        const direction = target.sub(r.camera.position);
        const length = direction.length();
        const ray = new THREE.Raycaster(
          r.camera.position,
          direction.normalize(),
          0.15,
          length - 2,
        );
        occlusions += +(ray.intersectObject(r.trackGroup, true).length > 0);
        samples++;
      }
      r.setTrack(t);
      r.yaw = 0;
      return { samples, occlusions };
    });
    assert.deepEqual(
      redOcclusions,
      { samples: 120, occlusions: 0 },
      "RED GP opening: no course face between camera and ship",
    );
    const matrixView = await page.evaluate(() => {
      const { r, t, c } = window.fidelity;
      r.countdown = null;
      r.replayView = r.finishCamera = r.holdCamera = false;
      r.follow = { yaw: 0, pitch: 0, roll: 0, distance: 0 };
      r.draw(t, c, [], "running", 0, {});
      const neutral = [
        r.camera.position.x - c.x,
        r.camera.position.y - c.y,
        r.camera.position.z + c.z,
      ];
      r.follow = {
        yaw: 0,
        pitch: (Math.trunc((4096 * 7) / 360) * Math.PI * 2) / 4096,
        roll: Math.PI / 2,
        distance: 0,
      };
      r.draw(t, c, [], "running", 0, {});
      const bank = [
        r.camera.position.x - c.x,
        r.camera.position.y - c.y,
        r.camera.position.z + c.z,
      ];
      r.follow = { yaw: 0, pitch: 0, roll: 0, distance: 0 };
      return { neutral, bank };
    });
    const depression = (Math.trunc((4096 * 7) / 360) * Math.PI * 2) / 4096;
    const expected = [
      0,
      8.5 * Math.cos(depression) + 35 * Math.sin(depression),
      35 * Math.cos(depression) - 8.5 * Math.sin(depression),
    ];
    expected.forEach((v, i) =>
      assert.ok(Math.abs(matrixView.neutral[i] - v) < 1e-9),
    );
    [-8.5, 0, 35].forEach((v, i) =>
      assert.ok(
        Math.abs(matrixView.bank[i] - v) < 1e-9,
        "camera translation rotates with bank",
      ),
    );
    await page.evaluate(() => {
      const { r, t, c } = window.fidelity;
      c.explosionFrames = 200;
      r.resize();
      r.draw(t, c, [], "destroyed", 1, {});
    });
    assert.equal(
      await page.evaluate(() => window.fidelity.r.ships[0].body.visible),
      false,
    );
    // A real browser AudioWorklet must produce signal, release voices, and pause.
    await page.mouse.click(5, 5);
    await page.evaluate(async () => {
      const f = window.fidelity;
      await f.sound.enable(true);
      f.analyser = f.sound.context!.createAnalyser();
      f.sound.master.connect(f.analyser);
      f.sound.playCourse(0);
    });
    await page.evaluate(() => {
      const f = window.fidelity;
      f.sound.update(
        { ...f.c, type: 0, energy: 100, sourceSpeed: 320, turbo: false },
        { l1: true },
        true,
      );
    });
    await page.waitForTimeout(300);
    const stereo = await page.evaluate(() =>
      window.fidelity.sound.loops.map(({ name, gain, pan }) => {
        const angle = ((pan.pan.value + 1) * Math.PI) / 4;
        return {
          name,
          left: gain.gain.value * Math.cos(angle) * 127,
          right: gain.gain.value * Math.sin(angle) * 127,
        };
      }),
    );
    for (const [name, left, right] of [
      ["wind", 10, 10],
      ["left", 40, 10],
      ["right", 0, 0],
      ["rear", 0, 0],
    ] as const) {
      const loop = stereo.find((x) => x.name === name);
      assert.ok(
        Math.abs(loop!.left - left) < 0.01 &&
          Math.abs(loop!.right - right) < 0.01,
        JSON.stringify(loop),
      );
    }
    await page.evaluate(() => {
      const f = window.fidelity;
      f.sound.update(
        { ...f.c, energy: 100, sourceSpeed: 640 },
        { accel: true, l1: true },
        false,
        true,
      );
    });
    await page.waitForTimeout(300);
    const fallingLevels = await page.evaluate(() =>
      window.fidelity.sound.loops.map(
        ({ name, gain }) => [name, gain.gain.value] as const,
      ),
    );
    for (const [name, volume] of fallingLevels)
      assert.ok(
        Math.abs(volume - (name === "wind" ? (Math.SQRT2 * 20) / 127 : 0)) <
          0.0001,
        "falling keeps wind, releases boosters: " + name,
      );
    await page.waitForTimeout(1000);
    const audioResult = await page.evaluate(() => {
      const f = window.fidelity,
        samples = new Float32Array(2048);
      f.analyser!.getFloatTimeDomainData(samples);
      return {
        peak: Math.max(...samples.map(Math.abs)),
        notes: f.sound.notesPlayed,
        voices: f.sound.voices.size,
      };
    });
    assert.ok(audioResult.peak > 0.00001, JSON.stringify(result));
    assert.ok(audioResult.notes > 0);
    await page.evaluate(() => {
      const f = window.fidelity;
      f.sound.update(
        { ...f.c, energy: 5, grip: true, tile: "d", damageFloorActive: true },
        {},
        true,
      );
    });
    assert.deepEqual(
      await page.evaluate(() =>
        [...window.fidelity.sound.effects.keys()].sort(),
      ),
      [70, 71],
    );
    // Falling stops the warning, but frozen-cell damage audio follows the
    // pre-gravity floor decision even when the visible car is off the road.
    await page.evaluate(() => {
      const f = window.fidelity;
      f.sound.update(
        {
          ...f.c,
          energy: 5,
          grip: false,
          tile: "outside",
          damageFloorActive: true,
        },
        {},
        false,
        true,
      );
    });
    assert.deepEqual(
      await page.evaluate(() => [...window.fidelity.sound.effects.keys()]),
      [71],
    );
    await page.evaluate(() => {
      const f = window.fidelity;
      f.sound.update(
        { ...f.c, energy: 5, grip: true, tile: "d", damageFloorActive: false },
        {},
        false,
        true,
      );
    });
    assert.deepEqual(
      await page.evaluate(() => [...window.fidelity.sound.effects.keys()]),
      [],
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
      f.effectStress = window.setInterval(() => {
        for (let i = 0; i < 8; i++) f.sound.effect(67, 80);
      }, 100);
    });
    const peaks = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(10000);
      const snapshot = await page.evaluate(() => {
        const f = window.fidelity,
          samples = new Float32Array(2048);
        f.analyser!.getFloatTimeDomainData(samples);
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
      await window.fidelity.sound.context!.suspend();
    });
    const time = await page.evaluate(
      () => window.fidelity.sound.context!.currentTime,
    );
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => window.fidelity.sound.context!.currentTime),
      time,
    );
    await page.evaluate(async () => {
      const f = window.fidelity;
      f.sound.cancel();
      clearInterval(f.sound.timer);
      await f.sound.context!.close();
    });
    await page.evaluate(() => window.fidelity.canvas.remove());
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real Chromium HD depth pixels, five source lighting themes, damage/ghost materials, exhaust phases, 64 debris particles, bomb lifetime/overlay, AudioWorklet stereo levels, warning/damage key-on/off, audio pause; no console/page errors",
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
