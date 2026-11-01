// Source: src/engine.ts. Build with npm run build; do not edit dist/engine.js directly.
/* Browser adaptation of CAR_CTR.C / CAR_CTR2.C. World units are 1/100 PS1 units. */
namespace HoverEngine {
  "use strict";
  export const MACHINES = [
    {
      name: "LUSTER",
      model: "XVN_CAR",
      weight: 128,
      accel: 240,
      falloff: 0,
      turbo: 250,
      turboFall: 5,
      side: 150,
      drag: 18000,
      rotation: 11,
      rudder: 32,
      tank: 33000,
      color: "#d8e6ef",
      desc: "標準型。原作の機体モデルと性能設定。",
    },
    {
      name: "EXCEL",
      model: "XVP_CAR",
      weight: 120,
      accel: 325,
      falloff: 11,
      turbo: 258,
      turboFall: 5,
      side: 160,
      drag: 17000,
      rotation: 18,
      rudder: 24,
      tank: 30000,
      color: "#6eb1fa",
      desc: "旋回型。前スラスターひとつでも強く曲がれます。",
    },
    {
      name: "BETA",
      model: "SVS_CAR",
      weight: 100,
      accel: 135,
      falloff: -6,
      turbo: 300,
      turboFall: 10,
      side: 140,
      drag: 13000,
      rotation: 15,
      rudder: 0,
      tank: 25000,
      color: "#e1b16f",
      desc: "高速型。ラダーなし。4基のスラスターで操縦。",
    },
    {
      name: "JUSTER",
      model: "JUSTER",
      weight: 140,
      accel: 553,
      falloff: 30,
      turbo: 220,
      turboFall: 3,
      side: 155,
      drag: 22000,
      rotation: 11,
      rudder: 33,
      tank: 38000,
      color: "#c184fb",
      desc: "加速・耐久型。重く、上り坂が苦手です。",
    },
    {
      name: "ALPHA",
      model: "XXX_CAR",
      weight: 95,
      accel: 93,
      falloff: -8,
      turbo: 0,
      turboFall: 0,
      side: 140,
      drag: 11000,
      rotation: 15,
      rudder: 0,
      tank: 10000,
      color: "#e3be6f",
      desc: "高速試作機。ラダー・ターボなし。耐久性が低い。",
    },
  ];
  export const clamp = (v: number, a: number, b: number) =>
      Math.max(a, Math.min(b, v)),
    mix = (a: number, b: number, t: number) => a + (b - a) * t,
    angle = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
  export function prepare(raw: RawTrack): Track {
    const boundary = (value: RawBoundary): Boundary => ({
      ...value,
      x: (value.l[0] + value.r[0]) / 2,
      y: (value.l[1] + value.r[1]) / 2,
      z: (value.l[2] + value.r[2]) / 2,
      width: Math.hypot(value.r[0] - value.l[0], value.r[2] - value.l[2]),
    });
    const nodes: TrackNode[] = raw.samples.map((sample) => ({
      ...sample,
      ...boundary(sample),
      end: sample.end ? boundary(sample.end) : undefined,
      distance: 0,
      len: 0,
      heading: 0,
    }));
    let length = 0;
    nodes.forEach((p, i) => {
      const q = p.end || nodes[(i + 1) % nodes.length];
      p.distance = length;
      p.len = Math.hypot(q.x - p.x, q.z - p.z);
      p.heading = Math.atan2(q.x - p.x, q.z - p.z);
      length += p.len;
    });
    const sourceParts: Track["sourceParts"] = raw.parts ? new Map() : undefined;
    for (const part of raw.parts || []) {
      const indices = nodes
        .map((node, i) => (node.part === part.id ? i : -1))
        .filter((i) => i >= 0)
        .sort((a, b) => nodes[a].partColumn! - nodes[b].partColumn!);
      sourceParts!.set(part.id, {
        indices,
        next: part.next,
        before: part.before,
      });
    }
    return { ...raw, nodes, length, sourceParts };
  }
  export function at(track: Track, d: number) {
    d = ((d % track.length) + track.length) % track.length;
    let i = track.nodes.findIndex((p) => p.distance + p.len > d);
    if (i < 0) i = 0;
    const p = track.nodes[i],
      q = p.end || track.nodes[(i + 1) % track.nodes.length],
      t = clamp((d - p.distance) / (p.len || 1), 0, 1);
    return {
      x: mix(p.x, q.x, t),
      z: mix(p.z, q.z, t),
      y: mix(p.y, q.y, t),
      heading: p.heading,
      index: i,
      width: mix(p.width, q.width, t),
    };
  }
  // MAKEMAP.C: the two outer rows form a rideable sloping apron.
  // Share these vertices with rendering so banks have identical collision faces.
  export function boundaryVertex(
    p: RawBoundary,
    row: number,
    ys: number,
  ): Vec3 {
    if (p.source) {
      const { origin, vertices } = p.source;
      return vertices[row].map(
        (v, k) => ((origin[k] + v * 2) * (k === 1 ? -1 : 1)) / 100,
      );
    }
    const { l, r } = p;
    if (row === ys + 1)
      return l.map((v, k) => (v + r[k]) / 2 - (k === 1 ? 10.24 : 0));
    const length = Math.hypot(...r.map((v, k) => v - l[k])) || 1;
    const outward = l.map((v, k) => ((v - r[k]) * 10.24) / length);
    if (row === 0)
      return l.map((v, k) => v + outward[k] - (k === 1 ? 2.56 : 0));
    if (row === 1) return l.map((v, k) => v + (k === 1 ? 5.12 : 0));
    if (row === ys - 1) return r.map((v, k) => v + (k === 1 ? 5.12 : 0));
    if (row === ys)
      return r.map((v, k) => v - outward[k] - (k === 1 ? 2.56 : 0));
    return l.map((v, k) => mix(v, r[k], (row - 2) / (ys - 4)));
  }
  // CAR_CTR.C car_position / car_getplate. Authored parts, not Euclidean
  // proximity, determine the current strip at crossings and hairpin bends.
  function sourceCell(track: Track, x: number, z: number, hint: number | null) {
    const parts = track.sourceParts;
    if (!parts?.size) return null;
    const local = (index: number) => {
      const origin = track.nodes[index].source!.origin;
      return [
        (Math.floor(x * 100 + 1e-8) - origin[0]) >> 1,
        (Math.floor(z * 100 + 1e-8) - origin[2]) >> 1,
      ];
    };
    const line = (a: Vec3, b: Vec3, p: number[]) =>
      (Math.imul(b[0] - a[0], p[1] - a[2]) -
        Math.imul(b[2] - a[2], p[0] - a[0])) |
      0;
    const corners = (part: { indices: number[] }) => {
      const first = track.nodes[part.indices[0]],
        last = track.nodes[part.indices.at(-1)!].end!;
      const ys = first.allTiles.length;
      return [
        first.source!.vertices[2],
        last.source!.vertices[2],
        last.source!.vertices[ys - 2],
        first.source!.vertices[ys - 2],
      ];
    };
    let part = hint === null ? undefined : parts.get(track.nodes[hint].part!);
    if (!part) {
      for (const [, candidate] of [...parts].sort(([a], [b]) => a - b)) {
        const quad = corners(candidate),
          point = local(candidate.indices[0]);
        if (quad.every((a, i) => line(a, quad[(i + 1) % 4], point) <= 0)) {
          part = candidate;
          break;
        }
      }
      // Outside the complete course, use the caller's geometric fallback.
      if (!part) return null;
    } else {
      const quad = corners(part),
        point = local(part.indices[0]);
      let next = part;
      if (line(quad[3], quad[0], point) > 0)
        next = parts.get(part.before) || part;
      if (line(quad[1], quad[2], point) > 0)
        next = parts.get(part.next) || part;
      part = next;
    }
    const indices = part.indices,
      xs = indices.length;
    const first = track.nodes[indices[0]],
      ys = first.allTiles.length;
    const point = local(indices[0]);
    const vertex = (column: number, row: number) => {
      // V is a row-major array; the original search can read x==xs+1
      // on narrow parts, which denotes the first vertex in the next row.
      const offset = row * (xs + 1) + column;
      const col = ((offset % (xs + 1)) + xs + 1) % (xs + 1);
      const r = Math.floor(offset / (xs + 1));
      return col === xs
        ? track.nodes[indices[xs - 1]].end!.source!.vertices[r]
        : track.nodes[indices[col]].source!.vertices[r];
    };
    // Preserve the original six-step search and exact boundary tie rules.
    let up = 31,
      low = 0,
      column = 15,
      step = 8,
      searches = 0;
    do {
      searches++;
      if (column > xs && step !== 1) {
        up = column;
        column -= step;
        step >>= 1;
        continue;
      }
      const side = line(vertex(column, 2), vertex(column, ys - 2), point);
      if (side <= 0) {
        up = column;
        column -= step;
      }
      if (side > 0) {
        low = column;
        column += step;
      }
      if (step !== 1) step >>= 1;
    } while (up - low !== 1 && up > low && searches < 6);
    up = clamp(up, 1, xs);
    let row = 0;
    while (row <= ys && line(vertex(up - 1, row), vertex(up, row), point) <= 0)
      row++;
    const supported = row > 0 && row <= ys;
    return { index: indices[up - 1], row: clamp(row, 1, ys) - 1, supported };
  }
  export function nearest(
    track: Track,
    x: number,
    z: number,
    hint: number | null = null,
  ): Nearest {
    let best: Nearest | null = null;
    const n = track.nodes.length;
    const cell = sourceCell(track, x, z, hint);
    const ids = cell
      ? [cell.index]
      : hint === null
        ? track.nodes.map((_, i) => i)
        : Array.from(
            new Set(
              Array.from({ length: 7 }, (_, j) => (hint + j - 3 + n) % n),
            ),
          );
    for (const i of ids) {
      const p = track.nodes[i],
        q = p.end || track.nodes[(i + 1) % n],
        dx = q.x - p.x,
        dz = q.z - p.z,
        initialT = ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz || 1);
      // Invert the actual road quad, rather than projecting onto its centre
      // segment. At bends the closest centre segment need not contain the car.
      let longitudinal = initialT,
        lane = 0.5;
      for (let iteration = 0; iteration < 6; iteration++) {
        const left = p.l.map((v, k) => mix(v, q.l[k], longitudinal));
        const across = p.r.map(
          (v, k) => mix(v, q.r[k], longitudinal) - left[k],
        );
        const along = p.l.map((v, k) => mix(q.l[k] - v, q.r[k] - p.r[k], lane));
        const ex = left[0] + across[0] * lane - x;
        const ez = left[2] + across[2] * lane - z;
        if (Math.abs(ex) + Math.abs(ez) < 1e-8) break;
        const determinant = along[0] * across[2] - along[2] * across[0];
        if (Math.abs(determinant) < 1e-8) break;
        longitudinal -= (ex * across[2] - ez * across[0]) / determinant;
        lane -= (along[0] * ez - along[2] * ex) / determinant;
      }
      const t = clamp(longitudinal, 0, 1),
        cx = mix(p.x, q.x, t),
        cz = mix(p.z, q.z, t),
        l = p.l.map((v, k) => mix(v, q.l[k], t)),
        r = p.r.map((v, k) => mix(v, q.r[k], t)),
        wx = r[0] - l[0],
        wz = r[2] - l[2],
        width = Math.hypot(wx, wz),
        outsideLong = Math.abs(longitudinal - t) * p.len,
        dist =
          outsideLong > 1e-5 ? 1e6 + outsideLong : Math.abs(lane - 0.5) * width;
      if (!best || dist < best.dist) {
        // CAR_CTR.C car_gravide: plane through the current tile's first
        // vertex, its next longitudinal vertex and its next lateral vertex.
        const ys = p.allTiles.length;
        const row =
          cell?.row ??
          (lane < 0
            ? 0
            : lane > 1
              ? ys - 1
              : 2 + Math.floor(clamp(lane, 0, 0.9999) * p.tiles.length));
        const a = boundaryVertex(p, row, ys);
        const along = boundaryVertex(q, row, ys).map((v, k) => v - a[k]);
        const across = boundaryVertex(p, row + 1, ys).map((v, k) => v - a[k]);
        const outer = boundaryVertex(p, lane < 0 ? 0 : ys, ys);
        const outerEnd = boundaryVertex(q, lane < 0 ? 0 : ys, ys);
        const outerPoint = outer.map((v, k) => mix(v, outerEnd[k], t));
        const outerLane =
          ((outerPoint[0] - l[0]) * wx + (outerPoint[2] - l[2]) * wz) /
          (width * width || 1);
        const supported =
          cell?.supported ??
          ((lane >= 0 && lane <= 1) ||
            (lane < 0 ? lane >= outerLane : lane <= outerLane));
        let normal = [
          along[1] * across[2] - along[2] * across[1],
          along[2] * across[0] - along[0] * across[2],
          along[0] * across[1] - along[1] * across[0],
        ];
        const scale = (normal[1] < 0 ? -1 : 1) / (Math.hypot(...normal) || 1);
        normal = normal.map((v) => Math.round(v * scale * 4096));
        let surface =
          normal[1] === 0
            ? a[1]
            : a[1] -
              (normal[0] * (x - a[0]) + normal[2] * (z - a[2])) / normal[1];
        if (p.source && q.source) {
          // CAR_CTR.C car_gravide works in the part's local half-scale
          // integer coordinates. Its plane uses the raw cross product, not
          // the separately quantized normal used for bank forces.
          const { origin, vertices } = p.source;
          const d = vertices[row];
          const av = q.source.vertices[row].map((v, k) => v - d[k]);
          const bv = vertices[row + 1].map((v, k) => v - d[k]);
          const cross = [
            (Math.imul(av[1], bv[2]) - Math.imul(av[2], bv[1])) | 0,
            (Math.imul(av[2], bv[0]) - Math.imul(av[0], bv[2])) | 0,
            (Math.imul(av[0], bv[1]) - Math.imul(av[1], bv[0])) | 0,
          ];
          const localX = (Math.floor(x * 100 + 1e-8) - origin[0]) >> 1;
          const localZ = (Math.floor(z * 100 + 1e-8) - origin[2]) >> 1;
          const numerator =
            (-Math.imul(cross[0], localX - d[0]) -
              Math.imul(cross[2], localZ - d[2])) |
            0;
          const localY =
            cross[1] === 0 ? 0 : (Math.trunc(numerator / cross[1]) + d[1]) << 1;
          surface = -(localY + origin[1]) / 100;
          normal = p.sourceNormals![row].map((v, k) => (k === 1 ? -v : v));
        }
        best = {
          surface,
          normal,
          supported,
          row,
          fallY: supported ? surface - 4.12 : a[1] - 68.48,
          index: i,
          t,
          x: cx,
          z: cz,
          y: mix(p.y, q.y, t),
          dist,
          width: Math.hypot(wx, wz),
          heading: p.heading,
          distance: p.distance + p.len * t,
          tile: row >= 2 && row < ys - 2 ? p.tiles[row - 2] : p.allTiles[row],
          lane,
          ly: l[1],
          ry: r[1],
          slope: (q.y - p.y) / (p.len || 1),
          dx: dx,
          dz: dz,
          dy: q.y - p.y,
        };
      }
    }
    if (!best) throw new Error("Track must contain at least one sample");
    return best;
  }
  const TAU = Math.PI * 2,
    UNIT = TAU / 4096;
  export function create(track: Track, type = 0): Car {
    const p = at(track, 8);
    return {
      x: p.x,
      z: p.z,
      y: p.y + 2,
      heading: p.heading,
      pitch: 0,
      roll: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      front: [0, 0, 0],
      rear: [0, 0, 0],
      type,
      energy: 100,
      damage: 0,
      index: p.index,
      progress: 0,
      lastDistance: 8,
      time: 0,
      lapStart: 0,
      linePosition: p.index,
      lastLine: p.index,
      lastGoal: 0,
      laps: [],
      finished: false,
      reason: null,
      flash: 0,
      recovery: 0,
      turbo: false,
      rudderAngle: 0,
      sourceSpeed: 0,
      grip: true,
      previousTile: "g",
      tei: 0,
      ticks: 0,
      accumulator: 0,
      events: [],
    };
  }
  // GAME.C game_init VZ / CAR_CTR.C car_position: authored world coordinates,
  // not offsets along the centreline. Heading starts at zero on every course.
  export function placeOnGrid(car: Car, track: Track, slot = 0) {
    const x = slot % 2 ? 25 : 10,
      z = slot * 30;
    const p = nearest(track, x, z);
    Object.assign(car, {
      x,
      z,
      y: 2,
      heading: 0,
      sourcePosition: undefined,
      sourceContact: undefined,
      sourceTile: undefined,
      warningActive: undefined,
      sourceMatrix: undefined,
      sourceShadowMatrix: undefined,
      sourceShadowAngles: undefined,
      sourcePreviousAngles: undefined,
      index: p.index,
      lastDistance: p.distance,
      progress:
        p.distance > track.length / 2 ? p.distance - track.length : p.distance,
      lastLine: p.index,
      linePosition: 0,
      groundY: p.surface,
      groundNormal: p.normal,
      onRoad: true,
      previousTile: p.tile,
    });
    return car;
  }
  export function recover(car: Car, track: Track) {
    const p = at(track, Math.max(8, car.progress + 8));
    Object.assign(car, {
      x: p.x,
      z: p.z,
      y: p.y + 2,
      heading: p.heading,
      pitch: 0,
      roll: 0,
      index: p.index,
      front: [0, 0, 0],
      rear: [0, 0, 0],
      vx: 0,
      vy: 0,
      vz: 0,
      grip: true,
      finished: false,
      reason: null,
      lastDistance: Math.max(8, car.progress + 8) % track.length,
      recovery: 1,
      sourcePosition: undefined,
      sourceContact: undefined,
      sourceTile: undefined,
      warningActive: undefined,
      sourceMatrix: undefined,
      sourceShadowMatrix: undefined,
      sourceShadowAngles: undefined,
      sourcePreviousAngles: undefined,
      lastLine: p.index,
      previousTile:
        track.nodes[p.index].tiles[
          Math.floor(track.nodes[p.index].tiles.length / 2)
        ],
    });
  }
  export function sync(car: Car) {
    const m = MACHINES[car.type];
    car.vx = ((car.front[0] + car.rear[0]) * 60) / 1600;
    car.vy = (-(car.front[1] + car.rear[1]) * 60) / 1600;
    car.vz = ((car.front[2] + car.rear[2]) * 60) / 1600;
    car.energy = clamp(100 * (1 - car.damage / m.tank), 0, 100);
  }
  // CAR_CTR.C car_preope uses LIB.C sqr_i(2048), whose last search step
  // differs from floor(sqrt). Keep the original 32-bit sum and products.
  export function sourceSpeed(front: Vec3, rear: Vec3) {
    const sum = front.map((v, k) => (v + rear[k]) | 0);
    const value =
      sum.reduce((total, v) => (total + Math.imul(v, v)) | 0, 0) >> 7;
    if (value === 0) return 0;
    let current = 1024,
      step = 512;
    while (step) {
      const square = current * current;
      if (square === value) return current;
      current += square > value ? -step : step;
      step >>= 1;
    }
    return current;
  }
  // CAR_CTR2.C car_rotation's airborne roll branch, including its two
  // independent comparisons. Source roll has the opposite sign after Y/Z flip.
  export function sourceAirRoll(roll: number) {
    let value = ((Math.round(-roll / UNIT) + 4096) & 8191) - 4096;
    if (value > 5) value -= 5;
    if (value < 5) value += 5;
    return -value * UNIT;
  }
  const matrixSine = Array.from({ length: 4096 }, (_, i) =>
    Math.round(Math.sin(i * UNIT) * 4096),
  );
  // Net Yaroze RotMatrix(x,0,z), followed by RotMatrixY(y): Ry * Rx * Rz.
  // The SDK's sine table/final matrix rounding still needs binary comparison;
  // the controller below is independently compared using explicit matrices.
  export function sourceMatrix(pitch: number, yaw: number, roll: number) {
    const sin = (v: number) => matrixSine[v & 4095],
      cos = (v: number) => sin(v + 1024);
    const sx = sin(pitch),
      cx = cos(pitch),
      sy = sin(yaw),
      cy = cos(yaw),
      sz = sin(roll),
      cz = cos(roll);
    const base = [
      cz,
      -sz,
      0,
      Math.imul(cx, sz) >> 12,
      Math.imul(cx, cz) >> 12,
      -sx,
      Math.imul(sx, sz) >> 12,
      Math.imul(sx, cz) >> 12,
      cx,
    ];
    const result = base.slice();
    for (let column = 0; column < 3; column++) {
      result[column] =
        ((Math.imul(cy, base[column]) + Math.imul(sy, base[6 + column])) | 0) >>
        12;
      result[6 + column] =
        ((-Math.imul(sy, base[column]) + Math.imul(cy, base[6 + column])) |
          0) >>
        12;
    }
    return result.map((v) => (v << 16) >> 16);
  }
  function sourceAngles(car: Car) {
    return [
      Math.round(car.pitch / UNIT),
      Math.round(car.heading / UNIT),
      Math.round(-car.roll / UNIT),
    ].map((v) => (v << 16) >> 16);
  }
  function ensureSourceAttitude(car: Car) {
    const angles = sourceAngles(car);
    car.sourceShadowAngles ??= [0, 0, 0];
    car.sourcePreviousAngles ??= angles.slice();
    car.sourceMatrix ??= sourceMatrix(...(angles as [number, number, number]));
    car.sourceShadowMatrix ??= sourceMatrix(
      car.sourceShadowAngles[0],
      angles[1],
      car.sourceShadowAngles[2],
    );
  }
  export function rebuildSourceMatrices(car: Car) {
    const angles = sourceAngles(car),
      shadow = car.sourceShadowAngles || [0, 0, 0];
    car.sourceMatrix = sourceMatrix(...(angles as [number, number, number]));
    car.sourceShadowMatrix = sourceMatrix(shadow[0], angles[1], shadow[2]);
  }
  // CAR_CTR2.C car_rotation: both dot products consume last frame's saved
  // matrices. SVECTOR assignments wrap to signed 16 bits after each update.
  export function sourceRotation(car: Car, normal: Vec3) {
    ensureSourceAttitude(car);
    const short = (v: number) => (v << 16) >> 16;
    const angles = sourceAngles(car).map((v) => ((v + 4096) & 8191) - 4096);
    const shadow = car.sourceShadowAngles!.map((v) => v & 4095);
    if (car.sourceSpeed >= 5 && MACHINES[car.type].rudder)
      angles[1] = short(
        angles[1] - Math.trunc(car.rudderAngle / MACHINES[car.type].rudder),
      );
    const previous = car.sourcePreviousAngles!;
    if (!car.cpuLevel && !car.grip) {
      if (angles[2] > 5) angles[2] = short(angles[2] - 5);
      if (angles[2] < 5) angles[2] = short(angles[2] + 5);
    } else {
      const error = (matrix: Vec3, column: number) =>
        short(
          (-normal.reduce(
            (sum, v, k) => (sum + Math.imul(v, matrix[k * 3 + column])) | 0,
            0,
          ) |
            0) >>
            12,
        );
      const right = error(car.sourceMatrix!, 0),
        forward = error(car.sourceMatrix!, 2);
      if (Math.abs(right) < 600)
        angles[2] = short(
          angles[2] +
            (Math.imul(
              car.sourceSpeed,
              ((previous[1] - angles[1] + 2048) & 4095) - 2048,
            ) >>
              8),
        );
      if (forward > 40) angles[0] = short(angles[0] + 11);
      if (forward < -40) angles[0] = short(angles[0] - 11);
      if (right < -40) angles[2] = short(angles[2] + 11);
      if (right > 40) angles[2] = short(angles[2] - 11);
      const shadowRight = error(car.sourceShadowMatrix!, 0),
        shadowForward = error(car.sourceShadowMatrix!, 2);
      if (shadowForward > 40) shadow[0] = short(shadow[0] + 22);
      if (shadowForward < -40) shadow[0] = short(shadow[0] - 22);
      if (shadowRight < -40) shadow[2] = short(shadow[2] + 22);
      if (shadowRight > 40) shadow[2] = short(shadow[2] - 22);
    }
    car.pitch = angles[0] * UNIT;
    car.heading = angles[1] * UNIT;
    car.roll = -angles[2] * UNIT;
    car.sourceShadowAngles = shadow;
    car.sourcePreviousAngles = angles.slice();
  }
  // CAR_CTR.C car_acceralate applies thrust through the previously saved
  // matrix, with arithmetic shifts (including negative lateral thrust).
  export function sourceAcceleration(car: Car, mode: number) {
    const speed = car.sourceSpeed,
      m = MACHINES[car.type];
    if (speed > 2000) return;
    let thrust: number, column: number;
    let targets: Vec3[];
    if (mode === 0) {
      thrust = (m.accel - (Math.imul(m.falloff, speed) >> 6)) >> 2;
      if (car.turbo) {
        car.damage = (car.damage + 48) | 0;
        let turbo = (m.turbo - (Math.imul(m.turboFall, speed) >> 4)) >> 2;
        if (Number(car.turbo) >= 2)
          turbo = Math.imul(turbo, Number(car.turbo)) >> 8;
        if (turbo > 0) thrust += turbo;
      }
      if ((car.cpuLevel || 0) >= 2) {
        const extra = (m.turbo - (Math.imul(m.turboFall, speed) >> 4)) >> 4;
        if (extra > 0) thrust += Math.imul(extra, car.catchUp ? 3 : 2) >> 1;
      }
      column = 2;
      targets = [car.front, car.rear];
    } else {
      const positive = mode === 2 || mode === 4;
      const yaw = mode === 1 || mode === 4 ? -m.rotation : m.rotation;
      car.heading =
        (((Math.round(car.heading / UNIT) + yaw) << 16) >> 16) * UNIT;
      thrust = (positive ? m.side - (speed >> 4) : -m.side + (speed >> 4)) >> 2;
      column = 0;
      targets = [mode < 3 ? car.front : car.rear];
    }
    thrust = Math.trunc((thrust << 7) / m.weight);
    for (const vector of targets)
      for (let k = 0; k < 3; k++)
        if (k !== 1 || car.grip)
          vector[k] =
            (vector[k] +
              (Math.imul(car.sourceMatrix![k * 3 + column], thrust) >> 12)) |
            0;
  }
  export function sourceContact(
    node: TrackNode,
    row: number,
    supported: boolean,
  ): SourceContact {
    const d = node.source!.vertices[row];
    return {
      origin: node.source!.origin,
      d,
      a: node.end!.source!.vertices[row].map((v, k) => v - d[k]),
      b: node.source!.vertices[row + 1].map((v, k) => v - d[k]),
      normal: node.sourceNormals![row],
      outside: !supported,
    };
  }
  // CAR_CTR.C car_gravide: the shadow attribute is evaluated before a new
  // fall starts, while grip is evaluated after cushion/landing corrections.
  export function sourceGravity(
    car: Car,
    contact: SourceContact,
    over = car.reason === "course-out"
      ? -256
      : car.reason === "destroyed"
        ? 300
        : 0,
  ) {
    const weight = MACHINES[car.type].weight,
      lev = car.cpuLevel || 0;
    const { origin, d, a, b, outside } = contact;
    const cross = [
      (Math.imul(a[1], b[2]) - Math.imul(a[2], b[1])) | 0,
      (Math.imul(a[2], b[0]) - Math.imul(a[0], b[2])) | 0,
      (Math.imul(a[0], b[1]) - Math.imul(a[1], b[0])) | 0,
    ];
    const x = (Math.floor(car.x * 100 + 1e-8) - origin[0]) >> 1;
    const z = (Math.floor(car.z * 100 + 1e-8) - origin[2]) >> 1;
    const numerator =
      (-Math.imul(cross[0], x - d[0]) - Math.imul(cross[2], z - d[2])) | 0;
    const localY = outside
      ? d[1] * 2 + 5000
      : cross[1] === 0
        ? 0
        : (Math.trunc(numerator / cross[1]) + d[1]) << 1;
    const plane = (localY + origin[1]) | 0;
    const target = (plane - 200) | 0,
      landing = (plane - 100) | 0;
    let y = Math.floor(-car.y * 100 + 1e-8);
    const position = currentSourcePosition(car);
    const pitch = ((Math.round(car.pitch / UNIT) + 2048) & 4095) - 2048;
    const gravity = ((weight * 3) >> 4) - (pitch >> 8);
    car.groundY = -plane / 100;
    car.groundNormal = contact.normal.map((v, k) => (k === 1 ? -v : v));
    car.onRoad = !outside && over >= 0;
    if (
      !lev &&
      over === 0 &&
      (outside ? y >= target + 2048 : y >= landing + 512)
    ) {
      over = -256;
      car.finished = true;
      car.reason = "course-out";
    }
    if (!outside && over >= 0 && !lev && y >= landing && car.tei === 0) {
      car.front[1] = car.rear[1] = Math.imul(-200, weight) >> 7;
      y = landing - 10;
      position[1] = y << 2;
      car.tei = 16;
      car.damage = (car.damage + 100) | 0;
      car.events.push("land");
      car.damageLight = true;
    } else if (!outside && y >= target && (over >= 0 || lev)) {
      if (!lev) {
        const depth = y - target;
        const lift = Math.max(
          -8 * gravity,
          Math.imul((-25 - (Math.imul(depth, depth) >> 2)) | 0, weight) >> 7,
        );
        car.front[1] = (car.front[1] + lift) | 0;
        car.rear[1] = (car.rear[1] + lift) | 0;
      }
      if (
        lev ||
        car.tei ||
        (y - target < 70 && Math.abs((car.front[1] + car.rear[1]) | 0) < 500)
      ) {
        y = target;
        position[1] = y << 2;
        car.tei = 60;
      }
    } else {
      car.front[1] = (car.front[1] + gravity) | 0;
      car.rear[1] = (car.rear[1] + gravity) | 0;
      if (car.tei) car.tei--;
    }
    car.y = -y / 100;
    car.sourcePosition = position;
    car.grip = y >= target - 150;
    return over;
  }
  // CAR_CTR2.C car_bank consumes the stored TMD normal in Y-down units.
  export function sourceBank(car: Car, normal: Vec3) {
    if (!car.grip) return;
    const weight = MACHINES[car.type].weight;
    const square =
      (Math.imul(normal[0], normal[0]) + Math.imul(normal[2], normal[2])) | 0;
    const force = [
      normal[0] >> 2,
      normal[1] ? -Math.trunc(square / normal[1]) >> 2 : 0,
      normal[2] >> 2,
    ].map((v) => Math.imul(v, weight) >> 12);
    for (const vector of [car.front, car.rear])
      for (let k = 0; k < 3; k++) vector[k] = (vector[k] + force[k]) | 0;
  }
  // CAR_CTR.C car_wallcheck. nextPosition is nposr in 1/4 PS1 units,
  // with Y down. Keep 16-bit SVECTOR assignments and 32-bit products/shifts.
  export function sourceWallCheck(
    car: Car,
    node: TrackNode,
    nextPosition: Vec3,
    racing = true,
    mode = 0,
  ): number {
    const { origin, vertices } = node.source!;
    const end = node.end!.source!.vertices;
    const ys = node.allTiles.length;
    const short = (v: number) => (v << 16) >> 16;
    const old = [
      Math.floor(car.x * 100 + 1e-8),
      Math.floor(-car.y * 100 + 1e-8),
      Math.floor(car.z * 100 + 1e-8),
    ].map((v, k) => (v - origin[k]) >> 1);
    const next = nextPosition.map((v, k) => ((v >> 2) - origin[k]) >> 1);
    const dot = (a: Vec3, b: Vec3) =>
      a.reduce((sum, v, k) => (sum + Math.imul(v, b[k])) | 0, 0);
    const hr = car.cpuLevel ? 0 : (car.sourceSpeed >> 4) + 3;
    car.leftHit = car.rightHit = 0;
    for (const right of [false, true]) {
      const row = right ? ys - 2 - mode : 2 + mode;
      const a = vertices[row].slice();
      const b = end[row].map((v, k) => short(v - a[k]));
      const normal = node.sourceNormals![right ? ys - 2 : 1];
      a[0] = short(a[0] + (normal[0] >> 6));
      a[2] = short(a[2] + (normal[2] >> 6));
      const before =
        (Math.imul(b[2], old[0] - a[0]) - Math.imul(b[0], old[2] - a[2])) | 0;
      a[0] = short(a[0] + (normal[0] >> 6));
      a[2] = short(a[2] + (normal[2] >> 6));
      const after =
        (Math.imul(b[2], next[0] - a[0]) - Math.imul(b[0], next[2] - a[2])) | 0;
      const distance = Math.abs(
        dot(
          normal,
          next.map((v, k) => v - a[k]),
        ) >> 12,
      );
      if (right) car.rightDistance = distance;
      else car.leftDistance = distance;
      const crossed = right ? before < 0 && after > 0 : before > 0 && after < 0;
      const crest = vertices[right ? ys - 1 : 1][1];
      if (
        !crossed ||
        !((crest - old[1] < 100 && car.reason !== "course-out") || car.cpuLevel)
      )
        continue;
      nextPosition[0] =
        (nextPosition[0] + (Math.imul(normal[0], distance + 10) >> 9)) | 0;
      nextPosition[2] =
        (nextPosition[2] + (Math.imul(normal[2], distance + 10) >> 9)) | 0;
      if (right) car.rightHit = 1;
      else car.leftHit = 1;
      car.damage = (car.damage + 2 * hr * hr + 10) | 0;
      // Both sides project onto the outer-left longitudinal edge, not onto
      // a reconstructed road tangent or the nearest following segment.
      const edge = end[0].map((v, k) => v - vertices[0][k]);
      let projection = Math.trunc(
        (dot(edge, car.front) << 6) / dot(edge, edge),
      );
      if (car.sourceSpeed > 80 && !car.cpuLevel && racing)
        projection = Math.imul(projection, 180) >> 8;
      for (const k of [0, 2])
        car.front[k] = car.rear[k] =
          ((Math.imul(edge[k], projection) >> 6) +
            (Math.imul(normal[k], hr) >> 8)) |
          0;
      if (!car.cpuLevel && racing) {
        car.events.push("wall");
        if (hr > 16) car.events.push("wall-sound");
        emitDebris(
          car,
          Math.max(0, hr - 3),
          1,
          normal.map((v, k) => (v * (k === 1 ? -1 : 1)) / 4096),
        );
      }
      return 1;
    }
    return 0;
  }
  function currentSourcePosition(car: Car) {
    return [car.x, -car.y, car.z].map((value, k) => {
      const fixed = car.sourcePosition?.[k];
      const start =
        fixed !== undefined && Math.abs((fixed >> 2) / 100 - value) < 1e-9
          ? fixed
          : Math.round(value * 400);
      return start;
    });
  }
  function nextSourcePosition(car: Car) {
    return currentSourcePosition(car).map(
      (v, k) => (v + ((car.front[k] + car.rear[k]) >> 2)) | 0,
    );
  }
  function setSourcePosition(car: Car, position: Vec3) {
    car.sourcePosition = position;
    car.x = (position[0] >> 2) / 100;
    car.y = -(position[1] >> 2) / 100;
    car.z = (position[2] >> 2) / 100;
  }
  export function sourceMove(
    car: Car,
    node: TrackNode,
    racing = true,
    enemy = !!car.cpuLevel || !racing,
  ) {
    const nextPosition = nextSourcePosition(car);
    // car_enemy first checks the inner (mode 1) walls, then repeats mode 0.
    if (enemy) sourceWallCheck(car, node, nextPosition, racing, 1);
    while (sourceWallCheck(car, node, nextPosition, racing)) {
      // Original correction loop. The last pass clears left/rightHit, so
      // keep the touched sides for the HUD (display only; bit 1 = left).
      car.wallSides =
        (car.wallSides ?? 0) | (car.leftHit ? 1 : 0) | (car.rightHit ? 2 : 0);
    }
    setSourcePosition(car, nextPosition);
  }
  // Continuous branch of car_chipeffect; reads the previous gravity's grip.
  // Unlike entry triggers, these effects continue while over is nonzero.
  export function sourceContinuousTile(
    car: Car,
    tile: string,
    time = car.ticks,
  ) {
    const player = !car.ghost && (car.cpuSlot ?? (car.cpuLevel ? 1 : 0)) === 0;
    const damaging = tile === "d" && car.grip && player;
    car.damageFloorActive = damaging;
    car.damageLight = damaging && (time & 2) !== 0;
    car.damageSemi = damaging && (time & 1) === 0;
    if (damaging) car.damage = (car.damage + 100) | 0;
    if (tile === "B" && car.grip) car.damage = (car.damage + 100000) | 0;
    return tile === "*" && car.grip && !car.cpuLevel;
  }
  // CAR_CTR.C car_resistance: products and sign tests are signed 32-bit.
  export function sourceResistance(
    car: Car,
    brake = false,
    floorBrake = false,
  ) {
    const m = MACHINES[car.type];
    const drag =
      Math.trunc(
        Math.imul(car.sourceSpeed, m.drag) /
          Math.imul(m.weight, (car.sourceSpeed + 1) | 0),
      ) | 0;
    const horizontal = (drag + (brake ? 240 : 0) + (floorBrake ? 240 : 0)) | 0;
    for (const vector of [car.front, car.rear])
      for (let k = 0; k < 3; k++) {
        const old = vector[k];
        vector[k] =
          (old - (Math.imul(old, k === 1 ? drag : horizontal) >> 13)) | 0;
        if (Math.imul(old, vector[k]) < 0) vector[k] = 0;
      }
  }
  export function tick(
    car: Car,
    track: Track,
    input: Input,
    free: boolean,
    racing = true,
  ) {
    const m = MACHINES[car.type],
      f = car.front,
      b = car.rear;
    car.ticks++;
    if (racing) car.time = car.ticks / 60;
    car.flash = Math.max(0, car.flash - 1 / 60);
    car.recovery = Math.max(0, car.recovery - 1 / 60);
    car.sourceSpeed = track.sourceParts
      ? sourceSpeed(f, b)
      : Math.floor(
          Math.hypot(f[0] + b[0], f[1] + b[1], f[2] + b[2]) / Math.sqrt(128),
        );
    const speed = car.sourceSpeed;
    if (car.damage > 4) car.damage -= 6 + Math.floor((car.damage * 9) / m.tank);
    const near = nearest(track, car.x, car.z, car.index);
    car.index = near.index;
    let lines = near.index - car.lastLine;
    if (lines < -track.nodes.length / 2) lines += track.nodes.length;
    if (lines > track.nodes.length / 2) lines -= track.nodes.length;
    car.linePosition += lines;
    car.lastLine = near.index;
    const inside = near.supported;
    const surface = near.surface,
      target = surface + 2;
    car.groundY = surface;
    car.groundNormal = near.normal;
    car.onRoad = inside;
    stepDebris(car);
    const node = track.nodes[near.index];
    const source = !!(node.source && node.end?.source && node.sourceNormals);
    if (source) {
      car.sourceContact = sourceContact(node, near.row, inside);
      ensureSourceAttitude(car);
    } else car.grip = inside && car.y <= target + 1.5 && car.y >= surface - 1;
    // car_getplate retains the selected edge cell even outside the course.
    const ch = source || inside ? near.tile : "outside";
    car.tile = inside ? near.tile : "outside";
    car.sourceTile = source ? ch : undefined;
    const floorBrake = sourceContinuousTile(car, ch);
    car.turbo = !!input.turbo && m.turbo > 0;
    car.fireTail =
      !racing && !car.cpuLevel
        ? 0
        : car.cpuLevel || input.accel || car.turbo
          ? 64
          : car.fireRemaining || 0;
    car.fireRemaining =
      input.accel || car.turbo ? 64 : Math.max(0, (car.fireRemaining || 0) - 1);
    // CAR_CTR.C: g is a line trigger (also active in the air), with a
    // 32-row guard against reversing across the same finish line.
    if (
      racing &&
      !car.ghost &&
      ch === "g" &&
      car.previousTile !== "g" &&
      car.linePosition > car.lastGoal + 32
    ) {
      car.lastGoal = car.linePosition;
      car.laps.push(car.time - car.lapStart);
      car.lapStart = car.time;
      if (car.laps.length >= 3 && !free) {
        car.finished = true;
        car.reason = "finish";
      }
    }
    if (ch !== car.previousTile) {
      if (ch === "P" && car.grip) {
        car.damage = Math.max(0, car.damage - 6000);
        if (!car.ghost) car.events.push("repair");
      }
      if (ch === "J" && car.grip) {
        f[1] -= 1500;
        b[1] -= 1500;
        car.events.push("jump");
      }
      if (ch === ">" && car.grip) {
        const node = track.nodes[near.index],
          end = node.end || track.nodes[(near.index + 1) % track.nodes.length],
          lane =
            Math.floor(clamp(near.lane, 0, 0.9999) * node.tiles.length) /
            node.tiles.length;
        // Vp[1]-Vp[0] follows the current cell's longitudinal edge,
        // which differs from the centreline on curves and changing banks.
        const edge = node.l.map(
          (v, k) => mix(end.l[k], end.r[k], lane) - mix(v, node.r[k], lane),
        );
        const impulse =
          node.source && end.source
            ? end.source.vertices[near.row].map(
                (v, k) => (v - node.source!.vertices[near.row][k]) << 1,
              )
            : edge.map((v, k) => Math.trunc(v * (k === 1 ? -100 : 100)));
        for (const v of [f, b]) {
          for (let k = 0; k < 3; k++) v[k] += impulse[k];
        }
        car.events.push("boost");
      }
    }
    // In car_chipeffect only J leaves ccc unchanged while airborne, so
    // landing on that same jump tile must still fire the jump.
    if (ch !== "J" || car.grip) car.previousTile = ch;
    sourceResistance(car, !!input.brake, floorBrake);
    if (source) {
      sourceGravity(car, car.sourceContact!);
      // car_enemy omits car_bank for lev>0; a lev=0 ghost uses car_action.
      if (!car.cpuLevel) sourceBank(car, car.sourceContact!.normal);
    } else {
      // Test falling before the cushion can snap an already submerged car up.
      if (car.y <= near.fallY) {
        car.finished = true;
        car.reason = "course-out";
        car.onRoad = false;
        car.warningActive = false;
        sync(car);
        return;
      }
      // Original gravity and anti-gravity cushion, in PS1 Y-down inertia units.
      const gravity =
        ((m.weight * 3) >> 4) - (Math.round(-car.pitch / UNIT) >> 8);
      if (inside && car.y <= surface + 1 && car.tei === 0) {
        f[1] = b[1] = (-200 * m.weight) >> 7;
        car.y = surface + 1.1;
        car.tei = 16;
        car.damage += 100;
        car.events.push("land");
        car.damageLight = true;
      } else if (inside && car.y <= target) {
        const depth = Math.max(0, Math.round((target - car.y) * 100));
        const lift = Math.max(
          -8 * gravity,
          ((-25 - ((depth * depth) >> 2)) * m.weight) >> 7,
        );
        f[1] += lift;
        b[1] += lift;
        if (car.tei > 0 || (depth < 70 && Math.abs(f[1] + b[1]) < 500)) {
          car.y = target;
          car.tei = 60;
        }
      } else {
        f[1] += gravity;
        b[1] += gravity;
        if (car.tei > 0) car.tei--;
      }
      car.grip = inside && car.y <= target + 1.5;
      if (car.grip) {
        const [nx, ny, nz] = near.normal;
        // CAR_CTR2.C car_bank, including its formerly missing Y component.
        const bank = [
          ((nx >> 2) * m.weight) >> 12,
          ((Math.trunc((nx * nx + nz * nz) / (ny || 1)) >> 2) * m.weight) >> 12,
          ((nz >> 2) * m.weight) >> 12,
        ];
        for (const v of [f, b]) {
          for (let j = 0; j < 3; j++) v[j] += bank[j];
        }
      }
    }
    car.rudderAngle = clamp(car.rudderAngle, -220, 220);
    if (m.rudder) {
      if (input.steer) car.rudderAngle -= Math.sign(input.steer) * 22;
      else
        car.rudderAngle -=
          Math.sign(car.rudderAngle) * Math.min(22, Math.abs(car.rudderAngle));
    }
    const oldHeading = car.heading,
      sx = Math.sin(car.heading),
      sz = Math.cos(car.heading);
    if (source && (input.accel || car.turbo)) sourceAcceleration(car, 0);
    else if (input.accel || car.turbo) {
      let thrust = (m.accel - ((m.falloff * speed) >> 6)) >> 2;
      if (car.turbo) {
        car.damage += 48;
        thrust += Math.max(0, (m.turbo - ((m.turboFall * speed) >> 4)) >> 2);
      }
      // Original level >= 2 CPU acceleration / catch-up assistance.
      if ((car.cpuLevel || 0) >= 2) {
        const extra = Math.max(
          0,
          (m.turbo - ((m.turboFall * speed) >> 4)) >> 4,
        );
        thrust += (extra * (car.catchUp ? 3 : 2)) >> 1;
      }
      thrust = Math.trunc((thrust * 128) / m.weight);
      if (speed <= 2000)
        for (const v of [f, b]) {
          v[0] += Math.round(sx * thrust * Math.cos(car.pitch));
          v[2] += Math.round(sz * thrust * Math.cos(car.pitch));
          if (car.grip) v[1] -= Math.round(Math.sin(car.pitch) * thrust);
        }
    }
    if (source && !car.grip) {
      let pitch = Math.round(car.pitch / UNIT);
      if ((input.pitch || 0) < 0 && pitch > -227) pitch -= 11;
      if ((input.pitch || 0) > 0 && pitch < 227) pitch += 11;
      car.pitch = pitch * UNIT;
    } else {
      if (!car.grip)
        car.pitch = clamp(
          car.pitch + (input.pitch || 0) * 11 * UNIT,
          (-20 * Math.PI) / 180,
          (20 * Math.PI) / 180,
        );
    }
    car.active = { ...input, accel: !!(input.accel || car.turbo) };
    for (const [key, side, yaw, vector] of [
      ["r1", -1, -1, f],
      ["l1", 1, 1, f],
      ["r2", -1, 1, b],
      ["l2", 1, -1, b],
    ] as ["l1" | "l2" | "r1" | "r2", number, number, Vec3][])
      if (input[key]) {
        car.active[key] = true;
        if (source) {
          sourceAcceleration(
            car,
            key === "r1" ? 1 : key === "l1" ? 2 : key === "r2" ? 3 : 4,
          );
        } else {
          car.heading += yaw * m.rotation * UNIT;
          const thrust = Math.trunc(
            (((side * (m.side - (speed >> 4))) >> 2) * 128) / m.weight,
          );
          vector[0] += Math.round(sz * thrust);
          vector[2] -= Math.round(sx * thrust);
        }
      }
    if (source) {
      sourceRotation(car, car.sourceContact!.normal);
      rebuildSourceMatrices(car);
    } else {
      if (m.rudder && speed >= 5)
        car.heading -= Math.trunc(car.rudderAngle / m.rudder) * UNIT;
      if (car.grip) {
        const [nx, ny, nz] = near.normal;
        const along = nx * Math.sin(car.heading) + nz * Math.cos(car.heading);
        const across = nx * Math.cos(car.heading) - nz * Math.sin(car.heading);
        const forwardError =
          along * Math.cos(car.pitch) + ny * Math.sin(car.pitch);
        const rightError =
          across * Math.cos(car.roll) +
          (ny * Math.cos(car.pitch) - along * Math.sin(car.pitch)) *
            Math.sin(car.roll);
        // CAR_CTR2.C car_rotation: normal in ship coordinates, 40-unit
        // deadband, and integer one-degree steps. Corner bank is additive.
        if (Math.abs(rightError) < 600)
          car.roll +=
            ((speed * Math.trunc(-angle(car.heading - oldHeading) / UNIT)) >>
              8) *
            UNIT;
        if (forwardError > 40) car.pitch -= 11 * UNIT;
        if (forwardError < -40) car.pitch += 11 * UNIT;
        if (rightError > 40) car.roll -= 11 * UNIT;
        if (rightError < -40) car.roll += 11 * UNIT;
      } else car.roll -= clamp(car.roll, -5 * UNIT, 5 * UNIT);
    }
    // car_action tests warning after thrust/rotation and before wall damage.
    // car_enemy does not add the warning attribute, even for a lev=0 driver.
    car.warningActive =
      racing &&
      !car.cpuLevel &&
      !car.ghost &&
      m.tank - car.damage < m.tank >> 3 &&
      car.reason !== "course-out" &&
      car.reason !== "destroyed";
    if (source) {
      // car_chipeffect sets goal_count during the finish tick, but the
      // current call remains car_action until the following frame.
      sourceMove(
        car,
        node,
        racing && car.reason !== "finish",
        !!car.cpuLevel || !racing,
      );
    } else {
      const nx = car.x + (f[0] + b[0]) / 1600,
        nz = car.z + (f[2] + b[2]) / 1600;
      const next = nearest(track, nx, nz, car.index);
      // The source offsets each wall by 128/256 PS1 units, independent of width.
      const margin = 2.56;
      const right = next.lane > 0.5;
      const edgeHeight = right ? next.ry : next.ly;
      const crossed =
        near.lane >= 0 &&
        near.lane <= 1 &&
        (next.lane * next.width < margin ||
          (1 - next.lane) * next.width < margin) &&
        (right ? near.lane < next.lane : near.lane > next.lane) &&
        (car.y < edgeHeight + 7.12 || !!car.cpuLevel);
      car.x = nx;
      car.z = nz;
      car.y -= (f[1] + b[1]) / 1600;
      if (crossed) {
        const node = track.nodes[next.index],
          end = node.end || track.nodes[(next.index + 1) % track.nodes.length];
        const startEdge = right ? node.r : node.l,
          endEdge = right ? end.r : end.l;
        const edge = endEdge.map(
          (v, k) => (v - startEdge[k]) * (k === 1 ? -50 : 50),
        );
        const len = Math.hypot(edge[0], edge[2]) || 1;
        const tx = edge[0] / len,
          tz = edge[2] / len,
          hr = car.cpuLevel || !racing ? 0 : (speed >> 4) + 3,
          normalX = (right ? -1 : 1) * tz,
          normalZ = (right ? 1 : -1) * tx;
        let projection = Math.trunc(
          (64 * (edge[0] * f[0] + edge[1] * f[1] + edge[2] * f[2])) /
            (edge.reduce((s, v) => s + v * v, 0) || 1),
        );
        if (speed > 80 && !car.cpuLevel && racing)
          projection = (projection * 180) >> 8;
        f[0] = b[0] =
          ((edge[0] * projection) >> 6) +
          ((Math.round(normalX * 4096) * hr) >> 8);
        f[2] = b[2] =
          ((edge[2] * projection) >> 6) +
          ((Math.round(normalZ * 4096) * hr) >> 8);
        const distance = (right ? 1 - next.lane : next.lane) * next.width;
        car.x += normalX * (margin - distance + 0.2);
        car.z += normalZ * (margin - distance + 0.2);
        car.damage += 2 * hr * hr + 10;
        car.flash = 0.18;
        car.wallSides = (car.wallSides ?? 0) | (right ? 2 : 1);
        car.events.push("wall");
        if (hr > 16) car.events.push("wall-sound");
        if (!car.cpuLevel)
          emitDebris(car, Math.max(0, hr - 3), 1, [normalX, 0, normalZ]);
      }
    }
    const next = nearest(track, car.x, car.z, car.index);
    let delta = next.distance - car.lastDistance;
    if (delta < -track.length / 2) delta += track.length;
    if (delta > track.length / 2) delta -= track.length;
    if (Math.abs(delta) < Math.max(30, Math.hypot(car.vx, car.vz) / 15))
      car.progress += delta;
    car.lastDistance = next.distance;
    car.index = next.index;
    if (free) car.damage = 0;
    if (car.reason !== "course-out" && car.damage >= m.tank) {
      car.finished = true;
      car.reason = "destroyed";
    }
    sync(car);
  }
  // CAR_CTR.C car_action continues resistance, gravity and wind speed after
  // over becomes negative; course selection and the camera remain frozen.
  export function stepFalling(car: Car) {
    const m = MACHINES[car.type];
    car.warningActive = false;
    car.ticks++;
    car.sourceSpeed = car.sourceContact
      ? sourceSpeed(car.front, car.rear)
      : Math.floor(
          Math.hypot(...car.front.map((v, k) => v + car.rear[k])) /
            Math.sqrt(128),
        );
    const floorBrake = sourceContinuousTile(
      car,
      car.sourceTile ?? car.tile ?? "outside",
    );
    sourceResistance(car, false, floorBrake);
    if (car.sourceContact) {
      sourceGravity(car, car.sourceContact, -256);
      if (!car.cpuLevel) sourceBank(car, car.sourceContact.normal);
    } else {
      const gravity =
        ((m.weight * 3) >> 4) - (Math.round(-car.pitch / UNIT) >> 8);
      car.front[1] += gravity;
      car.rear[1] += gravity;
      car.onRoad = car.grip = false;
    }
    car.turbo = false;
    car.fireTail = car.fireRemaining = Math.max(
      0,
      (car.fireRemaining || 0) - 1,
    );
    car.active = {};
    if (car.sourceContact) {
      car.rudderAngle -=
        Math.sign(car.rudderAngle) * Math.min(22, Math.abs(car.rudderAngle));
      sourceRotation(car, car.sourceContact.normal);
      rebuildSourceMatrices(car);
    } else car.roll -= clamp(car.roll, -5 * UNIT, 5 * UNIT);
    stepDebris(car);
    sync(car);
    if (car.sourcePosition) setSourcePosition(car, nextSourcePosition(car));
    else {
      car.x += car.vx / 60;
      car.y += car.vy / 60;
      car.z += car.vz / 60;
    }
  }
  export function step(
    car: Car,
    track: Track,
    input: Input,
    dt: number,
    free = false,
    racing = true,
  ) {
    // GAME.C keeps car_enemy running after the finish, while total_time
    // and the completed lap records stay fixed. Failures still stop physics.
    const canStep = () => !car.finished || (!racing && car.reason === "finish");
    if (!canStep()) return;
    car.accumulator += dt;
    while (car.accumulator >= 1 / 60 - 1e-9 && canStep()) {
      tick(car, track, input, free, racing);
      car.accumulator -= 1 / 60;
    }
  }
  export function collide(a: Car, b: Car) {
    if (
      a.ghost ||
      b.ghost ||
      (a.finished && a.reason !== "finish") ||
      (b.finished && b.reason !== "finish")
    )
      return;
    const dx = a.x - b.x,
      dy = a.y - b.y,
      dz = a.z - b.z,
      d = Math.floor(Math.hypot(dx, dy, dz) * 100);
    if (d >= 512) return;
    const impact = (Math.abs(a.sourceSpeed - b.sourceSpeed) >> 3) + 200;
    for (const [c, sign] of [
      [a, 1],
      [b, -1],
    ] as [Car, number][]) {
      const force = Math.trunc((impact * 128) / MACHINES[c.type].weight);
      for (const v of [c.front, c.rear]) {
        v[0] += d ? Math.trunc((sign * dx * 100 * force) / d) : 0;
        v[1] -= d ? Math.trunc((sign * dy * 100 * force) / d) : 0;
        v[2] += d ? Math.trunc((sign * dz * 100 * force) / d) : 0;
      }
      if (!c.cpuLevel) {
        c.damage += force + 300;
        c.events.push("collision");
        emitDebris(c, 8, 2, [0, 0, 1]);
      }
      c.flash = 0.1;
      sync(c);
    }
  }
  // GAME.C add_crash_chip / crash_chip: 48 ticks, inertia /16, gravity 16.
  export function emitDebris(
    car: Car,
    count: number,
    spread: number,
    normal: Vec3,
  ) {
    car.debris ||= [];
    let seed =
      (car.ticks * 1664525 + car.type * 1013904223 + car.debris.length) >>> 0;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed & 511;
    };
    for (let i = 0; i < Math.min(count, 64); i++) {
      const v = [rand(), rand(), rand()].map((n) => (n - 256) * 2 ** spread);
      const dot = v[0] * normal[0] + v[1] * normal[1] + v[2] * normal[2];
      for (let j = 0; j < 3; j++) v[j] -= (normal[j] * dot) / 2;
      car.debris.push({
        x: car.x,
        y: car.y,
        z: car.z,
        vx: v[0],
        vy: v[1],
        vz: v[2],
        life: 48,
        seed,
      });
    }
    car.debris = car.debris.slice(-64);
  }
  export function stepDebris(car: Car) {
    car.debris = (car.debris || []).filter((p) => --p.life > 0);
    for (const p of car.debris) {
      p.vy -= 16;
      p.x += p.vx / 1600;
      p.y += p.vy / 1600;
      p.z += p.vz / 1600;
    }
  }
  // Resolve each unordered pair once, including CPU/CPU pairs.
  export function collideAll(cars: Car[]) {
    for (let i = 0; i < cars.length; i++)
      for (let j = i + 1; j < cars.length; j++) collide(cars[i], cars[j]);
  }
  // GAME.C lev[difficulty + 1][course], CAR_CTR.C car_init.
  export const cpuLevels = [
    [1, 1, 2, 3, 4, 5, 6, 4, 6],
    [2, 2, 3, 4, 5, 6, 7, 5, 7],
    [4, 4, 4, 7, 6, 7, 8, 6, 8],
    [10, 8, 6, 9, 8, 10, 10, 8, 10],
  ];
  export function cpuMaxSpeed(level: number, slot: number) {
    return [350, 330, 310, 260][slot] * 2 - (10 - level) * 20;
  }
  export function driveCPU(car: Car, track: Track, player: Car): Input {
    car.catchUp =
      car.ticks > 600 && player.linePosition - car.linePosition > -4;
    // Steering still adapts the converted track geometry; speed/assistance
    // use original source units rather than the old 80/87/94 world-unit caps.
    const input = drive(car, track, Infinity);
    // CAR_CTR.C car_control: lev==0 clears thrust/side boosters and brakes.
    // Only a GP winner changes to lev=10.
    if (car.cpuLevel === 0) return { steer: input.steer, brake: true };
    input.accel =
      input.accel &&
      !input.brake &&
      car.sourceSpeed < cpuMaxSpeed(car.cpuLevel!, car.cpuSlot!);
    // Restore the source controller's wall-clearance strafe. Without it the
    // look-ahead steering can balance against a wall indefinitely at a bend.
    const near = nearest(track, car.x, car.z, car.index);
    if (car.sourceSpeed < 200 && (near.lane < 0.2 || near.lane > 0.8)) {
      const headingError = angle(near.heading - car.heading);
      if (Math.abs(headingError) > 0.1) {
        input.steer = Math.sign(headingError);
        input.l1 = input.r2 = headingError > 0;
        input.r1 = input.l2 = headingError < 0;
        input.accel = false;
      } else {
        input.l1 = input.l2 = near.lane < 0.2;
        input.r1 = input.r2 = near.lane > 0.8;
      }
    }
    return input;
  }
  export function cameraStep(
    current: { yaw: number; pitch: number; roll: number; distance: number },
    car: Pose,
    startCount = 0,
    replayMode = 0,
  ) {
    const follow = (
      value: number,
      target: number,
      step: number,
      divisor: number,
    ) => {
      const difference = angle(target - value) / UNIT;
      return (
        value +
        (Math.abs(difference) <= step
          ? difference
          : Math.sign(difference) *
            step *
            (1 + Math.trunc(Math.abs(difference) / divisor))) *
          UNIT
      );
    };
    const yawTarget =
      car.heading +
      (replayMode === 17 ? Math.PI : 0) -
      Math.max(0, startCount - 120) * 16 * UNIT;
    // view_set snaps to the ship heading (without the start offset) when
    // the wrapped error is within the five-unit step.
    current.yaw =
      Math.abs(angle(yawTarget - current.yaw) / UNIT) <= 5
        ? car.heading + (replayMode === 17 ? Math.PI : 0)
        : follow(current.yaw, yawTarget, 5, Math.trunc((4096 * 6) / 360));
    current.pitch = follow(
      current.pitch,
      car.pitch || 0,
      1,
      Math.trunc((4096 * 12) / 360),
    );
    const roll = angle((car.roll || 0) - current.roll) / UNIT;
    current.roll +=
      Math.sign(roll) *
      (Math.abs(roll) > Math.trunc((4096 * 30) / 360)
        ? 5
        : Math.abs(roll) > 0
          ? 1
          : 0) *
      UNIT;
    const increment = replayMode ? 8 : 16;
    const target = (car.sourceSpeed || 0) * (replayMode ? 1 : 2);
    if (current.distance > target + increment) current.distance -= increment;
    if (current.distance < target - increment) current.distance += increment;
  }
  // Generic autopilot, also used by circuit completion tests.
  export function drive(car: Car, track: Track, pace = 70): Input {
    const speed = Math.hypot(car.vx, car.vz),
      near = nearest(track, car.x, car.z, car.index),
      p = at(track, near.distance + Math.max(20, speed * 0.45)),
      err = angle(Math.atan2(p.x - car.x, p.z - car.z) - car.heading),
      drift = angle(car.heading - Math.atan2(car.vx, car.vz)),
      turn = clamp(err * 3 + drift * 0.5, -1, 1),
      thrusterThreshold = MACHINES[car.type].rudder ? 0.5 : 0.06;
    return {
      accel: speed < pace && Math.abs(err) < 1,
      steer: Math.abs(turn) > 0.06 ? Math.sign(turn) : 0,
      brake: (Math.abs(err) > 0.3 && speed > 35) || speed > pace + 20,
      l1: turn > thrusterThreshold,
      r2: turn > thrusterThreshold,
      r1: turn < -thrusterThreshold,
      l2: turn < -thrusterThreshold,
    };
  }
}
Object.assign(typeof window !== "undefined" ? window : globalThis, {
  HoverEngine,
});
if (typeof module !== "undefined") module.exports = HoverEngine;
