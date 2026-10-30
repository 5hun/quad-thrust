// Source: src/rules.ts. Build with npm run build; do not edit dist/rules.js directly.
/* GP1_MAIN.C GameMode selection; GAME.C opponent composition / GP progression. */
namespace HoverRules {
  export const cups = [
    "BLUE GRAND PRIX",
    "YELLOW GRAND PRIX",
    "RED GRAND PRIX",
  ];
  // GP1_MAIN.C save_data.omake; keep progress separate from race records.
  let sessionUnlocks = 0;
  export function unlocks() {
    try {
      sessionUnlocks |= Number(localStorage.getItem("hover-unlocks")) & 15;
    } catch {}
    if (HoverTraining.loadMarks().every((mark) => (mark & 31) === 31))
      sessionUnlocks |= 8;
    return sessionUnlocks;
  }
  export function completeCup(cup: number) {
    sessionUnlocks = unlocks() | (1 << cup);
    try {
      localStorage.setItem("hover-unlocks", String(sessionUnlocks));
    } catch {}
  }
  export function machineCount() {
    const flags = unlocks();
    return flags & 8 ? 6 : flags & 4 ? 5 : 4;
  }
  export function availableCups() {
    const flags = unlocks();
    return flags & 2 ? 3 : flags & 1 ? 2 : 1;
  }
  export function profile(mode: string) {
    const gp = /^gp[0-2]$/.test(mode),
      practice = mode === "practice" || mode === "race",
      free = mode === "free",
      training = /^train[0-2]$/.test(mode);
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
              : "CPUなしの3周タイムアタック。ベスト走行のゴーストと競えます。",
    };
  }
  export function opponents(type: number) {
    return [0, 1, 2, 3].filter((i) => i !== type).slice(0, 3);
  }
  export function recordKey(mode: string, course: string | number) {
    const category = profile(mode).recordClass;
    return category === null ? null : `hover-v3-record-${category}-${course}`;
  }
  export function nextCourse(
    mode: string,
    course: number,
    rank: number,
    finished: boolean,
  ) {
    return profile(mode).cup !== null &&
      finished &&
      rank === 1 &&
      course % 3 < 2
      ? course + 1
      : null;
  }
}
Object.assign(typeof window !== "undefined" ? window : globalThis, {
  HoverRules,
});
if (typeof module !== "undefined") module.exports = HoverRules;
