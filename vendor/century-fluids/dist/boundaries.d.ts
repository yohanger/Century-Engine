import { Vec3 } from './math.js';
import { Quat } from './rotation.js';
/** Geometry is plain SI data. The liquid core owns no Jolt/renderer object. */
export interface BoundaryMaterial {
    readonly restitution?: number;
    readonly friction?: number;
    /** Translation velocity of the kinematic obstacle, m/s. */
    readonly velocity?: Vec3;
    /** Velocity around the obstacle center, radians/s. Orientation is supplied by host each step. */
    readonly angularVelocity?: Vec3;
}
export type BoundaryInput = BoundaryMaterial & ({
    readonly kind: 'plane';
    readonly point: Vec3;
    readonly normal: Vec3;
} | {
    readonly kind: 'sphere';
    readonly center: Vec3;
    readonly radiusMeters: number;
} | {
    readonly kind: 'box';
    readonly center: Vec3;
    readonly halfExtents: Vec3;
    readonly rotation?: Quat;
    /** Shared pivot for a rigid compound. When supplied, velocity is the pivot's velocity. */
    readonly rotationCenter?: Vec3;
} | {
    readonly kind: 'heightfield';
    readonly origin: Vec3;
    readonly columns: number;
    readonly rows: number;
    readonly cellSizeXMeters: number;
    readonly cellSizeZMeters: number;
    readonly heightsMeters: readonly number[];
});
export type Boundary = BoundaryInput & {
    readonly id: number;
    readonly restitution: number;
    readonly friction: number;
    readonly velocity: Vec3;
    readonly angularVelocity: Vec3;
};
/** Validate and take ownership of potentially mutable data before publishing. */
export declare function validateBoundary(input: BoundaryInput, id: number): Boundary;
export declare function translated(b: Boundary, dt: number): Boundary;
export declare class BoundaryStore {
    #private;
    get count(): number;
    add(input: BoundaryInput): number;
    get(id: number): Boundary;
    update(id: number, input: BoundaryInput): void;
    remove(id: number): void;
    clear(): void;
    snapshot(): readonly Boundary[];
    /** All predicted poses are validated before either store is modified. */
    previewAdvance(dt: number): readonly Boundary[];
    commitAdvance(next: readonly Boundary[]): void;
    release(): void;
}
//# sourceMappingURL=boundaries.d.ts.map