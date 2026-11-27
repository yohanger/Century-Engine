/** S09 repeatable CPU/memory benchmark; rendering FPS and GPU memory require browser. */
import {performance} from 'node:perf_hooks';
import {createWaterWorld,extractWaterSurface} from '../dist/fluids/water/index.js';
import {Vec3} from '../dist/index.js';
import {makeScenario} from '../playground/src/scenarios.mjs';
const v=o=>Vec3.of(o.x,o.y,o.z);
const dt=1/120;const results=[];
for(const id of ['tank','dam','obstacle']){
 const s=makeScenario(id),w=createWaterWorld();
 const before=performance.now();
 w.emitParticles(s.particles.map(p=>({position:v(p.position),velocity:v(p.velocity),massKg:p.massKg})));
 for(const b of s.boundaries){const input={...b};if(b.point)input.point=v(b.point);if(b.normal)input.normal=v(b.normal);if(b.center)input.center=v(b.center);w.addBoundary(input);}
 const initMass=w.totalMassKg;
 let convergences=new Set();let sum=0;
 for(let i=0;i<12;i++){const t=performance.now(),report=w.step(dt);sum+=performance.now()-t;convergences.add(report.convergence);}
 const surfaceStart=performance.now();const mesh=extractWaterSurface(w,{cellSizeMeters:.08,maxGridPoints:60000,maxTriangles:100000});const surfaceMs=performance.now()-surfaceStart;
 if(mesh.triangleCount<=0||!Number.isFinite(surfaceMs)||!Number.isFinite(sum)||Math.abs(w.totalMassKg-initMass)>1e-7)throw Error(`S09 invalid physical scene ${id}`);
 results.push({scene:id,particles:s.particles.length,triangles:mesh.triangleCount,physicsMsPerStep:+(sum/12).toFixed(3),surfaceMs:+surfaceMs.toFixed(2),convergences:[...convergences],totalMs:+(performance.now()-before).toFixed(1)});
 w.shutdown();
}
// Repeated scene ownership cleanup without assuming a GC run or fixed RSS ceiling.
for(let n=0;n<50;n++){
 const w=createWaterWorld();w.addParticle({position:Vec3.of(0,1,0),velocity:Vec3.zero(),massKg:1});w.step(dt);w.shutdown();
 if(w.state!=='closed')throw Error('S09 failed to close world');
}
const metrics={label:'S09 playground CPU-only non-gating benchmark',results,lifecycleCycles:50,jsHeapUsedBytes:process.memoryUsage().heapUsed,rssBytes:process.memoryUsage().rss};
console.log(JSON.stringify(metrics));
console.log('S09_STRESS_CPU_PASS scenes=3 lifecycle=50 gpu=NOT_VERIFIED browser=NOT_VERIFIED');
