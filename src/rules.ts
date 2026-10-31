// Source: src/rules.ts. Build with npm run build; do not edit dist/rules.js directly.
/* GP1_MAIN.C GameMode selection; GAME.C opponent composition / GP progression. */
namespace HoverRules {
  let stateStorage: Pick<Storage, "getItem" | "setItem"> | null = null;
  export function useStorage(value: Pick<Storage, "getItem" | "setItem">) {
    stateStorage = value;
    sessionUnlocks = 0;
  }

  export const cups = [
    "BLUE GRAND PRIX",
    "YELLOW GRAND PRIX",
    "RED GRAND PRIX",
  ];
  // GP1_MAIN.C save_data.omake; keep progress separate from race records.
  let sessionUnlocks = 0;
  export function unlocks() {
    try {
      sessionUnlocks |=
        Number((stateStorage || localStorage).getItem("hover-unlocks")) & 7;
    } catch {}
    return sessionUnlocks;
  }
  export function completeCup(cup: number) {
    sessionUnlocks = unlocks() | (1 << cup);
    try {
      (stateStorage || localStorage).setItem(
        "hover-unlocks",
        String(sessionUnlocks),
      );
    } catch {}
  }
  export function machineCount() {
    return unlocks() & 4 ? 5 : 4;
  }
  export function availableCups() {
    const flags = unlocks();
    return flags & 2 ? 3 : flags & 1 ? 2 : 1;
  }
  export function profile(mode: string) {
    const gp = /^gp[0-2]$/.test(mode),
      practice = mode === "practice" || mode === "race";
    return {
      sourceMode: gp ? 0 : practice ? 1 : 4,
      cup: gp ? Number(mode.slice(2)) : null,
      opponents: gp || practice,
      recordClass: gp || practice ? "gp" : "time",
      description: gp
        ? "3コースのGP。各レース1位で次のコースへ進みます。"
        : practice
          ? "好きなコースでCPU3台と3周レース。ダメージあり。順位に関係なく、同じコースを何度でも練習できます。"
          : "CPUなしの3周タイムアタック。保持中のゴーストと競えます。",
    };
  }
  export function opponents(type: number) {
    return [0, 1, 2, 3].filter((i) => i !== type).slice(0, 3);
  }
  export function recordKey(mode: string, course: string | number) {
    const category = profile(mode).recordClass;
    return `hover-v3-record-${category}-${course}`;
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
