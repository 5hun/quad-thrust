import type {} from "./types";
const E = require("../dist/engine.js") as typeof HoverEngine,
  vm = require("node:vm") as typeof import("node:vm"),
  fs = require("node:fs") as typeof import("node:fs"),
  assert: typeof import("node:assert/strict") = require("node:assert/strict");
const trackContext = { window: {} as Window };
vm.runInNewContext(
  fs.readFileSync(__dirname + "/../dist/tracks.js", "utf8"),
  trackContext,
);

// Tidal Ring's return bridge must cross the wide S-bend exactly once.
// Check the generated mesh rather than the ideal authoring coordinates.
const tidal = E.prepare(trackContext.window.HOVER_TRACKS[2]);
assert.equal(tidal.name, "Tidal Ring");
const classic = { window: {} as Window };
vm.runInNewContext(
  fs.readFileSync(__dirname + "/../dist/tracks-classic.js", "utf8"),
  classic,
);
assert.equal(classic.window.HOVER_TRACKS[2].name, "Ice Gate");
assert.equal(tidal.theme, classic.window.HOVER_TRACKS[2].theme);
const crossings: { x: number; z: number; lower: number; upper: number }[] = [];
const cross = (ax: number, az: number, bx: number, bz: number) =>
  ax * bz - az * bx;
for (let i = 0; i < tidal.nodes.length; i++) {
  const a = tidal.nodes[i],
    b = a.end!;
  for (let j = i + 2; j < tidal.nodes.length; j++) {
    const c = tidal.nodes[j],
      d = c.end!,
      vx = b.x - a.x,
      vz = b.z - a.z,
      wx = d.x - c.x,
      wz = d.z - c.z,
      det = cross(vx, vz, wx, wz);
    if (Math.abs(det) < 1e-8) continue;
    const t = cross(c.x - a.x, c.z - a.z, wx, wz) / det,
      u = cross(c.x - a.x, c.z - a.z, vx, vz) / det;
    if (t <= 0 || t >= 1 || u <= 0 || u >= 1) continue;
    const ay = E.mix(a.y, b.y, t),
      cy = E.mix(c.y, d.y, u);
    crossings.push({
      x: a.x + vx * t,
      z: a.z + vz * t,
      lower: ay < cy ? i : j,
      upper: ay < cy ? j : i,
    });
  }
}
assert.equal(crossings.length, 1, "one intentional bridge crossing");
const junction = crossings[0],
  lower = E.nearest(tidal, junction.x, junction.z, junction.lower),
  upper = E.nearest(tidal, junction.x, junction.z, junction.upper);
assert.equal(lower.index, junction.lower, "stay on the road under the bridge");
assert.equal(
  upper.index,
  junction.upper,
  "stay on the bridge above the S-bend",
);
assert.ok(lower.supported && upper.supported);
assert.ok(
  upper.surface - lower.surface > 60,
  "clear walls and bridge underside",
);
assert.ok(lower.width > 90, "wide S-bend below the bridge");
assert.ok(upper.width < 50, "narrow bridge above the S-bend");
assert.ok(
  tidal.nodes.some(
    (p) =>
      p.width > 90 &&
      Math.atan2(p.l[1] - p.r[1], p.width) >= (24 * Math.PI) / 180,
  ),
  "wide right corner banks at least 24 degrees with its outside edge higher",
);
for (const p of tidal.nodes.filter((p) => p.l[1] - p.r[1] > 0.1)) {
  for (const edge of [p, p.end!]) {
    assert.equal(edge.r[1], 0, "bank's inside edge stays at approach height");
    assert.ok(edge.l[1] >= 0, "bank only lifts the outside edge");
  }
  assert.ok(
    Math.abs(p.end!.l[1] - p.l[1]) / p.len < 0.18,
    "bank entry and exit change gradually along the road",
  );
}
assert.ok(
  tidal.nodes.some(
    (p) =>
      p.tiles.includes(">") &&
      p.distance < upper.distance &&
      upper.distance - p.distance < 600 &&
      p.end!.y > p.y,
  ),
  "boost on the climb before the bridge",
);
let climbStart = tidal.nodes.findIndex(
  (p) => p.tiles.includes(">") && p.end!.y > p.y,
);
assert.ok(climbStart > 0);
while (tidal.nodes[climbStart].y > 0) climbStart--;
let continuousTurn = 0;
for (let i = climbStart; i > 0; i--) {
  const turn = E.angle(tidal.nodes[i].heading - tidal.nodes[i - 1].heading);
  if (turn >= -0.001) break;
  continuousTurn -= turn;
}
assert.ok(
  continuousTurn > (210 * Math.PI) / 180,
  "one continuous hairpin feeds directly into the bridge climb",
);
assert.ok(
  tidal.nodes.some((p) => /^P+$/.test(p.tiles)),
  "full-width repair row",
);
const repairIndex = tidal.nodes.findIndex((p) => p.tiles.includes("P")),
  repair = tidal.nodes[repairIndex];
assert.equal(repair.y, 0, "repair follows the bridge descent at ground level");
for (const index of [repairIndex - 1, repairIndex]) {
  assert.ok(
    E.angle(tidal.nodes[index + 1].heading - tidal.nodes[index].heading) > 0.03,
    "repair is inside the final right corner",
  );
}
assert.ok(tidal.nodes.every((p) => !/[Jd*]/.test(p.tiles)));
console.log(
  "PASS: Tidal Ring crossing clearance, road selection, widths and panels",
);
