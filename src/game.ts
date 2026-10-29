// Source: src/game.ts. Build with npm run build; do not edit dist/game.js directly.
interface Elements {
  sound: HTMLButtonElement;
  game: HTMLCanvasElement;
  hud: HTMLElement;
  "original-hud": HTMLCanvasElement;
  "course-label": HTMLElement;
  lap: HTMLElement;
  time: HTMLElement;
  best: HTMLElement;
  "energy-num": HTMLElement;
  energy: HTMLElement;
  thrusters: HTMLElement;
  speed: HTMLElement;
  position: HTMLElement;
  pause: HTMLButtonElement;
  minimap: HTMLCanvasElement;
  message: HTMLElement;
  menu: HTMLElement;
  mode: HTMLSelectElement;
  difficulty: HTMLSelectElement;
  "mode-description": HTMLElement;
  "training-status": HTMLElement;
  "course-caption": HTMLElement;
  course: HTMLSelectElement;
  "preview-map": HTMLCanvasElement;
  "course-number": HTMLElement;
  "course-distance": HTMLElement;
  record: HTMLElement;
  machine: HTMLSelectElement;
  "machine-description": HTMLElement;
  stats: HTMLElement;
  quality: HTMLSelectElement;
  "ghost-enabled": HTMLInputElement;
  start: HTMLButtonElement;
  "pause-panel": HTMLElement;
  resume: HTMLButtonElement;
  restart: HTMLButtonElement;
  back: HTMLButtonElement;
  result: HTMLElement;
  "result-tag": HTMLElement;
  "result-title": HTMLElement;
  "result-text": HTMLElement;
  "lap-times": HTMLElement;
  "next-race": HTMLButtonElement;
  again: HTMLButtonElement;
  "result-back": HTMLButtonElement;
  touch: HTMLElement;
  "records-panel": HTMLElement;
  "records-list": HTMLElement;
}
function $<K extends keyof Elements>(id: K): Elements[K] {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as Elements[K];
}
import { HoverRenderer } from "./renderer.js";
import { OriginalSound } from "./sound.js";
import { OriginalHUD } from "./hud.js";
const originalSound = new OriginalSound();
const E = HoverEngine,
  R = HoverRules,
  T = HoverTraining,
  B = HoverRecords,
  canvas = $("game"),
  tracks = HOVER_TRACKS.map(E.prepare);
const trainingTracks = HOVER_TRAINING_TRACKS.map(E.prepare);
let trainingSession: TrainingSession | null = null;
const originalHUD = new OriginalHUD($("original-hud"));
let view: HoverRenderer;
try {
  view = new HoverRenderer(canvas);
} catch (error) {
  $("message").textContent = "WebGL 2 が必要です";
  $("start").disabled = true;
  throw error;
}
let track = tracks[0],
  car = E.create(track),
  mode = "time",
  state = "menu",
  countdown = 5,
  last = 0,
  accumulator = 0,
  worldTime = 0,
  demoDistance = 100,
  keys: Record<string, boolean> = {},
  bots: Car[] = [],
  sound = true,
  padPause = false,
  toastTimer = 0;
const format = (t: number) => {
  if (!Number.isFinite(t)) return "—";
  const ms = Math.round(t * 1000);
  return (
    String(Math.floor(ms / 60000)).padStart(2, "0") +
    ":" +
    String(Math.floor(ms / 1000) % 60).padStart(2, "0") +
    "." +
    String(ms % 1000).padStart(3, "0")
  );
};
// Original TimeMode keeps GP (including PRACTICE) and Time Attack records apart.
function recordKey() {
  return R.recordKey($("mode").value, $("course").value);
}
function ghostKey() {
  return "hover-v2-" + $("course").value + "-" + $("machine").value + "-ghost";
}
function getBest() {
  try {
    const key = recordKey();
    return key ? Number(localStorage.getItem(key)) || Infinity : Infinity;
  } catch {
    return Infinity;
  }
}
function saveBest(t: number) {
  try {
    const key = recordKey();
    if (key && t < getBest()) localStorage.setItem(key, String(t));
  } catch {}
}
function setCourseOptions() {
  const rules = R.profile($("mode").value);
  $("course").replaceChildren();
  const marks = T.loadMarks();
  if (rules.training) {
    T.tasks
      .slice(rules.level! * 5, rules.level! * 5 + 5)
      .forEach((t) =>
        $("course").add(
          new Option(
            `${t.name}${marks[t.id] & (1 << +$("machine").value) ? " / COMPLETE" : ""}`,
            String(t.id),
          ),
        ),
      );
  } else
    tracks.forEach((t, i) =>
      $("course").add(
        new Option(`${String(i + 1).padStart(2, "0")} / ${t.name}`, String(i)),
      ),
    );
}
function selectedTrack() {
  return (R.profile($("mode").value).training ? trainingTracks : tracks)[
    +$("course").value
  ];
}
setCourseOptions();
E.MACHINES.forEach((m, i) =>
  $("machine").add(
    new Option(`${m.name}${!m.rudder ? " / スラスター専用" : ""}`, String(i)),
  ),
);
function mapDraw(
  c: HTMLCanvasElement,
  t: Track,
  player: Pose | null = null,
  others: Pose[] = [],
) {
  const g = c.getContext("2d")!,
    w = c.width,
    h = c.height;
  g.clearRect(0, 0, w, h);
  const xs = t.nodes.map((p) => p.x),
    zs = t.nodes.map((p) => p.z),
    minx = Math.min(...xs),
    maxx = Math.max(...xs),
    minz = Math.min(...zs),
    maxz = Math.max(...zs),
    scale = Math.min((w - 30) / (maxx - minx), (h - 25) / (maxz - minz));
  const xy = (p: { x: number; z: number }) => [
    w / 2 + (p.x - (minx + maxx) / 2) * scale,
    h / 2 - (p.z - (minz + maxz) / 2) * scale,
  ];
  g.strokeStyle = "#718998";
  g.lineWidth = 4;
  g.lineJoin = "round";
  g.beginPath();
  t.nodes.forEach((p, i) => {
    const [x, y] = xy(p);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  if (!t.training) g.closePath();
  g.stroke();
  for (const p of [t.nodes[0], ...others, ...(player ? [player] : [])]) {
    const [x, y] = xy(p);
    g.fillStyle =
      p === player ? "#b3ff65" : p === t.nodes[0] ? "white" : "#ff9777";
    g.beginPath();
    g.arc(x, y, p === player ? 4 : 2.5, 0, Math.PI * 2);
    g.fill();
  }
}
function select() {
  const rules = R.profile($("mode").value);
  $("mode-description").textContent = rules.description;
  $("course-caption").firstChild!.textContent = rules.training
    ? "TRAINING STAGE "
    : "CIRCUIT ";
  $("course-caption").querySelector("span")!.textContent = rules.training
    ? "5 STAGES / LEVEL " + (rules.level! + 1)
    : "9 ORIGINAL TRACKS";
  $("start").firstChild!.textContent = rules.training
    ? "START TRAINING "
    : "START RACE ";
  $("records-panel").hidden = !rules.recordClass;
  const formatRows = (kind: string) =>
    B.read(rules.recordClass, $("course").value, kind)
      .map(
        (row, i) =>
          `${i + 1}. ${format(row.time)} / ${E.MACHINES[row.machine]?.name || "—"}`,
      )
      .join("<br>") || "記録なし";
  $("records-list").innerHTML =
    "<p>BEST LAP<br>" +
    formatRows("lap") +
    "</p><p>TOTAL<br>" +
    formatRows("total") +
    "</p>";
  $("course").disabled = rules.cup !== null;
  $("ghost-enabled").disabled = rules.recordClass !== "time";
  $("difficulty").disabled = !rules.opponents;
  if (rules.cup !== null && state === "menu")
    $("course").value = String(rules.cup * 3);
  track = selectedTrack();
  car = E.create(track, +$("machine").value);
  demoDistance = track.length * 0.08;
  const m = E.MACHINES[car.type];
  $("machine-description").textContent = m.desc;
  $("course-number").textContent =
    String(+$("course").value + 1).padStart(2, "0") + " / 09";
  $("course-distance").textContent = "ORIGINAL CIRCUIT";
  $("record").textContent = rules.training
    ? "LIMIT " + T.tasks[+$("course").value].limit + " SEC"
    : "BEST " + format(getBest());
  $("training-status").hidden = !rules.training;
  if (rules.training) {
    const task = T.tasks[+$("course").value],
      marks = T.loadMarks();
    $("mode-description").textContent =
      task.description + " / 制限時間 " + task.limit + " 秒";
    $("training-status").textContent =
      "この機体：" +
      (marks[task.id] & (1 << car.type) ? "COMPLETE" : "未クリア") +
      " · クリア機体 " +
      E.MACHINES.filter((_, i) => marks[task.id] & (1 << i))
        .map((m) => m.name)
        .join(" / ");
    $("course-number").textContent =
      rules.level! + 1 + "-" + ((task.id % 5) + 1);
  }
  $("stats").innerHTML = (
    [
      ["ACCEL", m.accel / 650],
      ["HANDLING", m.rotation / 25],
      ["DURABILITY", m.tank / 40000],
    ] as [string, number][]
  )
    .map(
      ([n, v]) =>
        `<div>${n}<i style="width:${Math.max(12, v * 100)}%"></i></div>`,
    )
    .join("");
  mapDraw($("preview-map"), track);
}
$("mode").onchange = () => {
  setCourseOptions();
  select();
};
$("course").onchange = select;
try {
  const saved = localStorage.getItem("hover-cpu-difficulty");
  if (saved !== null && /^[0-3]$/.test(saved)) $("difficulty").value = saved;
} catch {}
$("difficulty").onchange = () => {
  try {
    localStorage.setItem("hover-cpu-difficulty", $("difficulty").value);
  } catch {}
};
$("machine").onchange = () => {
  if (R.profile($("mode").value).training) {
    const value = $("course").value;
    setCourseOptions();
    $("course").value = value;
  }
  select();
};
select();
$("quality").onchange = () => {
  view.retro = $("quality").value === "retro";
  view.resize();
};
function resize() {
  view.resize();
}
new ResizeObserver(resize).observe(canvas);
let gpRound = 0,
  resultFrames = 0,
  gpCup = 0,
  ghostFrames: number[][] = [],
  recording: number[][] = [],
  ghostClock = 0,
  ghostBestTime = Infinity;
function start(nextRound = false) {
  originalSound.cancel();
  originalSound.pause(false);
  mode = $("mode").value;
  if (mode.startsWith("gp")) {
    gpCup = +mode.slice(2);
    if (nextRound !== true) gpRound = 0;
    $("course").value = String(gpCup * 3 + gpRound);
  }
  track = selectedTrack();
  car = E.create(track, +$("machine").value);
  bots = R.profile(mode).opponents
    ? R.opponents(car.type).map((type, i) => {
        const b = E.create(track, type);
        const p = E.at(track, 20 + i * 9);
        Object.assign(b, {
          x: p.x,
          z: p.z,
          y: p.y + 2,
          index: p.index,
          heading: p.heading,
          lastDistance: 20 + i * 9,
          progress: 12 + i * 9,
          cpuLevel: E.cpuLevels[+$("difficulty").value][+$("course").value],
          cpuSlot: i + 1,
          lastLine: p.index,
          linePosition: p.index,
        });
        return b;
      })
    : [];
  trainingSession = null;
  if (R.profile(mode).training) {
    const stage = +$("course").value;
    car = T.spawn(track, +$("machine").value, 0, stage);
    bots = T.tasks[stage].opponents
      ? R.opponents(car.type).map((type, i) =>
          T.spawn(track, type, i + 1, stage),
        )
      : [];
    trainingSession = T.create(stage, car.heading);
  }
  recording = [[0, car.x, car.y, car.z, car.heading, car.pitch, car.roll]];
  ghostClock = 0.1;
  ghostFrames = [];
  ghostBestTime = Infinity;
  try {
    if (mode === "time") {
      const g = JSON.parse(localStorage.getItem(ghostKey()) || "[]");
      const frames = Array.isArray(g) ? g : g.frames;
      if (
        Array.isArray(frames) &&
        frames.every(
          (f) => Array.isArray(f) && f.length === 7 && f.every(Number.isFinite),
        )
      ) {
        ghostFrames = frames;
        ghostBestTime = Number(g.time) || frames.at(-1)?.[0] || Infinity;
      }
    }
  } catch {}
  state = "countdown";
  countdown = 5;
  accumulator = 0;
  keys = {};
  view.yaw = null;
  toastTimer = 0;
  $("menu").hidden = true;
  $("result").hidden = true;
  $("pause-panel").hidden = true;
  $("next-race").hidden = true;
  $("hud").hidden = false;
  $("touch").hidden = !matchMedia("(pointer:coarse)").matches;
  document.querySelector(".game-wrap")!.classList.add("playing");
  $("course-label").textContent = track.name.toUpperCase();
  $("best").textContent = "BEST " + format(getBest());
  if (sound) initAudio();
  if (trainingSession) originalSound.playCourse("B");
  canvas.focus();
  if (matchMedia("(max-width:600px)").matches)
    requestAnimationFrame(() =>
      document.querySelector(".game-wrap")!.scrollIntoView({ block: "start" }),
    );
}
function menu() {
  trainingSession = null;
  originalSound.cancel();
  originalSound.pause(false);
  state = "menu";
  keys = {};
  $("hud").hidden = true;
  $("pause-panel").hidden = true;
  $("result").hidden = true;
  $("menu").hidden = false;
  $("touch").hidden = true;
  $("message").textContent = "";
  document.querySelector(".game-wrap")!.classList.remove("playing");
  select();
}
function pause() {
  if (state === "running" || state === "countdown" || state === "destroyed") {
    stateBeforePause = state;
    state = "paused";
    originalSound.pause(true);
    keys = {};
    $("pause-panel").hidden = false;
    $("pause-panel").querySelector("p")!.textContent = trainingSession
      ? trainingSession.task.description +
        " / 制限時間 " +
        trainingSession.task.limit +
        " 秒"
      : "レースを再開するか、リトライできます。";
    $("touch").hidden = true;
    $("message").textContent = "";
  } else if (state === "paused") {
    state = stateBeforePause;
    originalSound.pause(false);
    $("pause-panel").hidden = true;
    $("touch").hidden = !matchMedia("(pointer:coarse)").matches;
  }
}
let stateBeforePause = "running";
$("start").onclick = () => start();
$("pause").onclick = pause;
$("resume").onclick = pause;
$("restart").onclick = () => start(true);
$("again").onclick = () => start(true);
$("back").onclick = menu;
$("result-back").onclick = menu;
$("next-race").onclick = () => {
  if (trainingSession) {
    $("course").value = String(trainingSession.task.id + 1);
    start(true);
  } else {
    gpRound++;
    start(true);
  }
};
function finishTraining() {
  if (!trainingSession) return;
  state = "finished";
  $("touch").hidden = true;
  resultFrames = 0;
  $("result").hidden = true;
  $("message").textContent = "";
  const success = trainingSession.status === "complete";
  if (success) T.saveMark(trainingSession.task.id, car.type);
  $("result-tag").textContent = trainingSession.task.name;
  $("result-title").textContent = success ? "COMPLETE" : "MISS";
  $("result-text").textContent = trainingSession.reason;
  $("lap-times").textContent =
    "TIME " +
    format(car.time) +
    " / LIMIT " +
    trainingSession.task.limit +
    " SEC";
  $("again").textContent = "同じ課題を再挑戦";
  $("result-back").textContent = "課題選択に戻る";
  $("next-race").textContent = "次の課題へ";
  $("next-race").hidden = !success || trainingSession.task.id % 5 === 4;
}
function finish() {
  if (trainingSession) {
    finishTraining();
    return;
  }
  $("next-race").textContent = "次のコースへ ↗";
  if (car.reason !== "finish" && !car.explosionPlayed)
    originalSound.effect(68, 30);
  state = "finished";
  $("touch").hidden = true;
  $("result").hidden = false;
  $("message").textContent = "";
  const rank = 1 + bots.filter((b) => b.progress > car.progress).length;
  const failed = car.reason !== "finish";
  if (!failed) {
    const best = Math.min(...car.laps);
    saveBest(best);
    const category = R.profile(mode).recordClass;
    B.save(category, $("course").value, "lap", best, car.type);
    B.save(category, $("course").value, "total", car.time, car.type);
  }
  const gp = mode.startsWith("gp");
  $("again").textContent =
    mode === "practice" ? "同じコースでもう一度練習" : "もう一度走る";
  $("result-back").textContent =
    mode === "practice" ? "別のコースを選ぶ" : "コース選択に戻る";
  $("result-tag").textContent = failed
    ? car.reason === "course-out"
      ? "COURSE OUT"
      : "POWER DEPLETED"
    : gp && rank === 1 && gpRound === 2
      ? "GRAND PRIX CHAMPION"
      : mode === "practice"
        ? "PRACTICE COMPLETE"
        : "RACE COMPLETE";
  $("result-title").textContent = failed
    ? "RETRY"
    : bots.length
      ? `POSITION ${rank} / 4`
      : "FINISH";
  $("result-text").textContent = failed
    ? car.reason === "course-out"
      ? "コースから落下しました。ジャンプ中は壁を越えるため、速度と姿勢に注意してください。"
      : "パワーが尽きました。ターボを控え、回復床を使いましょう。"
    : `TOTAL ${format(car.time)} · ${track.name}`;
  $("lap-times").innerHTML = car.laps
    .map((t, i) => `<div>LAP ${i + 1}　${format(t)}</div>`)
    .join("");
  $("next-race").hidden =
    R.nextCourse(mode, +$("course").value, rank, !failed) === null;
  if (gp && !failed && rank > 1)
    $("result-text").textContent += " · 1位で次のコースへ進みます";
  if (!failed && mode === "time" && car.time < ghostBestTime)
    try {
      localStorage.setItem(
        ghostKey(),
        JSON.stringify({ time: car.time, frames: recording }),
      );
    } catch {}
}
const handled = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "KeyQ",
  "KeyA",
  "KeyE",
  "KeyD",
  "KeyS",
  "ShiftLeft",
  "ShiftRight",
  "Escape",
  "KeyP",
  "KeyR",
  "KeyW",
  "KeyX",
  "Enter",
];
window.addEventListener("keydown", (e) => {
  if (/SELECT|INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) return;
  if (handled.includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === "Escape" || e.code === "KeyP") pause();
  if (e.code === "Enter") {
    if (state === "menu") start();
    else if (state === "finished") start(true);
    else if (state === "paused") pause();
  }
  if (e.code === "KeyR" && state === "running" && mode === "free") {
    E.recover(car, track);
    toast("RECOVERED", 1);
  }
});
window.addEventListener("keyup", (e) => {
  delete keys[e.code];
});
window.addEventListener("blur", () => {
  keys = {};
  if (state === "running" || state === "countdown" || state === "destroyed")
    pause();
});
document.addEventListener("visibilitychange", () => {
  if (
    document.hidden &&
    (state === "running" || state === "countdown" || state === "destroyed")
  )
    pause();
});
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-key]",
)) {
  const release = () => {
    delete keys[button.dataset.key!];
    button.classList.remove("pressed");
  };
  button.onpointerdown = (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    keys[button.dataset.key!] = true;
    button.classList.add("pressed");
  };
  button.onpointerup = release;
  button.onpointercancel = release;
  button.onlostpointercapture = release;
}
function input() {
  const p = Array.from(navigator.getGamepads?.() || []).find(Boolean),
    b = (i: number) => p?.buttons[i]?.pressed || false,
    axis = p && Math.abs(p.axes[0]) > 0.15 ? p.axes[0] : 0;
  if (b(9) && !padPause) pause();
  padPause = b(9);
  return {
    accel: keys.Space || keys.ArrowUp || b(0),
    turbo: keys.ShiftLeft || keys.ShiftRight || b(2),
    brake: keys.KeyS || keys.ArrowDown || b(1),
    steer: +!!keys.ArrowRight - +!!keys.ArrowLeft || axis,
    l1: keys.KeyQ || b(4),
    l2: keys.KeyA || b(6),
    r1: keys.KeyE || b(5),
    r2: keys.KeyD || b(7),
    pitch: +!!keys.KeyX - +!!keys.KeyW || p?.axes[1] || 0,
  };
}
function toast(s: string, d = 1.5) {
  $("message").textContent = s;
  toastTimer = d;
}
function initAudio() {
  originalSound.enable(sound).catch((error) => {
    sound = false;
    $("sound").textContent = "SOUND ERROR";
    console.error(error);
  });
}
$("sound").onclick = () => {
  sound = !sound;
  initAudio();
  $("sound").textContent = sound ? "SOUND ON" : "SOUND OFF";
};
function beep() {
  originalSound.effect(64, 20);
}
let currentInput: Input = {};
function render() {
  let display: Pose = car;
  if (state === "menu") {
    const p = E.at(track, demoDistance);
    display = {
      ...p,
      type: car.type,
      y: p.y + 2,
      pitch: 0,
      roll: 0,
      sourceSpeed: 100,
    };
  }
  let ghost = null;
  if (
    mode === "time" &&
    state !== "menu" &&
    ghostFrames.length &&
    $("ghost-enabled").checked
  ) {
    const k = Math.floor(car.time * 10),
      a = ghostFrames[k],
      b = ghostFrames[k + 1];
    if (a && b) {
      const t = (car.time * 10) % 1;
      ghost = {
        type: car.type,
        x: E.mix(a[1], b[1], t),
        y: E.mix(a[2], b[2], t),
        z: E.mix(a[3], b[3], t),
        heading: a[4] + E.angle(b[4] - a[4]) * t,
        pitch: E.mix(a[5], b[5], t),
        roll: E.mix(a[6], b[6], t),
      };
    }
  }
  view.countdown =
    state === "countdown" ? Math.max(0, Math.ceil(countdown * 60)) : null;
  view.result =
    state === "finished" && trainingSession?.status && resultFrames < 120
      ? {
          text: trainingSession.status === "complete" ? "COMPLETE" : "MISS",
          frame: resultFrames,
        }
      : null;
  view.draw(
    track,
    display,
    state === "menu" ? [] : bots,
    state,
    worldTime,
    state === "menu" ? { accel: true } : currentInput,
    ghost,
  );
}
function hud() {
  originalHUD.draw(
    car,
    track,
    bots,
    mode,
    getBest(),
    state,
    countdown,
    trainingSession,
  );
  const speed = car.sourceSpeed >> 1;
  $("speed").textContent = String(speed).padStart(3, "0");
  $("time").textContent = format(car.time);
  $("lap").textContent =
    mode === "free"
      ? "FREE RUN"
      : `LAP ${Math.min(car.laps.length + 1, 3)} / 3`;
  $("energy").style.width = car.energy + "%";
  $("energy").style.background = car.energy < 25 ? "#ff7969" : "#b3ff65";
  $("energy-num").textContent = Math.ceil(car.energy) + "%";
  $("position").textContent = bots.length
    ? `POSITION ${1 + bots.filter((b) => b.progress > car.progress).length} / 4`
    : mode === "free"
      ? "FREE RUN"
      : "TIME ATTACK";
  const m: Record<string, keyof Input> = {
    KeyQ: "l1",
    KeyA: "l2",
    KeyE: "r1",
    KeyD: "r2",
  };
  document
    .querySelectorAll<HTMLElement>("[data-thruster]")
    .forEach((el) =>
      el.classList.toggle("on", !!currentInput[m[el.dataset.thruster!]]),
    );
  mapDraw($("minimap"), track, car, bots);
}
function update(dt: number) {
  currentInput = input();
  if (state === "finished" && trainingSession?.status) {
    if (++resultFrames >= 120) $("result").hidden = false;
    return;
  }
  if (state === "menu") {
    demoDistance += dt * 48;
    return;
  }
  if (state === "countdown") {
    if (trainingSession?.task.rolling) {
      for (const racer of [car, ...bots]) {
        const inp = T.drive(racer, track);
        E.step(racer, track, inp, dt);
        racer.damage = 0;
        racer.energy = 100;
        racer.finished = false;
        racer.reason = null;
        racer.events.length = 0;
      }
      currentInput = car.active || {};
    }
    const before = Math.ceil(countdown);
    countdown -= dt;
    if (Math.ceil(countdown) !== before && countdown > 0 && countdown < 3.01)
      beep();
    $("message").textContent = "";
    if (countdown <= 0) {
      state = "running";
      if (trainingSession) {
        for (const racer of [car, ...bots]) {
          racer.ticks = 0;
          racer.time = 0;
          racer.lapStart = 0;
          racer.events.length = 0;
        }
        trainingSession.heading = car.heading;
      } else originalSound.playCourse(+$("course").value);
    }
    return;
  }
  if (state === "destroyed") {
    E.stepDebris(car);
    car.explosionFrames = (car.explosionFrames ?? 0) + 1;
    if (car.explosionFrames >= 300) finish();
    return;
  }
  if (state !== "running") return;
  car.repairFrames = Math.max(0, (car.repairFrames || 0) - 1);
  car.lapDraw = Math.max(0, (car.lapDraw || 0) - 1);
  car.fireTail =
    currentInput.accel || car.turbo ? 64 : Math.max(0, (car.fireTail || 0) - 1);
  const previousProgress = car.progress;
  const laps = car.laps.length;
  E.step(car, track, currentInput, dt, mode === "free");
  if (car.progress < previousProgress)
    car.wrongFrames = (car.wrongFrames || 0) + 1;
  else if (car.progress > previousProgress) car.wrongFrames = 0;
  if (mode === "time" && car.time >= ghostClock) {
    recording.push([
      car.time,
      car.x,
      car.y,
      car.z,
      car.heading,
      car.pitch,
      car.roll,
    ]);
    ghostClock += 0.1;
  }
  if (car.laps.length > laps) {
    $("best").textContent = "BEST " + format(getBest());
    car.lapDraw = 180;
  }
  for (const bot of bots) {
    if (bot.finished && bot.reason !== "finish") {
      E.recover(bot, track);
      bot.damage = 0;
    }
    if (trainingSession && bot.stopped) continue;
    const inp = trainingSession
      ? T.drive(bot, track)
      : E.driveCPU(bot, track, car);
    E.step(bot, track, inp, dt, !trainingSession);
    if (trainingSession && bot.events.includes("stop")) bot.stopped = true;
    if (bot.laps.length >= 3) {
      bot.finished = true;
      bot.reason = "finish";
    }
    bot.events.length = 0;
  }
  E.collideAll([car, ...bots]);
  if (trainingSession) {
    const rank = 1 + bots.filter((b) => b.progress > car.progress).length;
    T.step(trainingSession, car, currentInput, rank, car.events);
    if (trainingSession.status) {
      finishTraining();
      car.events.length = 0;
      return;
    }
  }
  while (car.events.length) {
    const e = car.events.shift();
    if (e === "repair") {
      car.repairFrames = 32;
      originalSound.effect(69, 24, 90);
    }
    if (e === "wall-sound") originalSound.effect(67, 45);
    if (e === "collision") originalSound.effect(67, 70);
    if (e === "land") originalSound.effect(67, 80);
  }
  if (car.finished) {
    if (car.reason === "destroyed") {
      state = "destroyed";
      car.explosionFrames = 0;
      car.explosionPlayed = true;
      E.emitDebris(car, 64, 2, [0, 1, 0]);
      originalSound.effect(68, 30, 90);
    } else finish();
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $("message").textContent = "";
  }
}
function frame(ts: number) {
  const dt = Math.min((ts - last) / 1000 || 0, 0.1);
  last = ts;
  worldTime += dt;
  accumulator += dt;
  while (accumulator >= 1 / 60) {
    update(1 / 60);
    if (state !== "paused" && state !== "menu") view.updateCamera(car);
    accumulator -= 1 / 60;
  }
  render();
  if (state !== "menu") hud();
  originalSound.update(
    car,
    currentInput,
    state === "running" ||
      (state === "countdown" && !!trainingSession?.task.rolling),
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Read-only snapshots for diagnostics; no controls or simulation bypasses exposed.
window.hoverDiagnostics = () => ({
  state,
  mode,
  sourceMode: R.profile(mode).sourceMode,
  training: trainingSession
    ? {
        stage: trainingSession.task.id,
        remaining: trainingSession.remaining,
        status: trainingSession.status,
        reason: trainingSession.reason,
      }
    : null,
  opponentTypes: bots.map((b) => b.type),
  recordClass: R.profile(mode).recordClass,
  cpuLevels: bots.map((bot) => bot.cpuLevel ?? null),
  cameraFollow: { ...view.follow },
  course: track.name,
  energy: car.energy,
  speed: Math.hypot(car.vx, car.vz),
  progress: car.progress,
  lap: car.laps.length,
  time: car.time,
  ...view.diagnostics(),
  ...originalSound.diagnostics(),
  displaySpeed: car.sourceSpeed >> 1,
  repairFrames: car.repairFrames || 0,
  fireTail: car.fireTail || 0,
  reason: car.reason,
  height: car.y,
  ground: car.groundY,
  grip: car.grip,
  sourceSpeed: car.sourceSpeed,
  front: car.front.slice(),
  rear: car.rear.slice(),
  tiles: car.tile,
});
