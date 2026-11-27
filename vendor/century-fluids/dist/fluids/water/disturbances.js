import { Vec3 } from '../../math.js';
const maxCell = 65534;
const maxEvents = 16;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
/** Converts fixed-step collider motion into renderer-independent surface events. */
export class WaterDisturbances {
    #history = new Map();
    clear() { this.#history.clear(); }
    observe(world, contacts, dt) {
        if (!Number.isFinite(dt) || dt <= 0)
            throw new RangeError('invalid water contact step');
        if (!world.occupiedCellCount) {
            this.clear();
            return [];
        }
        const seen = new Set();
        const events = [];
        for (const contact of contacts) {
            const { id, kind, position, velocity, radiusMeters } = contact;
            if (seen.has(id) || !Number.isFinite(radiusMeters) || radiusMeters <= 0 ||
                ![position.x, position.y, position.z, velocity.x, velocity.y, velocity.z].every(Number.isFinite))
                continue;
            seen.add(id);
            let old = this.#history.get(id);
            const dx = position.x - (old?.point.x ?? position.x);
            const dy = position.y - (old?.point.y ?? position.y);
            const dz = position.z - (old?.point.z ?? position.z);
            const distance = Math.hypot(dx, dz);
            // An instantaneous scene or script teleport must not become a high-energy impact.
            if (distance > Math.max(1.2, 36 * dt) || Math.abs(dy) > Math.max(1.2, 85 * dt))
                old = undefined;
            const traveling = old ? distance : 0;
            const speed = old ? traveling / dt : Math.hypot(velocity.x, velocity.z);
            const falling = Math.max(0, -velocity.y, old ? -dy / dt : 0);
            const point = this.#surface(world, contact, old && falling > .65 ? old.point : null, falling * dt);
            const state = { point: position, wet: point !== null, distance: point ? (old?.distance ?? 0) + traveling : 0,
                sinceEvent: (old?.sinceEvent ?? 1) + dt };
            this.#history.set(id, state);
            if (!point)
                continue;
            const entry = !old?.wet;
            const impact = entry && falling >= .8;
            const stride = kind === 'character' ? .43 : Math.max(.45, radiusMeters);
            const moving = speed >= (kind === 'character' ? .3 : .55) && (traveling > .002 || (!old && entry));
            if (state.sinceEvent < .13 || (!impact && (!moving || (!entry && state.distance < stride))))
                continue;
            state.distance = 0;
            state.sinceEvent = 0;
            if (events.length >= maxEvents)
                continue;
            const strength = clamp(impact ? .42 + falling * .105 + radiusMeters * .22 : .25 + .12 * speed, .26, 1.35);
            const direction = speed > .001 ? Vec3.of((old ? dx / dt : velocity.x) / speed, 0, (old ? dz / dt : velocity.z) / speed) : Vec3.zero();
            events.push({ kind: impact ? 'impact' : kind === 'character' ? 'step' : 'wake', point, direction,
                radiusMeters: clamp(radiusMeters, .08, .9), strength, waveSpeedMS: impact ? 1.72 : 1.2,
                lifeSeconds: impact ? 1.75 : 1.35, splash: impact ? clamp(falling / 7, .3, 1) : (kind === 'character' ? .16 : .12) });
        }
        for (const id of this.#history.keys())
            if (!seen.has(id))
                this.#history.delete(id);
        return events;
    }
    #surface(world, contact, previous, fallDistance) {
        const p = contact.position, h = world.cellSizeMeters;
        const radius = Math.min(contact.radiusMeters * .72, .9);
        const margin = Math.min(.065, h * .3);
        const low = p.y - margin;
        const depth = contact.kind === 'character' ? .68 : Math.max(.28, Math.min(1.5, contact.radiusMeters * 2));
        const high = Math.max(p.y + depth, previous?.y ?? p.y, p.y + Math.min(.8, fallDistance));
        const lo = Math.max(-maxCell, Math.floor(low / h)), hi = Math.min(maxCell, Math.floor(high / h));
        if (lo > hi)
            return null;
        const columns = [[p.x, p.z], [p.x + radius, p.z], [p.x - radius, p.z], [p.x, p.z + radius], [p.x, p.z - radius]];
        if (previous)
            columns.push([(p.x + previous.x) * .5, (p.z + previous.z) * .5]);
        const seen = new Set();
        for (const [x, z] of columns) {
            const gx = Math.floor(x / h), gz = Math.floor(z / h);
            if (Math.abs(gx) > maxCell || Math.abs(gz) > maxCell)
                continue;
            const column = gx + 2 ** 17 * gz;
            if (seen.has(column))
                continue;
            seen.add(column);
            for (let y = hi; y >= lo; y--) {
                const cell = world.cellAt(gx, y, gz);
                if (!cell || cell.surfaceMeters < low || cell.surfaceMeters > high ||
                    cell.surfaceMeters - cell.floorMeters < Math.min(.014, h * .1))
                    continue;
                const above = y < maxCell ? world.cellAt(gx, y + 1, gz) : null;
                if (above && above.floorMeters <= cell.surfaceMeters + .03 && above.surfaceMeters > high)
                    break;
                return Vec3.of(x, cell.surfaceMeters, z);
            }
        }
        return null;
    }
}
//# sourceMappingURL=disturbances.js.map