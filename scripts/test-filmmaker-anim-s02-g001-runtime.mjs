// Harness aislado del scheduler de physics-bake. NO sustituye la prueba de Jolt WASM real.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { BAKE_HZ, BAKE_MAX_SECONDS, BAKE_MAX_BODIES, normalizePhysicsBakes, physicsSignature } from '../src/filmmaker/physics-data.js'
class V3 {
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 copy(p){Object.assign(this,{x:p.x,y:p.y,z:p.z});return this}
 clone(){return new V3(this.x,this.y,this.z)}
 set(x,y,z){Object.assign(this,{x,y,z});return this}
 fromArray(a){return this.set(...a)}
 toArray(){return [this.x,this.y,this.z]}
}
class Q4 {
 constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w}
 copy(q){Object.assign(this,{x:q.x,y:q.y,z:q.z,w:q.w});return this}
 fromArray(a){return this.copy(new Q4(...a))}
 toArray(){return [this.x,this.y,this.z,this.w]}
 clone(){return new Q4(...this.toArray())}
 invert(){this.x*=-1;this.y*=-1;this.z*=-1;return this}
 multiply(b){return this.copy(new Q4(this.x*b.w+this.w*b.x,this.y*b.w+this.w*b.y,this.z*b.w+this.w*b.z,this.w*b.w-this.x*b.x-this.y*b.y-this.z*b.z))}
 slerp(b,t){for(const k of ['x','y','z','w'])this[k]+=t*(b[k]-this[k]);return this}
 normalize(){const m=Math.hypot(...this.toArray());for(const k of ['x','y','z','w'])this[k]/=m;return this}
}
class Group {
 constructor(){this.position=new V3();this.quaternion=new Q4();this.scale=new V3(1,1,1);this.userData={};this.children=[];this.parent=null;this.matrixWorld={decompose:(p,q,s)=>{p.copy(this.position);q.copy(this.quaternion);s.copy(this.scale)}}}
 add(node){this.children.push(node);node.parent=this}
 updateWorldMatrix(){}
 updateMatrixWorld(){}
 worldToLocal(v){return v.set(v.x-this.position.x,v.y-this.position.y,v.z-this.position.z)}
 getWorldQuaternion(q){return q.copy(this.quaternion)}
}
let disposed=0
class FakeNodeBodyRuntime {
 constructor(play){this.play=play}
 start(){const body=this.play.project.objects.find(o=>o.type==='rigidbody3d');this.play._bodyAdd(body.id,{mass:1})}
 dispose(){disposed++}
}
const physPlan=objects=>objects.filter(o=>o.type==='rigidbody3d').map(obj=>({obj,shapes:objects.filter(o=>o.parentId===obj.id),dynamic:true}))
const read=new URL('../src/filmmaker/physics-bake.js',import.meta.url)
const code=readFileSync(read,'utf8').replace(/^import .*\n/gm,'').replace(/export (async function|function|class) /g,'$1 ')
const ctx={THREE:{Vector3:V3,Quaternion:Q4,Group},BAKE_HZ,BAKE_MAX_SECONDS,BAKE_MAX_BODIES,normalizePhysicsBakes,physicsSignature,
  NodeBodyRuntime:FakeNodeBodyRuntime,physicsNodePlan:physPlan,Error,Math,Number,Map,Set,JSON,setTimeout,console,loadJolt:async()=>{throw new Error('mock no debe cargar Jolt')},JoltWorld:class{}}
vm.runInNewContext(code+'\nthis.api={simulatePhysicsBake,samplePhysicsBake,FilmPhysicsPose}',ctx)
const {simulatePhysicsBake,samplePhysicsBake,FilmPhysicsPose}=ctx.api
const scene=()=>[{id:'parent',type:'node3d',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},
 {id:'cup',type:'rigidbody3d',parentId:'parent',position:[0,2,0],rotation:[0,0,0],scale:[1,1,1],props:{mass:1}},
 {id:'shape',parentId:'cup',type:'collisionshape3d',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],props:{shape:{type:'BoxShape3D',size:[1,1,1]}}}]
const nodeMap=()=>new Map(scene().map(o=>{const n=new Group();n.position.fromArray(o.position);return [o.id,n]}))
function mockWorld(){const parts=[];let frames=0;const dynamics={add({pos,quat}){const item={pos:pos.clone(),quat:quat.clone()};parts.push(item);return item},pose(it){return {pos:it.pos.clone(),quat:it.quat.clone()}}}
 return {get frames(){return frames},dynamics:()=>dynamics,step(dt){frames++;for(const b of parts)b.pos.y-=dt*2}}
}
test('PHY-RT-01 · simula en clones con tiempo fijo; editor original no cambia',async()=>{
 const objects=scene(),nodes=nodeMap(),world=mockWorld(),before=JSON.stringify(objects),original=nodes.get('cup').position.toArray()
 const b=await simulatePhysicsBake({objects,nodes,duration:2/60,driver:{world}})
 assert.equal(b.bodies.length,1);assert.equal(b.bodies[0].samples.length,3);assert.equal(world.frames,2)
 assert.ok(b.bodies[0].samples[2].pos[1]<b.bodies[0].samples[0].pos[1])
 assert.equal(JSON.stringify(objects),before);assert.deepEqual(nodes.get('cup').position.toArray(),original)
})
test('PHY-RT-02 · muestreo inverso exacto, el resultado no depende del frame previo',async()=>{
 const objects=scene(),world=mockWorld(),b=await simulatePhysicsBake({objects,nodes:nodeMap(),duration:2/60,driver:{world}})
 const at=t=>Array.from(samplePhysicsBake(b,t).get('cup').pos)
 const a=at(0.02);at(2/60);at(0);assert.deepEqual(at(0.02),a)
 assert.equal(samplePhysicsBake(b,-1).size,0)
 assert.deepEqual(at(20),b.bodies[0].samples.at(-1).pos)
})
test('PHY-RT-03 · overlay restaura la pose al retroceder, parar y detectar invalidación',async()=>{
 const objects=scene(),nodes=nodeMap(),world=mockWorld(),b=await simulatePhysicsBake({objects,nodes,duration:2/60,driver:{world}})
 const editor={nodes,vp:{requestRender(){}}},overlay=new FilmPhysicsPose(editor,objects,[b]),start=nodes.get('cup').position.toArray()
 overlay.at(2/60);assert.ok(nodes.get('cup').position.y<2)
 overlay.at(0);assert.deepEqual(nodes.get('cup').position.toArray(),start)
 overlay.at(2/60);overlay.restore();assert.deepEqual(nodes.get('cup').position.toArray(),start)
 objects[1].props.mass=5
 assert.match(overlay.at(2/60)[0],/desactualizado/);assert.deepEqual(nodes.get('cup').position.toArray(),start)
})
test('PHY-RT-04 · cancelación corta el bucle y libera el adaptador',async()=>{
 const controller=new AbortController(),world=mockWorld(),before=disposed
 await assert.rejects(simulatePhysicsBake({objects:scene(),nodes:nodeMap(),duration:1,driver:{world},signal:controller.signal,
   onProgress:p=>{if(p>=.5)controller.abort()}}),/cancelado/)
 assert.equal(world.frames,30);assert.equal(disposed,before+1)
})
