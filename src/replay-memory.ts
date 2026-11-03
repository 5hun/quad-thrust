// Time Attack keeps the fastest tape of every course as that course's ghost,
// saved across sessions. `recent` is the latest attempt in any mode, which the
// result screen replays.
import type { ReplayTape } from "./input-replay.js";
type GhostStorage = Pick<Storage, "getItem" | "setItem">;
export const ghostKey = (course: number) => `hover-ghost-${course}`;
export class ReplayMemory {
  best: (ReplayTape | null)[] = [];
  recent: ReplayTape | null = null;
  raceGhost: ReplayTape | null = null;
  // The course best when the race began. A race is completed twice (goal and
  // after the goal drive), and both calls compare against the same tape.
  private raceBest: ReplayTape | null = null;
  constructor(private storage: GhostStorage | null = null) {
    for (let course = 0; course < 9; course++)
      try {
        const raw = storage?.getItem(ghostKey(course));
        const tape = raw ? (JSON.parse(raw) as ReplayTape) : null;
        this.best[course] = tape?.course === course ? tape : null;
      } catch {
        this.best[course] = null;
      }
  }
  ghost(course: number) {
    return this.best[course] ?? null;
  }
  beginRace(course: number, sourceMode: number, enabled = true) {
    this.raceBest = this.ghost(course);
    this.raceGhost = enabled && sourceMode === 4 ? this.raceBest : null;
    return this.raceGhost;
  }
  complete(tape: ReplayTape) {
    this.recent = tape;
    if (tape.gameMode !== 4) return;
    if (this.raceBest && this.raceBest.totalTicks <= tape.totalTicks) return;
    this.best[tape.course] = tape;
    try {
      this.storage?.setItem(ghostKey(tape.course), JSON.stringify(tape));
    } catch {}
  }
}
