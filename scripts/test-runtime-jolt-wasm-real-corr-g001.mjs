// LF-RUNTIME-JOLT-PLAY-START-CORR-G001: usa el WASM real, sin simuladores.
// Requiere npm ci en el proyecto; dependencia ausente = FAIL, nunca SKIP.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { loadJolt, JoltWorld } from '../src/engine/runtime/physics/jolt.js'
import { NodeBodyRuntime } from '../src/engine/runtime/physics/node-bodies.js'

const J = await loadJolt() // falla explícitamente cuando no se puede cargar el WASM.
assert.ok(J?.JoltInterface && J?.StaticCompoundShapeSettings, 'No se cargaron los bindings nativos Jolt')
const box = (size=[1,2,1]) => ({type:'BoxShape3D',size})
const sphere = (radius=0.45) => ({type:'SphereShape3D',radius})
const capsule = (radius=0.35,height=1.5) => ({type:'CapsuleShape3D',radius,height})
const body=(id,type='staticbody3d')=>({id,name:id,type,parentId:null,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],visible:true,
  props: type==='rigidbody3d' ? {mass:5,gravityScale:1,linearDamping:0.05,angularDamping:0.1,friction:0.5,restitution:0.1,canSleep:true}
  :{friction:0.5,restitution:0.1}})
const shape=(id,parentId,resource=box(),position=[0,0,0],rotation=[0,0,0])=>({id,name:id,type:'collisionshape3d',parentId,
  position,rotation,scale:[1,1,1],visible:true,props:{disabled:false,shape:resource}})
const runtime=(objects,attachMesh=false)=>{
  const nodes=new Map()
  for(const o of objects){
    const n=new THREE.Object3D();n.name=o.name;n.userData.id=o.id
    n.position.fromArray(o.position||[0,0,0]);n.rotation.set(...(o.rotation||[0,0,0]))
    nodes.set(o.id,n)
  }
  for(const o of objects){const node=nodes.get(o.id)
    if(o.parentId && nodes.has(o.parentId))nodes.get(o.parentId).add(node)
    if(o.type==='primitive' && attachMesh){const m=new THREE.Mesh(new THREE.BoxGeometry(2,1,2));node.add(m);node.userData.visual=node}
  }
  const w=new JoltWorld(J),play={phys:w,project:{objects},ed:{nodes},colliders:[],_bodies:[]}
  play._bodyAdd=(id,opts)=>{
    const node=nodes.get(id),wp=node.getWorldPosition(new THREE.Vector3()),quat=node.getWorldQuaternion(new THREE.Quaternion())
    const item=w.dynamics().add({pos:wp,quat,center:new THREE.Vector3(),size:new THREE.Vector3(1,2,1)},opts)
    play._bodies.push({id,item});return item
  }
  const n=new NodeBodyRuntime(play,1)
  const dispose=()=>{try{n.dispose()}finally{w.dispose()}}
  return {w,n,play,nodes,dispose}
}

for(const [label,objects] of [
  ['JW-01 · StaticBody3D Box', [body('wall'),shape('wall-shape','wall')]],
  ['JW-02 · SphereShape3D',[body('wall'),shape('wall-shape','wall',sphere())]],
  ['JW-03 · CapsuleShape3D',[body('wall'),shape('wall-shape','wall',capsule())]],
  ['JW-04 · forma desplazada',[body('wall'),shape('wall-shape','wall',box(),[1,1,0])]],
  ['JW-05 · forma rotada',[body('wall'),shape('wall-shape','wall',box(),[0,0,0],[0,0.3,0])]],
  ['JW-06 · compuesto heterogéneo',[body('wall'),shape('a','wall'),shape('b','wall',sphere(),[2,0,0])]],
  ['JW-07 · RigidBody3D',[body('crate','rigidbody3d'),shape('crate-shape','crate',box())]],
]) test(label,()=>{
  const f=runtime(objects)
  try{
    f.n.start();assert.equal(objects.filter(o=>['staticbody3d','rigidbody3d'].includes(o.type)).length,1)
    assert.ok(f.w.nodeHandles.size===1 || f.w.rigidNodes.size===1)
    f.w.finalize();for(let i=0;i<4;i++)f.w.step(1/60)
  }finally{f.dispose()}
})

test('JW-08 · TriMeshShape3D estático y transformación local',()=>{
  const objects=[body('terrain'),{id:'source',name:'source',type:'primitive',parentId:'terrain',visible:true,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},
    shape('tri','terrain',{type:'TriMeshShape3D',sourceId:'source'},[0.5,0,0])]
  const f=runtime(objects,true)
  try{f.n.start();assert.equal(f.w.nodeHandles.size,1);f.w.step(1/60)}finally{f.dispose()}
})

test('JW-09 · Area3D con forma física real',()=>{
  const objects=[{id:'area',name:'area',type:'area3d',parentId:null,visible:true,scale:[1,1,1],props:{monitoring:true,monitorable:true}},
    shape('area-shape','area',box([2,2,2]))]
  const f=runtime(objects)
  try{f.n.start();assert.equal(f.n.spatial.areas.size,1);f.w.step(1/60)}finally{f.dispose()}
})

test('JW-10 · CharacterBody3D con cápsula nativa',()=>{
  const objects=[{id:'character',name:'character',type:'characterbody3d',parentId:null,visible:true,scale:[1,1,1],props:{mass:80,maxSlopeAngle:45,stepHeight:0.4,floorSnap:0.1,gravity:9.81,velocity:[0,0,0]}},
    shape('char-shape','character',capsule())]
  const f=runtime(objects)
  try{f.n.start();assert.equal(f.n.spatial.characters.size,1)}finally{f.dispose()}
})

test('JW-11 · liberar formas, cuerpos y reiniciar sin residuos',()=>{
  const objects=[body('wall'),shape('wall-shape','wall'),body('crate','rigidbody3d'),shape('crate-shape','crate',sphere(),[1,0,0])]
  for(let i=0;i<8;i++){
    const f=runtime(objects)
    try{f.n.start();f.w.step(1/60);assert.equal(f.w.nodeHandles.size,1);assert.equal(f.w.rigidNodes.size,1)}
    finally{f.dispose()}
  }
})

test('JW-12 · fallo de nodo no deja cuerpos estáticos registrados',()=>{
  const objects=[body('valid'),shape('one','valid'),body('bad'),shape('two','bad',box(),[0,2,0])]
  const f=runtime(objects)
  // Inyectar un fallo de inicialización en los datos de la escena antes de crear formas.
  f.play.ed.nodes.delete('two')
  try{assert.throws(()=>f.n.start(),/CollisionShape3D no construida/)
    assert.equal(f.w.nodeHandles.size,0);assert.equal(f.n.staticHandles.length,0)}finally{f.dispose()}
})
