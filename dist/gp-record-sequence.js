// GAME.C grandprix_entry_mode: one name, 60-tick lead-in, 7/1-second pages.
export class GPRecordSequence {
    count;
    frame = 0;
    course = 0;
    entering;
    done = false;
    constructor(count, qualifies) {
        this.count = count;
        this.entering = qualifies;
    }
    get page() {
        if (this.entering)
            return "name";
        const t = this.frame - this.course * 960;
        if (t >= 60 && t < 480)
            return "lap";
        if (t >= 540 && t < 960)
            return "total";
        return "gap";
    }
    finishName() {
        this.entering = false;
        this.frame = 1;
    }
    tick() {
        if (this.done || this.entering)
            return;
        this.frame++;
        if (this.frame === 960 + this.course * 960) {
            this.course++;
            if (this.course >= this.count)
                this.done = true;
        }
    }
    skipPage() {
        if (this.done)
            return;
        if (this.page === "lap")
            this.frame = 480 + this.course * 960;
        else if (this.page === "total") {
            this.frame = 960 + this.course * 960;
            if (++this.course >= this.count)
                this.done = true;
        }
    }
    start() {
        if (!this.entering && this.frame > 60)
            this.done = true;
    }
}
