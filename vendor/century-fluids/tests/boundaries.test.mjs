import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {FluidWorld,FluidConfig,FluidError,Vec3,LiquidSolverConfig} from '../dist/index.js';
const v=(x,y,z)=>Vec3.of(x,y,z);
const p=(x,y,z,m=1,vel=v(0,0,0))=>({position:v(x,y,z),velocity:vel,massKg:m});
const physical=(g=v(0,0,0))=>FluidConfig.create({restDensityKgM3:1000,gravityMS2:g,maxSubstepSeconds:1/120,maxSubsteps:64});
const world=(g=v(0,0,0))=>{const w=new FluidWorld(physical(g));w.setLiquidConfig(LiquidSolverConfig.create({...waterSolverConfig(),supportRadiusMeters:.6,particleContactRadiusMeters:.05}));return w;};
const err=code=>e=>e instanceof FluidError&&e.code===code;
const eq=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const floor=(velocity=v(0,0,0),extra={})=>({kind:'plane',point:v(0,0,0),normal:v(0,2,0),velocity,...extra});

test('boundary API manages stable handles, normalized normals and immutable snapshots',()=>{
 const w=world(),a=w.addBoundary(floor()),b=w.addBoundary({kind:'sphere',center:v(2,0,0),radiusMeters:1});
 assert.equal(w.boundaryCount,2);eq(w.getBoundary(a).normal.y,1);assert.ok(Object.isFrozen(w.getBoundary(a)));
 assert.deepEqual(w.boundarySnapshot().map(x=>x.id),[a,b]);assert.throws(()=>w.removeBoundary(100),err('NOT_FOUND'));
 w.removeBoundary(a);const c=w.addBoundary(floor());assert.ok(c>b);assert.throws(()=>w.getBoundary(a),err('NOT_FOUND'));
 w.clearBoundaries();assert.equal(w.boundaryCount,0);const d=w.addBoundary(floor());assert.ok(d>c);
});
test('invalid and hostile geometries rejected before mutation',()=>{
 const w=world(),id=w.addBoundary(floor()),old=w.getBoundary(id);
 for(const bad of [
   {...floor(),normal:v(0,0,0)}, {...floor(),friction:2},{...floor(),restitution:-.1},
   {...floor(),velocity:{x:1,y:2,z:3}}, {kind:'sphere',center:v(0,0,0),radiusMeters:0},
   {kind:'box',center:v(0,0,0),halfExtents:v(1,-1,1)},
   {kind:'heightfield',origin:v(0,0,0),columns:2,rows:2,cellSizeXMeters:1,cellSizeZMeters:1,heightsMeters:[0,1,0]},
   {kind:'triangleMesh',center:v(0,0,0)}, null
 ]) {assert.throws(()=>w.updateBoundary(id,bad));assert.equal(w.getBoundary(id),old);}
 assert.equal(w.boundaryCount,1);
});
test('plane catches gravity particle and reports impulse on boundary',()=>{
 const w=world(v(0,-9.81,0)),id=w.addBoundary(floor()),pid=w.addParticle(p(0,.0501,0,2,v(0,-2,0)));
 const before=w.totalMassKg,r=w.step(1/120),after=w.getParticle(pid);
 assert.ok(after.position.y>=.05-1e-8);assert.ok(after.velocity.y>=-1e-12);
 assert.ok(r.boundaryContacts>0);assert.ok(r.boundaryReactions[0].impulseOnBoundaryNs.y<0);eq(w.totalMassKg,before);
 assert.equal(r.boundaryReactions[0].boundaryId,id);
});
test('plane restitution and tangential friction act on relative velocity',()=>{
 const w=world(),id=w.addBoundary({...floor(),restitution:.5,friction:.5}),pid=w.addParticle(p(0,.051,0,2,v(4,-2,0)));
 w.step(1/120);const state=w.getParticle(pid);eq(state.velocity.y,1);eq(state.velocity.x,2);
 const r=w.getBoundary(id);eq(r.restitution,.5);
});
test('sloped plane normal projection and dynamic upward obstacle velocity',()=>{
 const w=world(),id=w.addBoundary({kind:'plane',point:v(0,0,0),normal:v(1,1,0),velocity:v(0,2,0)}),pid=w.addParticle(p(0,.02,0,1));
 const r=w.step(1/120),state=w.getParticle(pid);
 const b=w.getBoundary(id);eq(b.point.y,2/120);assert.ok(state.position.x>0);assert.ok(state.velocity.y>0);
 assert.ok(r.boundaryReactions[0].impulseOnBoundaryNs.y<0);
});
test('sphere static collision from center has deterministic escape direction',()=>{
 const w=world(),id=w.addBoundary({kind:'sphere',center:v(0,0,0),radiusMeters:.4}),pid=w.addParticle(p(0,0,0));
 const r=w.step(1/120);eq(Math.hypot(...w.getParticle(pid).position.toArray()),.45,1e-8);
 assert.ok(r.boundaryContacts>0);assert.equal(w.getBoundary(id).radiusMeters,.4);
});
test('box inside resolves to nearest face and preserves tangential velocity',()=>{
 const w=world(),id=w.addBoundary({kind:'box',center:v(0,0,0),halfExtents:v(.5,.5,.5)});
 const pid=w.addParticle(p(.49,0,0,1,v(0,0,1)));
 const r=w.step(1/120);assert.ok(w.getParticle(pid).position.x>=.55-1e-8);
 eq(w.getParticle(pid).velocity.z,1);assert.ok(r.boundaryContacts>0);assert.equal(r.boundaryReactions[0].boundaryId,id);
});
test('box continuous sweep rejects high-speed passage through thin obstacle',()=>{
 const w=world(),id=w.addBoundary({kind:'box',center:v(.1,0,0),halfExtents:v(.005,.3,.3)});
 const pid=w.addParticle(p(0,0,0,1,v(4,0,0))); // displacement .0333: starts outside expanded box at x=.045
 w.step(1/120); assert.ok(w.getParticle(pid).position.x<.045); // not reached yet
 for(let n=0;n<4;n++)w.step(1/120);
 assert.ok(w.getParticle(pid).position.x<=.045+1e-6);
 assert.ok(w.getParticle(pid).velocity.x<=1e-10);assert.ok(w.getBoundary(id));
});
test('sphere sweep detects transit with endpoint already outside',()=>{
 const w=world(),pid=w.addParticle(p(-.25,0,0,1,v(60,0,0)));
 w.addBoundary({kind:'sphere',center:v(0,0,0),radiusMeters:.08,restitution:1});
 // CFL demands more than one substep, but ensures continuous collision during the interval.
 const r=w.step(1/120); assert.ok(w.getParticle(pid).position.x<-.13);
 assert.ok(w.getParticle(pid).velocity.x<0);assert.ok(r.boundaryContacts>0);
});
test('moving sphere crosses resting particle and imparts velocity',()=>{
 const w=world();w.addBoundary({kind:'sphere',center:v(-.19,0,0),radiusMeters:.1,velocity:v(20,0,0)});
 const pid=w.addParticle(p(0,0,0));const result=w.step(1/120);
 assert.ok(result.boundaryContacts>0);assert.ok(w.getParticle(pid).velocity.x>0);
});
test('heightfield bilinear slope responds and owns its input heights',()=>{
 const w=world();let heights=[0,0,1,1];const id=w.addBoundary({kind:'heightfield',origin:v(0,0,0),columns:2,rows:2,cellSizeXMeters:1,cellSizeZMeters:1,heightsMeters:heights});
 heights[0]=500; assert.equal(w.getBoundary(id).heightsMeters[0],0);
 const pid=w.addParticle(p(.5,.51,.5,1,v(0,-1,0)));const r=w.step(1/120);
 assert.ok(r.boundaryContacts>0);assert.ok(w.getParticle(pid).velocity.z<0);
 assert.ok(Object.isFrozen(w.getBoundary(id).heightsMeters));
});
test('heightfield outside footprint leaves particle unmodified',()=>{
 const w=world(),pid=w.addParticle(p(5,-10,5,1,v(0,0,0)));
 w.addBoundary({kind:'heightfield',origin:v(0,0,0),columns:2,rows:2,cellSizeXMeters:1,cellSizeZMeters:1,heightsMeters:[0,0,0,0]});
 const r=w.step(1/120);eq(w.getParticle(pid).position.y,-10);assert.equal(r.boundaryContacts,0);
});
test('moving kinematic poses advance with host time exactly once, even when world empty',()=>{
 const w=world(),id=w.addBoundary({...floor(v(0,2,0))});w.step(1/60);
 eq(w.getBoundary(id).point.y,2/60);w.step(1/120);eq(w.getBoundary(id).point.y,2/60+2/120);
 assert.equal(w.boundaryCount,1);
});
test('overflow during predicted boundary motion rolls back everything',()=>{
 const w=world(),id=w.addBoundary({kind:'sphere',center:v(Number.MAX_VALUE,0,0),radiusMeters:1,velocity:v(Number.MAX_VALUE,0,0)});
 const pid=w.addParticle(p(0,0,0)),before=w.particleSnapshot(),bound=w.getBoundary(id);
 assert.throws(()=>w.step(1/120),err('NON_FINITE'));
 assert.deepEqual(w.particleSnapshot(),before);assert.equal(w.getBoundary(id),bound);assert.equal(w.getParticle(pid).id,pid);
});
test('CFL failure leaves boundary poses and particle frames unchanged',()=>{
 const w=world(),id=w.addBoundary({...floor(v(0,1,0))});w.addParticle(p(0,1,0,1,v(3000,0,0)));
 const before=w.particleSnapshot(),b=w.getBoundary(id);
 assert.throws(()=>w.step(1/60),err('STEP_BUDGET_EXCEEDED'));
 assert.deepEqual(w.particleSnapshot(),before);assert.equal(w.getBoundary(id),b);
});
test('invalid contact radius rejected atomically',()=>{
 const w=world(),old=w.getLiquidConfig();
 for(const size of [0,NaN,Infinity,1]){
   assert.throws(()=>w.setLiquidConfig(LiquidSolverConfig.create({...old,particleContactRadiusMeters:size})));
   assert.equal(w.getLiquidConfig(),old);
 }
});
test('finite tank constructed from 6 planes retains free particles and stable mass',()=>{
 const w=world(v(0,-9.81,0)),ids=[];
 for(const [point,normal] of [[v(0,0,0),v(0,1,0)],[v(0,1,0),v(0,-1,0)],
 [v(-.5,0,0),v(1,0,0)],[v(.5,0,0),v(-1,0,0)],
 [v(0,0,-.5),v(0,0,1)],[v(0,0,.5),v(0,0,-1)]])w.addBoundary({kind:'plane',point,normal});
 for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++)
   ids.push(w.addParticle(p(-.2+x*.15,.06+y*.15,-.2+z*.15,2)));
 const mass=w.totalMassKg;let collisions=0;
 for(let j=0;j<12;j++){const r=w.step(1/120);collisions+=r.boundaryContacts;eq(r.totalMassKg,mass,1e-8);assert.ok(r.maximumBoundaryPenetrationMeters<=1e-6);}
 assert.equal(w.particleCount,27);assert.deepEqual([...w.particleSnapshot().ids],ids);assert.ok(collisions>0);
 for(const id of ids){const q=w.getParticle(id).position;assert.ok(q.y>=.05-1e-6&&q.y<=.95+1e-6);assert.ok(Math.abs(q.x)<=.45+1e-6&&Math.abs(q.z)<=.45+1e-6);}
});
test('all boundary API operations reject closed world and shutdown is idempotent',()=>{
 const w=world(),id=w.addBoundary(floor());w.shutdown();w.shutdown();
 for(const fn of [()=>w.boundaryCount,()=>w.getBoundary(id),()=>w.addBoundary(floor()),()=>w.removeBoundary(id),()=>w.clearBoundaries(),()=>w.boundarySnapshot(),()=>w.updateBoundary(id,floor())])
 assert.throws(fn,err('CLOSED'));
});
