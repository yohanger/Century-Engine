import { Vec3 } from './math.js';
/** All values are SI: kilograms, meters, and seconds; this is not a solver preset. */
export interface FluidConfigValues {
    readonly restDensityKgM3: number;
    readonly gravityMS2: Vec3;
    readonly maxSubstepSeconds: number;
    readonly maxSubsteps: number;
}
/** Validated, frozen configuration; changes replace the whole value atomically. */
export declare class FluidConfig implements FluidConfigValues {
    readonly restDensityKgM3: number;
    readonly gravityMS2: Vec3;
    readonly maxSubstepSeconds: number;
    readonly maxSubsteps: number;
    private constructor();
    static create(values: FluidConfigValues): FluidConfig;
}
//# sourceMappingURL=config.d.ts.map