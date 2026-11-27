import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3} from '../dist/index.js';
import {createWaterWorld} from '../dist/fluids/water/index.js';
const v=(x,y,z)=>Vec3.of(x,y,z),dt=1/120,radius=.03,depthTolerance=1e-6;
const tank=(side=4)=>{
 const w=createWaterWorld({solver:side===6?{supportRadiusMeters:.3,particleContactRadiusMeters:.025}:{}});
 const extent=side===6?.85:.6;
 for(const [point,normal] of [[v(0,0,0),v(0,1,0)],...(side===6?[[v(0,2.5,0),v(0,-1,0)]]:[]),
   [v(-.15,0,0),v(1,0,0)],[v(extent,0,0),v(-1,0,0)],[v(0,0,-.15),v(0,0,1)],[v(0,0,extent),v(0,0,-1)]])
  w.addBoundary({kind:'plane',point,normal});
 for(let x=0;x<side;x++)for(let y=0;y<side;y++)for(let z=0;z<side;z++)
  w.addParticle({position:v(.11*x,.03+.11*y,.11*z),velocity:Vec3.zero(),massKg:1000*.11**3});
 return w;
};
function momentum(s){
 let out=[0,0,0];for(let i=0;i<s.count;i++)for(let k=0;k<3;k++)out[k]+=s.massesKg[i]*s.velocitiesXYZ[3*i+k];return out;
}
test('S09 CONT005: 64-particle gravity tank improves convergence over recorded CONT004 baseline',()=>{
 const w=tank();const mass=w.totalMassKg;let failed=0,contacts=0;
 for(let i=0;i<240;i++){
  const result=w.step(dt);
  if(result.convergence==='iteration_limit')failed++;
  contacts+=result.boundaryContacts;
  assert.equal(result.regional.mode,'full','moving connected water cannot be put to sleep');
  assert.ok(result.maximumBoundaryPenetrationMeters<=depthTolerance);
  assert.ok(Math.abs(result.totalMassKg-mass)<1e-8);
 }
 assert.ok(failed<196,`not an improvement over CONT004: ${failed}`);
 assert.ok(contacts>0);w.shutdown();
});
test('S09 CONT005: 216-particle tank does not regress baseline 5/8 convergence limits',()=>{
 const w=tank(6);let limits=0;
 for(let i=0;i<8;i++){
  const r=w.step(dt);
  if(r.convergence==='iteration_limit')limits++;
  assert.ok(r.maximumBoundaryPenetrationMeters<=depthTolerance);
 }
 assert.ok(limits<5,`not an improvement over historical 5/8: ${limits}`);
 w.shutdown();
});
test('S09 CONT005: liquid momentum + wall impulses balances external gravity over 240 steps',()=>{
 const w=tank();let maxError=0;
 for(let step=0;step<240;step++){
  const before=momentum(w.particleSnapshot()),result=w.step(dt),after=momentum(w.particleSnapshot());
  const impulse=[0,0,0];for(const reaction of result.boundaryReactions){
   const x=reaction.impulseOnBoundaryNs;impulse[0]+=x.x;impulse[1]+=x.y;impulse[2]+=x.z;
  }
  const err=Math.hypot(...after.map((n,k)=>n-before[k]-(k===1?-9.81:0)*result.totalMassKg*dt+impulse[k]));
  maxError=Math.max(maxError,err);
 }
 assert.ok(maxError<1e-9,`momentum balance violated ${maxError} N*s`);
 w.shutdown();
});
test('S09 CONT005: no significant inward normal motion for supported liquid near five tank walls',()=>{
 const w=tank();let worst=0;
 for(let frame=0;frame<240;frame++){
  w.step(dt);const f=w.particleSnapshot();
  for(let i=0;i<f.count;i++){
   const k=3*i;
   for(const b of w.boundarySnapshot()){
    const separation=(f.positionsXYZ[k]-b.point.x)*b.normal.x+
      (f.positionsXYZ[k+1]-b.point.y)*b.normal.y+
      (f.positionsXYZ[k+2]-b.point.z)*b.normal.z;
    if(separation>radius+depthTolerance)continue;
    const normalSpeed=f.velocitiesXYZ[k]*b.normal.x+f.velocitiesXYZ[k+1]*b.normal.y+f.velocitiesXYZ[k+2]*b.normal.z;
    worst=Math.min(worst,normalSpeed);
   }
  }
 }
 assert.ok(worst*dt>=-depthTolerance,`unsafe inward travel ${worst*dt} m per step`);
 w.shutdown();
});
test('S09 CONT005: two independent worlds stay numerically deterministic',()=>{
 const w1=tank(),w2=tank();
 for(let i=0;i<60;i++){
  const r1=w1.step(dt),r2=w2.step(dt);
  assert.deepEqual(r1,r2);
  assert.deepEqual(w1.particleSnapshot(),w2.particleSnapshot());
 }
 w1.shutdown();w2.shutdown();
});
test('S09 CONT005: free fluid still has normal gravity/inertial integration with no contact work',()=>{
 const w=createWaterWorld();w.addParticle({position:v(0,1,0),velocity:v(0,0,0),massKg:1.728});
 const r=w.step(dt),state=w.particleSnapshot();
 assert.equal(r.boundaryContacts,0);assert.equal(r.regional.mode,'full');
 assert.ok(Math.abs(state.velocitiesXYZ[1]+9.81*dt)<1e-12);
 assert.ok(Math.abs(state.positionsXYZ[1]-(1-9.81*dt**2))<1e-12);
 w.shutdown();
});
test('S09 CONT005: off-center moving solid contact preserves linear/angular impulse bookkeeping',()=>{
 const w=createWaterWorld();const b=w.addBoundary({kind:'sphere',center:v(0,0,0),radiusMeters:.15,friction:.6});
 w.addParticle({position:v(.18,.06,0),velocity:v(-3,1,0),massKg:2});
 w.addParticle({position:v(.39,.06,0),velocity:v(-1,1,0),massKg:1.5});
 const before=momentum(w.particleSnapshot()),report=w.step(dt),after=momentum(w.particleSnapshot());
 const reaction=report.boundaryReactions.find(x=>x.boundaryId===b);
 assert.ok(reaction.contacts>0);
 assert.ok(Math.abs(reaction.angularImpulseOnBoundaryNms.z)>1e-8,'missing off-center torque');
 const impulse=reaction.impulseOnBoundaryNs;
 for(const [axis,k] of [['x',0],['y',1],['z',2]]){
  const externalForce=k===1?-9.81*report.totalMassKg*dt:0;
  assert.ok(Math.abs((after[k]-before[k])-externalForce+impulse[axis])<1e-8,
   `rigid/fluid ${axis} linear impulse mismatch`);
 }
 assert.ok(report.maximumBoundaryPenetrationMeters<=depthTolerance);
 w.shutdown();
});
test('S09 CONT005: repeated moving-boundary updates cannot leave a stale sleeping region',()=>{
 const w=createWaterWorld();const id=w.addBoundary({kind:'plane',point:v(0,0,0),normal:v(0,1,0)});
 w.addParticle({position:v(0,.03,0),velocity:Vec3.zero(),massKg:1.728});
 w.step(dt);w.step(dt);assert.equal(w.step(dt).regional.mode,'rest');
 for(let i=0;i<24;i++){
  w.updateBoundary(id,{kind:'plane',point:v(0,0,0),normal:v(0,1,0)});
  const report=w.step(dt);
  assert.equal(report.regional.mode,'full');
  assert.ok(report.maximumBoundaryPenetrationMeters<=depthTolerance);
 }
 w.shutdown();
});
