import type { Coordinates } from '../voxel/grid.js';
import type { VoxelWorld } from '../voxel/world.js';
import type { VoxelSurfaceMesh } from './voxel.js';
/** Two vertical samples per physical cell resolve shallow surfaces without
 * subdividing the physical grid. A shared lattice edge owns each output face.
 */
export declare function buildWaterTile(world: VoxelWorld, tile: Coordinates, smoothing: number, budget: number): VoxelSurfaceMesh | null;
//# sourceMappingURL=water-field.d.ts.map