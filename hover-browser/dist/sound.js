export class OriginalSound {
    context;
    enabled;
    buffers;
    loops;
    voices;
    song;
    notesPlayed;
    master;
    ready;
    timer;
    pendingCourse = null;
    songName;
    cursor;
    epoch;
    channels;
    constructor() {
        this.context = null;
        this.enabled = false;
        this.buffers = new Map();
        this.loops = [];
        this.voices = new Set();
        this.song = null;
        this.notesPlayed = 0;
    }
    async enable(value) {
        this.enabled = value;
        if (!value) {
            if (this.master)
                this.master.gain.value = 0;
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
            this.ready = Promise.all([
                ...Object.entries(window.HOVER_SOUNDS).map(([id, s]) => ["se" + id, s]),
                ...Object.entries(window.HOVER_MUSIC.samples).map(([id, s]) => ["bgm" + id, s]),
            ].map(async ([id, s]) => {
                const r = await fetch("assets/" + s.file);
                if (!r.ok)
                    throw Error(s.file);
                this.buffers.set(id, await c.decodeAudioData(await r.arrayBuffer()));
            })).then(() => {
                for (const name of ["wind", "rear", "left", "right"]) {
                    const meta = window.HOVER_SOUNDS[65], source = c.createBufferSource(), gain = c.createGain(), pan = c.createStereoPanner();
                    source.buffer = this.buffers.get("se65");
                    source.loop = true;
                    source.loopStart = meta.loopStart;
                    source.loopEnd = meta.loopEnd;
                    source.connect(gain);
                    gain.connect(pan);
                    pan.connect(this.master);
                    pan.pan.value = name === "left" ? -0.6 : name === "right" ? 0.6 : 0;
                    gain.gain.value = 0;
                    source.start();
                    this.loops.push({ name, source, gain });
                }
                this.timer = setInterval(() => this.schedule(), 25);
            });
        }
        await this.context.resume();
        await this.ready;
        this.master.gain.value = this.enabled ? 0.35 : 0;
        if (this.pendingCourse != null && !this.song)
            this.playCourse(this.pendingCourse);
    }
    effect(id, note = 60) {
        if (!this.enabled || !this.buffers.has("se" + id))
            return;
        const s = this.context.createBufferSource();
        s.buffer = this.buffers.get("se" + id);
        s.playbackRate.value = 2 ** ((note - window.HOVER_SOUNDS[id].note) / 12);
        s.connect(this.master);
        s.onended = () => s.disconnect();
        s.start();
    }
    stopMusic() {
        for (const v of this.voices) {
            try {
                v.s.stop();
            }
            catch { }
        }
        this.voices.clear();
        this.song = null;
    }
    playCourse(index) {
        this.stopMusic();
        this.pendingCourse = index;
        if (!this.ready)
            return;
        this.ready.then(() => {
            if (this.pendingCourse !== index)
                return;
            this.songName =
                typeof index === "string" ? index : window.HOVER_MUSIC.courses[index];
            this.song = window.HOVER_MUSIC.songs[this.songName];
            this.cursor = 0;
            this.epoch = this.context.currentTime + 0.05;
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
    release(v, when) {
        if (v.released)
            return;
        v.released = true;
        const rate = v.t.adsr2 & 31;
        const seconds = Math.min(3, Math.max(0.015, (32768 * Math.pow(2, Math.max(0, rate - 11))) /
            (Math.pow(2, Math.max(0, 11 - rate)) * 8 * 44100)));
        v.g.gain.cancelAndHoldAtTime(when);
        v.g.gain.linearRampToValueAtTime(0, when + seconds);
        v.s.stop(when + seconds + 0.01);
    }
    note(ch, n, velocity, when) {
        const channel = this.channels[ch];
        for (const t of window.HOVER_MUSIC.programs[channel.program] || []) {
            if (n < t.min || n > t.max)
                continue;
            const c = this.context, s = c.createBufferSource(), g = c.createGain(), pan = c.createStereoPanner(), sample = window.HOVER_MUSIC.samples[t.sample];
            s.buffer = this.buffers.get("bgm" + t.sample);
            s.loop = sample.loop;
            s.loopStart = sample.loopStart;
            s.loopEnd = sample.loopEnd;
            const base = 2 ** ((n - t.center - t.shift / 128) / 12);
            s.playbackRate.value = base * 2 ** (channel.bend / 12);
            const level = (((((velocity / 127) * t.volume * channel.volume) / 127) *
                channel.expression) /
                127) *
                0.65;
            const ar = (t.adsr1 >> 8) & 127, shift = ar >> 2, step = 7 - (ar & 3);
            const attack = Math.min(2, Math.max(0.001, (32768 * Math.pow(2, Math.max(0, shift - 11))) /
                (step * Math.pow(2, Math.max(0, 11 - shift)) * 44100)));
            const sustain = ((t.adsr1 & 15) + 1) / 16;
            g.gain.setValueAtTime(0, when);
            g.gain.linearRampToValueAtTime(level, when + attack);
            g.gain.setTargetAtTime(level * sustain, when + attack, 0.03 * Math.pow(2, (t.adsr1 >> 4) & 15));
            pan.pan.value = Math.max(-1, Math.min(1, (channel.pan + t.pan - 128) / 64));
            s.connect(g);
            g.connect(pan);
            pan.connect(this.master);
            const v = { s, g, pan, ch, n, t, base, released: false };
            this.voices.add(v);
            s.onended = () => {
                this.voices.delete(v);
                s.disconnect();
                g.disconnect();
                pan.disconnect();
            };
            s.start(when);
            this.notesPlayed++;
        }
    }
    schedule() {
        if (!this.song || !this.context || this.context.state !== "running")
            return;
        const until = this.context.currentTime + 0.12;
        while (this.song && this.epoch + this.song.events[this.cursor][0] < until) {
            const [time, status, a, b] = this.song.events[this.cursor++], when = Math.max(this.context.currentTime, this.epoch + time), ch = status & 15, kind = status >> 4, c = this.channels[ch];
            if (kind === 9 && b)
                this.note(ch, a, b, when);
            else if (kind === 8 || kind === 9) {
                for (const v of this.voices)
                    if (v.ch === ch && v.n === a && !v.released) {
                        if (c.sustain)
                            v.held = true;
                        else
                            this.release(v, when);
                    }
            }
            else if (kind === 12)
                c.program = a;
            else if (kind === 14) {
                c.bend = ((((b << 7) | a) - 8192) / 8192) * 2;
                for (const v of this.voices)
                    if (v.ch === ch)
                        v.s.playbackRate.setValueAtTime(v.base * 2 ** (c.bend / 12), when);
            }
            else if (kind === 11) {
                if (a === 7)
                    c.volume = b;
                if (a === 10)
                    c.pan = b;
                if (a === 11)
                    c.expression = b;
                if (a === 64) {
                    c.sustain = b >= 64;
                    if (!c.sustain)
                        for (const v of this.voices)
                            if (v.ch === ch && v.held)
                                this.release(v, when);
                }
                if (a === 123)
                    for (const v of this.voices)
                        if (v.ch === ch)
                            this.release(v, when);
            }
            if (this.cursor === this.song.events.length) {
                this.cursor = 0;
                this.epoch += this.song.duration;
            }
        }
    }
    update(car, input, running) {
        if (!this.context)
            return;
        for (const { name, source, gain } of this.loops) {
            const note = name === "wind" ? 8 : car.turbo ? 32 : 20;
            let volume = 0;
            if (running) {
                if (name === "wind")
                    volume = Math.min(127, (car.sourceSpeed || 0) >> 5) / 127;
                else if (name === "rear")
                    volume = input.accel || car.turbo ? 40 / 127 : 0;
                else
                    volume = (name === "left" ? input.l1 || input.l2 : input.r1 || input.r2)
                        ? 40 / 127
                        : 0;
            }
            gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.02);
            source.playbackRate.setTargetAtTime(2 ** ((note - window.HOVER_SOUNDS[65].note) / 12), this.context.currentTime, 0.02);
        }
    }
    pause(value) {
        if (!this.context)
            return;
        if (value)
            this.context.suspend();
        else
            this.context.resume();
    }
    diagnostics() {
        return {
            audioState: this.context?.state || "not-started",
            music: this.song ? this.songName : null,
            musicNotes: this.notesPlayed,
            musicVoices: this.voices.size,
            audioBuffers: this.buffers.size,
        };
    }
}
