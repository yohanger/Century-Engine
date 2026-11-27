import { BoundaryStore, validateBoundary } from '../boundaries.js';
import type { Boundary, BoundaryInput } from '../boundaries.js';
import { FluidConfig } from '../config.js';
import { FluidError, requireFinite, requirePositive } from '../error.js';
import { Vec3 } from '../math.js';
import { axes, cellKey, chunkKey, coordinates, directions, VoxelGrid } from './grid.js';
import type { CellState, Coordinates } from './grid.js';
import { advanceSolid, boundarySpeed, checkedNeighbor, faceBase, VoxelSolids } from './solids.js';

export interface VoxelOptions {
  /** Stop advancing water after surface motion and liquid velocity settle. */
  readonly sleepAtRest?: boolean;
  /** Minimum cell fraction for horizontal flow out of a thin film. */
  readonly minFilmFill?: number;
  readonly cellSizeMeters?: number;
  readonly maxCells?: number;
  readonly maxFacesPerStep?: number;
  readonly levelingSpeedMS?: number;
}

export interface VolumeBox {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface FluidCell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly volumeM3: number;
  readonly capacityM3: number;
  readonly floorMeters: number;
  readonly surfaceMeters: number;
  readonly velocity: Vec3;
}

export interface BoundaryImpulse {
  readonly boundaryId: number;
  readonly impulseOnBoundaryNs: Vec3;
  readonly angularImpulseOnBoundaryNms: Vec3;
  readonly contacts: number;
}

export interface VolumeStepResult {
  readonly simulatedSeconds: number;
  readonly substeps: number;
  readonly totalMassKg: number;
  readonly totalVolumeM3: number;
  readonly wetCells: number;
  readonly activeCells: number;
  readonly chunks: number;
  readonly facesProcessed: number;
  readonly transferredVolumeM3: number;
  readonly maximumSolidExcessM3: number;
  readonly boundaryContacts: number;
  readonly boundaryReactions: readonly BoundaryImpulse[];
}

export interface VolumeImpulse {
  readonly point: Vec3;
  readonly radiusMeters: number;
  readonly impulseNs: Vec3;
}

type Axis = 0 | 1 | 2;
type Transfer = {
  in: number; out: number; retained: CellState;
  px: number; py: number; pz: number;
};
type Reaction = [number, number, number, number, number, number, number];
type Column = { key: number; height: number };
type Bounds = readonly [Coordinates, Coordinates];
type StepPlan = { readonly hostDtSeconds: number; readonly substeps: number; readonly substepDtSeconds: number };
const horizontal = [0, 2] as const;
const down = axes[1];
const journalLimit = 64;
const seam = [-1, -1, 0, 0, 0, 0, 1, 1];

class DirtyChunks {
  readonly #coverage = new Map<number, number>();
  readonly keys = new Set<number>();

  mark(key: number): void {
    const [x, y, z] = coordinates(key);
    const chunk = chunkKey(x, y, z);
    const dx = seam[x & 7]!, dy = seam[y & 7]!, dz = seam[z & 7]!;
    const flag = 1 << (dx + 1 + 3 * (dy + 1) + 9 * (dz + 1));
    const coverage = this.#coverage.get(chunk) ?? 0;
    if (coverage & flag) return;
    this.#coverage.set(chunk, coverage | flag);
    // A changed seam also dirties the adjacent tiles, including diagonals.
    for (let iz = 0; iz <= Math.abs(dz); iz++)
      for (let iy = 0; iy <= Math.abs(dy); iy++)
        for (let ix = 0; ix <= Math.abs(dx); ix++)
          this.keys.add(chunk + ix * dx + iy * dy * axes[1] + iz * dz * axes[2]);
  }
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new FluidError('OUT_OF_RANGE', 'expected a positive integer', name);
  return value;
}

function vector(v: Vec3, name: string): asserts v is Vec3 {
  if (!(v instanceof Vec3)) throw new FluidError('INVALID_ARGUMENT', 'expected Vec3', name);
}

function validateConfig(config: FluidConfig): void {
  if (!(config instanceof FluidConfig)) throw new FluidError('INVALID_ARGUMENT', 'expected FluidConfig', 'config');
  const g = config.gravityMS2;
  if (g.x !== 0 || g.z !== 0 || g.y > 0) {
    throw new FluidError('OUT_OF_RANGE', 'voxel gravity must be zero or along negative Y', 'gravityMS2');
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Vec3 && b instanceof Vec3) return a.x === b.x && a.y === b.y && a.z === b.z;
  if (Array.isArray(a) || Array.isArray(b)) return false;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = Object.values(a), right = Object.values(b);
    return left.length === right.length && left.every((value, i) => value === right[i]);
  }
  return false;
}

/** One volume store and one host-driven clock. Geometry and caches derive from that store. */
export class VoxelWorld {
  #config: FluidConfig;
  readonly #grid = new VoxelGrid();
  readonly #boundaries = new BoundaryStore();
  #shapes: VoxelSolids;
  #committedShapes: VoxelSolids;
  #active = new Set<number>();
  #wakeAll = false;
  #quietSeconds = 0;
  readonly #sleepAtRest: boolean;
  #state: 'ready' | 'closed' = 'ready';
  #revision = 0;
  #stateVersion = 0;
  #meshHistory: { revision: number; keys: Set<number> }[] = [];
  #volume = 0;
  #peakSpeed = 0;
  #impulses: VolumeImpulse[] = [];
  readonly #maxCells: number;
  readonly #faceBudget: number;
  readonly #levelSpeed: number;
  readonly #epsilon: number;
  readonly #minFilmVolume: number;
  readonly cellSizeMeters: number;
  readonly cellVolumeM3: number;

  constructor(config: FluidConfig, options: VoxelOptions = {}) {
    validateConfig(config);
    if (!options || typeof options !== 'object')
      throw new FluidError('INVALID_ARGUMENT', 'expected voxel options', 'options');
    this.#config = config;
    this.cellSizeMeters = options.cellSizeMeters ?? .12;
    requirePositive(this.cellSizeMeters, 'cellSizeMeters');
    this.cellVolumeM3 = this.cellSizeMeters ** 3;
    if (!Number.isFinite(this.cellVolumeM3) || this.cellVolumeM3 < 1e-18)
      throw new FluidError('OUT_OF_RANGE', 'unrepresentable voxel volume', 'cellSizeMeters');
    this.#epsilon = 1e-8 * this.cellVolumeM3;
    const minFilmFill = options.minFilmFill ?? 0;
    if (!Number.isFinite(minFilmFill) || minFilmFill < 0 || minFilmFill >= 1)
      throw new FluidError('OUT_OF_RANGE', 'expected a voxel fill fraction in [0, 1)', 'minFilmFill');
    this.#minFilmVolume = minFilmFill * this.cellVolumeM3;
    this.#sleepAtRest = options.sleepAtRest === true;
    this.#maxCells = positiveInteger(options.maxCells ?? 1_000_000, 'maxCells');
    this.#faceBudget = positiveInteger(options.maxFacesPerStep ?? 2_000_000, 'maxFacesPerStep');
    this.#levelSpeed = options.levelingSpeedMS ?? 1.8;
    requirePositive(this.#levelSpeed, 'levelingSpeedMS');
    this.#shapes = new VoxelSolids([], this.cellSizeMeters);
    this.#committedShapes = this.#shapes;
  }

  get state(): 'ready' | 'closed' { return this.#state; }
  get revision(): number { return this.#revision; }
  get occupiedCellCount(): number { this.#ready(); return this.#grid.count; }
  /** Whether a host without external coupling can skip the next fixed step. */
  get needsStep(): boolean {
    this.#ready();
    return this.#shapes.hasMoving || this.#committedShapes.hasMoving || this.#impulses.length > 0 ||
      (this.#grid.count > 0 && (this.#wakeAll || this.#active.size > 0));
  }
  get totalVolumeM3(): number { this.#ready(); return this.#volume; }
  get totalMassKg(): number { return this.totalVolumeM3 * this.#config.restDensityKgM3; }
  get boundaryCount(): number { this.#ready(); return this.#boundaries.count; }

  getConfig(): FluidConfig { this.#ready(); return this.#config; }

  setConfig(config: FluidConfig): void {
    this.#ready();
    validateConfig(config);
    requireFinite(this.#volume * config.restDensityKgM3, 'massKg');
    this.#config = config;
    this.#wakeAll = true;
  }

  prepareStep(dtSeconds: number): StepPlan {
    this.#ready();
    requirePositive(dtSeconds, 'dtSeconds');
    const speed = this.#boundaries.snapshot().reduce((max, boundary) => Math.max(max, boundarySpeed(boundary)), 0);
    const travel = this.#peakSpeed + speed + Math.abs(this.#config.gravityMS2.y) * dtSeconds;
    const maxDt = Math.min(this.#config.maxSubstepSeconds, .42 * this.cellSizeMeters / Math.max(travel, 1e-12));
    const substeps = Math.ceil(dtSeconds / maxDt);
    if (!Number.isSafeInteger(substeps) || substeps > this.#config.maxSubsteps)
      throw new FluidError('STEP_BUDGET_EXCEEDED', 'voxel motion exceeds substep budget', 'dtSeconds');
    return {hostDtSeconds: dtSeconds, substeps, substepDtSeconds: dtSeconds / substeps};
  }

  getBoundary(id: number): Boundary { this.#ready(); return this.#boundaries.get(id); }
  boundarySnapshot(): readonly Boundary[] { this.#ready(); return this.#boundaries.snapshot(); }

  addBoundary(input: BoundaryInput): number {
    this.#ready();
    this.#validateBoundaryMotion(input);
    const id = this.#boundaries.add(input);
    this.#refreshSolids(!boundarySpeed(this.#boundaries.get(id)));
    return id;
  }

  updateBoundary(id: number, input: BoundaryInput): void {
    this.#ready();
    this.#validateBoundaryMotion(input);
    const before = this.#boundaries.get(id);
    const after = validateBoundary(input, id);
    const entries = Object.entries(after);
    if (entries.length === Object.keys(before).length &&
        entries.every(([field, value]) => sameValue(value, (before as unknown as Record<string, unknown>)[field]))) return;
    this.#boundaries.update(id, input);
    this.#refreshSolids(boundarySpeed(before) === 0 || boundarySpeed(after) === 0);
  }

  removeBoundary(id: number): void { this.#ready(); this.#boundaries.remove(id); this.#refreshSolids(true); }
  clearBoundaries(): void { this.#ready(); this.#boundaries.clear(); this.#refreshSolids(true); }

  #validateBoundaryMotion(input: BoundaryInput): void {
    if (input?.kind !== 'box' && input?.kind !== 'sphere' && input?.angularVelocity instanceof Vec3 &&
        Math.hypot(...input.angularVelocity.toArray()) > 0)
      throw new FluidError('INVALID_ARGUMENT', 'angular motion requires a sphere or box', 'angularVelocity');
  }

  #refreshSolids(wake: boolean): void {
    this.#shapes = new VoxelSolids(this.#boundaries.snapshot(), this.cellSizeMeters, this.#shapes);
    this.#wakeAll ||= wake;
    this.#stateVersion++;
  }

  fillBox(box: VolumeBox, volumeM3: number, velocity = Vec3.zero()): number {
    vector(velocity, 'velocity');
    return this.#editVolume(box, volumeM3, velocity);
  }

  drainBox(box: VolumeBox, volumeM3: number): number {
    return this.#editVolume(box, volumeM3, null);
  }

  #editVolume(box: VolumeBox, requested: number, velocity: Vec3 | null): number {
    this.#ready();
    requireFinite(requested, 'volumeM3');
    if (requested < 0) throw new FluidError('OUT_OF_RANGE', 'volume must be nonnegative', 'volumeM3');
    const bounds = this.#boxBounds(box);
    if (requested === 0) return 0;
    const [lo, hi] = bounds, h = this.cellSizeMeters;
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > this.#faceBudget)
      throw new FluidError('STEP_BUDGET_EXCEEDED', 'volume edit exceeds spatial budget', 'box');
    const eligible: {key: number; available: number; before: CellState}[] = [];
    const min = box.min.toArray(), max = box.max.toArray();
    let capacity = 0;
    for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
      const key = cellKey(x, y, z);
      const before = this.#grid.read(key);
      // A drain covering the entire cell can take its exact stored volume.
      // Reconstructing the cell dimensions from world coordinates can leave rounding residue.
      if (!velocity) {
        if (!before[0]) continue;
        if (min[0] <= x * h && max[0] >= (x + 1) * h &&
            min[1] <= y * h && max[1] >= (y + 1) * h &&
            min[2] <= z * h && max[2] >= (z + 1) * h) {
          eligible.push({key, available: before[0], before});
          capacity += before[0];
          continue;
        }
      }
      const geometry = this.#shapes.geometry(key);
      const minY = (y + geometry.floor) * h, maxY = (y + geometry.ceiling) * h;
      const target = [x, y, z];
      const footprint = [0, 2].reduce((a, i) => a * Math.max(0,
        Math.min(max[i]!, (target[i]! + 1) * h) - Math.max(min[i]!, target[i]! * h)), 1);
      const overlap = footprint * Math.max(0, Math.min(max[1], maxY) - Math.max(min[1], minY));
      const available = Math.min(overlap, velocity ? geometry.capacity - before[0] : before[0]);
      if (available > 0) {
        eligible.push({key, available, before});
        capacity += available;
      }
    }
    if (capacity === 0) return 0;
    const total = Math.min(requested, capacity);
    const targetVolume = this.#volume + (velocity ? total : -total);
    if (velocity) {
      requireFinite(targetVolume * this.#config.restDensityKgM3, 'massKg');
      if (this.#grid.count + eligible.filter(c => !c.before[0]).length > this.#maxCells)
        throw new FluidError('CAPACITY_EXCEEDED', 'voxel capacity exceeded', 'maxCells');
      this.#validateSpeed(velocity.x, velocity.y, velocity.z);
    }
    const dirty = new DirtyChunks();
    let delta = 0;
    for (const {key, available, before} of eligible) {
      const quantity = available * (total / capacity);
      const volume = before[0] + (velocity ? quantity : -quantity);
      const mix = velocity && volume ? quantity / volume : 0;
      const vx = before[1] + mix * ((velocity?.x ?? 0) - before[1]);
      const vy = before[2] + mix * ((velocity?.y ?? 0) - before[2]);
      const vz = before[3] + mix * ((velocity?.z ?? 0) - before[3]);
      this.#grid.write(key, [volume, vx, vy, vz]);
      delta += Math.abs(volume - before[0]);
      this.#mark(key, this.#active, dirty);
      this.#peakSpeed = Math.max(this.#peakSpeed, Math.hypot(vx, vy, vz));
    }
    this.#volume = Math.max(0, this.#volume + (velocity ? delta : -delta));
    if (this.#grid.count === 0) this.#volume = 0;
    this.#publishGeometry(dirty.keys);
    if (delta > 0) {
      this.#stateVersion++;
      this.#quietSeconds = 0;
    }
    return delta;
  }

  volumeInBox(box: VolumeBox): number {
    this.#ready();
    const bounds = this.#boxBounds(box), h = this.cellSizeMeters;
    const min = box.min.toArray(), max = box.max.toArray();
    let volume = 0;
    for (const key of this.#grid.keys(bounds)) {
      const [x, y, z] = coordinates(key);
      const geometry = this.#shapes.geometry(key);
      const amount = this.#grid.volume(key);
      const floor = (y + geometry.floor) * h;
      const top = this.#surfaceHeight(key, amount, geometry) * h;
      const heightFraction = (top > floor) ? Math.max(0, Math.min(max[1], top) - Math.max(min[1], floor)) / (top - floor) : 0;
      const width = Math.max(0, Math.min(max[0], (x + 1) * h) - Math.max(min[0], x * h));
      const depth = Math.max(0, Math.min(max[2], (z + 1) * h) - Math.max(min[2], z * h));
      volume += amount * (width * depth / (h * h)) * heightFraction;
    }
    return volume;
  }

  cellAt(x: number, y: number, z: number): FluidCell | null {
    this.#ready();
    const key = cellKey(x, y, z);
    const state = this.#grid.read(key);
    if (state[0] === 0) return null;
    return this.#cell(key, state);
  }

  *cells(box?: VolumeBox): IterableIterator<FluidCell> {
    this.#ready();
    const rev = this.#stateVersion;
    for (const key of this.#grid.keys(box ? this.#boxBounds(box) : undefined)) {
      if (rev !== this.#stateVersion || this.#state === 'closed')
        throw new FluidError('INVALID_ARGUMENT', 'world changed while visiting cells', 'cells');
      yield this.#cell(key, this.#grid.read(key));
    }
  }

  #cell(key: number, state: CellState): FluidCell {
    const geometry = this.#shapes.geometry(key);
    const [x, y, z] = coordinates(key);
    const h = this.cellSizeMeters;
    return {x, y, z, volumeM3: state[0], capacityM3: geometry.capacity,
      floorMeters: (y + geometry.floor) * h, surfaceMeters: this.#surfaceHeight(key, state[0], geometry) * h,
      velocity: Vec3.of(state[1], state[2], state[3])};
  }

  faceOpening(x: number, y: number, z: number, axis: Axis): number {
    this.#ready();
    if (axis !== 0 && axis !== 1 && axis !== 2) throw new FluidError('INVALID_ARGUMENT', 'invalid face axis', 'axis');
    return this.#shapes.opening(cellKey(x, y, z), axis);
  }

  geometryChangesSince(revision: number): {revision: number; chunkKeys: readonly Coordinates[]; reset: boolean} {
    this.#ready();
    const reset = revision < 0 || revision > this.#revision ||
      (this.#meshHistory.length > 0 && revision < this.#meshHistory[0]!.revision - 1);
    let keys: Set<number>;
    if (reset) {
      const dirty = new DirtyChunks();
      for (const key of this.#grid.keys()) dirty.mark(key);
      keys = dirty.keys;
    } else {
      keys = new Set<number>();
      for (const entry of this.#meshHistory) if (entry.revision > revision) for (const key of entry.keys) keys.add(key);
    }
    return {revision: this.#revision, chunkKeys: [...keys].sort((a, b) => a - b).map(coordinates), reset};
  }

  applyImpulse(impulse: VolumeImpulse): void {
    this.#ready();
    this.#validateImpulse(impulse);
    this.#impulses.push(impulse);
  }

  #validateImpulse(impulse: VolumeImpulse): void {
    if (!impulse) throw new FluidError('INVALID_ARGUMENT', 'expected an impulse', 'impulse');
    vector(impulse.point, 'point');
    vector(impulse.impulseNs, 'impulseNs');
    requirePositive(impulse.radiusMeters, 'radiusMeters');
  }

  step(dtSeconds: number, sharedImpulses: readonly VolumeImpulse[] = []): VolumeStepResult {
    const plan = this.prepareStep(dtSeconds);
    for (const impulse of sharedImpulses) this.#validateImpulse(impulse);
    const dt = plan.substepDtSeconds;
    const journal = new Map<number, CellState>();
    const dirty = new DirtyChunks();
    const reactions = new Map<number, Reaction>();
    const save = (key: number, next: CellState): void => {
      if (!journal.has(key)) journal.set(key, this.#grid.read(key));
      this.#grid.write(key, next);
    };
    const initial = this.#boundaries.snapshot();
    let solids = this.#shapes;
    let active = this.#wakeAll ? new Set(this.#grid.keys()) : this.#active;
    let latest = initial;
    let remaining = this.#faceBudget, faces = 0, transferred = 0, activeCount = 0, maximumSolidExcessM3 = 0;
    // Movement and changes to fluid data remain revocable until all substeps finish.
    try {
      if (this.#impulses.length || sharedImpulses.length) {
        active = new Set(active);
        for (const impulse of [...this.#impulses, ...sharedImpulses]) this.#spreadImpulse(impulse, active, save);
      }
      for (let i = 0; i < plan.substeps; i++) {
        const previous = i === 0 ? this.#committedShapes : solids;
        if (solids.hasMoving) {
          latest = initial.map(b => advanceSolid(b, (i + 1) * dt));
          solids = new VoxelSolids(latest, this.cellSizeMeters, previous);
          active = new Set(active);
          for (const key of this.#grid.keys()) {
            if (solids.affected(key, 2 * this.cellSizeMeters) || previous.affected(key, 2 * this.cellSizeMeters)) active.add(key);
          }
        }
        const next = new Set<number>();
        if (this.#wakeAll || solids.hasMoving || previous.hasMoving) {
          this.#displace(active, previous, solids, next, dirty, reactions, save);
        }
        activeCount = Math.max(activeCount, active.size);
        const budget = () => {
          if (--remaining < 0) throw new FluidError('STEP_BUDGET_EXCEEDED', 'voxel face budget exhausted', 'maxFacesPerStep');
          faces++;
        };
        const fluxes = this.#flux(active, solids, dt, reactions, budget);
        for (const [key, f] of fluxes) {
          const before = this.#grid.read(key);
          const retained = Math.max(0, before[0] - f.out);
          let volume = retained + f.in;
          const capacity = solids.geometry(key).capacity;
          const excess = volume - capacity;
          maximumSolidExcessM3 = Math.max(maximumSolidExcessM3, excess);
          if (excess > this.#epsilon || !Number.isFinite(volume))
            throw new FluidError('CAPACITY_EXCEEDED', 'invalid voxel occupancy after transfer', 'capacityM3');
          if (excess > 0) volume = capacity;
          const vx = volume ? (f.retained[1] * retained + f.px) / volume : 0;
          const vy = volume ? (f.retained[2] * retained + f.py) / volume : 0;
          const vz = volume ? (f.retained[3] * retained + f.pz) / volume : 0;
          this.#validateSpeed(vx, vy, vz);
          if (volume !== before[0] || vx !== before[1] || vy !== before[2] || vz !== before[3]) {
            save(key, [volume, vx, vy, vz]);
            if (Math.abs(volume - before[0]) > this.#epsilon || before[0] === 0 || volume === 0)
              this.#mark(key, next, dirty);
            else if (volume && Math.hypot(vx, vy, vz) > .001) next.add(key);
          }
          transferred += f.in;
        }
        if (this.#grid.count > this.#maxCells)
          throw new FluidError('CAPACITY_EXCEEDED', 'voxel capacity exceeded', 'maxCells');
        active = next;
      }
      const report = [...reactions].map(([boundaryId, r]): BoundaryImpulse => ({
        boundaryId, contacts: r[6],
        impulseOnBoundaryNs: Vec3.of(r[0], r[1], r[2]),
        angularImpulseOnBoundaryNms: Vec3.of(r[3], r[4], r[5])
      }));
      let speed = 0, bulkSpeed = 0;
      const filmVolume = Math.max(this.#minFilmVolume, 6e-5 * this.cellVolumeM3);
      for (const key of active) {
        const state = this.#grid.read(key);
        const velocity = Math.hypot(state[1], state[2], state[3]);
        speed = Math.max(speed, velocity);
        if (state[0] > filmVolume) bulkSpeed = Math.max(bulkSpeed, velocity);
      }
      if (this.#sleepAtRest && active.size > 0) {
        const quiet = !this.#wakeAll && !solids.hasMoving && !this.#committedShapes.hasMoving &&
          !this.#impulses.length && !sharedImpulses.length && bulkSpeed <= .01 && this.#settledVolume(journal, dtSeconds);
        this.#quietSeconds = quiet ? this.#quietSeconds + dtSeconds : 0;
        if (this.#quietSeconds >= .25) {
          for (const key of this.#grid.keys()) {
            const [volume, vx, vy, vz] = this.#grid.read(key);
            if (vx || vy || vz) {
              save(key, [volume, 0, 0, 0]);
              dirty.mark(key);
            }
          }
          active.clear();
          speed = 0;
          this.#quietSeconds = 0;
        }
      }
      this.#peakSpeed = speed;
      this.#active = active;
      this.#shapes = solids;
      this.#committedShapes = solids;
      this.#boundaries.commitAdvance(latest);
      this.#wakeAll = false;
      this.#impulses = [];
      this.#publishGeometry(dirty.keys);
      if (journal.size > 0) this.#stateVersion++;
      return Object.freeze({simulatedSeconds: dtSeconds, substeps: plan.substeps,
        totalMassKg: this.totalMassKg, totalVolumeM3: this.#volume, wetCells: this.#grid.count,
        activeCells: activeCount, chunks: this.#grid.chunkCount, facesProcessed: faces, maximumSolidExcessM3,
        transferredVolumeM3: transferred, boundaryContacts: report.reduce((a, r) => a + r.contacts, 0),
        boundaryReactions: Object.freeze(report)});
    } catch (error) {
      for (const [key, before] of journal) this.#grid.write(key, before);
      throw error;
    }
  }

  #settledVolume(journal: ReadonlyMap<number, CellState>, dt: number): boolean {
    // Use net per-cell change; opposing face fluxes can cancel in a level basin.
    const limit = this.cellVolumeM3 * .0012 * dt;
    for (const [key, before] of journal) if (Math.abs(this.#grid.volume(key) - before[0]) > limit) return false;
    return true;
  }

  #flux(active: ReadonlySet<number>, solids: VoxelSolids, dt: number, reactions: Map<number, Reaction>,
    budget: () => void): Map<number, Transfer> {
    const fluxes = new Map<number, Transfer>();
    const columns = new Map<number, Column>();
    const descending = new Set<number>();
    const epsilon = this.#epsilon;
    const film = this.#minFilmVolume;
    const horizontalCutoff = Math.max(epsilon, film);
    const horizontalMinimum = Math.max(film, 6e-5 * this.cellVolumeM3);
    const h = this.cellSizeMeters, gravity = -this.#config.gravityMS2.y;
    const damping = Math.exp(-6 * dt);
    const base = (key: number): Transfer => {
      let value = fluxes.get(key);
      if (!value) {
        value = {in: 0, out: 0, px: 0, py: 0, pz: 0, retained: this.#grid.read(key)};
        fluxes.set(key, value);
      }
      return value;
    };
    const move = (from: number, to: number, requested: number, velocity: CellState, dryMinimum = 0): void => {
      if (requested <= epsilon) return;
      const source = base(from), target = base(to);
      const available = source.retained[0] - source.out;
      const room = solids.geometry(to).capacity - target.retained[0] + target.out - target.in;
      const volume = Math.min(available, room, requested);
      if (volume <= epsilon || (target.retained[0] === 0 && volume < dryMinimum)) return;
      source.out += volume;
      target.in += volume;
      target.px += volume * velocity[1];
      target.py += volume * velocity[2];
      target.pz += volume * velocity[3];
    };
    for (const key of active) {
      const fluid = this.#grid.read(key);
      if (fluid[0] <= epsilon) continue;
      budget();
      const below = checkedNeighbor(key, 1, -1);
      const capacity = solids.geometry(below).capacity;
      const opening = capacity > epsilon ? solids.opening(below, 1) : 0;
      const gap = capacity - this.#grid.volume(below);
      const vy = Math.max(-22, fluid[2] - gravity * dt);
      if (gap > epsilon && opening > 0 && vy < 0) {
        const falling: CellState = [fluid[0], fluid[1] * damping, vy, fluid[3] * damping];
        base(key).retained = falling;
        let volume = fluid[0] * Math.min(1, -vy * dt * opening / h);
        // Keep a falling tail in one parcel instead of leaving sub-voxel residue at every height.
        if (film > 0 && fluid[0] - volume < film && gap >= fluid[0]) volume = fluid[0];
        move(key, below, volume, falling);
        if (this.#grid.volume(below) <= .4 * capacity && opening >= .75 &&
            Math.abs(fluid[1]) + Math.abs(fluid[3]) < .012) descending.add(key);
      } else if (fluid[1] !== 0 || fluid[2] !== 0 || fluid[3] !== 0) {
        base(key).retained = [fluid[0], fluid[0] > film && Math.abs(fluid[1]) > .001 ? fluid[1] * damping : 0, 0,
          fluid[0] > film && Math.abs(fluid[3]) > .001 ? fluid[3] * damping : 0];
        if (opening < 1 && vy < -.25) {
          const boundary = solids.blocking(below, 1);
          if (boundary) this.#react(reactions, boundary, key, 0,
            vy * fluid[0] * this.#config.restDensityKgM3 * (1 - opening), 0);
        }
      }
    }
    for (const key of active) {
      if (this.#grid.volume(key) <= horizontalCutoff || descending.has(key)) continue;
      const atKey = this.#grid.read(key);
      for (const axis of horizontal) for (const sign of [-1, 1] as const) {
        const neighbor = checkedNeighbor(key, axis, sign);
        const other = this.#grid.read(neighbor);
        if (sign < 0 && active.has(neighbor) && other[0] > horizontalCutoff && !descending.has(neighbor)) continue;
        if (other[0] <= epsilon && atKey[0] < horizontalMinimum) continue;
        budget();
        const face = faceBase(key, neighbor, axis);
        const a = this.#column(key, solids, columns);
        const b = this.#column(neighbor, solids, columns);
        const difference = a.height - b.height;
        const va = atKey[axis + 1] ?? 0;
        const vb = other[axis + 1] ?? 0;
        const advective = sign * .14 * (.5 * (va + vb)) * dt / h;
        const head = difference + advective / .42;
        if (Math.abs(head) < 5e-5) continue;
        const from = head >= 0 ? a : b, to = head >= 0 ? b : a;
        if (this.#grid.volume(from.key) <= horizontalCutoff ||
            (a.key !== key && b.key !== neighbor && solids.opening(face + down, axis) > 0)) continue;
        const direction = from === a ? sign : sign === 1 ? -1 : 1;
        const opening = solids.opening(face, axis) || (from.height > to.height
          ? solids.terrainOpeningAtSurface(face, axis, from.height, direction) : 0);
        if (!opening) continue;
        const receivingKey = solids.geometry(to.key).capacity - this.#grid.volume(to.key) <= epsilon ? to.key + down : to.key;
        if (receivingKey !== to.key && !solids.opening(to.key, 1)) continue;
        const fromState = base(from.key).retained;
        if (fromState[2] < -.08 && (fluxes.get(from.key)?.out ?? 0) > epsilon) continue;
        const bias = Math.max(0, direction * (fromState[axis + 1] ?? 0)) * .14;
        const speed = Math.min(this.#levelSpeed, .85 * Math.sqrt(gravity * h * Math.abs(difference)) + bias);
        // The four horizontal faces share one column. Bound each exchange by
        // less than a quarter of the smaller cross-section to avoid overshoot.
        const source = solids.geometry(from.key), target = solids.geometry(receivingKey);
        const sourceArea = source.capacity / Math.max(1e-8, source.ceiling - source.floor);
        const targetArea = target.capacity / Math.max(1e-8, target.ceiling - target.floor);
        const headVolume = .22 * Math.abs(head) * Math.min(sourceArea, targetArea);
        const requested = Math.min(headVolume, speed * dt / h * opening * this.cellVolumeM3);
        const transport: CellState = [0, axis === 0 ? direction * speed : fromState[1] * damping, 0,
          axis === 2 ? direction * speed : fromState[3] * damping];
        move(from.key, receivingKey, requested, transport, film);
      }
    }
    return fluxes;
  }

  #column(key: number, solids: VoxelSolids, cache: Map<number, Column>): Column {
    const prior = cache.get(key);
    if (prior) return prior;
    let top = key;
    let volume = this.#grid.volume(top);
    // Only hydraulically connected, near-full cells contribute the stack above the face.
    for (let i = 0; i < 12 && volume > this.#epsilon; i++) {
      const capacity = solids.geometry(top).capacity;
      if (volume < capacity - this.#epsilon || this.#grid.volume(top + down) <= this.#epsilon || !solids.opening(top, 1)) break;
      top += down;
      volume = this.#grid.volume(top);
    }
    const result = {key: top, height: this.#surfaceHeight(top, volume, solids.geometry(top))};
    cache.set(key, result);
    return result;
  }

  #surfaceHeight(key: number, volume: number, geometry: {capacity: number; floor: number; ceiling: number}): number {
    const y = coordinates(key)[1];
    const fill = geometry.capacity > 0 ? Math.min(1, volume / geometry.capacity) : 0;
    return y + geometry.floor + fill * (geometry.ceiling - geometry.floor);
  }

  #displace(active: Iterable<number>, oldSolids: VoxelSolids, solids: VoxelSolids, next: Set<number>,
    dirty: DirtyChunks, reactions: Map<number, Reaction>, save: (key: number, state: CellState) => void): void {
    const h = this.cellSizeMeters;
    for (const source of active) {
      const fluid = this.#grid.read(source);
      if (!fluid[0]) continue;
      const updated = solids.geometry(source);
      const previous = oldSolids.geometry(source);
      if (updated.floor !== previous.floor || updated.ceiling !== previous.ceiling ||
          Math.abs(updated.capacity - previous.capacity) > this.#epsilon) dirty.mark(source);
      const capacity = updated.capacity;
      let excess = fluid[0] - capacity;
      if (excess <= 0) continue;
      if (excess <= 1e-13 * this.cellVolumeM3) continue;
      const cause = solids.pinching(source);
      const v = cause?.velocity ?? Vec3.zero();
      const [sx, sy, sz] = coordinates(source);
      const r = cause?.kind === 'box' ? cause.rotationCenter ?? cause.center : cause?.kind === 'sphere' ? cause.center : null;
      const w = cause?.angularVelocity ?? Vec3.zero();
      const dx = r ? (sx + .5) * h - r.x : 0, dy = r ? (sy + .5) * h - r.y : 0, dz = r ? (sz + .5) * h - r.z : 0;
      const velocity = [v.x + w.y * dz - w.z * dy, v.y + w.z * dx - w.x * dz, v.z + w.x * dy - w.y * dx];
      const outward = cause ? solids.displacementDirection(cause, source) : [0, 0, 0];
      const preference = (i: number): number => (3 * velocity[i >> 1]! + outward[i >> 1]!) * (i % 2 ? -1 : 1);
      const order = [2, 0, 1, 4, 5, 3].sort((a, b) => preference(b) - preference(a));
      const visited = new Set([source]);
      const queue = [{key: source, depth: 0, swept: -1}];
      for (let i = 0; i < queue.length && i < 1024 && excess > 0; i++) {
        const {key, depth, swept} = queue[i]!;
        if (depth > 11) break;
        for (const direction of order) {
          if (swept !== -1 && swept !== direction) continue;
          const axis = (direction >> 1) as Axis, sign = direction % 2 ? -1 : 1;
          const neighbor = checkedNeighbor(key, axis, sign);
          if (visited.has(neighbor)) continue;
          const face = faceBase(key, neighbor, axis);
          const open = solids.opening(face, axis);
          const sweepsForward = velocity[axis]! * sign > .001;
          const escape = cause && (depth === 0 ? (sweepsForward || (outward[axis]! * sign > 1e-6 &&
            oldSolids.opening(face, axis) > 0)) : swept === direction && depth < 3 && sweepsForward) &&
            solids.opening(face, axis, cause) > 0;
          // The departing solid can cover the cut face itself. Follow its local swept
          // direction to the first open cell while still testing all unrelated solids.
          if (!(open > 0 || escape)) continue;
          visited.add(neighbor);
          const dest = this.#grid.read(neighbor);
          const room = solids.geometry(neighbor).capacity - dest[0];
          if (room <= 0 && dest[0] === 0) {
            if (escape && sweepsForward) queue.push({key: neighbor, depth: depth + 1, swept: direction});
            continue;
          }
          queue.push({key: neighbor, depth: depth + 1, swept: -1});
          if (room <= 0) continue;
          const move = Math.min(room, excess), sum = dest[0] + move;
          const ux = fluid[1] + .65 * velocity[0]!, uy = fluid[2] + .65 * velocity[1]!, uz = fluid[3] + .65 * velocity[2]!;
          const vx = (dest[1] * dest[0] + ux * move) / sum;
          const vy = (dest[2] * dest[0] + uy * move) / sum;
          const vz = (dest[3] * dest[0] + uz * move) / sum;
          this.#validateSpeed(vx, vy, vz);
          save(neighbor, [sum, vx, vy, vz]);
          this.#mark(neighbor, next, dirty);
          if (cause) {
            const mass = .65 * this.#config.restDensityKgM3 * move;
            this.#react(reactions, cause, source, -mass * velocity[0]!, -mass * velocity[1]!, -mass * velocity[2]!);
          }
          excess -= move;
          if (excess <= 0) break;
        }
      }
      if (excess > this.#epsilon) throw new FluidError('CAPACITY_EXCEEDED',
        'displaced water cannot reach free space within the voxel budget at ' + [sx, sy, sz].join(','), 'boundary');
      save(source, [capacity, fluid[1], fluid[2], fluid[3]]);
      this.#mark(source, next, dirty);
    }
  }

  #react(reactions: Map<number, Reaction>, boundary: Boundary, key: number, x: number, y: number, z: number): void {
    const pivot = boundary.kind === 'plane' ? boundary.point : boundary.kind === 'heightfield' ? boundary.origin :
      boundary.kind === 'box' ? boundary.rotationCenter ?? boundary.center : boundary.center;
    const [a, b, c] = coordinates(key), h = this.cellSizeMeters;
    const rx = (a + .5) * h - pivot.x, ry = (b + .5) * h - pivot.y, rz = (c + .5) * h - pivot.z;
    const values = reactions.get(boundary.id) ?? [0, 0, 0, 0, 0, 0, 0];
    values[0] += x; values[1] += y; values[2] += z;
    values[3] += ry * z - rz * y; values[4] += rz * x - rx * z; values[5] += rx * y - ry * x;
    values[6]++;
    reactions.set(boundary.id, values);
  }

  #spreadImpulse(input: VolumeImpulse, active: Set<number>, save: (key: number, state: CellState) => void): void {
    const {point, radiusMeters: radius, impulseNs} = input;
    const h = this.cellSizeMeters;
    const bounds = this.#boxBounds({min: Vec3.of(point.x - radius, point.y - radius, point.z - radius),
      max: Vec3.of(point.x + radius, point.y + radius, point.z + radius)});
    const weights: {key: number; weight: number; old: CellState}[] = [];
    let sum = 0;
    for (const key of this.#grid.keys(bounds)) {
      const [x, y, z] = coordinates(key);
      const old = this.#grid.read(key);
      const normalized = Math.hypot((x + .5) * h - point.x, (y + .5) * h - point.y, (z + .5) * h - point.z) / radius;
      const weight = Math.max(0, 1 - normalized) * old[0];
      if (weight > 0) { weights.push({key, weight, old}); sum += weight; }
    }
    for (const {key, weight, old} of weights) {
      const scale = weight / (sum * old[0] * this.#config.restDensityKgM3);
      const vx = old[1] + scale * impulseNs.x, vy = old[2] + scale * impulseNs.y, vz = old[3] + scale * impulseNs.z;
      this.#validateSpeed(vx, vy, vz);
      save(key, [old[0], vx, vy, vz]);
      active.add(key);
    }
  }

  #boxBounds(box: VolumeBox): Bounds {
    if (!box) throw new FluidError('INVALID_ARGUMENT', 'expected a volume box', 'box');
    vector(box.min, 'min');
    vector(box.max, 'max');
    const min = box.min.toArray(), max = box.max.toArray(), h = this.cellSizeMeters;
    if (min.some((n, i) => n >= max[i]!)) throw new FluidError('INVALID_ARGUMENT', 'volume box must have positive extents', 'box');
    const toCell = (point: readonly number[], high: boolean): Coordinates => {
      const result = point.map(n => {
        const q = n / h, rounded = Math.round(q);
        const normalized = Math.abs(q - rounded) < 1e-9 ? rounded : q;
        return high ? Math.ceil(normalized) - 1 : Math.floor(normalized);
      }) as [number, number, number];
      cellKey(...result);
      return result;
    };
    return [toCell(min, false), toCell(max, true)];
  }

  #mark(key: number, active: Set<number>, chunks: DirtyChunks): void {
    if (!active.has(key) && this.#grid.volume(key) > this.#epsilon) active.add(key);
    for (const d of directions) {
      if (!active.has(key + d) && this.#grid.volume(key + d) > this.#epsilon) active.add(key + d);
    }
    chunks.mark(key);
  }

  #publishGeometry(keys: Set<number>): void {
    if (!keys.size) return;
    this.#meshHistory.push({revision: ++this.#revision, keys});
    if (this.#meshHistory.length > journalLimit) this.#meshHistory.shift();
  }

  #validateSpeed(x: number, y: number, z: number): void {
    if (!Number.isFinite(x + y + z) || Math.hypot(x, y, z) > 80)
      throw new FluidError('STEP_BUDGET_EXCEEDED', 'voxel velocity exceeds the supported limit', 'velocity');
  }

  shutdown(): void {
    if (this.#state === 'closed') return;
    this.#state = 'closed';
    this.#grid.clear();
    this.#boundaries.release();
    this.#shapes = new VoxelSolids([], this.cellSizeMeters);
    this.#committedShapes = this.#shapes;
    this.#active.clear();
    this.#meshHistory = [];
    this.#impulses = [];
    this.#volume = 0;
  }

  #ready(): void {
    if (this.#state !== 'ready') throw new FluidError('CLOSED', 'fluid world has been shut down');
  }
}
