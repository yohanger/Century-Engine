export type Coordinates = readonly [number, number, number];
export type CellState = readonly [volume: number, vx: number, vy: number, vz: number];
export declare const emptyCell: CellState;
export declare const chunkSide = 8;
export declare function cellKey(x: number, y: number, z: number): number;
export declare function coordinates(key: number): Coordinates;
export declare const axes: readonly [1, number, number];
export declare const directions: readonly [1, -1, number, number, number, number];
export declare function chunkKey(x: number, y: number, z: number): number;
export declare class VoxelGrid {
    #private;
    count: number;
    get chunkCount(): number;
    volume(key: number): number;
    read(key: number): CellState;
    write(key: number, state: CellState): void;
    keys(bounds?: readonly [Coordinates, Coordinates]): IterableIterator<number>;
    clear(): void;
}
//# sourceMappingURL=grid.d.ts.map