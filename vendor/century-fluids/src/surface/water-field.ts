import { FluidError } from '../error.js';
import { Vec3 } from '../math.js';
import { cellKey, chunkSide } from '../voxel/grid.js';
import type { Coordinates } from '../voxel/grid.js';
import type { FluidCell, VoxelWorld } from '../voxel/world.js';
import type { VoxelSurfaceMesh } from './voxel.js';

const corners = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]
] as const;
const edges = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7]
] as const;
const faceOffsets = [
  [[0, 0, 0], [0, -1, 0], [0, -1, -1], [0, 0, -1]],
  [[0, 0, 0], [0, 0, -1], [-1, 0, -1], [-1, 0, 0]],
  [[0, 0, 0], [-1, 0, 0], [-1, -1, 0], [0, -1, 0]]
] as const;
const outside = -.65;
const row = 2 ** 17;
const layer = 2 * row ** 2;

const vertexKey = (x: number, y: number, z: number): number =>
  x + row / 2 + (y + row) * row + (z + row / 2) * layer;

/** Two vertical samples per physical cell resolve shallow surfaces without
 * subdividing the physical grid. A shared lattice edge owns each output face.
 */
export function buildWaterTile(world: VoxelWorld, tile: Coordinates,
  smoothing: number, budget: number): VoxelSurfaceMesh | null {
  const h = world.cellSizeMeters;
  const [bx, by, bz] = [tile[0] * chunkSide, tile[1] * chunkSide * 2, tile[2] * chunkSide];
  const width = chunkSide + 2, height = 2 * chunkSide + 2;
  const pointCount = width ** 2 * height;
  const indexOf = (x: number, y: number, z: number): number =>
    x - bx + 1 + width * (y - by + 1 + height * (z - bz + 1));
  const field = new Float32Array(pointCount).fill(outside);
  const depths = new Float32Array(pointCount);
  const agitation = new Float32Array(pointCount);
  const bounds = {min:Vec3.of((bx - 2) * h, (by / 2 - 2) * h, (bz - 2) * h),
    max:Vec3.of((bx + chunkSide + 2) * h, (by / 2 + chunkSide + 2) * h, (bz + chunkSide + 2) * h)};
  const cells = new Map<number, FluidCell>();
  const visible = .012 * world.cellVolumeM3;
  for (const cell of world.cells(bounds)) if (cell.volumeM3 >= visible)
    cells.set(cellKey(cell.x, cell.y, cell.z), cell);
  if (!cells.size) return null;

  for (const cell of cells.values()) {
    const {x, y, z, velocity} = cell;
    const thickness = (cell.surfaceMeters - cell.floorMeters) / h;
    const fill = cell.volumeM3 / world.cellVolumeM3;
    const below = cells.get(cellKey(x, y - 1, z));
    const above = cells.get(cellKey(x, y + 1, z));
    const falling = velocity.y < -.22 && (!below || below.volumeM3 < .75 * below.capacityM3);
    const connectBelow = below && (below.surfaceMeters + .20 * h >= cell.floorMeters || falling) &&
      world.faceOpening(x, y - 1, z, 1) > 0;
    const connectAbove = above && (cell.surfaceMeters + .20 * h >= above.floorMeters || above.velocity.y < -.22) &&
      world.faceOpening(x, y, z, 1) > 0;
    const lift = falling ? .32 * Math.max(0, 1 - thickness) : 0;
    const low = cell.floorMeters / h + lift - (connectBelow ? .24 : 0);
    const high = Math.max(cell.surfaceMeters / h + lift,
      connectAbove ? y + 1.16 : -Infinity);
    const edgeSoftness = (.20 + .055 * smoothing) *
      Math.min(1, fill * 7) * Math.max(0, 1 - thickness);
    const speed = Math.hypot(velocity.x, velocity.z);
    const foam = Math.min(1, Math.max(0, (speed - .40) * .55 +
      (below ? Math.max(0, -velocity.y - .42) * .30 : 0)));
    let waterDepth = thickness * h;
    if (connectBelow) waterDepth += Math.max(0, below.surfaceMeters - below.floorMeters);
    for (let nz = Math.max(bz - 1, z - 1); nz <= Math.min(bz + chunkSide, z + 1); nz++) {
      for (let nx = Math.max(bx - 1, x - 1); nx <= Math.min(bx + chunkSide, x + 1); nx++) {
        const distance = Math.hypot(nx - x, nz - z);
        const horizontal = .50 - distance * (.77 - .11 * smoothing);
        for (let ny = Math.max(by - 1, Math.floor((low + outside - .25) * 2));
          ny <= Math.min(by + chunkSide * 2, Math.ceil((high - outside - .25) * 2)); ny++) {
          const sampleY = ny * .5 + .25;
          const vertical = Math.min(sampleY - low, high - sampleY) + edgeSoftness;
          const value = Math.min(horizontal, vertical - distance * (.20 - .09 * smoothing));
          const i = indexOf(nx, ny, nz);
          if (value > field[i]!) {
            field[i] = value;
            depths[i] = waterDepth;
            agitation[i] = foam;
          }
        }
      }
    }
  }

  const positions: number[] = [], normals: number[] = [], ids: number[] = [], indices: number[] = [];
  const vertexDepth: number[] = [], vertexAgitation: number[] = [];
  const lower = [Infinity, Infinity, Infinity], upper = [-Infinity, -Infinity, -Infinity];
  const cubeVertices = new Int32Array(pointCount).fill(-1);
  const cornerOffsets = corners.map(([x, y, z]) => x + width * (y + height * z));
  const sampleStrides = [1, width, width * height] as const;
  const values = new Float64Array(8);
  const vertex = (x: number, y: number, z: number): number => {
    const cube = indexOf(x, y, z);
    const cached = cubeVertices[cube]!;
    if (cached >= 0) return cached;
    for (let i = 0; i < 8; i++) values[i] = field[cube + cornerOffsets[i]!]!;
    let px = 0, py = 0, pz = 0, count = 0, depth = 0, foam = 0;
    for (const [a, b] of edges) {
      const fa = values[a]!, fb = values[b]!;
      if ((fa > 0) === (fb > 0)) continue;
      const t = fa / (fa - fb), from = corners[a]!, to = corners[b]!;
      px += from[0] + t * (to[0] - from[0]);
      py += from[1] + t * (to[1] - from[1]);
      pz += from[2] + t * (to[2] - from[2]);
      const wet = cube + cornerOffsets[fa > 0 ? a : b]!;
      depth += depths[wet]!;
      foam += agitation[wet]!;
      count++;
    }
    // The caller only requests cubes adjacent to one of their crossing edges.
    px /= count; py /= count; pz /= count;
    const blend = (a: number, b: number, t: number) => a + (b - a) * t;
    const v = (i: number) => values[i]!;
    const dx = blend(blend(v(0)-v(1), v(2)-v(3), py), blend(v(4)-v(5), v(6)-v(7), py), pz);
    const dy = 2 * blend(blend(v(0)-v(2), v(1)-v(3), px), blend(v(4)-v(6), v(5)-v(7), px), pz);
    const dz = blend(blend(v(0)-v(4), v(1)-v(5), px), blend(v(2)-v(6), v(3)-v(7), px), py);
    const length = Math.hypot(dx, dy, dz);
    const point = [(x + .5 + px) * h, ((y + py) * .5 + .25) * h, (z + .5 + pz) * h];
    const id = ids.length;
    positions.push(...point);
    normals.push(...(length > 1e-9 ? [dx / length, dy / length, dz / length] : [0, 1, 0]));
    vertexDepth.push(depth / count);
    vertexAgitation.push(foam / count);
    ids.push(vertexKey(x, y, z));
    cubeVertices[cube] = id;
    for (let i = 0; i < 3; i++) {
      lower[i] = Math.min(lower[i]!, point[i]!);
      upper[i] = Math.max(upper[i]!, point[i]!);
    }
    return id;
  };

  for (let z = bz; z < bz + chunkSide; z++) for (let y = by; y < by + chunkSide * 2; y++) {
    for (let x = bx; x < bx + chunkSide; x++) {
      const at = indexOf(x, y, z);
      const wet = field[at]! > 0;
      for (const axis of [0, 1, 2] as const) {
        if (wet === (field[at + sampleStrides[axis]]! > 0)) continue;
        if (indices.length / 3 + 2 > budget)
          throw new FluidError('CAPACITY_EXCEEDED', 'voxel mesh triangle budget exceeded', 'maxTriangles');
        const [a, b, c, d] = faceOffsets[axis].map(([dx, dy, dz]) => vertex(x + dx, y + dy, z + dz));
        if (wet) indices.push(a!, b!, c!, a!, c!, d!);
        else indices.push(a!, c!, b!, a!, d!, c!);
      }
    }
  }
  if (!indices.length) return null;
  return {positionsXYZ:new Float32Array(positions), normalsXYZ:new Float32Array(normals),
    vertexKeys:new Float64Array(ids), indices:new Uint32Array(indices), depthMeters:new Float32Array(vertexDepth),
    agitation:new Float32Array(vertexAgitation), vertexCount:ids.length, triangleCount:indices.length / 3,
    bounds:{min:Vec3.of(lower[0]!,lower[1]!,lower[2]!),max:Vec3.of(upper[0]!,upper[1]!,upper[2]!)}};
}
