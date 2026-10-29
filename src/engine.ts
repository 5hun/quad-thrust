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
    {
      name: "SUZUKI",
      model: "YAKA_MAN",
      weight: 120,
      accel: 620,
      falloff: 21,
      turbo: 350,
      turboFall: 8,
      side: 0,
      drag: 32000,
      rotation: 22,
      rudder: 20,
      tank: 40000,
      color: "#e16d5e",
      desc: "原作の隠しキャラクター。スラスターは使えません。",
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
    return { ...raw, nodes, length };
  }
  export function at(track: Track, d: number) {
    d = track.training
      ? clamp(d, 0, track.length - 0.001)
      : ((d % track.length) + track.length) % track.length;
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
  export function nearest(
    track: Track,
    x: number,
    z: number,
    hint: number | null = null,
  ): Nearest {
    let best: Nearest | null = null;
    const n = track.nodes.length;
    const ids =
      hint === null
        ? track.nodes.map((_, i) => i)
        : Array.from({ length: 25 }, (_, j) => (hint + j - 12 + n) % n);
    for (const i of ids) {
      const p = track.nodes[i],
        q = p.end || track.nodes[(i + 1) % n],
        dx = q.x - p.x,
        dz = q.z - p.z,
        t = clamp(
          ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz || 1),
          0,
          1,
        ),
        cx = mix(p.x, q.x, t),
        cz = mix(p.z, q.z, t),
        dist = Math.hypot(x - cx, z - cz);
      if (!best || dist < best.dist) {
        const l = p.l.map((v, k) => mix(v, q.l[k], t)),
          r = p.r.map((v, k) => mix(v, q.r[k], t));
        const wx = r[0] - l[0],
          wz = r[2] - l[2],
          lane = ((x - l[0]) * wx + (z - l[2]) * wz) / (wx * wx + wz * wz || 1);
        // CAR_CTR.C car_gravide: plane through the current tile's first
        // vertex, its next longitudinal vertex and its next lateral vertex.
        const row = Math.floor(clamp(lane, 0, 0.9999) * p.tiles.length);
        const a = p.l.map((v, k) => mix(v, p.r[k], row / p.tiles.length));
        const along = q.l.map(
          (v, k) => mix(v, q.r[k], row / p.tiles.length) - a[k],
        );
        const across = p.l.map((v, k) => (p.r[k] - v) / p.tiles.length);
        let normal = [
          along[1] * across[2] - along[2] * across[1],
          along[2] * across[0] - along[0] * across[2],
          along[0] * across[1] - along[1] * across[0],
        ];
        const scale = (normal[1] < 0 ? -1 : 1) / (Math.hypot(...normal) || 1);
        normal = normal.map((v) => Math.round(v * scale * 4096));
        const surface =
          normal[1] === 0
            ? a[1]
            : a[1] -
              (normal[0] * (x - a[0]) + normal[2] * (z - a[2])) / normal[1];
        best = {
          surface,
          normal,
          index: i,
          t,
          x: cx,
          z: cz,
          y: mix(p.y, q.y, t),
          dist,
          width: Math.hypot(wx, wz),
          heading: p.heading,
          distance: p.distance + p.len * t,
          tile: p.tiles[Math.floor(clamp(lane, 0, 0.9999) * p.tiles.length)],
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
  export function tick(car: Car, track: Track, input: Input, free: boolean) {
    const m = MACHINES[car.type],
      f = car.front,
      b = car.rear;
    car.ticks++;
    car.time = car.ticks / 60;
    car.flash = Math.max(0, car.flash - 1 / 60);
    car.recovery = Math.max(0, car.recovery - 1 / 60);
    car.sourceSpeed = Math.floor(
      Math.hypot(f[0] + b[0], f[1] + b[1], f[2] + b[2]) / Math.sqrt(128),
    );
    const speed = car.sourceSpeed;
    if (car.damage > 4) car.damage -= 6 + Math.floor((car.damage * 9) / m.tank);
    const near = nearest(track, car.x, car.z, car.index);
    car.index = near.index;
    let lines = near.index - car.lastLine;
    if (!track.training) {
      if (lines < -track.nodes.length / 2) lines += track.nodes.length;
      if (lines > track.nodes.length / 2) lines -= track.nodes.length;
    }
    car.linePosition += lines;
    car.lastLine = near.index;
    const inside = near.lane >= 0 && near.lane <= 1;
    const surface = near.surface,
      target = surface + 2;
    car.groundY = surface;
    car.groundNormal = near.normal;
    car.onRoad = inside;
    stepDebris(car);
    car.grip = inside && car.y <= target + 1.5 && car.y >= surface - 1;
    const ch = inside ? near.tile : "outside";
    car.tile = ch;
    car.turbo = !!input.turbo && m.turbo > 0;
    if (car.grip) {
      if (ch === "d" && !car.cpuLevel) car.damage += 100;
      if (ch === "B") car.damage += 100000;
    }
    // CAR_CTR.C: g is a line trigger (also active in the air), with a
    // 32-row guard against reversing across the same finish line.
    if (
      !track.training &&
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
      if (track.training && ch === "g") car.events.push("goal");
      if (track.training && ch === "s") car.events.push("stop");
      if (ch === "P" && car.grip) {
        car.damage = Math.max(0, car.damage - 6000);
        car.events.push("repair");
      }
      if (ch === "J" && car.grip) {
        if (track.training) f[1] = b[1] = 0;
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
        for (const v of [f, b]) {
          v[0] += Math.trunc(edge[0] * 100);
          v[1] -= Math.trunc(edge[1] * 100);
          v[2] += Math.trunc(edge[2] * 100);
        }
        car.events.push("boost");
      }
    }
    // In car_chipeffect only J leaves ccc unchanged while airborne, so
    // landing on that same jump tile must still fire the jump.
    if (ch !== "J" || car.grip) car.previousTile = ch;
    const drag = Math.trunc((speed * m.drag) / (m.weight * (speed + 1))),
      horizontal =
        drag +
        (input.brake ? 240 : 0) +
        (ch === "*" && car.grip && !car.cpuLevel ? 240 : 0);
    for (const v of [f, b])
      for (let j = 0; j < 3; j++) {
        const old = v[j];
        v[j] -= (v[j] * (j === 1 ? drag : horizontal)) >> 13;
        if (old * v[j] < 0) v[j] = 0;
      }
    // Test falling before the cushion can snap an already submerged car up.
    if (
      (!inside && car.y <= surface - 68.48) ||
      (inside && car.y <= surface - 4.12)
    ) {
      car.finished = true;
      car.reason = "course-out";
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
    if (input.accel || car.turbo) {
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
    if (!car.grip)
      car.pitch = clamp(
        car.pitch + (input.pitch || 0) * 11 * UNIT,
        (-20 * Math.PI) / 180,
        (20 * Math.PI) / 180,
      );
    car.active = { accel: !!(input.accel || car.turbo) };
    if (car.type !== 5)
      for (const [key, side, yaw, vector] of [
        ["r1", -1, -1, f],
        ["l1", 1, 1, f],
        ["r2", -1, 1, b],
        ["l2", 1, -1, b],
      ] as ["l1" | "l2" | "r1" | "r2", number, number, Vec3][])
        if (input[key]) {
          car.active[key] = true;
          car.heading += yaw * m.rotation * UNIT;
          const thrust = Math.trunc(
            (((side * (m.side - (speed >> 4))) >> 2) * 128) / m.weight,
          );
          vector[0] += Math.round(sz * thrust);
          vector[2] -= Math.round(sx * thrust);
        }
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
          ((speed * Math.trunc(-angle(car.heading - oldHeading) / UNIT)) >> 8) *
          UNIT;
      if (forwardError > 40) car.pitch -= 11 * UNIT;
      if (forwardError < -40) car.pitch += 11 * UNIT;
      if (rightError > 40) car.roll -= 11 * UNIT;
      if (rightError < -40) car.roll += 11 * UNIT;
    } else car.roll -= clamp(car.roll, -5 * UNIT, 5 * UNIT);
    const nx = car.x + (f[0] + b[0]) / 1600,
      nz = car.z + (f[2] + b[2]) / 1600;
    const next = nearest(track, nx, nz, car.index);
    // The source offsets each wall by 128/256 PS1 units, independent of width.
    const margin = 2.56;
    const right = next.lane > 0.5;
    const edgeHeight = right ? next.ry : next.ly;
    const crossed =
      inside &&
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
        hr = car.cpuLevel ? 0 : (speed >> 4) + 3,
        normalX = (right ? -1 : 1) * tz,
        normalZ = (right ? 1 : -1) * tx;
      let projection = Math.trunc(
        (64 * (edge[0] * f[0] + edge[1] * f[1] + edge[2] * f[2])) /
          (edge.reduce((s, v) => s + v * v, 0) || 1),
      );
      if (speed > 80 && !car.cpuLevel) projection = (projection * 180) >> 8;
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
      car.events.push("wall");
      if (hr > 16) car.events.push("wall-sound");
      if (!car.cpuLevel)
        emitDebris(car, Math.max(0, hr - 3), 1, [normalX, 0, normalZ]);
    }
    let delta = next.distance - car.lastDistance;
    if (delta < -track.length / 2) delta += track.length;
    if (delta > track.length / 2) delta -= track.length;
    if (Math.abs(delta) < Math.max(30, Math.hypot(car.vx, car.vz) / 15))
      car.progress += delta;
    car.lastDistance = next.distance;
    car.index = next.index;
    if (free) car.damage = 0;
    if (car.damage >= m.tank) {
      car.finished = true;
      car.reason = "destroyed";
    }
    sync(car);
  }
  export function step(
    car: Car,
    track: Track,
    input: Input,
    dt: number,
    free = false,
  ) {
    if (car.finished) return;
    car.accumulator += dt;
    while (car.accumulator >= 1 / 60 - 1e-9 && !car.finished) {
      tick(car, track, input, free);
      car.accumulator -= 1 / 60;
    }
  }
  export function collide(a: Car, b: Car) {
    if (a.finished || b.finished) return;
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
    const yawTarget = car.heading - Math.max(0, startCount - 120) * 16 * UNIT;
    // view_set snaps to the ship heading (without the start offset) when
    // the wrapped error is within the five-unit step.
    current.yaw =
      Math.abs(angle(yawTarget - current.yaw) / UNIT) <= 5
        ? car.heading
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
    const target = (car.sourceSpeed || 0) * 2;
    if (current.distance > target + 16) current.distance -= 16;
    if (current.distance < target - 16) current.distance += 16;
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
