// MENU_ETC.C / GP1_MAIN.C: original title tree and selection order.
export type MenuScreen =
  | "title"
  | "gp"
  | "option"
  | "record-kind"
  | "car"
  | "course"
  | "record-detail"
  | "records";
interface MenuHooks {
  mode(value: string): void;
  change(kind: "machine" | "course", delta: number): void;
  start(): void;
  fullscreen(): boolean | null;
  toggleFullscreen(): void;
  soundEnabled(): boolean;
  toggleSound(): void;
  sound(kind: "move" | "ok" | "cancel"): void;
  music(name: string | null): void;
}
const lists: Partial<Record<MenuScreen, string[]>> = {
  title: ["GRANDPRIX", "TIME ATTACK", "OPTION"],
  gp: ["Blue GP", "Yellow GP", "Red GP", "PRACTICE"],
  option: [],
  "record-kind": ["GRANDPRIX'S", "TIME ATTACK'S"],
};
const captions: Partial<Record<MenuScreen, string>> = {
  gp: "GRANDPRIX",
  option: "OPTION",
  "record-kind": "VIEW RECORDS",
};
const parent: Partial<Record<MenuScreen, [MenuScreen, number]>> = {
  gp: ["title", 0],
  option: ["title", 2],
  "record-kind": ["option", 0],
  records: ["record-kind", 0],
};
const field = (id: string) => document.getElementById(id) as HTMLSelectElement;
export class OriginalMenu {
  screen: MenuScreen = "title";
  selected = 0;
  entered = performance.now();
  mode = "time";
  recordClass = "gp";
  recordCourse = 0;
  recordFrames = 0;
  panel: HTMLElement;
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  buttons: HTMLElement;
  caption: HTMLElement;
  font = new Image();
  portraits = new Image();
  palettes = new Map<string, HTMLCanvasElement>();
  curves: number[][][] = [];
  padHeld = new Set<string>();
  get usesListLayout() {
    return lists[this.screen] !== undefined;
  }
  get usesDemoBackdrop() {
    return (
      this.usesListLayout ||
      this.screen === "records" ||
      this.screen === "record-detail"
    );
  }
  constructor(public hooks: MenuHooks) {
    this.panel = document.getElementById("menu")!;
    this.panel.replaceChildren();
    this.canvas = document.createElement("canvas");
    this.canvas.id = "original-menu";
    this.canvas.width = 320;
    this.canvas.height = 240;
    this.canvas.setAttribute("aria-hidden", "true");
    this.g = this.canvas.getContext("2d")!;
    this.buttons = document.createElement("nav");
    this.buttons.setAttribute("aria-label", "ゲームメニュー");
    const titleLayout = document.createElement("div");
    titleLayout.className = "title-layout";
    const title = document.createElement("h1");
    title.className = "title-brand";
    const wordmark = document.createElement("img");
    wordmark.src = "quad-thrust.svg";
    wordmark.alt = "QUAD THRUST";
    title.append(wordmark);
    this.caption = document.createElement("h2");
    this.caption.className = "menu-caption";
    const guide = document.createElement("div");
    guide.className = "title-guide";
    guide.innerHTML =
      '<span><span class="guide-arrows">↑ ↓</span> SELECT</span><span><kbd>ENTER</kbd> CONFIRM</span><span class="back-guide"><kbd>ESC</kbd> BACK</span>';
    titleLayout.append(title, this.caption, this.buttons, guide);
    this.panel.append(this.canvas, titleLayout);
    this.font.src = "assets/font.png";
    this.portraits.src = "assets/minicars.png";
    // car_select_init: 136 samples, three simulation ticks per graph pixel.
    this.curves = HoverEngine.MACHINES.map((m) =>
      [false, true].map((turbo) => {
        let inertia = 0,
          speed = 0;
        const values: number[] = [];
        for (let i = 0; i < 408; i++) {
          // car_select_init records the last value of each three-tick group.
          values[Math.floor(i / 3)] = (speed * 26) >> 8;
          speed = Math.floor(Math.abs(inertia * 2) / Math.sqrt(128));
          let thrust = (m.accel - ((m.falloff * speed) >> 6)) >> 2;
          if (turbo)
            thrust += Math.max(
              0,
              (m.turbo - ((m.turboFall * speed) >> 4)) >> 2,
            );
          if (speed <= 2000) inertia += Math.trunc((thrust * 128) / m.weight);
          const drag = Math.trunc((speed * m.drag) / (m.weight * (speed + 1)));
          inertia -= (inertia * drag) >> 13;
        }
        values[159] = Math.floor(speed / 2);
        return values;
      }),
    );
    this.show("title");
  }
  tick() {
    if (this.screen === "record-detail")
      this.recordFrames = (this.recordFrames + 1) % 1320;
  }
  show(screen: MenuScreen, selected = 0) {
    const restoreFocus =
      this.screen === screen && this.buttons.contains(document.activeElement);
    document.getElementById("fullscreen-status")!.hidden = true;
    this.recordFrames = 0;
    const fullscreen = this.hooks.fullscreen();
    lists.option = [
      "VIEW RECORDS",
      `SOUND: ${this.hooks.soundEnabled() ? "ON" : "OFF"}`,
      ...(fullscreen === null
        ? []
        : [`FULLSCREEN: ${fullscreen ? "ON" : "OFF"}`]),
    ];
    lists.gp = ["Blue GP", "Yellow GP", "Red GP"]
      .slice(0, HoverRules.availableCups())
      .concat("PRACTICE");
    this.screen = screen;
    this.selected = selected;
    this.entered = performance.now();
    this.panel.dataset.screen = screen;
    this.panel.dataset.presentation = this.usesListLayout
      ? "list"
      : this.usesDemoBackdrop
        ? "records"
        : "original";
    this.panel.dataset.count = String(lists[screen]?.length || 0);
    this.caption.textContent = captions[screen] || "";
    this.buttons.replaceChildren();
    if (lists[screen])
      lists[screen]!.forEach((label, i) => {
        const count = lists[screen]!.length;
        const y =
          count > 4
            ? 116 + i * 20
            : count === 2
              ? 140 + i * 32
              : count === 3
                ? 124 + i * 32
                : 124 + i * 24;
        this.button(
          label,
          160 - label.length * 8,
          y,
          label.length * 16,
          16,
          () => {
            this.selected = i;
            this.confirm();
          },
          i,
        );
      });
    this.syncSelection();
    this.draw();
    if (restoreFocus) this.focusSelection();
  }
  button(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    click: () => void,
    index?: number,
  ) {
    const b = document.createElement("button");
    b.textContent = label;
    b.setAttribute("aria-label", label);
    if (!this.usesListLayout)
      b.style.cssText = `left:${x / 3.2}%;top:${y / 2.4}%;width:${w / 3.2}%;height:${h / 2.4}%`;
    b.onclick = click;
    if (index !== undefined) {
      b.dataset.index = String(index);
      b.onfocus = () => {
        this.selected = index;
        this.syncSelection();
      };
    }
    this.buttons.append(b);
  }
  syncSelection() {
    this.buttons
      .querySelectorAll<HTMLButtonElement>("[data-index]")
      .forEach((b) =>
        b.setAttribute(
          "aria-current",
          String(+b.dataset.index! === this.selected),
        ),
      );
  }
  focusSelection() {
    this.buttons
      .querySelector<HTMLButtonElement>(`[data-index="${this.selected}"]`)
      ?.focus({ preventScroll: true });
  }
  move(delta: number) {
    this.hooks.sound("move");
    if (lists[this.screen])
      this.selected = Math.max(
        0,
        Math.min(lists[this.screen]!.length - 1, this.selected + delta),
      );
    else if (this.screen === "car") this.hooks.change("machine", delta);
    else if (this.screen === "course") this.hooks.change("course", delta);
    else if (this.screen === "records")
      this.selected = Math.max(0, Math.min(8, this.selected + delta));
    this.syncSelection();
    if (this.buttons.contains(document.activeElement)) this.focusSelection();
  }
  choose(mode: string) {
    this.mode = mode;
    this.hooks.mode(mode);
    this.hooks.music("SELECT");
    this.show("car");
  }
  confirm() {
    this.hooks.sound("ok");
    const i = this.selected;
    switch (this.screen) {
      case "title":
        if (i === 0) this.show("gp");
        if (i === 1) this.choose("time");
        if (i === 2) this.show("option");
        break;
      case "gp":
        this.choose(i === HoverRules.availableCups() ? "practice" : "gp" + i);
        break;
      case "option":
        if (i === 0) this.show("record-kind");
        if (i === 1) {
          this.hooks.toggleSound();
          this.show("option", i);
        }
        if (i === 2) this.hooks.toggleFullscreen();
        break;
      case "record-kind":
        this.recordClass = i === 0 ? "gp" : "time";
        this.show("records");
        break;
      case "car":
        if (this.mode.startsWith("gp")) this.hooks.start();
        else this.show("course");
        break;
      case "course":
        this.hooks.start();
        break;
      case "records":
        this.recordCourse = this.selected;
        this.show("record-detail");
        break;
      case "record-detail":
        this.recordFrames = this.recordFrames < 660 ? 690 : 0;
        break;
    }
  }
  back() {
    this.hooks.sound("cancel");
    if (this.screen === "course") this.show("car");
    else if (this.screen === "car") {
      this.hooks.music(null);
      this.show(
        this.mode.startsWith("gp") || this.mode === "practice" ? "gp" : "title",
        this.mode.startsWith("gp")
          ? +this.mode.slice(2)
          : this.mode === "practice"
            ? HoverRules.availableCups()
            : 1,
      );
    } else if (this.screen === "record-detail")
      this.show("records", this.recordCourse);
    else if (parent[this.screen]) {
      const [screen, i] = parent[this.screen]!;
      this.show(
        screen,
        this.screen === "records" ? +(this.recordClass === "time") : i,
      );
    }
  }
  key(code: string) {
    if (["ArrowUp", "ArrowLeft"].includes(code)) this.move(-1);
    else if (["ArrowDown", "ArrowRight"].includes(code)) this.move(1);
    else if (["Enter", "Space", "KeyZ"].includes(code)) this.confirm();
    else if (["Escape", "Backspace", "KeyX"].includes(code)) this.back();
  }
  gamepad(dispatch = true) {
    const p = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    const active = new Set<string>();
    if (p) {
      if (p.buttons[12]?.pressed || p.axes[1] < -0.5) active.add("ArrowUp");
      if (p.buttons[13]?.pressed || p.axes[1] > 0.5) active.add("ArrowDown");
      if (p.buttons[14]?.pressed || p.axes[0] < -0.5) active.add("ArrowLeft");
      if (p.buttons[15]?.pressed || p.axes[0] > 0.5) active.add("ArrowRight");
      if (p.buttons[0]?.pressed) active.add("Enter");
      if (p.buttons[9]?.pressed) active.add("Enter");
      if (p.buttons[1]?.pressed) active.add("Escape");
    }
    for (const code of active)
      if (dispatch && !this.padHeld.has(code)) this.key(code);
    this.padHeld = active;
  }
  text(text: string, x: number, y: number, size = 8, color = "white") {
    if (!this.font.complete || !this.font.naturalWidth) return;
    let image = this.palettes.get(color);
    if (!image) {
      image = document.createElement("canvas");
      image.width = 256;
      image.height = 128;
      const ctx = image.getContext("2d")!;
      ctx.drawImage(this.font, 0, 0);
      if (color !== "white") {
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 256, 128);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(this.font, 0, 0);
      }
      this.palettes.set(color, image);
    }
    for (const c of text) {
      const t = (size === 16 ? c.toUpperCase() : c).charCodeAt(0) - 32;
      if (t >= 0 && t < 96)
        this.g.drawImage(
          image,
          size === 8 ? Math.floor(t / 16) * 8 : 128 + Math.floor(t / 8) * 16,
          size === 8 ? (t % 16) * 8 : (t % 8) * 16,
          size,
          size,
          Math.round(x),
          Math.round(y),
          size,
          size,
        );
      x += size;
    }
  }
  time(t?: number) {
    if (t === undefined) return "--'--\"--";
    const n = Math.floor((Math.round(t * 60) * 100) / 60);
    return `${String(Math.floor(n / 6000)).padStart(2, "0")}'${String(Math.floor(n / 100) % 60).padStart(2, "0")}"${String(n % 100).padStart(2, "0")}`;
  }
  courseName(i: number) {
    return `${Math.floor(i / 3) + 1}-${(i % 3) + 1} ${HOVER_TRACKS[i].name.replace("’", "'")}`;
  }
  draw() {
    const g = this.g;
    g.clearRect(0, 0, 320, 240);
    g.imageSmoothingEnabled = false;
    const list = lists[this.screen];
    if (this.screen === "car") {
      const type = +field("machine").value,
        m = HoverEngine.MACHINES[type];
      this.text(m.name[0] + m.name.slice(1).toLowerCase(), 16, 56, 16);
      const labels = [
        "Booster",
        "Slaster",
        "Radder",
        "Resistance",
        "Turbo",
        "Weight",
        "Power",
      ];
      const props = HoverEngine.MACHINES.slice(
        0,
        HoverRules.machineCount(),
      ).map((m) => [
        m.accel - m.falloff * 8,
        m.side,
        m.rudder ? m.rotation + 227 / m.rudder : 0,
        m.drag,
        m.turbo - m.turboFall * 4,
        m.weight,
        m.tank,
      ]);
      labels.forEach((label, i) => {
        g.fillStyle = "#000080";
        g.fillRect(
          176,
          152 + i * 12,
          (152 * props[type][i]) / Math.max(...props.map((p) => p[i])),
          8,
        );
        this.text(label, 176, 152 + i * 12);
      });
      this.curves[type].forEach((curve, j) => {
        g.strokeStyle = j ? "red" : "white";
        g.beginPath();
        curve
          .slice(0, 136)
          .forEach((v, i) =>
            i ? g.lineTo(176 + i, 136 - v) : g.moveTo(176 + i, 136 - v),
          );
        g.stroke();
      });
      this.text("MAX SPEED", 208, 112);
      this.text("MAX TURBO", 208, 132);
      this.text(Math.round(this.curves[type][0][159]) + "Km/h", 256, 122);
      this.text(Math.round(this.curves[type][1][159]) + "Km/h", 256, 142);
    } else if (this.screen === "course") {
      const course = +field("course").value;
      this.text(this.courseName(course), 16, 56, 16);
      ["lap", "total"].forEach((kind, i) => {
        const row = HoverRecords.read(
          this.mode === "time" ? "time" : "gp",
          course,
          kind,
        )[0];
        this.text(i ? "TOTAL RECORD" : "BESTLAP RECORD", 8 + i * 176, 192);
        this.text(
          this.time(row?.time) + " " + (row?.name || "---"),
          32 + i * 176,
          204,
        );
        if (row)
          this.text(HoverEngine.MACHINES[row.machine].name, 32 + i * 176, 216);
      });
    } else if (this.screen === "records") {
      this.text("BEST RECORDS", 8, 0, 16, "red");
      HOVER_TRACKS.forEach((_, i) => {
        const row = HoverRecords.read(
          this.recordClass as "gp" | "time",
          i,
          "lap",
        )[0];
        this.text(
          this.courseName(i),
          16,
          24 + i * 24,
          8,
          i === this.selected ? "#00ff00" : "white",
        );
        const total = HoverRecords.read(
          this.recordClass as "gp" | "time",
          i,
          "total",
        )[0];
        // OTR_MODE.C view_records: draw_minicar(..., 2048) halves the
        // 24x16 portrait beside each course's BEST LAP and TOTAL record.
        [row, total].forEach((record, line) => {
          const y = 24 + i * 24 + line * 10;
          this.text(
            `${this.time(record?.time)} ${record?.name || "---"}`,
            184,
            y,
            8,
            i === this.selected ? "#00ff00" : "white",
          );
          if (record && this.portraits.complete && this.portraits.naturalWidth)
            g.drawImage(
              this.portraits,
              0,
              record.machine * 16,
              24,
              16,
              160,
              y,
              12,
              8,
            );
        });
      });
    } else if (this.screen === "record-detail") {
      // OTR_MODE.C view_records2: alternate BESTLAP and TOTAL over a live
      // four-car course view, including DRAW_SP.C's original 24x16 portraits.
      const frame = this.recordFrames;
      const kind = frame < 660 ? "lap" : "total";
      if ((frame >= 60 && frame < 660) || frame >= 720) {
        this.text(
          kind === "lap" ? "BESTLAP RECORDS" : "TOTAL RECORDS",
          8,
          16,
          16,
        );
        const rows = HoverRecords.read(
          this.recordClass as "gp" | "time",
          this.recordCourse,
          kind,
        );
        for (let i = 0; i < 6; i++) {
          this.text(
            `${this.time(rows[i]?.time)} ${rows[i]?.name || "---"}`,
            80,
            48 + i * 32,
            16,
          );
          if (rows[i] && this.portraits.complete && this.portraits.naturalWidth)
            g.drawImage(
              this.portraits,
              0,
              rows[i].machine * 16,
              24,
              16,
              40,
              48 + i * 32,
              24,
              16,
            );
        }
      }
    }
    this.panel.setAttribute(
      "aria-label",
      `${this.screen}: ${list?.[this.selected] || (this.screen === "car" ? field("machine").selectedOptions[0]?.text : "選択画面")}`,
    );
  }
}
