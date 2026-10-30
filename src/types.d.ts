interface SourceContact {
  origin: Vec3;
  d: Vec3;
  a: Vec3;
  b: Vec3;
  normal: Vec3;
  outside: boolean;
}
type Vec3 = number[];
interface RawBoundary {
  l: Vec3;
  r: Vec3;
  source?: { origin: Vec3; vertices: Vec3[] };
}
interface Boundary extends RawBoundary {
  x: number;
  y: number;
  z: number;
  width: number;
}
interface RawSample extends RawBoundary {
  partColumn?: number;
  sourceNormals?: Vec3[];
  part?: number;
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
  parts?: {
    id: number;
    next: number;
    before: number;
    writeF: number;
    writeB: number;
    extraF: number[];
    extraB: number[];
  }[];
}
interface TrackNode extends RawSample, Boundary {
  end?: Boundary;
  distance: number;
  len: number;
  heading: number;
}
interface Track extends RawTrack {
  sourceParts?: Map<
    number,
    { indices: number[]; next: number; before: number }
  >;
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
  // Row-major 4.12 matrices in original PS1 coordinates.
  sourceMatrix?: Vec3;
  sourceShadowMatrix?: Vec3;
  x: number;
  y: number;
  z: number;
  heading: number;
  type: number;
  pitch?: number;
  roll?: number;
  sourceSpeed?: number;
  ticks?: number;
  energy?: number;
  damageFloorActive?: boolean;
  warningActive?: boolean;
  damageLight?: boolean;
  damageSemi?: boolean;
  cpuSlot?: number;
  ghost?: boolean;
  turbo?: boolean | number;
  rudderAngle?: number;
  explosionFrames?: number;
  repairFrames?: number;
  fireTail?: number;
  fireRemaining?: number;
  groundY?: number;
  groundNormal?: Vec3;
  onRoad?: boolean;
  debris?: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    seed: number;
  }[];
  active?: Input;
}
interface Car extends Pose {
  sourceShadowAngles?: Vec3;
  sourcePreviousAngles?: Vec3;
  sourceContact?: SourceContact;
  sourceTile?: string;
  // CAR_CTR.C posr: quarter PS1 world units, Y down.
  sourcePosition?: Vec3;
  leftDistance?: number;
  rightDistance?: number;
  leftHit?: number;
  rightHit?: number;
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
  turbo: boolean | number;
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
  supported: boolean;
  row: number;
  fallY: number;
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
  surface: number;
  normal: Vec3;
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
  shift?: number;
  volume?: number;
  pan?: number;
  adsr1?: number;
  adsr2?: number;
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
