import { FluidConfig } from '../../config.js';
import type { FluidConfigValues } from '../../config.js';
import { Vec3 } from '../../math.js';
import { VoxelWorld } from '../../voxel/world.js';
import type { VoxelOptions } from '../../voxel/world.js';

export { WaterDisturbances } from './disturbances.js';
export type { WaterContact, WaterDisturbance } from './disturbances.js';
export { WaterHydrodynamics } from './voxel-hydrodynamics.js';

export function waterPhysicalConfig(overrides: Partial<FluidConfigValues> = {}): FluidConfig {
  return FluidConfig.create({restDensityKgM3: 1000, gravityMS2: Vec3.of(0, -9.81, 0),
    maxSubstepSeconds: 1 / 120, maxSubsteps: 32, ...overrides});
}

export function createWaterWorld(options: {
  readonly physical?: Partial<FluidConfigValues>;
  readonly voxels?: VoxelOptions;
} = {}): VoxelWorld {
  return new VoxelWorld(waterPhysicalConfig(options.physical), options.voxels);
}
