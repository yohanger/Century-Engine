import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../../dist/fluids/water/index.js';
/** S06 acceptance: loads the ACTUAL jolt-physics@1.1.0 WASM, no substitutes, no fake bodies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FluidConfig,FluidWorld,LiquidSolverConfig,Vec3} from '../../dist/index.js';
import {JoltFluidBridge} from '../../dist/adapters/jolt.js';
import initJolt from 'jolt-physics/wasm';

const packageInfo=JSON.parse(readFileSync(new URL('./node_modules/jolt-physics/package.json',import.meta.url),'utf8'));
assert.equal(packageInfo.version,'1.1.0','S06 requires exact Jolt 1.1.0');
const J=await initJolt();
assert.ok(J?.JoltInterface && J?.JoltSettings && J?.Vec3, 'real Jolt WASM factory was not initialized');
const v=(x,y,z)=>Vec3.of(x,y,z);
const dt=1/120;
function fluid() {
 const w=new FluidWorld(FluidConfig.create({restDensityKgM3:1000,gravityMS2:v(0,-9.81,0),maxSubstepSeconds:1/120,maxSubsteps:32}));
 w.setLiquidConfig(LiquidSolverConfig.create({...waterSolverConfig(),supportRadiusMeters:.3,particleContactRadiusMeters:.03}));
 return w;
}
function physics() {
 const settings=new J.JoltSettings();
 const pairs=new J.ObjectLayerPairFilterTable(2);
 pairs.EnableCollision(0,1);pairs.EnableCollision(1,1);
 const bp0=new J.BroadPhaseLayer(0),bp1=new J.BroadPhaseLayer(1);
 const bpi=new J.BroadPhaseLayerInterfaceTable(2,2);
 bpi.MapObjectToBroadPhaseLayer(0,bp0);bpi.MapObjectToBroadPhaseLayer(1,bp1);
 settings.mObjectLayerPairFilter=pairs;
 settings.mBroadPhaseLayerInterface=bpi;
 settings.mObjectVsBroadPhaseLayerFilter=new J.ObjectVsBroadPhaseLayerFilterTable(bpi,2,pairs,2);
 const jolt=new J.JoltInterface(settings);
 J.destroy(settings);J.destroy(bp0);J.destroy(bp1);
 const system=jolt.GetPhysicsSystem(),bi=system.GetBodyInterface();
 const gravity=new J.Vec3(0,-9.81,0);system.SetGravity(gravity);J.destroy(gravity);
 return {jolt,system,bi,dispose(){J.destroy(jolt)}};
}
function sphere(bi,radius=.12,position=[0,0,0]) {
 const settings=new J.SphereShapeSettings(radius),res=settings.Create();
 assert.ok(res.IsValid(),'Jolt rejected SphereShapeSettings');
 const shape=res.Get();shape.AddRef();
 J.destroy(res);J.destroy(settings);
 const point=new J.RVec3(...position),q=J.Quat.prototype.sIdentity();
 const cs=new J.BodyCreationSettings(shape,point,q,J.EMotionType_Dynamic,1);
 let id;
 try {
  const body=bi.CreateBody(cs);assert.ok(body,'Jolt returned null body');
  id=body.GetID();bi.AddBody(id,J.EActivation_Activate);
 } finally {J.destroy(cs);J.destroy(point)}
 return {id,dispose(){bi.RemoveBody(id);bi.DestroyBody(id);shape.Release()}};
}
function y(vec){return vec.GetY()}

// No source stubs are imported. If any ABI differs in Jolt 1.1.0 this test FAILS.
test('S06 real WASM: dynamic sphere receives buoyant impulse from actual fluid particles',()=>{
 const p=physics(),w=fluid();const body=sphere(p.bi),bridge=new JoltFluidBridge(w,J,p.bi,new WaterHydrodynamics());
 try {
  bridge.register({id:body.id,motion:'dynamic',shape:{kind:'sphere',radiusMeters:.12},buoyancyScale:1});
  w.addParticle({position:v(.25,.08,0),velocity:v(0,0,0),massKg:1});
  const before=y(p.bi.GetLinearVelocity(body.id));
  const report=bridge.step(dt);
  const after=y(p.bi.GetLinearVelocity(body.id));
  assert.ok(report.bodies[0].hydrodynamicImpulseNs.y>0,'fluid has no positive buoyancy');
  assert.ok(after>before,'Jolt rigid body did not acquire positive velocity from fluid');
  assert.equal(report.liquid.totalMassKg,1);
  p.jolt.Step(dt,1); // Host authority: Jolt advances EXACTLY ONCE, after bridge.
  assert.ok(Number.isFinite(y(p.bi.GetPosition(body.id))));
  console.log(`S06_REAL_BUOYANCY_PASS impulse=${report.bodies[0].hydrodynamicImpulseNs.y} dvy=${after-before}`);
 } finally {bridge.shutdown();body.dispose();w.shutdown();p.dispose()}
});
test('S06 real WASM: off-center liquid contact imparts angular velocity',()=>{
 const p=physics(),w=fluid();const body=sphere(p.bi,.15),bridge=new JoltFluidBridge(w,J,p.bi);
 try {
  bridge.register({id:body.id,motion:'dynamic',shape:{kind:'sphere',radiusMeters:.15},friction:.6});
  w.addParticle({position:v(.18,.06,0),velocity:v(-3,1,0),massKg:2});
  const report=bridge.step(dt);
  const tau=report.bodies[0].angularContactImpulseNms.z;
  assert.ok(report.liquid.boundaryContacts>0,'no fluid-solid contact registered');
  assert.ok(Math.abs(tau)>1e-8,'missing angular contact impulse');
  assert.ok(Math.abs(p.bi.GetAngularVelocity(body.id).GetZ())>1e-8,'no Jolt angular response');
  p.jolt.Step(dt,1);
  console.log(`S06_REAL_ANGULAR_PASS torque=${tau}`);
 } finally {bridge.shutdown();body.dispose();w.shutdown();p.dispose()}
});
test('S06 real WASM: repeated create/step/remove and cleanup without stale handles',()=>{
 const p=physics(),w=fluid();const bridge=new JoltFluidBridge(w,J,p.bi,new WaterHydrodynamics());
 try{
  for(let i=0;i<12;i++) {
   const body=sphere(p.bi,.12,[i*.5,0,0]);
   try{
    const key=bridge.register({id:body.id,motion:'dynamic',shape:{kind:'sphere',radiusMeters:.12}});
    bridge.step(dt);p.jolt.Step(dt,1);
    bridge.unregister(key);
   }finally{body.dispose()}
   assert.equal(bridge.bodyCount,0);
   assert.equal(w.boundaryCount,0);
  }
  console.log('S06_REAL_LIFECYCLE_PASS cycles=12');
 } finally {bridge.shutdown();w.shutdown();p.dispose()}
});
