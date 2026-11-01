// OPTIONS volume row shared by the title and pause menus.
export const VOLUME_STEPS = 10;

export const volumeLabel = (level: number) => `VOLUME: ${level}`;

export const clampVolume = (level: number) =>
  Math.max(0, Math.min(VOLUME_STEPS, Math.round(level)));

// Shows "VOLUME ◀ ■■■■□ 8 ▶". The arrows step the level for mouse and touch;
// clicking elsewhere on the row is handled by the menu's own confirm.
export function decorateVolumeButton(
  button: HTMLButtonElement,
  level: number,
  adjust: (delta: number) => void,
) {
  button.classList.add("volume-option");
  const arrow = (delta: number) => {
    const a = document.createElement("span");
    a.className = "volume-arrow";
    a.textContent = delta < 0 ? "◀" : "▶";
    a.setAttribute("aria-hidden", "true");
    a.dataset.disabled = String(
      delta < 0 ? level === 0 : level === VOLUME_STEPS,
    );
    a.onclick = (event) => {
      event.stopPropagation();
      adjust(delta);
    };
    return a;
  };
  const name = document.createElement("span");
  name.className = "volume-name";
  name.textContent = "VOLUME";
  const meter = document.createElement("span");
  meter.className = "volume-meter";
  meter.setAttribute("aria-hidden", "true");
  for (let i = 0; i < VOLUME_STEPS; i++) {
    const cell = document.createElement("i");
    if (i < level) cell.dataset.on = "";
    meter.append(cell);
  }
  const value = document.createElement("span");
  value.className = "volume-value";
  value.textContent = String(level);
  button.replaceChildren(name, arrow(-1), meter, value, arrow(1));
}
