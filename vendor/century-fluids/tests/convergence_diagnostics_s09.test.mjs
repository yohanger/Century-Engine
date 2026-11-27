import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from '../dist/index.js';
import { createWaterWorld } from '../dist/fluids/water/index.js';
import { simulateLiquid } from '../dist/liquid.js';
const v=(x,y,z)=>Vec3.of(x,y,z),dt=1/120;
function makeTank(){
 const w=createWaterWorld();
 for(const [point,normal] of [
  [v(0,0,0),v(0,1,0)],[v(-.15,0,0),v(1,0,0)],
  [v(.6,0,0),v(-1,0,0)],[v(0,0,-.15),v(0,0,1)],[v(0,0,.6),v(0,0,-1)]
 ])w.addBoundary({kind:'plane',point,normal});
 for(let x=0;x<4;x++)for(let y=0;y<4;y++)for(let z=0;z<4;z++)
  w.addParticle({position:v(x*.11,.03+y*.11,z*.11),velocity:Vec3.zero(),massKg:1000*.11**3});
 return w;
}
function copy(f){return {...f,positionsXYZ:new Float64Array(f.positionsXYZ),velocitiesXYZ:new Float64Array(f.velocitiesXYZ)};}
test('S09 CONT004: optional numerical trace leaves particle state, reactions and convergence unchanged',()=>{
 const w=makeTank(),snap=w.particleSnapshot(),a=copy(snap),b=copy(snap),events=[];
 const args=[dt,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot()];
 const normal=simulateLiquid(a,...args), traced=simulateLiquid(b,...args,e=>events.push(e));
 assert.deepEqual(normal,traced);
 assert.deepEqual(a.positionsXYZ,b.positionsXYZ);
 assert.deepEqual(a.velocitiesXYZ,b.velocitiesXYZ);
 assert.equal(events.length,normal.substeps);
 assert.deepEqual(snap,w.particleSnapshot(),'solver scratch frame must not publish to FluidWorld');
 for(const e of events){
  assert.ok(Object.isFrozen(e));assert.ok(Object.isFrozen(e.divergenceProjection));
  for(const p of [e.divergenceProjection,e.densityProjection]){
   assert.ok(Object.isFrozen(p.residualHistoryPerSecond));
   assert.equal(p.residualHistoryPerSecond.length,p.iterations+1);
   assert.ok(p.residualHistoryPerSecond.every(x=>Number.isFinite(x)&&x>=0));
  }
 }w.shutdown();
});
test('S09 CONT005: first gravitational tank retains honest post-contact divergence when energy guard rejects correction',()=>{
 const w=makeTank(),events=[];
 const r=simulateLiquid(w.particleSnapshot(),dt,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot(),e=>events.push(e));
 assert.equal(events.length,1);assert.ok(r.boundaryContacts>0);
 const e=events[0];assert.equal(e.divergenceProjection.converged,true);
 assert.equal(e.densityProjection.converged,true);
 assert.ok(e.divergenceAfterProjectionPerSecond<=w.getLiquidConfig().divergenceTolerancePerSecond);
 assert.ok(e.divergenceBeforeCouplingPerSecond>w.getLiquidConfig().divergenceTolerancePerSecond);
 assert.ok(e.divergenceAfterContactsPerSecond<=e.divergenceBeforeCouplingPerSecond);
 assert.ok(e.boundaryCouplingPasses>0);
 assert.ok(e.contactsAdded>0);
 assert.equal(r.maximumDivergencePerSecond,e.divergenceAfterContactsPerSecond);
 assert.equal(r.convergence,'iteration_limit','do not claim convergence for rejected trial');
 assert.ok(r.maximumBoundaryPenetrationMeters<=1e-6);
 w.shutdown();
});
test('S09 CONT004: diagnostic stage data identifies unforced particle pair without inventing contacts',()=>{
 const w=createWaterWorld({physical:{gravityMS2:Vec3.zero()}});
 w.addParticle({position:v(0,0,0),velocity:Vec3.zero(),massKg:1});
 w.addParticle({position:v(.15,0,0),velocity:Vec3.zero(),massKg:1});
 const events=[];
 const r=simulateLiquid(w.particleSnapshot(),dt,w.getConfig(),w.getLiquidConfig(),[],e=>events.push(e));
 assert.equal(events.length,r.substeps);
 assert.ok(events[0].pairsBeforeProjection>0);
 assert.equal(events[0].contactsAdded,0);
 assert.ok(events[0].divergenceProjection.converged);
 assert.ok(events[0].densityProjection.converged);
 w.shutdown();
});
test('S09 CONT004: diagnostic callback exception cannot publish scratch solver state',()=>{
 const w=makeTank(),before=w.particleSnapshot();
 assert.throws(()=>simulateLiquid(w.particleSnapshot(),dt,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot(),()=>{throw Error('diagnostic abort')}),/diagnostic abort/);
 assert.deepEqual(w.particleSnapshot(),before);
 w.shutdown();
});
