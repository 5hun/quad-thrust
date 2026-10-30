const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  E = require("../dist/engine.js");
const cases = JSON.parse(fs.readFileSync(0, "utf8"));
for (const [v, expected] of cases) {
  const car = {
    cpuSlot: v[1],
    grip: !!v[2],
    cpuLevel: v[3],
    damage: v[4],
    ticks: v[6],
  };
  const floorBrake = E.sourceContinuousTile(car, String.fromCharCode(v[0]));
  assert.deepEqual(
    [car.damage, +car.damageLight, +car.damageSemi, +floorBrake],
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
