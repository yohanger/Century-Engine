import { FluidConfig } from '../../config.js';
import { Vec3 } from '../../math.js';
import { VoxelWorld } from '../../voxel/world.js';
export { WaterDisturbances } from './disturbances.js';
export { WaterHydrodynamics } from './voxel-hydrodynamics.js';
export function waterPhysicalConfig(overrides = {}) {
    return FluidConfig.create({ restDensityKgM3: 1000, gravityMS2: Vec3.of(0, -9.81, 0),
        maxSubstepSeconds: 1 / 120, maxSubsteps: 32, ...overrides });
}
export function createWaterWorld(options = {}) {
    return new VoxelWorld(waterPhysicalConfig(options.physical), options.voxels);
}
//# sourceMappingURL=index.js.map