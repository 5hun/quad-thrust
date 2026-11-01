// Source: src/goal-banner.ts. Build with npm run build; do not edit dist/goal-banner.js directly.
// Finish-line banner shown over the goal drive, in place of the 3D letters.
import { hudTime } from "./hud.js";
import { deltaTime } from "./gp-screens.js";

const ORDINALS = ["ST", "ND", "RD", "TH"];
export interface Goal {
  // Grand Prix finishing position against the opponents.
  place: number;
  total: number;
  best: number;
  lapRecord: boolean;
  totalRecord: boolean;
}
// Time Attack and practice: the time against the course's best.
export interface TimedGoal {
  label: string;
  total: number;
  best: number;
  // Against the saved best total, or null on the course's first record.
  delta: number | null;
  // Places among the top six, or 0 outside them.
  totalRank: number;
  lapRank: number;
  ghostUpdated: boolean;
}
export class GoalBanner {
  root = document.getElementById("goal-banner")!;
  get visible() {
    return !this.root.hidden;
  }
  show(goal: Goal) {
    const badge = (label: string, time: number, record: boolean) =>
      `<p class="goal-badge"${record ? " data-record" : ""}>${record ? "NEW " : ""}${label}<span>${hudTime(time)}</span></p>`;
    this.root.innerHTML =
      `<div class="goal-layout"><div class="goal-text">` +
      `<p class="goal-kicker">FINISH</p><p class="goal-main goal-place">${goal.place}<span>${ORDINALS[goal.place - 1]}</span></p>` +
      `</div><div class="goal-badges">${goal.lapRecord ? badge("BEST LAP", goal.best, true) : ""}${badge("TOTAL", goal.total, goal.totalRecord)}</div></div>`;
    this.root.setAttribute(
      "aria-label",
      `FINISH ${goal.place}${ORDINALS[goal.place - 1]}`,
    );
    this.root.hidden = false;
  }
  showTimed(goal: TimedGoal) {
    const place = (rank: number) => `${rank}${ORDINALS[Math.min(rank, 4) - 1]}`;
    const badges = [
      goal.totalRank
        ? `<p class="goal-badge" data-record>NEW RECORD<span>TOTAL ${place(goal.totalRank)}</span></p>`
        : "",
      goal.lapRank
        ? `<p class="goal-badge" data-record>NEW BEST LAP<span>${hudTime(goal.best)} · ${place(goal.lapRank)}</span></p>`
        : "",
      goal.ghostUpdated ? `<p class="goal-badge">GHOST UPDATED</p>` : "",
    ].join("");
    this.root.innerHTML =
      `<div class="goal-layout"><div class="goal-text">` +
      `<p class="goal-kicker">${goal.label}  ·  FINISH</p><p class="goal-main goal-time">${hudTime(goal.total)}</p>` +
      (goal.delta === null
        ? ""
        : `<p class="goal-delta" data-faster="${goal.delta < 0}"><span>${deltaTime(goal.delta)}</span>VS BEST</p>`) +
      `</div><div class="goal-badges">${badges}</div></div>`;
    this.root.setAttribute(
      "aria-label",
      `${goal.label} FINISH ${hudTime(goal.total)}`,
    );
    this.root.hidden = false;
  }
  hide() {
    this.root.hidden = true;
    this.root.replaceChildren();
  }
}
