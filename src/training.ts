// Source: src/training.ts. Build with npm run build; do not edit dist/training.js directly.
/* TRAINIG.C training_set / training_check / game_init_tr. Rules run at 60 Hz. */
namespace HoverTraining {
  let stateStorage: Pick<Storage, "getItem" | "setItem"> | null = null;
  export function useStorage(value: Pick<Storage, "getItem" | "setItem">) {
    stateStorage = value;
  }

  const descriptions = [
    "スラスターのみで一回転せよ",
    "ゴールせよ",
    "ゴールせよ",
    "壁に当たらずゴールせよ",
    "ゴールせよ",
    "180 Km/h以上を維持し、壁に当たらずゴールせよ",
    "赤い床を避けてゴールせよ",
    "200 Km/h以下に落とすな",
    "壁に当たらず1位でゴールせよ",
    "壁に当たらずゴールせよ",
    "ノーダメージで、1位でゴールせよ",
    "1位でゴールせよ",
    "ノーダメージでゴールせよ",
    "230 Km/h以下に落とすな",
    "壁に当たらず1位を守れ",
  ];
  const limits = [60, 12, 12, 18, 18, 15, 16, 20, 25, 20, 12, 27, 18, 25, 33];
  const levels = [1, 1, 2, 3, 4, 5, 4, 10, 2, 4, 4, 9, 7, 10, 6];
  export const tasks = descriptions.map((description, id) => ({
    id,
    name: `TRAINING ${1 + Math.floor(id / 5)}-${1 + (id % 5)}`,
    description,
    limit: limits[id],
    cpuLevel: levels[id],
    opponents: id >= 5,
    rolling: [5, 7, 13, 14].includes(id),
    noWall: [3, 5, 8, 9, 14].includes(id),
    noDamage: [10, 12].includes(id),
    firstAtGoal: [8, 10, 11].includes(id),
    alwaysFirst: id === 14,
    minSpeed: ({ 5: 360, 7: 400, 13: 460 } as Record<number, number>)[id] || 0,
    turn: id === 0,
  }));
  export function create(stage: number, heading = 0): TrainingSession {
    return {
      task: tasks[stage],
      remaining: tasks[stage].limit * 60,
      heading,
      turn: 0,
      status: null,
      reason: "",
    };
  }
  export function step(
    session: TrainingSession,
    car: Car,
    input: Input,
    rank: number,
    events: string[],
  ) {
    if (session.status) return session.status;
    const task = session.task;
    session.remaining--;
    const miss = (reason: string) => {
      session.reason = reason;
      return (session.status = "miss");
    };
    if (task.noDamage && car.damage > 0) return miss("ダメージを受けました");
    if (task.minSpeed > car.sourceSpeed)
      return miss(`${task.minSpeed / 2} Km/hを下回りました`);
    if (session.remaining <= 0) return miss("制限時間を超えました");
    if (task.alwaysFirst && rank !== 1) return miss("1位から下がりました");
    if (task.noWall && events.includes("wall")) return miss("壁に接触しました");
    if (task.turn && input.steer && HoverEngine.MACHINES[car.type].rudder)
      return miss("ラダーを使用しました");
    if (car.finished)
      return miss(
        car.reason === "course-out"
          ? "コースから落下しました"
          : "機体が破壊されました",
      );
    if (task.turn) {
      session.turn += Math.atan2(
        Math.sin(car.heading - session.heading),
        Math.cos(car.heading - session.heading),
      );
      session.heading = car.heading;
      if (Math.abs(session.turn) >= Math.PI * 2 - 0.001) {
        session.reason = "スラスターで一回転しました";
        return (session.status = "complete");
      }
    }
    if (events.includes("goal")) {
      if (task.firstAtGoal && rank !== 1)
        return miss("1位でゴールできませんでした");
      session.reason = "課題を達成しました";
      return (session.status = "complete");
    }
    return null;
  }
  export function spawn(
    track: Track,
    type: number,
    slot: number,
    stage: number,
  ) {
    const E = HoverEngine;
    const z =
        stage === 14
          ? slot === 0
            ? type === 4
              ? 200
              : -600
            : -800 - (slot - 1) * 30
          : slot * 30,
      x = slot % 2 ? 25 : 10;
    const p = E.nearest(track, x, z);
    const car = E.create(track, type);
    Object.assign(car, {
      x,
      z,
      y: p.y + 2,
      heading: p.heading,
      index: p.index,
      lastDistance: p.distance,
      progress: p.distance,
      groundY: p.y,
      previousTile: p.tile,
      pace: 160 + tasks[stage].cpuLevel * 8,
      cpuSlot: slot,
    });
    return car;
  }
  export function drive(car: Car, track: Track) {
    const E = HoverEngine;
    const input = E.drive(car, track, car.pace || 230);
    car.aiTicks = (car.aiTicks || 0) + 1;
    if (car.aiTicks < 480) input.turbo = true;
    return input;
  }
  export function loadMarks() {
    try {
      const marks = JSON.parse(
        (stateStorage || localStorage).getItem("hover-training-marks") || "[]",
      );
      return tasks.map((_, i) => (Number(marks[i]) || 0) & 63);
    } catch {
      return tasks.map(() => 0);
    }
  }
  export function saveMark(stage: number, type: number) {
    const marks = loadMarks();
    marks[stage] |= 1 << type;
    try {
      (stateStorage || localStorage).setItem(
        "hover-training-marks",
        JSON.stringify(marks),
      );
    } catch {}
    return marks;
  }
}
Object.assign(typeof window !== "undefined" ? window : globalThis, {
  HoverTraining,
});
if (typeof module !== "undefined") module.exports = HoverTraining;
