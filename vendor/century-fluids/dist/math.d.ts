/** Immutable three-dimensional vector; the host chooses its axis convention. */
export declare class Vec3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    private constructor();
    static of(x: number, y: number, z: number): Vec3;
    static zero(): Vec3;
    toArray(): readonly [number, number, number];
}
//# sourceMappingURL=math.d.ts.map