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
    type: v[0],
    sourceSpeed: v[1],
    front: v.slice(4, 7),
    rear: v.slice(7, 10),
  };
  E.sourceResistance(car, !!v[2], !!v[3]);
  assert.deepEqual(
    [...car.front, ...car.rear],
    expected,
    `original resistance ${v}`,
  );
}
console.log(
  `PASS: integer drag, both brakes, vertical exemption and overflow sign tests (${cases.length} cases)`,
);
