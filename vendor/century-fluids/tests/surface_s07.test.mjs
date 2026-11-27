import test from 'node:test';
import assert from 'node:assert/strict';
import {FluidWorld,FluidConfig,FluidError,Vec3} from '../dist/index.js';
import {SurfaceConfig,extractSurface} from '../dist/surface/index.js';
import {createWaterWorld,waterSurfaceConfig,extractWaterSurface,waterPhysicalConfig,WaterHydrodynamics} from '../dist/fluids/water/index.js';
import {JoltFluidBridge} from '../dist/adapters/jolt.js';
const v=(x,y,z)=>Vec3.of(x,y,z);
const particle=(x,y,z)=>({position:v(x,y,z),velocity:Vec3.zero(),massKg:1});
const params=()=>SurfaceConfig.create({cellSizeMeters:.09,influenceRadiusMeters:.5,isoLevel:.35,maxGridPoints:60000,maxTriangles:100000});
function withWater(inputs){const w=createWaterWorld();w.emitParticles(inputs);return w;}
function manifold(mesh){
  const counts=new Map();const {indices}=mesh;
  for(let i=0;i<indices.length;i+=3)for(let e=0;e<3;e++){
    const a=indices[i+e],b=indices[i+(e+1)%3];assert.notEqual(a,b);
    const k=Math.min(a,b)+':'+Math.max(a,b);counts.set(k,(counts.get(k)||0)+1);
  }
  return new Set(counts.values());
}
test('S07: empty particle snapshot creates no fake water, no grid and zero geometry',()=>{
  const w=createWaterWorld(),mesh=extractWaterSurface(w);
  assert.equal(mesh.vertexCount,0);assert.equal(mesh.triangleCount,0);assert.equal(mesh.bounds,null);
  assert.equal(mesh.positionsXYZ.length,0);assert.equal(mesh.indices.length,0);assert.equal(mesh.gridPoints,0);w.shutdown();
});
test('S07: isolated particle yields closed outward-oriented 3D mesh, normalized normals and positive volume',()=>{
  const w=withWater([particle(0,0,0)]),snapshot=w.particleSnapshot(),mesh=extractSurface(snapshot,params());
  assert.ok(mesh.triangleCount>100);assert.ok(mesh.vertexCount>20);
  assert.equal(mesh.positionsXYZ.length,3*mesh.vertexCount);
  assert.equal(mesh.normalsXYZ.length,3*mesh.vertexCount);
  assert.equal(mesh.indices.length,3*mesh.triangleCount);
  assert.deepEqual([...manifold(mesh)],[2],'each edge must belong to exactly 2 triangles');
  assert.ok(mesh.approximateSignedVolumeM3>0,'outward winding must yield positive volume');
  for(let i=0;i<mesh.vertexCount;i++){
    const x=mesh.positionsXYZ[i*3],y=mesh.positionsXYZ[i*3+1],z=mesh.positionsXYZ[i*3+2];
    const nx=mesh.normalsXYZ[i*3],ny=mesh.normalsXYZ[i*3+1],nz=mesh.normalsXYZ[i*3+2];
    assert.ok(Number.isFinite(x+y+z+nx+ny+nz));
    const len=Math.hypot(nx,ny,nz);
    assert.ok(Math.abs(len-1)<1e-5,`normal ${i} length ${len}`);
    assert.ok(x*nx+y*ny+z*nz>=-1e-5,'normal should point outward');
  }
  assert.deepEqual(w.particleSnapshot(),snapshot,'extraction must be read-only');w.shutdown();
});
test('S07: two isolated drops form two disconnected closed surfaces without an artificial bridge',()=>{
  const w=withWater([particle(-1.5,0,0),particle(1.5,0,0)]),mesh=extractSurface(w.particleSnapshot(),params());
  assert.ok(mesh.triangleCount>200);assert.deepEqual([...manifold(mesh)],[2]);
  assert.ok(mesh.bounds.min.x < -1.6 && mesh.bounds.max.x>1.6);
  assert.ok(mesh.approximateSignedVolumeM3>0);
  const left=new Set(),right=new Set();
  for(let t=0;t<mesh.indices.length;t+=3){
    const coords=[0,1,2].map(j=>mesh.positionsXYZ[mesh.indices[t+j]*3]);
    if(coords.every(x=>x<0))left.add(t/3);
    else if(coords.every(x=>x>0))right.add(t/3);
    else assert.fail('unexpected triangle joining two fluid drops');
  }
  assert.ok(left.size>0&&right.size>0);w.shutdown();
});
test('S07: same snapshot gives deterministic output, output edits do not mutate the source',()=>{
  const w=withWater([particle(.12,0,0),particle(-.12,0,0)]),before=w.particleSnapshot();
  const a=extractSurface(before,params()),b=extractSurface(before,params());
  assert.deepEqual(a.positionsXYZ,b.positionsXYZ);assert.deepEqual(a.indices,b.indices);assert.deepEqual(a.normalsXYZ,b.normalsXYZ);
  a.positionsXYZ.fill(-99);a.normalsXYZ.fill(0);a.indices.fill(0);
  assert.deepEqual(w.particleSnapshot(),before);assert.ok(b.vertexCount>0);w.shutdown();
});
test('S07: water surface tracks post-step particle positions and no stale cached mesh',()=>{
  const w=createWaterWorld({physical:{gravityMS2:v(0,0,0)}});
  const id=w.addParticle({position:v(0,0,0),velocity:v(1,0,0),massKg:1});
  const before=extractWaterSurface(w,{cellSizeMeters:.075});
  w.step(.005);const after=extractWaterSurface(w,{cellSizeMeters:.075});
  assert.ok(w.getParticle(id).position.x>0);
  assert.ok(after.bounds.max.x>before.bounds.max.x,'surface must follow particle movement');
  w.shutdown();
});
test('S07: budget, nonfinite and malformed frames reject before generating geometry',()=>{
  const w=withWater([particle(0,0,0)]);
  for(const x of [null,{},NaN,Infinity,-1])assert.throws(()=>SurfaceConfig.create({cellSizeMeters:x,influenceRadiusMeters:.3,isoLevel:.3}));
  for(const x of [0,1,Infinity,NaN])assert.throws(()=>SurfaceConfig.create({cellSizeMeters:.1,influenceRadiusMeters:.3,isoLevel:x}));
  const tooFine=SurfaceConfig.create({cellSizeMeters:.005,influenceRadiusMeters:1,isoLevel:.3,maxGridPoints:100});
  assert.throws(()=>extractSurface(w.particleSnapshot(),tooFine),e=>e instanceof FluidError&&e.code==='CAPACITY_EXCEEDED');
  const tooFew=SurfaceConfig.create({cellSizeMeters:.08,influenceRadiusMeters:.5,isoLevel:.3,maxTriangles:8});
  assert.throws(()=>extractSurface(w.particleSnapshot(),tooFew),e=>e instanceof FluidError&&e.code==='CAPACITY_EXCEEDED');
  assert.throws(()=>extractSurface({count:1,positionsXYZ:new Float64Array(2)},params()),e=>e instanceof FluidError);
  w.shutdown();
});
test('S07: water preset moved outside core; generic explicit config is required',()=>{
  assert.equal(typeof FluidConfig.referenceWater, 'undefined');
  assert.equal(typeof FluidWorld.prototype.getLiquidConfig, 'function');
  assert.throws(()=>new FluidWorld(),e=>e instanceof FluidError&&e.field==='config');
  const generic=new FluidWorld(FluidConfig.create({restDensityKgM3:400,gravityMS2:v(0,0,0),maxSubsteps:10,maxSubstepSeconds:.01}));
  assert.throws(()=>generic.step(.001),e=>e instanceof FluidError&&e.field==='liquidConfig');
  assert.equal(waterPhysicalConfig().restDensityKgM3,1000);
  const w=createWaterWorld();assert.equal(w.getLiquidConfig().kinematicViscosityM2S,1e-6);
  assert.ok(waterSurfaceConfig(w) instanceof SurfaceConfig);
  assert.ok(new WaterHydrodynamics());generic.shutdown();w.shutdown();
});

test('S07: particle mass influences extracted surface, without modifying the underlying world',()=>{
  const w=withWater([particle(0,0,0)]);
  const a=extractSurface(w.particleSnapshot(),params());
  const id=w.particleSnapshot().ids[0];
  w.updateParticle(id,{massKg:2});
  const b=extractSurface(w.particleSnapshot(),params());
  assert.ok(b.approximateSignedVolumeM3>a.approximateSignedVolumeM3);
  assert.ok(b.bounds.max.x>a.bounds.max.x);
  w.shutdown();
});
test('S07: water hydrodynamics policy is mandatory when buoyancy requested and not embedded in Jolt bridge',()=>{
  const w=createWaterWorld();
  class Vec {constructor(x,y,z){this.x=x;this.y=y;this.z=z;} GetX(){return this.x} GetY(){return this.y} GetZ(){return this.z}}
  const module={Vec,Vec3:Vec,destroy:()=>{}};
  const iface={GetPosition:()=>new Vec(0,0,0),GetRotation:()=>({...new Vec(0,0,0),GetX:()=>0,GetY:()=>0,GetZ:()=>0,GetW:()=>1}),
    GetLinearVelocity:()=>new Vec(0,0,0),GetAngularVelocity:()=>new Vec(0,0,0),AddImpulse(){},AddAngularImpulse(){}};
  const id={GetIndexAndSequenceNumber:()=>7};
  const adapter=new JoltFluidBridge(w,module,iface);
  assert.throws(()=>adapter.register({id,motion:'dynamic',shape:{kind:'sphere',radiusMeters:.25},buoyancyScale:1}),e=>e instanceof FluidError&&e.field==='hydrodynamics');
  assert.equal(w.boundaryCount,0);adapter.shutdown();w.shutdown();
});
