/** S09 CONT-005: source-backed numerical CPU characterization, NOT GPU FPS.
 * Acceptance compares solver convergence to preserved CONT004 baseline with
 * unchanged gravity, parameters, tank geometry and solver tolerances.
 */
import {performance} from 'node:perf_hooks';
import {Vec3} from '../dist/index.js';
import {createWaterWorld} from '../dist/fluids/water/index.js';
const v=(x,y,z)=>Vec3.of(x,y,z),dt=1/120;
const historical=[{side:4,frames:240,limits:196},{side:6,frames:8,limits:5}];
const outputs=[];
for(const {side,frames,limits} of historical){
 const w=createWaterWorld();
 const right=side===6?.85:.6;
 for(const [point,normal] of [[v(0,0,0),v(0,1,0)],...(side===6?[[v(0,2.5,0),v(0,-1,0)]]:[]),
   [v(-.15,0,0),v(1,0,0)],[v(right,0,0),v(-1,0,0)],[v(0,0,-.15),v(0,0,1)],[v(0,0,right),v(0,0,-1)]])
  w.addBoundary({kind:'plane',point,normal});
 for(let x=0;x<side;x++)for(let y=0;y<side;y++)for(let z=0;z<side;z++)
  w.addParticle({position:v(.11*x,.03+.11*y,.11*z),velocity:Vec3.zero(),massKg:1000*.11**3});
 const initialMass=w.totalMassKg,start=performance.now();
 let iterationLimits=0,maxPenetration=0,maxDivergence=0,maxSpeed=0,averageSpeed=0;
 for(let i=0;i<frames;i++){
  const report=w.step(dt);if(report.convergence==='iteration_limit')iterationLimits++;
  maxPenetration=Math.max(maxPenetration,report.maximumBoundaryPenetrationMeters);
  maxDivergence=Math.max(maxDivergence,report.maximumDivergencePerSecond);
 }
 const snapshot=w.particleSnapshot();
 for(let i=0;i<snapshot.count;i++){
  const k=3*i,speed=Math.hypot(snapshot.velocitiesXYZ[k],snapshot.velocitiesXYZ[k+1],snapshot.velocitiesXYZ[k+2]);
  maxSpeed=Math.max(maxSpeed,speed);averageSpeed+=speed;
 }
 averageSpeed/=snapshot.count;
 if(iterationLimits>=limits||maxPenetration>1e-6||Math.abs(w.totalMassKg-initialMass)>1e-8)
  throw Error(`S09 integral numeric regression: ${side}^3 (${iterationLimits}/${limits} failed, ${maxPenetration} penetration)`);
 outputs.push({side,particles:snapshot.count,frames,iterationLimitFrames:iterationLimits,originalIterationLimitFrames:limits,
  maxPenetrationMeters:maxPenetration,peakDivergencePerSecond:maxDivergence,
  maxFinalSpeedMPS:maxSpeed,averageFinalSpeedMPS:averageSpeed,
  physicsMs:+(performance.now()-start).toFixed(2),massKg:initialMass});
 w.shutdown();
}
console.log(JSON.stringify({label:'S09 CONT005 CPU numerical A/B (non gating performance; gating physics invariants)',tanks:outputs,
 rssBytes:process.memoryUsage().rss,nodeVersion:process.version}));
console.log('S09_CONT005_PHYSICS_CHARACTERIZATION_PASS convergence=IMPROVED_BUT_NONZERO gravity_region_sleep=NOT_CERTIFIED FPS=NOT_VERIFIED');
