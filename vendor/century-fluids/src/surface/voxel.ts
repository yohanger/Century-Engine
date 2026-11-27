import { FluidError } from '../error.js';
import { Vec3 } from '../math.js';
import { buildWaterTile } from './water-field.js';
import { VoxelWorld } from '../voxel/world.js';

export interface VoxelSurfaceMesh {
  readonly positionsXYZ: Float32Array;
  readonly normalsXYZ: Float32Array;
  readonly vertexKeys: Float64Array;
  readonly indices: Uint32Array;
  readonly depthMeters: Float32Array;
  readonly agitation: Float32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly bounds: {readonly min: Vec3; readonly max: Vec3};
}

export interface VoxelSurfaceOptions {
  readonly smoothing?: number;
  readonly maxTriangles?: number;
  readonly maxChunks?: number;
  readonly timeBudgetMs?: number;
}

export interface VoxelSurfaceUpdate {
  readonly pending: boolean;
  readonly revision: number;
  readonly changes: readonly {readonly key: string; readonly mesh: VoxelSurfaceMesh | null}[];
  readonly chunks: number;
  readonly rebuilt: number;
  readonly reused: number;
  readonly triangles: number;
}

type SurfaceBatch = {
  world: VoxelWorld;
  smoothing: number;
  budget: number;
  state: ReturnType<VoxelWorld['geometryChangesSince']>;
  next: Map<string, number>;
  changes: Map<string, VoxelSurfaceMesh | null>;
  offset: number;
};

/** Detached render buffers. Each consumer keeps its own mesh cursor and can pause independently. */
export class VoxelSurfaceCache {
  #revision = -1;
  #triangles = new Map<string, number>();
  #world: VoxelWorld | null = null;
  #smoothing = 1;
  #batch: SurfaceBatch | null = null;

  reset(): void {
    this.#world = null;
    this.#revision = -1;
    this.#triangles.clear();
    this.#batch = null;
  }

  update(world: VoxelWorld, options: VoxelSurfaceOptions = {}): VoxelSurfaceUpdate {
    const smoothing = options.smoothing ?? 1, budget = options.maxTriangles ?? 250_000;
    const maxChunks = options.maxChunks ?? Infinity, timeBudgetMs = options.timeBudgetMs ?? Infinity;
    if (!(world instanceof VoxelWorld) || !Number.isFinite(smoothing) || smoothing < 0 || smoothing > 1 ||
        !Number.isSafeInteger(budget) || budget <= 0 ||
        (maxChunks !== Infinity && (!Number.isSafeInteger(maxChunks) || maxChunks <= 0)) ||
        (timeBudgetMs !== Infinity && (!Number.isFinite(timeBudgetMs) || timeBudgetMs <= 0)))
      throw new FluidError('INVALID_ARGUMENT', 'invalid voxel surface options', 'surface');
    let batch = this.#batch;
    if (!batch || batch.world !== world || batch.smoothing !== smoothing || batch.budget !== budget) {
      const reset = this.#world !== world || this.#smoothing !== smoothing;
      const state = world.geometryChangesSince(reset ? -1 : this.#revision);
      const next = state.reset ? new Map<string, number>() : new Map(this.#triangles);
      const changes = new Map<string, VoxelSurfaceMesh | null>();
      if (state.reset) for (const key of this.#triangles.keys()) changes.set(key, null);
      this.#batch = batch = {world, smoothing, budget, state, next, changes, offset: 0};
    }
    const {state, next, changes} = batch;
    const clock = (globalThis as {performance?: {now(): number}}).performance;
    const deadline = timeBudgetMs === Infinity || !clock ? Infinity : clock.now() + timeBudgetMs;
    const limit = Math.min(state.chunkKeys.length, batch.offset + maxChunks);
    // Keep the last complete mesh until this sweep fits the combined budget.
    // Edits during the sweep are picked up from its starting revision next time.
    try {
      do {
        if (batch.offset === limit) break;
        const coord = state.chunkKeys[batch.offset++]!;
        const key = coord.join(',');
        const mesh = buildWaterTile(world, coord, smoothing, budget);
        if (mesh || this.#triangles.has(key)) {
          changes.set(key, mesh);
          if (mesh) next.set(key, mesh.triangleCount);
          else next.delete(key);
        }
      } while (batch.offset < limit && (!clock || deadline === Infinity || clock.now() < deadline));
      if (batch.offset < state.chunkKeys.length) {
        return {pending: true, revision: this.#revision, changes: [], chunks: this.#triangles.size,
          rebuilt: 0, reused: this.#triangles.size, triangles: this.#countTriangles(this.#triangles)};
      }
      const triangles = this.#countTriangles(next);
      if (triangles > budget) throw new FluidError('CAPACITY_EXCEEDED', 'combined voxel mesh triangle budget exceeded', 'maxTriangles');
      this.#triangles = next;
      this.#world = world;
      this.#smoothing = smoothing;
      this.#revision = state.revision;
      this.#batch = null;
      const rebuilt = [...changes.values()].reduce((count, mesh) => count + Number(mesh !== null), 0);
      return {pending: false, revision: this.#revision, changes: [...changes].map(([key, mesh]) => ({key, mesh})),
        chunks: next.size, rebuilt, reused: next.size - rebuilt, triangles};
    } catch (error) {
      this.#batch = null;
      throw error;
    }
  }

  #countTriangles(tiles: ReadonlyMap<string, number>): number {
    let total = 0;
    for (const triangles of tiles.values()) total += triangles;
    return total;
  }
}
