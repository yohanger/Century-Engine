/** CONT-004: deterministic stage measurements on the existing SPH solver.
 * Diagnostic callback does not change the solver path, configuration, or tolerance.
 */
import { Vec3 } from '../dist/index.js';
import { createWaterWorld, waterSolverConfig } from '../dist/fluids/water/index.js';
import { simulateLiquid } from '../dist/liquid.js';
const v=(x,y,z)=>Vec3.of(x,y,z),dt=1/120;
function fixture(side){
 const w=createWaterWorld({solver:side===6?{supportRadiusMeters:.3,particleContactRadiusMeters:.025}: {}});
 const right=side===6?.85:.6,top=side===6?2.5:null;
 for(const [point,normal] of [
  [v(0,0,0),v(0,1,0)], ...(top!==null?[[v(0,top,0),v(0,-1,0)]]:[]),
  [v(-.15,0,0),v(1,0,0)],[v(right,0,0),v(-1,0,0)],
  [v(0,0,-.15),v(0,0,1)],[v(0,0,right),v(0,0,-1)]
 ])w.addBoundary({kind:'plane',point,normal});
 for(let x=0;x<side;x++)for(let y=0;y<side;y++)for(let z=0;z<side;z++)
  w.addParticle({position:v(x*.11,.03+y*.11,z*.11),velocity:Vec3.zero(),massKg:1000*.11**3});
 return w;
}
function characterize(side,frames){
 const w=fixture(side), frame=w.particleSnapshot();
 const physical=w.getConfig(), solver=w.getLiquidConfig(), boundaries=w.boundarySnapshot();
 const summary={side,particles:frame.count,frames,substeps:0,iterationLimitFrames:0,
  divergenceIterationLimits:0,densityIterationLimits:0,contactSubsteps:0,
  maxAfterPressureRate:0,maxAfterContactsRate:0,maxCompression:0,
  samples:[]};
 let mass=frame.massesKg.reduce((a,b)=>a+b,0);
 for(let i=0;i<frames;i++){
  let substepCount=0, densityLimit=0, divergenceLimit=0, contacts=0,
   postProjection=0,postContacts=0,maxStartCompression=0,maxEndCompression=0;
  const r=simulateLiquid(frame,dt,physical,solver,boundaries,e=>{
   substepCount++;summary.substeps++;
   if(!e.densityProjection.converged){densityLimit++;summary.densityIterationLimits++;}
   if(!e.divergenceProjection.converged){divergenceLimit++;summary.divergenceIterationLimits++;}
   if(e.contactsAdded>0){contacts++;summary.contactSubsteps++;}
   postProjection=Math.max(postProjection,e.divergenceAfterProjectionPerSecond);
   postContacts=Math.max(postContacts,e.divergenceAfterContactsPerSecond);
   maxStartCompression=Math.max(maxStartCompression,e.compressionBeforeRelative);
   maxEndCompression=Math.max(maxEndCompression,e.compressionAfterContactsRelative);
   if(i===0 && e.substep===0)summary.firstSubstep={...e};
  });
  if(r.convergence==='iteration_limit')summary.iterationLimitFrames++;
  summary.maxAfterPressureRate=Math.max(summary.maxAfterPressureRate,postProjection);
  summary.maxAfterContactsRate=Math.max(summary.maxAfterContactsRate,postContacts);
  summary.maxCompression=Math.max(summary.maxCompression,maxEndCompression);
  if([0,1,7,10,50,100,200,239].includes(i) || i===frames-1)
   summary.samples.push({step:i,convergence:r.convergence,densityLimit,divergenceLimit,contacts,
    postProjection,postContacts,maxStartCompression,maxEndCompression,
    finalMaxCompression:r.maximumDensityCompressionRelative,
    finalMaxDivergence:r.maximumDivergencePerSecond});
  if(Math.abs(mass-r.totalMassKg)>1e-9)throw Error('mass changed');
 }
 w.shutdown();return summary;
}
const results=[characterize(4,240),characterize(6,8)];
// Historic CONT-004 original baseline recorded 196/240 and 5/8 iteration_limit.
// Current solver must improve, not merely reinterpret the convergence flag.
const historicalIterationLimits=[196,5];
for(const report of results)console.log('CONT004_NUMERICAL_CHARACTERIZATION',JSON.stringify(report));
if(results.some((x,i)=>x.iterationLimitFrames>=historicalIterationLimits[i]))
 throw Error('boundary-coupled solver failed to improve CONT004 historical convergence baseline');
if(results.some(x=>x.densityIterationLimits>0||x.divergenceIterationLimits>0))
 throw Error('unexpected pressure projection iteration exhaustion during characterized tanks');
console.log('CONT005_COUPLED_CONVERGENCE_PASS historical_limits=196,5 current='+results.map(x=>x.iterationLimitFrames).join(',')+' tolerance=UNCHANGED');
