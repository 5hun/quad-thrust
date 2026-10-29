type Vec3 = number[];
interface RawBoundary {
  l: Vec3;
  r: Vec3;
}
interface Boundary extends RawBoundary {
  x: number;
  y: number;
  z: number;
  width: number;
}
interface RawSample {
  l: Vec3;
  r: Vec3;
  tiles: string;
  allTiles: string;
  end?: RawBoundary;
}
interface RawTrack {
  name: string;
  theme: number;
  samples: RawSample[];
  training?: boolean;
}
interface TrackNode extends RawSample, Boundary {
  end?: Boundary;
  distance: number;
  len: number;
  heading: number;
}
interface Track extends RawTrack {
  nodes: TrackNode[];
  length: number;
}
interface Input {
  accel?: boolean;
  turbo?: boolean;
  brake?: boolean;
  steer?: number;
  pitch?: number;
  l1?: boolean;
  l2?: boolean;
  r1?: boolean;
  r2?: boolean;
}
interface Pose {
  x: number;
  y: number;
  z: number;
  heading: number;
  type: number;
  pitch?: number;
  roll?: number;
  sourceSpeed?: number;
  ticks?: number;
  turbo?: boolean;
  rudderAngle?: number;
  explosionFrames?: number;
  repairFrames?: number;
  fireTail?: number;
  groundY?: number;
  active?: Input;
}
interface Car extends Pose {
  pitch: number;
  roll: number;
  sourceSpeed: number;
  ticks: number;
  vx: number;
  vy: number;
  vz: number;
  front: Vec3;
  rear: Vec3;
  energy: number;
  damage: number;
  index: number;
  progress: number;
  lastDistance: number;
  time: number;
  lapStart: number;
  linePosition: number;
  lastLine: number;
  lastGoal: number;
  cpuLevel?: number;
  cpuSlot?: number;
  catchUp?: boolean;
  laps: number[];
  finished: boolean;
  reason: "finish" | "destroyed" | "course-out" | null;
  flash: number;
  recovery: number;
  turbo: boolean;
  rudderAngle: number;
  grip: boolean;
  previousTile: string;
  tei: number;
  accumulator: number;
  events: string[];
  tile?: string;
  pace?: number;
  aiTicks?: number;
  stopped?: boolean;
  lapDraw?: number;
  wrongFrames?: number;
  explosionPlayed?: boolean;
}
interface Nearest {
  index: number;
  t: number;
  x: number;
  z: number;
  y: number;
  dist: number;
  width: number;
  heading: number;
  distance: number;
  tile: string;
  lane: number;
  ly: number;
  ry: number;
  slope: number;
  dx: number;
  dz: number;
  dy: number;
}
interface TrainingSession {
  task: (typeof HoverTraining.tasks)[number];
  remaining: number;
  heading: number;
  turn: number;
  status: "miss" | "complete" | null;
  reason: string;
}
interface Sample {
  file: string;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  note?: number;
}
interface Tone {
  sample: number;
  volume: number;
  pan: number;
  center: number;
  shift: number;
  min: number;
  max: number;
  adsr1: number;
  adsr2: number;
}
interface Song {
  events: [number, number, number, number][];
  duration: number;
}
interface BackgroundBank {
  sky: string[];
  ground: string[];
  top: [number, number, number];
  bottom: [number, number, number];
}
declare const HOVER_TRACKS: RawTrack[];
declare const HOVER_TRAINING_TRACKS: RawTrack[];
interface Window {
  HoverEngine: typeof HoverEngine;
  HoverRules: typeof HoverRules;
  HoverTraining: typeof HoverTraining;
  HoverRecords: typeof HoverRecords;
  HOVER_MODELS: Record<
    string,
    Record<string, Record<"position" | "normal" | "color" | "uv", number[]>>[]
  >;
  HOVER_SOUNDS: Record<number, Sample>;
  HOVER_MUSIC: {
    samples: Record<number, Sample>;
    programs: Record<number, Tone[]>;
    songs: Record<string, Song>;
    courses: string[];
  };
  HOVER_BACKGROUNDS: BackgroundBank[];
  webkitAudioContext?: typeof AudioContext;
  hoverDiagnostics: () => object;
}
declare module "*vendor/three.module.js" {
  export * from "three";
}
