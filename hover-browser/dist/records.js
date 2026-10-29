"use strict";
// Source: src/records.ts. Build with npm run build; do not edit dist/records.js directly.
/* Six entries per course and TimeMode, as BESTLAP records in the original. */
var HoverRecords;
(function (HoverRecords) {
    function key(category, course, kind) {
        return `hover-records-${category}-${course}-${kind}`;
    }
    HoverRecords.key = key;
    function read(category, course, kind) {
        if (!category)
            return [];
        try {
            const data = JSON.parse(localStorage.getItem(key(category, course, kind)) || "[]");
            return Array.isArray(data)
                ? data
                    .filter((x) => Number.isFinite(x.time) &&
                    x.time > 0 &&
                    Number.isInteger(x.machine))
                    .sort((a, b) => a.time - b.time)
                    .slice(0, 6)
                : [];
        }
        catch {
            return [];
        }
    }
    HoverRecords.read = read;
    function save(category, course, kind, time, machine) {
        if (!category || !Number.isFinite(time) || time <= 0)
            return;
        const rows = read(category, course, kind);
        rows.push({ time, machine });
        rows.sort((a, b) => a.time - b.time);
        try {
            localStorage.setItem(key(category, course, kind), JSON.stringify(rows.slice(0, 6)));
        }
        catch { }
    }
    HoverRecords.save = save;
})(HoverRecords || (HoverRecords = {}));
Object.assign(typeof window !== "undefined" ? window : globalThis, {
    HoverRecords,
});
if (typeof module !== "undefined")
    module.exports = HoverRecords;
