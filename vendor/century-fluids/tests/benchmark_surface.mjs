/** Non-gating S07 diagnostic; never claims a specific FPS or GPU outcome. */
import {performance} from 'node:perf_hooks';
import {createWaterWorld,extractWaterSurface} from '../dist/fluids/water/index.js';
import {Vec3} from '../dist/index.js';
const world=createWaterWorld(),particles=[];
for(let x=0;x<6;x++)for(let y=0;y<6;y++)for(let z=0;z<6;z++)particles.push({position:Vec3.of(x*.12,y*.12+1,z*.12),velocity:Vec3.zero(),massKg:1.728});
world.emitParticles(particles);
const start=performance.now();const mesh=extractWaterSurface(world);const elapsedMs=performance.now()-start;
const massKg=world.totalMassKg, massVolume=massKg/world.getConfig().restDensityKgM3;
console.log(JSON.stringify({label:'S07 surface non-gating benchmark',particles:world.particleCount,
  triangles:mesh.triangleCount,vertices:mesh.vertexCount,gridPoints:mesh.gridPoints,
  elapsedMs:+elapsedMs.toFixed(2),particleMassKg:massKg,
  referenceVolumeFromMassM3:massVolume,approximateSignedMeshVolumeM3:mesh.approximateSignedVolumeM3,
  relativeVolumeDifference:Math.abs(mesh.approximateSignedVolumeM3-massVolume)/massVolume,
  rssBytes:process.memoryUsage().rss}));
if(mesh.vertexCount===0||!Number.isFinite(mesh.approximateSignedVolumeM3)||mesh.approximateSignedVolumeM3<=0)
  throw new Error('S07 benchmark invalid geometry');
world.shutdown();
