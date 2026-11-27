import test from 'node:test'
import assert from 'node:assert/strict'
import {WaterWorld} from '../src/engine/runtime/geometry/waterworld.js'
import {fluidContainerDefaults} from '../src/engine/runtime/fluids/container-props.js'
import {containerCapacity,containerLocalPoint} from '../src/engine/runtime/fluids/container-shape.js'
import {Vector3,Quaternion,Euler} from 'three'
const pose={position:[0,1,0],quaternion:[0,0,0,1]},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`)
const cup=(w,id='cup',extra={},p=pose)=>w.addContainer({id,...fluidContainerDefaults('cup'),quality:'low',...extra},p)
const advance=(w,n=90)=>{for(let i=0;i<n;i++)w.step(1/60)}
test('250 ml remain in an upright MPM cup, with finite moving particles',()=>{
  const w=new WaterWorld();cup(w);advance(w)
  near(w.containerState('cup').volumeM3,.00025);assert.equal(w.containerParcels.length,0)
  assert.ok(w.containers.get('cup').fluid.localPositions().every(Number.isFinite));near(w.liquidBalances().water.errorM3,0)
})
test('tilting spills particles onto ground and persists their puddles conservatively',()=>{
  const w=new WaterWorld();w.fluidGroundAt=()=>0;cup(w);const initial=w.snapshot()
  w.setContainerPose('cup',{...pose,quaternion:[0,0,Math.sin(Math.PI/3),Math.cos(Math.PI/3)]});advance(w,120)
  near(w.containerState('cup').volumeM3,0);assert.ok(w.regions.size>0);near(w.liquidBalances().water.currentM3,.00025);near(w.liquidBalances().water.errorM3,0)
  const saved=w.snapshot();assert.equal(saved.version,8);advance(w,2);w.restore(saved);assert.deepEqual(w.snapshot(),saved)
  w.restore(initial);assert.equal(w.regions.size,0);near(w.containerState('cup').volumeM3,.00025)
})
test('closed bottle retains liquid when inverted and reopened bottle drains',()=>{
  const w=new WaterWorld();cup(w,'bottle',{...fluidContainerDefaults('bottle'),quality:'low',closed:true})
  w.setContainerPose('bottle',{...pose,quaternion:[1,0,0,0]});advance(w,120)
  near(w.containerState('bottle').volumeM3,.0005);assert.equal(w.containerParcels.length,0)
  w.setContainerGeometry('bottle',{closed:false});advance(w,120)
  assert.ok(w.containerState('bottle').volumeM3<.0005);near(w.liquidBalances().water.errorM3,0)
})
test('a swept parcel enters an open receiver and a lid excludes it',()=>{
  for(const closed of [false,true]){
    const w=new WaterWorld();cup(w,'source');cup(w,'receiver',{initialM3:0,closed},{position:[1,0,0],quaternion:[0,0,0,1]})
    w.pourContainer('source',.00001);w.containerExternalOut.set('water',0)
    w.containerParcels.push({position:[1,.052,0],velocity:[0,-1,0],volumeM3:.00001,origin:'source',liquidId:'water',age:0})
    w.step(1/60);near(w.containerState('receiver').volumeM3,closed?0:.00001);near(w.liquidBalances().water.errorM3,0)
  }
})
test('corrupt particle snapshot is rejected atomically',()=>{
  const w=new WaterWorld();cup(w);const before=w.snapshot(),bad=structuredClone(before);bad.containers[0].particles.volumes[0]*=2
  assert.throws(()=>w.restore(bad),/partículas/);assert.deepEqual(w.snapshot(),before)
})
test('bottle capacity matches narrowed neck and inverse transform handles rotated vessels',()=>{
  const size=[.08,.24,.08];assert.ok(containerCapacity('cylinder',size,'bottle')<containerCapacity('cylinder',size))
  const q=new Quaternion().setFromEuler(new Euler(.8,.3,-.5)),p={position:[1,2,-3],quaternion:q.toArray()},local=new Vector3(.02,-.03,.01)
  const world=local.clone().applyQuaternion(q).add(new Vector3(...p.position));const result=containerLocalPoint(world.toArray(),p)
  result.forEach((n,i)=>near(n,local.toArray()[i]))
})

test('a table over a terrain region supports spilled particles without teleporting volume below',()=>{
  const w=new WaterWorld();w.addRegion({id:'land',x:-1,z:-1,width:4,height:4,cellSize:.5,bed:Array(16).fill(0),depth:Array(16).fill(0)})
  w.fluidGroundAt=()=>.5;cup(w,'source');w.pourContainer('source',.00001);w.containerExternalOut.set('water',0)
  w.containerParcels.push({position:[0,.52,0],velocity:[0,-1,0],volumeM3:.00001,origin:'source',liquidId:'water',age:0})
  advance(w,180);assert.equal(w.containerParcels.length,1);assert.ok(w.containerParcels[0].position[1]>.5)
  near(w.regions.get('land').volume(),0);near(w.liquidBalances().water.errorM3,0)
})
