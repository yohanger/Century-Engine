import { Vec3 } from '../math.js';
import type { CouplingShape, VoxelHydrodynamicPolicy } from '../voxel/coupling.js';
export { Quat } from '../rotation.js';
import { VoxelWorld } from '../voxel/world.js';
import type { VolumeStepResult } from '../voxel/world.js';
/** Minimal structural signatures of the JoltPhysics.js WASM ABI (not ownership). */
export interface JoltVector {
    GetX(): number;
    GetY(): number;
    GetZ(): number;
}
export interface JoltQuaternion extends JoltVector {
    GetW(): number;
}
export interface JoltBodyID {
    GetIndexAndSequenceNumber(): number;
}
export interface JoltBodyInterface {
    GetPosition(id: JoltBodyID): JoltVector;
    GetRotation(id: JoltBodyID): JoltQuaternion;
    GetLinearVelocity(id: JoltBodyID): JoltVector;
    GetAngularVelocity(id: JoltBodyID): JoltVector;
    AddImpulse(id: JoltBodyID, impulse: JoltVector): void;
    AddAngularImpulse(id: JoltBodyID, angularImpulse: JoltVector): void;
}
export interface JoltModule {
    Vec3: new (x: number, y: number, z: number) => JoltVector;
    destroy(value: JoltVector): void;
}
export type JoltBridgeShape = CouplingShape | {
    readonly kind: 'compound';
    /** Axis-aligned boxes in the Jolt shape's local space. */
    readonly boxes: readonly {
        readonly center: Vec3;
        readonly halfExtents: Vec3;
    }[];
    /** Local shape center of mass as reported by Jolt. */
    readonly centerOfMass: Vec3;
};
export interface JoltBridgeBody {
    /** Borrowed BodyID: host MUST unregister before RemoveBody/DestroyBody. */
    readonly id: JoltBodyID;
    readonly shape: JoltBridgeShape;
    readonly motion: 'dynamic' | 'kinematic' | 'static';
    readonly restitution?: number;
    readonly friction?: number;
    /** Hydrostatic approximation from local water surface. 0 disables buoyancy. */
    readonly buoyancyScale?: number;
    /** Relative liquid velocity drag in kg/s; default 0. Applied with equal/opposite impulse on local water. */
    readonly linearDragKgPerSecond?: number;
}
export interface JoltBridgeBodyResult {
    readonly bodyKey: number;
    readonly boundaryId: number;
    readonly boundaryIds?: readonly number[];
    readonly contactImpulseNs: Vec3;
    readonly angularContactImpulseNms: Vec3;
    readonly hydrodynamicImpulseNs: Vec3;
    readonly angularHydrodynamicImpulseNms: Vec3;
    readonly submergedFraction: number;
    readonly sampledCellCount: number;
}
export interface JoltBridgeStep {
    readonly liquid: VolumeStepResult;
    readonly bodies: readonly JoltBridgeBodyResult[];
}
export declare class JoltFluidBridge {
    #private;
    constructor(world: VoxelWorld, jolt: JoltModule, bodyInterface: JoltBodyInterface, hydrodynamics?: VoxelHydrodynamicPolicy | null);
    get bodyCount(): number;
    register(body: JoltBridgeBody): number;
    unregister(key: number): void;
    /**
     * Runs fluid once at host dt, then applies impulses BEFORE host calls Jolt.Step(dt).
     * This never calls Jolt.Step and never destroys Jolt-owned IDs/objects.
     * On a failed fluid solve, all sampled boundary poses are restored and NO Jolt impulses are sent.
     */
    step(dtSeconds: number): JoltBridgeStep;
    shutdown(): void;
}
//# sourceMappingURL=jolt.d.ts.map