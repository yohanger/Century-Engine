import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TornadoCombustion } from '../src/engine/runtime/world/tornado-destruction.js'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'
import { PHYSICS_SHAPES, newPhysicsShape, effectiveCollisionShape } from '../src/engine/runtime/physics/shapes.js'

const src = file => readFileSync(new URL('../'+file,import.meta.url),'utf8')
const scrub = file => src(file).replace(/^import .*$/gm,'').replace(/^export default /gm,'').replace(/^export /gm,'')
const base=Function('registerNode','makeRoot','applyBase','hitSphere',`${scrub('src/engine/runtime/nodes/base.js')};return {liquidPourAnimation,liquidGeometryAnimation,combustionEnvironmentAnimation}`)(registerNode,()=>({}),()=>{},()=>{})
const physical=Function('registerNode','AREA3D_NATIVE_SIGNALS','THREE','makeRoot','applyBase','hitSphere','lineMat','newPhysicsShape','PHYSICS_SHAPES','triMeshGeometry','liquidPourAnimation','liquidGeometryAnimation','combustionEnvironmentAnimation','effectiveCollisionShape',`${scrub('src/engine/runtime/nodes/physics.js')};return true`)
physical(registerNode,[],{},()=>({}),()=>{},()=>{},()=>{},newPhysicsShape,PHYSICS_SHAPES,()=>{},base.liquidPourAnimation,base.liquidGeometryAnimation,base.combustionEnvironmentAnimation,effectiveCollisionShape)
const makeObj=(type,id='fire-01',settings={})=>({id,type,active:true,visible:true,props:{combustion:{enabled:true,moisture:.2,ignitionK:570,ignited:false,...settings}}})
const runtime=(type='node3d')=>{
 const obj=makeObj(type),root={userData:{}},model=new TornadoCombustion();model.add(obj.id,{moisture:.4,ignitionK:660,temperatureK:720});
 const owner={_combustion:model}
 root.userData.combustionRuntime={owner,id:obj.id}
 return {obj,root,model,owner,source:model.sources.get(obj.id)}
}
test('FIRE-01 · tres tipos usan un único propietario térmico y dos canales por tipo',()=>{
 for(const type of ['staticbody3d','rigidbody3d','node3d']){
  const o=makeObj(type)
  for(const field of ['moisture','ignitionK']){
   const key=`${type}.${field}`,spec=nodeAnimationProperty(o,key)
   assert.ok(spec,key);assert.equal(spec.kind,'number')
  }
  const other=type==='node3d'?'rigidbody3d':'node3d'
  assert.equal(nodeAnimationProperty(o,`${other}.moisture`),null)
 }
 assert.equal(Object.keys(getDef('node3d').animation).length,5)
})
test('FIRE-02 · no hay llave si el objeto no es combustible',()=>{
 const o=makeObj('node3d');o.props.combustion.enabled=false
 assert.equal(nodeAnimationProperty(o,'node3d.moisture'),null)
 assert.equal(nodeAnimationProperty(o,'node3d.ignitionK'),null)
})
test('FIRE-03 · keyframes persisten con tipo, escena y nodo y sin mutar autoría',()=>{
 for (const [type,field,val] of [['staticbody3d','moisture',.7],['rigidbody3d','ignitionK',1120],['node3d','moisture',.1]]){
  const obj=makeObj(type),before=structuredClone(obj),tl=newTimeline('Weather',{duration:2})
  upsertTimelineNodePropertyKey(tl,obj,`${type}.${field}`,'scene-1',[obj],1,val)
  assert.equal(normalizeTimeline(JSON.parse(JSON.stringify(tl))).tracks[0].keys[0].v,val)
  assert.deepEqual(obj,before)
 }
})
test('FIRE-04 · humedad se aplica al modelo físico vigente y restaura el valor nativo',()=>{
 const x=runtime(),key=nodeAnimationProperty(x.obj,'node3d.moisture'),snap=key.capture(x.root,x.obj),before=structuredClone(x.obj)
 key.apply(x.root,.85,x.obj)
 assert.equal(x.source.moisture,.85)
 assert.equal(key.runtimeRead(x.root,x.obj),.85)
 assert.deepEqual(x.obj,before)
 key.restore(x.root,snap,x.obj)
 assert.equal(x.source.moisture,.4) // leído de TornadoCombustion, no del .2 del inspector
 assert.equal(x.root.userData.timelineCombustion,undefined)
})
test('FIRE-05 · cambio de umbral afecta ignición física real sin generar fuentes',()=>{
 const x=runtime('staticbody3d'),key=nodeAnimationProperty(x.obj,'staticbody3d.ignitionK')
 const saved=key.capture(x.root,x.obj)
 const n=x.model.sources.size
 key.apply(x.root,800,x.obj)
 assert.equal(x.source.ignitionK,800)
 assert.equal(x.model.ignite(x.obj.id,750),false)
 key.apply(x.root,600,x.obj)
 assert.equal(x.model.ignite(x.obj.id,750),true)
 assert.equal(x.model.sources.size,n)
 key.restore(x.root,saved,x.obj)
 assert.equal(x.source.ignitionK,660)
})
test('FIRE-06 · sube el umbral: fuente existente se extingue, sin reencendido automático',()=>{
 const x=runtime('rigidbody3d'),spec=nodeAnimationProperty(x.obj,'rigidbody3d.ignitionK')
 assert.equal(x.model.ignite(x.obj.id,900),true)
 const snap=spec.capture(x.root,x.obj)
 spec.apply(x.root,1000,x.obj)
 assert.equal(x.source.burning,false)
 spec.restore(x.root,snap,x.obj)
 assert.equal(x.source.burning,false,'no se falsifica otro evento de ignición')
 assert.equal(x.source.ignitionK,660)
})
test('FIRE-07 · dos fuentes y tres propietarios mantienen aislamiento de estado',()=>{
 const model=new TornadoCombustion();model.add('a',{moisture:.1});model.add('b',{moisture:.7})
 const a=makeObj('node3d','a'),b=makeObj('rigidbody3d','b')
 const owner={_combustion:model},ra={userData:{combustionRuntime:{owner,id:'a'}}},rb={userData:{combustionRuntime:{owner,id:'b'}}}
 const sa=nodeAnimationProperty(a,'node3d.moisture'),sb=nodeAnimationProperty(b,'rigidbody3d.moisture')
 const x=sa.capture(ra,a),y=sb.capture(rb,b)
 sa.apply(ra,.5,a)
 assert.equal(model.sources.get('a').moisture,.5)
 assert.equal(model.sources.get('b').moisture,.7)
 sb.apply(rb,.3,b)
 sa.restore(ra,x,a);sb.restore(rb,y,b)
 assert.equal(model.sources.get('a').moisture,.1)
 assert.equal(model.sources.get('b').moisture,.7)
})
test('FIRE-08 · rangos y NaN se rechazan sin mutar fuente ni reservar canal',()=>{
 const x=runtime(),source=structuredClone(x.source)
 const spec=nodeAnimationProperty(x.obj,'node3d.moisture')
 for(const val of [-.1,1.1,NaN,Infinity]) assert.throws(()=>spec.apply(x.root,val,x.obj),/inválido/)
 assert.deepEqual(x.source,source)
 assert.equal(x.root.userData.timelineCombustion,undefined)
 assert.throws(()=>validatePropertyValue('node3d.ignitionK',299))
 assert.throws(()=>validatePropertyValue('node3d.ignitionK',2001))
})
test('FIRE-09 · propietario térmico garantiza validación previa y no crea otro modelo',()=>{
 const c=new TornadoCombustion(),id='tree';c.add(id,{moisture:.1,ignitionK:500})
 const original=structuredClone(c.sources.get(id))
 assert.throws(()=>c.configure(id,{moisture:.9,ignitionK:NaN}),/fuera de rango/)
 assert.deepEqual(c.sources.get(id),original)
 c.configure(id,{moisture:.5,ignitionK:1300})
 assert.equal(c.sources.size,1)
 assert.strictEqual(c.sources.get(id).id,id)
 assert.throws(()=>c.configure('missing',{moisture:.5}),/no disponible/)
})
test('FIRE-10 · fuente regenerada desde snapshot: restauración usa propietario actual, no referencia antigua',()=>{
 const x=runtime(),spec=nodeAnimationProperty(x.obj,'node3d.moisture'),snap=spec.capture(x.root,x.obj)
 spec.apply(x.root,.7,x.obj)
 const fresh=new TornadoCombustion();fresh.add(x.obj.id,{moisture:.7})
 x.owner._combustion=fresh
 spec.restore(x.root,snap,x.obj)
 assert.equal(fresh.sources.get(x.obj.id).moisture,.4)
 assert.equal(x.source.moisture,.7,'el modelo sustituido no vuelve a modificarse')
})
test('FIRE-11 · la inicialización adjunta la fuente física al mismo nodo, y el teardown la libera',()=>{
 const script=src('src/engine/runtime/events/play-tornado-destruction.js')
 assert.match(script,/node\.userData\.combustionRuntime=\{owner:this,id:o\.id\}/)
 assert.match(script,/delete node\.userData\.combustionRuntime/)
 assert.match(script,/this\._combustion\.configure\(o\.id,node\.userData\.timelineCombustion\)/)
})
test('FIRE-12 · la UI incorpora las dos llaves originales sin duplicar sección ni simular Ignición inicial',()=>{
 const ui=src('src/components/Inspector.vue')
 assert.match(ui,/inspectorKeyable\(`\$\{obj\.type\}\.moisture`\)/)
 assert.match(ui,/inspectorKeyable\(`\$\{obj\.type\}\.ignitionK`\)/)
 assert.equal(nodeAnimationProperty(makeObj('node3d'),'node3d.ignited'),null)
 assert.equal(nodeAnimationProperty(makeObj('node3d'),'node3d.enabled'),null)
})
test('FIRE-13 · no se alteran combustible, brasas ni fuel al cambiar propiedades continuas',()=>{
 const x=runtime(),spec=nodeAnimationProperty(x.obj,'node3d.moisture')
 x.source.fuel=.8;x.model.embers.push({id:1,x:0,y:1,z:0,age:.1,heatK:700})
 const snap=spec.capture(x.root,x.obj)
 spec.apply(x.root,.6,x.obj)
 spec.restore(x.root,snap,x.obj)
 assert.equal(x.source.fuel,.8)
 assert.equal(x.model.embers.length,1)
 assert.equal(x.model.serial,0)
})
test('FIRE-14 · sin tormenta activa se conserva override efímero; no se anuncia fuego visual',()=>{
 const o=makeObj('node3d'),root={userData:{}},spec=nodeAnimationProperty(o,'node3d.moisture')
 const snap=spec.capture(root,o)
 spec.apply(root,.5,o)
 assert.equal(root.userData.timelineCombustion.moisture,.5)
 assert.equal(o.props.combustion.moisture,.2)
 spec.restore(root,snap,o)
 assert.equal(root.userData.timelineCombustion,undefined)
})

test('FIRE-15 · _destructionInit registra fuente real y vincula el mismo propietario; _destructionReset limpia',()=>{
 const code=scrub('src/engine/runtime/events/play-tornado-destruction.js')
 class FakeVector { constructor(){this.x=0;this.y=0;this.z=0} set(x,y,z){this.x=x;this.y=y;this.z=z;return this} }
 const methods=Function('THREE','vegetationResponse','TornadoCombustion','BUILTIN_FOLIAGE',`${code};return destructiveTornadoMethods`)(
  {Vector3:FakeVector},()=>({}),TornadoCombustion,{})
 const o=makeObj('node3d'),root={userData:{},getWorldPosition(v){v.set(10,20,30);return v}}
 const play={...methods,project:{objects:[o],vfx:[]},ed:{nodes:new Map([[o.id,root]]),world:{tornado:{},cfg:{weather:{tornadoFire:true,tornadoDestruction:false,tornadoWaterLift:false}}},terrains:[]},water:{}}
 play._destructionInit()
 const source=play._combustion.sources.get(o.id)
 assert.ok(source)
 assert.deepEqual([source.x,source.y,source.z],[10,20,30])
 assert.strictEqual(root.userData.combustionRuntime.owner,play)
 assert.strictEqual(root.userData.combustionRuntime.id,o.id)
 const spec=nodeAnimationProperty(o,'node3d.moisture'),snapshot=spec.capture(root,o)
 spec.apply(root,.9,o);assert.equal(source.moisture,.9)
 spec.restore(root,snapshot,o);assert.equal(source.moisture,.2)
 play._destructionReset()
 assert.equal(root.userData.combustionRuntime,undefined)
 assert.equal(play._combustion,null)
})
test('FIRE-16 · _destructionInit aplica claves temporales preexistentes al recuperar una escena',()=>{
 const code=scrub('src/engine/runtime/events/play-tornado-destruction.js')
 class FakeVector { set(x,y,z){this.x=x;this.y=y;this.z=z;return this} }
 const methods=Function('THREE','vegetationResponse','TornadoCombustion','BUILTIN_FOLIAGE',`${code};return destructiveTornadoMethods`)(
  {Vector3:FakeVector},()=>({}),TornadoCombustion,{})
 const o=makeObj('staticbody3d'),root={userData:{timelineCombustion:{moisture:.8,ignitionK:900}},getWorldPosition(v){return v.set(0,0,0)}}
 const play={...methods,project:{objects:[o],vfx:[]},ed:{nodes:new Map([[o.id,root]]),world:{tornado:{},cfg:{weather:{tornadoFire:true}}},terrains:[]},water:{}}
 play._destructionInit()
 assert.equal(play._combustion.sources.get(o.id).moisture,.8)
 assert.equal(play._combustion.sources.get(o.id).ignitionK,900)
 play._destructionReset()
 assert.deepEqual(root.userData.timelineCombustion,{moisture:.8,ignitionK:900},'teardown no sobrescribe canal que Timeline aún posee')
})
test('FIRE-17 · la ejecución con enlace térmico sin modelo se bloquea, sin suplantar estado',()=>{
 const x=runtime(),spec=nodeAnimationProperty(x.obj,'node3d.moisture')
 x.owner._combustion=null
 assert.throws(()=>spec.apply(x.root,.5,x.obj),/modelo físico no disponible/)
 assert.equal(x.root.userData.timelineCombustion,undefined)
})
