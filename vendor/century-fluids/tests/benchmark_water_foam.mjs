/** Run separately as 'on' and 'off' on the identical S09 dam fixture. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {cpus} from 'node:os';
import {SimulationSession} from '../playground/src/simulation.mjs';

const mode=process.argv[2];
assert.ok(['on','off'].includes(mode));
const foam=mode==='on';
const physics=[], surface=[];
let maximumAirM3=0,entrainedM3=0,releasedM3=0,limits=0,maximumPenetrationMeters=0;
for(let trial=0;trial<4;trial++){
  const session=new SimulationSession({scenarioId:'dam',foam});
  let inGas=0, outGas=0;
  const mass=session.world.totalMassKg;
  try{
    for(let step=0;step<180;step++){
      const t=performance.now(),report=session.step();
      if(trial)physics.push(performance.now()-t);
      assert.equal(report.totalMassKg,mass);
      if(trial){
        if(report.convergence==='iteration_limit')limits++;
        maximumPenetrationMeters=Math.max(maximumPenetrationMeters,report.maximumBoundaryPenetrationMeters);
      }
      const state=session.foamSnapshot();
      if(state){
        inGas+=state.entrainedM3;outGas+=state.releasedM3;
        const air=state.airVolumeM3.reduce((a,b)=>a+b,0);
        assert.ok(Math.abs(inGas-outGas-air)<1e-13);
        if(trial)maximumAirM3=Math.max(maximumAirM3,air);
      }
      if(step%12===0){
        const t=performance.now();
        session.extractChunks({cellSizeMeters:.08,maxGridPoints:60000,maxTriangles:100000});
        if(trial)surface.push(performance.now()-t);
      }
    }
    if(trial===1){entrainedM3=inGas;releasedM3=outGas;}
  }finally{session.shutdown();}
}
function percentiles(samples){
  const sorted=[...samples].sort((a,b)=>a-b);
  return {n:sorted.length,p50:sorted[Math.ceil(sorted.length*.50)-1],p95:sorted[Math.ceil(sorted.length*.95)-1]};
}
assert.equal(maximumAirM3>0,foam);
console.log(JSON.stringify({mode,node:process.version,cpu:cpus()[0]?.model,
  physicsMs:percentiles(physics),surfaceMs:percentiles(surface),maxRssKiB:process.resourceUsage().maxRSS,
  maximumAirM3,entrainedM3,releasedM3,limits,maximumPenetrationMeters},null,2));
