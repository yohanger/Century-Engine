import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3} from '../dist/index.js';
import {createWaterWorld,waterSolverConfig} from '../dist/fluids/water/index.js';
import {simulateLiquid} from '../dist/liquid.js';
import {scheduleRegionalPhysics} from '../dist/regional.js';
const v=(x,y,z)=>Vec3.of(x,y,z);
const pt=(x,y,z,velocity=Vec3.zero(),massKg=1.728)=>({position:v(x,y,z),velocity,massKg});
const make=()=>createWaterWorld({physical:{gravityMS2:Vec3.zero()}});
const dt=1/120;
function compare(a,b,tol=1e-9){
 assert.equal(a.count,b.count);
 for(const k of ['positionsXYZ','velocitiesXYZ','massesKg'])for(let i=0;i<a[k].length;i++)
  assert.ok(Math.abs(a[k][i]-b[k][i])<tol,`${k}[${i}] mismatch ${a[k][i]} ${b[k][i]}`);
}
test('S09 CONT002: certified zero-gravity rest preserves mass and particle revisions',()=>{
 const w=make();w.emitParticles([pt(0,0,0),pt(10,0,0)]);
 assert.equal(w.step(dt).regional.mode,'full');const initial=w.particleSnapshot();
 for(let i=0;i<10;i++){const r=w.step(dt);assert.equal(r.regional.mode,'rest');assert.equal(r.regional.restingParticles,2);assert.equal(r.totalMassKg,w.totalMassKg);}
 compare(initial,w.particleSnapshot());w.shutdown();
});
test('S09 CONT002: moving island alone updates while disconnected islands remain at rest',()=>{
 const w=make();w.emitParticles([pt(0,0,0,v(.4,0,0)),pt(10,0,0),pt(20,0,0)]);
 w.step(dt);const ref=w.particleSnapshot();simulateLiquid(ref,dt,w.getConfig(),w.getLiquidConfig());
 const r=w.step(dt);assert.equal(r.regional.mode,'partial');assert.equal(r.regional.activeParticles,1);assert.equal(r.regional.restingParticles,2);
 compare(ref,w.particleSnapshot());w.shutdown();
});
test('S09 CONT002: near chunk boundary wakes inactive neighbor before potential contact',()=>{
 const w=make();w.emitParticles([pt(2.39,0,0,v(.5,0,0)),pt(2.41,0,0),pt(15,0,0)]);
 w.step(dt);const r=w.step(dt);assert.equal(r.regional.mode,'partial');assert.equal(r.regional.activeParticles,2);assert.equal(r.regional.restingParticles,1);w.shutdown();
});
test('S09 CONT002: pressure compression forbids sleeping even at zero initial velocity',()=>{
 const w=make();w.emitParticles([pt(0,0,0,Vec3.zero(),35),pt(.04,0,0,Vec3.zero(),35)]);
 const plan=scheduleRegionalPhysics(w.particleSnapshot(),w.getConfig(),w.getLiquidConfig(),false,false);
 assert.equal(plan.stats.mode,'full');w.shutdown();
});
test('S09 CONT002: impulses/emission/drain/configuration wake regions',()=>{
 const w=make();const [a,b]=w.emitParticles([pt(0,0,0),pt(15,0,0)]);
 w.step(dt);assert.equal(w.step(dt).regional.mode,'rest');
 w.applyParticleImpulses([{id:a,impulseNs:v(.2,0,0)}]);assert.equal(w.step(dt).regional.mode,'full');
 assert.equal(w.step(dt).regional.mode,'partial');
 w.emitParticles([pt(25,0,0)]);assert.equal(w.step(dt).regional.mode,'full');
 w.drainParticles([b]);assert.equal(w.step(dt).regional.mode,'full');
 w.setLiquidConfig(waterSolverConfig());assert.equal(w.step(dt).regional.mode,'full');
 w.setConfig(w.getConfig());assert.equal(w.step(dt).regional.mode,'full');w.shutdown();
});
test('S09 CONT002: gravity and boundaries always use complete solver',()=>{
 const w=createWaterWorld();w.emitParticles([pt(0,2,0),pt(10,2,0)]);
 for(let i=0;i<3;i++)assert.equal(w.step(dt).regional.mode,'full');w.shutdown();
 const f=make();f.emitParticles([pt(0,2,0)]);f.step(dt);assert.equal(f.step(dt).regional.mode,'rest');
 f.addBoundary({kind:'plane',point:Vec3.zero(),normal:v(0,1,0)});
 assert.equal(f.step(dt).regional.mode,'full');assert.equal(f.step(dt).regional.mode,'full');f.shutdown();
});
test('S09 CONT002: rejected oversized step is atomic and does not corrupt scheduler',()=>{
 const w=make();w.emitParticles([pt(0,0,0),pt(15,0,0)]);w.step(dt);
 const old=w.particleSnapshot();assert.throws(()=>w.step(1000),e=>e.code==='STEP_BUDGET_EXCEEDED');
 compare(old,w.particleSnapshot());assert.equal(w.step(dt).regional.mode,'rest');w.shutdown();
});
test('S09 CONT002: cross-chunk interactions agree with original global SPH for 100 frames',()=>{
 const w=make();w.emitParticles([pt(2.39,0,0,v(.4,.05,0)),pt(2.41,0,0,v(-.2,0,0)),pt(15,0,0)]);
 const ref=w.particleSnapshot();for(let i=0;i<100;i++){
  simulateLiquid(ref,dt,w.getConfig(),w.getLiquidConfig());
  const report=w.step(dt);assert.equal(report.totalMassKg,w.totalMassKg);
  compare(ref,w.particleSnapshot(),1e-8);
 }w.shutdown();
});
test('S09 CONT002: independent worlds do not share regional state',()=>{
 const a=make(),b=createWaterWorld();a.emitParticles([pt(0,0,0)]);b.emitParticles([pt(0,0,0)]);
 a.step(dt);b.step(dt);assert.equal(a.step(dt).regional.mode,'rest');assert.equal(b.step(dt).regional.mode,'full');
 a.shutdown();b.shutdown();
});

test('S09 CONT005: regional wake follows the complete SPH chain across chunk seams',()=>{
 const w=createWaterWorld({physical:{gravityMS2:Vec3.zero(),maxSubsteps:1}});
 const chain=Array.from({length:22},(_,i)=>pt(2.31+i*.125,0,0,i===0?v(.4,0,0):Vec3.zero()));
 w.emitParticles([...chain,pt(25,0,0)]);
 const frame=w.particleSnapshot(),physical=w.getConfig(),solver=w.getLiquidConfig();
 const plan=scheduleRegionalPhysics(frame,physical,solver,false,false);
 assert.equal(plan.stats.mode,'partial');
 assert.equal(plan.stats.activeParticles,chain.length);
 assert.equal(plan.stats.restingParticles,1);
 w.step(dt);
 const ref=w.particleSnapshot();
 simulateLiquid(ref,dt,physical,solver);
 const report=w.step(dt);
 assert.equal(report.regional.activeParticles,chain.length);
 compare(ref,w.particleSnapshot());
 w.shutdown();
});
