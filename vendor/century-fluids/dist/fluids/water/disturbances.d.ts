import { Vec3 } from '../../math.js';
import type { VoxelWorld } from '../../voxel/world.js';
export interface WaterContact {
    readonly id: string;
    readonly kind: 'character' | 'body';
    /** Position of the feet or lowest point of the collider, in world space. */
    readonly position: Vec3;
    readonly velocity: Vec3;
    readonly radiusMeters: number;
}
export interface WaterDisturbance {
    readonly kind: 'step' | 'impact' | 'wake';
    readonly point: Vec3;
    readonly direction: Vec3;
    readonly radiusMeters: number;
    readonly strength: number;
    readonly waveSpeedMS: number;
    readonly lifeSeconds: number;
    readonly splash: number;
}
/** Converts fixed-step collider motion into renderer-independent surface events. */
export declare class WaterDisturbances {
    #private;
    clear(): void;
    observe(world: VoxelWorld, contacts: Iterable<WaterContact>, dt: number): readonly WaterDisturbance[];
}
//# sourceMappingURL=disturbances.d.ts.map