// Source: src/game.ts. Build with npm run build; do not edit dist/game.js directly.
interface Elements {
  game: HTMLCanvasElement;
  "fullscreen-host": HTMLDivElement;
  "fullscreen-status": HTMLParagraphElement;
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
  minimap: HTMLCanvasElement;
  message: HTMLElement;
  menu: HTMLElement;
  mode: HTMLSelectElement;
  "mode-description": HTMLElement;
  "course-caption": HTMLElement;
  course: HTMLSelectElement;
  "preview-map": HTMLCanvasElement;
  "course-number": HTMLElement;
  "course-distance": HTMLElement;
  record: HTMLElement;
  machine: HTMLSelectElement;
  "machine-description": HTMLElement;
  stats: HTMLElement;
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
import { ReplayMemory } from "./replay-memory.js";
import { SaveStore } from "./save-data.js";
import { ReplayRecorder, InputReplay, GhostReplay } from "./input-replay.js";
import { OriginalPostrace, type GPRecord } from "./postrace.js";
const originalSound = new OriginalSound();
const E = HoverEngine,
  R = HoverRules,
  B = HoverRecords,
  canvas = $("game"),
  tracks = HOVER_TRACKS.map(E.prepare);
const session = new SaveStore({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
R.useStorage(session);
B.useStorage(session);

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
  padPause = false;
let finishRank = 1;
let demoFrames = 0;
// The title's CPU race never changes the player's selected course or machine.
let titleDemo: { track: Track; car: Car; bots: Car[]; music: string };
let titleDemoVisible = false;
function showingMenuDemo() {
  return state === "menu" && originalMenu.usesDemoBackdrop;
}
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
function getBest() {
  try {
    const key = recordKey();
    return key ? Number(session.getItem(key)) || Infinity : Infinity;
  } catch {
    return Infinity;
  }
}
function saveBest(t: number) {
  try {
    const key = recordKey();
    if (key && t < getBest()) session.setItem(key, String(t));
  } catch {}
}
function setCourseOptions() {
  $("course").replaceChildren();
  tracks.forEach((t, i) =>
    $("course").add(
      new Option(`${String(i + 1).padStart(2, "0")} / ${t.name}`, String(i)),
    ),
  );
}
function selectedTrack() {
  return tracks[+$("course").value];
}
setCourseOptions();
function refreshMachines() {
  const selected = $("machine").value || "0";
  $("machine").replaceChildren();
  E.MACHINES.slice(0, R.machineCount()).forEach((m, i) =>
    $("machine").add(
      new Option(`${m.name}${!m.rudder ? " / スラスター専用" : ""}`, String(i)),
    ),
  );
  $("machine").value = +selected < R.machineCount() ? selected : "0";
}
refreshMachines();
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
  g.closePath();
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
  if (rules.cup !== null && state === "menu")
    $("course").value = String(rules.cup * 3);
  track = selectedTrack();
  car = E.placeOnGrid(E.create(track, +$("machine").value), track);
  const m = E.MACHINES[car.type];
  $("machine-description").textContent = m.desc;
  $("course-number").textContent =
    String(+$("course").value + 1).padStart(2, "0") + " / 09";
  $("course-distance").textContent = "ORIGINAL CIRCUIT";
  $("record").textContent = "BEST " + format(getBest());
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
$("machine").onchange = select;
select();
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
  fullscreen() {
    return document.fullscreenEnabled
      ? document.fullscreenElement === $("fullscreen-host")
      : null;
  },
  toggleFullscreen() {
    toggleFullscreen();
  },
  soundEnabled() {
    return sound;
  },
  toggleSound() {
    sound = !sound;
    initAudio();
  },
  difficulty() {
    return Number(session.getItem("hover-cpu-difficulty")) - 1;
  },
  setDifficulty(level) {
    session.setItem("hover-cpu-difficulty", String(level + 1));
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
const postrace = new OriginalPostrace(originalMenu, session);
function resize() {
  view.resize();
  const rect = canvas.getBoundingClientRect();
  if (rect.height > 0) originalHUD.resize(rect.width / rect.height);
}
new ResizeObserver(resize).observe(canvas);
const gpRecords: GPRecord[] = [];
let fallFrames = 0,
  gpRound = 0,
  resultFrames = 0,
  gpCup = 0,
  replayClock = 0;
let inputRecording: ReplayRecorder | null = null;
let recordingLevel = -1;
const replayMemory = new ReplayMemory();
let ghostReplay: GhostReplay | null = null;
let postraceReplay: InputReplay | null = null;
function preparePostraceReplay() {
  if (
    postraceReplay ||
    !replayMemory.recent ||
    !postrace.phase ||
    postrace.batch.length > 0 ||
    state !== "finished"
  )
    return;
  postraceReplay = new InputReplay(
    replayMemory.recent,
    tracks[replayMemory.recent.course],
  );
  view.setTrack(postraceReplay.track);
  view.yaw = null;
  view.replayDirector.reset();
  replayClock = 0;
}
function rememberReplay() {
  if (!inputRecording?.frames || car.reason !== "finish") return;
  const tape = inputRecording.tape({
    machine: car.type,
    course: tracks.indexOf(track),
    gameMode: mode === "time" ? 4 : mode.startsWith("gp") ? 0 : 1,
    totalTicks: Math.round(car.time * 60),
    level: recordingLevel,
  });
  replayMemory.complete(tape);
}
function start(nextRound = false) {
  postraceReplay = null;
  if (state === "finished") rememberReplay();
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
  recordingLevel = Number(session.getItem("hover-cpu-difficulty")) - 1;
  bots = R.profile(mode).opponents
    ? R.opponents(car.type).map((type, i) => {
        const b = E.placeOnGrid(E.create(track, type), track, i + 1);
        b.cpuLevel = E.cpuLevels[recordingLevel + 1][+$("course").value];
        b.cpuSlot = i + 1;
        return b;
      })
    : [];
  inputRecording = new ReplayRecorder();
  replayClock = 0;
  const ghostTape = replayMemory.beginRace(
    tracks.indexOf(track),
    R.profile(mode).sourceMode,
  );
  ghostReplay = ghostTape ? new GhostReplay(ghostTape, track) : null;
  state = "countdown";
  finishRank = 1;
  countdown = 5;
  accumulator = 0;
  keys = {};
  view.yaw = null;
  $("menu").hidden = true;
  $("result").hidden = true;
  $("pause-panel").hidden = true;
  $("hud").hidden = false;
  $("touch").hidden = !matchMedia("(pointer:coarse)").matches;
  document.querySelector(".game-wrap")!.classList.add("playing");
  $("course-label").textContent = track.name.toUpperCase();
  $("best").textContent = "BEST " + format(getBest());
  if (sound) initAudio();
  canvas.focus();
  if (matchMedia("(max-width:600px)").matches)
    requestAnimationFrame(() =>
      document.querySelector(".game-wrap")!.scrollIntoView({ block: "start" }),
    );
}
function menu() {
  if (state === "finished") rememberReplay();
  beginDemo();
}
// GP1_MAIN.C main / GAME.C gamedemo: live CPU race, not a recording.
function beginDemo() {
  ghostReplay = null;
  postrace.close();
  state = "menu";
  demoFrames = 0;
  keys = {};
  originalSound.cancel();
  originalSound.pause(false);
  const demoTrack = tracks[Math.floor(Math.random() * tracks.length)];
  const demoCar = E.placeOnGrid(E.create(demoTrack, 3), demoTrack);
  const demoBots = R.opponents(3).map((type, i) =>
    E.placeOnGrid(E.create(demoTrack, type), demoTrack, i + 1),
  );
  [demoCar, ...demoBots].forEach((racer, i) => {
    racer.cpuSlot = i;
    racer.cpuLevel = 8;
  });
  const music = [
    "B",
    "SAMPLE16",
    "SAMPLE15",
    "HOVER4",
    "TO7",
    "ENTRY1",
    "SELECT",
    "SAMPLE19",
    "HOVER2",
    "CANION",
    "SAMPLE21",
  ];
  titleDemo = {
    track: demoTrack,
    car: demoCar,
    bots: demoBots,
    music: music[Math.floor(Math.random() * music.length)],
  };
  titleDemoVisible = false;
  postraceReplay = null;
  if (sound) initAudio();
  view.yaw = null;
  view.countdown = null;
  view.result = null;
  view.gpRecords = false;
  view.holdCamera = false;
  view.nameEntry = null;
  view.continuePrompt = null;
  for (const id of ["hud", "pause-panel", "result", "touch"] as const)
    $(id).hidden = true;
  document.getElementById("continue-panel")!.hidden = true;
  $("message").textContent = "";
  $("menu").hidden = false;
  originalMenu.show("title");
  document.querySelector(".game-wrap")!.classList.remove("playing");
  refreshMachines();
  select();
}
function updateDemo(dt: number) {
  const { track, car, bots } = titleDemo;
  if (!titleDemoVisible) {
    view.setTrack(track);
    view.yaw = null;
    view.replayDirector.reset();
    originalSound.playCourse(titleDemo.music);
    titleDemoVisible = true;
  }
  for (const racer of [car, ...bots]) {
    if (racer.finished) {
      E.recover(racer, track);
      racer.damage = 0;
      racer.finished = false;
      racer.reason = null;
    }
    E.step(racer, track, E.driveCPU(racer, track, car), dt, true, false);
    racer.events.length = 0;
  }
  E.collideAll([car, ...bots]);
  view.replayView = true;
  view.holdCamera = view.finishCamera = false;
  view.countdown = null;
  view.updateCamera(car);
  ++demoFrames;
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
  if (
    state === "running" ||
    state === "countdown" ||
    state === "destroyed" ||
    state === "falling"
  ) {
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
const fullscreenHost = $("fullscreen-host");
const fullscreenStatus = $("fullscreen-status");
let gameFullscreen = false;
function fullscreenError() {
  fullscreenStatus.textContent =
    "全画面に切り替えられませんでした。ブラウザの全画面表示の許可を確認してください。";
  fullscreenStatus.hidden = false;
}
function toggleFullscreen() {
  fullscreenStatus.hidden = true;
  const operation =
    document.fullscreenElement === fullscreenHost
      ? document.exitFullscreen()
      : fullscreenHost.requestFullscreen();
  void operation.then(syncFullscreen, fullscreenError);
}
function syncFullscreen() {
  const active = document.fullscreenElement === fullscreenHost;
  if (gameFullscreen && !active) {
    keys = {};
    if (
      state === "running" ||
      state === "countdown" ||
      state === "destroyed" ||
      state === "falling"
    )
      pause();
    fullscreenHost.focus({ preventScroll: true });
  } else if (!gameFullscreen && active) {
    keys = {};
    fullscreenHost.focus({ preventScroll: true });
  }
  gameFullscreen = active;
  if (state === "menu" && originalMenu.screen === "option") {
    originalMenu.show("option", originalMenu.selected);
    originalMenu.buttons
      .querySelector<HTMLButtonElement>(
        `[data-index="${originalMenu.selected}"]`,
      )
      ?.focus({ preventScroll: true });
  }
}
document.addEventListener("fullscreenchange", syncFullscreen);
$("start").onclick = () => start();
$("resume").onclick = pause;
$("restart").onclick = () => start(true);
$("back").onclick = menu;
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
function showGPRecords(completed = false) {
  if (!gpRecords.length) {
    menu();
    return;
  }
  originalSound.playCourse("ENTRY1");
  postrace.beginGP(gpRecords, () => (completed ? beginDemo() : menu()));
}
function returnToSelection() {
  const value = mode;
  menu();
  originalMenu.mode = value;
  originalMenu.show("car");
  originalSound.playCourse("SELECT");
}
document.getElementById("continue-toggle")!.onclick = () => turnContinue(1);
document.getElementById("continue-confirm")!.onclick = acceptContinue;
function finish() {
  // GAME.C only plays SND_BOMB during destruction (over > 64).
  // Completing the course-out wait (negative over) has no impact sound.
  state = "finished";
  resultFrames = 0;
  $("touch").hidden = true;
  $("result").hidden = true;
  $("message").textContent = "";
  const failed = car.reason !== "finish";
  if (!failed) rememberReplay();
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
  "KeyW",
  "KeyX",
  "Enter",
];
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && document.fullscreenElement === fullscreenHost) {
    e.preventDefault();
    void document.exitFullscreen().catch(fullscreenError);
    return;
  }
  if (/SELECT|INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) return;
  if (handled.includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (state === "menu") {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Enter",
        "Space",
        "KeyZ",
        "KeyP",
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
function initAudio() {
  originalSound.enable(sound).catch((error) => {
    sound = false;
    $("message").textContent = "サウンドを有効にできませんでした。";
    if (state === "menu" && originalMenu.screen === "option")
      originalMenu.show("option", originalMenu.selected);
    console.error(error);
  });
}
// Try autoplay at startup; browsers that require user activation can leave
// resume() pending. Retry within a trusted gesture without changing mute state.
function unlockAudio() {
  if (
    !sound ||
    state === "paused" ||
    originalSound.context?.state === "running"
  )
    return;
  initAudio();
}
document.addEventListener("pointerup", unlockAudio, true);
document.addEventListener("keydown", unlockAudio, true);
function beep() {
  originalSound.effect(64, 20);
}
let currentInput: Input = {};
function render() {
  if (showingMenuDemo()) {
    const { track, car, bots } = titleDemo;
    view.draw(track, car, bots, "demo", worldTime, car.active || {});
    originalMenu.draw();
    return;
  }
  titleDemoVisible = false;
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
  preparePostraceReplay();
  const display = postraceReplay?.car || car;
  const replayBots = postraceReplay?.bots || bots;
  const ghost = !postrace.phase ? ghostReplay?.car || null : null;
  view.nameEntry = postrace.entry;
  view.gpRecords = !!postrace.phase && postrace.batch.length > 0;
  view.continuePrompt = document.getElementById("continue-panel")!.hidden
    ? null
    : { choice: continueChoice, rotation: (continueRotation * Math.PI) / 16 };
  view.countdown =
    state === "countdown" ? Math.max(0, Math.ceil(countdown * 60)) : null;
  view.result =
    state === "finished" && car.reason === "finish" && resultFrames < 180
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
    postraceReplay?.track || track,
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
    getBest(),
    state,
    countdown,
    ghostReplay?.car || null,
  );
  const speed = car.sourceSpeed >> 1;
  $("speed").textContent = String(speed).padStart(3, "0");
  $("time").textContent = format(car.time);
  $("lap").textContent = `LAP ${Math.min(car.laps.length + 1, 3)} / 3`;
  $("energy").style.width = car.energy + "%";
  $("energy").style.background = car.energy < 25 ? "#ff7969" : "#b3ff65";
  $("energy-num").textContent = Math.ceil(car.energy) + "%";
  $("position").textContent = bots.length
    ? `POSITION ${1 + bots.filter((b) => b.progress > car.progress).length} / 4`
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
    E.step(
      bot,
      track,
      E.driveCPU(bot, track, car),
      dt,
      true,
      racing && !bot.finished,
    );
    if (bot.laps.length >= 3) {
      bot.finished = true;
      bot.reason = "finish";
    }
    bot.events.length = 0;
  }
}
function updateGoalDrive(dt: number) {
  if (car.reason === "finish") {
    car.cpuSlot = 0;
    car.cpuLevel = mode.startsWith("gp") && finishRank === 1 ? 10 : 0;
    car.repairFrames = Math.max(0, (car.repairFrames || 0) - 1);
    car.lapDraw = Math.max(0, (car.lapDraw || 0) - 1);
    E.step(car, track, E.driveCPU(car, track, car), dt, false, false);
    car.events.length = 0;
  }
  ghostReplay?.step(true);
  updateBots(dt, false);
  E.collideAll([car, ...bots]);
}
function update(dt: number) {
  currentInput = input();
  if (state === "finished") {
    if (postrace.phase) {
      preparePostraceReplay();
      if (postraceReplay && !postraceReplay.step()) {
        const tape = postraceReplay.tape;
        postraceReplay = null;
        if (postrace.phase === "credits") {
          postrace.close();
          postrace.afterCredits();
          return;
        }
        postraceReplay = new InputReplay(tape, tracks[tape.course]);
        view.yaw = null;
        view.replayDirector.reset();
      }
      if (postraceReplay) replayClock = postraceReplay.frame / 60;
      const credits = postrace.phase === "credits";
      postrace.tick();
      if (credits && postrace.phase !== "credits") postraceReplay = null;
      return;
    }
    if (car.reason === "finish") inputRecording?.record(currentInput);
    updateGoalDrive(dt);
    if (!document.getElementById("continue-panel")!.hidden) {
      if (continueRotation) {
        continueRotation -= Math.sign(continueRotation);
        if (Math.abs(continueRotation) === 8) continueChoice ^= 1;
      }
      return;
    }
    ++resultFrames;
    if (resultFrames === 180) rememberReplay();
    if (
      mode.startsWith("gp") &&
      car.reason === "finish" &&
      resultFrames === 180 &&
      finishRank === 1
    ) {
      if (gpRound < 2) {
        gpRound++;
        start(true);
      } else {
        R.completeCup(gpCup);
        $("hud").hidden = true;
        originalSound.playCourse("SAMPLE19", false);
        postrace.credits(() => showGPRecords(true));
      }
      return;
    }
    if (
      mode.startsWith("gp") &&
      car.reason === "finish" &&
      resultFrames === 180 &&
      finishRank !== 1
    ) {
      showContinue();
      return;
    }
    if (
      !mode.startsWith("gp") &&
      car.reason === "finish" &&
      resultFrames === 180
    ) {
      $("hud").hidden = true;
      originalSound.playCourse("ENTRY1");
      postrace.begin(
        R.profile(mode).recordClass,
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
    originalMenu.tick();
    if (showingMenuDemo()) updateDemo(dt);
    return;
  }
  if (state === "countdown") {
    const remaining = Math.max(0, Math.round(countdown * 60) - 1);
    countdown = remaining / 60;
    if (remaining > 0 && remaining <= 180 && remaining % 60 === 0) beep();
    $("message").textContent = "";
    if (countdown <= 0) {
      state = "running";
      originalSound.playCourse(+$("course").value);
    }
    return;
  }
  if (state === "falling") {
    ghostReplay?.step();
    updateBots(dt);
    E.stepFalling(car);
    if (++fallFrames >= 256) finish();
    return;
  }
  if (state === "destroyed") {
    ghostReplay?.step();
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
  inputRecording?.record(currentInput);
  E.step(car, track, currentInput, dt);
  ghostReplay?.step();
  if (car.progress < previousProgress)
    car.wrongFrames = (car.wrongFrames || 0) + 1;
  else if (car.progress > previousProgress) car.wrongFrames = 0;
  if (car.laps.length > laps) {
    $("best").textContent = "BEST " + format(getBest());
    car.lapDraw = 180;
  }
  updateBots(dt);
  E.collideAll([car, ...bots]);

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
      E.emitDebris(car, 64, 2, [0, 1, 0]);
      originalSound.effect(68, 30, 90);
    } else if (car.reason === "course-out") {
      state = "falling";
      fallFrames = 0;
      $("hud").hidden = true;
      $("touch").hidden = true;
    } else finish();
  }
}
function frame(ts: number) {
  const dt = Math.min((ts - last) / 1000 || 0, 0.1);
  last = ts;
  if (state !== "paused") worldTime += dt;
  if (postrace.phase && !postraceReplay) replayClock += dt;
  view.replayView =
    (!!postrace.phase && !postrace.batch.length) || showingMenuDemo();
  // GAME.C view_set(17): front chase except a winning GP.
  view.finishCamera =
    state === "finished" &&
    !postrace.phase &&
    car.reason === "finish" &&
    (!mode.startsWith("gp") || finishRank !== 1);
  accumulator += dt;
  while (accumulator >= 1 / 60) {
    update(1 / 60);
    if (state !== "paused" && state !== "menu" && state !== "falling")
      view.updateCamera(
        postraceReplay?.car || car,
        state === "countdown" ? Math.round(countdown * 60) : 0,
      );
    accumulator -= 1 / 60;
  }
  render();
  if (!$("hud").hidden && state !== "paused") hud();
  originalSound.update(
    car,
    currentInput,
    state === "running",
    state === "falling",
  );
  requestAnimationFrame(frame);
}
beginDemo();
requestAnimationFrame(frame);
// Read-only snapshots for diagnostics; no controls or simulation bypasses exposed.
export const getHoverDiagnostics = () => ({
  state,
  demoFrames,
  demo: {
    course: titleDemo.track.name,
    opponentTypes: titleDemo.bots.map((bot) => bot.type),
    cpuLevels: [titleDemo.car, ...titleDemo.bots].map(
      (racer) => racer.cpuLevel,
    ),
    positions: [titleDemo.car, ...titleDemo.bots].map((racer) => ({
      x: racer.x,
      z: racer.z,
    })),
  },
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
  replayPose: postrace.phase ? postraceReplay?.car || null : null,
  entryName: postrace.name.slice(),
  pauseSelection,
  continueChoice: document.getElementById("continue-panel")!.hidden
    ? null
    : continueChoice,
  menuScreen: originalMenu.screen,
  menuSelection: originalMenu.selected,
  saveError: session.saveError,
  cpuDifficulty: Number(session.getItem("hover-cpu-difficulty")) - 1,
  lastReplay: replayMemory.saved
    ? {
        course: replayMemory.saved.course,
        machine: replayMemory.saved.machine,
        frames: replayMemory.saved.frames,
        bytes: replayMemory.saved.words.length * 2,
        totalTicks: replayMemory.saved.totalTicks,
      }
    : null,
  sourceMode: mode === "time" && ghostReplay ? 5 : R.profile(mode).sourceMode,
  ghost: ghostReplay
    ? {
        machine: ghostReplay.car.type,
        frame: ghostReplay.reader.frame,
        ticks: ghostReplay.car.ticks,
        x: ghostReplay.car.x,
        y: ghostReplay.car.y,
        z: ghostReplay.car.z,
        heading: ghostReplay.car.heading,
        laps: ghostReplay.car.laps.length,
        finished: ghostReplay.car.finished,
        repairFrames: ghostReplay.car.repairFrames || 0,
        active: { ...ghostReplay.car.active },
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

window.hoverDiagnostics = getHoverDiagnostics;
