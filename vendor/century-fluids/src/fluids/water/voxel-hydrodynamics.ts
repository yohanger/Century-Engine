import { Vec3 } from '../../math.js';
import { rotated } from '../../rotation.js';
import type { VoxelHydrodynamicPolicy, VoxelHydroResult, VoxelHydroSample } from '../../voxel/coupling.js';
import type { VoxelWorld } from '../../voxel/world.js';

const empty = (): VoxelHydroResult => ({impulse: Vec3.zero(), torque: Vec3.zero(), fraction: 0, sampledCellCount: 0});

export class WaterHydrodynamics implements VoxelHydrodynamicPolicy {
  evaluate(world: VoxelWorld, sample: VoxelHydroSample, dt: number): VoxelHydroResult {
    if (!sample.buoyancyScale && !sample.linearDragKgPerSecond) return empty();
    const {shape, position, velocity} = sample;
    const [x, y, z] = position.toArray();
    const radius = shape.kind === 'sphere' ? shape.radiusMeters : Math.hypot(...shape.halfExtents.toArray());
    const h = world.cellSizeMeters, reach = radius + 1.5 * h;
    const bounds = {min: Vec3.of(x - reach, y - reach, z - reach), max: Vec3.of(x + reach, y + reach, z + reach)};
    const wet = [...world.cells(bounds)];
    if (!wet.length) return empty();
    let water = 0, vx = 0, vy = 0, vz = 0;
    const heights = new Map<number, Map<number, number>>();
    for (const c of wet) {
      // Falling sheets do not define the local hydrostatic waterline.
      if (c.velocity.y < -.45) continue;
      water += c.volumeM3;
      vx += c.velocity.x * c.volumeM3; vy += c.velocity.y * c.volumeM3; vz += c.velocity.z * c.volumeM3;
      let row = heights.get(c.x);
      if (!row) { row = new Map(); heights.set(c.x, row); }
      row.set(c.z, Math.max(row.get(c.z) ?? -Infinity, c.surfaceMeters));
    }
    if (water === 0) return empty();
    const localLevel = (px: number, pz: number): number => {
      const i = Math.floor(px / h), k = Math.floor(pz / h);
      const direct = heights.get(i)?.get(k);
      if (direct !== undefined) return direct;
      let sum = 0, count = 0;
      const spread = Math.min(8, Math.ceil(radius / h) + 1);
      for (let d = 1; d <= spread; d++) {
        for (const [a, b] of [[i + d, k], [i - d, k], [i, k + d], [i, k - d]] as const) {
          const level = heights.get(a)?.get(b);
          if (level !== undefined) { sum += level; count++; }
        }
        if (count) return sum / count;
      }
      return -Infinity;
    };
    const n = 5;
    let volumeSamples = 0, submerged = 0, torqueX = 0, torqueZ = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const a = 2 * (i + .5) / n - 1, b = 2 * (j + .5) / n - 1, c = 2 * (k + .5) / n - 1;
      if (shape.kind === 'sphere' && a * a + b * b + c * c > 1) continue;
      const relative = shape.kind === 'sphere' ? Vec3.of(a * radius, b * radius, c * radius) :
        rotated(Vec3.of(a * shape.halfExtents.x, b * shape.halfExtents.y, c * shape.halfExtents.z), sample.rotation);
      volumeSamples++;
      if (y + relative.y < localLevel(x + relative.x, z + relative.z)) {
        submerged++;
        torqueX -= relative.z;
        torqueZ += relative.x;
      }
    }
    if (!submerged) return empty();
    const fraction = submerged / volumeSamples;
    const volume = shape.kind === 'sphere' ? 4 / 3 * Math.PI * radius ** 3 :
      8 * shape.halfExtents.x * shape.halfExtents.y * shape.halfExtents.z;
    const config = world.getConfig();
    const buoyancy = -config.gravityMS2.y * config.restDensityKgM3 * Math.min(water, volume * fraction) * dt * sample.buoyancyScale;
    const drag = sample.linearDragKgPerSecond * dt * fraction;
    const impulse = Vec3.of((vx / water - velocity.x) * drag, buoyancy + (vy / water - velocity.y) * drag,
      (vz / water - velocity.z) * drag);
    return {impulse, torque: Vec3.of(torqueX * buoyancy / submerged, 0, torqueZ * buoyancy / submerged),
      fraction, sampledCellCount: wet.length,
      reaction: {point: position, radiusMeters: reach, impulseNs: Vec3.of(-impulse.x, -impulse.y, -impulse.z)}};
  }
}
