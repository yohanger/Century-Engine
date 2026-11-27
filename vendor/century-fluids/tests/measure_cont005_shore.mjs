import {SimulationSession} from '../playground/src/simulation.mjs';
import {performance} from 'node:perf_hooks';
import {cpus} from 'node:os';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const dt=1/120, n=540;
const p95=numbers=>numbers.sort((a,b)=>a-b)[Math.floor((numbers.length-1)*.95)];
const median=numbers=>numbers.sort((a,b)=>a-b)[Math.floor((numbers.length-1)*.50)];
function momentum(snapshot){
  const sum=[0,0,0];
  for(let i=0;i<snapshot.count;i++)for(let k=0;k<3;k++)sum[k]+=snapshot.velocitiesXYZ[3*i+k]*snapshot.massesKg[i];
  return sum;
}
const metrics=[];
let driven;
for(const [name,waves,foam] of [['driven',true,true],['no-air',true,false],['stationary-paddle',false,true]]) {
  const session=new SimulationSession({scenarioId:'shore',foam});
  if(!waves)session.spec.wave.strokeMeters=0;
  const steps=[],meshes=[],trace=[];
  const initialMass=session.world.totalMassKg;
  let limits=0,maximumPenetration=0,runup=-Infinity,minimumAfterTwo=Infinity,peakAir=0,maximumBalanceError=0;
  let previousAir=0,addedTotal=0,releasedTotal=0, cumulativeImpulse=0;
  let maxMassError=0, maxDifference=0, maxMomentumError=0,maxCompression=0;
  let lastMomentum=momentum(session.snapshot());
  let cumulativePaddleImpulse=0;
  const poses=[];
  for(let i=1;i<=n;i++){
    const start=performance.now();
    const step=session.step(dt);
    if(i>60)steps.push(performance.now()-start);
    const snap=session.snapshot(),positions=snap.positionsXYZ;
    const front=Math.max(...positions.filter((_,j)=>j%3===2));
    maxMassError=Math.max(maxMassError,Math.abs(session.world.totalMassKg-initialMass));
    assert.ok(positions.every(Number.isFinite));
    if(name==='driven')poses.push(positions);
    if(name==='no-air')for(let j=0;j<positions.length;j++)maxDifference=Math.max(maxDifference,Math.abs(positions[j]-driven[i-1][j]));
    runup=Math.max(runup,front);
    if(i>240)minimumAfterTwo=Math.min(minimumAfterTwo,front);
    if(step.convergence==='iteration_limit')limits++;
    maximumPenetration=Math.max(maximumPenetration,step.maximumBoundaryPenetrationMeters);
    const f=session.foamSnapshot();
    const air=f?.airVolumeM3.reduce((s,v)=>s+v,0)??0;
    const added=f?.entrainedM3??0,released=f?.releasedM3??0;
    maximumBalanceError=Math.max(maximumBalanceError,Math.abs(previousAir+added-released-air));
    previousAir=air;addedTotal+=added;releasedTotal+=released;
    peakAir=Math.max(peakAir,air);
    maxCompression=Math.max(maxCompression,step.maximumDensityCompressionRelative);
    const nextMomentum=momentum(snap),wall=[0,0,0];
    for(const {impulseOnBoundaryNs:impulse} of step.boundaryReactions){
      wall[0]+=impulse.x;wall[1]+=impulse.y;wall[2]+=impulse.z;
    }
    cumulativeImpulse+=Math.hypot(...wall);
    cumulativePaddleImpulse+=Math.abs(step.boundaryReactions.at(-1).impulseOnBoundaryNs.z);
    maxMomentumError=Math.max(maxMomentumError,Math.hypot(
      nextMomentum[0]-lastMomentum[0]+wall[0],
      nextMomentum[1]-lastMomentum[1]+wall[1]+9.81*initialMass*dt,
      nextMomentum[2]-lastMomentum[2]+wall[2],
    ));
    lastMomentum=nextMomentum;
    if(i%12===0){
      const before=performance.now();
      const mesh=session.extractChunks({cellSizeMeters:.060,maxGridPoints:60000,maxTriangles:100000});
      meshes.push(performance.now()-before);
      trace.push({step:i,t:i*dt,front,airMl:air*1e6,triangles:mesh.triangles,rebuilt:mesh.rebuilt,reused:mesh.reused});
    }
  }
  if(name==='driven')driven=poses;
  const row={name,particles:session.particleCount,steps:n,massKg:initialMass,maxMassErrorKg:maxMassError,runupZ:runup,
    minimumRunupAfterTwoSecondsZ:minimumAfterTwo,limits,maximumPenetrationMeters:maximumPenetration,peakAirMl:peakAir*1e6,
    addedMl:addedTotal*1e6,releasedMl:releasedTotal*1e6,remainingMl:previousAir*1e6,maxGasBalanceErrorM3:maximumBalanceError,
    foamOnOffMaximumPositionDifferenceMeters:name==='no-air'?maxDifference:undefined,cumulativeImpulse,cumulativePaddleImpulse,maxMomentumError,maxCompression,stepMedianMs:median(steps),
    stepP95Ms:p95(steps),surfaceMedianMs:median(meshes),surfaceP95Ms:p95(meshes),trace};
  metrics.push(row);
  console.log(Object.fromEntries(Object.entries(row).filter(([key])=>key!=='trace')));
  session.shutdown();
}
const [moving,withoutAir,stationary]=metrics;
assert.ok(moving.runupZ>stationary.runupZ+.15,'driven wave must reach farther than initial settling');
assert.ok(moving.runupZ-moving.minimumRunupAfterTwoSecondsZ>.20,'moving shoreline must recede');
assert.ok(moving.peakAirMl>stationary.peakAirMl,'breaking interface added no measured air');
assert.equal(withoutAir.foamOnOffMaximumPositionDifferenceMeters,0);
for(const row of metrics){
  assert.equal(row.maxMassErrorKg,0);
  assert.ok(row.maxMomentumError<1e-8);
  assert.ok(row.maximumPenetrationMeters<1e-8);
  assert.ok(row.maxGasBalanceErrorM3<1e-14);
}
await writeFile(process.argv[2]??'shore-node.json',JSON.stringify({runtime:process.version,cpu:cpus()[0].model,metrics},null,2)+'\n');
