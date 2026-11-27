import { Vec3 } from '../math.js';
import { VoxelWorld } from '../voxel/world.js';
export interface VoxelSurfaceMesh {
    readonly positionsXYZ: Float32Array;
    readonly normalsXYZ: Float32Array;
    readonly vertexKeys: Float64Array;
    readonly indices: Uint32Array;
    readonly depthMeters: Float32Array;
    readonly agitation: Float32Array;
    readonly vertexCount: number;
    readonly triangleCount: number;
    readonly bounds: {
        readonly min: Vec3;
        readonly max: Vec3;
    };
}
export interface VoxelSurfaceOptions {
    readonly smoothing?: number;
    readonly maxTriangles?: number;
    readonly maxChunks?: number;
    readonly timeBudgetMs?: number;
}
export interface VoxelSurfaceUpdate {
    readonly pending: boolean;
    readonly revision: number;
    readonly changes: readonly {
        readonly key: string;
        readonly mesh: VoxelSurfaceMesh | null;
    }[];
    readonly chunks: number;
    readonly rebuilt: number;
    readonly reused: number;
    readonly triangles: number;
}
/** Detached render buffers. Each consumer keeps its own mesh cursor and can pause independently. */
export declare class VoxelSurfaceCache {
    #private;
    reset(): void;
    update(world: VoxelWorld, options?: VoxelSurfaceOptions): VoxelSurfaceUpdate;
}
//# sourceMappingURL=voxel.d.ts.map