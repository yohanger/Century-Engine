import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PHYSICS_SHAPES, newPhysicsShape } from '../src/engine/runtime/physics/shapes.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'
import { registerNodeAnimationProperties, nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const definitions = new Map()
const physicsCode = read('src/engine/runtime/nodes/physics.js').replace(/^import .+$/gm,'')
const setupPhysics = Function('registerNode','AREA3D_NATIVE_SIGNALS','THREE','makeRoot','applyBase','hitSphere','lineMat','newPhysicsShape','PHYSICS_SHAPES','triMeshGeometry','liquidPourAnimation','liquidGeometryAnimation','combustionEnvironmentAnimation',
  `${physicsCode}\nreturn true`)
const fakeTHREE = new Proxy({}, { get: () => class { constructor() {} } })
setupPhysics(def => { definitions.set(def.type,def); registerNodeAnimationProperties(def.type, def.animation || {}); return def }, [], fakeTHREE,
  () => ({}), () => {}, () => {}, () => {}, newPhysicsShape, PHYSICS_SHAPES, () => ({}), ()=>({}),()=>({}),()=>({})) // El owner líquido se prueba en CONT006.

// Evaluación de la clase real, sin crear un segundo backend de física en QA.
const fakeScene = {
  Vector3:class {constructor(x=0,y=0,z=0){ Object.assign(this,{x,y,z}) }},
  Quaternion:class {},
}
const bodyCode=read('src/engine/runtime/physics/node-bodies.js')
  .replace(/^import .+$/gm,'').replace('export class NodeBodyRuntime', 'class NodeBodyRuntime')
const BodyRuntime=Function('THREE','physicsNodePlan','nodeEffectiveActive','NodeSpatialRuntime','resolveTriMeshSource','triMeshGeometry',
  `${bodyCode}\nreturn NodeBodyRuntime`)(fakeScene,()=>[],()=>true,class {},()=>null,()=>null)
const spatialCode=read('src/engine/runtime/physics/node-spatial.js')
  .replace(/^import .+$/gm,'').replace('export function spatialNodePlan','function spatialNodePlan')
  .replace('export class NodeSpatialRuntime','class NodeSpatialRuntime')
const SpatialRuntime=Function('THREE','getNativeSignal','validatePhysicsTree','createVirtualCharacter',
  `${spatialCode}\nreturn NodeSpatialRuntime`)(fakeScene,()=>null,()=>{},()=>null)
const node=(id,type,props) => ({id,type,active:true,visible:true,props})
const body=(initial={}) => {
  const data = {...initial}, writes=[]
  const bi = {}
  for(const [name,prop] of [['Friction','friction'],['Restitution','restitution'],['GravityFactor','gravityScale']]) {
    bi[`Get${name}`] = id => data[id.key][prop]
    bi[`Set${name}`] = (id,value) => { data[id.key][prop]=value; writes.push([id.key,prop,value]) }
  }
  return {bi,data,writes}
}
function runtime() {
  const staticObject=node('floor','staticbody3d',{friction:.4,restitution:.1})
  const rigidObject=node('barrel','rigidbody3d',{friction:.6,restitution:.15,gravityScale:1})
  const roots=new Map([[staticObject.id,{userData:{}}],[rigidObject.id,{userData:{}}]])
  const a={key:'A'},b={key:'B'},backend=body({A:{friction:.4,restitution:.1},B:{friction:.6,restitution:.15,gravityScale:1}})
  const world={disposed:false,bi:backend.bi,nodeHandles:new Map([[staticObject.id,{id:a}]]),
    rigidNodes:new Map([[roots.get(rigidObject.id),{id:b}]])}
  const play={project:{objects:[staticObject,rigidObject]},ed:{nodes:roots},phys:world}
  const owner=new BodyRuntime(play,1)
  owner.bodyOwners=[staticObject,rigidObject]
  return {owner,staticObject,rigidObject,roots,world,...backend}
}
const staticSpec=key=>definitions.get('staticbody3d').animation[`physics.${key === 'friction' ? 'staticFriction' : 'staticRestitution'}`]
const rigidSpec=key=>definitions.get('rigidbody3d').animation[`physics.${key === 'friction' ? 'rigidFriction' : key === 'restitution' ? 'rigidRestitution' : key}`]

test('PHYS-01 · registros: StaticBody3D (2) y RigidBody3D (3) sin reconstrucciones de Shape3D',()=>{
  assert.deepEqual(Object.keys(definitions.get('staticbody3d').animation),['physics.staticFriction','physics.staticRestitution'])
  assert.deepEqual(Object.keys(definitions.get('rigidbody3d').animation),['physics.rigidFriction','physics.rigidRestitution','physics.gravityScale','physics.linearDamping','physics.angularDamping','physics.rigidMass','physics.canSleep'])
  for (const [type,keys] of [['staticbody3d',['staticFriction','staticRestitution']],['rigidbody3d',['rigidFriction','rigidRestitution','gravityScale']]]) {
    const o=node(type,type, {friction:.5,restitution:.1,gravityScale:1})
    for (const key of keys) assert.ok(nodeAnimationProperty(o,`physics.${key}`))
  }
})
test('PHYS-02 · CharacterBody3D expone velocity vectorial y valida valores',()=>{
  const obj=node('character','characterbody3d',{velocity:[0,0,0],gravity:9.81,stepHeight:.35,floorSnap:.5})
  const spec=nodeAnimationProperty(obj,'physics.velocity')
  assert.equal(spec.kind,'vec3')
  assert.deepEqual(validatePropertyValue('physics.velocity',[1,2,3]),[1,2,3])
  assert.throws(()=>validatePropertyValue('physics.velocity',[1,2,'NaN']))
  const root={userData:{}},snap=spec.capture(root,obj)
  const authored=JSON.stringify(obj)
  spec.apply(root,[2,4,6],obj)
  assert.deepEqual(spec.runtimeRead(root,obj),[2,4,6])
  spec.restore(root,snap,obj)
  assert.equal(root.userData.timelineSpatial,undefined)
  assert.equal(JSON.stringify(obj),authored)
})
test('PHYS-03 · creación de claves y normalización sin cambiar props autorales',()=>{
  const obj=node('barrel','rigidbody3d',{friction:.6,restitution:.15,gravityScale:1})
  const timeline=newTimeline('Rigid',{duration:3})
  upsertTimelineNodePropertyKey(timeline,obj,'physics.gravityScale','scene-A',[obj],0,1)
  upsertTimelineNodePropertyKey(timeline,obj,'physics.gravityScale','scene-A',[obj],2,-.5)
  const loaded=normalizeTimeline(JSON.parse(JSON.stringify(timeline)))
  assert.deepEqual(loaded.tracks[0].keys.map(k=>k.v),[1,-.5])
  assert.equal(obj.props.gravityScale,1)
})
test('PHYS-04 · cada cuerpo Jolt conserva sus valores previos y no modifica otros cuerpos',()=>{
  const s=runtime()
  s.owner.syncTimelinePhysics()
  assert.equal(s.writes.length,0)
  const f=staticSpec('friction'),g=rigidSpec('gravityScale')
  const a=f.capture(s.roots.get('floor'),s.staticObject),b=g.capture(s.roots.get('barrel'),s.rigidObject)
  f.apply(s.roots.get('floor'),.9,s.staticObject)
  g.apply(s.roots.get('barrel'),.25,s.rigidObject)
  s.owner.syncTimelinePhysics()
  assert.equal(s.data.A.friction,.9)
  assert.equal(s.data.B.gravityScale,.25)
  assert.equal(s.data.B.friction,.6)
  assert.equal(s.staticObject.props.friction,.4)
  assert.equal(s.rigidObject.props.gravityScale,1)
  const count=s.writes.length
  s.owner.syncTimelinePhysics()
  assert.equal(s.writes.length,count,'No repetir escrituras idénticas cada subpaso')
  f.restore(s.roots.get('floor'),a,s.staticObject)
  g.restore(s.roots.get('barrel'),b,s.rigidObject)
  s.owner.syncTimelinePhysics()
  assert.equal(s.data.A.friction,.4)
  assert.equal(s.data.B.gravityScale,1)
  assert.equal(s.owner.timelineBodyValues.size,0)
})
test('PHYS-05 · reserva de dos canales del mismo cuerpo y restauración independiente',()=>{
  const s=runtime(),r=s.roots.get('barrel')
  const a=rigidSpec('friction'),b=rigidSpec('restitution')
  const oldA=a.capture(r,s.rigidObject),oldB=b.capture(r,s.rigidObject)
  a.apply(r,.1,s.rigidObject);b.apply(r,.8,s.rigidObject)
  s.owner.syncTimelinePhysics()
  assert.equal(s.data.B.friction,.1);assert.equal(s.data.B.restitution,.8)
  a.restore(r,oldA,s.rigidObject)
  s.owner.syncTimelinePhysics()
  assert.equal(s.data.B.friction,.6);assert.equal(s.data.B.restitution,.8)
  b.restore(r,oldB,s.rigidObject)
  s.owner.syncTimelinePhysics()
  assert.equal(s.data.B.restitution,.15)
})
test('PHYS-06 · una instancia física ausente no crea cuerpo nuevo ni usa un propietario ajeno',()=>{
  const s=runtime()
  s.world.nodeHandles.clear();s.world.rigidNodes.clear()
  staticSpec('friction').apply(s.roots.get('floor'),.7,s.staticObject)
  s.owner.syncTimelinePhysics()
  assert.equal(s.writes.length,0)
  assert.equal(s.owner.timelineBodyValues.size,0)
})
test('PHYS-07 · ausencia de setter Jolt detiene actualización, no simula éxito',()=>{
  const s=runtime()
  staticSpec('friction').apply(s.roots.get('floor'),.7,s.staticObject)
  s.world.bi.SetFriction=undefined
  assert.throws(()=>s.owner.syncTimelinePhysics(),/BodyInterface no admite friction/)
})
test('PHYS-08 · velocidad de CharacterBody3D utiliza setVelocity existente y se restaura',()=>{
  const o=node('hero','characterbody3d',{velocity:[0,0,0]})
  const visual={userData:{}},character={obj:o,node:visual,velocity:[1,-3,2]}
  const calls=[]
  const owner=new SpatialRuntime({ed:{nodes:new Map([[o.id,visual]])}},()=>{})
  owner.characters.set(o.id,character)
  owner.setVelocity=(id,vec)=>{calls.push([id,[...vec]]); character.velocity=[...vec]}
  owner.syncTimelineVelocity(character)
  assert.equal(calls.length,0)
  const desc=nodeAnimationProperty(o,'physics.velocity'),before=desc.capture(visual,o)
  desc.apply(visual,[5,0,0],o)
  owner.syncTimelineVelocity(character)
  assert.deepEqual(character.velocity,[5,0,0])
  character.velocity[1]=-1
  owner.syncTimelineVelocity(character)
  assert.equal(calls.length,1,'La gravedad no se reinicia por cada paso Jolt')
  desc.apply(visual,[2,3,0],o)
  owner.syncTimelineVelocity(character)
  assert.deepEqual(character.velocity,[2,3,0])
  desc.restore(visual,before,o)
  owner.syncTimelineVelocity(character)
  assert.deepEqual(character.velocity,[1,-3,2])
  assert.equal(character.timelineVelocityBefore,undefined)
  assert.equal(calls.length,3)
  assert.deepEqual(o.props.velocity,[0,0,0])
})
test('PHYS-09 · paso Jolt sincroniza cuerpos físicos antes del solver sin loop paralelo',()=>{
  const jolt=read('src/engine/runtime/physics/jolt.js')
  const code=read('src/engine/runtime/physics/node-bodies.js')
  assert.match(jolt,/step\(dt\) \{ this\.bodies\?\.beforeStep\(dt\); this\.nodeBodyRuntime\?\.syncTimelinePhysics\(\); this\.jolt\.Step/)
  assert.match(code,/world\.nodeBodyRuntime = this/)
  assert.match(code,/this\.play\.phys\?\.nodeBodyRuntime === this/)
  assert.doesNotMatch(code,/new JoltWorld\(/)
})
test('PHYS-10 · las llaves del Inspector reflejan propiedades físicamente consumidas',()=>{
  const inspector=read('src/components/Inspector.vue')
  for(const prop of ['staticFriction','staticRestitution','rigidFriction','rigidRestitution','gravityScale','velocity'])
    assert.match(inspector,new RegExp(`inspectorKeyable\\('physics\\.${prop}'\\)`))
  for (const prop of ['rigidMass','characterMass','canSleep','linearDamping','angularDamping','maxSlopeAngle'])
    assert.match(inspector,new RegExp(`inspectorKeyable\\('physics\\.${prop}'\\)`))
})


test('PHYS-11 · detener un Timeline restituye Jolt inmediatamente, sin esperar otro tick',()=>{
  const runtime=read('src/engine/runtime/events/play-timeline.js')
  assert.match(runtime,/rec\.prop\.startsWith\('physics\.'\) \|\| rec\.prop\.startsWith\('collision\.'\)/)
  assert.match(runtime,/if \(restorePhysics\) \{/); assert.match(runtime,/this\._nodeBodies\?\.syncTimelinePhysics\(\)/)
})
