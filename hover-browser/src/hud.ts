// Source: src/hud.ts. Build with npm run build; do not edit dist/hud.js directly.
// DRAW_SP.C coordinates are centered on a 320 x 240 screen.
export class OriginalHUD {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  images: Record<string, HTMLImageElement>;
  map: HTMLCanvasElement;
  track!: Track;
  mx!: number;
  mz!: number;
  scale!: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d")!;
    this.images = {};
    for (const n of ["hud-487", "hud-497", "hud-red", "font"]) {
      const i = new Image();
      i.src = "assets/" + n + ".png";
      this.images[n] = i;
    }
    this.map = document.createElement("canvas");
    this.map.width = this.map.height = 64;
  }
  sprite(
    u: number,
    v: number,
    w: number,
    h: number,
    x: number,
    y: number,
    palette: number | string = 487,
  ) {
    const i = this.images["hud-" + palette];
    if (i.complete && i.naturalWidth)
      this.g.drawImage(i, u, v, w, h, x, y, w, h);
  }
  text(s: string, x: number, y: number, size = 8) {
    const i = this.images.font;
    if (!i.complete || !i.naturalWidth) return;
    for (const c of s) {
      const t = c.charCodeAt(0) - 32;
      this.g.drawImage(
        i,
        size === 8 ? Math.floor(t / 16) * 8 : 128 + Math.floor(t / 8) * 16,
        size === 8 ? (t % 16) * 8 : (t % 8) * 16,
        size,
        size,
        x,
        y,
        size,
        size,
      );
      x += size;
    }
  }
  time(seconds: number, x: number, y: number) {
    let t = Math.floor((Math.round(seconds * 60) * 100) / 60);
    const s =
      String(Math.floor(t / 6000)).padStart(2, "0") +
      "'" +
      String(Math.floor(t / 100) % 60).padStart(2, "0") +
      '"' +
      String(t % 100).padStart(2, "0");
    for (const c of s) {
      const n = c === "'" ? 10 : c === '"' ? 11 : +c;
      this.sprite(n * 8, 160, 8, 8, x, y);
      x += 8;
    }
  }
  mapTrack(track: Track) {
    this.track = track;
    const xs = track.nodes.map((p) => p.x),
      zs = track.nodes.map((p) => p.z);
    this.mx = (Math.max(...xs) + Math.min(...xs)) / 2;
    this.mz = (Math.max(...zs) + Math.min(...zs)) / 2;
    this.scale = Math.min(
      58 / (Math.max(...xs) - Math.min(...xs)),
      58 / (Math.max(...zs) - Math.min(...zs)),
    );
    const g = this.map.getContext("2d")!;
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = "#808080";
    g.lineWidth = 2;
    g.lineJoin = "round";
    g.beginPath();
    track.nodes.forEach((p, i) => {
      const x = 32 + (p.x - this.mx) * this.scale,
        y = 32 - (p.z - this.mz) * this.scale;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    if (!track.training) g.closePath();
    g.stroke();
  }
  draw(
    car: Car,
    track: Track,
    bots: Car[],
    mode: string,
    best: number,
    state: string,
    countdown: number,
    training: TrainingSession | null = null,
  ) {
    const g = this.g;
    g.clearRect(0, 0, 320, 240);
    g.imageSmoothingEnabled = false;
    if (state === "menu") return;
    const speed = Math.max(0, car.sourceSpeed >> 1);
    String(speed)
      .padStart(3, "0")
      .slice(-3)
      .split("")
      .forEach((d, i) =>
        this.sprite(
          (+d & 7) * 16,
          128 + (+d >> 3) * 16,
          16,
          16,
          232 + i * 16,
          216,
        ),
      );
    this.sprite(32, 144, 32, 16, 280, 216);
    if (training) {
      this.text("TIME", 232, 8);
      this.text(
        String(Math.ceil(training.remaining / 60)).padStart(2, "0"),
        232,
        16,
        16,
      );
    } else {
      this.sprite(64, 144, 40, 8, 8, 8, "red");
      this.time(car.time, 16, 18);
      this.sprite(64, 152, 64, 8, 232, 8, "red");
      const row = car.laps.length % 3;
      for (let i = 0; i < 3; i++) {
        let t = 0;
        if (mode === "free") {
          const completed =
            car.laps.length - 1 - ((car.laps.length - 1 - i + 3) % 3);
          t =
            i === row
              ? car.time - car.lapStart
              : completed >= 0
                ? car.laps[completed]
                : 0;
        } else
          t =
            car.laps[i] ??
            (i === car.laps.length ? car.time - car.lapStart : 0);
        this.time(t, 240, 18 + i * 12);
      }
      if (mode !== "free") {
        this.sprite(64, 168, 64, 8, 232, 58, "red");
        this.time(Number.isFinite(best) ? best : 0, 240, 68);
      }
    }

    if (bots.length) {
      this.sprite(0, 168, 64, 24, 128, 8);
      this.text(
        String(1 + bots.filter((b) => b.progress > car.progress).length),
        128,
        16,
        16,
      );
      this.text("4", 176, 16, 16);
    }
    if (mode !== "free") {
      this.sprite(0, 224, 16, 32, 8, 204, 497);
      const power = Math.max(0, Math.floor((29 * car.energy) / 100));
      this.sprite(16, 254 - power, 8, power, 16, 234 - power, 497);
    }
    if (this.track !== track) this.mapTrack(track);
    const mapY = training ? 0 : 32;
    g.drawImage(this.map, 8, mapY);
    for (const p of [...bots, car]) {
      const x = 40 + (p.x - this.mx) * this.scale,
        y = mapY + 32 - (p.z - this.mz) * this.scale;
      g.save();
      g.translate(Math.round(x), Math.round(y));
      g.rotate(p.heading);
      if (p === car) this.sprite(64 + 8 * p.type, 184, 8, 8, -4, -4, 497);
      else {
        g.fillStyle = "#ddd";
        g.fillRect(-2, -2, 4, 4);
      }
      g.restore();
    }
    if (!training && (car.lapDraw ?? 0) > 0 && mode !== "free") {
      if (car.laps.length === 2) {
        this.sprite(32, 224, 80, 16, 64, 56);
        this.sprite(64, 192, 48, 16, 160, 56);
      } else if (car.laps.length < 3) {
        this.sprite(0, 192, 64, 16, 56, 56);
        this.text(String(3 - car.laps.length), 128, 56, 16);
        this.sprite(64, 192, 64, 16, 168, 56);
      }
    }
    if ((car.wrongFrames ?? 0) > 5 && (car.ticks & 31) < 16)
      this.sprite(0, 208, 128, 16, 16, 64);
  }
}
