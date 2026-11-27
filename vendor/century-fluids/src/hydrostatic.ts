/** Conservative exact discrete fixed-point certificate for gravity-supported liquid.
 * It does not predict hydrostatic equilibrium or introduce a pressure model.
 * An unchanged solver state is reusable ONLY for identical timestep and unchanged inputs.
 */
import {ChunkVoxelIndex} from './chunks.js';
import type {FluidConfig} from './config.js';
import type {LiquidSolverConfig,LiquidStepResult} from './liquid.js';
import type {Boundary} from './boundaries.js';
import type {ParticleSnapshot} from './particles.js';
import type {RegionalPhysicsStats} from './regional.js';

/** Never accept an approximate or converged-but-moving body as a sleeping fixed point. */
export function certifyHydrostaticFixedPoint(before:ParticleSnapshot,after:ParticleSnapshot,
  physical:FluidConfig,solver:LiquidSolverConfig,boundaries:readonly Boundary[],
  result:LiquidStepResult):RegionalPhysicsStats|null {
 const g=physical.gravityMS2;
 if(before.count===0||before.count!==after.count || !boundaries.length ||
    (g.x===0&&g.y===0&&g.z===0) || result.convergence!=='converged' ||
    result.maximumDensityCompressionRelative>solver.densityToleranceRelative ||
    result.maximumDivergencePerSecond>solver.divergenceTolerancePerSecond ||
    result.boundaryContacts===0 || result.maximumBoundaryPenetrationMeters>1e-6)return null;
 for(const b of boundaries){
  if(b.velocity.x!==0||b.velocity.y!==0||b.velocity.z!==0||
     b.angularVelocity.x!==0||b.angularVelocity.y!==0||b.angularVelocity.z!==0)return null;
 }
 // Exact equality is intentional. No arbitrary velocity/position epsilon is allowed:
 // a slow drift must never be hidden by sleep.
 for(let i=0;i<before.count;i++){
  if(before.ids[i]!==after.ids[i] || before.massesKg[i]!==after.massesKg[i])return null;
 }
 for(let k=0;k<before.positionsXYZ.length;k++){
  if(!Object.is(before.positionsXYZ[k],after.positionsXYZ[k]) ||
     !Object.is(before.velocitiesXYZ[k],after.velocitiesXYZ[k]) ||
     before.velocitiesXYZ[k]!==0)return null;
 }
 const chunks=new ChunkVoxelIndex(after.positionsXYZ,after.count,solver.supportRadiusMeters);
 return Object.freeze({mode:'rest',totalChunks:chunks.chunkCount,activeChunks:0,
  restingChunks:chunks.chunkCount,activeParticles:0,restingParticles:after.count});
}
