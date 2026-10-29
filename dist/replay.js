// Timestamped 10 Hz recordings are sampled at the display/update rate.
export function sampleReplay(frames, seconds, type) {
    if (!frames.length)
        return null;
    const first = frames[0], last = frames[frames.length - 1];
    const duration = last[0] - first[0];
    const time = duration > 0
        ? first[0] + (((seconds % duration) + duration) % duration)
        : first[0];
    let low = 0, high = frames.length - 1;
    while (low + 1 < high) {
        const mid = (low + high) >> 1;
        if (frames[mid][0] <= time)
            low = mid;
        else
            high = mid;
    }
    const a = frames[low], b = frames[high];
    const fraction = b[0] > a[0] ? Math.max(0, Math.min(1, (time - a[0]) / (b[0] - a[0]))) : 0;
    const mix = (i) => a[i] + (b[i] - a[i]) * fraction;
    const angle = (i) => a[i] + Math.atan2(Math.sin(b[i] - a[i]), Math.cos(b[i] - a[i])) * fraction;
    return {
        type,
        x: mix(1),
        y: mix(2),
        z: mix(3),
        heading: angle(4),
        pitch: angle(5),
        roll: angle(6),
        sourceSpeed: b[0] > a[0]
            ? Math.floor(((Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]) /
                (b[0] - a[0])) *
                1600) /
                (60 * Math.sqrt(128)))
            : 0,
    };
}
