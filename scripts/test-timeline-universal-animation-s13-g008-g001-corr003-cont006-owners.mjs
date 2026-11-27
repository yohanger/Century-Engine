import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, normalizeTimeline, upsertTimelineNodePropertyKey } from '../src/core/timeline/model.js'
import { containerSpec, WATER_LIQUID } from '../src/engine/runtime/geometry/liquid-containers.js'
import { newPhysicsShape, PHYSICS_SHAPES } from '../src/engine/runtime/physics/shapes.js'

const source = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8')
const sanitized = file => source(file).replace(/^import .*$/gm, '').replace(/^export default /gm,'').replace(/^export /gm, '')
const scalar = value => ({value, clone(){return scalar(this.value)},copy(x){this.value=x.value}})
const makeRoot = () => ({position:scalar(10),quaternion:scalar(20),visible:true,
  userData:{visual:{scale:scalar(30)}} ,updateMatrixWorld(){}})
const applyBase = root => {root.position.value=-1;root.quaternion.value=-2;root.userData.visual.scale.value=-3}
const props = { liquidContainer:{enabled:true,shape:'cylinder',size:[.09,.12,.09],pourRate:.6,initialM3:0} }
const defs = new Map()
const register = def => {defs.set(def.type,def);return registerNode(def)}
const baseCode=sanitized('src/engine/runtime/nodes/base.js')
const { liquidPourAnimation, liquidGeometryAnimation, combustionEnvironmentAnimation }=Function('registerNode','makeRoot','applyBase','hitSphere',`${baseCode};return {liquidPourAnimation,liquidGeometryAnimation,combustionEnvironmentAnimation}`)(
  register, makeRoot, applyBase,()=>({}))
const physicsCode=sanitized('src/engine/runtime/nodes/physics.js')
Function('registerNode','AREA3D_NATIVE_SIGNALS','THREE','makeRoot','applyBase','hitSphere','lineMat',
 'newPhysicsShape','PHYSICS_SHAPES','effectiveCollisionShape','triMeshGeometry','liquidPourAnimation','liquidGeometryAnimation','combustionEnvironmentAnimation',
 `${physicsCode};return true`)(register,[],{},makeRoot,applyBase,()=>({}),()=>({}),newPhysicsShape,PHYSICS_SHAPES,()=>({}),()=>({}),liquidPourAnimation,liquidGeometryAnimation,combustionEnvironmentAnimation)
const fakeModel={traverse(fn){this.children.forEach(fn)},children:[{isMesh:true,castShadow:true,userData:{}},{isMesh:true,castShadow:true,userData:{helper:true}}]}
const modelCode=sanitized('src/engine/runtime/nodes/model.js')
Function('registerNode','THREE','makeRoot','applyBase','unitGeometry','cloneModel',
 `${modelCode};return true`)(register,{},makeRoot,applyBase,()=>({}),()=>fakeModel)
const obj=(type,id='node-1')=>({id,type,visible:true,active:true,castShadow:true,props:structuredClone(props),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]})
function key(o,id,v) {const tl=newTimeline('Props',{duration:4});upsertTimelineNodePropertyKey(tl,o,id,'scene',[o],1,v);return normalizeTimeline(JSON.parse(JSON.stringify(tl))).tracks[0].keys[0].v}

const fakeWorld=()=>({containers:new Map([['node-1',{id:'node-1',pourRate:.6,volumeM3:0}]]),
 setContainerPourRate(id,v){this.containers.get(id).pourRate=v},containerState(id){return this.containers.get(id) ? {...this.containers.get(id)} : null}})

test('P6-01 · Node y Group son estructurales, Node3D registra canal liquid sin otro modelo',()=>{
 assert.ok(getDef('node'))
 assert.equal(Object.keys(getDef('node').animation).length,0)
 assert.equal(Object.keys(getDef('node3d').animation).length,5)
 assert.ok(getDef('node3d').animation['node3d.pourRate'])
 assert.ok(getDef('rigidbody3d').animation['rigidbody3d.pourRate'])
 assert.equal(getDef('rigidbody3d').animation['node3d.pourRate'],undefined)
 assert.equal(getDef('model').animation['model.castShadow'].kind,'bool')
})
test('P6-02 · sólo recipiente habilitado puede crear llave, y con tipo exclusivo',()=>{
 const o=obj('node3d'),rigid=obj('rigidbody3d')
 assert.ok(nodeAnimationProperty(o,'node3d.pourRate'))
 assert.ok(nodeAnimationProperty(rigid,'rigidbody3d.pourRate'))
 assert.equal(nodeAnimationProperty(o,'rigidbody3d.pourRate'),null)
 assert.equal(nodeAnimationProperty(rigid,'node3d.pourRate'),null)
 o.props.liquidContainer.enabled=false
 assert.equal(nodeAnimationProperty(o,'node3d.pourRate'),null)
})
test('P6-03 · claves persisten sin modificar datos autorales de Node3D, RigidBody3D y Model',()=>{
 for(const [type,id,val] of [['node3d','node3d.pourRate',1.2],['rigidbody3d','rigidbody3d.pourRate',0],['model','model.castShadow',false]]){
  const o=obj(type),before=structuredClone(o)
  assert.deepEqual(key(o,id,val),val)
  assert.deepEqual(o,before)
 }
 assert.throws(()=>validatePropertyValue('node3d.pourRate',5.1))
 assert.throws(()=>validatePropertyValue('rigidbody3d.pourRate',-1))
})
test('P6-04 · sobre WaterWorld actual: aplicar caudal físico, detener restaura incluso en pausa',()=>{
 for (const type of ['node3d','rigidbody3d']) {
  const o=obj(type),root=makeRoot(),world=fakeWorld()
  root.userData.liquidRuntime={world,id:o.id}
  const channel=nodeAnimationProperty(o,`${type}.pourRate`)
  const before=structuredClone(o),snap=channel.capture(root,o)
  channel.apply(root,3,o)
  assert.equal(world.containers.get(o.id).pourRate,3)
  assert.equal(channel.runtimeRead(root,o),3)
  assert.deepEqual(o,before)
  channel.restore(root,snap,o)
  assert.equal(world.containers.get(o.id).pourRate,.6)
  assert.equal(root.userData.timelineLiquid,undefined)
 }
})
test('P6-05 · restauración mantiene una reserva previa y valor nativo capturado',()=>{
 const o=obj('node3d'),root=makeRoot(),world=fakeWorld()
 root.userData.timelineLiquid={pourRate:1}
 root.userData.liquidRuntime={world,id:o.id}
 const f=nodeAnimationProperty(o,'node3d.pourRate'),snap=f.capture(root,o)
 f.apply(root,4,o)
 f.restore(root,snap,o)
 assert.equal(root.userData.timelineLiquid.pourRate,1)
 assert.equal(world.containers.get(o.id).pourRate,.6)
})
test('P6-06 · Model: sombra cambia solo la instancia, sin alterar modelo Assets ni otra copia',()=>{
 const model=obj('model'),root=makeRoot()
 const instance={children:[{isMesh:true,castShadow:true,userData:{}},{isMesh:true,castShadow:true,userData:{helper:true}}], traverse(fn){this.children.forEach(fn)}}
 const other={isMesh:true,castShadow:true,userData:{}}
 root.userData.modelRoot=instance
 const def=getDef('model'),spec=nodeAnimationProperty(model,'model.castShadow'),snap=spec.capture(root,model)
 spec.apply(root,false,model)
 assert.equal(instance.children[0].castShadow,false)
 assert.equal(instance.children[1].castShadow,true)
 assert.equal(other.castShadow,true)
 assert.equal(root.position.value,10)
 assert.equal(root.quaternion.value,20)
 assert.equal(root.userData.visual.scale.value,30)
 spec.restore(root,snap,model)
 assert.equal(instance.children[0].castShadow,true)
 assert.equal(root.userData.timelineVisualFields,undefined)
 assert.equal(model.castShadow,true)
})
test('P6-07 · model Shadow disponible, GI de luz horneada no falsamente animable',()=>{
 const o=obj('model')
 assert.ok(nodeAnimationProperty(o,'model.castShadow'))
 assert.equal(nodeAnimationProperty(o,'model.gi'),null)
 assert.equal(nodeAnimationProperty(o,'model.modelId'),null)
 const inspector=source('src/components/Inspector.vue')
 assert.match(inspector,/obj\.type === 'model' && inspectorKeyable\('model\.castShadow'\)/)
 assert.match(inspector,/inspectorKeyable\(`\$\{obj\.type\}\.pourRate`\)/)
})
test('P6-08 · configuraciones WaterWorld se validan con el mismo contrato físico',()=>{
 const s=containerSpec({id:'a',shape:'cylinder',size:[.09,.12,.09],pourRate:4,initialM3:0,liquid:WATER_LIQUID})
 assert.equal(s.pourRate,4)
 assert.throws(()=>containerSpec({...s,pourRate:-1}),/inválido/)
})
test('P6-09 · consumidores de PlayMode comparten propietario, orden de reloj y restitución sin duplicar solver',()=>{
 const src=source('src/engine/runtime/events/play-liquid.js')
 const steps=source('src/engine/runtime/events/play-controls.js')
 const world=source('src/engine/runtime/geometry/waterworld.js')
 assert.match(src,/node\.userData\.liquidRuntime = \{world:this\.water, id:obj\.id\}/)
 assert.match(src,/this\.water\.setContainerPourRate\(obj\.id,initialRate\)/)
 assert.match(src,/delete v\.node\.userData\.liquidRuntime/)
 assert.match(world,/setContainerPourRate\(id, value\)/)
 assert.ok(steps.indexOf('this._tlUpdate(dt)') < steps.indexOf('this._liquidPoseSync?.()'))
})

test('P6-10 · WaterWorld real actualiza caudal sin añadir líquido ni modificar snapshot de inventario', async()=>{
  const solver=await import('../src/engine/runtime/geometry/water-solver.js')
  let code=source('src/engine/runtime/geometry/waterworld.js')
  code=code.replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies=()=>[];const riverLine=()=>[]')
    .replace("import { waveSet } from './water.js'",'const waveSet=()=>({big:[]})')
    .replace("import { WaterRegion } from './water-solver.js'",'const WaterRegion=globalThis.__LF006WaterRegion')
  globalThis.__LF006WaterRegion=solver.WaterRegion
  let WaterWorld
  try { ({WaterWorld}=await import(`data:text/javascript,${encodeURIComponent(code)}`)) }
  finally { delete globalThis.__LF006WaterRegion }
  const world=new WaterWorld()
  world.addContainer({id:'cup',shape:'cylinder',size:[.09,.12,.09],initialM3:.0002,liquid:WATER_LIQUID,pourRate:.6})
  const before=world.liquidBalances()
  world.setContainerPourRate('cup',2.4)
  assert.equal(world.containerState('cup').pourRate,2.4)
  assert.deepEqual(world.liquidBalances(),before)
  assert.throws(()=>world.setContainerPourRate('cup',-1),/inválido/)
  assert.throws(()=>world.setContainerPourRate('cup',6),/inválido/)
  assert.equal(world.containerState('cup').pourRate,2.4)
  world.setContainerPourRate('cup',.6)
  assert.equal(world.containerState('cup').volumeM3,.0002)
})

test('P6-11 · PlayMode instala y libera enlace al WaterWorld original, sin nuevo solver',()=>{
  const fakeTHREE={
    Vector3:class {toArray(){return [0,0,0]}},
    Quaternion:class {toArray(){return [0,0,0,1]}},
    CircleGeometry:class {dispose(){}},PlaneGeometry:class {dispose(){}},CylinderGeometry:class {dispose(){}},
    MeshPhysicalMaterial:class {clone(){return new this.constructor()}dispose(){}},
    DoubleSide:2,
    Mesh:class { constructor(geometry,material){this.geometry=geometry;this.material=material;this.rotation={x:0};this.position={set(){}};this.scale={set(){}};this.userData={};this.visible=true}removeFromParent(){} },
  }
  const code=sanitized('src/engine/runtime/events/play-liquid.js')
  const methods=Function('THREE','WATER_LIQUID','containerSpec','freeSurface', `${code};return liquidMethods`)(fakeTHREE,WATER_LIQUID,containerSpec,()=>({headM:0}))
  const o=obj('node3d'),n={userData:{},updateWorldMatrix(){},getWorldPosition(){},getWorldQuaternion(){}}
  const water={containers:new Map(),
    addContainer(spec){this.containers.set(spec.id,{...spec,volumeM3:spec.initialM3,pose:{position:[0,0,0],quaternion:[0,0,0,1]}})},
    containerState(id){return {...this.containers.get(id)}},
    setContainerPourRate(id,v){this.containers.get(id).pourRate=v},
    setContainerPose(id,pose){this.containers.get(id).pose=pose}}
  const play={...methods,project:{objects:[o],liquids:[]},ed:{nodes:new Map([[o.id,n]]),vp:{scene:{add(){}}}},water,
    _nodeEnabled(){return true}}
  play._liquidInit()
  assert.equal(play._liquidViews.length,1)
  assert.equal(n.userData.liquidRuntime.world,water)
  const spec=nodeAnimationProperty(o,'node3d.pourRate'),snap=spec.capture(n,o)
  spec.apply(n,1.7,o)
  assert.equal(water.containerState(o.id).pourRate,1.7)
  spec.restore(n,snap,o)
  assert.equal(water.containerState(o.id).pourRate,.6)
  play._liquidReset()
  assert.equal(n.userData.liquidRuntime,undefined)
  assert.equal(play._liquidViews.length,0)
})
