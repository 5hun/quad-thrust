export class ReplayMemory {
    saved = null;
    recent = null;
    raceGhost = null;
    beginRace(course, machine, sourceMode, enabled = true) {
        const tape = this.saved;
        this.raceGhost =
            enabled &&
                sourceMode === 4 &&
                tape?.gameMode === 4 &&
                tape.course === course &&
                !(machine === 5 && tape.machine === 5)
                ? tape
                : null;
        return this.raceGhost;
    }
    complete(tape) {
        this.recent = tape;
        if (this.raceGhost &&
            tape.gameMode === 4 &&
            this.raceGhost.totalTicks <= tape.totalTicks)
            this.saved = this.raceGhost;
        else
            this.saved = tape;
    }
}
