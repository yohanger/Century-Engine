import { createWaterWorld, waterPhysicalConfig, waterSolverConfig } from '@century/fluids/water';
/** One host-independent probe, run from the *packed and installed* package in Node and in Vite. */
import { FluidWorld, FluidConfig, Vec3, FluidError } from '@century/fluids';

export function runProbe() {
  const world = createWaterWorld();
  const id = world.addParticle({
    position: Vec3.of(0, 1, 0),
    velocity: Vec3.zero(),
    massKg: 1,
  });
  try {
    const step = world.step(0.005);
    const snapshot = world.particleSnapshot();
    const result = {
      id,
      count: snapshot.count,
      y: snapshot.positionsXYZ[1],
      vy: snapshot.velocitiesXYZ[1],
      mass: world.totalMassKg,
      convergence: step.convergence,
    };
    if (result.id !== 1 || result.count !== 1 || result.mass !== 1 || result.convergence !== 'converged') {
      throw new Error('S05_PROBE_INVARIANT_FAILED');
    }
    if (!Number.isFinite(result.y) || !Number.isFinite(result.vy) || result.y >= 1 || result.vy >= 0) {
      throw new Error('S05_PROBE_PHYSICS_FAILED');
    }
    snapshot.positionsXYZ[1] = 999;
    if (world.getParticle(id).position.y !== result.y) {
      throw new Error('S05_PROBE_SNAPSHOT_ALIASING');
    }
    return result;
  } finally {
    world.shutdown();
    try {
      world.getParticle(id);
      throw new Error('S05_PROBE_CLOSED_WORLD_USABLE');
    } catch (error) {
      if (!(error instanceof FluidError && error.code === 'CLOSED')) throw error;
    }
  }
}
