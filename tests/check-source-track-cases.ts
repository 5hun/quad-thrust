import type {} from "./types";
// Invoked by tools/verify_track_geometry.py with original-C oracle results.
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const fs = require("node:fs") as typeof import("node:fs");
const vm = require("node:vm") as typeof import("node:vm");
const E = require("../dist/engine.js") as typeof HoverEngine;
const context = { window: {} as Window };
for (const name of ["tracks", "training-tracks"])
  vm.runInNewContext(
    fs.readFileSync(`${__dirname}/../dist/${name}.js`, "utf8"),
    context,
  );
let count = 0;
for (const { training, course, cases } of JSON.parse(
  fs.readFileSync(0, "utf8"),
) as {
  training: boolean;
  course: number;
  cases: [number, number, number, number, number, number, number, number][];
}[]) {
  const track = E.prepare(
    context.window[training ? "HOVER_TRAINING_TRACKS" : "HOVER_TRACKS"][course],
  );
  const boostIndex = track.nodes.findIndex((node) => node.tiles.includes(">"));
  if (boostIndex >= 0) {
    const node = track.nodes[boostIndex],
      end = node.end;
    const row = node.tiles.indexOf(">") + 2;
    const corners = [
      node.source!.vertices[row],
      node.source!.vertices[row + 1],
      end!.source!.vertices[row],
      end!.source!.vertices[row + 1],
    ];
    const [x, z] = [0, 2].map(
      (k) =>
        (node.source!.origin[k] +
          corners.reduce((sum, v) => sum + v[k], 0) / 2) /
        100,
    );
    const contact = E.nearest(track, x, z, boostIndex);
    assert.equal(contact.row, row);
    const car = E.create(track);
    Object.assign(car, {
      x,
      z,
      y: contact.surface + 2,
      index: boostIndex,
      previousTile: ".",
    });
    const control = structuredClone(car),
      tiles = node.tiles;
    node.tiles = ".".repeat(tiles.length);
    E.step(control, track, {}, 1 / 60);
    node.tiles = tiles;
    E.step(car, track, {}, 1 / 60);
    assert.ok(
      car.events.includes("boost"),
      track.name + " source boost trigger",
    );
    for (let k = 0; k < 3; k++)
      assert.equal(
        car.front[k] - control.front[k],
        (end!.source!.vertices[row][k] - node.source!.vertices[row][k]) * 2,
        track.name + " original integer boost edge " + k,
      );
  }
  for (const [hint, x, z, part, column, row, supported, shadowY] of cases) {
    const n = E.nearest(track, x, z, hint);
    const node = track.nodes[n.index];
    const label = `${track.name} hint=${hint} at (${x},${z})`;
    assert.deepEqual(
      [node.part, node.partColumn, n.row, +n.supported],
      [part, column, row, supported],
      label,
    );
    if (supported)
      assert.equal(n.surface, -shadowY / 100, label + " source plane height");
    else
      assert.ok(
        Math.abs(n.fallY - (-shadowY / 100 - 18.48)) < 1e-8,
        label + " source outside fall datum",
      );
    count++;
  }
}
console.log(
  `PASS: original car_getplate / car_gravide match ${count} browser contact probes`,
);
