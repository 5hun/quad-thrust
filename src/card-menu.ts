// MEMORY_C.C memory_card / replay_file / error_message.
import type { OriginalMenu } from "./menu.js";
import { MemoryCards, SessionStore, type SystemSave } from "./card-data.js";
import type { ReplayTape } from "./input-replay.js";
const ITEMS = [
  "SAVE SYSTEM DATA",
  "LOAD SYSTEM DATA",
  "AUTO SAVE",
  "AUTO LOAD",
  "GAME LEVEL",
  "SAVE REPLAY DATA",
  "LOAD REPLAY DATA",
  "DELETE REPLAY DATA",
  "LOAD SPECIAL REPLAY",
];
const LEVELS = ["EASY", "NORMAL", "HARD", "EXPART"];
export const REPLAY_NAME_CHARACTERS =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.-+/&?!()";
interface CardHooks {
  capture(): SystemSave;
  apply(data: SystemSave, slot: number): void;
  replay(): ReplayTape | null;
  loadReplay(tape: ReplayTape): void;
  settings(slot: number): void;
}
export class CardMenu {
  slot = 0;
  page: "system" | "replays" = "system";
  selected = 0;
  action = 0;
  cursor: number | null = null;
  frame = 0;
  error = "";
  errorFrames = 0;
  busy = 0;
  busyText = "";
  name = Array(14).fill(" ");
  player = Array(7).fill(" ");
  special: (ReplayTape | null)[] = [null, null, null];
  private pending: (() => void) | null = null;
  private held = "";
  private heldFrames = 0;
  constructor(
    public font: OriginalMenu,
    public cards: MemoryCards,
    public session: SessionStore,
    public hooks: CardHooks,
  ) {}
  get system() {
    return this.session.snapshot();
  }
  get items() {
    return ITEMS.slice(0, this.system.unlocks & 2 ? 9 : 8);
  }
  get files() {
    return this.action === 8
      ? this.special
      : this.cards.read(this.slot)?.replays || [null, null, null];
  }
  get label() {
    return this.errorFrames
      ? this.error
      : this.busy
        ? this.busyText
        : this.page === "system"
          ? ITEMS[this.selected]
          : this.cursor !== null
            ? `REPLAY NAME ${this.cursor + 1}/21`
            : `${ITEMS[this.action]} ${this.selected + 1}/3`;
  }
  open(slot: number) {
    this.slot = slot;
    this.page = "system";
    this.selected = 0;
    this.errorFrames = 0;
    this.busy = 0;
    this.cursor = null;
    this.changed();
  }
  changed() {
    this.font.show("card", this.selected);
  }
  fail(message: string) {
    this.error = message;
    this.errorFrames = 120;
    this.changed();
  }
  perform(message: string, job: () => void, selection: number) {
    try {
      job();
      this.busyText = message;
      this.busy = 2;
      this.pending = () => {
        this.page = "system";
        this.cursor = null;
        this.selected = selection;
        this.changed();
      };
      this.changed();
    } catch (error) {
      this.fail(
        error instanceof Error ? error.message : "カードに保存できません",
      );
    }
  }
  move(delta: number) {
    if (this.errorFrames || this.busy) return;
    if (this.cursor !== null) {
      this.edit(delta);
      return;
    }
    this.selected = Math.max(
      0,
      Math.min(
        (this.page === "system" ? this.items.length : 3) - 1,
        this.selected + delta,
      ),
    );
    this.font.selected = this.selected;
    this.font.syncSelection();
  }
  horizontal(delta: number) {
    if (this.errorFrames || this.busy) return;
    if (this.cursor !== null) {
      if (this.cursor + delta >= 21) {
        this.cursor = null;
        this.selected = 0;
        this.changed();
      } else this.cursor = Math.max(0, this.cursor + delta);
      return;
    }
    if (this.page !== "system") return;
    const system = this.system;
    if (this.selected === 2 || this.selected === 3)
      this.session.setItem(
        "hover-auto-load-save",
        String(system.auto ^ (1 << (3 - this.selected))),
      );
    if (this.selected === 4)
      this.session.setItem(
        "hover-cpu-difficulty",
        String(Math.max(0, Math.min(3, system.level + 1 + delta))),
      );
    this.hooks.settings(this.slot);
  }
  edit(delta: number) {
    if (this.cursor === null) return;
    const field = this.cursor < 14 ? this.name : this.player,
      index = this.cursor < 14 ? this.cursor : this.cursor - 14;
    const old = Math.max(0, REPLAY_NAME_CHARACTERS.indexOf(field[index]));
    field[index] =
      REPLAY_NAME_CHARACTERS[
        (old + delta + REPLAY_NAME_CHARACTERS.length) %
          REPLAY_NAME_CHARACTERS.length
      ];
  }
  start() {
    if (
      this.page === "replays" &&
      this.cursor !== null &&
      !this.errorFrames &&
      !this.busy
    ) {
      this.cursor = null;
      this.selected = 0;
      this.changed();
    }
  }
  confirm() {
    if (this.errorFrames || this.busy || this.cursor !== null) return;
    if (this.page === "system") {
      if (this.selected === 0) {
        this.perform(
          "NOW SAVING",
          () => this.cards.saveSystem(this.slot, this.hooks.capture()),
          0,
        );
        return;
      }
      if (this.selected === 1) {
        this.perform(
          "NOW LOADING",
          () => {
            const card = this.cards.read(this.slot);
            if (!card) throw Error("データがありません");
            this.hooks.apply(card.system, this.slot);
          },
          1,
        );
        return;
      }
      if (this.selected >= 5) {
        this.action = this.selected;
        if (this.action === 5 && !this.hooks.replay()) {
          this.fail("リプレイデータがありません");
          return;
        }
        try {
          if (
            this.action !== 5 &&
            this.action !== 8 &&
            !this.cards.read(this.slot)
          ) {
            this.fail("データがありません");
            return;
          }
          void this.files;
        } catch (error) {
          this.fail((error as Error).message);
          return;
        }
        this.page = "replays";
        this.selected = 0;
        if (this.action === 5) {
          const tape = this.hooks.replay()!;
          this.name = [...(tape.name || "").padEnd(14).slice(0, 14)];
          this.player = [...(tape.playerName || "").padEnd(7).slice(0, 7)];
          this.cursor = 0;
        }
        this.changed();
      }
    } else {
      if (this.action === 5) {
        const tape = this.hooks.replay();
        if (!tape) {
          this.fail("リプレイデータがありません");
          return;
        }
        const named = {
          ...tape,
          name: this.name.join("") + " ",
          playerName: this.player.join(""),
        };
        this.perform(
          "NOW SAVING",
          () => {
            this.cards.saveReplay(
              this.slot,
              this.selected,
              named,
              this.hooks.capture(),
            );
            tape.name = named.name;
            tape.playerName = named.playerName;
          },
          0,
        );
      } else {
        const tape = this.files[this.selected];
        if (!tape) return;
        if (this.action === 7)
          this.perform(
            "NOW DELETING",
            () => this.cards.deleteReplay(this.slot, this.selected),
            0,
          );
        else this.perform("NOW LOADING", () => this.hooks.loadReplay(tape), 0);
      }
    }
  }
  back() {
    if (this.errorFrames || this.busy) return;
    if (this.page === "replays") {
      this.page = "system";
      this.cursor = null;
      this.selected = this.action;
      this.changed();
    } else this.font.show("slots", this.slot);
  }
  key(code: string) {
    if (this.errorFrames || this.busy) return;
    if (["Escape", "KeyX", "Backspace"].includes(code)) {
      this.font.hooks.sound("cancel");
      this.back();
      return;
    }
    if (code === "KeyP") {
      if (this.cursor !== null) this.font.hooks.sound("ok");
      this.start();
      return;
    }
    if (["Enter", "KeyZ", "Space"].includes(code)) {
      this.font.hooks.sound("ok");
      this.confirm();
      return;
    }
    if (["ArrowUp", "ArrowDown"].includes(code)) {
      const before = this.selected,
        editing = this.cursor !== null;
      this.move(
        code === "ArrowUp"
          ? this.cursor === null
            ? -1
            : 1
          : this.cursor === null
            ? 1
            : -1,
      );
      if (!editing && before !== this.selected) this.font.hooks.sound("move");
    }
    if (["ArrowLeft", "ArrowRight"].includes(code)) {
      const editing = this.cursor !== null;
      const before = JSON.stringify([
        this.cursor,
        this.system.auto,
        this.system.level,
      ]);
      this.horizontal(code === "ArrowLeft" ? -1 : 1);
      if (
        !editing &&
        before !==
          JSON.stringify([this.cursor, this.system.auto, this.system.level])
      )
        this.font.hooks.sound("ok");
    }
  }
  tick(keys: Record<string, boolean>, pad: Set<string>) {
    ++this.frame;
    if (this.errorFrames) {
      if (--this.errorFrames === 0) this.changed();
      return;
    }
    if (this.busy) {
      if (--this.busy === 0) {
        const pending = this.pending;
        this.pending = null;
        pending?.();
      }
      return;
    }
    const held = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].filter(
      (code) => keys[code] || pad.has(code),
    );
    const code = held.length === 1 ? held[0] : "";
    if (code !== this.held) {
      this.held = code;
      this.heldFrames = 0;
    } else if (
      code &&
      this.cursor !== null &&
      ++this.heldFrames %
        (code === "ArrowUp" || code === "ArrowDown" ? 8 : 16) ===
        0
    )
      this.key(code);
  }
  buttons() {
    if (this.errorFrames || this.busy) return;
    if (this.page === "system") {
      this.items.forEach((label, i) =>
        this.font.button(
          label,
          16,
          32 + i * 24,
          128,
          16,
          () => {
            this.selected = i;
            if (i === 2 || i === 3) this.horizontal(1);
            else this.confirm();
          },
          i,
        ),
      );
      this.font.button("難易度を下げる", 144, 128, 64, 16, () => {
        this.selected = 4;
        this.horizontal(-1);
      });
      this.font.button("難易度を上げる", 208, 128, 80, 16, () => {
        this.selected = 4;
        this.horizontal(1);
      });
    } else {
      this.font.button("名前入力を終了 Start / P", 8, 16, 296, 16, () =>
        this.start(),
      );
      if (this.cursor === null)
        for (let i = 0; i < 3; i++)
          this.font.button(
            `REPLAY ${i + 1}`,
            16,
            48 + i * 40,
            288,
            36,
            () => {
              this.selected = i;
              this.confirm();
            },
            i,
          );
      else {
        this.font.button("文字を進める", 0, 64, 24, 48, () => this.edit(1));
        this.font.button("文字を戻す", 296, 64, 24, 48, () => this.edit(-1));
        this.font.button("次の文字", 296, 176, 24, 48, () =>
          this.horizontal(1),
        );
        this.font.button("前の文字", 0, 176, 24, 48, () => this.horizontal(-1));
      }
    }
  }
  tapeLines(tape: ReplayTape | null) {
    if (!tape) return ["NO REPLAY DATA", "", ""];
    const size = (tape.words.length * 2 + 127) & ~127;
    return [
      `${tape.gameMode === 4 ? "TimeAttack" : "GrandPrix "},SIZE ${String(size).padStart(4)},TIME ${this.font.time(tape.totalTicks / 60)}`,
      `NAME ${(tape.name || "").padStart(15)}, PLAYER ${(tape.playerName || "").padStart(7)}`,
      `CAR ${HoverEngine.MACHINES[tape.machine].name.padStart(5)}, COURCE ${HOVER_TRACKS[tape.course].name.padStart(16)}`,
    ];
  }
  draw() {
    const text = (s: string, x: number, y: number, size = 8, color = "white") =>
      this.font.text(s, x, y, size, color);
    if (this.errorFrames) {
      if (((120 - this.errorFrames) & 15) > 4)
        this.font.help.glyphs.draw(
          this.font.g,
          this.error,
          160 - [...this.error].length * 8,
          112,
        );
      return;
    }
    if (this.busy) {
      text(this.busyText, 160, 216);
      return;
    }
    if (this.page === "system") {
      const system = this.system;
      this.items.forEach((label, i) => {
        const color = i === this.selected ? "#00ff00" : "white",
          y = 32 + i * 24;
        text(label, 16, y, 8, color);
        if (i === 2 || i === 3)
          text(system.auto & (1 << (3 - i)) ? "ON " : "OFF", 144, y, 8, color);
        if (i === 4) text(LEVELS[system.level + 1], 144, y, 8, color);
      });
      return;
    }
    text(
      (this.action === 8 ? ITEMS[6] : ITEMS[this.action])
        .slice(0, 18)
        .padEnd(18),
      8,
      16,
      16,
      "#00ffff",
    );
    const files = this.files;
    files.forEach((tape, i) =>
      this.tapeLines(tape).forEach((line, j) =>
        text(
          line.padEnd(38).slice(0, 38),
          16,
          48 + i * 40 + j * 12,
          8,
          this.cursor === null && i === this.selected ? "#00ff00" : "white",
        ),
      ),
    );
    text("--------------------------------------", 8, 168);
    const current = this.hooks.replay(),
      info = this.tapeLines(current);
    if (this.action === 5)
      info[1] = `NAME ${this.name.join("")} , PLAYER ${this.player.join("")}`;
    info.forEach((line, i) =>
      text(line.padEnd(38).slice(0, 38), 16, 184 + i * 12),
    );
    if (this.action !== 8) {
      const used = files.reduce(
        (n, tape) => n + (tape ? (tape.words.length * 2 + 127) & ~127 : 0),
        0,
      );
      text(`LAST RAM SIZE ${String(6144 - used).padStart(4)}`, 160, 32);
    }
    if (this.cursor !== null && (this.frame & 31) > 16) {
      const col = this.cursor < 14 ? 5 + this.cursor : 29 + this.cursor - 14;
      text("_", 16 + col * 8, 196);
    }
  }
}
