// MENU_ETC.C / GP1_MAIN.C: original title tree and selection order.
import { OriginalHelp } from "./help.js";
const lists = {
    title: ["START", "OPTION", "HELP", "EXIT"],
    modes: ["GRANDPRIX", "TIME ATTACK", "TRAINING", "2P BATTLE"],
    gp: ["Blue GP", "Yellow GP", "Red GP", "PRACTICE"],
    levels: ["LEVEL 1", "LEVEL 2", "LEVEL 3", "FREE RUN"],
    option: ["MEMORY CARD", "VIEW RECORDS", "VIEW REPLAY", "MUSIC MODE"],
    slots: ["SLOT 1", "SLOT 2"],
    "record-kind": ["GRANDPRIX'S", "TIME ATTACK'S"],
};
const parent = {
    modes: ["title", 0],
    gp: ["modes", 0],
    levels: ["modes", 2],
    option: ["title", 1],
    slots: ["option", 0],
    "record-kind": ["option", 1],
    training: ["levels", 0],
    records: ["record-kind", 0],
    music: ["option", 3],
    help: ["title", 2],
};
const field = (id) => document.getElementById(id);
export class OriginalMenu {
    hooks;
    screen = "title";
    selected = 0;
    card = null;
    introFrames = 0;
    entered = performance.now();
    mode = "time";
    recordClass = "gp";
    recordCourse = 0;
    recordFrames = 0;
    notice = "";
    noticeParent = "title";
    noticeSelection = 0;
    panel;
    canvas;
    g;
    buttons;
    font = new Image();
    logo = new Image();
    portraits = new Image();
    palettes = new Map();
    curves = [];
    padHeld = new Set();
    help = new OriginalHelp(() => this.show("help", this.help.selected), () => {
        this.hooks.music(null);
        this.show("title", 2);
    });
    constructor(hooks) {
        this.hooks = hooks;
        this.panel = document.getElementById("menu");
        this.panel.replaceChildren();
        this.canvas = document.createElement("canvas");
        this.canvas.id = "original-menu";
        this.canvas.width = 320;
        this.canvas.height = 240;
        this.canvas.setAttribute("aria-hidden", "true");
        this.g = this.canvas.getContext("2d");
        this.buttons = document.createElement("nav");
        this.buttons.setAttribute("aria-label", "ゲームメニュー");
        this.panel.append(this.canvas, this.buttons);
        this.font.src = "assets/font.png";
        this.logo.src = "assets/title.png";
        this.portraits.src = "assets/minicars.png";
        // car_select_init: 136 samples, three simulation ticks per graph pixel.
        this.curves = HoverEngine.MACHINES.map((m) => [false, true].map((turbo) => {
            let inertia = 0, speed = 0;
            const values = [];
            for (let i = 0; i < 408; i++) {
                // car_select_init records the last value of each three-tick group.
                values[Math.floor(i / 3)] = (speed * 26) >> 8;
                speed = Math.floor(Math.abs(inertia * 2) / Math.sqrt(128));
                let thrust = (m.accel - ((m.falloff * speed) >> 6)) >> 2;
                if (turbo)
                    thrust += Math.max(0, (m.turbo - ((m.turboFall * speed) >> 4)) >> 2);
                if (speed <= 2000)
                    inertia += Math.trunc((thrust * 128) / m.weight);
                const drag = Math.trunc((speed * m.drag) / (m.weight * (speed + 1)));
                inertia -= (inertia * drag) >> 13;
            }
            values[159] = Math.floor(speed / 2);
            return values;
        }));
        this.show("title");
    }
    beginIntro() {
        this.introFrames = 120;
        this.buttons.inert = true;
    }
    tick(keys = {}) {
        if (this.screen === "record-detail")
            this.recordFrames = (this.recordFrames + 1) % 1320;
        if (this.screen === "card")
            this.card?.tick(keys, this.padHeld);
        if (this.screen === "help") {
            const held = (code) => !!keys[code] || this.padHeld.has(code);
            this.help.tick(+held("ArrowDown") - +held("ArrowUp"), held("KeyZ") || held("Space"));
        }
        if (this.introFrames > 0 && --this.introFrames === 0) {
            this.buttons.inert = false;
        }
    }
    show(screen, selected = 0) {
        this.recordFrames = 0;
        this.introFrames = 0;
        this.buttons.inert = false;
        lists.slots =
            HoverRules.unlocks() & 1
                ? ["SLOT 1", "SLOT 2", "ENDING"]
                : ["SLOT 1", "SLOT 2"];
        lists.gp = ["Blue GP", "Yellow GP", "Red GP"]
            .slice(0, HoverRules.availableCups())
            .concat("PRACTICE");
        this.screen = screen;
        this.selected = selected;
        this.entered = performance.now();
        this.panel.dataset.screen = screen;
        this.buttons.replaceChildren();
        if (screen === "card")
            this.card?.buttons();
        else if (screen === "help") {
            if (this.help.page === "book") {
                this.button("上へスクロール", 296, 0, 24, 100, () => this.help.move(-1));
                this.button("下へスクロール", 296, 140, 24, 100, () => this.help.move(1));
            }
            else
                this.help.items.forEach((label, i) => this.button(label, 32, 40 + i * 24, 280, 16, () => {
                    this.help.selected = i;
                    this.help.confirm();
                }, i));
        }
        else if (lists[screen])
            lists[screen].forEach((label, i) => {
                const count = lists[screen].length;
                const y = count === 2
                    ? 140 + i * 32
                    : count === 3
                        ? 124 + i * 32
                        : 124 + i * 24;
                this.button(label, 160 - label.length * 8, y, label.length * 16, 16, () => {
                    this.selected = i;
                    this.confirm();
                }, i);
            });
        this.syncSelection();
        this.draw();
    }
    button(label, x, y, w, h, click, index) {
        const b = document.createElement("button");
        b.textContent = label;
        b.setAttribute("aria-label", label);
        b.style.cssText = `left:${x / 3.2}%;top:${y / 2.4}%;width:${w / 3.2}%;height:${h / 2.4}%`;
        b.onclick = click;
        if (index !== undefined)
            b.dataset.index = String(index);
        this.buttons.append(b);
    }
    syncSelection() {
        this.buttons
            .querySelectorAll("[data-index]")
            .forEach((b) => b.setAttribute("aria-current", String(+b.dataset.index === this.selected)));
    }
    move(delta) {
        if (this.screen === "card") {
            if (this.card?.cursor !== null)
                this.card?.horizontal(delta);
            else
                this.card?.move(delta);
            return;
        }
        if (this.introFrames)
            return;
        if (this.screen === "help") {
            this.help.move(delta);
            this.selected = this.help.selected;
            this.syncSelection();
            if (this.help.page !== "book")
                this.hooks.sound("move");
            return;
        }
        this.hooks.sound("move");
        if (lists[this.screen])
            this.selected = Math.max(0, Math.min(lists[this.screen].length - 1, this.selected + delta));
        else if (this.screen === "car")
            this.hooks.change("machine", delta);
        else if (this.screen === "course")
            this.hooks.change("course", delta);
        else if (this.screen === "training") {
            const i = field("course").selectedIndex;
            if (i + delta >= 0 && i + delta < 5)
                this.hooks.change("course", delta);
        }
        else if (this.screen === "records")
            this.selected = Math.max(0, Math.min(8, this.selected + delta));
        else if (this.screen === "music")
            this.selected =
                (this.selected + delta + this.songs.length) % this.songs.length;
        this.syncSelection();
    }
    get songs() {
        return [
            "SAMPLE16",
            "SAMPLE15",
            "HOVER4",
            "TO7",
            "ENTRY1",
            "SELECT",
            "SAMPLE19",
            "HOVER2",
            "CANION",
            "B",
            "SAMPLE26",
            "SAMPLE21",
        ];
    }
    get songNames() {
        return [
            "Mysterious Wave",
            "Laser Wind",
            "A North Breeze",
            "Freezing Moment",
            "Rest On Space",
            "E.O.E.",
            "Groove On Night",
            "Drop To The Sky",
            "Dead Heat",
            "ON!",
            "Help Mode",
            "NoTitle -UnUsed-",
        ];
    }
    choose(mode) {
        this.mode = mode;
        this.hooks.mode(mode);
        this.hooks.music("SELECT");
        this.show(mode.startsWith("train") ? "training" : "car");
    }
    message(text, from = this.screen) {
        this.notice = text;
        this.noticeParent = from;
        this.noticeSelection = this.selected;
        this.show("notice");
    }
    confirm() {
        if (this.screen === "card") {
            this.card?.confirm();
            return;
        }
        if (this.introFrames ||
            (this.screen === "help" && this.help.page === "book"))
            return;
        this.hooks.sound("ok");
        const i = this.selected;
        switch (this.screen) {
            case "title":
                if (i < 3) {
                    this.show(["modes", "option", "help"][i]);
                    if (i === 2) {
                        this.help.reset();
                        this.show("help");
                        this.hooks.music("SAMPLE26");
                    }
                }
                else
                    this.hooks.exit();
                break;
            case "modes":
                if (i === 0)
                    this.show("gp");
                if (i === 1)
                    this.choose("time");
                if (i === 2)
                    this.show("levels");
                if (i === 3)
                    this.message("2P BATTLE\n画面分割対戦は未対応です。", "modes");
                break;
            case "gp":
                this.choose(i === HoverRules.availableCups() ? "practice" : "gp" + i);
                break;
            case "levels":
                this.choose(i === 3 ? "free" : "train" + i);
                break;
            case "option":
                if (i === 0)
                    this.show("slots");
                if (i === 1)
                    this.show("record-kind");
                if (i === 2)
                    this.hooks.replay();
                if (i === 3)
                    this.show("music");
                break;
            case "slots":
                if (i === 2) {
                    this.hooks.ending();
                    break;
                }
                this.hooks.card(i);
                break;
            case "record-kind":
                this.recordClass = i === 0 ? "gp" : "time";
                this.show("records");
                break;
            case "training":
                this.show("car");
                break;
            case "car":
                if (this.mode.startsWith("gp") || this.mode.startsWith("train"))
                    this.hooks.start();
                else
                    this.show("course");
                break;
            case "course":
                this.hooks.start();
                break;
            case "music":
                this.hooks.music(this.songs[i]);
                break;
            case "notice":
                this.show(this.noticeParent, this.noticeSelection);
                break;
            case "help":
                this.help.confirm();
                break;
            case "records":
                this.recordCourse = this.selected;
                this.show("record-detail");
                break;
            case "record-detail":
                this.recordFrames = this.recordFrames < 660 ? 690 : 0;
                break;
        }
    }
    back() {
        if (this.screen === "card") {
            this.card?.back();
            return;
        }
        if (this.introFrames)
            return;
        this.hooks.sound("cancel");
        if (this.screen === "help") {
            this.help.back();
            return;
        }
        if (this.screen === "course")
            this.show("car");
        else if (this.screen === "car") {
            if (this.mode.startsWith("train"))
                this.show("training");
            else {
                this.hooks.save?.();
                this.hooks.music(null);
                this.show(this.mode.startsWith("gp") || this.mode === "practice"
                    ? "gp"
                    : this.mode === "free"
                        ? "levels"
                        : "modes", this.mode.startsWith("gp")
                    ? +this.mode.slice(2)
                    : this.mode === "practice"
                        ? HoverRules.availableCups()
                        : this.mode === "free"
                            ? 3
                            : 1);
            }
        }
        else if (this.screen === "record-detail")
            this.show("records", this.recordCourse);
        else if (this.screen === "notice")
            this.show(this.noticeParent, this.noticeSelection);
        else if (parent[this.screen]) {
            if (this.screen === "training")
                this.hooks.trainingDone?.();
            if (this.screen === "training" || this.screen === "music")
                this.hooks.music(null);
            const [screen, i] = parent[this.screen];
            this.show(screen, this.screen === "training"
                ? +this.mode.slice(5)
                : this.screen === "records"
                    ? +(this.recordClass === "time")
                    : i);
        }
    }
    key(code) {
        if (this.screen === "card") {
            this.card?.key(code);
            return;
        }
        if (this.introFrames) {
            if (code === "Enter") {
                this.introFrames = 1;
                this.tick();
            }
            return;
        }
        if (this.screen === "help" && ["ArrowLeft", "ArrowRight"].includes(code))
            return;
        if (this.screen === "help" &&
            this.help.page === "book" &&
            [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "KeyZ",
                "Space",
            ].includes(code))
            return;
        if (["ArrowUp", "ArrowLeft"].includes(code))
            this.move(-1);
        else if (["ArrowDown", "ArrowRight"].includes(code))
            this.move(1);
        else if (["Enter", "Space", "KeyZ"].includes(code))
            this.confirm();
        else if (["Escape", "Backspace", "KeyX"].includes(code))
            this.back();
    }
    gamepad(dispatch = true) {
        const p = Array.from(navigator.getGamepads?.() || []).find(Boolean);
        const active = new Set();
        if (p) {
            if (p.buttons[12]?.pressed || p.axes[1] < -0.5)
                active.add("ArrowUp");
            if (p.buttons[13]?.pressed || p.axes[1] > 0.5)
                active.add("ArrowDown");
            if (p.buttons[14]?.pressed || p.axes[0] < -0.5)
                active.add("ArrowLeft");
            if (p.buttons[15]?.pressed || p.axes[0] > 0.5)
                active.add("ArrowRight");
            if (p.buttons[0]?.pressed)
                active.add("Enter");
            if (p.buttons[9]?.pressed)
                active.add(this.screen === "card" ? "KeyP" : "Enter");
            if (p.buttons[1]?.pressed)
                active.add("Escape");
            if (p.buttons[2]?.pressed &&
                this.screen === "help" &&
                this.help.page === "book")
                active.add("KeyZ");
        }
        for (const code of active)
            if (dispatch && !this.padHeld.has(code))
                this.key(code);
        this.padHeld = active;
    }
    text(text, x, y, size = 8, color = "white") {
        if (!this.font.complete || !this.font.naturalWidth)
            return;
        let image = this.palettes.get(color);
        if (!image) {
            image = document.createElement("canvas");
            image.width = 256;
            image.height = 128;
            const ctx = image.getContext("2d");
            ctx.drawImage(this.font, 0, 0);
            if (color !== "white") {
                ctx.globalCompositeOperation = "multiply";
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, 256, 128);
                ctx.globalCompositeOperation = "destination-in";
                ctx.drawImage(this.font, 0, 0);
            }
            this.palettes.set(color, image);
        }
        for (const c of text) {
            const t = (size === 16 ? c.toUpperCase() : c).charCodeAt(0) - 32;
            if (t >= 0 && t < 96)
                this.g.drawImage(image, size === 8 ? Math.floor(t / 16) * 8 : 128 + Math.floor(t / 8) * 16, size === 8 ? (t % 16) * 8 : (t % 8) * 16, size, size, Math.round(x), Math.round(y), size, size);
            x += size;
        }
    }
    time(t) {
        if (t === undefined)
            return "--'--\"--";
        const n = Math.floor((Math.round(t * 60) * 100) / 60);
        return `${String(Math.floor(n / 6000)).padStart(2, "0")}'${String(Math.floor(n / 100) % 60).padStart(2, "0")}"${String(n % 100).padStart(2, "0")}`;
    }
    courseName(i) {
        return `${Math.floor(i / 3) + 1}-${(i % 3) + 1} ${HOVER_TRACKS[i].name.replace("’", "'")}`;
    }
    draw() {
        const g = this.g;
        g.clearRect(0, 0, 320, 240);
        g.imageSmoothingEnabled = false;
        const list = lists[this.screen];
        if (this.screen === "card")
            this.card?.draw();
        else if (list) {
            if (this.logo.complete && this.logo.naturalWidth) {
                const offset = Math.max(0, this.introFrames - 60) * 8;
                g.drawImage(this.logo, 0, 0, 256, 51, 40 - offset, 8 + (offset * 50) / 116, 256, 51);
                g.drawImage(this.logo, 0, 78, 256, 50, 40 + offset, 58 - (offset * 50) / 116, 256, 50);
            }
            if (this.introFrames <= 60)
                list.forEach((label, i) => this.text(label, 160 - label.length * 8, list.length === 2
                    ? 140 + i * 32
                    : list.length === 3
                        ? 124 + i * 32
                        : 124 + i * 24, 16, i === this.selected ? "#00ff00" : "white"));
            if (this.introFrames <= 60) {
                this.text("Copyright (C) 1997 Sato Tomokazu", 40, 224);
                if (this.introFrames > 0) {
                    g.fillStyle = `rgba(0,0,0,${this.introFrames / 60})`;
                    g.fillRect(0, 0, 320, 240);
                }
            }
        }
        else if (this.screen === "car") {
            const type = +field("machine").value, m = HoverEngine.MACHINES[type];
            this.text(m.name[0] + m.name.slice(1).toLowerCase(), 16, 56, 16);
            const labels = [
                "Booster",
                "Slaster",
                "Radder",
                "Resistance",
                "Turbo",
                "Weight",
                "Power",
            ];
            const props = HoverEngine.MACHINES.slice(0, HoverRules.machineCount()).map((m) => [
                m.accel - m.falloff * 8,
                m.side,
                m.rudder ? m.rotation + 227 / m.rudder : 0,
                m.drag,
                m.turbo - m.turboFall * 4,
                m.weight,
                m.tank,
            ]);
            labels.forEach((label, i) => {
                g.fillStyle = "#000080";
                g.fillRect(176, 152 + i * 12, (152 * props[type][i]) / Math.max(...props.map((p) => p[i])), 8);
                this.text(label, 176, 152 + i * 12);
            });
            this.curves[type].forEach((curve, j) => {
                g.strokeStyle = j ? "red" : "white";
                g.beginPath();
                curve
                    .slice(0, 136)
                    .forEach((v, i) => i ? g.lineTo(176 + i, 136 - v) : g.moveTo(176 + i, 136 - v));
                g.stroke();
            });
            this.text("MAX SPEED", 208, 112);
            this.text("MAX TURBO", 208, 132);
            this.text(Math.round(this.curves[type][0][159]) + "Km/h", 256, 122);
            this.text(Math.round(this.curves[type][1][159]) + "Km/h", 256, 142);
        }
        else if (this.screen === "course") {
            const course = +field("course").value;
            this.text(this.courseName(course), 16, 56, 16);
            ["lap", "total"].forEach((kind, i) => {
                const row = HoverRecords.read(this.mode === "time" ? "time" : "gp", course, kind)[0];
                this.text(i ? "TOTAL RECORD" : "BESTLAP RECORD", 8 + i * 176, 192);
                this.text(this.time(row?.time) + " " + (row?.name || "---"), 32 + i * 176, 204);
                if (row)
                    this.text(HoverEngine.MACHINES[row.machine].name, 32 + i * 176, 216);
            });
        }
        else if (this.screen === "training") {
            const task = HoverTraining.tasks[+field("course").value];
            this.text("TRAINING MODE", 16, 16, 16, "#ff00ff");
            this.jp(`${Math.floor(task.id / 5) + 1}-${(task.id % 5) + 1}`, 16, 56, 16);
            this.jp(task.description, 32, 80);
            this.jp(`制限時間 ${task.limit} 秒`, 160, 152);
            const marks = HoverTraining.loadMarks()[task.id];
            HoverEngine.MACHINES.forEach((m, i) => {
                if (marks & (1 << i))
                    this.text(m.name, 16 + (i % 3) * 104, 184 + Math.floor(i / 3) * 16);
            });
        }
        else if (this.screen === "records") {
            this.text("BEST RECORDS", 8, 0, 16, "red");
            HOVER_TRACKS.forEach((_, i) => {
                const row = HoverRecords.read(this.recordClass, i, "lap")[0];
                this.text(this.courseName(i), 16, 24 + i * 24, 8, i === this.selected ? "#00ff00" : "white");
                const total = HoverRecords.read(this.recordClass, i, "total")[0];
                // OTR_MODE.C view_records: draw_minicar(..., 2048) halves the
                // 24x16 portrait beside each course's BEST LAP and TOTAL record.
                [row, total].forEach((record, line) => {
                    const y = 24 + i * 24 + line * 10;
                    this.text(`${this.time(record?.time)} ${record?.name || "---"}`, 184, y, 8, i === this.selected ? "#00ff00" : "white");
                    if (record && this.portraits.complete && this.portraits.naturalWidth)
                        g.drawImage(this.portraits, 0, record.machine * 16, 24, 16, 160, y, 12, 8);
                });
            });
        }
        else if (this.screen === "record-detail") {
            // OTR_MODE.C view_records2: alternate BESTLAP and TOTAL over a live
            // four-car course view, including DRAW_SP.C's original 24x16 portraits.
            const frame = this.recordFrames;
            const kind = frame < 660 ? "lap" : "total";
            if ((frame >= 60 && frame < 660) || frame >= 720) {
                this.text(kind === "lap" ? "BESTLAP RECORDS" : "TOTAL RECORDS", 8, 16, 16);
                const rows = HoverRecords.read(this.recordClass, this.recordCourse, kind);
                for (let i = 0; i < 6; i++) {
                    this.text(`${this.time(rows[i]?.time)} ${rows[i]?.name || "---"}`, 80, 48 + i * 32, 16);
                    if (rows[i] && this.portraits.complete && this.portraits.naturalWidth)
                        g.drawImage(this.portraits, 0, rows[i].machine * 16, 24, 16, 40, 48 + i * 32, 24, 16);
                }
            }
        }
        else if (this.screen === "music") {
            this.text("MUSIC MODE", 8, 8, 16, "blue");
            this.songNames.forEach((s, i) => this.text(s, 32, 32 + i * 17, 16, i === this.selected ? "#00ff00" : "white"));
        }
        else if (this.screen === "help") {
            this.help.draw(g, (text, x, y, color) => this.text(text, x, y, 8, color));
        }
        else if (this.screen === "notice")
            this.jp(this.notice, 16, 32);
        this.panel.setAttribute("aria-label", `${this.screen}: ${this.screen === "card" ? this.card?.label : list?.[this.selected] || (this.screen === "car" ? field("machine").selectedOptions[0]?.text : this.screen === "training" ? HoverTraining.tasks[+field("course").value].description : this.screen === "notice" ? this.notice : this.screen === "help" ? (this.help.page === "book" ? `${this.help.book} ${this.help.scroll}/${this.help.maxScroll}\n${this.help.description}` : this.help.items[this.help.selected]) : "選択画面")}`);
    }
    jp(text, x, y, size = 12) {
        this.g.fillStyle = "white";
        this.g.font = `${size}px monospace`;
        this.g.textBaseline = "top";
        let line = 0, col = 0;
        for (const ch of text) {
            if (ch === "\n" || col * size > 288 - x) {
                line++;
                col = 0;
                if (ch === "\n")
                    continue;
            }
            this.g.fillText(ch, x + col * size, y + line * (size + 6));
            col += ch.charCodeAt(0) > 255 ? 1 : 0.6;
        }
    }
}
