import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PHYSICS_SHAPES, newPhysicsShape } from '../src/engine/runtime/physics/shapes.js'
import { registerNodeAnimationProperties, nodeAnimationProperty } from '../src/engine/runtime/anim/model.js'
import { newTimeline, normalizeTimeline, upsertTimelineNodePropertyKey } from '../src/core/timeline/model.js'

const src = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const defs = new Map()
const runtimeCode = src('src/engine/runtime/nodes/physics.js').replace(/^import .+$/gm, '')
const FakeThree = new Proxy({}, { get: () => class {} })
Function('registerNode', 'AREA3D_NATIVE_SIGNALS', 'THREE', 'makeRoot', 'applyBase', 'hitSphere', 'lineMat', 'newPhysicsShape', 'PHYSICS_SHAPES', 'triMeshGeometry', 'liquidPourAnimation', 'liquidGeometryAnimation', 'combustionEnvironmentAnimation',
  `${runtimeCode}; return true`)(def => { defs.set(def.type, def);registerNodeAnimationProperties(def.type,def.animation || {});return def },
  [], FakeThree,()=>({}),()=>{},()=>{},()=>{},newPhysicsShape,PHYSICS_SHAPES,()=>{},()=>({}),()=>({}),()=>({})) // Owner líquido aislado; validado en CONT006.
const bodySource = src('src/engine/runtime/physics/node-bodies.js')
  .replace(/^import .+$/gm,'').replace('export class NodeBodyRuntime','class NodeBodyRuntime')
const BodyRuntime = Function('THREE','physicsNodePlan','nodeEffectiveActive','NodeSpatialRuntime','resolveTriMeshSource','triMeshGeometry',
  `${bodySource};return NodeBodyRuntime`)({Vector3:class {},Quaternion:class {}},()=>[],()=>true,class {},()=>null,()=>null)
const spatialSource = src('src/engine/runtime/physics/node-spatial.js')
  .replace(/^import .+$/gm,'').replace('export function spatialNodePlan','function spatialNodePlan')
  .replace('export class NodeSpatialRuntime','class NodeSpatialRuntime')
const SpatialRuntime = Function('THREE','getNativeSignal','validatePhysicsTree','createVirtualCharacter',
  `${spatialSource}; return NodeSpatialRuntime`)({Vector3:class {},Quaternion:class {}},()=>null,()=>{},()=>null)
const makeNode = (id,type,props) => ({id,type,active:true,visible:true,props})
const rigidDefaults = { mass:20,linearDamping:.12,angularDamping:.24,canSleep:true,friction:.5,restitution:0,gravityScale:1 }
function mockPhysics(masses=[20,30]) {
  const nodes = masses.map((mass,i)=>makeNode(`rigid-${i}`,'rigidbody3d',{...rigidDefaults,mass}))
  const roots = new Map(nodes.map(n=>[n.id,{userData:{}}]))
  const motions = masses.map((mass,i)=>({mass,linearDamping:.18+i*.1,angularDamping:.31+i*.1,canSleep:true}))
  const calls = []
  const nativeBodies = masses.map((mass,i)=>{
    const data=motions[i]
    const motion={
      GetInverseMass:()=>1/data.mass,
      ScaleToMass:value=>{calls.push([i,'mass',value]);data.mass=value},
      GetLinearDamping:()=>data.linearDamping,
      SetLinearDamping:value=>{calls.push([i,'linearDamping',value]);data.linearDamping=value},
      GetAngularDamping:()=>data.angularDamping,
      SetAngularDamping:value=>{calls.push([i,'angularDamping',value]);data.angularDamping=value},
    }
    return {GetMotionProperties:()=>motion,GetAllowSleeping:()=>data.canSleep,
      SetAllowSleeping:value=>{calls.push([i,'canSleep',value]);data.canSleep=value}}
  })
  const handles = masses.map((mass,i)=>({id:{index:i},mass,density:.6,volume:1}))
  const world={disposed:false, bi:{},sys:{GetBodyLockInterfaceNoLock:()=>({TryGetBody:id=>nativeBodies[id.index]})},
    rigidNodes:new Map(nodes.map((n,i)=>[roots.get(n.id),handles[i]])),nodeHandles:new Map()}
  const play={project:{objects:nodes},ed:{nodes:roots},phys:world}
  const owner=new BodyRuntime(play,1);owner.bodyOwners=nodes
  return {nodes,roots,motions,calls,handles,world,owner}
}
function key(s,i,property,value) {
  const obj=s.nodes[i], root=s.roots.get(obj.id), spec=nodeAnimationProperty(obj,property)
  assert.ok(spec,property)
  const snap=spec.capture(root,obj);spec.apply(root,value,obj)
  return () => spec.restore(root,snap,obj)
}
function newCharacter(mass=80,slope=50) {
  const obj=makeNode('char','characterbody3d',{mass,maxSlopeAngle:slope,velocity:[0,0,0],gravity:9.81,stepHeight:.35,floorSnap:.5})
  const data={mass,slope},calls=[]
  const native={
    GetMass:()=>data.mass,SetMass:v=>{calls.push(['mass',v]);data.mass=v},
    GetCosMaxSlopeAngle:()=>Math.cos(data.slope*Math.PI/180),
    SetMaxSlopeAngle:v=>{calls.push(['slope',v]);data.slope=v*180/Math.PI},
  }
  const node={userData:{}},world={J:{destroy(){}},disposed:false}
  const owner=new SpatialRuntime({ed:{nodes:new Map([[obj.id,node]])},phys:world},()=>{})
  owner.characters.set(obj.id,{obj,node,character:native})
  return {obj,node,data,calls,owner,world,native}
}

test('MOTION-01 · descriptores únicos de masa, damping y sueño en RigidBody3D, masa/pendiente en CharacterBody3D',()=>{
  const rigid=makeNode('rigid','rigidbody3d',rigidDefaults)
  const character=makeNode('char','characterbody3d',{mass:80,maxSlopeAngle:50})
  for(const name of ['linearDamping','angularDamping','rigidMass','canSleep']) assert.ok(nodeAnimationProperty(rigid,`physics.${name}`),name)
  for(const name of ['characterMass','maxSlopeAngle']) assert.ok(nodeAnimationProperty(character,`physics.${name}`),name)
  assert.equal(nodeAnimationProperty(rigid,'physics.characterMass'),null)
  assert.equal(nodeAnimationProperty(character,'physics.rigidMass'),null)
})
test('MOTION-02 · claves de valores nativos se guardan y reproducen sin cambiar autoría',()=>{
  const s=mockPhysics(),obj=s.nodes[0], before=structuredClone(obj)
  const tl=newTimeline('Motion',{duration:3})
  for(const [channel,value] of [['physics.rigidMass',40],['physics.linearDamping',.6],['physics.angularDamping',.7],['physics.canSleep',false]]) {
    upsertTimelineNodePropertyKey(tl,obj,channel,'scene-x',[obj],1,value)
  }
  const reloaded=normalizeTimeline(JSON.parse(JSON.stringify(tl)))
  assert.equal(reloaded.tracks.length,4)
  assert.deepEqual(reloaded.tracks.map(t=>t.keys[0].v),[40,.6,.7,false])
  assert.deepEqual(obj,before)
})
test('MOTION-03 · modificación del cuerpo Jolt real y lectura de su propio estado, sin crear otros cuerpos',()=>{
  const s=mockPhysics(),releases=[
    key(s,0,'physics.linearDamping',.5),key(s,0,'physics.angularDamping',.9),
    key(s,0,'physics.rigidMass',42),key(s,0,'physics.canSleep',false),
  ]
  s.owner.syncTimelinePhysics()
  assert.equal(s.motions[0].linearDamping,.5)
  assert.equal(s.motions[0].angularDamping,.9)
  assert.equal(s.motions[0].mass,42)
  assert.equal(s.motions[0].canSleep,false)
  assert.equal(s.handles[0].mass,42)
  assert.equal(s.handles[0].density,1.26)
  assert.equal(s.motions[1].mass,30)
  assert.equal(s.owner.timelineBodyValues.size,4)
  assert.equal(s.calls.length,4)
  s.owner.syncTimelinePhysics()
  assert.equal(s.calls.length,4,'No repetir setters en cada frame')
  releases.forEach(r=>r())
  s.owner.syncTimelinePhysics()
  assert.deepEqual(s.motions[0],{mass:20,linearDamping:.18,angularDamping:.31,canSleep:true})
  assert.equal(s.handles[0].mass,20)
  assert.equal(s.handles[0].density,.6)
  assert.equal(s.owner.timelineBodyValues.size,0)
})
test('MOTION-04 · captura nativa independiente de props autorales, restauración inversa y sin despertar otros cuerpos',()=>{
  const s=mockPhysics(),obj=s.nodes[0];obj.props.linearDamping=.01
  const r1=key(s,0,'physics.linearDamping',.75)
  const r2=key(s,1,'physics.rigidMass',90)
  s.owner.syncTimelinePhysics()
  r1();s.owner.syncTimelinePhysics()
  assert.equal(s.motions[0].linearDamping,.18,'Restaura lectura de Jolt, no la propiedad autoral .01')
  assert.equal(s.motions[1].mass,90)
  r2();s.owner.syncTimelinePhysics()
  assert.equal(s.motions[1].mass,30)
})
test('MOTION-05 · reserva de canSleep admite bool y rechaza números o masa negativa',()=>{
  const s=mockPhysics()
  const v=key(s,0,'physics.canSleep',false);s.owner.syncTimelinePhysics();v();s.owner.syncTimelinePhysics()
  s.roots.get('rigid-0').userData.timelineSpatial={canSleep:1}
  assert.throws(()=>s.owner.syncTimelinePhysics(),/valor temporal inválido canSleep/)
  s.roots.get('rigid-0').userData.timelineSpatial={mass:-1}
  assert.throws(()=>s.owner.syncTimelinePhysics(),/valor temporal inválido mass/)
})
test('MOTION-06 · si MotionProperties WASM falta, falla claramente sin simular actualización',()=>{
  const s=mockPhysics()
  key(s,0,'physics.linearDamping',.77)
  s.world.sys.GetBodyLockInterfaceNoLock=()=>({TryGetBody:()=>null})
  assert.throws(()=>s.owner.syncTimelinePhysics(),/MotionProperties no disponible/)
})
test('MOTION-07 · CharacterVirtual: SetMass y SetMaxSlopeAngle se aplican una vez y restauran al parar',()=>{
  const c=newCharacter()
  const sm=nodeAnimationProperty(c.obj,'physics.characterMass'),sa=nodeAnimationProperty(c.obj,'physics.maxSlopeAngle')
  const beforeMass=sm.capture(c.node,c.obj),beforeAngle=sa.capture(c.node,c.obj)
  sm.apply(c.node,95,c.obj);sa.apply(c.node,72,c.obj)
  c.owner.syncTimelineCharacterPhysics()
  assert.equal(c.data.mass,95);assert.ok(Math.abs(c.data.slope-72)<1e-7)
  const calls=c.calls.length
  c.owner.syncTimelineCharacterPhysics(); assert.equal(c.calls.length,calls)
  sm.restore(c.node,beforeMass,c.obj);sa.restore(c.node,beforeAngle,c.obj)
  c.owner.syncTimelineCharacterPhysics()
  assert.equal(c.data.mass,80);assert.ok(Math.abs(c.data.slope-50)<1e-7)
  assert.equal(c.owner.timelineCharacterValues.size,0)
  assert.equal(c.obj.props.mass,80)
})
test('MOTION-08 · CharacterVirtual captura el estado nativo real, no el proyecto',()=>{
  const c=newCharacter(95,40)
  c.obj.props.mass=80;c.obj.props.maxSlopeAngle=60
  const sm=nodeAnimationProperty(c.obj,'physics.characterMass'),before=sm.capture(c.node,c.obj)
  sm.apply(c.node,55,c.obj);c.owner.syncTimelineCharacterPhysics()
  sm.restore(c.node,before,c.obj);c.owner.syncTimelineCharacterPhysics()
  assert.equal(c.data.mass,95)
  assert.equal(c.obj.props.mass,80)
})
test('MOTION-09 · `stop` invoca ambos propietarios inmediatamente al restaurar channels de física',()=>{
  const path=src('src/engine/runtime/events/play-timeline.js')
  assert.match(path,/if \(restorePhysics\) \{[\s\S]*?this\._nodeBodies\?\.syncTimelinePhysics\(\)/)
  assert.match(path,/this\._nodeBodies\?\.spatial\?\.syncTimelineCharacterPhysics\(\)/)
})
test('MOTION-10 · los campos físicos del Inspector reutilizan PropertyKey y las mismas propiedades',()=>{
  const ui=src('src/components/Inspector.vue')
  for(const id of ['rigidMass','linearDamping','angularDamping','canSleep','characterMass','maxSlopeAngle']) {
    assert.match(ui,new RegExp(`inspectorKeyable\\('physics\\.${id}'\\)`),`Falta ${id}`)
  }
  assert.match(ui,/@insert="inspectorInsertKey\('physics\.rigidMass'\)"/)
  assert.match(ui,/@insert="inspectorInsertKey\('physics\.characterMass'\)"/)
})
