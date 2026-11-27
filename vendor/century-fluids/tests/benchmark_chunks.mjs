/** Non-gating A/B: same snapshot, full surface vs derived chunk cache (one local change). */
import {performance} from 'node:perf_hooks';
import {createWaterWorld,waterSurfaceConfig} from '../dist/fluids/water/index.js';
import {ChunkedSurfaceCache,extractSurface} from '../dist/surface/index.js';
import {ChunkVoxelIndex} from '../dist/index.js';
const world=createWaterWorld();
const particles=[];
for(const anchor of [-.8,.8])for(let x=0;x<5;x++)for(let y=0;y<5;y++)for(let z=0;z<5;z++){
 particles.push({position:{x:anchor+x*.105,y:.35+y*.105,z:-.22+z*.105},massKg:1.728});
}
// Build detached benchmark input: no browser, Jolt or fake physical step.
const build=(data)=>({count:data.length,ids:new Float64Array(data.map((_,i)=>i+1)),
 positionsXYZ:new Float64Array(data.flatMap(p=>[p.position.x,p.position.y,p.position.z])),
 velocitiesXYZ:new Float64Array(data.length*3),massesKg:new Float64Array(data.map(p=>p.massKg))});
const before=build(particles),config=waterSurfaceConfig(world,{cellSizeMeters:.08,maxGridPoints:90000,maxTriangles:150000});
const cache=new ChunkedSurfaceCache(8);
const initialStart=performance.now(),initial=cache.update(before,config),initialMs=performance.now()-initialStart;
const repeat=cache.update(before,config);
particles[0].position.x+=.012;
const moved=build(particles);
const fullStart=performance.now(),full=extractSurface(moved,config),fullMs=performance.now()-fullStart;
const localStart=performance.now(),local=cache.update(moved,config),localMs=performance.now()-localStart;
const index=new ChunkVoxelIndex(moved.positionsXYZ,moved.count,config.influenceRadiusMeters,moved.massesKg);
const mass=index.snapshot().reduce((n,c)=>n+c.massKg,0),reference=moved.massesKg.reduce((a,b)=>a+b,0);
if(Math.abs(mass-reference)>1e-8||full.triangleCount===0||full.triangleCount!==local.triangles||initial.chunks===0||repeat.rebuilt!==0||
   local.rebuilt===0||local.reused<=0||!(fullMs>0&&localMs>0))throw Error('chunk benchmark invariants failed');
console.log(JSON.stringify({label:'S09 chunked surface non-gating CPU A/B',particles:moved.count,
 occupiedVoxelChunks:index.chunkCount,initialChunks:initial.chunks,
 initialRebuilds:initial.rebuilt,initialMs:+initialMs.toFixed(3),
 localRebuilds:local.rebuilt,localReused:local.reused,localTriangles:local.triangles,
 fullTriangles:full.triangleCount,fullRebuildMs:+fullMs.toFixed(3),incrementalRebuildMs:+localMs.toFixed(3),
 speedupLocal:+(fullMs/localMs).toFixed(2),massKg:mass,rssBytes:process.memoryUsage().rss}));
console.log('S09_CHUNK_AB_PASS benchmark=NON_GATING solver_sleep=CONSERVATIVE_CONT002 browser=NOT_VERIFIED');
world.shutdown();
