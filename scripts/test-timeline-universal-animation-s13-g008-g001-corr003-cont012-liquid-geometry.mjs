import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, normalizeTimeline, upsertTimelineNodePropertyKey } from '../src/core/timeline/model.js'
import { containerSpec, WATER_LIQUID, freeSurface } from '../src/engine/runtime/geometry/liquid-containers.js'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'
import { newPhysicsShape, PHYSICS_SHAPES, effectiveCollisionShape } from '../src/engine/runtime/physics/shapes.js'

const src = name => readFileSync(new URL('../'+name,import.meta.url),'utf8')
const scrub = name => src(name).replace(/^import .*$/gm,'').replace(/^export default /gm,'').replace(/^export /gm,'')
const f=Function('registerNode','makeRoot','applyBase','hitSphere', `${scrub('src/engine/runtime/nodes/base.js')};return {liquidPourAnimation,liquidGeometryAnimation,combustionEnvironmentAnimation}`)
const shared=f(registerNode,()=>({}),()=>{},()=>{})
Function('registerNode','AREA3D_NATIVE_SIGNALS','THREE','makeRoot','applyBase','hitSphere','lineMat',
  'newPhysicsShape','PHYSICS_SHAPES','triMeshGeometry','liquidPourAnimation','liquidGeometryAnimation','combustionEnvironmentAnimation','effectiveCollisionShape',
  `${scrub('src/engine/runtime/nodes/physics.js')};return true`)(registerNode,[],{},()=>({}),()=>{},()=>{},()=>{},newPhysicsShape,PHYSICS_SHAPES,()=>{},shared.liquidPourAnimation,shared.liquidGeometryAnimation,shared.combustionEnvironmentAnimation,effectiveCollisionShape)
const makeObj=(type='node3d',id='cup',volume=.0002)=>({id,type,active:true,visible:true,props:{liquidContainer:{enabled:true,shape:'cylinder',size:[.09,.12,.09],initialM3:volume,pourRate:.6,liquidId:'water'}}})
const root=()=>({userData:{}})
const makeWorld=async()=>{
 const code=src('src/engine/runtime/geometry/waterworld.js')
    .replace("import { collectWaterBodies, riverLine } from './waterfx.js'",'const collectWaterBodies=()=>[];const riverLine=()=>[]')
    .replace("import { waveSet } from './water.js'",'const waveSet=()=>({big:[]})')
    .replace("import { WaterRegion } from './water-solver.js'",'const WaterRegion=globalThis.__LF012WaterRegion')
 globalThis.__LF012WaterRegion=WaterRegion
 try { const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(code)}`);return new WaterWorld() }
 finally { delete globalThis.__LF012WaterRegion }
}
const flat={position:[0,0,0],quaternion:[0,0,0,1]}
const scenario=async(type='node3d',volume=.0002)=>{
 const world=await makeWorld(),o=makeObj(type,'cup',volume),n=root()
 world.addContainer(containerSpec({id:o.id,shape:o.props.liquidContainer.shape,size:o.props.liquidContainer.size,initialM3:volume,liquid:WATER_LIQUID,pourRate:.6}),flat)
 n.userData.liquidRuntime={world,id:o.id}
 return {world,o,n}
}
const key=(s,prop)=>nodeAnimationProperty(s.o,`${s.o.type}.${prop}`)

// Runtime visual backend uses geometry and material stubs, but runs original liquidMethods.
let geometryCount=0, disposed=0
class Geometry { constructor(){geometryCount++} dispose(){disposed++} }
class Mesh { constructor(geo,mat){this.geometry=geo;this.material=mat;this.userData={};this.rotation={x:0,set(){}};this.position={set(){}};this.scale={set(){}};this.visible=true} removeFromParent(){} }
class Material {clone(){return new Material()}dispose(){} }
const Three={Vector3:class{toArray(){return [0,0,0]}}, Quaternion:class{toArray(){return [0,0,0,1]}},
 CircleGeometry:class extends Geometry{},PlaneGeometry:class extends Geometry{},CylinderGeometry:class extends Geometry{},
 MeshPhysicalMaterial:Material,Mesh,DoubleSide:2}
const liquidMethods=Function('THREE','WATER_LIQUID','containerSpec','freeSurface', `${scrub('src/engine/runtime/events/play-liquid.js')};return liquidMethods`)(Three,WATER_LIQUID,containerSpec,freeSurface)

const liquidPlay=async(opts={})=>{
 const o=makeObj(opts.type||'node3d','cup',opts.volume??.0002),n={userData:{},updateWorldMatrix(){},getWorldPosition(){},getWorldQuaternion(){}}
 if(opts.temporal)n.userData.timelineLiquid={...opts.temporal}
 const world=await makeWorld()
 const play={...liquidMethods,project:{objects:[o],liquids:[]},ed:{nodes:new Map([[o.id,n]]),vp:{scene:{add(){}}}},water:world,_nodeEnabled:()=>true}
 play._liquidInit()
 return {play,world,o,n}
}

test('LG-01 · dos descriptores independientes por propietario, sin un registro de física paralelo',()=>{
 for(const type of ['node3d','rigidbody3d']){
   const o=makeObj(type)
   assert.equal(key({o},'liquidShape').kind,'enum')
   assert.equal(key({o},'liquidSize').kind,'vec3')
   const other=type==='node3d'?'rigidbody3d':'node3d'
   assert.equal(nodeAnimationProperty(o,`${other}.liquidShape`),null)
 }
 assert.equal(getDef('node3d').animation['node3d.liquidSize'].min,.001)
})
test('LG-02 · no hay llaves cuando el recipiente autoral está desactivado',()=>{
 const o=makeObj();o.props.liquidContainer.enabled=false
 assert.equal(nodeAnimationProperty(o,'node3d.liquidShape'),null)
 assert.equal(nodeAnimationProperty(o,'node3d.liquidSize'),null)
})
test('LG-03 · persistencia tipada de forma/size sin escribir los datos autorales',()=>{
 for(const type of ['node3d','rigidbody3d']){
  const o=makeObj(type),before=structuredClone(o),timeline=newTimeline('Recipiente',{duration:3})
  upsertTimelineNodePropertyKey(timeline,o,`${type}.liquidShape`,'scene',[o],1,'box')
  upsertTimelineNodePropertyKey(timeline,o,`${type}.liquidSize`,'scene',[o],2,[.14,.12,.13])
  const parsed=normalizeTimeline(JSON.parse(JSON.stringify(timeline)))
  assert.deepEqual(parsed.tracks.map(t=>t.keys[0].v),['box',[.14,.12,.13]])
  assert.deepEqual(o,before)
 }
})
test('LG-04 · rangos y tipos rechazados por el contrato de Timeline',()=>{
 for(const bad of [[0,.12,.09],[-1,.12,.09],[11,.12,.09],[NaN,.12,.09],[.05,.02,Infinity]])
  assert.throws(()=>validatePropertyValue('node3d.liquidSize',bad))
 assert.throws(()=>validatePropertyValue('node3d.liquidShape','cone'))
})
test('LG-05 · WaterWorld cambia geometría y capacidad con inventario conservado',async()=>{
 const s=await scenario(),prior=s.world.liquidBalances(),physical=s.world.containerState('cup')
 const changed=s.world.setContainerGeometry('cup',{shape:'box',size:[.15,.13,.15]})
 assert.equal(changed.shape,'box')
 assert.deepEqual(changed.size,[.15,.13,.15])
 assert.equal(changed.capacityM3,.15*.13*.15)
 assert.equal(changed.volumeM3,physical.volumeM3)
 assert.equal(changed.initialM3,physical.initialM3)
 assert.deepEqual(s.world.liquidBalances(),prior)
})
test('LG-06 · tamaño menor que el líquido actual es atómico y no lo descarta',async()=>{
 const s=await scenario(),before=s.world.snapshot()
 assert.throws(()=>s.world.setContainerGeometry('cup',{size:[.01,.01,.01]}),/capacidad temporal inferior/)
 assert.deepEqual(s.world.snapshot(),before)
 assert.deepEqual(s.world.containerState('cup').size,[.09,.12,.09])
})
test('LG-07 · shape/size inválidos nunca cambian el recipiente ni su contabilidad',async()=>{
 const s=await scenario(),before=s.world.containerState('cup')
 for(const data of [{shape:'cone'},{size:[0,.02,.01]},{size:[.1,NaN,.1]},{size:[.1,.1,11]}])
  assert.throws(()=>s.world.setContainerGeometry('cup',data))
 assert.deepEqual(s.world.containerState('cup'),before)
})
test('LG-08 · tamaño sí puede disminuir después de un vertido contabilizado',async()=>{
 const s=await scenario()
 s.world.pourContainer('cup',.00018)
 const balance=s.world.liquidBalances()
 const c=s.world.setContainerGeometry('cup',{size:[.04,.04,.04]})
 assert.ok(c.capacityM3 >= c.volumeM3)
 assert.ok(Math.abs(c.volumeM3-.00002)<1e-15)
 assert.deepEqual(s.world.liquidBalances(),balance)
})
test('LG-09 · el aplicador de Node3D muta WaterWorld y STOP restaura el estado nativo sin reponer líquido',async()=>{
 const s=await scenario(),f=key(s,'liquidSize'),snap=f.capture(s.n,s.o)
 const authored=structuredClone(s.o)
 f.apply(s.n,[.15,.13,.15],s.o)
 assert.deepEqual(s.world.containerState('cup').size,[.15,.13,.15])
 s.world.pourContainer('cup',.0001)
 const volume=s.world.containerState('cup').volumeM3
 f.restore(s.n,snap,s.o)
 assert.deepEqual(s.world.containerState('cup').size,[.09,.12,.09])
 assert.equal(s.world.containerState('cup').volumeM3,volume)
 assert.deepEqual(s.o,authored)
 assert.equal(s.n.userData.timelineLiquid,undefined)
})
test('LG-10 · Shape enum se aplica sobre la misma identidad y se restaura en pausa',async()=>{
 const s=await scenario('rigidbody3d'),keyframe=key(s,'liquidShape'),before=keyframe.capture(s.n,s.o)
 keyframe.apply(s.n,'box',s.o)
 assert.equal(s.world.containers.size,1)
 assert.equal(s.world.containerState('cup').shape,'box')
 assert.equal(s.world.containerState('cup').volumeM3,.0002)
 keyframe.restore(s.n,before,s.o)
 assert.equal(s.world.containerState('cup').shape,'cylinder')
 assert.equal(s.n.userData.timelineLiquid,undefined)
})
test('LG-11 · si falla WaterWorld, no se almacena una llave temporal falsa',async()=>{
 const s=await scenario(),spec=key(s,'liquidSize'),before=s.world.containerState('cup')
 assert.throws(()=>spec.apply(s.n,[.001,.001,.001],s.o),/capacidad/)
 assert.equal(s.n.userData.timelineLiquid,undefined)
 assert.deepEqual(s.world.containerState('cup'),before)
})
test('LG-12 · claves de forma y dimensiones se mantienen independientes y restauran ambas',async()=>{
 const s=await scenario(),size=key(s,'liquidSize'),shape=key(s,'liquidShape')
 const a=size.capture(s.n,s.o),b=shape.capture(s.n,s.o)
 size.apply(s.n,[.2,.2,.2],s.o)
 shape.apply(s.n,'box',s.o)
 assert.deepEqual(s.world.containerState('cup').size,[.2,.2,.2])
 assert.equal(s.world.containerState('cup').shape,'box')
 shape.restore(s.n,b,s.o)
 assert.equal(s.world.containerState('cup').shape,'cylinder')
 assert.deepEqual(s.world.containerState('cup').size,[.2,.2,.2])
 size.restore(s.n,a,s.o)
 assert.deepEqual(s.world.containerState('cup').size,[.09,.12,.09])
})
test('LG-13 · no se altera la masa por sustancia ni los demás recipientes',async()=>{
 const s=await scenario()
 s.world.addContainer(containerSpec({id:'second',shape:'box',size:[.09,.12,.09],initialM3:.0003,liquid:WATER_LIQUID}),flat)
 const before=s.world.containerState('second'),ledger=s.world.liquidBalances()
 key(s,'liquidSize').apply(s.n,[.2,.2,.2],s.o)
 assert.deepEqual(s.world.containerState('second'),before)
 assert.deepEqual(s.world.liquidBalances(),ledger)
})
test('LG-14 · superficie libre y descarga utilizan el nuevo volumen/shape físicos',async()=>{
 const s=await scenario()
 s.world.setContainerGeometry('cup',{shape:'box',size:[.15,.2,.15]})
 const c=s.world.containerState('cup')
 const result=freeSurface(c,c.pose)
 assert.ok(result.fill>0&&result.fill<1)
 assert.equal(c.shape,'box')
 s.world.step(1/60)
 assert.ok(s.world.containerState('cup').volumeM3>=0)
})
test('LG-15 · carga desde PlayMode respeta las reservas temporales antes de crear el recipiente',async()=>{
 const s=await liquidPlay({temporal:{shape:'box',size:[.16,.12,.16]}})
 const c=s.world.containerState('cup')
 assert.equal(c.shape,'box')
 assert.deepEqual(c.size,[.16,.12,.16])
 s.play._liquidReset()
 assert.equal(s.n.userData.liquidRuntime,undefined)
})
test('LG-16 · geometría visual se sustituye y se libera solo si cambia shape/size',async()=>{
 geometryCount=0;disposed=0
 const s=await liquidPlay()
 assert.equal(s.play._liquidViews.length,1)
 const visual=s.play._liquidViews[0].surface
 const first=visual.geometry
 const count=geometryCount
 s.play._liquidRender()
 assert.equal(geometryCount,count)
 s.world.setContainerGeometry('cup',{shape:'box',size:[.18,.12,.16]})
 s.play._liquidRender()
 assert.notEqual(visual.geometry,first)
 assert.equal(disposed,1)
 const count2=geometryCount
 s.play._liquidRender()
 assert.equal(geometryCount,count2)
 s.play._liquidReset()
 assert.equal(disposed,3,'La superficie anterior, la actual y el chorro liberan geometría')
})
test('LG-17 · snapshots físicos se mantienen válidos sin duplicar inventario al restaurar',async()=>{
 const s=await scenario()
 const before=s.world.snapshot()
 s.world.setContainerGeometry('cup',{size:[.15,.12,.15]})
 const current=s.world.snapshot()
 assert.equal(current.containers.length,1)
 s.world.restore(current)
 assert.deepEqual(s.world.snapshot(),current)
 s.world.setContainerGeometry('cup',{size:[.09,.12,.09]})
 s.world.restore(before)
 assert.deepEqual(s.world.snapshot(),before)
})
test('LG-18 · Inspector solo añade llaves a Forma/Interior, no simula volumen inicial ni cambio de sustancia',()=>{
 const ui=src('src/components/Inspector.vue'),obj=makeObj()
 for(const suffix of ['liquidShape','liquidSize'])
  assert.match(ui,new RegExp('inspectorKeyable\\(`\\$\\{obj\\.type\\}\\.'+suffix+'`\\)'))
 assert.equal(nodeAnimationProperty(obj,'node3d.initialM3'),null)
 assert.equal(nodeAnimationProperty(obj,'node3d.liquidId'),null)
 assert.equal(nodeAnimationProperty(obj,'node3d.liquidEnabled'),null)
})
