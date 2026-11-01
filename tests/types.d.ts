import type { BrowserType } from "playwright";

export interface BrowserOptions {
  chromium: BrowserType;
  executablePath?: string;
  baseURL: string;
}
export type BrowserTest = (options: BrowserOptions) => Promise<void>;

// Test-only browser instrumentation. These fields are installed before use.
type Renderer = import("../src/renderer").HoverRenderer;
type Sound = import("../src/sound").OriginalSound;
interface Trace {
  x: number;
  y: number;
  z: number;
  heading: number;
  front?: number[];
  rear?: number[];
}
declare global {
  const HOVER_MUSIC: Window["HOVER_MUSIC"];
  const HOVER_MODELS: Window["HOVER_MODELS"];
  const HOVER_BACKGROUNDS: Window["HOVER_BACKGROUNDS"];
  interface Window {
    demoAudioAnalyser: AnalyserNode;
    HOVER_TRACKS: RawTrack[];
    fidelity: {
      r: Renderer;
      t: Track;
      c: Car;
      canvas: HTMLCanvasElement;
      sound: Sound;
      analyser?: AnalyserNode;
      effectStress?: number;
    };
    savedReplayStep: typeof HoverEngine.step;
    originalGhostStep: typeof HoverEngine.step;
    replayTrace: Trace[];
    replayedTrace: Trace[];
    firstRunTrace: Trace[];
    ghostMapMachines: number[];
    ghostMismatches: { expected: Trace; actual: Trace }[];
    ghostVisuals: {
      ticks: number;
      l1: boolean;
      accel: boolean;
      sides: boolean[];
      rear: boolean;
      semi?: boolean;
      opacity?: number;
    }[];
    cameraTrail: { state: string; time: number; p: number[]; q: number[] }[];
    phaseView: {
      sides: boolean[];
      flames: boolean[];
      camera: [number, number, number];
    };
    bombSounds: number;
    bombEvents: { note?: number; volume?: number }[];
    recordPortraitRows: number[];
    recordListPortraits: Record<number, number[]>;
    recordListDrawImage: CanvasRenderingContext2D["drawImage"];
    menuTestPad: { buttons: { pressed: boolean }[]; axes: number[] };
  }
}
