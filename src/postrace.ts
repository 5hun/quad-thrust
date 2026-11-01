// MENU_ETC.C enter_name and DRAW_SP.C best_draw / total_draw.
import { OriginalMenu } from "./menu.js";
export interface GPRecord {
  course: number;
  best: number;
  total: number;
  machine: number;
}
export const ENTRY_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ,.^_0123456789%*?&!";
export class OriginalPostrace {
  panel = document.getElementById("postrace")!;
  canvas = document.getElementById("postrace-canvas") as HTMLCanvasElement;
  phase: "name" | "laps" | "lap" | "total" | null = null;
  name = [0, 0, 0];
  cursor = 0;
  rotation = 0;
  frame = 0;
  category = "time";
  course = 0;
  machine = 0;
  laps: number[] = [];
  done: () => void = () => {};
  saved = false;
  held = new Set<string>();
  portraits = new Image();
  constructor(
    public font: OriginalMenu,
    public storage: Storage = localStorage,
  ) {
    this.portraits.src = "assets/minicars.png";
    document.getElementById("postrace-prev")!.onclick = () =>
      this.key("ArrowLeft");
    document.getElementById("postrace-next")!.onclick = () =>
      this.key("ArrowRight");
    document.getElementById("postrace-confirm")!.onclick = () =>
      this.key("Enter");
    document.getElementById("postrace-exit")!.onclick = () =>
      this.key("Escape");
    try {
      const saved = this.storage.getItem("hover-player-name");
      if (
        saved?.length === 3 &&
        [...saved].every((c) => ENTRY_CHARACTERS.includes(c))
      )
        this.name = [...saved].map((c) => ENTRY_CHARACTERS.indexOf(c));
    } catch {}
  }
  begin(
    category: string,
    course: number,
    machine: number,
    laps: number[],
    done: () => void,
  ) {
    Object.assign(this, {
      category,
      course,
      machine,
      laps: [...laps],
      done,
      saved: false,
      cursor: 0,
      frame: 0,
    });
    const qualifies = ["lap", "total"].some((kind) => {
      const rows = HoverRecords.read(category, course, kind);
      const time =
        kind === "lap" ? Math.min(...laps) : laps.reduce((a, b) => a + b, 0);
      return rows.length < 6 || time < rows[5].time;
    });
    this.phase = qualifies ? "name" : "laps";
    this.panel.hidden = false;
    if (!qualifies) this.save();
  }
  get entry() {
    return this.phase === "name"
      ? {
          indices: this.name,
          selected: this.cursor,
          rotation: this.rotation,
          frame: this.frame,
        }
      : null;
  }
  save() {
    if (this.saved) return;
    const name = this.name.map((i) => ENTRY_CHARACTERS[i]).join("");
    try {
      this.storage.setItem("hover-player-name", name);
    } catch {}
    HoverRecords.save(
      this.category,
      this.course,
      "lap",
      Math.min(...this.laps),
      this.machine,
      name,
    );
    HoverRecords.save(
      this.category,
      this.course,
      "total",
      this.laps.reduce((a, b) => a + b, 0),
      this.machine,
      name,
    );
    this.saved = true;
  }
  close() {
    this.panel.hidden = true;
    this.phase = null;
  }
  key(code: string) {
    if (!this.phase) return;
    if (this.phase === "name") {
      if (this.rotation) return;
      if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(code)) {
        const delta = ["ArrowUp", "ArrowRight"].includes(code) ? 1 : -1;
        this.rotation = delta * 16;
        this.font.hooks.sound("move");
      } else if (["Escape", "KeyX"].includes(code))
        this.cursor = Math.max(0, this.cursor - 1);
      else if (["Enter", "KeyZ", "Space"].includes(code)) {
        this.font.hooks.sound("ok");
        if (++this.cursor === 3) {
          this.save();
          this.cursor = 0;
          this.phase = "laps";
          this.frame = 0;
        }
      }
    } else if (["Escape", "KeyX"].includes(code)) {
      this.close();
      this.done();
    } else if (["Enter", "KeyZ", "Space", "ArrowRight"].includes(code))
      this.advance();
  }
  advance() {
    this.phase =
      this.phase === "laps" ? "lap" : this.phase === "lap" ? "total" : "laps";
    this.frame = 0;
  }
  tick(gamepad = true) {
    if (!this.phase) return;
    this.frame++;
    if (this.rotation) {
      this.rotation -= Math.sign(this.rotation);
      if (Math.abs(this.rotation) === 8)
        this.name[this.cursor] =
          (this.name[this.cursor] + Math.sign(this.rotation) + 45) % 45;
    }
    if (this.phase !== "name" && this.frame >= 600) this.advance();
    if (!gamepad) return;
    const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    const keys = new Set<string>();
    if (pad) {
      [
        [12, "ArrowUp"],
        [13, "ArrowDown"],
        [14, "ArrowLeft"],
        [15, "ArrowRight"],
        [0, "Enter"],
        [9, "KeyP"],
        [1, "Escape"],
        [2, "ShiftLeft"],
        [3, "KeyZ"],
        [4, "KeyQ"],
        [5, "KeyE"],
        [6, "KeyA"],
        [7, "KeyD"],
      ].forEach(([i, code]) => {
        if (pad.buttons[+i]?.pressed) keys.add(String(code));
      });
      if (pad.axes[0] < -0.5) keys.add("ArrowLeft");
      if (pad.axes[0] > 0.5) keys.add("ArrowRight");
    }
    for (const key of keys) if (!this.held.has(key)) this.key(key);
    this.held = keys;
  }
  draw() {
    const g = this.canvas.getContext("2d")!;
    g.clearRect(0, 0, 320, 240);
    if (!this.phase) return;
    const old = this.font.g;
    this.font.g = g;
    const text = (s: string, x: number, y: number, size = 8) =>
      this.font.text(s, x, y, size);
    if (this.phase === "name") {
      this.panel.setAttribute(
        "aria-label",
        `NAME ENTRY ${this.name.map((i) => ENTRY_CHARACTERS[i]).join("")} ${this.cursor + 1}/3`,
      );
    } else if (this.phase === "laps") {
      text("LAP TIME", 80, 72);
      this.laps.forEach((t, i) =>
        text(`${i + 1}  ${this.font.time(t)}`, 144, 72 + i * 20),
      );
      text("TOTAL", 80, 168);
      text(this.font.time(this.laps.reduce((a, b) => a + b, 0)), 176, 168);
      text("EXIT", 240, 208, 16);
    } else {
      text(
        this.phase === "lap" ? "BESTLAP RECORDS" : "TOTAL RECORDS",
        8,
        16,
        16,
      );
      const rows = HoverRecords.read(this.category, this.course, this.phase);
      for (let i = 0; i < 6; i++) {
        const row = rows[i];
        text(
          `${this.font.time(row?.time)} ${row?.name || "---"}`,
          80,
          48 + i * 32,
          16,
        );
        if (row && this.portraits.complete && this.portraits.naturalWidth)
          g.drawImage(
            this.portraits,
            0,
            row.machine * 16,
            24,
            16,
            40,
            48 + i * 32,
            24,
            16,
          );
      }
      this.panel.setAttribute(
        "aria-label",
        this.phase === "lap" ? "BESTLAP RECORDS" : "TOTAL RECORDS",
      );
    }
    this.font.g = old;
  }
}
