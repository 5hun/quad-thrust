// MENU_ETC.C / GP1_MAIN.C: original title tree and selection order.
import {
  VOLUME_STEPS,
  clampVolume,
  decorateVolumeButton,
  volumeLabel,
} from "./volume.js";
import { esc } from "./gp-screens.js";
export type MenuScreen =
  "title" | "gp" | "option" | "car" | "course" | "records";
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
const CUPS = ["Blue GP", "Yellow GP", "Red GP"];
const lists: Partial<Record<MenuScreen, string[]>> = {
  title: ["GRANDPRIX", "TIME ATTACK", "OPTIONS"],
  gp: [...CUPS, "PRACTICE"],
  option: [],
};
const captions: Partial<Record<MenuScreen, string>> = {
  gp: "GRANDPRIX",
  option: "OPTIONS",
};
const parent: Partial<Record<MenuScreen, [MenuScreen, number]>> = {
  gp: ["title", 0],
  option: ["title", 2],
  records: ["option", 0],
};
const RECORD_CLASSES = [
  ["gp", "GRAND PRIX"],
  ["time", "TIME ATTACK"],
] as const;
const OPTION_VOLUME = 2;
const field = (id: string) => document.getElementById(id) as HTMLSelectElement;
export class OriginalMenu {
  screen: MenuScreen = "title";
  selected = 0;
  entered = performance.now();
  mode = "time";
  // VIEW RECORDS: the Grand Prix's records or Time Attack's.
  recordClass: "gp" | "time" = "gp";
  panel: HTMLElement;
  buttons: HTMLElement;
  caption: HTMLElement;
  guideSelect: HTMLElement;
  curves: number[][][] = [];
  machineInfo: HTMLElement;
  courseInfo: HTMLElement;
  recordsView: HTMLElement;
  recordsDetail: HTMLElement;
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
    return this.usesListLayout || this.screen === "records";
  }
  constructor(public hooks: MenuHooks) {
    this.panel = document.getElementById("menu")!;
    this.panel.replaceChildren();
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
      '<span><span class="guide-arrows">↑ ↓</span> <span class="guide-select">SELECT</span></span><span class="guide-mode"><span class="guide-arrows">← →</span> MODE</span><button type="button" class="guide-confirm"><kbd>ENTER</kbd> CONFIRM</button><span class="back-guide"><kbd>ESC</kbd> BACK</span>';
    guide.querySelector<HTMLButtonElement>(".guide-confirm")!.onclick = () =>
      this.confirm();
    this.guideSelect = guide.querySelector<HTMLElement>(".guide-select")!;
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
    this.recordsView = document.createElement("section");
    this.recordsView.className = "records-view gp-layout";
    this.recordsView.setAttribute("aria-label", "記録");
    const recordsHeader = document.createElement("div");
    recordsHeader.className = "gp-header";
    recordsHeader.innerHTML =
      '<p class="gp-kicker">OPTIONS</p><h2 class="gp-title">RECORDS</h2>';
    const tabs = document.createElement("div");
    tabs.className = "gp-tabs";
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "記録の種類");
    for (const [kind, label] of RECORD_CLASSES) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.dataset.recordClass = kind;
      tab.textContent = label;
      tab.onclick = () => this.switchRecordClass(kind);
      tabs.append(tab);
    }
    this.recordsDetail = document.createElement("section");
    this.recordsDetail.className = "records-detail";
    this.recordsDetail.setAttribute("aria-live", "polite");
    this.recordsView.append(recordsHeader, tabs, this.recordsDetail);
    titleLayout.append(this.recordsView);
    this.panel.append(titleLayout);
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
  show(screen: MenuScreen, selected = 0) {
    const restoreFocus =
      this.screen === screen && this.buttons.contains(document.activeElement);
    document.getElementById("fullscreen-status")!.hidden = true;
    const fullscreen = this.hooks.fullscreen();
    lists.option = [
      "VIEW RECORDS",
      `SOUND: ${this.hooks.soundEnabled() ? "ON" : "OFF"}`,
      volumeLabel(this.hooks.volume()),
      ...(fullscreen === null
        ? []
        : [`FULLSCREEN: ${fullscreen ? "ON" : "OFF"}`]),
    ];
    lists.gp = CUPS.slice(0, HoverRules.availableCups()).concat("PRACTICE");
    this.screen = screen;
    this.selected = selected;
    this.entered = performance.now();
    this.panel.dataset.screen = screen;
    this.panel.dataset.presentation = this.usesListLayout ? "list" : "records";
    this.panel.dataset.count = String(
      screen === "car"
        ? HoverRules.machineCount()
        : screen === "course" || screen === "records"
          ? HOVER_TRACKS.length
          : lists[screen]?.length || 0,
    );
    this.caption.textContent = captions[screen] || "";
    this.guideSelect.textContent = screen === "records" ? "COURSE" : "SELECT";
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
    if (screen === "records") {
      this.displayedRecords = "";
      CUPS.forEach((cup, c) => {
        const heading = document.createElement("h3");
        heading.className = "records-cup";
        heading.textContent = cup.toUpperCase();
        this.buttons.append(heading);
        for (let i = c * 3; i < c * 3 + 3; i++) {
          const b = this.button(
            `${this.courseLabel(i)} ${HOVER_TRACKS[i].name}`,
            () => {
              if (i !== this.selected) this.hooks.sound("move");
              this.selected = i;
              this.syncSelection();
            },
            i,
          );
          b.innerHTML = `<span class="records-course-label">${this.courseLabel(i)}</span><span class="records-course-name">${esc(HOVER_TRACKS[i].name.toUpperCase())}</span><span class="records-course-best"></span>`;
        }
      });
    }
    if (lists[screen])
      lists[screen]!.forEach((label, i) => {
        this.button(
          label,
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
  button(label: string, click: () => void, index?: number) {
    const b = document.createElement("button");
    b.textContent = label;
    b.setAttribute("aria-label", label);
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
    return b;
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
    if (this.screen === "records") this.updateRecordsView();
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
      this.selected = Math.max(
        0,
        Math.min(HOVER_TRACKS.length - 1, this.selected + delta),
      );
    this.syncSelection();
    if (this.buttons.contains(document.activeElement)) this.focusSelection();
  }
  choose(mode: string) {
    this.mode = mode;
    this.hooks.mode(mode);
    this.show("car");
  }
  switchRecordClass(kind: "gp" | "time") {
    if (kind === this.recordClass) return;
    this.hooks.sound("move");
    this.recordClass = kind;
    this.updateRecordsView();
  }
  confirm() {
    // VIEW RECORDS shows the selected course without a further step.
    if (this.screen === "records") return;
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
        if (i === 0) this.show("records");
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
      case "car":
        if (this.mode.startsWith("gp")) this.hooks.start();
        else this.show("course");
        break;
      case "course":
        this.hooks.start();
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
    } else if (parent[this.screen]) {
      const [screen, i] = parent[this.screen]!;
      this.show(screen, i);
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
    else if (
      this.screen === "records" &&
      ["ArrowLeft", "ArrowRight"].includes(code)
    )
      this.switchRecordClass(code === "ArrowLeft" ? "gp" : "time");
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
  time(t?: number) {
    if (t === undefined) return "--'--\"--";
    const n = Math.floor((Math.round(t * 60) * 100) / 60);
    return `${String(Math.floor(n / 6000)).padStart(2, "0")}'${String(Math.floor(n / 100) % 60).padStart(2, "0")}"${String(n % 100).padStart(2, "0")}`;
  }
  courseLabel(i: number) {
    return `${Math.floor(i / 3) + 1}-${(i % 3) + 1}`;
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
  updateRecordsView() {
    const course = this.selected;
    const columns = (["lap", "total"] as const).map((kind) =>
      HoverRecords.read(this.recordClass, course, kind),
    );
    const bests = HOVER_TRACKS.map(
      (_, i) => HoverRecords.read(this.recordClass, i, "total")[0]?.time,
    );
    const signature = JSON.stringify([
      this.recordClass,
      course,
      columns,
      bests,
    ]);
    if (signature === this.displayedRecords) return;
    this.displayedRecords = signature;
    this.recordsView
      .querySelectorAll<HTMLButtonElement>("[data-record-class]")
      .forEach((tab) =>
        tab.setAttribute(
          "aria-current",
          String(tab.dataset.recordClass === this.recordClass),
        ),
      );
    this.buttons
      .querySelectorAll<HTMLElement>(".records-course-best")
      .forEach((best, i) => (best.textContent = this.time(bests[i])));
    const mode = RECORD_CLASSES.find(([kind]) => kind === this.recordClass)![1];
    const header =
      `<p class="gp-label">${this.courseLabel(course)}  ·  ${CUPS[Math.floor(course / 3)].toUpperCase()}  ·  ${mode}</p>` +
      `<h3 class="records-title">${esc(HOVER_TRACKS[course].name.toUpperCase())}</h3>`;
    if (!columns[0].length && !columns[1].length) {
      this.recordsDetail.innerHTML =
        header +
        `<div class="records-empty"><p>NO RECORDS</p><p>${this.recordClass === "gp" ? "FINISH THIS COURSE IN A GRAND PRIX TO SET A RECORD" : "RUN A TIME ATTACK ON THIS COURSE TO SET A RECORD"}</p></div>`;
      return;
    }
    this.recordsDetail.innerHTML =
      header +
      `<div class="records-columns">${columns
        .map(
          (rows, k) =>
            `<section><h4 class="gp-label">${k === 0 ? "BEST LAP" : "TOTAL"}</h4><ol class="gp-record-rows records-rows">${Array.from(
              { length: 6 },
              (_, i) => {
                const r = rows[i];
                const machine = r && HoverEngine.MACHINES[r.machine];
                return `<li${r ? (i === 0 ? " data-top" : "") : " data-empty"}><span class="gp-pos">${i + 1}</span><span class="gp-machine">${esc(r?.name || "---")}</span><span class="gp-gap">${machine ? `<span class="record-machine-icon" aria-hidden="true"><img src="assets/minicars.png" alt="" style="top: ${-r.machine * 100}%"></span>${esc(machine.name)}` : ""}</span><span class="gp-time">${this.time(r?.time)}</span></li>`;
              },
            ).join("")}</ol></section>`,
        )
        .join("")}</div>`;
  }
  draw() {
    const list = lists[this.screen];
    if (this.screen === "car") {
      this.updateMachineInfo();
    } else if (this.screen === "course") {
      this.updateCourseRecords();
    } else if (this.screen === "records") {
      this.updateRecordsView();
    }
    this.panel.setAttribute(
      "aria-label",
      `${this.screen}: ${list?.[this.selected] || (this.screen === "car" ? field("machine").selectedOptions[0]?.text : this.screen === "course" ? HOVER_TRACKS[+field("course").value].name : this.screen === "records" ? HOVER_TRACKS[this.selected].name : "選択画面")}`,
    );
  }
}
