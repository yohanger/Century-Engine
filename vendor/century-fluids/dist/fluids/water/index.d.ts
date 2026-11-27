import { FluidConfig } from '../../config.js';
import type { FluidConfigValues } from '../../config.js';
import { VoxelWorld } from '../../voxel/world.js';
import type { VoxelOptions } from '../../voxel/world.js';
export { WaterDisturbances } from './disturbances.js';
export type { WaterContact, WaterDisturbance } from './disturbances.js';
export { WaterHydrodynamics } from './voxel-hydrodynamics.js';
export declare function waterPhysicalConfig(overrides?: Partial<FluidConfigValues>): FluidConfig;
export declare function createWaterWorld(options?: {
    readonly physical?: Partial<FluidConfigValues>;
    readonly voxels?: VoxelOptions;
}): VoxelWorld;
//# sourceMappingURL=index.d.ts.map