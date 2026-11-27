import { FluidError, requirePositive } from './error.js';
import { Vec3 } from './math.js';

/** All values are SI: kilograms, meters, and seconds; this is not a solver preset. */
export interface FluidConfigValues {
  readonly restDensityKgM3: number;
  readonly gravityMS2: Vec3;
  readonly maxSubstepSeconds: number;
  readonly maxSubsteps: number;
}

/** Validated, frozen configuration; changes replace the whole value atomically. */
export class FluidConfig implements FluidConfigValues {
  readonly restDensityKgM3: number;
  readonly gravityMS2: Vec3;
  readonly maxSubstepSeconds: number;
  readonly maxSubsteps: number;

  private constructor(values: FluidConfigValues) {
    this.restDensityKgM3 = values.restDensityKgM3;
    this.gravityMS2 = values.gravityMS2;
    this.maxSubstepSeconds = values.maxSubstepSeconds;
    this.maxSubsteps = values.maxSubsteps;
    Object.freeze(this);
  }

  static create(values: FluidConfigValues): FluidConfig {
    if (values === null || typeof values !== 'object') {
      throw new FluidError('INVALID_ARGUMENT', 'configuration must be an object', 'config');
    }
    requirePositive(values.restDensityKgM3, 'restDensityKgM3');
    requirePositive(values.maxSubstepSeconds, 'maxSubstepSeconds');
    if (!(values.gravityMS2 instanceof Vec3)) {
      throw new FluidError('INVALID_ARGUMENT', 'gravityMS2 must be a validated Vec3', 'gravityMS2');
    }
    if (!Number.isSafeInteger(values.maxSubsteps) || values.maxSubsteps <= 0) {
      throw new FluidError('OUT_OF_RANGE', 'maxSubsteps must be a positive safe integer', 'maxSubsteps');
    }
    return new FluidConfig(values);
  }

}
