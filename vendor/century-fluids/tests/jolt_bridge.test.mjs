import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
/** Structural-port tests only. Real Jolt WASM acceptance is tests/jolt-real/. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {FluidWorld,FluidConfig,Vec3,LiquidSolverConfig,FluidError} from '../dist/index.js';
import {JoltFluidBridge,Quat} from '../dist/adapters/jolt.js';
const v=(x,y,z)=>Vec3.of(x,y,z);
const physical=(gravity=v(0,0,0))=>FluidConfig.create({restDensityKgM3:1000,gravityMS2:gravity,maxSubstepSeconds:1/120,maxSubsteps:32});
function world(gravity=v(0,0,0)) {
 const w=new FluidWorld(physical(gravity));
 w.setLiquidConfig(LiquidSolverConfig.create({...waterSolverConfig(),supportRadiusMeters:.3,particleContactRadiusMeters:.03}));
 return w;
}
function host({position=[0,0,0],velocity=[0,0,0],angle=[0,0,0],quat=[0,0,0,1],key=7}={}) {
 const state={position,velocity,angle,quat,impulses:[],angular:[],destroyed:0};
 const vector=(a)=>({GetX:()=>a[0],GetY:()=>a[1],GetZ:()=>a[2],GetW:()=>a[3]});
 class JV {constructor(x,y,z){this.v=[x,y,z];}GetX(){return this.v[0]}GetY(){return this.v[1]}GetZ(){return this.v[2]}}
 const mod={Vec3:JV,destroy:()=>{state.destroyed++}};
 const bi={GetPosition:()=>vector(state.position),GetRotation:()=>vector(state.quat),GetLinearVelocity:()=>vector(state.velocity),GetAngularVelocity:()=>vector(state.angle),
  AddImpulse:(id,imp)=>{assert.equal(id.GetIndexAndSequenceNumber(),key);state.impulses.push(imp.v.slice());},
  AddAngularImpulse:(id,imp)=>{assert.equal(id.GetIndexAndSequenceNumber(),key);state.angular.push(imp.v.slice());}};
 return {mod,bi,id:{GetIndexAndSequenceNumber:()=>key},state};
}
const errors=code=>e=>e instanceof FluidError && e.code===code;
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}`);

test('S06 particle impulse API prevalidates all ids and overflows before mutation',()=>{
 const w=world(),a=w.addParticle({position:v(0,0,0),velocity:v(1,0,0),massKg:2});
 assert.throws(()=>w.applyParticleImpulses([{id:a,impulseNs:v(2,0,0)},{id:a+22,impulseNs:v(1,0,0)}]),errors('NOT_FOUND'));
 near(w.getParticle(a).velocity.x,1);
 assert.throws(()=>w.applyParticleImpulses([{id:a,impulseNs:v(Number.MAX_VALUE,0,0)},{id:a,impulseNs:v(Number.MAX_VALUE,0,0)}]),errors('NON_FINITE'));
 near(w.getParticle(a).velocity.x,1);
 w.applyParticleImpulses([{id:a,impulseNs:v(2,0,0)},{id:a,impulseNs:v(4,0,0)}]);near(w.getParticle(a).velocity.x,4);
});
test('S06 optional adapter registers borrowed IDs, owns only boundaries, and does not step host',()=>{
 const w=world(),base=w.addBoundary({kind:'plane',point:v(0,-3,0),normal:v(0,1,0)}),h=host();
 const b=new JoltFluidBridge(w,h.mod,h.bi,new WaterHydrodynamics());
 const key=b.register({id:h.id,shape:{kind:'sphere',radiusMeters:.25},motion:'dynamic'});
 assert.equal(key,7);assert.equal(w.boundaryCount,2);assert.equal(b.bodyCount,1);
 const report=b.step(1/120);assert.equal(report.liquid.particleCount,0);assert.equal(h.state.impulses.length,0);
 b.unregister(key);assert.equal(w.boundaryCount,1);assert.equal(w.getBoundary(base).kind,'plane');
 b.shutdown();b.shutdown();assert.equal(w.state,'ready');assert.equal(w.boundaryCount,1);
 assert.throws(()=>b.step(1/120),errors('CLOSED'));
});
test('S06 sphere contact transmits equal linear impulse and nonzero torque to dynamic Jolt body',()=>{
 const w=world(),h=host(),b=new JoltFluidBridge(w,h.mod,h.bi);
 b.register({id:h.id,shape:{kind:'sphere',radiusMeters:.15},motion:'dynamic',friction:.6});
 w.addParticle({position:v(.18,.06,0),velocity:v(-3,1,0),massKg:2});
 const initial=w.particleSnapshot();const out=b.step(1/120);
 assert.ok(out.liquid.boundaryContacts>0);
 const reaction=out.bodies[0];assert.ok(reaction.contactImpulseNs.x<0);
 const dv=w.particleSnapshot().velocitiesXYZ[0]-initial.velocitiesXYZ[0];
 near(reaction.contactImpulseNs.x+2*dv,0,1e-6);
 near(h.state.impulses[0][0],reaction.contactImpulseNs.x);
 assert.ok(Math.abs(reaction.angularContactImpulseNms.z)>1e-7,'off-center impact must generate a torque');
 near(h.state.angular[0][2],reaction.angularContactImpulseNms.z);
 assert.equal(h.state.destroyed,h.state.impulses.length+h.state.angular.length);
 b.shutdown();w.shutdown();
});
test('S06 rigid rotated box is sampled in local coordinates without approximating a world AABB',()=>{
 const w=world(),h=host({quat:[0,0,Math.sin(Math.PI/4),Math.cos(Math.PI/4)]}),b=new JoltFluidBridge(w,h.mod,h.bi);
 b.register({id:h.id,motion:'static',shape:{kind:'box',halfExtents:v(.5,.1,.1)}});
 const edge=w.getBoundary(1);near(edge.rotation.z,Math.SQRT1_2);
 // x-axis in model space is along world Y after quarter-turn.
 const pid=w.addParticle({position:v(0,.45,0),velocity:v(0,-2,0),massKg:1});
 const r=b.step(1/120);assert.ok(r.liquid.boundaryContacts>0);
 assert.ok(w.getParticle(pid).position.y>=.53-1e-6);
 assert.equal(h.state.impulses.length,0,'static bodies receive no impulses');
 b.shutdown();w.shutdown();
});
test('S06 buoyancy estimate is based on actual fluid and transfers equal/opposite momentum',()=>{
 const w=world(v(0,-9.81,0)),h=host(),b=new JoltFluidBridge(w,h.mod,h.bi,new WaterHydrodynamics());
 b.register({id:h.id,motion:'dynamic',shape:{kind:'sphere',radiusMeters:.12},buoyancyScale:1});
 const id=w.addParticle({position:v(.25,.08,0),velocity:v(0,0,0),massKg:1});
 const bare=world(v(0,-9.81,0));bare.addParticle({position:v(.25,.08,0),velocity:v(0,0,0),massKg:1});
 bare.step(1/120);const baseV=bare.getParticle(1).velocity.y;
 const out=b.step(1/120),hydro=out.bodies[0].hydrodynamicImpulseNs;
 assert.ok(out.bodies[0].submergedFraction>0);
 assert.ok(hydro.y>0,`buoyant impulse=${hydro.y}`);
 const diff=w.getParticle(id).velocity.y-baseV;
 near(diff+hydro.y,0,1e-6);
 near(h.state.impulses.reduce((a,x)=>a+x[1],0),hydro.y);
 b.shutdown();w.shutdown();bare.shutdown();
});
test('S06 empty fluid produces zero hydrostatic buoyancy and no fake water volume',()=>{
 const w=world(v(0,-9.81,0)),h=host(),b=new JoltFluidBridge(w,h.mod,h.bi,new WaterHydrodynamics());
 b.register({id:h.id,motion:'dynamic',shape:{kind:'sphere',radiusMeters:.4},buoyancyScale:1});
 const r=b.step(1/120);near(r.bodies[0].hydrodynamicImpulseNs.y,0);assert.equal(h.state.impulses.length,0);
 b.shutdown();w.shutdown();
});
test('S06 registered bodies can be replaced without stale mapping; repeated lifecycle is clean',()=>{
 const w=world();
 for(let i=0;i<80;i++) {
  const h=host({key:200+i}),b=new JoltFluidBridge(w,h.mod,h.bi);
  b.register({id:h.id,motion:'kinematic',shape:{kind:'sphere',radiusMeters:.1}});
  assert.throws(()=>b.register({id:h.id,motion:'kinematic',shape:{kind:'sphere',radiusMeters:.1}}),errors('INVALID_ARGUMENT'));
  b.step(1/120);b.unregister(200+i);b.shutdown();assert.equal(w.boundaryCount,0);
 }
 w.shutdown();
});
test('S06 failed fluid step never sends impulse and keeps boundary pose',()=>{
 const w=world(),h=host(),b=new JoltFluidBridge(w,h.mod,h.bi);
 b.register({id:h.id,motion:'dynamic',shape:{kind:'sphere',radiusMeters:.25}});
 const p=w.getBoundary(1);
 h.state.position=[2,0,0];
 assert.throws(()=>b.step(5),errors('STEP_BUDGET_EXCEEDED'));
 assert.equal(w.getBoundary(1),p);assert.deepEqual(h.state.impulses,[]);
 b.shutdown();w.shutdown();
});
test('S06 Quaternion rejects invalid values',()=>{
 assert.throws(()=>Quat.of(0,0,0,0),errors('OUT_OF_RANGE'));
 const q=Quat.of(0,0,3,3);near(q.w,Math.SQRT1_2);
});
