// GAME.C game_init2 / game_end: REPLAY_BUFF and the latest TA attempt are
// distinct buffers. A previous course/machine's tape is not a per-course cache.
import type { ReplayTape } from "./input-replay.js";
export class ReplayMemory {
  saved: ReplayTape | null = null;
  recent: ReplayTape | null = null;
  raceGhost: ReplayTape | null = null;
  beginRace(course: number, sourceMode: number, enabled = true) {
    const tape = this.saved;
    this.raceGhost =
      enabled &&
      sourceMode === 4 &&
      tape?.gameMode === 4 &&
      tape.course === course
        ? tape
        : null;
    return this.raceGhost;
  }
  complete(tape: ReplayTape) {
    this.recent = tape;
    if (
      this.raceGhost &&
      tape.gameMode === 4 &&
      this.raceGhost.totalTicks <= tape.totalTicks
    )
      this.saved = this.raceGhost;
    else this.saved = tape;
  }
}
