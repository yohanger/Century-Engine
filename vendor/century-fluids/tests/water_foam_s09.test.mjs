import assert from 'node:assert/strict';
import test from 'node:test';
import {Vec3} from '../dist/index.js';
import {createWaterWorld,waterFoamSnapshot} from '../dist/fluids/water/index.js';

const v=Vec3.of, dt=1/120;
const volume=state=>state.airVolumeM3.reduce((sum,x)=>sum+x,0);

function pool(variant, foam=true) {
  const world=createWaterWorld({foam});
  world.addBoundary({kind:'plane',point:v(0,0,0),normal:v(0,1,0)});
  for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)world.addParticle({
    position:v(x*.105,.03,z*.105),velocity:variant==='uniform'?v(1,0,0):v(0,0,0),massKg:1,
  });
  if(variant==='impact')world.addParticle({position:v(0,.26,0),velocity:v(0,-1.8,0),massKg:1});
  if(variant==='submerged')for(let x=-1;x<=1;x++)for(let y=1;y<=3;y++)for(let z=-1;z<=1;z++)
    world.addParticle({position:v(x*.111,.03+y*.111,z*.111),velocity:y===1?v(0,-1,0):v(0,0,0),massKg:.6});
  return world;
}

test('S09 air capture requires an exposed impact; rest, uniform translation and submerged motion are controls',()=>{
  for(const variant of ['still','uniform','submerged']){
    const world=pool(variant);
    try{
      for(let step=0;step<(variant==='submerged'?8:120);step++){
        world.step(dt);
        const state=waterFoamSnapshot(world);
        assert.equal(state.entrainedM3,0,variant);
        assert.equal(volume(state),0,variant);
      }
    }finally{world.shutdown();}
  }
});

test('S09 trapped air has a balanced lifetime, advects on particles, and leaves water dynamics unchanged',()=>{
  const world=pool('impact'), reference=pool('impact',false);
  let prior=0, peak=0, initialCarrier, startPosition, mostCarriers=0;
  try{
    assert.equal(waterFoamSnapshot(reference),null);
    for(let step=0;step<600;step++){
      world.step(dt);reference.step(dt);
      const state=waterFoamSnapshot(world),next=volume(state);
      assert.ok(Math.abs(prior+state.entrainedM3-state.releasedM3-next)<1e-14,step);
      assert.ok(state.airVolumeM3.every(value=>Number.isFinite(value)&&value>=0));
      assert.deepEqual(world.particleSnapshot(),reference.particleSnapshot(),'air changed certified water kinematics');
      if(step===0){
        assert.ok(next>0&&state.entrainedM3>0);
        const index=state.airVolumeM3.findIndex(x=>x>0);
        initialCarrier=state.particles.ids[index];
        startPosition=state.particles.positionsXYZ.slice(3*index,3*index+3);
      }
      if(step===72){
        const index=state.particles.ids.indexOf(initialCarrier);
        assert.ok(state.airVolumeM3[index]>0);
        assert.notDeepEqual(startPosition,state.particles.positionsXYZ.slice(3*index,3*index+3));
      }
      prior=next;peak=Math.max(peak,next);
      mostCarriers=Math.max(mostCarriers,state.airVolumeM3.filter(x=>x>1e-12).length);
    }
    assert.ok(prior<.12*peak,'air should release after the impact');
    assert.ok(mostCarriers>1,'upward transfer should populate neighboring parcels');
    assert.equal(world.totalMassKg,10);
  }finally{world.shutdown();reference.shutdown();}
});

test('S09 foam storage follows stable particle ids across swap-removal and has detached snapshots',()=>{
  const world=pool('impact');
  try{
    world.step(dt);
    const first=waterFoamSnapshot(world);
    assert.ok(volume(first)>0);
    const removed=first.particles.ids[0];
    const values=new Map(Array.from(first.particles.ids,(id,i)=>[id,first.airVolumeM3[i]]));
    first.airVolumeM3.fill(0);
    world.removeParticle(removed);
    const after=waterFoamSnapshot(world);
    for(let i=0;i<after.particles.count;i++)assert.equal(after.airVolumeM3[i],values.get(after.particles.ids[i]));
    const id=world.addParticle({position:v(0,1,0),velocity:v(0,0,0),massKg:1});
    const appended=waterFoamSnapshot(world);
    assert.equal(appended.airVolumeM3[appended.particles.ids.indexOf(id)],0);
    assert.throws(()=>world.step(100),{code:'STEP_BUDGET_EXCEEDED'});
    assert.deepEqual(waterFoamSnapshot(world),appended);
  }finally{world.shutdown();}
});

test('S09 an oblique crest impact traps air only during converging downward motion',()=>{
  const h=.3, lateral=.205, height=.081;
  assert.ok(lateral>.45*h,'fixture lies outside the vertical capture footprint');
  for(const [variant,velocity] of [
    ['closing',v(-1.5,-.7,0)],
    ['glancing',v(0,0,1.5)],
    ['separating',v(1.5,.7,0)],
  ]){
    const world=createWaterWorld({foam:true});
    try{
      for(let z=-1;z<=1;z++)world.addParticle({position:v(0,.06,z*.12),velocity:v(0,0,0),massKg:1});
      world.addParticle({position:v(lateral,.06+height,0),velocity,massKg:1});
      world.step(dt);
      const state=waterFoamSnapshot(world);
      if(variant==='closing'){
        assert.ok(state.entrainedM3>0);
        assert.ok(Math.abs(volume(state)-state.entrainedM3)<1e-15);
      }else assert.equal(state.entrainedM3,0,variant);
      assert.equal(world.totalMassKg,4);
    }finally{world.shutdown();}
  }
});
