// Source: src/gp-screens.ts. Build with npm run build; do not edit dist/gp-screens.js directly.
// Screens after the finish line, in the title menu's style. Grand Prix: race
// result, next race intro, cup clear, name entry and the cup's records.
// Time Attack and practice: name entry and the result with course records.
import { hudTime } from "./hud.js";

export type GPScreen =
  "result" | "quit" | "intro" | "clear" | "name" | "records" | "time-result";
export interface GPRecord {
  course: number;
  best: number;
  total: number;
  machine: number;
}
export const ENTRY_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ,.^_0123456789%*?&!";
type MenuSound = "move" | "ok" | "cancel";
export interface Standing {
  machine: number;
  // Seconds, or null when the player did not finish.
  time: number | null;
  player: boolean;
}
export interface RaceResult {
  cup: number;
  round: number;
  won: boolean;
  // "COURSE OUT" or "MACHINE DESTROYED" when the player retired.
  retired: string | null;
  // Finishing order; the player's row is marked.
  standings: Standing[];
  laps: number[];
  lapRecord: boolean;
}
interface ResultActions {
  next(): void;
  retry(): void;
  quit(): void;
}
// A Time Attack or practice run, finished or retired.
export interface TimeResult {
  // "TIME ATTACK" or "PRACTICE".
  label: string;
  recordClass: "gp" | "time";
  course: number;
  machine: number;
  laps: number[];
  // "COURSE OUT" or "MACHINE DESTROYED" when the player retired.
  retired: string | null;
  // The course's saved best total before this run, for the delta.
  bestBefore: number | null;
}
interface TimeActions {
  retry(): void;
  changeMachine(): void;
  changeCourse(): void;
  quit(): void;
}
interface MenuItem {
  label: string;
  run(): void;
}
const ORDINALS = ["1ST", "2ND", "3RD", "4TH"];
const CONFIRM = ["Enter", "Space", "KeyZ"];
const BACK = ["Escape", "KeyX", "Backspace"];
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const courseName = (course: number) => HOVER_TRACKS[course].name.toUpperCase();
const courseLabel = (course: number) =>
  `${Math.floor(course / 3) + 1}-${(course % 3) + 1}`;
const machineName = (type: number) => HoverEngine.MACHINES[type]?.name ?? "";
// Gaps drop the minutes while they are zero: +01"24.
const gapTime = (t: number) => "+" + hudTime(t).replace(/^00'/, "");
// Against the best: −00"42 when faster, +01"05 when slower.
export const deltaTime = (t: number) =>
  (t < 0 ? "−" : "+") + hudTime(Math.abs(t)).replace(/^00'/, "");
const ordinal = (rank: number) => ORDINALS[rank - 1] ?? `${rank}TH`;
// The course select's sprite, one machine per row.
const machineIcon = (type: number) =>
  `<span class="record-machine-icon" aria-hidden="true"><img src="assets/minicars.png" alt="" style="top: ${-type * 100}%"></span>`;
const guide = (items: string[]) =>
  `<div class="title-guide">${items.join("")}</div>`;
const guideKey = (key: string, label: string, action = "") =>
  `<button type="button" class="guide-confirm" data-action="${action}"><kbd>${key}</kbd> ${label}</button>`;
const guideArrows = (arrows: string, label: string) =>
  `<span><span class="guide-arrows">${arrows}</span> ${label}</span>`;
// Where a record would land among the six, or 0 when it would not enter.
export function rankAmong(rows: { time: number }[], time: number) {
  const rank = 1 + rows.filter((r) => r.time <= time).length;
  return rank <= 6 ? rank : 0;
}

export class GPScreens {
  screen: GPScreen | null = null;
  selected = 0;
  panel: HTMLElement;
  layout: HTMLElement;
  items: MenuItem[] = [];
  // ENTER on screens without a list; ESC on screens that can go back.
  confirmAction: (() => void) | null = null;
  backAction: (() => void) | null = null;
  name = [0, 0, 0];
  cursor = 0;
  nameDone: (() => void) | null = null;
  batch: GPRecord[] = [];
  page = 0;
  // Name the cup's rows were saved under, highlighted on the records pages.
  savedName = "";
  padHeld = new Set<string>();
  resultScreen: (() => void) | null = null;
  quitAction: () => void = () => {};
  recordsDone: () => void = () => {};
  // Records the name entry saves into: the GP's, or Time Attack's.
  recordClass: "gp" | "time" = "gp";
  // Time Attack result's record table: TOTAL or BEST LAP.
  recordKind: "total" | "lap" = "total";
  timeResult: (() => void) | null = null;
  constructor(
    public sound: (kind: MenuSound) => void,
    public storage: Pick<Storage, "getItem" | "setItem">,
  ) {
    this.panel = document.getElementById("gp-panel")!;
    this.layout = document.createElement("div");
    this.layout.className = "title-layout gp-layout";
    this.panel.replaceChildren(this.layout);
  }
  get active() {
    return this.screen !== null;
  }
  close() {
    this.screen = null;
    this.items = [];
    this.confirmAction = this.backAction = this.nameDone = null;
    this.panel.hidden = true;
    this.layout.replaceChildren();
  }
  private open(screen: GPScreen, html: string) {
    // A button still held from racing or the last screen must not confirm.
    this.padHeld = this.padCodes();
    this.items = [];
    this.confirmAction = this.backAction = this.nameDone = null;
    this.screen = screen;
    this.panel.dataset.screen = screen;
    this.layout.innerHTML = html;
    this.panel.hidden = false;
    for (const b of this.layout.querySelectorAll<HTMLButtonElement>(
      ".title-guide button",
    ))
      b.onclick = () => this.key(b.dataset.action || "Enter");
  }
  private progress(cup: number, round: number, current: string) {
    return `<ol class="gp-progress">${[0, 1, 2]
      .map((i) => {
        const won = i < round || (i === round && current === "WON"),
          next = i === round + 1 && current === "WON";
        const state = won ? "done" : i === round || next ? "current" : "later";
        const label = won
          ? "WON"
          : i === round
            ? current
            : next
              ? "NEXT"
              : `RACE ${i + 1}`;
        return `<li data-state="${state}"><small>${label}</small><span>${esc(courseName(cup * 3 + i))}</span></li>`;
      })
      .join("")}</ol>`;
  }
  private header(kicker: string, title: string) {
    return `<div class="gp-header"><p class="gp-kicker">${esc(kicker)}</p><h2 class="gp-title">${esc(title)}</h2></div>`;
  }
  private menu(items: MenuItem[], label: string, selected = 0) {
    this.items = items;
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", label);
    items.forEach((item, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = item.label;
      b.dataset.index = String(i);
      b.onfocus = () => this.select(i);
      b.onclick = () => {
        this.select(i);
        this.confirm();
      };
      nav.append(b);
    });
    this.layout.insertBefore(nav, this.layout.querySelector(".title-guide"));
    this.select(selected);
  }
  private select(i: number) {
    this.selected = i;
    this.layout
      .querySelectorAll<HTMLButtonElement>("nav [data-index]")
      .forEach((b) =>
        b.setAttribute("aria-current", String(+b.dataset.index! === i)),
      );
  }
  private confirm() {
    if (this.items.length) {
      this.sound("ok");
      this.items[this.selected].run();
    } else if (this.confirmAction) {
      this.sound("ok");
      this.confirmAction();
    }
  }
  showResult(result: RaceResult, actions: ResultActions) {
    const course = result.cup * 3 + result.round;
    const leader = result.standings[0].time;
    const rows = result.standings
      .map((s, i) => {
        const time = s.time === null ? (result.retired ?? "") : hudTime(s.time);
        const gap =
          s.time !== null && leader !== null && i > 0
            ? gapTime(s.time - leader)
            : "";
        return `<li${s.player ? " data-player" : ""}><span class="gp-pos">${s.time === null ? "—" : ORDINALS[i]}</span><span class="gp-machine">${esc(machineName(s.machine))}${s.player ? "<small>YOU</small>" : ""}</span><span class="gp-time">${time}</span><span class="gp-gap">${gap}</span></li>`;
      })
      .join("");
    const best = result.laps.length ? Math.min(...result.laps) : NaN;
    const side = result.won
      ? `<h3 class="gp-label">LAP TIME</h3><dl class="gp-laps">${result.laps
          .map(
            (t, i) =>
              `<div${t === best ? " data-best" : ""}><dt>LAP ${i + 1}</dt><dd>${hudTime(t)}</dd></div>`,
          )
          .join(
            "",
          )}<div class="gp-best-lap"><dt>BEST LAP${result.lapRecord ? ' <span class="gp-new">NEW</span>' : ""}</dt><dd>${hudTime(best)}</dd></div></dl>`
      : `<p class="gp-outcome">${result.retired ?? `FINISHED ${ORDINALS[result.standings.findIndex((s) => s.player)]}`}</p><p class="gp-advance">FINISH 1ST<br>TO ADVANCE</p><p class="gp-hint">Retry this race as many times as you like. Your wins in this cup are kept.</p>`;
    this.open(
      "result",
      this.header(
        `${HoverRules.cups[result.cup]}  ·  RACE ${result.round + 1} / 3`,
        courseName(course),
      ) +
        `<section class="gp-standings"><h3 class="gp-label">RESULT</h3><ol>${rows}</ol></section>` +
        `<section class="gp-side">${side}<h3 class="gp-label gp-progress-label">CUP PROGRESS</h3>${this.progress(result.cup, result.round, result.won ? "WON" : "RETRY")}</section>` +
        guide([guideArrows("↑ ↓", "SELECT"), guideKey("ENTER", "CONFIRM")]),
    );
    const quit = () => this.showQuit();
    this.backAction = null;
    this.resultScreen = () => this.showResult(result, actions);
    this.quitAction = actions.quit;
    this.menu(
      result.won
        ? [
            { label: "NEXT RACE", run: actions.next },
            { label: "QUIT", run: quit },
          ]
        : [
            { label: "RETRY", run: actions.retry },
            { label: "QUIT GRAND PRIX", run: quit },
          ],
      "Race result",
    );
  }
  // Quitting discards the cup in progress, as from the pause menu.
  showQuit() {
    this.open(
      "quit",
      `<h2 class="menu-caption">QUIT GRAND PRIX?</h2><p class="pause-note">Your Grand Prix progress will be lost.</p>` +
        guide([
          guideArrows("↑ ↓", "SELECT"),
          guideKey("ENTER", "CONFIRM"),
          guideKey("ESC", "BACK", "Escape"),
        ]),
    );
    this.backAction = () => this.resultScreen?.();
    this.menu(
      [
        { label: "YES", run: () => this.quitAction() },
        { label: "NO", run: () => this.resultScreen?.() },
      ],
      "Quit Grand Prix",
      1,
    );
  }
  showIntro(cup: number, round: number, track: Track, skip: () => void) {
    const course = cup * 3 + round;
    const record = (kind: string) => {
      const row = HoverRecords.read("gp", course, kind)[0];
      return row
        ? `${hudTime(row.time)} <small>${esc(row.name || "---")} · ${esc(machineName(row.machine))}</small>`
        : `${hudTime()} <small>---</small>`;
    };
    this.open(
      "intro",
      `<section class="gp-intro"><p class="gp-kicker">${esc(HoverRules.cups[cup])}</p>` +
        `<p class="gp-race"><span>RACE</span><strong>${round + 1}</strong><span>/ 3</span></p>` +
        `<h2 class="gp-course">${esc(courseName(course))}</h2><div class="gp-rule"></div>` +
        `<dl class="gp-course-records"><div><dt>BEST LAP</dt><dd>${record("lap")}</dd></div><div><dt>BEST TOTAL</dt><dd>${record("total")}</dd></div></dl></section>` +
        `<figure class="gp-map"><canvas width="240" height="240" role="img" aria-label="Course map"></canvas><figcaption>3 LAPS</figcaption></figure>` +
        this.progress(cup, round, "NOW") +
        guide([guideKey("ENTER", "SKIP")]),
    );
    this.drawMap(this.layout.querySelector("canvas")!, track);
    this.confirmAction = skip;
    this.backAction = null;
  }
  drawMap(canvas: HTMLCanvasElement, track: Track) {
    const g = canvas.getContext("2d")!,
      size = canvas.width,
      xs = track.nodes.map((p) => p.x),
      zs = track.nodes.map((p) => p.z),
      minx = Math.min(...xs),
      maxx = Math.max(...xs),
      minz = Math.min(...zs),
      maxz = Math.max(...zs),
      scale = (size - 24) / Math.max(maxx - minx, maxz - minz);
    const xy = (p: { x: number; z: number }) => [
      size / 2 + (p.x - (minx + maxx) / 2) * scale,
      size / 2 - (p.z - (minz + maxz) / 2) * scale,
    ];
    g.clearRect(0, 0, size, size);
    g.strokeStyle = "#f3faff";
    g.lineWidth = 5;
    g.lineJoin = "round";
    g.beginPath();
    track.nodes.forEach((p, i) => {
      const [x, y] = xy(p);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.closePath();
    g.stroke();
    const [x, y] = xy(track.nodes[0]);
    g.fillStyle = "#20e5ec";
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fill();
  }
  showClear(
    cup: number,
    batch: GPRecord[],
    unlocked: string | null,
    next: () => void,
  ) {
    const races = [0, 1, 2].map((i) =>
      batch.find((r) => r.course === cup * 3 + i),
    );
    const total = races.reduce((sum, r) => sum + (r?.total ?? 0), 0);
    this.open(
      "clear",
      `<div class="gp-clear-header"><p class="gp-kicker">${esc(HoverRules.cups[cup])}</p><h2>CLEAR</h2></div>` +
        `<section class="gp-clear-table"><div class="gp-clear-head"><span>RACE</span><span>COURSE</span><span>FINISH</span><span>TOTAL</span><span>BEST LAP</span></div><ol>${races
          .map(
            (r, i) =>
              `<li><span>${courseLabel(cup * 3 + i)}</span><span>${esc(courseName(cup * 3 + i))}</span><span class="gp-first">1ST</span><span>${hudTime(r?.total)}</span><span>${hudTime(r?.best)}</span></li>`,
          )
          .join(
            "",
          )}</ol><div class="gp-cup-total"><span>CUP TOTAL</span><span>${hudTime(total)}</span></div></section>` +
        (unlocked
          ? `<p class="gp-unlock"><small>UNLOCKED</small><span>${esc(unlocked)}</span></p>`
          : "") +
        guide([guideKey("ENTER", "NEXT")]),
    );
    this.confirmAction = next;
    this.backAction = null;
  }
  // One name for every course of the cup, as before. Cups whose times
  // stay out of the top six go straight to the records.
  showRecords(batch: GPRecord[], done: () => void) {
    this.recordClass = "gp";
    this.batch = batch
      .map((r) => ({ ...r }))
      .sort((a, b) => a.course - b.course);
    this.loadName();
    const entries = this.newRecords();
    const finish = () => {
      this.save();
      this.page = 0;
      this.showRecordPage(done);
    };
    if (entries.length) this.showName(entries, finish, "NEW RECORD");
    else finish();
  }
  // The last name entered, in GP or Time Attack, comes back.
  loadName() {
    let saved = "";
    try {
      saved = this.storage.getItem("hover-player-name") || "";
    } catch {}
    this.name =
      saved.length === 3 &&
      [...saved].every((c) => ENTRY_CHARACTERS.includes(c))
        ? [...saved].map((c) => ENTRY_CHARACTERS.indexOf(c))
        : [0, 0, 0];
  }
  newRecords() {
    const rows: { course: number; kind: string; time: number; rank: number }[] =
      [];
    for (const r of this.batch)
      for (const [kind, time] of [
        ["lap", r.best],
        ["total", r.total],
      ] as const) {
        const rank = rankAmong(
          HoverRecords.read(this.recordClass, r.course, kind),
          time,
        );
        if (rank) rows.push({ course: r.course, kind, time, rank });
      }
    return rows;
  }
  get nameText() {
    return this.name.map((i) => ENTRY_CHARACTERS[i]).join("");
  }
  showName(
    entries: ReturnType<GPScreens["newRecords"]>,
    done: () => void,
    kicker: string,
  ) {
    this.cursor = 0;
    this.open(
      "name",
      this.header(kicker, "ENTER YOUR NAME") +
        `<div class="gp-name" role="group" aria-label="Name, 3 letters">${[
          0, 1, 2,
        ]
          .map(
            (i) =>
              `<div class="gp-slot" data-slot="${i}"><button type="button" class="gp-letter-prev" aria-label="Previous letter"></button><span class="gp-letter" aria-live="polite"></span><button type="button" class="gp-letter-next" aria-label="Next letter"></button></div>`,
          )
          .join("")}</div>` +
        `<section class="gp-side gp-new-records"><h3 class="gp-label">YOUR NEW RECORDS</h3><ol>${entries
          .map(
            (e) =>
              `<li><span>${courseLabel(e.course)} ${esc(courseName(e.course))}<small>${e.kind === "lap" ? "BEST LAP" : "TOTAL"}</small></span><span>${hudTime(e.time)}</span><span class="gp-rank">${ORDINALS[e.rank - 1] ?? `${e.rank}TH`}</span></li>`,
          )
          .join("")}</ol></section>` +
        guide([
          guideArrows("↑ ↓", "LETTER"),
          guideArrows("← →", "MOVE"),
          guideKey("ENTER", "CONFIRM"),
          guideKey("ESC", "BACK", "Escape"),
        ]),
    );
    this.layout.querySelectorAll<HTMLElement>(".gp-slot").forEach((slot) => {
      const i = +slot.dataset.slot!;
      slot.querySelector<HTMLButtonElement>(".gp-letter-prev")!.onclick =
        () => {
          this.cursor = i;
          this.turn(-1);
        };
      slot.querySelector<HTMLButtonElement>(".gp-letter-next")!.onclick =
        () => {
          this.cursor = i;
          this.turn(1);
        };
      slot.querySelector<HTMLElement>(".gp-letter")!.onclick = () => {
        this.cursor = i;
        this.syncName();
      };
    });
    this.nameDone = done;
    this.confirmAction = this.backAction = null;
    this.syncName();
  }
  syncName() {
    const n = ENTRY_CHARACTERS.length;
    this.layout.querySelectorAll<HTMLElement>(".gp-slot").forEach((slot) => {
      const i = +slot.dataset.slot!,
        index = this.name[i];
      slot.dataset.state =
        i === this.cursor ? "current" : i < this.cursor ? "done" : "later";
      slot.querySelector(".gp-letter")!.textContent = ENTRY_CHARACTERS[index];
      slot.querySelector(".gp-letter-prev")!.textContent =
        ENTRY_CHARACTERS[(index + n - 1) % n];
      slot.querySelector(".gp-letter-next")!.textContent =
        ENTRY_CHARACTERS[(index + 1) % n];
    });
  }
  turn(delta: number) {
    const n = ENTRY_CHARACTERS.length;
    this.name[this.cursor] = (this.name[this.cursor] + delta + n) % n;
    this.sound("move");
    this.syncName();
  }
  nameKey(code: string) {
    const typed = /^Key([A-Z])$|^Digit([0-9])$/.exec(code);
    if (typed) {
      this.name[this.cursor] = ENTRY_CHARACTERS.indexOf(typed[1] || typed[2]);
      this.sound("move");
      if (this.cursor < 2) this.cursor++;
      this.syncName();
    } else if (code === "ArrowUp") this.turn(-1);
    else if (code === "ArrowDown") this.turn(1);
    else if (code === "ArrowLeft" || code === "ArrowRight") {
      const cursor = Math.max(
        0,
        Math.min(2, this.cursor + (code === "ArrowLeft" ? -1 : 1)),
      );
      if (cursor !== this.cursor) this.sound("move");
      this.cursor = cursor;
      this.syncName();
    } else if (code === "Enter" || code === "Space") {
      this.sound("ok");
      if (this.cursor < 2) {
        this.cursor++;
        this.syncName();
      } else this.nameDone?.();
    } else if (code === "Escape" || code === "Backspace") {
      if (this.cursor > 0) {
        this.sound("cancel");
        this.cursor--;
        this.syncName();
      }
    }
  }
  save() {
    const name = this.nameText;
    try {
      this.storage.setItem("hover-player-name", name);
    } catch {}
    for (const row of this.batch) {
      HoverRecords.save(
        this.recordClass,
        row.course,
        "lap",
        row.best,
        row.machine,
        name,
      );
      HoverRecords.save(
        this.recordClass,
        row.course,
        "total",
        row.total,
        row.machine,
        name,
      );
    }
    this.savedName = name;
  }
  showRecordPage(done: () => void) {
    const course = this.batch[this.page].course;
    const mine = this.batch[this.page];
    const column = (kind: "lap" | "total") => {
      const rows = HoverRecords.read("gp", course, kind);
      const time = kind === "lap" ? mine.best : mine.total;
      const highlight = rows.findIndex(
        (r) =>
          r.time === time &&
          r.machine === mine.machine &&
          r.name === this.savedName,
      );
      return `<section><h3 class="gp-label">${kind === "lap" ? "BEST LAP" : "TOTAL"}</h3><ol class="gp-record-rows">${Array.from(
        { length: 6 },
        (_, i) => {
          const r = rows[i];
          return `<li${i === highlight ? " data-player" : ""}><span class="gp-pos">${i + 1}</span><span class="gp-machine">${esc(r ? r.name || "---" : "---")}${i === highlight ? "<small>NEW</small>" : ""}</span><span class="gp-gap">${esc(r ? machineName(r.machine) : "")}</span><span class="gp-time">${hudTime(r?.time)}</span></li>`;
        },
      ).join("")}</ol></section>`;
    };
    this.open(
      "records",
      this.header(
        `${HoverRules.cups[Math.floor(course / 3)]}  ·  RECORDS`,
        courseName(course),
      ) +
        `<div class="gp-tabs" role="group" aria-label="Courses">${this.batch
          .map(
            (r, i) =>
              `<button type="button" data-page="${i}" aria-current="${i === this.page}">${courseLabel(r.course)}</button>`,
          )
          .join("")}</div>` +
        `<div class="gp-record-columns">${column("lap")}${column("total")}</div>` +
        guide([
          ...(this.batch.length > 1 ? [guideArrows("← →", "COURSE")] : []),
          guideKey("ENTER", "FINISH"),
        ]),
    );
    this.layout
      .querySelectorAll<HTMLButtonElement>(".gp-tabs button")
      .forEach((b) => {
        b.onclick = () => this.turnPage(+b.dataset.page! - this.page, done);
      });
    this.confirmAction = done;
    this.backAction = done;
    this.recordsDone = done;
  }
  turnPage(delta: number, done: () => void) {
    const page = Math.max(
      0,
      Math.min(this.batch.length - 1, this.page + delta),
    );
    if (page === this.page) return;
    this.sound("move");
    this.page = page;
    this.showRecordPage(done);
  }
  // A finished run enters the name first when it makes the top six.
  showTimeAttack(result: TimeResult, actions: TimeActions) {
    this.recordClass = result.recordClass;
    this.recordKind = "total";
    this.batch = result.retired
      ? []
      : [
          {
            course: result.course,
            best: Math.min(...result.laps),
            total: result.laps.reduce((a, b) => a + b, 0),
            machine: result.machine,
          },
        ];
    this.loadName();
    const entries = this.newRecords();
    const ranks = { lap: 0, total: 0 };
    for (const e of entries) ranks[e.kind as "lap" | "total"] = e.rank;
    this.timeResult = () => this.showTimeResult(result, actions, ranks);
    const finish = () => {
      if (this.batch.length) this.save();
      this.timeResult?.();
    };
    if (entries.length)
      this.showName(entries, finish, `${result.label}  ·  NEW RECORD`);
    else finish();
  }
  showTimeResult(
    result: TimeResult,
    actions: TimeActions,
    ranks: { lap: number; total: number },
  ) {
    const finished = !result.retired;
    // Switching the record table keeps the menu row.
    const selected = this.screen === "time-result" ? this.selected : 0;
    const total = result.laps.reduce((a, b) => a + b, 0);
    const best = result.laps.length ? Math.min(...result.laps) : NaN;
    const badge = (rank: number) =>
      rank ? ` <span class="gp-new">NEW · ${ordinal(rank)}</span>` : "";
    const laps = [0, 1, 2]
      .map((i) => {
        const t = result.laps[i];
        return `<div${finished && t === best ? " data-best" : ""}${t === undefined ? " data-missing" : ""}><dt>LAP ${i + 1}</dt><dd>${hudTime(t)}</dd></div>`;
      })
      .join("");
    const summary = finished
      ? `<h3 class="gp-label">TOTAL${badge(ranks.total)}</h3>` +
        `<p class="ta-total"><span>${hudTime(total)}</span>${
          result.bestBefore === null
            ? ""
            : `<span class="ta-delta" data-faster="${total < result.bestBefore}">${deltaTime(total - result.bestBefore)}</span><small>VS BEST</small>`
        }</p>` +
        `<dl class="gp-laps">${laps}<div class="gp-best-lap"><dt>BEST LAP${badge(ranks.lap)}</dt><dd>${hudTime(best)}</dd></div></dl>`
      : `<p class="ta-retired">${esc(result.retired!)}</p><dl class="gp-laps">${laps}</dl>`;
    this.open(
      "time-result",
      this.header(
        `${result.label}  ·  ${machineName(result.machine)}`,
        courseName(result.course),
      ) +
        `<section class="ta-summary">${summary}</section>` +
        `<section class="gp-side ta-records">${finished ? this.recordTable(result, ranks) : this.courseBests(result)}</section>` +
        guide([
          guideArrows("↑ ↓", "SELECT"),
          ...(finished ? [guideArrows("← →", "RECORDS")] : []),
          guideKey("ENTER", "CONFIRM"),
        ]),
    );
    this.layout
      .querySelectorAll<HTMLButtonElement>(".ta-records [data-kind]")
      .forEach((b) => {
        b.onclick = () => this.turnKind(b.dataset.kind as "total" | "lap");
      });
    this.menu(
      [
        { label: "RETRY", run: actions.retry },
        { label: "CHANGE MACHINE", run: actions.changeMachine },
        { label: "CHANGE COURSE", run: actions.changeCourse },
        { label: "QUIT", run: actions.quit },
      ],
      `${result.label} result`,
      selected,
    );
  }
  // The course's top six, this run's rows marked NEW.
  private recordTable(
    result: TimeResult,
    ranks: { lap: number; total: number },
  ) {
    const kind = this.recordKind;
    const rows = HoverRecords.read(result.recordClass, result.course, kind);
    const mine = ranks[kind] - 1;
    return (
      `<div class="gp-tabs" role="group" aria-label="Record table">${(
        [
          ["total", "TOTAL"],
          ["lap", "BEST LAP"],
        ] as const
      )
        .map(
          ([k, label]) =>
            `<button type="button" data-kind="${k}" aria-current="${k === kind}">${label}</button>`,
        )
        .join("")}</div>` +
      `<ol class="gp-record-rows ta-record-rows">${Array.from(
        { length: 6 },
        (_, i) => {
          const r = rows[i];
          return `<li${i === mine ? " data-player" : ""}><span class="gp-pos">${i + 1}</span><span class="gp-machine">${esc(r ? r.name || "---" : "---")}${i === mine ? "<small>NEW</small>" : ""}</span><span class="gp-gap">${r ? `${machineIcon(r.machine)}${esc(machineName(r.machine))}` : ""}</span><span class="gp-time">${hudTime(r?.time)}</span></li>`;
        },
      ).join("")}</ol>`
    );
  }
  // A retired run saves nothing; the course's bests stay as the target.
  private courseBests(result: TimeResult) {
    const best = (kind: string, label: string) => {
      const r = HoverRecords.read(result.recordClass, result.course, kind)[0];
      return `<div><dt>${label}</dt><dd>${hudTime(r?.time)}${r ? ` <small>${esc(r.name || "---")} · ${esc(machineName(r.machine))}</small>` : ""}</dd></div>`;
    };
    return `<h3 class="gp-label">COURSE RECORDS</h3><dl class="gp-laps ta-bests">${best("total", "BEST TOTAL")}${best("lap", "BEST LAP")}</dl>`;
  }
  turnKind(kind: "total" | "lap") {
    if (kind === this.recordKind) return;
    this.sound("move");
    this.recordKind = kind;
    this.timeResult?.();
  }
  key(code: string) {
    if (!this.screen) return false;
    if (this.screen === "name") {
      this.nameKey(code);
      return true;
    }
    if (this.items.length && (code === "ArrowUp" || code === "ArrowDown")) {
      const selected = Math.max(
        0,
        Math.min(
          this.items.length - 1,
          this.selected + (code === "ArrowUp" ? -1 : 1),
        ),
      );
      if (selected !== this.selected) this.sound("move");
      this.select(selected);
    } else if (
      this.screen === "records" &&
      (code === "ArrowLeft" || code === "ArrowRight")
    )
      this.turnPage(code === "ArrowLeft" ? -1 : 1, this.recordsDone);
    else if (
      this.screen === "time-result" &&
      (code === "ArrowLeft" || code === "ArrowRight") &&
      this.batch.length
    )
      this.turnKind(code === "ArrowLeft" ? "total" : "lap");
    else if (CONFIRM.includes(code)) this.confirm();
    else if (BACK.includes(code) && this.backAction) {
      this.sound("cancel");
      this.backAction();
    }
    return true;
  }
  // Pad buttons follow the pause menu: A confirms, B goes back.
  padCodes() {
    const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    const codes = new Set<string>();
    if (pad) {
      const b = (i: number) => pad.buttons[i]?.pressed;
      if (b(12) || pad.axes[1] < -0.5) codes.add("ArrowUp");
      if (b(13) || pad.axes[1] > 0.5) codes.add("ArrowDown");
      if (b(14) || pad.axes[0] < -0.5) codes.add("ArrowLeft");
      if (b(15) || pad.axes[0] > 0.5) codes.add("ArrowRight");
      if (b(0) || b(9)) codes.add("Enter");
      if (b(1)) codes.add("Escape");
    }
    return codes;
  }
  gamepad() {
    const codes = this.padCodes();
    for (const code of codes) if (!this.padHeld.has(code)) this.key(code);
    this.padHeld = codes;
  }
}
