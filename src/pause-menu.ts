// GAME.C pause(): the race stays frozen behind a list menu styled like the title.
import {
  VOLUME_STEPS,
  clampVolume,
  decorateVolumeButton,
  volumeLabel,
} from "./volume.js";
export type PauseScreen = "top" | "options" | "quit";
interface PauseHooks {
  resume(): void;
  restart(): void;
  quit(): void;
  // Quitting a Grand Prix discards the cup in progress.
  quitNeedsConfirm(): boolean;
  fullscreen(): boolean | null;
  toggleFullscreen(): void;
  soundEnabled(): boolean;
  toggleSound(): void;
  volume(): number;
  setVolume(level: number): void;
  sound(kind: "move" | "ok" | "cancel"): void;
}
const OPTIONS_VOLUME = 1;
const captions: Record<PauseScreen, string> = {
  top: "PAUSED",
  options: "OPTIONS",
  quit: "QUIT GRAND PRIX?",
};
export class PauseMenu {
  screen: PauseScreen = "top";
  selected = 0;
  panel: HTMLElement;
  caption: HTMLElement;
  note: HTMLElement;
  buttons: HTMLElement;
  backGuide: HTMLElement;
  constructor(public hooks: PauseHooks) {
    this.panel = document.getElementById("pause-panel")!;
    this.panel.replaceChildren();
    const layout = document.createElement("div");
    layout.className = "title-layout";
    this.caption = document.createElement("h2");
    this.caption.className = "menu-caption";
    this.note = document.createElement("p");
    this.note.className = "pause-note";
    this.note.textContent = "Your Grand Prix progress will be lost.";
    this.buttons = document.createElement("nav");
    this.buttons.setAttribute("aria-label", "ポーズメニュー");
    const guide = document.createElement("div");
    guide.className = "title-guide";
    guide.innerHTML =
      '<span><span class="guide-arrows">↑ ↓</span> SELECT</span><button type="button" class="guide-confirm"><kbd>ENTER</kbd> CONFIRM</button><button type="button" class="guide-back"><kbd>ESC</kbd> <span></span></button>';
    guide.querySelector<HTMLButtonElement>(".guide-confirm")!.onclick = () =>
      this.confirm();
    guide.querySelector<HTMLButtonElement>(".guide-back")!.onclick = () =>
      this.back();
    this.backGuide = guide.querySelector(".guide-back span")!;
    layout.append(this.caption, this.note, this.buttons, guide);
    this.panel.append(layout);
  }
  get labels() {
    if (this.screen === "quit") return ["YES", "NO"];
    if (this.screen === "options") {
      const fullscreen = this.hooks.fullscreen();
      return [
        `SOUND: ${this.hooks.soundEnabled() ? "ON" : "OFF"}`,
        volumeLabel(this.hooks.volume()),
        ...(fullscreen === null
          ? []
          : [`FULLSCREEN: ${fullscreen ? "ON" : "OFF"}`]),
      ];
    }
    return ["RESUME", "RESTART", "OPTIONS", "QUIT"];
  }
  open() {
    this.show("top");
  }
  show(screen: PauseScreen, selected = 0) {
    const restoreFocus = this.buttons.contains(document.activeElement);
    this.screen = screen;
    this.selected = selected;
    this.panel.dataset.screen = screen;
    this.caption.textContent = captions[screen];
    this.note.hidden = screen !== "quit";
    this.backGuide.textContent = screen === "top" ? "RESUME" : "BACK";
    this.buttons.replaceChildren();
    this.labels.forEach((label, i) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.setAttribute("aria-label", label);
      b.dataset.index = String(i);
      b.onfocus = () => {
        this.selected = i;
        this.syncSelection();
      };
      b.onclick = () => {
        this.selected = i;
        this.confirm();
      };
      if (screen === "options" && i === OPTIONS_VOLUME)
        decorateVolumeButton(b, this.hooks.volume(), (delta) => {
          this.selected = i;
          this.adjustVolume(delta);
        });
      this.buttons.append(b);
    });
    this.syncSelection();
    if (restoreFocus) this.focusSelection();
  }
  // Fullscreen can change from outside the menu (browser Esc, F11).
  refresh() {
    if (!this.panel.hidden) this.show(this.screen, this.selected);
  }
  syncSelection() {
    this.buttons
      .querySelectorAll<HTMLButtonElement>("[data-index]")
      .forEach((b) =>
        b.setAttribute(
          "aria-current",
          String(+b.dataset.index! === this.selected),
        ),
      );
  }
  focusSelection() {
    this.buttons
      .querySelector<HTMLButtonElement>(`[data-index="${this.selected}"]`)
      ?.focus({ preventScroll: true });
  }
  move(delta: number) {
    this.hooks.sound("move");
    this.selected = Math.max(
      0,
      Math.min(this.labels.length - 1, this.selected + delta),
    );
    this.syncSelection();
    if (this.buttons.contains(document.activeElement)) this.focusSelection();
  }
  confirm() {
    this.hooks.sound("ok");
    const i = this.selected;
    switch (this.screen) {
      case "top":
        if (i === 0) this.hooks.resume();
        if (i === 1) this.hooks.restart();
        if (i === 2) this.show("options");
        if (i === 3) {
          if (this.hooks.quitNeedsConfirm()) this.show("quit", 1);
          else this.hooks.quit();
        }
        break;
      case "options":
        if (i === 0) {
          this.hooks.toggleSound();
          this.show("options", i);
        }
        if (i === OPTIONS_VOLUME)
          this.setVolume(
            this.hooks.volume() === VOLUME_STEPS ? 0 : this.hooks.volume() + 1,
          );
        if (i === 2) this.hooks.toggleFullscreen();
        break;
      case "quit":
        if (i === 0) this.hooks.quit();
        else this.show("top", 3);
        break;
    }
  }
  back() {
    this.hooks.sound("cancel");
    if (this.screen === "top") this.hooks.resume();
    else this.show("top", this.screen === "options" ? 2 : 3);
  }
  adjustVolume(delta: number) {
    const level = clampVolume(this.hooks.volume() + delta);
    if (level === this.hooks.volume()) return;
    this.setVolume(level);
    // The cursor sound previews the new level.
    this.hooks.sound("move");
  }
  setVolume(level: number) {
    this.hooks.setVolume(level);
    this.show("options", OPTIONS_VOLUME);
  }
  key(code: string) {
    if (
      this.screen === "options" &&
      this.selected === OPTIONS_VOLUME &&
      ["ArrowLeft", "ArrowRight"].includes(code)
    )
      this.adjustVolume(code === "ArrowLeft" ? -1 : 1);
    else if (["ArrowUp", "ArrowLeft"].includes(code)) this.move(-1);
    else if (["ArrowDown", "ArrowRight"].includes(code)) this.move(1);
    else if (["Enter", "KeyZ"].includes(code)) this.confirm();
    else if (["Escape", "Backspace", "KeyX"].includes(code)) this.back();
    else if (code === "KeyP") this.hooks.resume();
  }
}
