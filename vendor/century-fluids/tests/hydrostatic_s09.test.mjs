import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3} from '../dist/index.js';
import {createWaterWorld,waterPhysicalConfig,waterSolverConfig} from '../dist/fluids/water/index.js';
import {simulateLiquid} from '../dist/liquid.js';
import {certifyHydrostaticFixedPoint} from '../dist/hydrostatic.js';
const v=(x,y,z)=>Vec3.of(x,y,z),dt=1/120;
function supported(){
 const w=createWaterWorld();
 const id=w.addBoundary({kind:'plane',point:v(0,0,0),normal:v(0,1,0)});
 const [particle]=w.emitParticles([{position:v(0,.03,0),velocity:Vec3.zero(),massKg:1.728}]);
 return {w,id,particle};
}
function equalSnapshots(a,b){
 assert.equal(a.count,b.count);
 for(const key of ['ids','massesKg','positionsXYZ','velocitiesXYZ'])assert.deepEqual([...a[key]],[...b[key]],key);
}
function equalReactions(a,b){
 assert.equal(a.boundaryContacts,b.boundaryContacts);
 assert.equal(a.maximumBoundaryPenetrationMeters,b.maximumBoundaryPenetrationMeters);
 assert.equal(a.boundaryReactions.length,b.boundaryReactions.length);
 for(let i=0;i<a.boundaryReactions.length;i++){
  const x=a.boundaryReactions[i],y=b.boundaryReactions[i];
  assert.equal(x.boundaryId,y.boundaryId);assert.equal(x.contacts,y.contacts);
  assert.deepEqual(x.impulseOnBoundaryNs,y.impulseOnBoundaryNs);
  assert.deepEqual(x.angularImpulseOnBoundaryNms,y.angularImpulseOnBoundaryNms);
 }
}
test('S09 CONT003: exact static plane support rests under gravity while retaining real reaction impulse',()=>{
 const {w}=supported();
 assert.equal(w.step(dt).regional.mode,'full');
 const measured=w.step(dt);assert.equal(measured.regional.mode,'full');
 assert.equal(measured.convergence,'converged');assert.equal(measured.boundaryContacts,1);
 assert.ok(measured.boundaryReactions[0].impulseOnBoundaryNs.y<0);
 const fixed=w.particleSnapshot(),mass=w.totalMassKg;
 for(let i=0;i<50;i++){
  const r=w.step(dt);
  assert.equal(r.regional.mode,'rest');assert.equal(r.regional.activeParticles,0);
  assert.equal(r.regional.restingParticles,1);assert.equal(r.densityIterations,0);
  assert.equal(r.totalMassKg,mass);equalSnapshots(fixed,w.particleSnapshot());equalReactions(r,measured);
 }w.shutdown();
});
test('S09 CONT003: certified rest is numerically identical to 50 uncached global solves',()=>{
 const {w}=supported();w.step(dt);w.step(dt);
 const oracle=w.particleSnapshot();
 for(let i=0;i<50;i++){
  const reference=simulateLiquid(oracle,dt,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot());
  const measured=w.step(dt);assert.equal(measured.regional.mode,'rest');
  equalSnapshots(oracle,w.particleSnapshot());equalReactions(measured,reference);
  assert.equal(measured.convergence,reference.convergence);
 }w.shutdown();
});
test('S09 CONT003: changing host timestep invalidates the fixed-point certificate',()=>{
 const {w}=supported();w.step(dt);w.step(dt);assert.equal(w.step(dt).regional.mode,'rest');
 assert.equal(w.step(1/60).regional.mode,'full');
 assert.equal(w.step(dt).regional.mode,'full');
 assert.equal(w.step(dt).regional.mode,'rest');w.shutdown();
});
test('S09 CONT003: boundary mutations and Jolt-style per-step sync wake the solver',()=>{
 const {w,id}=supported();w.step(dt);w.step(dt);assert.equal(w.step(dt).regional.mode,'rest');
 const plane={kind:'plane',point:v(0,0,0),normal:v(0,1,0)};
 for(let i=0;i<10;i++){
  w.updateBoundary(id,plane);assert.equal(w.step(dt).regional.mode,'full');
 }
 w.updateBoundary(id,{...plane,velocity:v(0,.05,0)});
 assert.equal(w.step(dt).regional.mode,'full');
 assert.equal(w.step(dt).regional.mode,'full');w.shutdown();
});
test('S09 CONT003: impulses, particle edits, gravity and solver changes invalidate rest',()=>{
 const {w,particle}=supported();w.step(dt);w.step(dt);assert.equal(w.step(dt).regional.mode,'rest');
 w.applyParticleImpulses([{id:particle,impulseNs:v(.1,0,0)}]);
 assert.equal(w.step(dt).regional.mode,'full');
 w.updateParticle(particle,{velocity:Vec3.zero(),position:v(0,.03,0)});
 assert.equal(w.step(dt).regional.mode,'full');
 w.setConfig(waterPhysicalConfig());assert.equal(w.step(dt).regional.mode,'full');
 w.setLiquidConfig(waterSolverConfig());assert.equal(w.step(dt).regional.mode,'full');w.shutdown();
});
test('S09 CONT003: invalid host step cannot consume certificate or mutate world',()=>{
 const {w}=supported();w.step(dt);w.step(dt);assert.equal(w.step(dt).regional.mode,'rest');
 const snap=w.particleSnapshot();
 assert.throws(()=>w.step(3),e=>e.code==='STEP_BUDGET_EXCEEDED');
 equalSnapshots(snap,w.particleSnapshot());assert.equal(w.step(dt).regional.mode,'rest');w.shutdown();
});
test('S09 CONT003: converged but moving water under gravity is never classified as sleeping',()=>{
 const w=createWaterWorld();w.addBoundary({kind:'plane',point:v(0,0,0),normal:v(0,1,0)});
 w.addParticle({position:v(0,1,0),velocity:Vec3.zero(),massKg:1.728});
 for(let i=0;i<30;i++){const r=w.step(dt);assert.equal(r.regional.mode,'full');}
 w.shutdown();
});
test('S09 CONT003: initially stationary compressed fluid cannot falsely sleep',()=>{
 const w=createWaterWorld();w.addBoundary({kind:'plane',point:v(0,0,0),normal:v(0,1,0)});
 w.emitParticles([{position:v(0,.03,0),velocity:Vec3.zero(),massKg:35},
  {position:v(.04,.03,0),velocity:Vec3.zero(),massKg:35}]);
 for(let i=0;i<6;i++){
  let r;try{r=w.step(dt);}catch(e){assert.ok(['OUT_OF_RANGE','STEP_BUDGET_EXCEEDED'].includes(e.code));break;}
  assert.equal(r.regional.mode,'full');
 }w.shutdown();
});
test('S09 CONT003: multiple non-interacting supported chunks preserve boundary reactions',()=>{
 const w=createWaterWorld();w.addBoundary({kind:'plane',point:v(0,0,0),normal:v(0,1,0)});
 for(let i=0;i<5;i++)w.addParticle({position:v(i*3,.03,0),velocity:Vec3.zero(),massKg:1.728});
 w.step(dt);const r=w.step(dt);assert.equal(r.regional.mode,'full');
 assert.equal(r.boundaryContacts,5);const idle=w.step(dt);
 assert.equal(idle.regional.mode,'rest');assert.equal(idle.regional.restingParticles,5);
 assert.equal(idle.regional.restingChunks,5);equalReactions(idle,r);w.shutdown();
});
test('S09 CONT003: fixed-point certification strictly requires exact equality and converged contacts',()=>{
 const {w}=supported();w.step(dt);const before=w.particleSnapshot(),after=w.particleSnapshot();
 const sample=simulateLiquid(after,dt,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot());
 assert.ok(certifyHydrostaticFixedPoint(before,after,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot(),sample));
 const moved=w.particleSnapshot();moved.positionsXYZ[1]+=1e-12;
 assert.equal(certifyHydrostaticFixedPoint(before,moved,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot(),sample),null);
 assert.equal(certifyHydrostaticFixedPoint(before,after,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot(),{...sample,convergence:'iteration_limit'}),null);
 w.shutdown();
});
test('S09 CONT003: independent worlds and repeated lifecycle do not share fixed-point state',()=>{
 for(let j=0;j<20;j++){
  const {w}=supported(),q=createWaterWorld();q.addParticle({position:v(0,2,0),velocity:Vec3.zero(),massKg:1.728});
  w.step(dt);w.step(dt);assert.equal(w.step(dt).regional.mode,'rest');
  assert.equal(q.step(dt).regional.mode,'full');w.shutdown();q.shutdown();
 }
});

test('S09 CONT005: a connected layer on exact supports retains its weight reaction and wakes on impulse',()=>{
 const w=createWaterWorld();
 w.addBoundary({kind:'plane',point:v(0,0,0),normal:v(0,1,0)});
 const ids=w.emitParticles(Array.from({length:25},(_,i)=>({
  position:v((i%5)*.12,.03,Math.floor(i/5)*.12),velocity:Vec3.zero(),massKg:1.728
 })));
 w.step(dt);w.step(dt);
 const oracle=w.particleSnapshot(),gravity=w.getConfig().gravityMS2.y;
 for(let i=0;i<64;i++){
  const reference=simulateLiquid(oracle,dt,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot());
  const measured=w.step(dt);
  assert.equal(measured.regional.mode,'rest');
  assert.equal(measured.regional.restingParticles,ids.length);
  const fy=measured.boundaryReactions[0].impulseOnBoundaryNs.y;
  assert.ok(Math.abs(fy-measured.totalMassKg*gravity*dt)<1e-12);
  equalSnapshots(oracle,w.particleSnapshot());equalReactions(measured,reference);
 }
 w.applyParticleImpulses([{id:ids[12],impulseNs:v(.35,.10,0)}]);
 assert.equal(w.step(dt).regional.mode,'full');
 assert.ok(w.particleSnapshot().velocitiesXYZ.some(value=>value!==0));
 w.shutdown();
});
