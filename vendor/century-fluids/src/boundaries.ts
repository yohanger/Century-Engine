import { FluidError, requireFinite, requirePositive } from './error.js';
import { Vec3 } from './math.js';
import { composed, Quat, rotated, rotationIncrement } from './rotation.js';

/** Geometry is plain SI data. The liquid core owns no Jolt/renderer object. */
export interface BoundaryMaterial {
  readonly restitution?: number;
  readonly friction?: number;
  /** Translation velocity of the kinematic obstacle, m/s. */
  readonly velocity?: Vec3;
  /** Velocity around the obstacle center, radians/s. Orientation is supplied by host each step. */
  readonly angularVelocity?: Vec3;
}
export type BoundaryInput = BoundaryMaterial & (
  | { readonly kind: 'plane'; readonly point: Vec3; readonly normal: Vec3 }
  | { readonly kind: 'sphere'; readonly center: Vec3; readonly radiusMeters: number }
  | { readonly kind: 'box'; readonly center: Vec3; readonly halfExtents: Vec3; readonly rotation?: Quat;
      /** Shared pivot for a rigid compound. When supplied, velocity is the pivot's velocity. */
      readonly rotationCenter?: Vec3 }
  | { readonly kind: 'heightfield'; readonly origin: Vec3; readonly columns: number; readonly rows: number;
      readonly cellSizeXMeters: number; readonly cellSizeZMeters: number;
      readonly heightsMeters: readonly number[] }
);
export type Boundary = BoundaryInput & { readonly id: number; readonly restitution: number;
  readonly friction: number; readonly velocity: Vec3; readonly angularVelocity: Vec3 };

function vec(v: unknown, name: string): asserts v is Vec3 {
  if (!(v instanceof Vec3)) throw new FluidError('INVALID_ARGUMENT', `${name} must be Vec3`, name);
}
function unitInterval(n: number, name: string): void {
  requireFinite(n, name);
  if (n < 0 || n > 1) throw new FluidError('OUT_OF_RANGE', `${name} must be in [0,1]`, name);
}
/** Validate and take ownership of potentially mutable data before publishing. */
export function validateBoundary(input: BoundaryInput, id: number): Boundary {
  if (!input || typeof input !== 'object') throw new FluidError('INVALID_ARGUMENT', 'boundary must be an object', 'boundary');
  const velocity = input.velocity ?? Vec3.zero();
  const angularVelocity = input.angularVelocity ?? Vec3.zero();
  vec(velocity, 'velocity');vec(angularVelocity,'angularVelocity');
  const restitution = input.restitution ?? 0, friction = input.friction ?? 0;
  unitInterval(restitution, 'restitution'); unitInterval(friction, 'friction');
  switch (input.kind) {
    case 'plane': {
      vec(input.point, 'point'); vec(input.normal, 'normal');
      const len = Math.hypot(input.normal.x, input.normal.y, input.normal.z);
      if (!Number.isFinite(len) || len <= 0) throw new FluidError('OUT_OF_RANGE', 'plane normal cannot be zero', 'normal');
      return Object.freeze({ kind: 'plane', id, point: input.point,
        normal: Vec3.of(input.normal.x / len, input.normal.y / len, input.normal.z / len),
        velocity, angularVelocity, restitution, friction });
    }
    case 'sphere':
      vec(input.center, 'center'); requirePositive(input.radiusMeters, 'radiusMeters');
      return Object.freeze({kind:'sphere',id,center:input.center,radiusMeters:input.radiusMeters,velocity,angularVelocity,restitution,friction});
    case 'box':
      vec(input.center, 'center'); vec(input.halfExtents, 'halfExtents');
      if(input.rotation !== undefined && !(input.rotation instanceof Quat)) throw new FluidError('INVALID_ARGUMENT','rotation must be Quat','rotation');
      if (input.rotationCenter !== undefined) vec(input.rotationCenter, 'rotationCenter');
      for (const [name, n] of [['x',input.halfExtents.x],['y',input.halfExtents.y],['z',input.halfExtents.z]] as const)
        requirePositive(n, `halfExtents.${name}`);
      return Object.freeze({kind:'box',id,center:input.center,halfExtents:input.halfExtents,rotation:input.rotation??Quat.identity(),
        ...(input.rotationCenter ? {rotationCenter:input.rotationCenter} : {}),velocity,angularVelocity,restitution,friction});
    case 'heightfield': {
      vec(input.origin, 'origin');
      if (!Number.isSafeInteger(input.columns) || !Number.isSafeInteger(input.rows)
        || input.columns < 2 || input.rows < 2 || input.columns * input.rows > 1_000_000)
        throw new FluidError('OUT_OF_RANGE', 'heightfield size out of range', 'heightfield');
      requirePositive(input.cellSizeXMeters, 'cellSizeXMeters');
      requirePositive(input.cellSizeZMeters, 'cellSizeZMeters');
      if (!(Array.isArray(input.heightsMeters) || input.heightsMeters instanceof Float64Array)
        || input.heightsMeters.length !== input.columns * input.rows)
        throw new FluidError('INVALID_ARGUMENT', 'heightfield heights have wrong dimensions', 'heightsMeters');
      const values = Array.from(input.heightsMeters);
      for (const n of values) requireFinite(n, 'heightsMeters');
      // Frozen numeric array cannot be changed by callers or the host after registration.
      return Object.freeze({kind:'heightfield',id,origin:input.origin,columns:input.columns,rows:input.rows,
        cellSizeXMeters:input.cellSizeXMeters,cellSizeZMeters:input.cellSizeZMeters,
        heightsMeters:Object.freeze(values),velocity,angularVelocity,restitution,friction});
    }
    default: throw new FluidError('INVALID_ARGUMENT', 'unsupported boundary geometry', 'kind');
  }
}
function shifted(v: Vec3, velocity: Vec3, dt: number): Vec3 {
  const x = v.x + velocity.x * dt, y = v.y + velocity.y * dt, z = v.z + velocity.z * dt;
  if (![x,y,z].every(Number.isFinite)) throw new FluidError('NON_FINITE', 'boundary translation overflow', 'boundary');
  return Vec3.of(x,y,z);
}
export function translated(b: Boundary, dt: number): Boundary {
  switch (b.kind) {
    case 'plane': return Object.freeze({...b,point:shifted(b.point,b.velocity,dt)});
    case 'sphere': return Object.freeze({...b,center:shifted(b.center,b.velocity,dt)});
    case 'box': {
      if (!b.rotationCenter) return Object.freeze({...b,center:shifted(b.center,b.velocity,dt)});
      const pivot = b.rotationCenter, next = shifted(pivot,b.velocity,dt);
      const delta = rotationIncrement(b.angularVelocity,dt);
      const arm = rotated(Vec3.of(b.center.x-pivot.x,b.center.y-pivot.y,b.center.z-pivot.z),delta);
      return Object.freeze({...b,rotationCenter:next,
        center:Vec3.of(next.x+arm.x,next.y+arm.y,next.z+arm.z),rotation:composed(delta,b.rotation!)});
    }
    case 'heightfield': return Object.freeze({...b,origin:shifted(b.origin,b.velocity,dt)});
  }
}
export class BoundaryStore {
  #items = new Map<number, Boundary>();
  #nextId = 1;
  get count(): number { return this.#items.size; }
  add(input: BoundaryInput): number {
    if (!Number.isSafeInteger(this.#nextId)) throw new FluidError('CAPACITY_EXCEEDED','boundary identifier exhausted');
    const id = this.#nextId, value = validateBoundary(input,id);
    this.#items.set(id,value); this.#nextId++; return id;
  }
  get(id: number): Boundary { return this.#lookup(id); }
  update(id: number, input: BoundaryInput): void {
    this.#lookup(id); const v = validateBoundary(input,id); this.#items.set(id,v);
  }
  remove(id: number): void { this.#lookup(id); this.#items.delete(id); }
  clear(): void { this.#items.clear(); }
  snapshot(): readonly Boundary[] { return Object.freeze([...this.#items.values()]); }
  /** All predicted poses are validated before either store is modified. */
  previewAdvance(dt: number): readonly Boundary[] { return Object.freeze([...this.#items.values()].map(b=>translated(b,dt))); }
  commitAdvance(next: readonly Boundary[]): void { for (const b of next) this.#items.set(b.id,b); }
  release(): void { this.clear(); }
  #lookup(id: number): Boundary {
    if (!Number.isSafeInteger(id) || id <= 0) throw new FluidError('INVALID_ARGUMENT','invalid boundary id','id');
    const b = this.#items.get(id); if (!b) throw new FluidError('NOT_FOUND',`boundary ${id} not found`,'id');
    return b;
  }
}
