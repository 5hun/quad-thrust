import type {} from "./types";
const assert: typeof import("node:assert/strict") = require("node:assert/strict"),
  fs = require("node:fs") as typeof import("node:fs"),
  E = require("../dist/engine.js") as typeof HoverEngine;
const fixture = E.prepare({
  name: "oracle",
  theme: 0,
  samples: [
    {
      l: [0, 0, 0],
      r: [20, 0, 0],
      tiles: "....",
      allTiles: "........",
      end: { l: [0, 0, 100], r: [20, 0, 100] },
    },
  ],
});
const cases = JSON.parse(fs.readFileSync(0, "utf8")) as [number[], number[]][];
for (const [v, expected] of cases) {
  const car: Car = {
    ...E.create(fixture),
    cpuSlot: v[1],
    grip: !!v[2],
    cpuLevel: v[3],
    damage: v[4],
    ticks: v[6],
  };
  const floorBrake = E.sourceContinuousTile(car, String.fromCharCode(v[0]));
  assert.deepEqual(
    [car.damage, +car.damageLight!, +car.damageSemi!, +floorBrake],
    expected.slice(0, 4),
    `original tile ${v}`,
  );
  assert.equal(car.damageFloorActive, v[0] === 100 && v[1] === 0 && !!v[2]);
  // The oracle starts with no damage voice: the desired active flag must
  // match whether the original calls key-on before gravity updates grip.
  assert.equal(+car.damageFloorActive, expected[5]);
  assert.equal(expected[4], car.damageFloorActive ? 7 : -1);
}
console.log(
  `PASS: continuous floor damage, brakes and material flags with pre-gravity grip (${cases.length} cases)`,
);
