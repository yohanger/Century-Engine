import { translated } from '../boundaries.js';
import type { Boundary } from '../boundaries.js';
import { Vec3 } from '../math.js';
import { rotated } from '../rotation.js';
import { axes, cellKey, coordinates } from './grid.js';
import type { Coordinates } from './grid.js';

type Axis = 0 | 1 | 2;
type Interval = readonly [number, number];
type Bounds = readonly [Coordinates, Coordinates];
type Solid = {
  boundary: Boundary;
  bounds: Bounds | null;
  axisBox?: Bounds;
  axial?: {axis: Axis; position: number; sign: number};
  planeDistance?: (p: Coordinates) => number;
  clip: (a: Coordinates, b: Coordinates) => Interval | null;
};

const extent = (b: Boundary): number => b.kind === 'sphere' ? b.radiusMeters :
  b.kind === 'box' ? Math.hypot(b.halfExtents.x, b.halfExtents.y, b.halfExtents.z) : Infinity;

export function boundarySpeed(b: Boundary): number {
  const linear = Math.hypot(...b.velocity.toArray());
  if (b.kind !== 'box') return linear;
  const pivot = b.rotationCenter ?? b.center;
  const arm = Math.hypot(b.center.x - pivot.x, b.center.y - pivot.y, b.center.z - pivot.z);
  return linear + (extent(b) + arm) * Math.hypot(...b.angularVelocity.toArray());
}

export function advanceSolid(b: Boundary, dt: number): Boundary {
  if (boundarySpeed(b) === 0 || dt === 0) return b;
  if (b.kind === 'box' && !b.rotationCenter && Math.hypot(...b.angularVelocity.toArray()) > 0) {
    const {rotationCenter: _pivot, ...moved} = translated({...b, rotationCenter: b.center}, dt) as Boundary & {rotationCenter: Vec3};
    return moved as Boundary;
  }
  return translated(b, dt);
}

function below(a: number, b: number): Interval | null {
  if (Math.abs(a) < 1e-10) a = 0;
  if (Math.abs(b) < 1e-10) b = 0;
  if (a >= 0 && b >= 0) return null;
  if (a < 0 && b < 0) return [0, 1];
  const t = a / (a - b);
  return a < 0 ? [0, t] : [t, 1];
}

function terrain(b: Extract<Boundary, {kind: 'heightfield'}>, x: number, z: number): number {
  const u = (x - b.origin.x) / b.cellSizeXMeters, v = (z - b.origin.z) / b.cellSizeZMeters;
  if (u < 0 || v < 0 || u > b.columns - 1 || v > b.rows - 1) return -Infinity;
  const i = Math.min(Math.floor(u), b.columns - 2), j = Math.min(Math.floor(v), b.rows - 2);
  const f = u - i, g = v - j, k = i + j * b.columns, h = b.heightsMeters;
  return b.origin.y + (1 - g) * ((1 - f) * h[k]! + f * h[k + 1]!) +
    g * ((1 - f) * h[k + b.columns]! + f * h[k + b.columns + 1]!);
}

function makeSolid(boundary: Boundary): Solid {
  if (boundary.kind === 'plane') {
    const {point: p, normal: n} = boundary;
    const distance = (q: Coordinates) => (q[0] - p.x) * n.x + (q[1] - p.y) * n.y + (q[2] - p.z) * n.z;
    const normal = n.toArray();
    const axis = normal.findIndex(value => Math.abs(value) === 1);
    const axial = axis < 0 ? {} : {axial: {axis: axis as Axis, position: p.toArray()[axis]!, sign: normal[axis]!}};
    return {boundary, bounds: null, ...axial, planeDistance: distance, clip: (a, b) => below(distance(a), distance(b))};
  }
  if (boundary.kind === 'heightfield') {
    return {boundary, bounds: null, clip(a, b) {
      const d0 = a[1] - terrain(boundary, a[0], a[2]);
      const d1 = b[1] - terrain(boundary, b[0], b[2]);
      if (a[0] === b[0] && a[2] === b[2]) return below(d0, d1);
      // A face ray can cross a ridge even with dry endpoints.
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
        if (a[1] + (b[1] - a[1]) * t < terrain(boundary, x, z)) return [0, 1];
      }
      return null;
    }};
  }
  const c = boundary.center;
  const r = extent(boundary);
  const bounds: Bounds = [[c.x - r, c.y - r, c.z - r], [c.x + r, c.y + r, c.z + r]];
  if (boundary.kind === 'sphere') {
    return {boundary, bounds, clip(a, b) {
      const x = a[0] - c.x, y = a[1] - c.y, z = a[2] - c.z;
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const radius = boundary.radiusMeters;
      const A = dx * dx + dy * dy + dz * dz;
      const B = x * dx + y * dy + z * dz;
      const C = x * x + y * y + z * z - radius * radius;
      if (A === 0) return C < 0 ? [0, 1] : null;
      const discriminant = B * B - A * C;
      if (discriminant <= 0) return null;
      const q = Math.sqrt(discriminant);
      const lo = Math.max(0, (-B - q) / A), hi = Math.min(1, (-B + q) / A);
      return hi > lo ? [lo, hi] : null;
    }};
  }
  const basis = [Vec3.of(1, 0, 0), Vec3.of(0, 1, 0), Vec3.of(0, 0, 1)]
    .map(unit => rotated(unit, boundary.rotation!));
  const limits = boundary.halfExtents.toArray();
  const extents = [0, 1, 2].map(axis =>
    basis.reduce((sum, unit, i) => sum + Math.abs(unit.toArray()[axis]!) * limits[i]!, 0));
  const boxBounds: Bounds = [[c.x - extents[0]!, c.y - extents[1]!, c.z - extents[2]!],
    [c.x + extents[0]!, c.y + extents[1]!, c.z + extents[2]!]];
  const aligned = basis.every(v => Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) > 1 - 1e-10);
  return {boundary, bounds: boxBounds, ...(aligned ? {axisBox: boxBounds} : {}), clip(a, b) {
    let enter = 0, leave = 1;
    for (let i = 0; i < 3; i++) {
      const {x, y, z} = basis[i]!;
      const t0 = (a[0] - c.x) * x + (a[1] - c.y) * y + (a[2] - c.z) * z;
      const d = (b[0] - a[0]) * x + (b[1] - a[1]) * y + (b[2] - a[2]) * z;
      const limit = limits[i]!;
      if (Math.abs(d) < 1e-12) {
        if (Math.abs(t0) >= limit) return null;
      } else {
        const lo = (-limit - t0) / d, hi = (limit - t0) / d;
        enter = Math.max(enter, Math.min(lo, hi));
        leave = Math.min(leave, Math.max(lo, hi));
        if (leave - enter < 1e-10) return null;
      }
    }
    return [enter, leave];
  }};
}

function sharesRigidMotion(boundary: Boundary, sweep?: Boundary): boolean {
  if (!sweep) return false;
  if (boundary.id === sweep.id) return true;
  if (boundary.kind !== 'box' || sweep.kind !== 'box' || !boundary.rotationCenter || !sweep.rotationCenter) return false;
  const a = boundary.rotationCenter, b = sweep.rotationCenter;
  return a.x === b.x && a.y === b.y && a.z === b.z &&
    boundary.velocity.x === sweep.velocity.x && boundary.velocity.y === sweep.velocity.y && boundary.velocity.z === sweep.velocity.z;
}

export type CellGeometry = {
  readonly capacity: number;
  readonly floor: number;
  readonly ceiling: number;
  readonly centerX?: number;
  readonly centerZ?: number;
};
const samples = [.25, .75] as const;
const cacheLimit = 32_768;

function near(bounds: Bounds | null, x: number, y: number, z: number, margin: number): boolean {
  return bounds === null || (x >= bounds[0][0] - margin && x <= bounds[1][0] + margin &&
    y >= bounds[0][1] - margin && y <= bounds[1][1] + margin &&
    z >= bounds[0][2] - margin && z <= bounds[1][2] + margin);
}

export class VoxelSolids {
  readonly #static: Solid[];
  readonly #moving: Solid[];
  readonly #staticGeometry = new Map<number, CellGeometry>();
  readonly #staticFaces = new Map<number, number>();
  readonly #movingGeometry = new Map<number, CellGeometry>();
  readonly #movingFaces = new Map<number, number>();
  readonly #h: number;
  readonly #capacity: number;
  readonly #open: CellGeometry;
  readonly #hasHeightfield: boolean;
  readonly #hasAxisBoxes: boolean;

  constructor(boundaries: readonly Boundary[], h: number, previous?: VoxelSolids) {
    this.#h = h;
    this.#capacity = h ** 3;
    this.#open = {capacity: this.#capacity, floor: 0, ceiling: 1};
    this.#hasHeightfield = boundaries.some(b => b.kind === 'heightfield');
    const stationary = boundaries.filter(b => boundarySpeed(b) === 0);
    if (previous && stationary.length === previous.#static.length &&
        stationary.every((b, i) => b === previous.#static[i]!.boundary)) {
      this.#static = previous.#static;
      this.#staticGeometry = previous.#staticGeometry;
      this.#staticFaces = previous.#staticFaces;
    } else {
      this.#static = stationary.map(makeSolid);
    }
    this.#moving = boundaries.filter(b => boundarySpeed(b) > 0).map(makeSolid);
    this.#hasAxisBoxes = this.#static.some(s => s.axisBox);
  }

  get hasMoving(): boolean { return this.#moving.length > 0; }

  affected(key: number, padding: number, includeInterior = false): boolean {
    if (!this.hasMoving) return false;
    const [x, y, z] = coordinates(key), h = this.#h;
    const point: Coordinates = [(x + .5) * h, (y + .5) * h, (z + .5) * h];
    return this.#moving.some(s => {
      if (!s.planeDistance) return near(s.bounds, ...point, padding);
      const distance = s.planeDistance(point);
      return (includeInterior ? distance : Math.abs(distance)) <= padding;
    });
  }

  geometry(key: number): CellGeometry {
    if (this.affected(key, this.#h, true)) {
      return this.#cachedGeometry(this.#movingGeometry, key, [...this.#static, ...this.#moving]);
    }
    return this.#cachedGeometry(this.#staticGeometry, key, this.#static);
  }

  opening(key: number, axis: Axis, sweep?: Boundary): number {
    const dynamic = this.affected(key, 2 * this.#h, true);
    const cache = dynamic ? this.#movingFaces : this.#staticFaces;
    const keyFace = key * 3 + axis;
    const prior = sweep === undefined ? cache.get(keyFace) : undefined;
    if (prior !== undefined) return prior;
    const [x, y, z] = coordinates(key);
    const solidSet = dynamic ? [...this.#static, ...this.#moving] : this.#static;
    if (!solidSet.length) return 1;
    let open = this.#faceSamples(x, y, z, axis, solidSet, sweep, .5, 1.5);
    if (!open && axis !== 1 && !dynamic && sweep === undefined && this.#hasAxisBoxes) {
      const a = this.geometry(key), b = this.geometry(key + axes[axis]);
      const property = axis === 0 ? 'centerX' : 'centerZ';
      // The nominal center can be inside a wall even though the portion next
      // to the shared face is open. Use a point in the free part of each cell.
      if (a.capacity > 0 && b.capacity > 0 && (a[property] !== undefined || b[property] !== undefined))
        open = this.#faceSamples(x, y, z, axis, solidSet, sweep, a[property] ?? .5, 1 + (b[property] ?? .5));
    }
    const result = open / 4;
    if (sweep === undefined && cache.size < 3 * cacheLimit) cache.set(keyFace, result);
    return result;
  }

  #faceSamples(x: number, y: number, z: number, axis: Axis, solidSet: readonly Solid[],
    sweep: Boundary | undefined, from: number, to: number): number {
    const h = this.#h;
    let open = 0;
    for (const u of samples) for (const v of samples) {
      const a: [number, number, number] = [x * h, y * h, z * h];
      a[axis] += from * h;
      const uAxis = ((axis + 1) % 3) as Axis, vAxis = ((axis + 2) % 3) as Axis;
      a[uAxis] += u * h;
      a[vAxis] += v * h;
      const b: [number, number, number] = [...a];
      b[axis] += (to - from) * h;
      if (!solidSet.some(s => !sharesRigidMotion(s.boundary, sweep) && near(s.bounds, a[0], a[1], a[2], 2 * h) && s.clip(a, b))) open++;
    }
    return open;
  }

  /** Resolve a shallow path that falls between the fixed heights of the face samples. */
  terrainOpeningAtSurface(key: number, axis: 0 | 2, surfaceY: number, direction: -1 | 1): number {
    if (!this.#hasHeightfield) return 0;
    const [x,y,z] = coordinates(key), h = this.#h;
    const height = Math.min(surfaceY, y + 1) * h - 1e-7 * h;
    if (height <= y * h) return 0;
    const solids = this.affected(key,2*h,true) ? [...this.#static,...this.#moving] : this.#static;
    const across = axis === 0 ? 2 : 0;
    let open = 0;
    for (const sample of samples) {
      const a: [number,number,number] = [x*h,height,z*h];
      a[axis] += .5*h;
      a[across] += sample*h;
      const b: [number,number,number] = [...a];
      b[axis] += h;
      const donor = direction > 0 ? a : b, receiver = direction > 0 ? b : a;
      const bank: [number,number,number] = [...donor];
      // A terrain cut can leave the filled part of a cell downhill of its center.
      bank[axis] += direction * .45 * h;
      const blocked = solids.some(s => {
        if (!near(s.bounds,a[0],a[1],a[2],2*h)) return false;
        if (s.boundary.kind !== 'heightfield') return s.clip(a,b) !== null;
        const field = s.boundary;
        let ground = terrain(field,donor[0],donor[2]);
        for (let i = 1; i <= 4; i++) {
          const x = donor[0] + (bank[0] - donor[0]) * i / 4;
          const z = donor[2] + (bank[2] - donor[2]) * i / 4;
          const next = terrain(field,x,z);
          if (next > ground + 1e-7*h) return s.clip(a,b) !== null;
          ground = next;
        }
        return s.clip(bank,receiver) !== null;
      });
      if (!blocked) open++;
    }
    return open * .25;
  }

  blocking(key: number, axis: Axis): Boundary | undefined {
    const h = this.#h;
    const [x, y, z] = coordinates(key);
    const a: [number, number, number] = [(x + .5) * h, (y + .5) * h, (z + .5) * h];
    const b: [number, number, number] = [...a];
    b[axis] += h;
    return [...this.#moving, ...this.#static].find(s =>
      near(s.bounds, a[0], a[1], a[2], 2 * h) && s.clip(a, b))?.boundary;
  }

  pinching(key: number): Boundary | undefined {
    const h = this.#h;
    const [x, y, z] = coordinates(key);
    for (const s of [...this.#moving, ...this.#static]) {
      if (!near(s.bounds, (x + .5) * h, (y + .5) * h, (z + .5) * h, h)) continue;
      const p = s.axial;
      if (p) {
        const start = [x, y, z][p.axis]! * h;
        if (p.sign > 0 ? start + 1e-10 < p.position : start + h - 1e-10 > p.position) return s.boundary;
        continue;
      }
      for (const u of samples) for (const v of samples) {
        if (s.clip([(x + u) * h, y * h, (z + v) * h], [(x + u) * h, (y + 1) * h, (z + v) * h])) return s.boundary;
      }
    }
    return undefined;
  }

  displacementDirection(boundary: Boundary, key: number): Coordinates {
    if (boundary.kind === 'plane') return boundary.normal.toArray();
    if (boundary.kind === 'heightfield') return [0, 1, 0];
    const [x, y, z] = coordinates(key), h = this.#h;
    const p = Vec3.of((x + .5) * h - boundary.center.x, (y + .5) * h - boundary.center.y, (z + .5) * h - boundary.center.z);
    if (boundary.kind === 'sphere') return p.toArray();
    const q = rotated(p, boundary.rotation!, true).toArray();
    const half = boundary.halfExtents.toArray();
    let axis = 0;
    for (let i = 1; i < 3; i++) if (half[i]! - Math.abs(q[i]!) < half[axis]! - Math.abs(q[axis]!)) axis = i;
    const normal = [0, 0, 0];
    normal[axis] = q[axis]! < 0 ? -1 : 1;
    return rotated(Vec3.of(normal[0]!, normal[1]!, normal[2]!), boundary.rotation!).toArray();
  }

  #cachedGeometry(cache: Map<number, CellGeometry>, key: number, candidates: readonly Solid[]): CellGeometry {
    if (!candidates.length) return this.#open;
    const prior = cache.get(key);
    if (prior) return prior;
    const [x, y, z] = coordinates(key), h = this.#h;
    const relevant = candidates.filter(s => near(s.bounds, (x + .5) * h, (y + .5) * h, (z + .5) * h, h));
    if (!relevant.length) return this.#open;
    const lo = [0, 0, 0], hi = [1, 1, 1], start = [x * h, y * h, z * h];
    const curved: Solid[] = [];
    for (const solid of relevant) {
      const plane = solid.axial;
      if (!plane) { curved.push(solid); continue; }
      const {axis, sign, position} = plane;
      const fraction = (position - start[axis]!) / h;
      if (sign > 0) lo[axis] = Math.max(lo[axis]!, fraction);
      else hi[axis] = Math.min(hi[axis]!, fraction);
    }
    const dx = hi[0]! - lo[0]!, dy = hi[1]! - lo[1]!, dz = hi[2]! - lo[2]!;
    if (Math.min(dx, dy, dz) <= 1e-10) {
      const closed = {capacity: 0, floor: 1, ceiling: 1};
      if (cache.size < cacheLimit) cache.set(key, closed);
      return closed;
    }
    let free = 0, floor = 0, ceiling = 0, openArea = 0, openX = 0, openZ = 0;
    let cut = false;
    if (curved.length) {
      const cuts = [0, 2].map(axis => new Set([lo[axis]!, (lo[axis]! + hi[axis]!) * .5, hi[axis]!]));
      for (const {axisBox: box} of curved) {
        // Keep the usual sampling for thin two-sided barriers. A solid box
        // contributes its sub-cell footprint instead of rounding it to four rays.
        if (!box || !box[0].every((low, i) => box[1][i]! - low >= .1 * h &&
            box[1][i]! > start[i]! + lo[i]! * h && low < start[i]! + hi[i]! * h)) continue;
        for (const [index, axis] of ([0, 2] as const).entries()) for (const end of box) {
          const edge = (end[axis]! - start[axis]!) / h;
          if (edge > lo[axis]! + 1e-9 && edge < hi[axis]! - 1e-9) {
            cuts[index]!.add(edge);
            cut = true;
          }
        }
      }
      const cutSamples = (axis: 0 | 2, values: Set<number>, width: number): {p: number; weight: number}[] => {
        if (values.size > 12) return samples.map(t => ({p: lo[axis]! + t * width, weight: .5}));
        const sorted = [...values].sort((a, b) => a - b);
        return sorted.slice(1).map((n, i) => ({p: (n + sorted[i]!) * .5, weight: (n - sorted[i]!) / width}));
      };
      const xs = cutSamples(0, cuts[0]!, dx), zs = cutSamples(2, cuts[1]!, dz);
      for (const u of xs) for (const v of zs) {
        const weight = u.weight * v.weight;
        const a: Coordinates = [(x + u.p) * h, (y + lo[1]!) * h, (z + v.p) * h];
        const b: Coordinates = [a[0], a[1] + h * dy, a[2]];
        const intervals: Interval[] = [];
        for (const solid of curved) {
          const cut = solid.clip(a, b);
          if (cut) intervals.push(cut);
        }
        intervals.sort((a, b) => a[0] - b[0]);
        let last = 0, lowest = -1, highest = 0;
        for (const [low, high] of intervals) {
          if (low > last) {
            free += (low - last) * weight;
            if (lowest < 0) lowest = last;
            highest = low;
          }
          last = Math.max(last, high);
        }
        if (last < 1) {
          free += (1 - last) * weight;
          if (lowest < 0) lowest = last;
          highest = 1;
        }
        // A column occupied by a wall reduces the free area; it cannot raise
        // the floor of the adjacent open part of the cell.
        if (lowest >= 0) {
          floor += lowest * weight;
          ceiling += highest * weight;
          openArea += weight;
          openX += u.p * weight;
          openZ += v.p * weight;
        }
      }
    } else {
      free = ceiling = openArea = 1;
    }
    const fraction = dx * dy * dz * free;
    const result = fraction >= 1 ? this.#open : openArea === 0
      ? {capacity: 0, floor: 1, ceiling: 1}
      : {capacity: fraction * this.#capacity, floor: lo[1]! + dy * floor / openArea,
          ceiling: lo[1]! + dy * ceiling / openArea,
          ...(cut ? {centerX: openX / openArea, centerZ: openZ / openArea} : {})};
    if (cache.size < cacheLimit) cache.set(key, result);
    return result;
  }
}

export function checkedNeighbor(key: number, axis: Axis, sign: number): number {
  const stride = axes[axis];
  const coordinate = Math.floor(key / stride) % (2 ** 17) - 2 ** 16;
  if (Math.abs(coordinate + sign) >= 2 ** 16 - 1) {
    const point = [...coordinates(key)] as [number, number, number];
    point[axis] += sign;
    return cellKey(...point);
  }
  return key + sign * stride;
}

export const faceBase = (a: number, b: number, axis: Axis): number => a < b ? a : a - axes[axis];
