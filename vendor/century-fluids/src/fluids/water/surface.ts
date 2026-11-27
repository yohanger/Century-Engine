/** Water-only surface policy. Uses generic implicit extractor without a second solver. */
import { FluidWorld } from '../../world.js';
import { SurfaceConfig, extractSurface } from '../../surface/mesh.js';
import type { SurfaceMesh, SurfaceOptions } from '../../surface/mesh.js';
import { FluidError } from '../../error.js';

export function waterSurfaceConfig(world:FluidWorld, overrides:Partial<SurfaceOptions>={}):SurfaceConfig {
  if(!(world instanceof FluidWorld)||world.state!=='ready')throw new FluidError('INVALID_ARGUMENT','water surface requires ready FluidWorld','world');
  const h=world.getLiquidConfig().supportRadiusMeters;
  const density=world.getConfig().restDensityKgM3;
  const meanParticleMassKg=world.particleCount?world.totalMassKg/world.particleCount:density*(h*.4)**3;
  const estimatedSpacing=Math.cbrt(meanParticleMassKg/density);
  const radius=Math.min(h,estimatedSpacing*4/3);
  // Reference estimate for volumetric particle packing, not a hard volume guarantee.
  // Callers may override any heuristic with a calibrated SurfaceConfig.
  return SurfaceConfig.create({cellSizeMeters:estimatedSpacing/3,influenceRadiusMeters:radius,
    isoLevel:.75,referenceParticleMassKg:meanParticleMassKg,...overrides});
}

export function extractWaterSurface(world:FluidWorld, options:SurfaceConfig|Partial<SurfaceOptions>={}):SurfaceMesh {
  const config=options instanceof SurfaceConfig?options:waterSurfaceConfig(world,options);
  return extractSurface(world.particleSnapshot(),config);
}
