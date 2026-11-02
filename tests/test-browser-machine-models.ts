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
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const originalModels = [
      "XVN_CAR",
      "XVP_CAR",
      "SVS_CAR",
      "JUSTER",
      "XXX_CAR",
    ];
    for (const query of [
      "",
      "classicmachines",
      "classictrack&classiccourses",
      "classicmachines&classictrack&classiccourses",
      "classicmachines=false",
      "",
    ]) {
      const url = new URL(baseURL);
      url.search = query;
      await page.goto(url.href);
      await page.waitForFunction(
        () => window.hoverDiagnostics?.().state === "menu",
      );
      const classic = new URLSearchParams(query).has("classicmachines");
      const expected = classic
        ? originalModels
        : ["QUAD_01", ...originalModels.slice(1)];
      assert.equal(
        await page.evaluate(() => window.hoverDiagnostics().machineAppearance),
        classic ? "classic" : "modern",
      );
      const result = await page.evaluate(async () => {
        const { HoverRenderer } = (await import(
          "./renderer.js" as string
        )) as typeof import("../src/renderer");
        const r = new HoverRenderer(document.createElement("canvas"));
        const ships = window.HoverEngine.MACHINES.map((_, type) =>
          r.makeShip(type),
        );
        const ghost = r.makeShip(0, true);
        const menu = r.getMenuShip(0);
        const first = ships[0];
        const result = {
          models: ships.map((ship) => ship.model),
          ghost: ghost.model,
          menu: menu.model,
          hull: first.hull.name,
          rudderX: first.rudders[0].position.x,
          engineModel: window.HoverEngine.MACHINES[0].model,
          engineName: window.HoverEngine.MACHINES[0].name,
          modernSurface: !!r.courseSurface,
          classicCourses: !!document.querySelector(
            'script[src="tracks-classic.js"]',
          ),
        };
        for (const ship of [...ships, ghost, menu]) {
          r.scene.remove(ship.root, ship.shadow!);
          r.clear(ship.root);
          r.clear(ship.shadow!);
        }
        r.renderer.dispose();
        return result;
      });
      assert.deepEqual(result.models, expected, query);
      assert.equal(result.ghost, expected[0], "ghost follows model option");
      assert.equal(
        result.menu,
        expected[0],
        "selection preview follows model option",
      );
      assert.equal(result.hull.startsWith("quad-01"), !classic);
      assert.equal(
        result.rudderX,
        classic ? -0.56 : -0.76,
        "correct model mount positions",
      );
      assert.equal(
        result.engineModel,
        "QUAD_01",
        "display switch does not mutate machine data",
      );
      assert.equal(result.engineName, "WHITE HARE", "name remains unchanged");
      assert.equal(
        result.modernSurface,
        !new URLSearchParams(query).has("classictrack"),
      );
      assert.equal(
        result.classicCourses,
        new URLSearchParams(query).has("classiccourses"),
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: default/classic machine models, preview/ghost/mounts, independent course flags, presence semantics and reset; no page errors",
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
