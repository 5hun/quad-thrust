const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  E = require("../dist/engine.js");
const cases = JSON.parse(fs.readFileSync(0, "utf8"));
for (const [v, expected] of cases) {
  const car = {
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
