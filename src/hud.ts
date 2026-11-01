// Source: src/hud.ts. Build with npm run build; do not edit dist/hud.js directly.
// Race HUD in the title-menu style. Readouts are DOM elements in #hud; only
// the minimap is a canvas, and it keeps the original machine icons.
export interface HUDFrame {
  car: Car;
  track: Track;
  bots: Car[];
  ghost: Pose | null;
  best: number;
  // Frames left in the countdown, or null once racing.
  countdown: number | null;
  // Machine top speed with turbo, so the speed bar fills at full throttle.
  topSpeed: number;
}

// Matches the warning sound and ship warning light (tank >> 3).
const LOW_ENERGY = 12.5;
// Damage stays visible this long before the lost segment drains.
const LOST_HOLD = 20;
const HIT_FRAMES = 18;
// Lap notices use only the start of lapDraw's 180 frames so they do not
// cover the road for long; CSS fades them out over the same 1.4 seconds.
const LAP_BANNER_FRAMES = 84;
const ORDINAL = ["ST", "ND", "RD", "TH"];

export const hudTime = (t?: number) => {
  if (t === undefined || !Number.isFinite(t)) return "--'--\"--";
  const n = Math.floor((Math.round(t * 60) * 100) / 60);
  return `${String(Math.floor(n / 6000)).padStart(2, "0")}'${String(Math.floor(n / 100) % 60).padStart(2, "0")}"${String(n % 100).padStart(2, "0")}`;
};

// The 3D digits used to spin in 20 frames before each second; the HTML
// digit switches at the same frames so the start timing does not change.
export const countdownDigit = (frames: number) =>
  frames > 200 ? null : frames > 140 ? 3 : frames > 80 ? 2 : 1;

export class RaceHUD {
  root: HTMLElement;
  icons: HTMLImageElement;
  map: HTMLCanvasElement;
  track: Track | null = null;
  path: Path2D | null = null;
  mx = 0;
  mz = 0;
  scale = 1;
  shown: Record<string, string> = {};
  rank = 0;
  lost = 100;
  lostHold = 0;
  hits = { left: 0, right: 0 };
  banner = "";
  digit: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.icons = new Image();
    this.icons.src = "assets/hud-497.png";
    this.map = this.el<HTMLCanvasElement>("hud-map");
    new ResizeObserver(() => this.resizeMap()).observe(this.map);
  }
  el<T extends HTMLElement = HTMLElement>(id: string) {
    return this.root.querySelector<T>("#" + id)!;
  }
  // Writes only on change; the HUD updates every frame.
  set(id: string, text: string) {
    if (this.shown[id] === text) return;
    this.shown[id] = text;
    this.el(id).textContent = text;
  }
  restart(el: HTMLElement, className: string) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }
  reset() {
    this.shown = {};
    this.rank = 0;
    this.lost = 100;
    this.lostHold = 0;
    this.hits = { left: 0, right: 0 };
    this.banner = "";
    this.digit = null;
  }
  resizeMap() {
    const box = this.map.getBoundingClientRect();
    const size = Math.round(box.width * Math.min(2, devicePixelRatio || 1));
    if (size > 0 && this.map.width !== size)
      this.map.width = this.map.height = size;
  }
  mapTrack(track: Track) {
    this.track = track;
    const xs = track.nodes.map((p) => p.x),
      zs = track.nodes.map((p) => p.z);
    this.mx = (Math.max(...xs) + Math.min(...xs)) / 2;
    this.mz = (Math.max(...zs) + Math.min(...zs)) / 2;
    // Unit-square coordinates; drawMap scales them to the canvas.
    this.scale =
      0.86 /
      Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...zs) - Math.min(...zs),
      );
    this.path = new Path2D();
    track.nodes.forEach((p, i) => {
      const [x, y] = this.mapPoint(p);
      if (i) this.path!.lineTo(x, y);
      else this.path!.moveTo(x, y);
    });
    this.path.closePath();
  }
  mapPoint(p: { x: number; z: number }) {
    return [
      0.5 + (p.x - this.mx) * this.scale,
      0.5 - (p.z - this.mz) * this.scale,
    ];
  }
  drawMap(car: Car, bots: Car[], ghost: Pose | null) {
    const g = this.map.getContext("2d")!,
      size = this.map.width;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    if (!this.path) return;
    g.setTransform(size, 0, 0, size, 0, 0);
    g.lineJoin = "round";
    g.strokeStyle = "rgb(0 0 0 / 35%)";
    g.lineWidth = 0.03;
    g.stroke(this.path);
    g.strokeStyle = "rgb(243 250 255 / 70%)";
    g.lineWidth = 0.013;
    g.stroke(this.path);
    const [sx, sy] = this.mapPoint(this.track!.nodes[0]);
    g.fillStyle = "#20e5ec";
    g.fillRect(sx - 0.03, sy - 0.005, 0.06, 0.01);
    if (!this.icons.complete || !this.icons.naturalWidth) return;
    g.imageSmoothingEnabled = false;
    // Other racers and the ghost use their machine icon at a smaller size.
    for (const p of [...bots, ...(ghost ? [ghost] : []), car]) {
      const [x, y] = this.mapPoint(p),
        s = p === car ? 0.08 : 0.047;
      g.save();
      g.translate(x, y);
      g.rotate(p.heading);
      g.globalAlpha = p === ghost ? 0.6 : 1;
      g.drawImage(this.icons, 64 + 8 * p.type, 184, 8, 8, -s / 2, -s / 2, s, s);
      g.restore();
    }
  }
  draw(frame: HUDFrame) {
    const { car, track, bots, ghost } = frame;
    if (this.track !== track) this.mapTrack(track);
    const lap = Math.min(car.laps.length + 1, 3);
    this.set("hud-lap", String(lap));
    this.set("hud-total", hudTime(car.time));
    for (let i = 0; i < 3; i++) {
      const current = i === car.laps.length;
      const t = car.laps[i] ?? (current ? car.time - car.lapStart : undefined);
      this.set(`hud-lap-${i}`, hudTime(t));
      const row = this.el(`hud-lap-row-${i}`);
      row.classList.toggle("current", current);
      row.classList.toggle("pending", i > car.laps.length);
    }
    this.set("hud-best", hudTime(frame.best));

    const position = this.el("hud-position");
    position.hidden = !bots.length;
    if (bots.length) {
      const rank = 1 + bots.filter((b) => b.progress > car.progress).length;
      this.set("hud-rank", String(rank));
      this.set("hud-rank-suffix", ORDINAL[rank - 1]);
      this.set("hud-racers", `/ ${bots.length + 1}`);
      if (this.rank && rank !== this.rank) this.restart(position, "changed");
      this.rank = rank;
    }

    const energy = Math.max(0, Math.min(100, car.energy));
    if (energy >= this.lost) {
      this.lost = energy;
      this.lostHold = LOST_HOLD;
    } else if (this.lostHold > 0) this.lostHold--;
    else this.lost = Math.max(energy, this.lost - 0.6);
    this.set("hud-energy-num", Math.ceil(energy) + "%");
    this.el("hud-energy-fill").style.width = energy + "%";
    this.el("hud-energy-lost").style.width = this.lost + "%";
    const energyBox = this.el("hud-energy");
    energyBox.classList.toggle("low", energy < LOW_ENERGY);
    energyBox.classList.toggle("repair", (car.repairFrames ?? 0) > 0);

    const speed = Math.max(0, car.sourceSpeed >> 1);
    this.set("hud-speed-num", String(speed).padStart(3, "0"));
    this.el("hud-speed-fill").style.width =
      Math.min(100, (100 * speed) / Math.max(1, frame.topSpeed)) + "%";
    this.el("hud-speed").classList.toggle("turbo", !!car.turbo);

    const sides = car.wallSides ?? 0;
    car.wallSides = 0;
    if (sides & 1) this.hits.left = HIT_FRAMES;
    if (sides & 2) this.hits.right = HIT_FRAMES;
    for (const side of ["left", "right"] as const) {
      const hit = this.el(`hud-hit-${side}`);
      hit.style.opacity = String(this.hits[side] / HIT_FRAMES);
      this.hits[side] = Math.max(0, this.hits[side] - 1);
    }

    // Wrong way outranks the lap notice, as both used the same screen area.
    let banner = "";
    if ((car.wrongFrames ?? 0) > 5) banner = "WARNING|WRONG WAY";
    else if (
      (car.lapDraw ?? 0) > 180 - LAP_BANNER_FRAMES &&
      car.laps.length < 3
    )
      banner =
        car.laps.length === 2
          ? "LAP 3 / 3|FINAL LAP"
          : `${3 - car.laps.length} LAPS TO GO|LAP ${lap}`;
    if (banner !== this.banner) {
      const el = this.el("hud-banner");
      el.hidden = !banner;
      if (banner) {
        const [label, text] = banner.split("|");
        this.set("hud-banner-label", label);
        this.set("hud-banner-text", text);
        el.classList.toggle("warn", banner.startsWith("WARNING"));
        this.restart(el, "enter");
      }
      this.banner = banner;
    }

    const digit =
      frame.countdown === null ? null : countdownDigit(frame.countdown);
    if (digit !== this.digit) {
      const el = this.el("hud-countdown");
      el.hidden = digit === null;
      if (digit !== null) {
        this.set("hud-countdown", String(digit));
        this.restart(el, "enter");
      }
      this.digit = digit;
    }

    this.drawMap(car, bots, ghost);
  }
}
