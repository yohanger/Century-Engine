import { FluidError } from '../error.js';

export type Coordinates = readonly [number, number, number];
export type CellState = readonly [volume: number, vx: number, vy: number, vz: number];
export const emptyCell: CellState = [0, 0, 0, 0];
export const chunkSide = 8;
const chunkCells = chunkSide ** 3;
const row = 2 ** 17;
const plane = row * row;
const center = row / 2;
const mask = row - 1;

export function cellKey(x: number, y: number, z: number): number {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z) ||
      Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) >= center - 1) {
    throw new FluidError('OUT_OF_RANGE', 'voxel coordinate outside the supported domain', 'position');
  }
  return (x + center) + (y + center) * row + (z + center) * plane;
}

export function coordinates(key: number): Coordinates {
  return [(key & mask) - center, ((key / row) & mask) - center, Math.floor(key / plane) - center];
}

export const axes = [1, row, plane] as const;
export const directions = [1, -1, row, -row, plane, -plane] as const;

export function chunkKey(x: number, y: number, z: number): number {
  return ((x >> 3) + center) + ((y >> 3) + center) * row + ((z >> 3) + center) * plane;
}

type Chunk = {
  volumes: Float64Array;
  velocity: Float32Array;
  wet: number;
};

export class VoxelGrid {
  readonly #chunks = new Map<number, Chunk>();
  #lastKey = -1;
  #lastChunk: Chunk | undefined;
  count = 0;

  get chunkCount(): number { return this.#chunks.size; }

  #lookup(key: number): Chunk | undefined {
    if (key !== this.#lastKey) {
      this.#lastKey = key;
      this.#lastChunk = this.#chunks.get(key);
    }
    return this.#lastChunk;
  }

  volume(key: number): number {
    const x = (key & mask) - center;
    const y = (Math.floor(key / row) % row) - center;
    const z = Math.floor(key / plane) - center;
    const chunk = this.#lookup(chunkKey(x, y, z));
    return chunk?.volumes[(x & 7) + 8 * (y & 7) + 64 * (z & 7)] ?? 0;
  }

  read(key: number): CellState {
    const x = (key & mask) - center;
    const y = (Math.floor(key / row) % row) - center;
    const z = Math.floor(key / plane) - center;
    const chunk = this.#lookup(chunkKey(x, y, z));
    if (!chunk) return emptyCell;
    const i = (x & 7) + 8 * (y & 7) + 64 * (z & 7);
    const volume = chunk.volumes[i]!;
    if (volume === 0) return emptyCell;
    return [volume, chunk.velocity[3 * i]!, chunk.velocity[3 * i + 1]!, chunk.velocity[3 * i + 2]!];
  }

  write(key: number, state: CellState): void {
    const [x, y, z] = coordinates(key);
    const k = chunkKey(x, y, z);
    const [volume, vx, vy, vz] = state;
    let chunk = this.#lookup(k);
    if (!chunk) {
      if (volume === 0) return;
      chunk = {volumes: new Float64Array(chunkCells), velocity: new Float32Array(3 * chunkCells), wet: 0};
      this.#chunks.set(k, chunk);
      this.#lastChunk = chunk;
    }
    const i = (x & 7) + 8 * (y & 7) + 64 * (z & 7);
    if ((chunk.volumes[i] === 0) !== (volume === 0)) {
      const change = volume === 0 ? -1 : 1;
      chunk.wet += change;
      this.count += change;
    }
    chunk.volumes[i] = volume;
    chunk.velocity[3 * i] = vx;
    chunk.velocity[3 * i + 1] = vy;
    chunk.velocity[3 * i + 2] = vz;
    if (chunk.wet === 0) {
      this.#chunks.delete(k);
      this.#lastChunk = undefined;
    }
  }

  *keys(bounds?: readonly [Coordinates, Coordinates]): IterableIterator<number> {
    if (bounds) {
      const [min, max] = bounds;
      const a = min.map(n => n >> 3), b = max.map(n => n >> 3);
      const count = (b[0]! - a[0]! + 1) * (b[1]! - a[1]! + 1) * (b[2]! - a[2]! + 1);
      if (count < this.#chunks.size) {
        for (let z = a[2]!; z <= b[2]!; z++) for (let y = a[1]!; y <= b[1]!; y++) for (let x = a[0]!; x <= b[0]!; x++) {
          const chunk = this.#chunks.get(chunkKey(x * 8, y * 8, z * 8));
          if (chunk) yield* this.#wetKeys(x * 8, y * 8, z * 8, chunk.volumes, bounds);
        }
        return;
      }
    }
    for (const [key, chunk] of this.#chunks) {
      const [cx, cy, cz] = coordinates(key);
      yield* this.#wetKeys(8 * cx, 8 * cy, 8 * cz, chunk.volumes, bounds);
    }
  }

  *#wetKeys(x0: number, y0: number, z0: number, volumes: Float64Array,
    bounds?: readonly [Coordinates, Coordinates]): IterableIterator<number> {
    const min = bounds?.[0] ?? [x0, y0, z0], max = bounds?.[1] ?? [x0 + 7, y0 + 7, z0 + 7];
    const base = cellKey(x0, y0, z0);
    const dx = Math.max(0, min[0] - x0), end = Math.min(7, max[0] - x0);
    for (let z = Math.max(0, min[2] - z0); z <= Math.min(7, max[2] - z0); z++) {
      for (let y = Math.max(0, min[1] - y0); y <= Math.min(7, max[1] - y0); y++) {
        const layer = 8 * y + 64 * z, offset = base + row * y + plane * z;
        for (let x = dx; x <= end; x++) if (volumes[layer + x] !== 0) yield offset + x;
      }
    }
  }

  clear(): void {
    this.#chunks.clear();
    this.#lastKey = -1;
    this.#lastChunk = undefined;
    this.count = 0;
  }
}
