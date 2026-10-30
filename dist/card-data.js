// MEMORY_C.C, S_TYPES.H: 384-byte system + 1280-byte records + 3*128 headers.
import { decodeOriginalReplay, encodeOriginalReplay, } from "./input-replay.js";
export const RECORD_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ,.^_0123456789%*?&!";
export function defaultSystem() {
    const records = {};
    for (const category of ["gp", "time"])
        for (let c = 0; c < 9; c++)
            for (const kind of ["lap", "total"])
                records[`${category}:${c}:${kind}`] = [
                    "SAT",
                    "UME",
                    "BEE",
                    "UZU",
                    "MAS",
                    "ZZZ",
                ].map((name, i) => ({ time: 600, machine: i % 4, name }));
    return {
        auto: 0,
        level: 0,
        unlocks: 0,
        userName: "AAA",
        training: Array(16).fill(0),
        records,
    };
}
export function recordChecksum(records) {
    let sum = 0;
    const signed = (value) => (value > 127 ? value - 256 : value);
    for (let i = 0; i < 1280; i++)
        sum =
            (sum +
                signed(records[i]) +
                8 +
                i +
                signed(records[i]) * signed(records[1279 - i])) |
                0;
    return sum;
}
function recordBytes(system) {
    const bytes = new Uint8Array(1280), v = new DataView(bytes.buffer);
    for (let c = 0; c < 18; c++)
        for (let kind = 0; kind < 2; kind++) {
            const key = `${c < 9 ? "gp" : "time"}:${c % 9}:${kind ? "total" : "lap"}`;
            const rows = system.records[key] || [];
            let machines = 0;
            for (let i = 0; i < 6; i++) {
                const row = rows[i] || {
                    time: 600,
                    machine: i % 4,
                    name: ["SAT", "UME", "BEE", "UZU", "MAS", "ZZZ"][i],
                };
                machines |= (row.machine & 15) << (i * 4);
                v.setUint16(144 + kind * 216 + (c * 6 + i) * 2, Math.min(65535, Math.max(0, Math.round(row.time * 60))), true);
                for (let ch = 0; ch < 3; ch++)
                    bytes[576 + kind * 324 + (c * 6 + i) * 3 + ch] = Math.max(0, RECORD_CHARACTERS.indexOf((row.name || "AAA")[ch] || "A"));
            }
            v.setUint32((c * 2 + kind) * 4, machines, true);
        }
    return bytes;
}
export function encodeCard(card) {
    const bytes = new Uint8Array(8192), v = new DataView(bytes.buffer), s = card.system;
    if (card.template)
        bytes.set(card.template.slice(0, 256));
    bytes.set([83, 67, 17, 1], 0);
    bytes[256] = s.auto & 3;
    for (let i = 0; i < 3; i++)
        bytes[257 + i] = Math.max(0, RECORD_CHARACTERS.indexOf(s.userName[i] || "A"));
    v.setInt32(272, s.unlocks & 15, true);
    v.setInt32(280, s.level, true);
    for (let i = 0; i < 16; i++)
        bytes[284 + i] = (s.training[i] || 0) & 63;
    const records = recordBytes(s);
    bytes.set(records, 384);
    v.setInt32(276, recordChecksum(records), true);
    let pos = 2048;
    for (let i = 0; i < 3; i++) {
        const tape = card.replays[i];
        if (!tape)
            continue;
        const packed = encodeOriginalReplay(tape), length = packed.length - 128;
        if (pos + length > 8192)
            throw Error("空き領域がありません");
        bytes.set(packed.slice(0, 128), 1664 + i * 128);
        bytes.set(packed.slice(128), pos);
        pos += length;
    }
    return bytes;
}
export function decodeCard(bytes) {
    if (bytes.length < 2048 || bytes[0] !== 83 || bytes[1] !== 67)
        throw Error("セーブデータが不正です");
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), records = bytes.slice(384, 1664);
    if (recordChecksum(records) !== v.getInt32(276, true))
        throw Error("セーブデータが不正です");
    const s = defaultSystem();
    s.auto = bytes[256] & 3;
    s.level = v.getInt32(280, true);
    s.unlocks = v.getInt32(272, true) & 15;
    if (s.level < -1 || s.level > 2)
        throw Error("セーブデータが不正です");
    s.userName = Array.from(bytes.slice(257, 260), (n) => RECORD_CHARACTERS[n] || "A").join("");
    s.training = Array.from(bytes.slice(284, 300), (n) => n & 63);
    const rv = new DataView(records.buffer);
    for (let c = 0; c < 18; c++)
        for (let kind = 0; kind < 2; kind++) {
            const machines = rv.getUint32((c * 2 + kind) * 4, true), key = `${c < 9 ? "gp" : "time"}:${c % 9}:${kind ? "total" : "lap"}`;
            s.records[key] = Array.from({ length: 6 }, (_, i) => ({
                time: rv.getUint16(144 + kind * 216 + (c * 6 + i) * 2, true) / 60,
                machine: (machines >>> (i * 4)) & 15,
                name: Array.from(records.slice(576 + kind * 324 + (c * 6 + i) * 3, 576 + kind * 324 + (c * 6 + i) * 3 + 3), (n) => RECORD_CHARACTERS[n] || "A").join(""),
            }));
            if (s.records[key].some((row) => row.machine > 5))
                throw Error("セーブデータが不正です");
        }
    return {
        system: s,
        replays: decodeReplayPack(bytes, 1664, 2048),
        template: Array.from(bytes.slice(0, 256)),
    };
}
export function decodeReplayPack(bytes, header = 0, data = 384) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = data;
    return Array.from({ length: 3 }, (_, i) => {
        const start = header + i * 128;
        if (start + 128 > bytes.length)
            throw Error("リプレイデータが不正です");
        const size = v.getUint16(start + 6, true), block = (size + 127) & ~127;
        if (pos + block > bytes.length)
            throw Error("リプレイデータが不正です");
        let tape = null;
        if (v.getUint16(start, true) === 0x5268) {
            const packed = new Uint8Array(128 + block);
            packed.set(bytes.slice(start, start + 128));
            packed.set(bytes.slice(pos, pos + block), 128);
            try {
                tape = decodeOriginalReplay(packed);
            }
            catch {
                throw Error("リプレイデータが不正です");
            }
        }
        // MEMORY_C.C packs by data_size even when delete_replay cleared he.
        pos += block;
        return tape;
    });
}
export class SessionStore {
    data = new Map();
    get length() {
        return this.data.size;
    }
    clear() {
        this.data.clear();
    }
    getItem(key) {
        return this.data.get(key) ?? null;
    }
    setItem(key, value) {
        this.data.set(key, String(value));
    }
    removeItem(key) {
        this.data.delete(key);
    }
    key(index) {
        return [...this.data.keys()][index] ?? null;
    }
    apply(s) {
        this.clear();
        this.setItem("hover-unlocks", String(s.unlocks));
        this.setItem("hover-training-marks", JSON.stringify(s.training));
        this.setItem("hover-player-name", s.userName);
        this.setItem("hover-cpu-difficulty", String(s.level + 1));
        this.setItem("hover-auto-load-save", String(s.auto));
        for (const [key, rows] of Object.entries(s.records)) {
            const [category, course, kind] = key.split(":");
            this.setItem(`hover-records-${category}-${course}-${kind}`, JSON.stringify(rows));
            if (kind === "lap")
                this.setItem(`hover-v3-record-${category}-${course}`, String(Math.min(...rows.map((r) => r.time))));
        }
    }
    snapshot() {
        const s = defaultSystem();
        s.auto = Number(this.getItem("hover-auto-load-save")) & 3;
        s.level = Math.max(-1, Math.min(2, Number(this.getItem("hover-cpu-difficulty") ?? 1) - 1));
        s.unlocks = Number(this.getItem("hover-unlocks")) & 15;
        s.userName = this.getItem("hover-player-name") || "AAA";
        try {
            s.training = JSON.parse(this.getItem("hover-training-marks") || "[]");
        }
        catch { }
        for (const key of Object.keys(s.records)) {
            const [category, course, kind] = key.split(":");
            try {
                s.records[key] = JSON.parse(this.getItem(`hover-records-${category}-${course}-${kind}`) ||
                    JSON.stringify(s.records[key]));
            }
            catch { }
        }
        return s;
    }
}
export class MemoryCards {
    storage;
    template;
    fallback = new Map();
    constructor(storage, template = []) {
        this.storage = storage;
        this.template = template;
    }
    read(slot) {
        const raw = this.storage.getItem(`hover-card-v1-${slot}`);
        if (!raw)
            return this.fallback.get(slot) || null;
        try {
            const saved = JSON.parse(raw);
            const card = decodeCard(Uint8Array.from(saved.bytes));
            // Browser axes are carried beside the unchanged PS1 binary file.
            card.replays.forEach((tape, i) => {
                if (tape && saved.axes?.[i])
                    tape.axes = saved.axes[i];
            });
            return card;
        }
        catch {
            throw Error("セーブデータが不正です");
        }
    }
    write(slot, card) {
        const bytes = encodeCard(card); // Validate before changing either stored copy.
        const value = JSON.stringify({
            bytes: Array.from(bytes),
            axes: card.replays.map((t) => t?.axes || null),
        });
        try {
            this.storage.setItem(`hover-card-v1-${slot}`, value);
        }
        catch {
            throw Error("カードに保存できません");
        }
        this.fallback.set(slot, card);
    }
    saveSystem(slot, system) {
        const card = this.read(slot) || {
            system,
            replays: [null, null, null],
            template: this.template,
        };
        card.system = system;
        this.write(slot, card);
    }
    saveReplay(slot, index, tape, system) {
        const card = this.read(slot) || {
            system,
            replays: [null, null, null],
            template: this.template,
        };
        card.replays[index] = tape;
        this.write(slot, card);
    }
    deleteReplay(slot, index) {
        const card = this.read(slot);
        if (!card)
            throw Error("データがありません");
        card.replays[index] = null;
        this.write(slot, card);
    }
    migrateLegacy() {
        if (this.storage.getItem("hover-card-legacy-imported"))
            return;
        const keys = [
            "hover-unlocks",
            "hover-training-marks",
            "hover-player-name",
            "hover-cpu-difficulty",
        ];
        const temp = new SessionStore();
        let any = false;
        for (const key of keys) {
            const value = this.storage.getItem(key);
            if (value !== null) {
                temp.setItem(key, value);
                any = true;
            }
        }
        for (const category of ["gp", "time"])
            for (let c = 0; c < 9; c++)
                for (const kind of ["lap", "total"]) {
                    const key = `hover-records-${category}-${c}-${kind}`, value = this.storage.getItem(key);
                    if (value !== null) {
                        temp.setItem(key, value);
                        any = true;
                    }
                }
        if (any && !this.read(0)) {
            const data = temp.snapshot();
            if (data.training.length >= 15 &&
                data.training.slice(0, 15).every((mark) => (mark & 31) === 31))
                data.unlocks |= 8;
            this.saveSystem(0, data);
        }
        this.storage.setItem("hover-card-legacy-imported", "1");
    }
}
