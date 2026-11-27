/** S07 water specialization; no water constants or automatic assumptions in core. */
import { FluidConfig } from '../../config.js';
import { LiquidSolverConfig } from '../../liquid.js';
import { FluidWorld } from '../../world.js';
import { Vec3 } from '../../math.js';
import type { ParticleLimits } from '../../particles.js';
import type { FluidConfigValues } from '../../config.js';
import type { LiquidSolverOptions } from '../../liquid.js';
import { waterFoamModel } from './foam.js';
import type { WaterFoamSnapshot } from './foam.js';
export type { WaterFoamSnapshot } from './foam.js';
export { WaterHydrodynamics } from './hydrodynamics.js';
export { extractWaterSurface, waterSurfaceConfig } from './surface.js';

/** Parameter values are documented reference values, not a universal calibration. */
export function waterPhysicalConfig(overrides: Partial<FluidConfigValues> = {}): FluidConfig {
  return FluidConfig.create({ restDensityKgM3: 1000, gravityMS2: Vec3.of(0, -9.81, 0),
    maxSubstepSeconds: 1 / 120, maxSubsteps: 16, ...overrides });
}
export function waterSolverConfig(overrides: Partial<LiquidSolverOptions> = {}): LiquidSolverConfig {
  return LiquidSolverConfig.create({ supportRadiusMeters: .3, kinematicViscosityM2S: 1e-6,
    maxDensityIterations: 20, maxDivergenceIterations: 10, densityToleranceRelative: .01,
    divergenceTolerancePerSecond: .05, cflFraction: .35, ...overrides });
}
class FoamingWaterWorld extends FluidWorld {
  constructor(config: FluidConfig, limits?: ParticleLimits) {
    super(config,limits);
    this.enableParticleScalar(waterFoamModel);
  }
  foamSnapshot(): WaterFoamSnapshot {
    return Object.freeze({particles:this.particleSnapshot(),airVolumeM3:this.particleScalarSnapshot()!,
      entrainedM3:this.scalarBalance.added,releasedM3:this.scalarBalance.removed});
  }
}

export function waterFoamSnapshot(world: FluidWorld): WaterFoamSnapshot | null {
  return world instanceof FoamingWaterWorld ? world.foamSnapshot() : null;
}
export function createWaterWorld(options: {
  readonly physical?: Partial<FluidConfigValues>;
  readonly solver?: Partial<LiquidSolverOptions>;
  readonly limits?: ParticleLimits;
  /** Enables an experimental sub-resolution air model for this water world. */
  readonly foam?: boolean;
} = {}): FluidWorld {
  const config=waterPhysicalConfig(options.physical);
  const world=options.foam ? new FoamingWaterWorld(config,options.limits) : new FluidWorld(config,options.limits);
  world.setLiquidConfig(waterSolverConfig(options.solver));
  return world;
}
