import assert from 'node:assert/strict';
import test from 'node:test';
import {FluidError, Vec3} from '../dist/index.js';
import {createWaterWorld} from '../dist/fluids/water/index.js';
import {VoxelSurfaceCache} from '../dist/surface/index.js';

const dt = 1/120;
const V = Vec3.of;
const box = (min,max)=>({min:V(...min),max:V(...max)});
const gravity = V(0,-9.81,0);
const volume = world=>[...world.cells()].reduce((sum,cell)=>sum+cell.volumeM3,0);
const floor = world=>world.addBoundary({kind:'plane',point:V(0,0,0),normal:V(0,1,0)});
const elapsed = (world,steps)=>{for(let i=0;i<steps;i++)world.step(dt);};
const near = (actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,
  'expected ' + actual + ' near ' + expected + ' within ' + tolerance);

test('explicit emission and drain preserve water and stable SI coordinates across negative chunks',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.1}});
  const region=box([-.9,.2,-.27],[.92,.5,.31]);
  near(world.fillBox(region,.12),.12,1e-12);
  assert.ok(world.cellAt(-9,2,-3)?.volumeM3>0);
  near(world.volumeInBox(box([-2,0,-1],[2,1,1])),.12,1e-12);
  const removed=world.drainBox(box([-.9,.2,-.27],[.3,.5,.31]),.057);
  near(removed,.057,1e-12);
  near(volume(world),.12-removed,1e-12);
  near(world.totalMassKg,63,1e-8);
  world.shutdown();
  assert.throws(()=>world.step(dt),e=>e.code==='CLOSED');
  assert.throws(()=>createWaterWorld({physical:{gravityMS2:V(1,-9,0)}}),e=>e.code==='OUT_OF_RANGE');
});

test('gravity transports water downward while keeping volume finite and locally bounded',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.10}});
  const seed=world.fillBox(box([-.2,.8,-.2],[.2,1,.2]),.032);
  const center=()=>[...world.cells()].reduce((sum,c)=>sum+c.volumeM3*(c.floorMeters+c.surfaceMeters)*.5,0)/seed;
  const start=center();
  elapsed(world,36);
  const ballistic=start+.5*gravity.y*(36*dt)**2;
  near(center(),ballistic,.13);
  assert.ok(center()<start-.22);
  near(volume(world),seed,1e-10);
  for(const c of world.cells())assert.ok(c.volumeM3>=0&&c.volumeM3<=c.capacityM3+1e-12);
});

test('a thin wall closes a face without using cell occupancy alone',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.1}});
  floor(world);
  world.addBoundary({kind:'plane',point:V(0,0,-.23),normal:V(0,0,1)});
  world.addBoundary({kind:'plane',point:V(0,0,.23),normal:V(0,0,-1)});
  world.addBoundary({kind:'box',center:V(0,.27,.05),halfExtents:V(.006,.27,.52)});
  assert.equal(world.faceOpening(-1,0,0,0),0);
  world.fillBox(box([-.24,0,-.19],[-.11,.11,.19]),.004);
  elapsed(world,40);
  near(world.volumeInBox(box([0,0,-.25],[.3,.22,.25])),0,1e-12);
  near(volume(world),.004,1e-11);
});

test('communicating chambers exchange volume through a submerged throat',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.1}});
  floor(world);
  for(const [point,normal] of [[V(-.4,0,0),V(1,0,0)],[V(.4,0,0),V(-1,0,0)],
    [V(0,0,-.15),V(0,0,1)],[V(0,0,.15),V(0,0,-1)]])
    world.addBoundary({kind:'plane',point,normal});
  world.addBoundary({kind:'box',center:V(0,.3,0),halfExtents:V(.04,.12,.15)});
  const left=box([-.4,0,-.15],[-.05,.42,.15]);
  const right=box([.05,0,-.15],[.4,.49,.15]);
  const initial=world.fillBox(left,.038)+world.fillBox(right,.013);
  elapsed(world,240);
  const transferred=world.volumeInBox(right);
  assert.ok(transferred>.017,'right volume ' + transferred);
  near(volume(world),initial,1e-9);
});

test('rejected face budget rolls back every cell, geometry revision and impulses',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.1,maxFacesPerStep:14}});
  world.fillBox(box([0,.6,0],[.2,.8,.2]),.007);
  const before=[...world.cells()];
  const revision=world.revision;
  for(let i=0;i<2;i++){
    assert.throws(()=>world.step(dt), e=>e instanceof FluidError&&e.code==='STEP_BUDGET_EXCEEDED');
    assert.deepEqual([...world.cells()],before);
    assert.equal(world.revision,revision);
  }
});

test('solid displacement preserves volume and publishes reaction when a paddle closes cells',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.1}});
  floor(world);
  const id=world.addBoundary({kind:'plane',point:V(-.20,0,0),normal:V(1,0,0)});
  const initial=world.fillBox(box([-.20,0,-.20],[.20,.2,.20]),.032);
  world.updateBoundary(id,{kind:'plane',point:V(-.20,0,0),normal:V(1,0,0),velocity:V(.25,0,0)});
  const result=world.step(dt);
  assert.ok(result.boundaryReactions.some(r=>r.boundaryId===id&&r.impulseOnBoundaryNs.x<0));
  near(volume(world),initial,1e-10);
  assert.ok(result.maximumSolidExcessM3<1e-12);
});

test('a static flat volume sleeps, and dirty surface chunks use shared boundary vertices',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.1}});
  floor(world);
  for(const [point,normal] of [[V(.7,0,0),V(1,0,0)],[V(1,0,0),V(-1,0,0)],
    [V(0,0,0),V(0,0,1)],[V(0,0,.2),V(0,0,-1)]])
    world.addBoundary({kind:'plane',point,normal});
  world.fillBox(box([.7,0,0],[1,.1,.2]),.006);
  const cache=new VoxelSurfaceCache();
  const initial=cache.update(world);
  assert.ok(initial.chunks>=2);
  const keys=new Map(), edges=new Map();
  let shared=0;
  for(const {mesh} of initial.changes){
    if(!mesh)continue;
    for(let i=0;i<mesh.vertexCount;i++){
      const key=mesh.vertexKeys[i], value=[...mesh.positionsXYZ.subarray(i*3,i*3+3),...mesh.normalsXYZ.subarray(i*3,i*3+3)];
      if(keys.has(key)){
        assert.deepEqual(keys.get(key),value,'position and normal match across the chunk seam');
        shared++;
      }else keys.set(key,value);
    }
    for(let i=0;i<mesh.indices.length;i+=3)for(let edge=0;edge<3;edge++){
      const a=mesh.vertexKeys[mesh.indices[i+edge]], b=mesh.vertexKeys[mesh.indices[i+(edge+1)%3]];
      const key=a<b?a+':'+b:b+':'+a;
      edges.set(key,(edges.get(key)??0)+1);
    }
  }
  assert.ok(shared>0);
  assert.ok(edges.size>0 && [...edges.values()].every(count=>count===2),'the surface is closed across chunk boundaries');
  elapsed(world,5);
  assert.equal(world.step(dt).activeCells,0);
  assert.equal(cache.update(world).rebuilt,0);
  world.drainBox(box([.7,0,0],[1,.1,.2]),.006);
  const dry=cache.update(world);
  assert.equal(dry.chunks,0);
  assert.ok(dry.changes.every(delta=>delta.mesh===null));
});

test('the sloped channel carries water into an explicit sink while preserving its balance',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.15}});
  world.addBoundary({kind:'plane',point:V(0,0,0),normal:V(.12,1,0)});
  for(const [point,normal] of [[V(-.6,0,0),V(1,0,0)],[V(.6,0,0),V(-1,0,0)],
    [V(0,0,-.15),V(0,0,1)],[V(0,0,.15),V(0,0,-1)]])
    world.addBoundary({kind:'plane',point,normal});
  const source=box([-.55,.09,-.13],[-.17,.45,.13]);
  const outlet=box([.27,0,-.15],[.60,.35,.15]);
  let added=world.fillBox(source,.024),removed=0;
  for(let i=0;i<210;i++){
    if(i%12===0)added+=world.fillBox(source,.001);
    world.step(dt);
    if(i%12===0)removed+=world.drainBox(outlet,.001);
  }
  assert.ok(removed>.00035,'the downstream sink received '+removed+' m3');
  near(volume(world),added-removed,1e-9);
});

test('a calm sea stays inactive and a local drain wakes only neighboring cells',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.25}});
  floor(world);
  for(const [point,normal] of [[V(0,0,0),V(1,0,0)],[V(8,0,0),V(-1,0,0)],
    [V(0,0,0),V(0,0,1)],[V(0,0,8),V(0,0,-1)]])
    world.addBoundary({kind:'plane',point,normal});
  const filled=world.fillBox(box([0,0,0],[8,.5,8]),32);
  world.step(dt);
  assert.equal(world.step(dt).activeCells,0);
  const drained=world.drainBox(box([3.75,.25,3.75],[4.25,.5,4.25]),.013);
  const report=world.step(dt);
  assert.ok(report.activeCells>0 && report.activeCells < world.occupiedCellCount*.05);
  near(volume(world),filled-drained,1e-8);
});

test('moving water rebuilds shared surface tiles consistently across chunk halos',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.1}});
  floor(world);
  world.fillBox(box([.63,.66,-.30],[1.03,1.06,.23]),.080);
  const cache=new VoxelSurfaceCache();
  const stitched=new Map();
  const track=({changes})=>{
    for(const {key,mesh} of changes){
      if(mesh)stitched.set(key,mesh);
      else stitched.delete(key);
    }
  };
  track(cache.update(world));
  const highest=()=>Math.max(...[...stitched.values()].map(mesh=>mesh.bounds.max.y));
  const beginning=highest();
  for(const dtCount of [6,12,14,14]){
    elapsed(world,dtCount);
    track(cache.update(world));
    const fresh=new Map(new VoxelSurfaceCache().update(world).changes.map(({key,mesh})=>[key,mesh]));
    assert.deepEqual([...stitched.keys()].sort(),[...fresh.keys()].sort());
    for(const [key,mesh] of stitched){
      const rebuilt=fresh.get(key);
      assert.deepEqual(mesh.positionsXYZ,rebuilt.positionsXYZ,key);
      assert.deepEqual(mesh.normalsXYZ,rebuilt.normalsXYZ,key);
      assert.deepEqual(mesh.indices,rebuilt.indices,key);
    }
  }
  assert.ok(highest()<beginning-.20,'the reconstructed front must follow the falling water');
});

test('axis-aligned box footprint preserves partial voxel capacity and the open neighboring face',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.3}});
  world.addBoundary({kind:'box',center:V(.09,.15,.15),halfExtents:V(.09,.15,.15)});
  assert.equal(world.faceOpening(0,0,0,0),1);
  const added=world.fillBox(box([0,0,0],[.6,.3,.3]),.020);
  const partial=world.cellAt(0,0,0);
  assert.ok(partial);
  near(partial.capacityM3,.0108,1e-12);
  near(volume(world),added,1e-12);
});

test('horizontal equalization limits one exchange to avoid four-face overshoot',()=>{
  const world=createWaterWorld({physical:{maxSubstepSeconds:1/30},
    voxels:{cellSizeMeters:.3,minFilmFill:0,sleepAtRest:false}});
  for(const [point,normal] of [[V(0,0,0),V(0,1,0)],[V(0,0,0),V(1,0,0)],[V(.6,0,0),V(-1,0,0)],
    [V(0,0,0),V(0,0,1)],[V(0,0,.3),V(0,0,-1)]]) world.addBoundary({kind:'plane',point,normal});
  world.fillBox(box([0,0,0],[.3,.3,.3]),.014);
  world.fillBox(box([.3,0,0],[.6,.3,.3]),.013);
  const report=world.step(1/30);
  assert.ok(report.transferredVolumeM3>0);
  assert.ok(report.transferredVolumeM3<=.000221,
    'horizontal exchange exceeded bounded head volume: '+report.transferredVolumeM3);
  near(volume(world),.027,1e-12);
});

test('a basin with partial box walls wets its edge cells, levels and reaches rest',()=>{
  const world=createWaterWorld({voxels:{cellSizeMeters:.3,minFilmFill:.006,sleepAtRest:true}});
  floor(world);
  for(const boundary of [
    {center:V(.03,.45,.6),halfExtents:V(.05,.45,.65)},
    {center:V(1.17,.45,.6),halfExtents:V(.05,.45,.65)},
    {center:V(.6,.45,.03),halfExtents:V(.65,.45,.05)},
    {center:V(.6,.45,1.17),halfExtents:V(.65,.45,.05)}
  ]) world.addBoundary({kind:'box',...boundary});
  const added=world.fillBox(box([.08,0,.08],[1.12,.6,1.12]),.22);
  for(let i=0;i<400&&world.needsStep;i++) world.step(1/60);
  assert.equal(world.needsStep,false,'basin did not reach rest');
  const base=[...world.cells()].filter(c=>c.y===0&&c.x>=0&&c.x<4&&c.z>=0&&c.z<4);
  assert.equal(base.length,16);
  assert.ok(base.every(c=>c.volumeM3>1e-6),'a dry strip remained next to a basin wall');
  const surfaces=base.map(c=>c.surfaceMeters);
  assert.ok(Math.max(...surfaces)-Math.min(...surfaces)<1e-4,'basin surface did not level');
  near(volume(world),added,1e-10);
});
