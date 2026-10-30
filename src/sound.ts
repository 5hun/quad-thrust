// Source: src/sound.ts. Build with npm run build; do not edit dist/sound.js directly.
// Original SEQ event stream + VAB instrument samples. Web Audio replaces the SPU.
interface Voice {
  s: AudioBufferSourceNode;
  g: GainNode;
  pan: StereoPannerNode;
  ch: number;
  n: number;
  t: Tone;
  base: number;
  released: boolean;
  envelope: AudioWorkletNode;
  velocity: number;
  held?: boolean;
}
export class OriginalSound {
  context: AudioContext | null;
  enabled: boolean;
  buffers: Map<string, AudioBuffer>;
  loops: {
    name: string;
    source: AudioBufferSourceNode;
    gain: GainNode;
    pan: StereoPannerNode;
  }[];
  voices: Set<Voice>;
  song: Song | null;
  notesPlayed: number;
  master!: GainNode;
  reverb!: ConvolverNode;
  effects = new Map<
    number,
    { source: AudioBufferSourceNode; envelope: AudioWorkletNode }
  >();
  ready!: Promise<void>;
  timer?: ReturnType<typeof setInterval>;
  pendingCourse: string | number | null = null;
  musicLoop = true;
  songName!: string;
  cursor!: number;
  epoch!: number;
  channels!: {
    program: number;
    volume: number;
    expression: number;
    pan: number;
    bend: number;
    sustain: boolean;
  }[];

  constructor() {
    this.context = null;
    this.enabled = false;
    this.buffers = new Map();
    this.loops = [];
    this.voices = new Set();
    this.song = null;
    this.notesPlayed = 0;
  }
  async enable(value: boolean) {
    this.enabled = value;
    if (!value) {
      if (this.master) this.master.gain.value = 0;
      return;
    }
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      const c = this.context;
      this.master = c.createGain();
      this.master.gain.value = 0.35;
      const limiter = c.createDynamicsCompressor();
      this.master.connect(limiter);
      limiter.connect(c.destination);
      // GP1_MAIN.C selects HALL at depth 64/127. A deterministic stereo
      // hall impulse restores the missing wet path; this is not SPU RAM emulation.
      this.reverb = c.createConvolver();
      const impulse = c.createBuffer(
        2,
        Math.ceil(c.sampleRate * 1.8),
        c.sampleRate,
      );
      let seed = 1;
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = Math.floor(c.sampleRate * 0.025); i < data.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          data[i] = (seed / 0x80000000 - 1) * Math.exp((-6 * i) / data.length);
        }
      }
      this.reverb.buffer = impulse;
      const wet = c.createGain();
      wet.gain.value = 64 / 127;
      this.reverb.connect(wet);
      wet.connect(this.master);
      this.ready = Promise.all([
        c.audioWorklet.addModule("spu-envelope.js"),
        ...[
          ...Object.entries(window.HOVER_SOUNDS).map(
            ([id, s]) => ["se" + id, s] as [string, Sample],
          ),
          ...Object.entries(window.HOVER_MUSIC.samples).map(
            ([id, s]) => ["bgm" + id, s] as [string, Sample],
          ),
        ].map(async ([id, s]) => {
          const r = await fetch("assets/" + s.file);
          if (!r.ok) throw Error(s.file);
          this.buffers.set(id, await c.decodeAudioData(await r.arrayBuffer()));
        }),
      ]).then(() => {
        for (const name of ["wind", "rear", "left", "right"]) {
          const meta = window.HOVER_SOUNDS[65],
            source = c.createBufferSource(),
            gain = c.createGain(),
            pan = c.createStereoPanner();
          source.buffer = this.buffers.get("se65")!;
          source.loop = true;
          source.loopStart = meta.loopStart;
          source.loopEnd = meta.loopEnd;
          const envelope = this.envelope(meta, c.currentTime, source);
          source.connect(envelope);
          envelope.connect(gain);
          gain.connect(pan);
          pan.connect(this.master);
          pan.connect(this.reverb);
          pan.pan.value = name === "left" ? -0.6 : name === "right" ? 0.6 : 0;
          gain.gain.value = 0;
          source.start();
          this.loops.push({ name, source, gain, pan });
        }
        this.timer = setInterval(() => this.schedule(), 25);
      });
    }
    await this.context.resume();
    await this.ready;
    this.master.gain.value = this.enabled ? 0.35 : 0;
    if (this.pendingCourse != null && !this.song)
      this.playCourse(this.pendingCourse, this.musicLoop);
  }
  envelope(
    t: { adsr1?: number; adsr2?: number },
    when: number,
    source: AudioBufferSourceNode,
  ) {
    const node = new AudioWorkletNode(this.context!, "hover-spu-envelope", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        adsr1: t.adsr1 ?? 15,
        adsr2: t.adsr2 ?? 0x1fc0,
        when,
      },
    });
    node.port.onmessage = () => {
      try {
        source.stop();
      } catch {}
    };
    return node;
  }
  disposeEnvelope(node: AudioWorkletNode) {
    node.port.postMessage({ dispose: true });
    node.disconnect();
    node.port.close();
  }
  effect(id: number, note = 60, volume = 127, sustained = false) {
    if (!this.enabled || !this.buffers.has("se" + id)) return;
    // car_hitsound replaces the previous wall/landing voice.
    const old = this.effects.get(id);
    if (old) old.envelope.port.postMessage({ when: this.context!.currentTime });
    const meta = window.HOVER_SOUNDS[id];
    const s = this.context!.createBufferSource();
    s.buffer = this.buffers.get("se" + id)!;
    s.playbackRate.value =
      2 ** ((note - meta.note! - (meta.shift || 0) / 128) / 12);
    s.loop = sustained && meta.loop;
    s.loopStart = meta.loopStart;
    s.loopEnd = meta.loopEnd;
    const envelope = this.envelope(meta, this.context!.currentTime, s);
    const gain = this.context!.createGain();
    gain.gain.value = (volume / 127) * (meta.volume ?? 1);
    s.connect(envelope);
    envelope.connect(gain);
    gain.connect(this.master);
    gain.connect(this.reverb);
    this.effects.set(id, { source: s, envelope });
    s.onended = () => {
      s.disconnect();
      this.disposeEnvelope(envelope);
      gain.disconnect();
      if (this.effects.get(id)?.source === s) this.effects.delete(id);
    };
    s.start();
  }
  continuous(id: number, note: number, volume: number, active: boolean) {
    if (active && !this.effects.has(id)) this.effect(id, note, volume, true);
    if (!active) {
      this.effects
        .get(id)
        ?.envelope.port.postMessage({ when: this.context!.currentTime });
      this.effects.delete(id);
    }
  }
  stopMusic() {
    for (const v of this.voices) {
      try {
        v.s.stop();
      } catch {}
    }
    this.voices.clear();
    this.song = null;
  }
  playCourse(index: string | number, loop = true) {
    this.musicLoop = loop;
    this.stopMusic();
    this.pendingCourse = index;
    if (!this.ready) return;
    this.ready.then(() => {
      if (this.pendingCourse !== index || this.musicLoop !== loop) return;
      this.songName =
        typeof index === "string" ? index : window.HOVER_MUSIC.courses[index];
      this.song = window.HOVER_MUSIC.songs[this.songName];
      this.cursor = 0;
      this.epoch = this.context!.currentTime + 0.05;
      this.channels = Array.from({ length: 16 }, () => ({
        program: 0,
        volume: 100,
        expression: 127,
        pan: 64,
        bend: 0,
        sustain: false,
      }));
      this.schedule();
    });
  }
  cancel() {
    this.pendingCourse = null;
    this.stopMusic();
  }
  release(v: Voice, when: number) {
    if (v.released) return;
    v.released = true;
    v.envelope.port.postMessage({ when });
  }
  note(ch: number, n: number, velocity: number, when: number) {
    const channel = this.channels[ch];
    for (const t of window.HOVER_MUSIC.programs[channel.program] || []) {
      if (n < t.min || n > t.max) continue;
      const c = this.context!,
        s = c.createBufferSource(),
        g = c.createGain(),
        pan = c.createStereoPanner(),
        sample = window.HOVER_MUSIC.samples[t.sample];
      s.buffer = this.buffers.get("bgm" + t.sample)!;
      s.loop = sample.loop;
      s.loopStart = sample.loopStart;
      s.loopEnd = sample.loopEnd;
      const base = 2 ** ((n - t.center - t.shift / 128) / 12);
      s.playbackRate.value = base * 2 ** (channel.bend / 12);
      const level =
        (((((velocity / 127) * t.volume * channel.volume) / 127) *
          channel.expression) /
          127) *
        0.65;
      g.gain.setValueAtTime(level, when);
      const envelope = this.envelope(t, when, s);
      pan.pan.value = Math.max(
        -1,
        Math.min(1, (channel.pan + t.pan - 128) / 64),
      );
      s.connect(envelope);
      envelope.connect(g);
      g.connect(pan);
      pan.connect(this.master);
      pan.connect(this.reverb);
      const v = {
        s,
        g,
        pan,
        ch,
        n,
        t,
        base,
        envelope,
        velocity,
        released: false,
      };
      this.voices.add(v);
      s.onended = () => {
        this.voices.delete(v);
        s.disconnect();
        g.disconnect();
        pan.disconnect();
        this.disposeEnvelope(envelope);
      };
      s.start(when);
      this.notesPlayed++;
    }
  }
  schedule() {
    if (!this.song || !this.context || this.context.state !== "running") return;
    const until = this.context!.currentTime + 0.12;
    while (this.song && this.epoch + this.song.events[this.cursor][0] < until) {
      const [time, status, a, b] = this.song.events[this.cursor++],
        when = Math.max(this.context!.currentTime, this.epoch + time),
        ch = status & 15,
        kind = status >> 4,
        c = this.channels[ch];
      if (kind === 9 && b) this.note(ch, a, b, when);
      else if (kind === 8 || kind === 9) {
        for (const v of this.voices)
          if (v.ch === ch && v.n === a && !v.released) {
            if (c.sustain) v.held = true;
            else this.release(v, when);
          }
      } else if (kind === 12) c.program = a;
      else if (kind === 14) {
        c.bend = ((((b << 7) | a) - 8192) / 8192) * 2;
        for (const v of this.voices)
          if (v.ch === ch)
            v.s.playbackRate.setValueAtTime(v.base * 2 ** (c.bend / 12), when);
      } else if (kind === 11) {
        if (a === 7) c.volume = b;
        if (a === 10) c.pan = b;
        if (a === 11) c.expression = b;
        if (a === 7 || a === 10 || a === 11)
          for (const v of this.voices) {
            if (v.ch !== ch) continue;
            v.g.gain.setValueAtTime(
              (((((v.velocity / 127) * v.t.volume * c.volume) / 127) *
                c.expression) /
                127) *
                0.65,
              when,
            );
            v.pan.pan.setValueAtTime(
              Math.max(-1, Math.min(1, (c.pan + v.t.pan - 128) / 64)),
              when,
            );
          }
        if (a === 64) {
          c.sustain = b >= 64;
          if (!c.sustain)
            for (const v of this.voices)
              if (v.ch === ch && v.held) this.release(v, when);
        }
        if (a === 123)
          for (const v of this.voices) if (v.ch === ch) this.release(v, when);
      }
      if (this.cursor === this.song.events.length) {
        if (!this.musicLoop) {
          this.pendingCourse = null;
          this.song = null;
          break;
        }
        this.cursor = 0;
        this.epoch += this.song.duration;
      }
    }
  }
  update(car: Car, input: Input, running: boolean, falling = false) {
    if (!this.context) return;
    this.continuous(70, 40, 80, running && car.energy < 12.5);
    this.continuous(
      71,
      90,
      64,
      running && (car.damageFloorActive ?? (car.grip && car.tile === "d")),
    );
    for (const { name, source, gain, pan } of this.loops) {
      const note = name === "wind" ? 8 : name === "rear" && car.turbo ? 32 : 20;
      let volume = 0;
      if (running || falling) {
        if (name === "wind")
          volume = Math.min(127, (car.sourceSpeed || 0) >> 5) / 127;
        else if (falling) volume = 0;
        else if (name === "rear")
          volume = input.accel || car.turbo ? 40 / 127 : 0;
        else
          volume = (
            name === "left" ? input.l1 || input.l2 : input.r1 || input.r2
          )
            ? car.type === 5
              ? 0
              : 40 / 127
            : 0;
      }
      // SsUtSetVVol supplies independent L/R amplitudes. StereoPanner uses
      // equal-power gains, so preserve (40,10)/(10,40), not just a pan guess.
      const left = name === "right" ? volume / 4 : volume;
      const right = name === "left" ? volume / 4 : volume;
      gain.gain.setTargetAtTime(
        Math.hypot(left, right),
        this.context!.currentTime,
        0.02,
      );
      if (volume > 0)
        pan.pan.setTargetAtTime(
          (4 * Math.atan2(right, left)) / Math.PI - 1,
          this.context!.currentTime,
          0.02,
        );
      source.playbackRate.setTargetAtTime(
        2 ** ((note - window.HOVER_SOUNDS[65].note!) / 12),
        this.context!.currentTime,
        0.02,
      );
    }
  }
  pause(value: boolean) {
    if (!this.context) return;
    if (value) this.context.suspend();
    else this.context.resume();
  }
  diagnostics() {
    return {
      audioState: this.context?.state || "not-started",
      music: this.song ? this.songName : null,
      musicNotes: this.notesPlayed,
      musicLoop: this.musicLoop,
      musicVoices: this.voices.size,
      audioBuffers: this.buffers.size,
    };
  }
}
