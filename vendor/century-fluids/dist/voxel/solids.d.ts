import type { Boundary } from '../boundaries.js';
import type { Coordinates } from './grid.js';
type Axis = 0 | 1 | 2;
export declare function boundarySpeed(b: Boundary): number;
export declare function advanceSolid(b: Boundary, dt: number): Boundary;
export type CellGeometry = {
    readonly capacity: number;
    readonly floor: number;
    readonly ceiling: number;
    readonly centerX?: number;
    readonly centerZ?: number;
};
export declare class VoxelSolids {
    #private;
    constructor(boundaries: readonly Boundary[], h: number, previous?: VoxelSolids);
    get hasMoving(): boolean;
    affected(key: number, padding: number, includeInterior?: boolean): boolean;
    geometry(key: number): CellGeometry;
    opening(key: number, axis: Axis, sweep?: Boundary): number;
    /** Resolve a shallow path that falls between the fixed heights of the face samples. */
    terrainOpeningAtSurface(key: number, axis: 0 | 2, surfaceY: number, direction: -1 | 1): number;
    blocking(key: number, axis: Axis): Boundary | undefined;
    pinching(key: number): Boundary | undefined;
    displacementDirection(boundary: Boundary, key: number): Coordinates;
}
export declare function checkedNeighbor(key: number, axis: Axis, sign: number): number;
export declare const faceBase: (a: number, b: number, axis: Axis) => number;
export {};
//# sourceMappingURL=solids.d.ts.map