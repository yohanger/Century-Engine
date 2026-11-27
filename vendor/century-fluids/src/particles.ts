import { FluidError, requirePositive } from './error.js';
import { Vec3 } from './math.js';

/** SI units, with position and velocity independent of any host coordinate convention. */
export interface ParticleInput {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly massKg: number;
}

export interface ParticleChanges {
  readonly position?: Vec3;
  readonly velocity?: Vec3;
  readonly massKg?: number;
}

/** Detached public value; changing it cannot change the simulation. */
export interface ParticleState extends ParticleInput {
  readonly id: number;
}

/** Copies in dense (not necessarily insertion) order; callers own every returned buffer. */
export interface ParticleSnapshot {
  readonly count: number;
  readonly ids: Float64Array;
  readonly positionsXYZ: Float64Array;
  readonly velocitiesXYZ: Float64Array;
  readonly massesKg: Float64Array;
}

const DEFAULT_CAPACITY = 64;
const DEFAULT_MAX_PARTICLES = 1_000_000;

/** Validated up front to prevent allocation surprises and unbounded growth. */
export interface ParticleLimits {
  readonly initialCapacity?: number;
  readonly maxParticles?: number;
}

function validCount(value: number, field: string, allowZero: boolean): void {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new FluidError('OUT_OF_RANGE', `${field} must be ${allowZero ? 'a nonnegative' : 'a positive'} safe integer`, field);
  }
}

function requireVector(value: unknown, field: string): asserts value is Vec3 {
  if (!(value instanceof Vec3)) {
    throw new FluidError('INVALID_ARGUMENT', `${field} must be a validated Vec3`, field);
  }
}

function validateParticle(input: ParticleInput): void {
  if (input === null || typeof input !== 'object') {
    throw new FluidError('INVALID_ARGUMENT', 'particle must be an object', 'particle');
  }
  requireVector(input.position, 'position');
  requireVector(input.velocity, 'velocity');
  requirePositive(input.massKg, 'massKg');
}

/** Private dense SoA storage. Stable IDs do not depend on swap-removal index. */
export class ParticleStore {
  #positions: Float64Array;
  #velocities: Float64Array;
  #masses: Float64Array;
  #ids: Float64Array;
  #scalar: Float64Array | null = null;
  #indexById = new Map<number, number>();
  #count = 0;
  #nextId = 1;
  #revision = 0;
  readonly #maxParticles: number;

  constructor(limits: ParticleLimits = {}) {
    if (limits === null || typeof limits !== 'object') {
      throw new FluidError('INVALID_ARGUMENT', 'particle limits must be an object', 'particleLimits');
    }
    const maximum = limits.maxParticles ?? DEFAULT_MAX_PARTICLES;
    const initial = limits.initialCapacity ?? Math.min(DEFAULT_CAPACITY, maximum);
    validCount(maximum, 'maxParticles', false);
    validCount(initial, 'initialCapacity', true);
    if (initial > maximum || maximum > 10_000_000) {
      throw new FluidError('OUT_OF_RANGE', 'particle capacity is out of supported bounds', 'particleLimits');
    }
    this.#maxParticles = maximum;
    this.#positions = new Float64Array(initial * 3);
    this.#velocities = new Float64Array(initial * 3);
    this.#masses = new Float64Array(initial);
    this.#ids = new Float64Array(initial);
  }

  get count(): number { return this.#count; }
  get revision(): number { return this.#revision; }

  enableScalar(): void { this.#scalar ??= new Float64Array(this.#ids.length); }
  scalarSnapshot(): Float64Array | null {return this.#scalar?.slice(0,this.#count)??null;}

  totalMassKg(): number {
    let mass = 0;
    for (let i = 0; i < this.#count; i++) mass += this.#masses[i]!;
    return mass;
  }

  has(id: number): boolean { return this.#indexById.has(id); }

  add(input: ParticleInput): number {
    validateParticle(input);
    if (this.#count >= this.#maxParticles || !Number.isSafeInteger(this.#nextId)) {
      throw new FluidError('CAPACITY_EXCEEDED', 'particle capacity or identifier limit reached');
    }
    this.#grow(this.#count + 1);
    const id = this.#nextId++;
    const index = this.#count++;
    this.#ids[index] = id;
    this.#write(index, input);
    this.#indexById.set(id, index);
    this.#revision++;
    return id;
  }


  /** Batch injection is validated and reserved before insertion. */
  addMany(inputs: readonly ParticleInput[]): readonly number[] {
    if (!Array.isArray(inputs)) throw new FluidError('INVALID_ARGUMENT', 'emission must be an array', 'inputs');
    for (const input of inputs) validateParticle(input);
    if (inputs.length > this.#maxParticles - this.#count || this.#nextId > Number.MAX_SAFE_INTEGER - inputs.length) {
      throw new FluidError('CAPACITY_EXCEEDED', 'emission exceeds particle or handle limit');
    }
    this.#grow(this.#count + inputs.length);
    const ids: number[] = [];
    for (const input of inputs) ids.push(this.add(input));
    return Object.freeze(ids);
  }

  /** Batch drain verifies all handles before removing any particle. */
  removeMany(ids: readonly number[]): number {
    if (!Array.isArray(ids)) throw new FluidError('INVALID_ARGUMENT', 'drain must be an array', 'ids');
    const seen = new Set<number>();
    let total = 0;
    for (const id of ids) {
      if (seen.has(id)) throw new FluidError('INVALID_ARGUMENT', 'duplicate id', 'ids');
      seen.add(id);
      total += this.#masses[this.indexOf(id)]!;
    }
    for (const id of ids) this.remove(id);
    return total;
  }

  get(id: number): ParticleState {
    const i = this.indexOf(id);
    return Object.freeze({
      id,
      position: Vec3.of(this.#positions[i * 3]!, this.#positions[i * 3 + 1]!, this.#positions[i * 3 + 2]!),
      velocity: Vec3.of(this.#velocities[i * 3]!, this.#velocities[i * 3 + 1]!, this.#velocities[i * 3 + 2]!),
      massKg: this.#masses[i]!,
    });
  }

  update(id: number, changes: ParticleChanges): void {
    const index = this.indexOf(id);
    if (changes === null || typeof changes !== 'object') {
      throw new FluidError('INVALID_ARGUMENT', 'changes must be an object', 'changes');
    }
    const keys = Object.keys(changes);
    if (keys.length === 0 || keys.some((k) => k !== 'position' && k !== 'velocity' && k !== 'massKg')) {
      throw new FluidError('INVALID_ARGUMENT', 'changes must contain known particle fields', 'changes');
    }
    // Validate ALL supplied data before writing ANY field (atomic under exceptions).
    if (Object.hasOwn(changes, 'position')) requireVector(changes.position, 'position');
    if (Object.hasOwn(changes, 'velocity')) requireVector(changes.velocity, 'velocity');
    if (Object.hasOwn(changes, 'massKg')) requirePositive(changes.massKg!, 'massKg');
    if (changes.position !== undefined) this.#setVec(this.#positions, index, changes.position);
    if (changes.velocity !== undefined) this.#setVec(this.#velocities, index, changes.velocity);
    if (changes.massKg !== undefined) this.#masses[index] = changes.massKg;
    this.#revision++;
  }

  remove(id: number): void {
    const index = this.indexOf(id);
    const last = --this.#count;
    if (index !== last) {
      const movedId = this.#ids[last]!;
      this.#copyParticle(index, last);
      this.#indexById.set(movedId, index);
    }
    this.#ids[last] = 0;
    this.#masses[last] = 0;
    if (this.#scalar) this.#scalar[last] = 0;
    for (let axis = 0; axis < 3; axis++) {
      this.#positions[last * 3 + axis] = 0;
      this.#velocities[last * 3 + axis] = 0;
    }
    this.#indexById.delete(id);
    this.#revision++;
  }

  clear(): void {
    this.#indexById.clear();
    this.#positions.fill(0);
    this.#velocities.fill(0);
    this.#masses.fill(0);
    this.#ids.fill(0);
    this.#scalar?.fill(0);
    this.#count = 0;
    // Deliberately DO NOT reset nextId: stale handles must remain invalid.
    this.#revision++;
  }

  release(): void {
    this.#indexById.clear();
    this.#positions = new Float64Array(0);
    this.#velocities = new Float64Array(0);
    this.#masses = new Float64Array(0);
    this.#ids = new Float64Array(0);
    this.#scalar = null;
    this.#count = 0;
    this.#revision++;
  }


  /** Publishes one fully checked frame without invalidating particle IDs. */
  applyKinematics(positions: Float64Array, velocities: Float64Array, scalar?: Float64Array): void {
    if (!(positions instanceof Float64Array) || !(velocities instanceof Float64Array)
      || positions.length !== this.#count * 3 || velocities.length !== this.#count * 3) {
      throw new FluidError('INVALID_ARGUMENT', 'incorrect solver frame dimensions', 'solver');
    }
    for (let k = 0; k < positions.length; k++) {
      if (!Number.isFinite(positions[k]) || !Number.isFinite(velocities[k])) {
        throw new FluidError('NON_FINITE', 'nonfinite solver frame', 'solver');
      }
    }
    if (scalar && (!this.#scalar || scalar.length!==this.#count ||
        scalar.some(value=>!Number.isFinite(value)||value<0)))
      throw new FluidError('INVALID_ARGUMENT','invalid transported scalar','solver');
    if (scalar) this.#scalar!.set(scalar);
    this.#positions.set(positions);
    this.#velocities.set(velocities);
    this.#revision++;
  }

  snapshot(): ParticleSnapshot {
    return Object.freeze({
      count: this.#count,
      ids: this.#ids.slice(0, this.#count),
      positionsXYZ: this.#positions.slice(0, this.#count * 3),
      velocitiesXYZ: this.#velocities.slice(0, this.#count * 3),
      massesKg: this.#masses.slice(0, this.#count),
    });
  }

  /** Internal read-only-by-contract access; no buffer escapes public API. */
  forEachPosition(fn: (id: number, x: number, y: number, z: number) => void): void {
    for (let i = 0; i < this.#count; i++) {
      fn(this.#ids[i]!, this.#positions[i * 3]!, this.#positions[i * 3 + 1]!, this.#positions[i * 3 + 2]!);
    }
  }

  positionOf(id: number): Vec3 {
    const i = this.indexOf(id);
    return Vec3.of(this.#positions[i * 3]!, this.#positions[i * 3 + 1]!, this.#positions[i * 3 + 2]!);
  }

  #write(index: number, input: ParticleInput): void {
    this.#setVec(this.#positions, index, input.position);
    this.#setVec(this.#velocities, index, input.velocity);
    this.#masses[index] = input.massKg;
  }

  #setVec(buffer: Float64Array, index: number, v: Vec3): void {
    buffer[index * 3] = v.x;
    buffer[index * 3 + 1] = v.y;
    buffer[index * 3 + 2] = v.z;
  }

  #copyParticle(target: number, source: number): void {
    this.#ids[target] = this.#ids[source]!;
    this.#masses[target] = this.#masses[source]!;
    if (this.#scalar) this.#scalar[target] = this.#scalar[source]!;
    for (let axis = 0; axis < 3; axis++) {
      this.#positions[target * 3 + axis] = this.#positions[source * 3 + axis]!;
      this.#velocities[target * 3 + axis] = this.#velocities[source * 3 + axis]!;
    }
  }

  #grow(minimum: number): void {
    if (minimum <= this.#ids.length) return;
    const next = Math.min(this.#maxParticles, Math.max(minimum, Math.max(1, this.#ids.length * 2)));
    const positions = new Float64Array(next * 3);
    const velocities = new Float64Array(next * 3);
    const masses = new Float64Array(next);
    const ids = new Float64Array(next);
    positions.set(this.#positions); velocities.set(this.#velocities);
    masses.set(this.#masses); ids.set(this.#ids);
    this.#positions = positions; this.#velocities = velocities;
    this.#masses = masses; this.#ids = ids;
    if (this.#scalar) {
      const scalar=new Float64Array(next);
      scalar.set(this.#scalar);
      this.#scalar=scalar;
    }
  }

  private indexOf(id: number): number {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new FluidError('INVALID_ARGUMENT', 'particle id must be a positive safe integer', 'id');
    }
    const index = this.#indexById.get(id);
    if (index === undefined) throw new FluidError('NOT_FOUND', `particle ${id} not found`, 'id');
    return index;
  }
}
