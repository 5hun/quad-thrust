"use strict";
// Source: src/rules.ts. Build with npm run build; do not edit dist/rules.js directly.
/* GP1_MAIN.C GameMode selection; GAME.C opponent composition / GP progression. */
var HoverRules;
(function (HoverRules) {
    HoverRules.cups = [
        "BLUE GRAND PRIX",
        "YELLOW GRAND PRIX",
        "RED GRAND PRIX",
    ];
    // GP1_MAIN.C save_data.omake; keep progress separate from race records.
    let sessionUnlocks = 0;
    function unlocks() {
        try {
            sessionUnlocks |= Number(localStorage.getItem("hover-unlocks")) & 15;
        }
        catch { }
        if (HoverTraining.loadMarks().every((mark) => (mark & 31) === 31))
            sessionUnlocks |= 8;
        return sessionUnlocks;
    }
    HoverRules.unlocks = unlocks;
    function completeCup(cup) {
        sessionUnlocks = unlocks() | (1 << cup);
        try {
            localStorage.setItem("hover-unlocks", String(sessionUnlocks));
        }
        catch { }
    }
    HoverRules.completeCup = completeCup;
    function machineCount() {
        const flags = unlocks();
        return flags & 8 ? 6 : flags & 4 ? 5 : 4;
    }
    HoverRules.machineCount = machineCount;
    function availableCups() {
        const flags = unlocks();
        return flags & 2 ? 3 : flags & 1 ? 2 : 1;
    }
    HoverRules.availableCups = availableCups;
    function profile(mode) {
        const gp = /^gp[0-2]$/.test(mode), practice = mode === "practice" || mode === "race", free = mode === "free", training = /^train[0-2]$/.test(mode);
        return {
            training,
            level: training ? Number(mode.slice(-1)) : null,
            sourceMode: training ? 0 : gp ? 0 : practice ? 1 : free ? 2 : 4,
            cup: gp ? Number(mode.slice(2)) : null,
            opponents: gp || practice,
            laps: free ? null : 3,
            invulnerable: free,
            recordClass: free || training ? null : gp || practice ? "gp" : "time",
            description: training
                ? "専用コースの課題を制限時間内に達成します。クリア状況は機体別に保存されます。"
                : gp
                    ? "3コースのGP。各レース1位で次のコースへ進みます。"
                    : practice
                        ? "好きなコースでCPU3台と3周レース。ダメージあり。順位に関係なく、同じコースを何度でも練習できます。"
                        : free
                            ? "CPUなし・ダメージなし・周回数無制限。Rキーでコースに復帰できます。"
                            : "CPUなしの3周タイムアタック。保持中のゴーストと競えます。",
        };
    }
    HoverRules.profile = profile;
    function opponents(type) {
        return [0, 1, 2, 3].filter((i) => i !== type).slice(0, 3);
    }
    HoverRules.opponents = opponents;
    function recordKey(mode, course) {
        const category = profile(mode).recordClass;
        return category === null ? null : `hover-v3-record-${category}-${course}`;
    }
    HoverRules.recordKey = recordKey;
    function nextCourse(mode, course, rank, finished) {
        return profile(mode).cup !== null &&
            finished &&
            rank === 1 &&
            course % 3 < 2
            ? course + 1
            : null;
    }
    HoverRules.nextCourse = nextCourse;
})(HoverRules || (HoverRules = {}));
Object.assign(typeof window !== "undefined" ? window : globalThis, {
    HoverRules,
});
if (typeof module !== "undefined")
    module.exports = HoverRules;
