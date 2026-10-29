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
    const flags = a[11] || 0;
    const ticks = Math.floor(time * 60);
    const effects = a.length >= 12
        ? {
            ticks,
            energy: mix(7),
            rudderAngle: mix(8),
            fireTail: mix(9),
            repairFrames: mix(10),
            turbo: !!(flags & 2),
            damageLight: !!(flags & 64) && (ticks & 2) !== 0,
            damageSemi: !!(flags & 64) && (ticks & 1) === 0,
            active: {
                accel: !!(flags & 1),
                turbo: !!(flags & 2),
                l1: !!(flags & 4),
                l2: !!(flags & 8),
                r1: !!(flags & 16),
                r2: !!(flags & 32),
            },
        }
        : {};
    return {
        ...effects,
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
// GAME.C view_set: two course-side views (120 ticks), rear/front chase
// views (240 ticks). The random sequence is local; the shot rules are original.
export class ReplayDirector {
    random;
    mode = 1;
    remaining = 0;
    anchor = null;
    constructor(random = Math.random) {
        this.random = random;
    }
    reset() {
        this.remaining = 0;
        this.anchor = null;
    }
    step(track, index) {
        if (this.remaining === 0) {
            const choice = Math.floor(this.random() * 4);
            this.mode = choice < 2 ? 33 : choice === 2 ? 1 : 17;
            this.remaining = choice < 2 ? 120 : 240;
            this.anchor = null;
            if (choice < 2) {
                // The original camera uses the far corner of the current authored
                // map part, including its outer wall skirt, raised by 3000 PS1 units.
                const nodes = track.nodes, part = nodes[index].part;
                let end = index;
                for (let i = 0; i < nodes.length - 1; i++) {
                    const next = (end + 1) % nodes.length;
                    if (nodes[next].part !== part || part === undefined)
                        break;
                    end = next;
                }
                const corner = nodes[end].end || nodes[(end + 1) % nodes.length];
                const side = choice === 0 ? corner.l : corner.r;
                const width = Math.hypot(corner.r[0] - corner.l[0], corner.r[2] - corner.l[2]) || 1;
                const outward = choice === 0 ? -10.24 : 10.24;
                this.anchor = {
                    x: side[0] + ((corner.r[0] - corner.l[0]) / width) * outward,
                    y: side[1] + 30 - 2.56,
                    z: side[2] + ((corner.r[2] - corner.l[2]) / width) * outward,
                };
            }
        }
        this.remaining--;
    }
}
// Keep the legacy seven transform fields first so existing ghost data remains
// readable. Additional fields preserve the visible controls and floor effects.
export function captureReplay(car, time = car.time) {
    const input = car.active || {};
    const flags = (input.accel ? 1 : 0) |
        (car.turbo ? 2 : 0) |
        (input.l1 ? 4 : 0) |
        (input.l2 ? 8 : 0) |
        (input.r1 ? 16 : 0) |
        (input.r2 ? 32 : 0) |
        (car.tile === "d" && car.grip && !car.cpuLevel ? 64 : 0);
    return [
        time,
        car.x,
        car.y,
        car.z,
        car.heading,
        car.pitch,
        car.roll,
        car.energy,
        car.rudderAngle,
        car.fireTail || 0,
        car.repairFrames || 0,
        flags,
    ];
}
