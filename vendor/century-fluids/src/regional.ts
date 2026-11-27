/** Derived regional activity; no second solver or persistent physical state. */
import {ChunkVoxelIndex} from './chunks.js';
import {restCompression} from './liquid.js';
import type {ParticleSnapshot} from './particles.js';
import type {FluidConfig} from './config.js';
import type {LiquidSolverConfig} from './liquid.js';
export interface RegionalPhysicsStats {
 readonly mode:'full'|'partial'|'rest'; readonly totalChunks:number;
 readonly activeChunks:number;readonly restingChunks:number;
 readonly activeParticles:number;readonly restingParticles:number;
}
export interface RegionalPlan {
 readonly activeIndices:readonly number[];readonly restingCompressionSum:number;
 readonly restingCompressionMax:number;readonly stats:RegionalPhysicsStats;
}
export function scheduleRegionalPhysics(frame:ParticleSnapshot,physical:FluidConfig,s:LiquidSolverConfig,
  hasBoundaries:boolean,forceWake:boolean):RegionalPlan {
 const n=frame.count,g=physical.gravityMS2,h=s.supportRadiusMeters;
 const disabled=forceWake||hasBoundaries||g.x!==0||g.y!==0||g.z!==0;
 if(disabled)return {activeIndices:[],restingCompressionSum:0,restingCompressionMax:0,
  stats:Object.freeze({mode:'full',totalChunks:0,activeChunks:0,restingChunks:0,activeParticles:n,restingParticles:0})};
 const grid=new ChunkVoxelIndex(frame.positionsXYZ,n,h),chunks=new Map<string,readonly number[]>(),keys=new Array<string>(n);
 grid.forEachChunkMembers((key,indices)=>{chunks.set(key,indices);for(const i of indices)keys[i]=key;});
 const full=():RegionalPlan=>({activeIndices:[],restingCompressionSum:0,restingCompressionMax:0,
  stats:Object.freeze({mode:'full',totalChunks:grid.chunkCount,activeChunks:grid.chunkCount,
   restingChunks:0,activeParticles:n,restingParticles:0})});
 const active=new Set<string>(),v=frame.velocitiesXYZ,p=frame.positionsXYZ;
 for(const [key,indices] of chunks)for(const i of indices){const k=i*3;
  if(v[k]!==0||v[k+1]!==0||v[k+2]!==0){active.add(key);break;}}
 if(active.size===chunks.size)return full();
 const compression=restCompression(frame,physical.restDensityKgM3,h);
 for(const [key,indices] of chunks)if(!active.has(key)){
  if(indices.some(i=>compression[i]!>s.densityToleranceRelative))active.add(key);
 }
 if(active.size===chunks.size)return full();
 if(active.size){
  // The validated CFL bound limits travel to maxSubsteps*cflFraction*h over one host step.
  // Include h for the SPH support radius; wake chunks on both sides of chunk seams.
  const influence=h*(1+s.cflFraction*physical.maxSubsteps)*(1+1e-10);
  const halo=new ChunkVoxelIndex(p,n,influence);
  // Visit newly activated chunks too. Pressure can propagate across a chain of
  // contacts in one solver step, even when each particle travels very little.
  // Set iteration also visits keys inserted by the callback.
  for (const key of active) {
   for (const i of chunks.get(key)!) {
    const k=3*i;
    halo.forEachNearby(p[k]!,p[k+1]!,p[k+2]!,j=>{active.add(keys[j]!);},true);
   }
   if (active.size===chunks.size) return full();
  }
 }
 if(active.size===chunks.size)return full();
 let sum=0,max=0;
 for(const [key,indices] of chunks)if(!active.has(key))for(const i of indices){
  const c=compression[i]!;sum+=c;max=Math.max(max,c);
 }
 const activeIndices:number[]=[];for(let i=0;i<n;i++)if(active.has(keys[i]!))activeIndices.push(i);
 return {activeIndices,restingCompressionSum:sum,restingCompressionMax:max,
  stats:Object.freeze({mode:activeIndices.length?'partial':'rest',totalChunks:grid.chunkCount,
   activeChunks:active.size,restingChunks:grid.chunkCount-active.size,
   activeParticles:activeIndices.length,restingParticles:n-activeIndices.length})};
}
export function subsetFrame(frame:ParticleSnapshot,indices:readonly number[]):ParticleSnapshot {
 const count=indices.length,ids=new Float64Array(count),positionsXYZ=new Float64Array(3*count),
  velocitiesXYZ=new Float64Array(3*count),massesKg=new Float64Array(count);
 for(let j=0;j<count;j++){const i=indices[j]!,a=3*i,b=3*j;
  ids[j]=frame.ids[i]!;massesKg[j]=frame.massesKg[i]!;
  for(let k=0;k<3;k++){positionsXYZ[b+k]=frame.positionsXYZ[a+k]!;velocitiesXYZ[b+k]=frame.velocitiesXYZ[a+k]!;}
 }return Object.freeze({count,ids,positionsXYZ,velocitiesXYZ,massesKg});
}
export function mergeWorkingSet(target:ParticleSnapshot,source:ParticleSnapshot,indices:readonly number[]):void {
 for(let j=0;j<indices.length;j++){const i=indices[j]!,a=3*i,b=3*j;
  for(let k=0;k<3;k++){target.positionsXYZ[a+k]=source.positionsXYZ[b+k]!;
   target.velocitiesXYZ[a+k]=source.velocitiesXYZ[b+k]!;}
 }
}
