import { Vec3 } from './math.js';
/** Immutable unit quaternion, xyzw, for optional oriented rigid boundaries. */
export declare class Quat {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
    private constructor();
    static identity(): Quat;
    static of(x: number, y: number, z: number, w: number): Quat;
}
export declare function rotated(v: Vec3, q: Quat, inverse?: boolean): Vec3;
/** Advance a world-space angular velocity over the current physical substep. */
export declare function rotationIncrement(omega: Vec3, dt: number): Quat;
export declare function composed(a: Quat, b: Quat): Quat;
//# sourceMappingURL=rotation.d.ts.map