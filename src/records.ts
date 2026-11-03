// Source: src/records.ts. Build with npm run build; do not edit dist/records.js directly.
/* Six entries per course and TimeMode, as BESTLAP records in the original. */
namespace HoverRecords {
  let stateStorage: Pick<Storage, "getItem" | "setItem"> | null = null;
  export function useStorage(value: Pick<Storage, "getItem" | "setItem">) {
    stateStorage = value;
  }

  export function key(
    category: string | null,
    course: string | number,
    kind: string,
  ) {
    return `hover-records-${category}-${course}-${kind}`;
  }
  export function read(
    category: string | null,
    course: string | number,
    kind: string,
  ): { time: number; machine: number }[] {
    if (!category) return [];
    try {
      const data = JSON.parse(
        (stateStorage || localStorage).getItem(key(category, course, kind)) ||
          "[]",
      );
      return Array.isArray(data)
        ? data
            .filter(
              (x) =>
                Number.isFinite(x.time) &&
                x.time > 0 &&
                Number.isInteger(x.machine),
            )
            .sort((a, b) => a.time - b.time)
            .slice(0, 6)
        : [];
    } catch {
      return [];
    }
  }
  export function save(
    category: string | null,
    course: string | number,
    kind: string,
    time: number,
    machine: number,
  ) {
    if (!category || !Number.isFinite(time) || time <= 0) return;
    const rows = read(category, course, kind);
    rows.push({ time, machine });
    rows.sort((a, b) => a.time - b.time);
    try {
      (stateStorage || localStorage).setItem(
        key(category, course, kind),
        JSON.stringify(rows.slice(0, 6)),
      );
    } catch {}
  }
}
Object.assign(typeof window !== "undefined" ? window : globalThis, {
  HoverRecords,
});
if (typeof module !== "undefined") module.exports = HoverRecords;
