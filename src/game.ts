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
import { ReplayMemory } from "./replay-memory.js";
import { CardMenu } from "./card-menu.js";
import {
  MemoryCards,
  SessionStore,
  defaultSystem,
  decodeReplayPack,
  encodeCard,
  decodeCard,
  type SystemSave,
} from "./card-data.js";
import { ReplayRecorder, InputReplay, GhostReplay } from "./input-replay.js";
import {
  OriginalPostrace,
  ENTRY_CHARACTERS,
  type GPRecord,
} from "./postrace.js";
const originalSound = new OriginalSound();
const E = HoverEngine,
  R = HoverRules,
  T = HoverTraining,
  B = HoverRecords,
  canvas = $("game"),
  tracks = HOVER_TRACKS.map(E.prepare);
const trainingTracks = HOVER_TRAINING_TRACKS.map(E.prepare);
const session = new SessionStore();
session.apply(defaultSystem());
const persistent = {
  getItem(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    localStorage.setItem(key, value);
  },
};
const [cardTemplate, specialReplayPack] = await Promise.all(
  ["assets/card-template.bin", "assets/special-replays.bin"].map(
    async (path) => new Uint8Array(await (await fetch(path)).arrayBuffer()),
  ),
);
const memoryCards = new MemoryCards(persistent, Array.from(cardTemplate));
let autoSaveSlot: number | null = null;
let savePending = false;
let autoSaveFrames = 0,
  autoSaveError = "";
try {
  memoryCards.migrateLegacy();
  for (const slot of [0, 1]) {
    const card = memoryCards.read(slot);
    if (card && card.system.auto & 1) {
      session.apply(card.system);
      autoSaveSlot = card.system.auto & 2 ? slot : null;
      break;
    }
  }
} catch {}
R.useStorage(session);
T.useStorage(session);
B.useStorage(session);

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
let demoFrames = 0,
  menuIdleFrames = 0;
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
  const saved = session.getItem("hover-cpu-difficulty");
  if (saved !== null && /^[0-3]$/.test(saved)) $("difficulty").value = saved;
} catch {}
$("difficulty").onchange = () => {
  try {
    session.setItem("hover-cpu-difficulty", $("difficulty").value);
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
  replay() {
    playReplay("view");
  },
  ending() {
    playReplay("ending");
  },
  exit() {
    quit();
  },
  card(slot) {
    cardMenu.open(slot);
  },
  save() {
    autoSave();
  },
  trainingDone() {
    R.completeTraining();
    refreshMachines();
    autoSave();
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
function captureSystem() {
  const data = session.snapshot();
  data.unlocks = R.unlocks();
  data.userName = postrace.name.map((i) => ENTRY_CHARACTERS[i]).join("");
  return data;
}
function settingsChanged(slot: number) {
  const data = session.snapshot();
  $("difficulty").value = String(data.level + 1);
  autoSaveSlot = data.auto & 2 ? slot : null;
}
function applySystem(data: SystemSave, slot: number) {
  session.apply(data);
  R.useStorage(session);
  postrace.name = [...data.userName].map((ch) =>
    Math.max(0, ENTRY_CHARACTERS.indexOf(ch)),
  );
  settingsChanged(slot);
  const course = $("course").value;
  refreshMachines();
  setCourseOptions();
  if ([...$("course").options].some((option) => option.value === course))
    $("course").value = course;
  select();
}
function autoSave() {
  if (!savePending) return;
  savePending = false;
  if (autoSaveSlot === null) return;
  try {
    memoryCards.saveSystem(autoSaveSlot, captureSystem());
    autoSaveFrames = 2;
    autoSaveError = "";
  } catch {
    autoSaveSlot = null;
    session.setItem(
      "hover-auto-load-save",
      String(session.snapshot().auto & ~2),
    );
    autoSaveFrames = 120;
    autoSaveError = "カードに保存できません";
  }
}
const cardMenu = new CardMenu(originalMenu, memoryCards, session, {
  capture: captureSystem,
  apply: applySystem,
  replay: () => replayMemory.saved,
  loadReplay(tape) {
    const loaded = structuredClone(tape);
    replayMemory.saved = loaded;
    replayMemory.recent = loaded;
    replayMemory.raceGhost = null;
    ghostReplay = null;
  },
  settings: settingsChanged,
});
cardMenu.special = decodeReplayPack(specialReplayPack);
originalMenu.card = cardMenu;
// Native game-data file exchange is a browser control; card loading in-game
// still happens through LOAD SYSTEM DATA / LOAD REPLAY DATA.
for (const slot of [0, 1]) {
  const exportButton = document.createElement("button");
  exportButton.textContent = `SLOT ${slot + 1} ゲームデータを書き出す`;
  exportButton.title = "PS1形式ではスティックの中間値を方向入力に変換します";
  exportButton.onclick = () => {
    try {
      const card = memoryCards.read(slot);
      if (!card) {
        cardStatus.textContent = "データがありません";
        return;
      }
      const blob = new Blob([encodeCard(card).buffer as ArrayBuffer], {
        type: "application/octet-stream",
      });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `BNYedg01299HoverVer1-slot${slot + 1}.bin`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      cardStatus.textContent = "読み込めません";
    }
  };
  const importLabel = document.createElement("label"),
    input = document.createElement("input");
  importLabel.textContent = `SLOT ${slot + 1} ゲームデータを取り込む`;
  input.type = "file";
  input.accept = ".bin";
  input.onchange = async () => {
    try {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size !== 8192)
        throw Error("8KBのゲームデータファイルを選んでください");
      memoryCards.write(
        slot,
        decodeCard(new Uint8Array(await file.arrayBuffer())),
      );
      cardStatus.textContent =
        "取り込みました。カードメニューから読み込めます。";
    } catch (error) {
      cardStatus.textContent =
        error instanceof Error ? error.message : "読み込めません";
    }
    input.value = "";
  };
  importLabel.append(input);
  browserSettings.append(exportButton, importLabel);
}
const cardStatus = document.createElement("p");
cardStatus.setAttribute("role", "status");
browserSettings.append(cardStatus);
$("quality").onchange = () => {
  view.retro = $("quality").value === "retro";
  view.resize();
};
function resize() {
  view.resize();
  if (state === "exited") view.drawBlank();
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
let replayRun: InputReplay | null = null;
let replayKind: "view" | "ending" | null = null;
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
  if (!inputRecording?.frames || car.reason !== "finish" || trainingSession)
    return;
  const tape = inputRecording.tape({
    machine: car.type,
    course: tracks.indexOf(track),
    gameMode: mode === "time" ? 4 : mode.startsWith("gp") ? 0 : 1,
    totalTicks: Math.round(car.time * 60),
    level: recordingLevel,
  });
  replayMemory.complete(tape);
}
function playReplay(kind: "view" | "ending") {
  if (!replayMemory.saved) {
    originalMenu.message(
      "リプレイデータがありません",
      kind === "view" ? "option" : "slots",
    );
    return;
  }
  postrace.close();
  originalSound.cancel();
  originalSound.pause(false);
  originalSound.playCourse(
    kind === "view" ? "ENTRY1" : "SAMPLE19",
    kind === "view",
  );
  ghostReplay = null;
  replayKind = kind;
  replayRun = new InputReplay(
    replayMemory.saved,
    tracks[replayMemory.saved.course],
  );
  track = replayRun.track;
  car = replayRun.car;
  bots = replayRun.bots;
  state = "replay";
  trainingSession = null;
  keys = {};
  view.yaw = null;
  view.replayDirector.reset();
  view.countdown = null;
  view.result = null;
  view.nameEntry = null;
  view.continuePrompt = null;
  view.holdCamera = false;
  for (const id of ["hud", "pause-panel", "result", "touch"] as const)
    $(id).hidden = true;
  document.getElementById("continue-panel")!.hidden = true;
  document.getElementById("menu-controls")!.hidden = true;
  $("menu").hidden = false;
  $("menu").dataset.screen = kind === "view" ? "replay" : "ending";
  $("menu").setAttribute(
    "aria-label",
    kind === "view" ? "VIEW REPLAY" : "ENDING",
  );
  originalMenu.buttons.replaceChildren();
  originalMenu.button("再生を終了", 240, 208, 80, 32, exitReplay);
  document.querySelector(".game-wrap")!.classList.add("playing");
  if (kind === "ending") postrace.credits(exitReplay);
}
function exitReplay() {
  if (state !== "replay") return;
  const screen = replayKind === "ending" ? "slots" : "option";
  replayRun = null;
  replayKind = null;
  postrace.close();
  menu();
  originalMenu.show(screen, 2);
  originalMenu.padHeld.add("Enter");
  originalMenu.padHeld.add("Escape");
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
  savePending = true;
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
  recordingLevel = +$("difficulty").value - 1;
  inputRecording = R.profile(mode).recordClass ? new ReplayRecorder() : null;
  replayClock = 0;
  const ghostTape = replayMemory.beginRace(
    tracks.indexOf(track),
    car.type,
    R.profile(mode).sourceMode,
    $("ghost-enabled").checked,
  );
  ghostReplay = ghostTape ? new GhostReplay(ghostTape, track) : null;
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
// GP1_MAIN.C main: EXIT stops the game and clears the display. Browsers
// cannot close a page they did not open; reloading relaunches the game.
function quit() {
  originalSound.cancel();
  originalSound.pause(true);
  postrace.close();
  state = "exited";
  (document.querySelector(".browser-options") as HTMLElement).hidden = true;
  keys = {};
  ghostReplay = null;
  replayRun = null;
  replayKind = null;
  postraceReplay = null;
  for (const id of ["hud", "pause-panel", "result", "touch"] as const)
    $(id).hidden = true;
  document.getElementById("continue-panel")!.hidden = true;
  document.getElementById("menu-controls")!.hidden = true;
  $("message").textContent = "";
  $("menu").hidden = false;
  $("menu").dataset.screen = "exited";
  $("menu").setAttribute("aria-label", "EXIT");
  originalMenu.buttons.replaceChildren();
  originalMenu.g.clearRect(0, 0, 320, 240);
  view.drawBlank();
}
function menu(save = true) {
  if (save && !trainingSession && !["menu", "demo", "replay"].includes(state))
    autoSave();
  ghostReplay = null;
  postraceReplay = null;
  if (state === "finished") rememberReplay();
  trainingSession = null;
  originalSound.cancel();
  originalSound.pause(false);
  state = "menu";
  menuIdleFrames = 0;
  keys = {};
  $("hud").hidden = true;
  $("pause-panel").hidden = true;
  $("result").hidden = true;
  $("menu").hidden = false;
  originalMenu.show("title");
  $("touch").hidden = true;
  $("message").textContent = "";
  document.querySelector(".game-wrap")!.classList.remove("playing");
  refreshMachines();
  select();
}
// GP1_MAIN.C main / GAME.C gamedemo: live CPU race, not a recording.
function beginDemo() {
  if (state === "finished") autoSave();
  ghostReplay = null;
  postrace.close();
  trainingSession = null;
  state = "demo";
  demoFrames = 0;
  menuIdleFrames = 0;
  keys = {};
  originalSound.cancel();
  originalSound.pause(false);
  track = tracks[Math.floor(Math.random() * tracks.length)];
  car = E.placeOnGrid(E.create(track, 3), track);
  bots = R.opponents(3).map((type, i) =>
    E.placeOnGrid(E.create(track, type), track, i + 1),
  );
  [car, ...bots].forEach((racer, i) => {
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
  originalSound.playCourse(music[Math.floor(Math.random() * music.length)]);
  view.yaw = null;
  view.countdown = null;
  view.result = null;
  view.holdCamera = false;
  view.nameEntry = null;
  view.continuePrompt = null;
  for (const id of ["hud", "pause-panel", "result", "touch"] as const)
    $(id).hidden = true;
  document.getElementById("continue-panel")!.hidden = true;
  $("message").textContent = "";
  $("menu").hidden = false;
  originalMenu.buttons.replaceChildren();
  $("menu").dataset.screen = "demo";
  $("menu").setAttribute("aria-label", "PRESS ANY BUTTON");
  originalMenu.button("PRESS ANY BUTTON", 0, 0, 320, 240, endDemo);
  document.getElementById("menu-controls")!.hidden = true;
  document.querySelector(".game-wrap")!.classList.add("playing");
}
function endDemo() {
  if (state !== "demo") return;
  menu();
  originalMenu.beginIntro();
}
function updateDemo(dt: number) {
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
function showGPRecords(completed = false) {
  if (!gpRecords.length) {
    menu();
    return;
  }
  originalSound.playCourse("ENTRY1");
  postrace.beginGP(gpRecords, () => (completed ? beginDemo() : menu()));
}
function returnToSelection(training = false) {
  const value = mode;
  menu(false);
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
  "KeyR",
  "KeyW",
  "KeyX",
  "Enter",
];
window.addEventListener("keydown", (e) => {
  if (state === "exited" || autoSaveFrames > 0) return;
  if (/SELECT|INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) return;
  if (handled.includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  menuIdleFrames = 0;
  if (state === "demo") {
    e.preventDefault();
    endDemo();
    return;
  }
  if (state === "replay") {
    e.preventDefault();
    if (
      ["Enter", "KeyP"].includes(e.code) ||
      (replayKind === "view" &&
        ["Escape", "KeyX", "Backspace"].includes(e.code))
    )
      exitReplay();
    return;
  }
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
  if (state === "demo" && p?.buttons.some((button) => button.pressed)) {
    endDemo();
    // Consume the button until release; it must not also select START.
    originalMenu.gamepad(false);
  } else if (state === "menu") originalMenu.gamepad();
  if (
    p?.buttons.some((button) => button.pressed) ||
    Object.values(keys).some(Boolean)
  )
    menuIdleFrames = 0;
  if (
    state === "replay" &&
    ((b(9) && !padPause) || (replayKind === "view" && b(1)))
  )
    exitReplay();
  else if (state !== "menu" && b(9) && !padPause) pause();
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
  if (autoSaveFrames > 0) {
    view.drawBlank();
    originalMenu.g.clearRect(0, 0, 320, 240);
    if (autoSaveError) {
      if (((120 - autoSaveFrames) & 15) > 4)
        originalMenu.help.glyphs.draw(
          originalMenu.g,
          autoSaveError,
          160 - autoSaveError.length * 8,
          112,
        );
    } else originalMenu.text("AUTO SAVE", 160, 216);
    return;
  }
  if (state === "replay" && replayRun) {
    view.draw(track, car, bots, state, worldTime, car.active || {});
    originalMenu.g.clearRect(0, 0, 320, 240);
    if (replayKind === "ending") postrace.draw();
    else if ((replayRun.frame & 63) >= 32) {
      const image = originalHUD.images["hud-487"];
      if (image.complete && image.naturalWidth)
        originalMenu.g.drawImage(image, 32, 240, 64, 16, 240, 208, 64, 16);
    }
    return;
  }
  if (state === "demo") {
    view.draw(track, car, bots, state, worldTime, car.active || {});
    originalMenu.g.clearRect(0, 0, 320, 240);
    if ((demoFrames & 63) > 31)
      originalMenu.text("PRESS ANY BUTTON", 32, 112, 16);
    return;
  }
  if (state === "menu") {
    if (originalMenu.screen === "help") view.drawHelp(originalMenu.help);
    else
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
  const ghost =
    !postrace.phase && $("ghost-enabled").checked
      ? ghostReplay?.car || null
      : null;
  view.nameEntry = postrace.entry;
  view.gpRecords = !!postrace.phase && postrace.batch.length > 0;
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
    mode,
    getBest(),
    state,
    countdown,
    trainingSession,
    $("ghost-enabled").checked ? ghostReplay?.car || null : null,
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
  ghostReplay?.step(true);
  updateBots(dt, false);
  E.collideAll([car, ...bots]);
}
function update(dt: number) {
  if (autoSaveFrames > 0) {
    --autoSaveFrames;
    return;
  }
  currentInput = input();
  if (state === "replay" && replayRun) {
    if (!replayRun.step()) {
      if (replayKind === "ending") {
        exitReplay();
        return;
      }
      replayRun = new InputReplay(replayRun.tape, replayRun.track);
      view.yaw = null;
      view.replayDirector.reset();
    }
    track = replayRun.track;
    car = replayRun.car;
    bots = replayRun.bots;
    if (replayKind === "ending") postrace.tick(false);
    return;
  }
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
        R.completeCup(gpCup);
        $("hud").hidden = true;
        originalSound.playCourse("SAMPLE19", false);
        postrace.credits(() => showGPRecords(true));
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
          menu(false);
          originalMenu.mode = mode;
          originalMenu.show("car");
          originalSound.playCourse("SELECT");
        },
      );
      return;
    }

    return;
  }
  if (state === "demo") {
    updateDemo(dt);
    return;
  }
  if (state === "menu") {
    originalMenu.tick(keys);
    if (
      [
        "title",
        "modes",
        "option",
        "gp",
        "levels",
        "slots",
        "record-kind",
      ].includes(originalMenu.screen) &&
      ++menuIdleFrames > 30 * 60
    )
      beginDemo();
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
    ghostReplay?.step();
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
  E.step(car, track, currentInput, dt, mode === "free");
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
  if (state === "exited") return;
  const dt = Math.min((ts - last) / 1000 || 0, 0.1);
  last = ts;
  if (state !== "paused") worldTime += dt;
  if (postrace.phase && !postraceReplay && state !== "replay")
    replayClock += dt;
  view.replayView =
    (!!postrace.phase && !postrace.batch.length) ||
    state === "demo" ||
    state === "replay";
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
    state === "running" ||
      (state === "countdown" && !!trainingSession?.task.rolling),
  );
  requestAnimationFrame(frame);
}
// Pointer interactions count as activity in title submenus too.
$("menu").addEventListener("pointerdown", () => {
  menuIdleFrames = 0;
});
document
  .getElementById("menu-controls")!
  .addEventListener("pointerdown", () => {
    menuIdleFrames = 0;
  });
beginDemo();
requestAnimationFrame(frame);
// Read-only snapshots for diagnostics; no controls or simulation bypasses exposed.
window.hoverDiagnostics = () => ({
  state,
  demoFrames,
  menuIdleFrames,
  titleIntroFrames: originalMenu.introFrames,
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
  card:
    originalMenu.screen === "card"
      ? {
          slot: cardMenu.slot,
          page: cardMenu.page,
          selection: cardMenu.selected,
          cursor: cardMenu.cursor,
          action: cardMenu.action,
          errorFrames: cardMenu.errorFrames,
          error: cardMenu.error,
          busy: cardMenu.busy,
        }
      : null,
  autoSaveSlot,
  autoLoadSave: session.snapshot().auto,
  replay: replayRun
    ? {
        kind: replayKind,
        frame: replayRun.frame,
        frames: replayRun.tape.frames,
        course: replayRun.tape.course,
        machine: replayRun.tape.machine,
      }
    : null,
  lastReplay: replayMemory.saved
    ? {
        course: replayMemory.saved.course,
        machine: replayMemory.saved.machine,
        frames: replayMemory.saved.frames,
        bytes: replayMemory.saved.words.length * 2,
        totalTicks: replayMemory.saved.totalTicks,
      }
    : null,
  help:
    originalMenu.screen === "help"
      ? {
          page: originalMenu.help.page,
          book:
            originalMenu.help.page === "book" ? originalMenu.help.book : null,
          selection: originalMenu.help.selected,
          scroll: originalMenu.help.scroll,
          maxScroll: originalMenu.help.maxScroll,
          frame: originalMenu.help.frame,
          annotations: originalMenu.help.annotations.map((a) => ({ ...a })),
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
