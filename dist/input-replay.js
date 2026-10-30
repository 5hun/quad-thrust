export function inputPad(input) {
    return ((input.accel ? 64 : 0) |
        (input.turbo ? 128 : 0) |
        (input.brake ? 32 : 0) |
        ((input.steer || 0) > 0 ? 8192 : (input.steer || 0) < 0 ? 32768 : 0) |
        ((input.pitch || 0) > 0 ? 16384 : (input.pitch || 0) < 0 ? 4096 : 0) |
        (input.l1 ? 4 : 0) |
        (input.l2 ? 1 : 0) |
        (input.r1 ? 8 : 0) |
        (input.r2 ? 2 : 0));
}
export function padInput(pad) {
    return {
        accel: !!(pad & 64),
        turbo: !!(pad & 128),
        brake: !!(pad & 32),
        steer: +!!(pad & 8192) - +!!(pad & 32768),
        pitch: +!!(pad & 16384) - +!!(pad & 4096),
        l1: !!(pad & 4),
        l2: !!(pad & 1),
        r1: !!(pad & 8),
        r2: !!(pad & 2),
    };
}
export class ReplayRecorder {
    words = [];
    axes = {};
    frames = 0;
    full = false;
    record(input) {
        // The original stops writing, including extending the last run, at 8KB.
        if (this.words.length === 4096) {
            this.full = true;
            return;
        }
        const pad = inputPad(input);
        const code = (pad & 15) | ((pad & (7 << 5)) >> 1) | ((pad & (15 << 12)) >> 5);
        const last = this.words.length - 1;
        if (last >= 0 &&
            this.words[last] >> 5 === code &&
            (this.words[last] & 31) !== 31)
            ++this.words[last];
        else
            this.words.push(code << 5);
        const steer = input.steer || 0, pitch = input.pitch || 0;
        if (![0, -1, 1].includes(steer) || ![0, -1, 1].includes(pitch))
            this.axes[this.frames] = [steer, pitch];
        ++this.frames;
    }
    tape(meta) {
        return {
            ...meta,
            words: this.words.slice(),
            frames: this.frames,
            axes: { ...this.axes },
        };
    }
}
export class ReplayReader {
    tape;
    frame = 0;
    word = 0;
    remaining = 0;
    pad = 0;
    constructor(tape) {
        this.tape = tape;
    }
    next() {
        if (this.frame >= this.tape.frames)
            return null;
        if (this.remaining === 0) {
            if (this.word >= this.tape.words.length)
                return null;
            const packed = this.tape.words[this.word++];
            this.remaining = (packed & 31) + 1;
            const code = packed >>> 5;
            this.pad =
                (code & 15) | ((code & (7 << 4)) << 1) | ((code & (15 << 7)) << 5);
        }
        --this.remaining;
        const input = padInput(this.pad), axis = this.tape.axes?.[this.frame];
        ++this.frame;
        if (axis)
            [input.steer, input.pitch] = axis;
        return input;
    }
}
export function encodeOriginalReplay(tape) {
    if (tape.words.length > 4096)
        throw Error("Replay input exceeds 8KB");
    const dataSize = tape.words.length * 2;
    const blockSize = (dataSize + 127) & ~127;
    const bytes = new Uint8Array(128 + blockSize), v = new DataView(bytes.buffer);
    v.setUint16(0, 0x5268, true);
    v.setUint8(2, tape.machine);
    v.setUint8(3, tape.course);
    v.setUint16(4, blockSize, true);
    v.setUint16(6, dataSize, true);
    v.setInt32(8, tape.frames, true);
    const text = (value, start, length) => {
        [...value.slice(0, length - 1)].forEach((ch, i) => (bytes[start + i] = ch.charCodeAt(0) & 127));
    };
    text(tape.name || "", 16, 16);
    text(tape.playerName || "", 32, 8);
    v.setInt32(40, tape.gameMode, true);
    v.setInt32(44, tape.totalTicks, true);
    v.setInt32(52, tape.level, true);
    tape.words.forEach((word, i) => v.setUint16(128 + i * 2, word, true));
    return bytes;
}
export function decodeOriginalReplay(bytes) {
    if (bytes.length < 128)
        throw Error("Replay header is truncated");
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (v.getUint16(0, true) !== 0x5268)
        throw Error("Invalid hR replay signature");
    const machine = v.getUint8(2), course = v.getUint8(3), gameMode = v.getInt32(40, true);
    const frames = v.getInt32(8, true), size = v.getUint16(6, true), block = v.getUint16(4, true);
    const level = v.getInt32(52, true), totalTicks = v.getInt32(44, true);
    if (machine > 5 ||
        course > 8 ||
        ![0, 1, 4].includes(gameMode) ||
        level < -1 ||
        level > 2 ||
        size === 0 ||
        size > 8192 ||
        size % 2 ||
        block < size ||
        block > 8192 ||
        block % 128 ||
        bytes.length < 128 + size ||
        frames <= 0 ||
        totalTicks < 0)
        throw Error("Invalid replay metadata or input extent");
    const words = Array.from({ length: size / 2 }, (_, i) => v.getUint16(128 + i * 2, true));
    if (frames > words.reduce((n, word) => n + (word & 31) + 1, 0))
        throw Error("Replay ends before play_time");
    const text = (start, length) => String.fromCharCode(...bytes.slice(start, start + length)).split("\0")[0];
    return {
        machine,
        course,
        gameMode: gameMode,
        frames,
        totalTicks,
        words,
        level,
        name: text(16, 16),
        playerName: text(32, 8),
    };
}
// Re-run the same fixed-step simulation as the race, rather than interpolating
// positions. No live input, best-time writes, or training/GP progression occurs.
export class InputReplay {
    tape;
    track;
    reader;
    car;
    bots;
    rank = 1;
    constructor(tape, track) {
        this.tape = tape;
        this.track = track;
        const E = HoverEngine;
        this.reader = new ReplayReader(tape);
        this.car = E.placeOnGrid(E.create(track, tape.machine), track);
        this.bots =
            tape.gameMode === 4
                ? []
                : [0, 1, 2, 3]
                    .filter((type) => type !== tape.machine)
                    .slice(0, 3)
                    .map((type, i) => {
                    const bot = E.placeOnGrid(E.create(track, type), track, i + 1);
                    bot.cpuLevel = E.cpuLevels[tape.level + 1][tape.course];
                    bot.cpuSlot = i + 1;
                    return bot;
                });
    }
    get frame() {
        return this.reader.frame;
    }
    step() {
        const input = this.reader.next();
        if (!input)
            return false;
        const E = HoverEngine, car = this.car, dt = 1 / 60;
        car.repairFrames = Math.max(0, (car.repairFrames || 0) - 1);
        car.lapDraw = Math.max(0, (car.lapDraw || 0) - 1);
        const laps = car.laps.length, wasFinished = car.finished;
        if (car.reason === "finish") {
            car.cpuSlot = 0;
            car.cpuLevel = this.tape.gameMode === 0 && this.rank === 1 ? 10 : 0;
            E.step(car, this.track, E.driveCPU(car, this.track, car), dt, false, false);
        }
        else if (car.reason === "destroyed") {
            E.stepDebris(car);
            car.explosionFrames = (car.explosionFrames || 0) + 1;
        }
        else if (car.reason === "course-out") {
            const gravity = (E.MACHINES[car.type].weight * 3) >> 4;
            car.front[1] += gravity;
            car.rear[1] += gravity;
            E.sync(car);
            car.x += car.vx * dt;
            car.y += car.vy * dt;
            car.z += car.vz * dt;
        }
        else {
            E.step(car, this.track, input, dt);
            if (car.laps.length > laps)
                car.lapDraw = 180;
            if (car.events.includes("repair"))
                car.repairFrames = 32;
            if (car.reason === "destroyed") {
                car.explosionFrames = 0;
                E.emitDebris(car, 64, 2, [0, 1, 0]);
            }
        }
        for (const bot of this.bots) {
            if (bot.finished && bot.reason !== "finish") {
                E.recover(bot, this.track);
                bot.damage = 0;
            }
            E.step(bot, this.track, E.driveCPU(bot, this.track, car), dt, true, !wasFinished && !bot.finished);
            if (bot.laps.length >= 3) {
                bot.finished = true;
                bot.reason = "finish";
            }
            bot.events.length = 0;
        }
        E.collideAll([car, ...this.bots]);
        if (!wasFinished && car.finished)
            this.rank = 1 + this.bots.filter((b) => b.progress > car.progress).length;
        car.events.length = 0;
        return true;
    }
}
// A TA ghost is a second car_action slot, not a CPU or a standalone replay.
// It cannot count laps/finish the race, collide with the player, play repair
// effects, or trigger the player's damage-floor treatment. At tape end the
// original clears its input and keeps simulating; it does not wrap/disappear.
export class GhostReplay {
    tape;
    track;
    reader;
    car;
    constructor(tape, track) {
        this.tape = tape;
        this.track = track;
        this.reader = new ReplayReader(tape);
        const E = HoverEngine;
        this.car = E.placeOnGrid(E.create(track, tape.machine), track);
        this.car.cpuSlot = 1;
        this.car.cpuLevel = 0;
        this.car.ghost = true;
    }
    step(goal = false) {
        const read = this.reader.next();
        // GAME.C checks rec_point >= rec_last before car_action, so the final
        // recorded input tick is cleared as well as all following input.
        const input = read && this.reader.frame < this.tape.frames ? read : {};
        const E = HoverEngine, car = this.car, dt = 1 / 60;
        if (car.reason === "course-out") {
            ++car.ticks;
            const gravity = (E.MACHINES[car.type].weight * 3) >> 4;
            car.front[1] += gravity;
            car.rear[1] += gravity;
            E.sync(car);
            car.x += car.vx * dt;
            car.y += car.vy * dt;
            car.z += car.vz * dt;
        }
        else if (car.reason === "destroyed") {
            ++car.ticks;
            E.stepDebris(car);
            car.explosionFrames = (car.explosionFrames || 0) + 1;
        }
        else {
            E.step(car, this.track, goal ? E.driveCPU(car, this.track, car) : input, dt, false, !goal);
            if (car.reason === "destroyed") {
                car.explosionFrames = 0;
                E.emitDebris(car, 64, 2, [0, 1, 0]);
            }
        }
        car.events.length = 0;
    }
}
