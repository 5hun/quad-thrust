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
    let ids =
      hint === null
        ? track.nodes.map((_, i) => i)
        : Array.from({ length: 25 }, (_, j) => (hint + j - 12 + n) % n);
    for (const i of ids) {
      let p = track.nodes[i],
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
        let wx = r[0] - l[0],
          wz = r[2] - l[2],
          lane = ((x - l[0]) * wx + (z - l[2]) * wz) / (wx * wx + wz * wz || 1);
        best = {
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
    let near = nearest(track, car.x, car.z, car.index);
    car.index = near.index;
    const inside = near.lane >= 0 && near.lane <= 1;
    const surface = mix(near.ly, near.ry, clamp(near.lane, 0, 1)),
      target = surface + 2;
    car.groundY = surface;
    car.grip = inside && car.y <= target + 1.5 && car.y >= surface - 1;
    const ch = inside ? near.tile : "outside";
    car.tile = ch;
    car.turbo = !!input.turbo && m.turbo > 0;
    if (car.grip) {
      if (ch === "d") car.damage += 100;
      if (ch === "B") car.damage += 100000;
    }
    if (ch !== car.previousTile && car.grip) {
      if (track.training && ch === "g") car.events.push("goal");
      if (track.training && ch === "s") car.events.push("stop");
      if (ch === "P") {
        car.damage = Math.max(0, car.damage - 6000);
        car.events.push("repair");
      }
      if (ch === "J") {
        if (track.training) f[1] = b[1] = 0;
        f[1] -= 1500;
        b[1] -= 1500;
        car.events.push("jump");
      }
      if (ch === ">") {
        for (const v of [f, b]) {
          v[0] += Math.trunc(near.dx * 100);
          v[1] -= Math.trunc(near.dy * 100);
          v[2] += Math.trunc(near.dz * 100);
        }
        car.events.push("boost");
      }
    }
    car.previousTile = ch;
    const drag = Math.trunc((speed * m.drag) / (m.weight * (speed + 1))),
      horizontal =
        drag + (input.brake ? 240 : 0) + (ch === "*" && car.grip ? 240 : 0);
    for (const v of [f, b])
      for (let j = 0; j < 3; j++) {
        const old = v[j];
        v[j] -= (v[j] * (j === 1 ? drag : horizontal)) >> 13;
        if (old * v[j] < 0) v[j] = 0;
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
      let lift = Math.max(
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
    if (car.grip) {
      const slope = near.slope,
        sideSlope = (near.ry - near.ly) / near.width,
        dx = Math.sin(near.heading),
        dz = Math.cos(near.heading);
      const normalScale =
        4096 / Math.sqrt(1 + slope * slope + sideSlope * sideSlope);
      for (const v of [f, b]) {
        v[0] += Math.trunc(
          ((-slope * dx - sideSlope * dz) * normalScale * m.weight) / 16384,
        );
        v[2] += Math.trunc(
          ((-slope * dz + sideSlope * dx) * normalScale * m.weight) / 16384,
        );
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
      const desiredPitch = Math.atan(
        near.slope * Math.cos(car.heading - near.heading),
      );
      car.pitch += clamp(desiredPitch - car.pitch, -11 * UNIT, 11 * UNIT);
      const bank = clamp(
        -(car.heading - oldHeading) * speed * 0.004,
        -0.5,
        0.5,
      );
      car.roll += clamp(bank - car.roll, -11 * UNIT, 11 * UNIT);
    } else car.roll *= 0.985;
    const nx = car.x + (f[0] + b[0]) / 1600,
      nz = car.z + (f[2] + b[2]) / 1600;
    let next = nearest(track, nx, nz, car.index);
    const crossed =
      inside &&
      (next.lane < 0.025 || next.lane > 0.975) &&
      car.y < surface + 6.12;
    car.x = nx;
    car.z = nz;
    car.y -= (f[1] + b[1]) / 1600;
    if (crossed) {
      const right = next.lane > 0.5,
        tx = Math.sin(next.heading),
        tz = Math.cos(next.heading),
        hr = (speed >> 4) + 3,
        normalX = (right ? -1 : 1) * tz,
        normalZ = (right ? 1 : -1) * tx;
      let tangent = (f[0] * tx + f[2] * tz) * (speed > 80 ? 180 / 256 : 1);
      f[0] = b[0] = Math.round(tangent * tx + normalX * hr * 16);
      f[2] = b[2] = Math.round(tangent * tz + normalZ * hr * 16);
      const offset = (right ? 1 : -1) * (next.width / 2 - 1.5);
      car.x = next.x + tz * offset;
      car.z = next.z - tx * offset;
      car.damage += 2 * hr * hr + 10;
      car.flash = 0.18;
      car.events.push("wall");
    }
    let delta = next.distance - car.lastDistance;
    if (delta < -track.length / 2) delta += track.length;
    if (delta > track.length / 2) delta -= track.length;
    if (Math.abs(delta) < Math.max(30, Math.hypot(car.vx, car.vz) / 15))
      car.progress += delta;
    car.lastDistance = next.distance;
    car.index = next.index;
    if (
      !track.training &&
      car.progress >= (car.laps.length + 1) * track.length
    ) {
      car.laps.push(car.time - car.lapStart);
      car.lapStart = car.time;
      if (car.laps.length >= 3 && !free) {
        car.finished = true;
        car.reason = "finish";
      }
    }
    if (free) car.damage = 0;
    if (car.damage >= m.tank) {
      car.finished = true;
      car.reason = "destroyed";
    }
    if (
      (!inside && car.y < surface - 70) ||
      (inside && car.y < surface - 6.12)
    ) {
      car.finished = true;
      car.reason = "course-out";
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
    if (a.finished || b.finished || Math.abs(a.y - b.y) > 5.12) return;
    const dx = a.x - b.x,
      dz = a.z - b.z,
      d = Math.hypot(dx, dz);
    if (d >= 5.12 || d === 0) return;
    const impact = (Math.abs(a.sourceSpeed - b.sourceSpeed) >> 3) + 200;
    for (const [c, sign] of [
      [a, 1],
      [b, -1],
    ] as [Car, number][]) {
      const force = Math.trunc((impact * 128) / MACHINES[c.type].weight);
      for (const v of [c.front, c.rear]) {
        v[0] += ((sign * dx) / d) * force;
        v[2] += ((sign * dz) / d) * force;
      }
      c.damage += impact + 300;
      c.flash = 0.1;
      sync(c);
    }
  }
  // Browser CPU uses the same physics; only steering decisions are newly implemented.
  export function drive(car: Car, track: Track, pace = 70): Input {
    const speed = Math.hypot(car.vx, car.vz),
      near = nearest(track, car.x, car.z, car.index),
      p = at(track, near.distance + Math.max(20, speed * 0.45)),
      err = angle(Math.atan2(p.x - car.x, p.z - car.z) - car.heading),
      drift = angle(car.heading - Math.atan2(car.vx, car.vz)),
      turn = clamp(err * 3 + drift * 0.5, -1, 1);
    return {
      accel: speed < pace && Math.abs(err) < 1,
      steer: Math.abs(turn) > 0.06 ? Math.sign(turn) : 0,
      brake: (Math.abs(err) > 0.3 && speed > 35) || speed > pace + 20,
      l1: turn > 0.5,
      r2: turn > 0.5,
      r1: turn < -0.5,
      l2: turn < -0.5,
    };
  }
}
Object.assign(typeof window !== "undefined" ? window : globalThis, {
  HoverEngine,
});
if (typeof module !== "undefined") module.exports = HoverEngine;
