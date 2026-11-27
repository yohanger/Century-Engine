import type { VoxelHydrodynamicPolicy, VoxelHydroResult, VoxelHydroSample } from '../../voxel/coupling.js';
import type { VoxelWorld } from '../../voxel/world.js';
export declare class WaterHydrodynamics implements VoxelHydrodynamicPolicy {
    evaluate(world: VoxelWorld, sample: VoxelHydroSample, dt: number): VoxelHydroResult;
}
//# sourceMappingURL=voxel-hydrodynamics.d.ts.map