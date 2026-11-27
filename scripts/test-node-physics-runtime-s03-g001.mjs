// LF-NODE-PHYSICS-RUNTIME-S03-G001 — plan de escena, forma compuesta y ciclo de vida.
// Las pruebas del adaptador usan dobles de Three/Jolt; Jolt WASM real requiere QA local.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { physicsNodePlan } from '../src/engine/runtime/physics/node-body-plan.js'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const staticBody = (id = 'wall', extra = {}) => ({ id, name: id, type: 'staticbody3d', parentId: null,
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, props: { friction: 0.5, restitution: 0, ...extra } })
const rigid = (id = 'crate', extra = {}) => ({ ...staticBody(id), type: 'rigidbody3d',
  props: { mass: 3, gravityScale: 0.7, linearDamping: 0.2, angularDamping: 0.3, friction: 0.6, restitution: 0.1, canSleep: true, ...extra } })
const shape = (id, parentId, resource = { type: 'BoxShape3D', size: [1, 2, 3] }, extra = {}) =>
  ({ id, name: id, type: 'collisionshape3d', parentId, position: [0, 0, 0], rotation: [0, 0, 0],
    scale: [1, 1, 1], visible: true, props: { shape: resource, disabled: false, ...extra } })
const visual = (id = 'cube', parentId = null) => ({ id, name: id, type: 'primitive', parentId,
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, props: {} })

for (const [label, objects, expected] of [
  ['primitiva sola', [visual()], 0],
  ['malla visual bajo Node3D', [{ id:'root', type:'node3d', scale:[1,1,1] }, visual('v', 'root')], 0],
  ['estático con Box', [staticBody(), shape('s','wall')], 1],
  ['dinámico con Sphere', [rigid(), shape('s','crate',{type:'SphereShape3D',radius:0.5})], 1],
  ['varias formas, un cuerpo', [staticBody(), shape('a','wall'),shape('b','wall')], 1],
  ['forma deshabilitada', [staticBody(), shape('s','wall',undefined,{disabled:true})], 0],
  ['cuerpo sin forma', [staticBody()], 0],
  ['cuerpo invisible', [staticBody('wall',{ }),{...shape('s','wall')}].map(o=>o.id==='wall'?{...o,visible:false}:o),1],
  ['forma invisible', [staticBody(), {...shape('s','wall'),visible:false}],1],
  ['nieto de padre invisible', [{id:'root',type:'node3d',visible:false,scale:[1,1,1]}, {...staticBody(),parentId:'root'},shape('s','wall')],1],
  ['cuerpo inactivo se planifica para reactivación', [{...staticBody(),active:false},shape('s','wall')],1],
  ['dos cuerpos', [staticBody(),rigid(),shape('a','wall'),shape('b','crate')],2],
]) test(`PR-PLAN · ${label}`, () => assert.equal(physicsNodePlan(objects).length,expected))

test('PR-01 · dos CollisionShape3D pertenecen al mismo cuerpo', () => {
  const p = physicsNodePlan([staticBody(), shape('a','wall'),shape('b','wall')])
  assert.deepEqual(p.map(x=>[x.obj.id,x.shapes.map(s=>s.id)]),[['wall',['a','b']]])
})
test('PR-02 · otra forma deshabilitada no contamina el compuesto', () => {
  const p = physicsNodePlan([staticBody(),shape('a','wall'),shape('b','wall',undefined,{disabled:true})])
  assert.deepEqual(p[0].shapes.map(x=>x.id),['a'])
})
test('PR-03 · no se altera el arreglo de objetos original', () => {
  const o=[staticBody(),shape('a','wall')],before=JSON.stringify(o)
  physicsNodePlan(o);assert.equal(JSON.stringify(o),before)
})
test('PR-04 · IDs duplicados rechazados antes de crear cuerpos', () =>
  assert.throws(()=>physicsNodePlan([staticBody(),staticBody()]),/duplicados/))
test('PR-05 · Shape3D inválida rechazada, no se fabrica un collider sustituto', () =>
  assert.throws(()=>physicsNodePlan([staticBody(),shape('s','wall',{type:'SphereShape3D',radius:0})]),/positivo/))
test('PR-06 · forma sin body rechazado',()=>assert.throws(()=>physicsNodePlan([shape('s','lost')]),/hija directa/))
test('PR-07 · forma con escala rechazada',()=>assert.throws(()=>physicsNodePlan([staticBody(),{...shape('s','wall'),scale:[2,1,1]}]),/escala/))
test('PR-08 · física no depende de collision=true',()=>{
  const objects=[{...visual(),collision:true},{...staticBody(),collision:false},shape('s','wall')]
  assert.deepEqual(physicsNodePlan(objects).map(x=>x.obj.id),['wall'])
})

// Implementación mínima de matrices y vectores para verificar que el adaptador
// construye cuerpos de los datos del árbol y NO del tipo visual.
const fakeThree = `
  export class Vector3 {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
    clone(){return new Vector3(this.x,this.y,this.z)}
    lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}
  }
  export class Quaternion {
    constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w}
    set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this}
    clone(){return new Quaternion(this.x,this.y,this.z,this.w)}
  }
  export class Matrix4 {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
    clone(){return new Matrix4(this.x,this.y,this.z)}
    invert(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this}
    multiply(m){this.x+=m.x;this.y+=m.y;this.z+=m.z;return this}
    decompose(p,q,s){p.set(this.x,this.y,this.z);q.set(0,0,0,1);s.set(1,1,1)}
  }
`
const threeUrl = 'data:text/javascript,' + encodeURIComponent(fakeThree)
const planUrl = new URL('../src/engine/runtime/physics/node-body-plan.js', import.meta.url).href
const adapterSource = read('src/engine/runtime/physics/node-bodies.js')
  .replace("from 'three'", `from '${threeUrl}'`)
  .replace("from './node-body-plan.js'", `from '${planUrl}'`)
  .replace("import { nodeEffectiveActive } from '../nodes/hierarchy.js'", "const nodeEffectiveActive = (objects, obj) => {const byId = new Map(objects.map(o => [o.id,o])); for(let n=obj;n;n=n.parentId ? byId.get(n.parentId) : null) {if(n.active===false) return false;} return true}")
  .replace("import { NodeSpatialRuntime } from './node-spatial.js'", 'class NodeSpatialRuntime { start(){} dispose(){} }')
  .replace("from './shapes.js'", `from '${new URL('../src/engine/runtime/physics/shapes.js', import.meta.url).href}'`)
  .replace("from './trimesh-source.js'", `from '${new URL('../src/engine/runtime/physics/trimesh-source.js', import.meta.url).href}'`)
  .replace("from './trimesh-geometry.js'", `from 'data:text/javascript,export const triMeshGeometry = () => ({positions:new Float32Array(9),indices:new Uint32Array([0,1,2])})'`)
const { NodeBodyRuntime } = await import('data:text/javascript,' + encodeURIComponent(adapterSource))
const FakeTHREE = await import(threeUrl)

function fixture(objects) {
  let nextId = 0
  const results = { static:[], dynamic:[], freed:[], compound:[], shapeReleased:0 }
  const nodeMap = new Map(objects.map(o=>{
    const node={userData:{id:o.id},parent:null,matrixWorld:new FakeTHREE.Matrix4(...(o.position||[0,0,0])),
      visible:o.visible!==false, isMesh:false, updateWorldMatrix(){},
      traverse(fn){fn(this);for(const n of this.children||[])n.traverse(fn)}}
    return [o.id,node]
  }))
  for(const o of objects){const n=nodeMap.get(o.id);if(o.parentId&&nodeMap.has(o.parentId)){
    n.parent=nodeMap.get(o.parentId);(n.parent.children||=([])).push(n)
    const a=n.parent.matrixWorld,b=n.matrixWorld;n.matrixWorld=new FakeTHREE.Matrix4(a.x+b.x,a.y+b.y,a.z+b.z)
  }}
  class FShape { AddRef(){} Release(){results.shapeReleased++} }
  class Result { constructor(shape){this.shape=shape} IsValid(){return true} Get(){return this.shape} }
  class Settings { constructor(){this.parts=[];this.destroyed=false} AddShape(v,q,s){if (!(s instanceof Settings)) throw new TypeError('Solo se admiten ShapeSettings');this.parts.push({pos:[v.x,v.y,v.z],shape:s})}
    Create(){results.compound.push(this.parts);return new Result(new FShape())} }
  class V3 {constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}}
  class Q4 {constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w}}
  const J={Vec3:V3,Quat:Q4,StaticCompoundShapeSettings:Settings,
    RotatedTranslatedShapeSettings:class extends Settings {constructor(v,q,s){super();this.AddShape(v,q,s)}},
    BoxShapeSettings:class extends Settings {},
    SphereShapeSettings:class extends Settings {},CapsuleShapeSettings:class extends Settings {},
    destroy(obj) {
      if (!(obj instanceof Settings)) return
      if (obj.destroyed) throw new Error('Doble liberación de ShapeSettings: memoria nativa inválida')
      obj.destroyed = true
      for (const part of obj.parts) this.destroy(part.shape)
    }}
  const world={J,shapes:new Map(),byBody:new Map(),nodeHandles:new Map(),rigidNodes:new Map(),disposed:false,
    _boxShape(){return new FShape()},_body(s,p,q,m,sensor,physical){const id=++nextId;results.static.push({id,s,p:p.clone(),physical});return id},
    _key(id){return id},_free(h){results.freed.push(h.id)},
  }
  const play={project:{objects},ed:{nodes:nodeMap},phys:world,colliders:[],_bodies:[],
    _bodyAdd(id,opts){results.dynamic.push({id,opts});this._bodies.push({id,item:{id}})}}
  return {play,world,results}
}

test('PR-09 · StaticBody3D construye un único cuerpo Jolt de BoxShape3D',()=>{
 const f=fixture([staticBody(),shape('s','wall')]),runtime=new NodeBodyRuntime(f.play,3)
 runtime.start()
 assert.equal(f.results.static.length,1);assert.equal(f.world.nodeHandles.size,1)
 assert.equal(f.results.static[0].physical.friction,0.5)
 runtime.dispose();assert.deepEqual(f.results.freed,[1]);assert.equal(f.world.nodeHandles.size,0)
})
test('PR-10 · dos formas locales producen un compound, NO dos cuerpos',()=>{
 const f=fixture([staticBody(),shape('a','wall'),{...shape('b','wall'),position:[2,0,0]}])
 new NodeBodyRuntime(f.play,3).start()
 assert.equal(f.results.static.length,1)
 assert.deepEqual(f.results.compound[0].map(p=>p.pos),[[0,0,0],[2,0,0]])
 assert.equal(f.results.shapeReleased,1)
})
test('PR-11 · shape desplazada produce RotatedTranslated y se libera',()=>{
 const f=fixture([staticBody(),{...shape('s','wall'),position:[0,1,0]}])
 new NodeBodyRuntime(f.play,3).start()
 assert.deepEqual(f.results.compound[0][0].pos,[0,1,0])
 assert.equal(f.results.shapeReleased,1)
})
test('PR-12 · RigidBody3D usa su shape y sus propiedades, no escala visual',()=>{
 const f=fixture([rigid(),shape('s','crate')]), runtime=new NodeBodyRuntime(f.play,3)
 runtime.start()
 assert.equal(f.results.static.length,0);assert.equal(f.results.dynamic.length,1)
 assert.equal(f.results.dynamic[0].opts.mass,3)
 assert.equal(f.results.dynamic[0].opts.gravityScale,0.7)
 assert.equal(f.results.dynamic[0].opts.linearDamping,0.2)
 assert.ok(f.results.dynamic[0].opts.colliderShape)
 assert.equal(f.world.rigidNodes.size,1)
 runtime.dispose()
})
test('PR-13 · cuerpo sin shape no genera Jolt ni fallback ficticio',()=>{
 const f=fixture([staticBody()])
 const old=console.warn;console.warn=()=>{}
 try{new NodeBodyRuntime(f.play,3).start()}finally{console.warn=old}
 assert.equal(f.results.static.length,0);assert.equal(f.results.dynamic.length,0)
})
test('PR-14 · dos cuerpos independientes no comparten handles',()=>{
 const f=fixture([staticBody('a'),staticBody('b'),shape('sa','a'),shape('sb','b')])
 const r=new NodeBodyRuntime(f.play,3);r.start()
 assert.equal(f.results.static.length,2)
 assert.equal(f.world.nodeHandles.size,2)
 r.dispose();assert.equal(f.results.freed.length,2)
})
test('PR-15 · código S03 elimina colisión implícita por tipo de malla',()=>{
 const s=read('src/engine/runtime/events/play.js')
 assert.doesNotMatch(s,/\['primitive', 'mesh', 'model', 'road', 'text'\]\.includes\(o\.type\)/)
 assert.match(s,/_bodiesInit\(\)/)
})
test('PR-16 · fábrica no añade collision a primitivas nuevas',()=>{
 const s=read('src/engine/runtime/nodes/index.js')
 assert.doesNotMatch(s,/collision: true/)
})
test('PR-17 · Inspector elimina controles físicos de las mallas',()=>{
 const s=read('src/components/Inspector.vue')
 assert.doesNotMatch(s,/obj\.props\.dynamic|obj\.props\.floats|obj\.collision/)
 assert.match(s,/physical-body-inspector/)
 assert.match(s,/collision-shape-inspector/)
})
test('PR-18 · JoltWorld mantiene un único mundo y libera StaticBody3D',()=>{
 const s=read('src/engine/runtime/physics/jolt.js')
 assert.match(s,/this\.nodeHandles = new Map\(\)/)
 assert.match(s,/for \(const h of this\.nodeHandles\.values\(\)\) this\._free\(h\)/)
 assert.match(s,/_underNodeBodies\(node\)/)
})
test('PR-19 · Player exportado sigue utilizando PlayMode',()=>{
 assert.match(read('src/engine/runtime/package/game.js'),/import \{ PlayMode \} from '\.\.\/events\/play\.js'/)
})
test('PR-20 · orden fijo y callbacks de eventos no han sido reordenados',()=>{
 const src=read('src/engine/runtime/events/play-controls.js')
 assert.ok(src.indexOf('this._events(dt)')<src.indexOf('this._bodiesTick(dt)'))
 assert.match(src,/this\.game\.fixedUpdate\(fdt\)/)
})

test('TM-JOLT · TriMesh estática crea un solo cuerpo Jolt y libera forma owned',()=>{
 const source = visual('floor','wall')
 const f=fixture([staticBody(),source,shape('s','wall',{type:'TriMeshShape3D',sourceId:'floor'})])
 f.world._meshShape=(positions,indices)=>{
   assert.equal(positions.length,9)
   assert.deepEqual([...indices],[0,1,2])
   return {AddRef(){},Release(){f.results.shapeReleased++}}
 }
 const runtime=new NodeBodyRuntime(f.play,3)
 runtime.start()
 assert.equal(f.results.static.length,1)
 assert.equal(f.results.shapeReleased,1)
 runtime.dispose()
 assert.deepEqual(f.results.freed,[1])
})

// S03 existente, reforzado por CORR-G001: la validación del mock rechaza Shape como si fuese Settings.
test('JOLT-CORR-01 · forma desplazada exige ShapeSettings, no forma cocinada', () => {
 const f=fixture([staticBody(),{...shape('s','wall'),position:[0,1,0]}])
 const r=new NodeBodyRuntime(f.play,3)
 r.start()
 assert.equal(f.results.compound.length,1)
 r.dispose()
})
test('JOLT-CORR-02 · error después de crear un cuerpo libera la inicialización parcial', () => {
 const f=fixture([staticBody('first'),shape('valid','first'),staticBody('second'),shape('missing','second')])
 f.play.ed.nodes.delete('missing')
 const r=new NodeBodyRuntime(f.play,3)
 assert.throws(()=>r.start(),/CollisionShape3D no construida/)
 assert.deepEqual(f.results.freed,[1]);assert.equal(f.world.nodeHandles.size,0)
 assert.equal(r.staticHandles.length,0)
})
