// MENU_ETC.C enter_name and DRAW_SP.C best_draw / total_draw.
import { OriginalMenu } from "./menu.js";
import { STAFF } from "./staff.js";
import { StaffText } from "./staff-text.js";
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
  phase: "name" | "laps" | "lap" | "total" | "credits" | null = null;
  name = [0, 0, 0];
  cursor = 0;
  rotation = 0;
  frame = 0;
  category = "time";
  batch: GPRecord[] = [];
  batchIndex = 0;
  creditMode = 0;
  creditFrame = 0;
  creditLine = 6;
  afterCredits: () => void = () => {};
  course = 0;
  machine = 0;
  laps: number[] = [];
  done: () => void = () => {};
  saved = false;
  held = new Set<string>();
  portraits = new Image();
  staffText = new StaffText();
  constructor(public font: OriginalMenu) {
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
      const saved = localStorage.getItem("hover-player-name");
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
      batch: [],
      batchIndex: 0,
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
  beginGP(batch: GPRecord[], done: () => void) {
    if (!batch.length) {
      done();
      return;
    }
    Object.assign(this, {
      batch: batch.map((r) => ({ ...r })),
      batchIndex: 0,
      category: "gp",
      course: batch[0].course,
      machine: batch[0].machine,
      done,
      saved: false,
      cursor: 0,
      frame: 0,
    });
    const qualifies = batch.some((r) =>
      ["lap", "total"].some((kind) => {
        const rows = HoverRecords.read("gp", r.course, kind);
        return (
          rows.length < 6 || (kind === "lap" ? r.best : r.total) < rows[5].time
        );
      }),
    );
    this.phase = qualifies ? "name" : "lap";
    this.panel.hidden = false;
    if (!qualifies) this.save();
  }
  credits(done: () => void) {
    Object.assign(this, {
      phase: "credits",
      frame: 0,
      creditMode: 0,
      creditFrame: 0,
      creditLine: 6,
      afterCredits: done,
    });
    this.panel.hidden = false;
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
      localStorage.setItem("hover-player-name", name);
    } catch {}
    if (this.batch.length) {
      for (const row of this.batch) {
        HoverRecords.save("gp", row.course, "lap", row.best, row.machine, name);
        HoverRecords.save(
          "gp",
          row.course,
          "total",
          row.total,
          row.machine,
          name,
        );
      }
      this.saved = true;
      return;
    }
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
    if (this.phase === "credits") {
      if (["Enter", "Escape", "KeyZ", "Space"].includes(code)) {
        this.close();
        this.afterCredits();
      }
      return;
    }
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
          this.phase = this.batch.length ? "lap" : "laps";
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
    if (this.batch.length && this.phase === "total") {
      if (++this.batchIndex >= this.batch.length) {
        this.close();
        this.done();
        return;
      }
      this.course = this.batch[this.batchIndex].course;
      this.phase = "lap";
      this.frame = 0;
      return;
    }
    this.phase =
      this.phase === "laps" ? "lap" : this.phase === "lap" ? "total" : "laps";
    this.frame = 0;
  }
  tick() {
    if (!this.phase) return;
    this.frame++;
    if (this.rotation) {
      this.rotation -= Math.sign(this.rotation);
      if (Math.abs(this.rotation) === 8)
        this.name[this.cursor] =
          (this.name[this.cursor] + Math.sign(this.rotation) + 45) % 45;
    }
    if (this.phase === "credits") {
      this.creditFrame++;
      const mode = this.creditMode;
      const limit =
        mode < 6
          ? mode % 2
            ? 180
            : 232
          : mode < 22
            ? mode % 2
              ? 160
              : 148
            : Infinity;
      if (this.creditFrame > limit) {
        if (mode >= 6 && mode < 22 && mode % 2 === 0)
          this.creditLine += [2, 1, 1, 2, 2, 4, 7, 2][(mode - 6) / 2] + 1;
        this.creditMode++;
        this.creditFrame = 0;
      }
      if (this.frame >= 4080) {
        this.close();
        this.afterCredits();
        return;
      }
    } else if (
      this.phase !== "name" &&
      this.frame >= (this.batch.length ? 420 : 600)
    )
      this.advance();
    const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    const keys = new Set<string>();
    if (pad) {
      [
        [12, "ArrowUp"],
        [13, "ArrowDown"],
        [14, "ArrowLeft"],
        [15, "ArrowRight"],
        [0, "Enter"],
        [9, "Enter"],
        [1, "Escape"],
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
    if (this.batch.length && ["lap", "total"].includes(this.phase)) {
      // GAME.C make_back_tmd2: blue upper corners and red lower corners.
      const gradient = g.createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, "#00007f");
      gradient.addColorStop(1, "#7f0000");
      g.fillStyle = gradient;
      g.fillRect(0, 0, 320, 240);
    }
    if (this.phase === "credits") {
      const mode = this.creditMode,
        t = this.creditFrame;
      const jp = (line: number, x: number, y: number) =>
        this.staffText.draw(g, STAFF[line] || "", x, y);
      if (mode < 6 && mode % 2 === 0) {
        const y = t < 16 ? 16 - t : t > 216 ? t - 216 : 0;
        g.fillStyle = "black";
        g.fillRect(0, -y * 2, 320, 32);
        g.fillRect(0, 208 + y * 2, 320, 32);
        if (t > 32 && t < 200) {
          const x = t < 56 ? 56 - t : t > 176 ? t - 176 : 0;
          jp(mode, 32 + x * 10, 8);
          jp(mode + 1, 32 - x * 10, 216);
        }
      } else if (mode >= 6 && mode < 22 && mode % 2 === 0) {
        g.fillStyle = "black";
        g.fillRect(0, 0, 320, 240);
        const count = [2, 1, 1, 2, 2, 4, 7, 2][(mode - 6) / 2],
          y = (240 - (count + 1) * 24) / 2;
        const x = t < 24 ? t - 24 : t > 124 ? t - 124 : 0;
        jp(this.creditLine, 32 - x * 10, y);
        for (let i = 0; i < count; i++)
          jp(
            this.creditLine + 1 + i,
            32 + x * 10 * (i % 2 ? -1 : 1),
            y + i * 24 + 32,
          );
      } else if (mode >= 22) {
        jp(this.creditLine + 1, 32, 96);
        jp(this.creditLine + 2, 32, 128);
      }
      this.panel.setAttribute("aria-label", "STAFF CREDITS");
    } else if (this.phase === "name") {
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
        this.batch.length
          ? `${Math.floor(this.course / 3) + 1}-${(this.course % 3) + 1} ${this.phase === "lap" ? "BESTLAP" : "TOTAL"}`
          : this.phase === "lap"
            ? "BESTLAP RECORDS"
            : "TOTAL RECORDS",
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
