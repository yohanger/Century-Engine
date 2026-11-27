/** Production playground consumer, with JoltPhysics.js from the pinned WASM package. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createJoltHost} from '../playground/src/jolt-runtime.mjs';
import {SimulationSession} from '../playground/src/simulation.mjs';
import {localInCup} from '../playground/src/cup.mjs';

const pkg=JSON.parse(await readFile(new URL('../playground/node_modules/jolt-physics/package.json',import.meta.url)));
assert.equal(pkg.version,'1.1.0');
const host=await createJoltHost();
const session=new SimulationSession({scenarioId:'cup',jolt:host,foam:true});
const stages=[
  {name:'settle',x:0,y:.60,tilt:0,steps:130},
  {name:'dip',x:0,y:.072,tilt:0,steps:185},
  {name:'fill',x:0,y:.072,tilt:0,steps:85},
  {name:'lift',x:0,y:.65,tilt:0,steps:190},
  {name:'move',x:.18,y:.65,tilt:0,steps:80},
  {name:'hold',x:.18,y:.65,tilt:0,steps:100},
  {name:'pour',x:.17,y:.75,tilt:-2.07,steps:385},
  {name:'end',x:.17,y:.75,tilt:-2.07,steps:80},
];

function momentum(frame) {
  const sum=[0,0,0];
  for(let i=0;i<frame.count;i++)for(let k=0;k<3;k++)sum[k]+=frame.massesKg[i]*frame.velocitiesXYZ[3*i+k];
  return sum;
}
const tests=[], elapsed=[], waterMass=session.world.totalMassKg, dt=1/120;
let limits=0, peakDepth=0, momentumError=0, captured=0, spills=0, liftedVertices=0, liftedIds, frame=session.snapshot();
try{
  assert.equal(session.world.boundaryCount,10,'five tank faces and five borrowed compound faces');
  for(const stage of stages){
    assert.ok(session.setCupTarget({x:stage.x,y:stage.y,z:0},stage.tilt));
    for(let tick=0;tick<stage.steps;tick++){
      const previous=session.cupContents, before=momentum(frame), start=performance.now();
      const report=session.step(dt);
      elapsed.push(performance.now()-start);
      frame=session.snapshot();
      const after=momentum(frame), j=[0,0,0];
      for(const r of report.boundaryReactions){
        j[0]+=r.impulseOnBoundaryNs.x;j[1]+=r.impulseOnBoundaryNs.y;j[2]+=r.impulseOnBoundaryNs.z;
      }
      momentumError=Math.max(momentumError,Math.hypot(after[0]-before[0]+j[0],
        after[1]-before[1]+j[1]+waterMass*9.81*dt,after[2]-before[2]+j[2]));
      assert.equal(report.totalMassKg,waterMass);
      peakDepth=Math.max(peakDepth,report.maximumBoundaryPenetrationMeters);
      if(report.convergence==='iteration_limit')limits++;
      if(['lift','move','hold','pour','end'].includes(stage.name)){
        const now=session.cupContents;
        const pose=session.cupTransform;
        for(const id of previous.ids.filter(id=>!now.ids.includes(id))){
          const i=frame.ids.indexOf(id);
          const point=localInCup(pose,...frame.positionsXYZ.subarray(3*i,3*i+3));
          assert.ok(point[1]>=session.spec.cup.rim-.002,'a particle left through a wall or the floor');
          spills++;
        }
        if(stage.name==='move'||stage.name==='hold')assert.deepEqual(now.ids,liftedIds);
      }
    }
    const contents=session.cupContents;
    if(stage.name==='fill'){captured=contents.massKg;assert.ok(captured>0);}
    if(stage.name==='lift'){
      liftedIds=contents.ids;
      assert.equal(contents.massKg,captured);
      const pose=session.cupTransform;
      assert.ok(pose.position[1]>.6);
      const mesh=session.extract({cellSizeMeters:.08,maxGridPoints:60000});
      for(let i=0;i<mesh.positionsXYZ.length;i+=3){
        const [x,y,z]=localInCup(pose,...mesh.positionsXYZ.subarray(i,i+3));
        if(y>.03&&y<session.spec.cup.rim&&Math.abs(x)<session.spec.cup.outside&&Math.abs(z)<session.spec.cup.outside)
          liftedVertices++;
      }
      assert.ok(liftedVertices>0,'the raised water was lost by the surface reconstruction');
    }
    tests.push({stage:stage.name,massKg:contents.massKg,ids:contents.ids,pose:session.cupTransform,workJ:session.cupWorkJ});
  }
  assert.equal(session.cupContents.massKg,0);
  assert.ok(spills>0);
  assert.ok(peakDepth<=1e-6);
  assert.ok(momentumError<1e-9);
}finally{session.shutdown();}

for(let i=0;i<3;i++){
  const reopened=new SimulationSession({scenarioId:'cup',jolt:host});
  try{assert.equal(reopened.cupContents.massKg,0);reopened.step(dt);}
  finally{reopened.shutdown();}
}
host.shutdown();
elapsed.sort((a,b)=>a-b);
console.log(JSON.stringify({jolt:pkg.version,dt,steps:elapsed.length,waterMassKg:waterMass,stages:tests,
  peakDepth,iterationLimitSteps:limits,cupSpillsThroughMouth:spills,liftedSurfaceVertices:liftedVertices,maximumMomentumErrorNs:momentumError,
  physicsMsP50:elapsed[Math.ceil(elapsed.length*.5)-1],physicsMsP95:elapsed[Math.ceil(elapsed.length*.95)-1],
  maxRssKiB:process.resourceUsage().maxRSS,reopenCycles:3},null,2));
