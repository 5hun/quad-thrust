// Source: src/goal-banner.ts. Build with npm run build; do not edit dist/goal-banner.js directly.
// Finish-line banner shown over the goal drive, in place of the 3D letters.
import { hudTime } from "./hud.js";

const ORDINALS = ["ST", "ND", "RD", "TH"];
export interface Goal {
  // Finishing position against opponents, or null in Time Attack.
  place: number | null;
  total: number;
  best: number;
  lapRecord: boolean;
  totalRecord: boolean;
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
      (goal.place === null
        ? `<p class="goal-main goal-finish">FINISH</p>`
        : `<p class="goal-kicker">FINISH</p><p class="goal-main goal-place">${goal.place}<span>${ORDINALS[goal.place - 1]}</span></p>`) +
      `</div><div class="goal-badges">${goal.lapRecord ? badge("BEST LAP", goal.best, true) : ""}${badge("TOTAL", goal.total, goal.totalRecord)}</div></div>`;
    this.root.setAttribute(
      "aria-label",
      goal.place === null
        ? "FINISH"
        : `FINISH ${goal.place}${ORDINALS[goal.place - 1]}`,
    );
    this.root.hidden = false;
  }
  hide() {
    this.root.hidden = true;
    this.root.replaceChildren();
  }
}
