// MENU_ETC.C / GP1_MAIN.C: original title tree and selection order.
import {
  VOLUME_STEPS,
  clampVolume,
  decorateVolumeButton,
  volumeLabel,
} from "./volume.js";
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
  volume(): number;
  setVolume(level: number): void;
  sound(kind: "move" | "ok" | "cancel"): void;
}
const lists: Partial<Record<MenuScreen, string[]>> = {
  title: ["GRANDPRIX", "TIME ATTACK", "OPTIONS"],
  gp: ["Blue GP", "Yellow GP", "Red GP", "PRACTICE"],
  option: [],
  "record-kind": ["GRANDPRIX'S", "TIME ATTACK'S"],
};
const captions: Partial<Record<MenuScreen, string>> = {
  gp: "GRANDPRIX",
  option: "OPTIONS",
  "record-kind": "VIEW RECORDS",
};
const parent: Partial<Record<MenuScreen, [MenuScreen, number]>> = {
  gp: ["title", 0],
  option: ["title", 2],
  "record-kind": ["option", 0],
  records: ["record-kind", 0],
};
const OPTION_VOLUME = 2;
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
  machineInfo: HTMLElement;
  courseInfo: HTMLElement;
  displayedRecords = "";
  displayedMachine = -1;
  scrollUp: HTMLButtonElement;
  scrollDown: HTMLButtonElement;
  padHeld = new Set<string>();
  get usesListLayout() {
    return (
      this.screen === "car" ||
      this.screen === "course" ||
      lists[this.screen] !== undefined
    );
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
      '<span><span class="guide-arrows">↑ ↓</span> SELECT</span><button type="button" class="guide-confirm"><kbd>ENTER</kbd> CONFIRM</button><span class="back-guide"><kbd>ESC</kbd> BACK</span>';
    guide.querySelector<HTMLButtonElement>(".guide-confirm")!.onclick = () =>
      this.confirm();
    titleLayout.append(title, this.caption, this.buttons, guide);
    const scrollArrow = (direction: number) => {
      const button = document.createElement("button");
      button.className = "selection-scroll";
      button.dataset.direction = direction < 0 ? "up" : "down";
      button.textContent = direction < 0 ? "⌃" : "⌄";
      button.setAttribute(
        "aria-label",
        direction < 0 ? "一覧を上へ" : "一覧を下へ",
      );
      button.hidden = true;
      button.onclick = () => {
        const items =
          this.buttons.querySelectorAll<HTMLElement>("[data-index]");
        const step =
          items.length > 1 ? items[1].offsetTop - items[0].offsetTop : 0;
        this.buttons.scrollTop += direction * step;
        this.updateScrollArrows();
      };
      titleLayout.append(button);
      return button;
    };
    this.scrollUp = scrollArrow(-1);
    this.scrollDown = scrollArrow(1);
    this.buttons.addEventListener("scroll", () => this.updateScrollArrows());
    new ResizeObserver(() => this.layoutSelectionList()).observe(titleLayout);
    this.machineInfo = document.createElement("section");
    this.machineInfo.className = "machine-info";
    this.machineInfo.setAttribute("aria-label", "車両性能");
    this.machineInfo.setAttribute("aria-live", "polite");
    titleLayout.append(this.machineInfo);
    this.courseInfo = document.createElement("section");
    this.courseInfo.className = "course-records";
    this.courseInfo.setAttribute("aria-label", "コース記録");
    this.courseInfo.setAttribute("aria-live", "polite");
    titleLayout.append(this.courseInfo);
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
      volumeLabel(this.hooks.volume()),
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
    this.panel.dataset.count = String(
      screen === "car"
        ? HoverRules.machineCount()
        : screen === "course"
          ? HOVER_TRACKS.length
          : lists[screen]?.length || 0,
    );
    this.caption.textContent = captions[screen] || "";
    this.buttons.replaceChildren();
    this.buttons.style.removeProperty("height");
    if (screen === "car" || screen === "course") {
      const kind = screen === "car" ? "machine" : "course";
      this.selected = +field(kind).value;
      this.displayedMachine = -1;
      this.displayedRecords = "";
      this.caption.textContent =
        screen === "car" ? "MACHINE SELECT" : "COURSE SELECT";
      const labels =
        screen === "car"
          ? HoverEngine.MACHINES.slice(0, HoverRules.machineCount()).map(
              (m) => m.name,
            )
          : HOVER_TRACKS.map((t) => t.name);
      labels.forEach((label, i) => {
        this.button(
          label,
          0,
          0,
          0,
          0,
          () => {
            if (i !== +field(kind).value) {
              this.hooks.sound("move");
              this.hooks.change(kind, i - +field(kind).value);
            }
            this.selected = i;
            this.syncSelection();
          },
          i,
        );
      });
    }
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
        if (screen === "option" && i === OPTION_VOLUME)
          decorateVolumeButton(
            this.buttons.lastElementChild as HTMLButtonElement,
            this.hooks.volume(),
            (delta) => {
              this.selected = i;
              this.adjustVolume(delta);
            },
          );
      });
    this.layoutSelectionList();
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
        const kind = this.screen === "car" ? "machine" : "course";
        if (
          (this.screen === "car" || this.screen === "course") &&
          index !== +field(kind).value
        ) {
          this.hooks.sound("move");
          this.hooks.change(kind, index - +field(kind).value);
        }
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
    if (this.screen === "car" || this.screen === "course") {
      const selected = this.buttons.querySelector<HTMLElement>(
        `[data-index="${this.selected}"]`,
      );
      if (selected) {
        const top = selected.offsetTop;
        const bottom = top + selected.offsetHeight;
        if (top < this.buttons.scrollTop) this.buttons.scrollTop = top;
        else if (bottom > this.buttons.scrollTop + this.buttons.clientHeight)
          this.buttons.scrollTop = bottom - this.buttons.clientHeight;
      }
    }
    this.updateScrollArrows();
  }
  layoutSelectionList() {
    if (this.screen !== "car" && this.screen !== "course") {
      this.scrollUp.hidden = this.scrollDown.hidden = true;
      return;
    }
    const items = this.buttons.querySelectorAll<HTMLElement>("[data-index]");
    if (!items.length) return;
    const row = items[0].offsetHeight;
    const stride =
      items.length > 1 ? items[1].offsetTop - items[0].offsetTop : row;
    if (!stride) return;
    const gap = stride - row;
    const limit = parseFloat(getComputedStyle(this.buttons).maxHeight);
    const count = Math.max(
      1,
      Math.min(items.length, Math.floor((limit + gap) / stride)),
    );
    this.buttons.style.height = `${count * stride - gap}px`;
    this.syncSelection();
  }
  updateScrollArrows() {
    const selecting = this.screen === "car" || this.screen === "course";
    const items = this.buttons.querySelectorAll<HTMLElement>("[data-index]");
    const textBounds = (item: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(item);
      return range.getBoundingClientRect();
    };
    const bounds = this.buttons.getBoundingClientRect();
    // Row padding is not another item: hide each arrow once the corresponding
    // end label is completely visible, even during a smooth scroll.
    this.scrollUp.hidden =
      !selecting ||
      !items.length ||
      textBounds(items[0]).top >= bounds.top - 0.5;
    this.scrollDown.hidden =
      !selecting ||
      !items.length ||
      textBounds(items[items.length - 1]).bottom <= bounds.bottom + 0.5;
    const left = this.buttons.offsetLeft + this.buttons.offsetWidth / 2;
    for (const button of [this.scrollUp, this.scrollDown])
      button.style.left = `${left}px`;
    const visible = Array.from(items, textBounds).filter(
      (item) =>
        item.top >= bounds.top - 0.5 && item.bottom <= bounds.bottom + 0.5,
    );
    const top = visible[0]?.top ?? bounds.top;
    const bottom = visible[visible.length - 1]?.bottom ?? bounds.bottom;
    this.scrollUp.style.top = `${this.buttons.offsetTop + top - bounds.top}px`;
    this.scrollDown.style.top = `${this.buttons.offsetTop + bottom - bounds.top}px`;
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
    else if (this.screen === "car") {
      this.hooks.change("machine", delta);
      this.selected = +field("machine").value;
    } else if (this.screen === "course") {
      this.hooks.change("course", delta);
      this.selected = +field("course").value;
    } else if (this.screen === "records")
      this.selected = Math.max(0, Math.min(8, this.selected + delta));
    this.syncSelection();
    if (this.buttons.contains(document.activeElement)) this.focusSelection();
  }
  choose(mode: string) {
    this.mode = mode;
    this.hooks.mode(mode);
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
        if (i === OPTION_VOLUME)
          this.setVolume(
            this.hooks.volume() === VOLUME_STEPS ? 0 : this.hooks.volume() + 1,
          );
        if (i === 3) this.hooks.toggleFullscreen();
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
  adjustVolume(delta: number) {
    const level = clampVolume(this.hooks.volume() + delta);
    if (level === this.hooks.volume()) return;
    this.setVolume(level);
    // The cursor sound previews the new level.
    this.hooks.sound("move");
  }
  setVolume(level: number) {
    this.hooks.setVolume(level);
    this.show("option", OPTION_VOLUME);
  }
  key(code: string) {
    if (
      this.screen === "option" &&
      this.selected === OPTION_VOLUME &&
      ["ArrowLeft", "ArrowRight"].includes(code)
    )
      this.adjustVolume(code === "ArrowLeft" ? -1 : 1);
    else if (["ArrowUp", "ArrowLeft"].includes(code)) this.move(-1);
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
  updateMachineInfo() {
    const type = +field("machine").value;
    if (this.displayedMachine === type) return;
    this.displayedMachine = type;
    const m = HoverEngine.MACHINES[type];
    const machines = HoverEngine.MACHINES.slice(0, HoverRules.machineCount());
    const metrics = [
      // MENU_ETC.C car_select_init: preserve the original formulas.
      {
        label: "Engine",
        values: machines.map((m) => m.accel - m.falloff * 8),
      },
      { label: "Side Thrusters", values: machines.map((m) => m.side) },
      {
        label: "Rudder",
        values: machines.map((m) =>
          m.rudder ? m.rotation + Math.trunc(227 / m.rudder) : 0,
        ),
      },
      { label: "Drag", values: machines.map((m) => m.drag) },
      {
        label: "Turbo",
        values: machines.map((m) => m.turbo - m.turboFall * 4),
      },
      { label: "Weight", values: machines.map((m) => m.weight) },
      { label: "Energy Capacity", values: machines.map((m) => m.tank) },
    ];
    const name = document.createElement("h3");
    name.textContent = m.name;
    const description = document.createElement("p");
    description.className = "machine-description";
    description.textContent = [
      "A balanced machine with predictable handling.",
      "Agile handling. Turn sharply with a single front thruster.",
      "Built for speed. Steer with four thrusters and no rudder.",
      "Strong acceleration and durability. Heavy and weak uphill.",
      "High-speed prototype. No rudder or turbo; low durability.",
    ][type];
    const heading = document.createElement("p");
    heading.className = "performance-heading";
    heading.textContent = "SPECS";
    const speeds = document.createElement("div");
    speeds.className = "machine-speeds";
    ["MAX SPEED", "MAX TURBO"].forEach((label, i) => {
      const item = document.createElement("div");
      const title = document.createElement("span");
      title.textContent = label;
      const value = document.createElement("strong");
      value.textContent = `${Math.round(this.curves[type][i][159])} km/h`;
      item.append(title, value);
      speeds.append(item);
    });
    const stats = document.createElement("dl");
    metrics.forEach(({ label, values }) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const value = document.createElement("dd");
      const ratio = Math.round((100 * values[type]) / Math.max(...values));
      value.setAttribute("aria-label", `${ratio}%（選択可能な車両内の相対値）`);
      const fill = document.createElement("i");
      fill.style.width = `${ratio}%`;
      value.append(fill);
      row.append(term, value);
      stats.append(row);
    });
    this.machineInfo.replaceChildren(name, description, heading, speeds, stats);
  }
  updateCourseRecords() {
    const course = +field("course").value;
    const rows = ["lap", "total"].map(
      (kind) =>
        HoverRecords.read(
          this.mode === "time" ? "time" : "gp",
          course,
          kind,
        )[0],
    );
    const signature = JSON.stringify([course, this.mode, rows]);
    if (signature === this.displayedRecords) return;
    this.displayedRecords = signature;
    this.courseInfo.replaceChildren();
    rows.forEach((row, i) => {
      const column = document.createElement("div");
      const label = document.createElement("h3");
      label.textContent = i === 0 ? "BEST LAP" : "TOTAL TIME";
      const time = document.createElement("p");
      time.className = "course-record-time";
      time.textContent = this.time(row?.time);
      column.append(label, time);
      if (row) {
        const holder = document.createElement("div");
        holder.className = "course-record-holder";
        const machine = HoverEngine.MACHINES[row.machine];
        if (machine) {
          const icon = document.createElement("span");
          icon.className = "record-machine-icon";
          icon.setAttribute("role", "img");
          icon.setAttribute("aria-label", machine.name);
          const sprite = document.createElement("img");
          sprite.src = "assets/minicars.png";
          sprite.alt = "";
          sprite.style.top = `${-row.machine * 100}%`;
          icon.append(sprite);
          holder.append(icon);
        }
        const name = document.createElement("span");
        name.textContent = row.name || "---";
        holder.append(name);
        column.append(holder);
      }
      this.courseInfo.append(column);
    });
  }
  draw() {
    const g = this.g;
    g.clearRect(0, 0, 320, 240);
    g.imageSmoothingEnabled = false;
    const list = lists[this.screen];
    if (this.screen === "car") {
      this.updateMachineInfo();
    } else if (this.screen === "course") {
      this.updateCourseRecords();
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
      `${this.screen}: ${list?.[this.selected] || (this.screen === "car" ? field("machine").selectedOptions[0]?.text : this.screen === "course" ? HOVER_TRACKS[+field("course").value].name : "選択画面")}`,
    );
  }
}
