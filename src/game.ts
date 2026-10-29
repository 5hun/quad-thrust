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
import { OriginalMenu } from "./menu.js";
import { sampleReplay, captureReplay } from "./replay.js";
import { OriginalPostrace, type GPRecord } from "./postrace.js";
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
  keys: Record<string, boolean> = {},
  bots: Car[] = [],
  sound = true,
  padPause = false,
  toastTimer = 0;
let finishRank = 1;
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
  car = E.placeOnGrid(E.create(track, +$("machine").value), track);
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
const browserSettings = document.getElementById("browser-settings")!;
for (const id of ["difficulty", "quality", "ghost-enabled"]) {
  const element = $(id as "difficulty" | "quality" | "ghost-enabled");
  const label = document.querySelector(`label[for="${id}"]`);
  if (label) browserSettings.append(label);
  if (id === "ghost-enabled") browserSettings.append(element.parentElement!);
  else browserSettings.append(element);
}
browserSettings.append($("sound"));
const originalMenu = new OriginalMenu({
  mode(value) {
    $("mode").value = value;
    setCourseOptions();
    select();
  },
  change(kind, delta) {
    const field = $(kind);
    field.selectedIndex =
      (field.selectedIndex + delta + field.options.length) %
      field.options.length;
    field.dispatchEvent(new Event("change"));
  },
  start() {
    start();
  },
  sound(kind) {
    initAudio();
    originalSound.ready?.then(() =>
      originalSound.effect(
        kind === "ok" ? 72 : kind === "cancel" ? 74 : 73,
        kind === "ok" ? 50 : 40,
        kind === "ok" ? 80 : 127,
      ),
    );
  },
  music(name) {
    if (name) originalSound.playCourse(name);
    else originalSound.cancel();
  },
});
const postrace = new OriginalPostrace(originalMenu);
$("quality").onchange = () => {
  view.retro = $("quality").value === "retro";
  view.resize();
};
function resize() {
  view.resize();
}
new ResizeObserver(resize).observe(canvas);
const gpRecords: GPRecord[] = [];
let fallFrames = 0,
  gpRound = 0,
  resultFrames = 0,
  gpCup = 0,
  ghostFrames: number[][] = [],
  recording: number[][] = [],
  botRecordings: number[][][] = [],
  replayClock = 0,
  ghostClock = 0,
  ghostBestTime = Infinity;
function start(nextRound = false) {
  postrace.close();
  view.nameEntry = null;
  document.getElementById("continue-panel")!.hidden = true;
  view.continuePrompt = null;
  originalSound.cancel();
  originalSound.pause(false);
  mode = $("mode").value;
  if (mode.startsWith("gp")) {
    gpCup = +mode.slice(2);
    if (nextRound !== true) {
      gpRound = 0;
      gpRecords.length = 0;
    }
    $("course").value = String(gpCup * 3 + gpRound);
  }
  track = selectedTrack();
  car = E.placeOnGrid(E.create(track, +$("machine").value), track);
  bots = R.profile(mode).opponents
    ? R.opponents(car.type).map((type, i) => {
        const b = E.placeOnGrid(E.create(track, type), track, i + 1);
        b.cpuLevel = E.cpuLevels[+$("difficulty").value][+$("course").value];
        b.cpuSlot = i + 1;
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
  recording = [captureReplay(car, 0)];
  botRecordings = bots.map((b) => [captureReplay(b, 0)]);
  replayClock = 0;
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
          (f) =>
            Array.isArray(f) &&
            (f.length === 7 || f.length === 12) &&
            f.every(Number.isFinite),
        )
      ) {
        ghostFrames = frames;
        ghostBestTime = Number(g.time) || frames.at(-1)?.[0] || Infinity;
      }
    }
  } catch {}
  state = "countdown";
  finishRank = 1;
  countdown = 5;
  accumulator = 0;
  keys = {};
  view.yaw = null;
  toastTimer = 0;
  $("menu").hidden = true;
  document.getElementById("menu-controls")!.hidden = true;
  $("result").hidden = true;
  $("pause-panel").hidden = true;
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
  originalMenu.show("title");
  $("touch").hidden = true;
  $("message").textContent = "";
  document.querySelector(".game-wrap")!.classList.remove("playing");
  select();
}
let pauseSelection = 0;
const pauseCanvas = document.getElementById("pause-menu") as HTMLCanvasElement;
function drawPause() {
  const g = pauseCanvas.getContext("2d")!;
  g.clearRect(0, 0, 320, 240);
  const previous = originalMenu.g;
  originalMenu.g = g;
  ["CONTINUE", "RESTART ", "  EXIT  "].forEach((text, i) => {
    originalMenu.text(
      text,
      96 + (i % 2) * 8,
      64 + i * 32,
      16,
      i === pauseSelection ? "#00ff00" : "white",
    );
  });
  originalMenu.g = previous;
  [$("resume"), $("restart"), $("back")].forEach((button, i) =>
    button.setAttribute("aria-current", String(i === pauseSelection)),
  );
}
function movePause(delta: number) {
  pauseSelection = Math.max(0, Math.min(2, pauseSelection + delta));
  originalMenu.hooks.sound("move");
  drawPause();
}
function confirmPause() {
  originalMenu.hooks.sound("ok");
  [$("resume"), $("restart"), $("back")][pauseSelection].click();
}
function pause() {
  if (state === "running" || state === "countdown" || state === "destroyed") {
    stateBeforePause = state;
    state = "paused";
    originalSound.pause(true);
    keys = {};
    $("pause-panel").hidden = false;
    pauseSelection = 0;
    drawPause();
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
$("back").onclick = () => (trainingSession ? returnToSelection(true) : menu());
let continueChoice = 0,
  continueRotation = 0;
function showContinue() {
  continueChoice = 0;
  continueRotation = 0;
  $("hud").hidden = true;
  $("result").hidden = true;
  document.getElementById("continue-panel")!.hidden = false;
}
function turnContinue(direction: number) {
  if (continueRotation) return;
  continueRotation = direction * 16;
  originalMenu.hooks.sound("move");
}
function acceptContinue() {
  if (continueRotation) return;
  originalMenu.hooks.sound("ok");
  if (continueChoice === 0) start(true);
  else {
    document.getElementById("continue-panel")!.hidden = true;
    view.continuePrompt = null;
    originalMenu.padHeld.add("Enter");
    showGPRecords();
  }
}
function showGPRecords() {
  if (!gpRecords.length) {
    menu();
    return;
  }
  originalSound.playCourse("ENTRY1");
  postrace.beginGP(gpRecords, () => menu());
}
function returnToSelection(training = false) {
  const value = mode;
  menu();
  originalMenu.mode = value;
  originalMenu.show(training ? "training" : "car");
  originalSound.playCourse("SELECT");
}
document.getElementById("continue-toggle")!.onclick = () => turnContinue(1);
document.getElementById("continue-confirm")!.onclick = acceptContinue;
function finishTraining() {
  if (!trainingSession) return;
  state = "finished";
  $("touch").hidden = true;
  resultFrames = 0;
  $("result").hidden = true;
  $("message").textContent = "";
  const success = trainingSession.status === "complete";
  if (success) T.saveMark(trainingSession.task.id, car.type);
}
function finish() {
  if (trainingSession) {
    finishTraining();
    return;
  }

  if (car.reason !== "finish" && !car.explosionPlayed)
    originalSound.effect(68, 30, 90);
  state = "finished";
  resultFrames = 0;
  $("touch").hidden = true;
  $("result").hidden = true;
  $("message").textContent = "";
  const failed = car.reason !== "finish";
  finishRank = 1 + bots.filter((b) => b.progress > car.progress).length;
  if (!failed) {
    const best = Math.min(...car.laps);
    saveBest(best);
    if (mode.startsWith("gp")) {
      const course = +$("course").value;
      const old = gpRecords.find((r) => r.course === course);
      if (old) {
        old.best = Math.min(old.best, best);
        old.total = Math.min(old.total, car.time);
      } else
        gpRecords.push({ course, best, total: car.time, machine: car.type });
    }
  }
  const gp = mode.startsWith("gp");
  if (gp && failed) showContinue();
  if (!gp && failed) returnToSelection();
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
  if (state === "menu") {
    if (
      (e.target as HTMLElement).tagName === "BUTTON" &&
      ["Enter", "Space"].includes(e.code)
    )
      return;
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Enter",
        "Space",
        "KeyZ",
        "Escape",
        "Backspace",
        "KeyX",
      ].includes(e.code)
    ) {
      e.preventDefault();
      originalMenu.key(e.code);
    }
    return;
  }
  if (
    state === "finished" &&
    !document.getElementById("continue-panel")!.hidden
  ) {
    e.preventDefault();
    if (e.code === "ArrowLeft") turnContinue(1);
    if (e.code === "ArrowRight") turnContinue(-1);
    if (e.code === "Enter" || e.code === "KeyZ" || e.code === "Space")
      acceptContinue();
    return;
  }
  if (state === "finished" && postrace.phase) {
    e.preventDefault();
    postrace.key(e.code);
    return;
  }
  if (state === "paused") {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "Enter",
        "KeyZ",
        "Escape",
        "KeyX",
        "KeyP",
      ].includes(e.code)
    )
      e.preventDefault();
    if (e.code === "ArrowUp") movePause(-1);
    if (e.code === "ArrowDown") movePause(1);
    if (e.code === "Enter" || e.code === "KeyZ") confirmPause();
    if (["Escape", "KeyX", "KeyP"].includes(e.code)) pause();
    return;
  }
  if (e.code === "Escape" || e.code === "KeyP") {
    pause();
    return;
  }
  if (e.code === "Enter") {
    if (state === "menu") start();
    else if (state === "finished" && !$("result").hidden) start(true);
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
let pausePadHeld = new Set<string>();
function input() {
  const p = Array.from(navigator.getGamepads?.() || []).find(Boolean),
    b = (i: number) => p?.buttons[i]?.pressed || false,
    axis = p && Math.abs(p.axes[0]) > 0.15 ? p.axes[0] : 0;
  if (state === "menu") originalMenu.gamepad();
  if (state !== "menu" && b(9) && !padPause) pause();
  padPause = b(9);
  const pauseButtons = new Set<string>();
  if (state === "paused") {
    if (b(12) || (p?.axes[1] ?? 0) < -0.5) pauseButtons.add("up");
    if (b(13) || (p?.axes[1] ?? 0) > 0.5) pauseButtons.add("down");
    if (b(0)) pauseButtons.add("ok");
    if (b(1)) pauseButtons.add("cancel");
    for (const action of pauseButtons)
      if (!pausePadHeld.has(action)) {
        if (action === "up") movePause(-1);
        if (action === "down") movePause(1);
        if (action === "ok") confirmPause();
        if (action === "cancel") pause();
      }
  }
  if (
    state === "finished" &&
    !document.getElementById("continue-panel")!.hidden
  ) {
    if (b(14) || axis < -0.5) pauseButtons.add("left");
    if (b(15) || axis > 0.5) pauseButtons.add("right");
    if (b(0)) pauseButtons.add("confirm");
    for (const action of pauseButtons)
      if (!pausePadHeld.has(action)) {
        if (action === "left") turnContinue(1);
        if (action === "right") turnContinue(-1);
        if (action === "confirm") acceptContinue();
      }
  }
  pausePadHeld = pauseButtons;
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
  if (state === "menu") {
    view.drawMenu(
      originalMenu.screen,
      track,
      car.type,
      worldTime,
      (performance.now() - originalMenu.entered) / 1000,
    );
    originalMenu.draw();
    return;
  }
  const display = postrace.phase
    ? sampleReplay(recording, replayClock, car.type) || car
    : car;
  const replayBots = postrace.phase
    ? bots.map((bot, i) => ({
        ...bot,
        ...(sampleReplay(botRecordings[i] || [], replayClock, bot.type) || bot),
      }))
    : bots;
  let ghost = null;
  if (
    mode === "time" &&
    state !== "menu" &&
    ghostFrames.length &&
    $("ghost-enabled").checked
  ) {
    if (car.time < ghostFrames[ghostFrames.length - 1][0])
      ghost = sampleReplay(ghostFrames, car.time, car.type);
  }
  view.nameEntry = postrace.entry;
  view.continuePrompt = document.getElementById("continue-panel")!.hidden
    ? null
    : { choice: continueChoice, rotation: (continueRotation * Math.PI) / 16 };
  view.countdown =
    state === "countdown" ? Math.max(0, Math.ceil(countdown * 60)) : null;
  view.result =
    state === "finished" && trainingSession?.status && resultFrames < 120
      ? {
          text: trainingSession.status === "complete" ? "COMPLETE" : "MISS",
          frame: resultFrames,
        }
      : state === "finished" &&
          !trainingSession &&
          car.reason === "finish" &&
          resultFrames < 180
        ? {
            text: mode.startsWith("gp")
              ? (["1ST", "2ND", "3RD", "4TH"] as const)[finishRank - 1]
              : "FINISH",
            frame: resultFrames,
          }
        : null;
  view.holdCamera =
    state === "falling" ||
    (state === "finished" && car.reason === "course-out");
  view.draw(
    track,
    display,
    state === "menu" ? [] : replayBots,
    state,
    worldTime,
    display.active || {},
    ghost,
  );
  if (postrace.phase) postrace.draw();
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
// The original keeps every car moving during goal text and failure waits.
function updateBots(dt: number, racing = true) {
  for (const bot of bots) {
    if (bot.finished && bot.reason !== "finish") {
      E.recover(bot, track);
      bot.damage = 0;
    }
    const inp = trainingSession
      ? bot.stopped
        ? {}
        : T.drive(bot, track)
      : E.driveCPU(bot, track, car);
    E.step(bot, track, inp, dt, !trainingSession, racing && !bot.finished);
    if (trainingSession && bot.events.includes("stop")) bot.stopped = true;
    if (bot.laps.length >= 3) {
      bot.finished = true;
      bot.reason = "finish";
    }
    bot.events.length = 0;
  }
}
function updateGoalDrive(dt: number) {
  if (car.reason === "finish" || (trainingSession && !car.finished)) {
    car.cpuSlot = 0;
    car.cpuLevel =
      trainingSession?.status === "complete" ||
      (!trainingSession && mode.startsWith("gp") && finishRank === 1)
        ? 10
        : 0;
    car.repairFrames = Math.max(0, (car.repairFrames || 0) - 1);
    car.lapDraw = Math.max(0, (car.lapDraw || 0) - 1);
    E.step(car, track, E.driveCPU(car, track, car), dt, false, false);
    car.events.length = 0;
  }
  updateBots(dt, false);
  E.collideAll([car, ...bots]);
}
function update(dt: number) {
  currentInput = input();
  if (state === "finished") {
    if (postrace.phase) {
      postrace.tick();
      return;
    }
    updateGoalDrive(dt);
    if (!document.getElementById("continue-panel")!.hidden) {
      if (continueRotation) {
        continueRotation -= Math.sign(continueRotation);
        if (Math.abs(continueRotation) === 8) continueChoice ^= 1;
      }
      return;
    }
    ++resultFrames;
    if (trainingSession && resultFrames === 120) {
      if (trainingSession.status === "complete") returnToSelection(true);
      else start(true);
      return;
    }
    if (
      !trainingSession &&
      mode.startsWith("gp") &&
      car.reason === "finish" &&
      resultFrames === 180 &&
      finishRank === 1
    ) {
      if (gpRound < 2) {
        gpRound++;
        start(true);
      } else {
        $("hud").hidden = true;
        originalSound.playCourse("SAMPLE19");
        postrace.credits(() => showGPRecords());
      }
      return;
    }
    if (
      !trainingSession &&
      mode.startsWith("gp") &&
      car.reason === "finish" &&
      resultFrames === 180 &&
      finishRank !== 1
    ) {
      showContinue();
      return;
    }
    if (
      !trainingSession &&
      !mode.startsWith("gp") &&
      !!R.profile(mode).recordClass &&
      car.reason === "finish" &&
      resultFrames === 180
    ) {
      $("hud").hidden = true;
      originalSound.playCourse("ENTRY1");
      postrace.begin(
        R.profile(mode).recordClass || "time",
        +$("course").value,
        car.type,
        car.laps,
        () => {
          originalMenu.padHeld.add("Enter");
          menu();
          originalMenu.mode = mode;
          originalMenu.show("car");
          originalSound.playCourse("SELECT");
        },
      );
      return;
    }

    return;
  }
  if (state === "menu") {
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
    const remaining = Math.max(0, Math.round(countdown * 60) - 1);
    countdown = remaining / 60;
    if (remaining > 0 && remaining <= 180 && remaining % 60 === 0) beep();
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
  if (state === "falling") {
    updateBots(dt);
    const m = E.MACHINES[car.type];
    const gravity = (m.weight * 3) >> 4;
    for (const vector of [car.front, car.rear]) vector[1] += gravity;
    E.sync(car);
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.z += car.vz * dt;
    if (++fallFrames >= 256) finish();
    return;
  }
  if (state === "destroyed") {
    updateBots(dt);
    E.stepDebris(car);
    car.explosionFrames = (car.explosionFrames ?? 0) + 1;
    // GAME.C retriggers the burst every eight frames while over > 64,
    // releasing it on phase seven. The last 64 frames remain silent.
    if (car.explosionFrames < 236 && car.explosionFrames % 8 === 0)
      originalSound.effect(68, 30, 90);
    if (car.explosionFrames % 8 === 7)
      originalSound.continuous(68, 30, 90, false);
    if (car.explosionFrames >= 300) finish();
    return;
  }
  if (state !== "running") return;
  car.repairFrames = Math.max(0, (car.repairFrames || 0) - 1);
  car.lapDraw = Math.max(0, (car.lapDraw || 0) - 1);
  const previousProgress = car.progress;
  const laps = car.laps.length;
  E.step(car, track, currentInput, dt, mode === "free");
  if (car.progress < previousProgress)
    car.wrongFrames = (car.wrongFrames || 0) + 1;
  else if (car.progress > previousProgress) car.wrongFrames = 0;
  if (car.laps.length > laps) {
    $("best").textContent = "BEST " + format(getBest());
    car.lapDraw = 180;
  }
  updateBots(dt);
  E.collideAll([car, ...bots]);
  if (!trainingSession && car.time >= ghostClock) {
    recording.push(captureReplay(car));
    bots.forEach((bot, i) =>
      botRecordings[i].push(captureReplay(bot, car.time)),
    );
    ghostClock += 0.1;
  }

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
    } else if (car.reason === "course-out") {
      state = "falling";
      fallFrames = 0;
      $("hud").hidden = true;
      $("touch").hidden = true;
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
  if (state !== "paused") worldTime += dt;
  if (postrace.phase) replayClock += dt;
  view.replayView = !!postrace.phase;
  // GAME.C view_set(17): front chase except a winning GP; TRAINIG.C
  // uses it only for MISS. Keep the live camera through CONTINUE?.
  view.finishCamera =
    state === "finished" &&
    !postrace.phase &&
    (trainingSession
      ? trainingSession.status === "miss"
      : car.reason === "finish" &&
        (!mode.startsWith("gp") || finishRank !== 1));
  accumulator += dt;
  while (accumulator >= 1 / 60) {
    update(1 / 60);
    if (state !== "paused" && state !== "menu" && state !== "falling")
      view.updateCamera(
        postrace.phase
          ? sampleReplay(recording, replayClock, car.type) || car
          : car,
        state === "countdown" ? Math.round(countdown * 60) : 0,
      );
    accumulator -= 1 / 60;
  }
  render();
  if (!$("hud").hidden && state !== "paused") hud();
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
  gpRound,
  finishRank,
  finishCamera: view.finishCamera,
  opponents: bots.map((b) => ({
    x: b.x,
    y: b.y,
    z: b.z,
    ticks: b.ticks,
    progress: b.progress,
  })),
  gpRecordCourses: gpRecords.map((r) => r.course),
  postrace: postrace.phase,
  replayClock,
  replayPose: postrace.phase
    ? sampleReplay(recording, replayClock, car.type)
    : null,
  entryName: postrace.name.slice(),
  pauseSelection,
  continueChoice: document.getElementById("continue-panel")!.hidden
    ? null
    : continueChoice,
  menuScreen: originalMenu.screen,
  menuSelection: originalMenu.selected,
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
  ticks: car.ticks,
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
