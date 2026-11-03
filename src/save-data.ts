// One browser save for progress, records and settings. Replays stay in memory.
export const SAVE_KEY = "hover-autosave-v2";

function defaults() {
  const values = new Map<string, string>([
    ["hover-unlocks", "0"],
    ["hover-volume", "10"],
  ]);
  for (const category of ["gp", "time"])
    for (let course = 0; course < 9; course++) {
      values.set(`hover-v3-record-${category}-${course}`, "600");
      for (const kind of ["lap", "total"])
        values.set(`hover-records-${category}-${course}-${kind}`, "[]");
    }
  return values;
}

function validValue(key: string, value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (key === "hover-unlocks") return /^[0-7]$/.test(value);
  if (key === "hover-volume") return /^(10|[0-9])$/.test(value);
  if (/^hover-v3-record-(gp|time)-[0-8]$/.test(key))
    return Number.isFinite(Number(value)) && Number(value) > 0;
  try {
    const data = JSON.parse(value);
    if (/^hover-records-(gp|time)-[0-8]-(lap|total)$/.test(key))
      return (
        Array.isArray(data) &&
        data.length <= 6 &&
        data.every(
          (row) =>
            row &&
            Number.isFinite(row.time) &&
            row.time > 0 &&
            Number.isInteger(row.machine) &&
            row.machine >= 0 &&
            row.machine < 5 &&
            (row.name === undefined ||
              (typeof row.name === "string" && row.name.length <= 3)),
        )
      );
  } catch {}
  return false;
}

export class SaveStore implements Storage {
  private data = defaults();
  saveError = false;

  constructor(private storage: Pick<Storage, "getItem" | "setItem">) {
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (
        saved?.version !== 2 ||
        !saved.values ||
        typeof saved.values !== "object" ||
        Array.isArray(saved.values)
      )
        return;
      // Older saves carry the removed GAME LEVEL setting and record name.
      const entries = Object.entries(saved.values).filter(
        ([key]) =>
          key !== "hover-cpu-difficulty" && key !== "hover-player-name",
      );
      if (!entries.every(([key, value]) => validValue(key, value))) return;
      for (const [key, value] of entries)
        if (typeof value === "string") {
          // Old saves persisted the six initial ten-minute placeholder rows.
          // Recognize the complete template, never a time value on its own.
          if (/^hover-records-(gp|time)-[0-8]-(lap|total)$/.test(key)) {
            const rows = JSON.parse(value);
            const names = ["SAT", "UME", "BEE", "UZU", "MAS", "ZZZ"];
            if (
              rows.length === names.length &&
              rows.every(
                (
                  row: { time: number; machine: number; name?: string },
                  i: number,
                ) =>
                  row.time === 600 &&
                  row.machine === i % 4 &&
                  row.name === names[i],
              )
            ) {
              this.data.set(key, "[]");
              continue;
            }
          }
          this.data.set(key, value);
        }
    } catch {
      // Storage may be disabled or corrupt. The game still works in memory.
    }
  }
  get length() {
    return this.data.size;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  setItem(key: string, value: string) {
    const text = String(value);
    if (!validValue(key, text)) return;
    if (this.data.get(key) === text && !this.saveError) return;
    this.data.set(key, text);
    this.persist();
  }
  removeItem(key: string) {
    if (this.data.delete(key)) this.persist();
  }
  clear() {
    this.data = defaults();
    this.persist();
  }
  private persist() {
    try {
      this.storage.setItem(
        SAVE_KEY,
        JSON.stringify({ version: 2, values: Object.fromEntries(this.data) }),
      );
      this.saveError = false;
    } catch {
      this.saveError = true;
    }
  }
}
