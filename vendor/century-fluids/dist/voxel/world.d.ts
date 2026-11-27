import type { Boundary, BoundaryInput } from '../boundaries.js';
import { FluidConfig } from '../config.js';
import { Vec3 } from '../math.js';
import type { Coordinates } from './grid.js';
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
type StepPlan = {
    readonly hostDtSeconds: number;
    readonly substeps: number;
    readonly substepDtSeconds: number;
};
/** One volume store and one host-driven clock. Geometry and caches derive from that store. */
export declare class VoxelWorld {
    #private;
    readonly cellSizeMeters: number;
    readonly cellVolumeM3: number;
    constructor(config: FluidConfig, options?: VoxelOptions);
    get state(): 'ready' | 'closed';
    get revision(): number;
    get occupiedCellCount(): number;
    /** Whether a host without external coupling can skip the next fixed step. */
    get needsStep(): boolean;
    get totalVolumeM3(): number;
    get totalMassKg(): number;
    get boundaryCount(): number;
    getConfig(): FluidConfig;
    setConfig(config: FluidConfig): void;
    prepareStep(dtSeconds: number): StepPlan;
    getBoundary(id: number): Boundary;
    boundarySnapshot(): readonly Boundary[];
    addBoundary(input: BoundaryInput): number;
    updateBoundary(id: number, input: BoundaryInput): void;
    removeBoundary(id: number): void;
    clearBoundaries(): void;
    fillBox(box: VolumeBox, volumeM3: number, velocity?: Vec3): number;
    drainBox(box: VolumeBox, volumeM3: number): number;
    volumeInBox(box: VolumeBox): number;
    cellAt(x: number, y: number, z: number): FluidCell | null;
    cells(box?: VolumeBox): IterableIterator<FluidCell>;
    faceOpening(x: number, y: number, z: number, axis: Axis): number;
    geometryChangesSince(revision: number): {
        revision: number;
        chunkKeys: readonly Coordinates[];
        reset: boolean;
    };
    applyImpulse(impulse: VolumeImpulse): void;
    step(dtSeconds: number, sharedImpulses?: readonly VolumeImpulse[]): VolumeStepResult;
    shutdown(): void;
}
export {};
//# sourceMappingURL=world.d.ts.map