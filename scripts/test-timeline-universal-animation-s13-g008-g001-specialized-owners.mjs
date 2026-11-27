import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNodeAnimationProperties, nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'
import { sampleShake, shakeRuntimeProps } from '../src/engine/runtime/events/play-camera-shake.js'
import { volumeRender } from '../src/engine/runtime/render/postvolumes.js'
import { PROFILE_EFFECTS } from '../src/engine/runtime/render/profiles.js'

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const disposed = []
class Geometry { constructor(...args){ this.args=args } dispose(){disposed.push(this)} }
const THREE = {SphereGeometry:Geometry,BoxGeometry:Geometry,EdgesGeometry:Geometry}
function loadDefinition(file) {
  const code = src(`src/engine/runtime/nodes/${file}.js`)
    .replace(/^import .+$/gm, '')
    .replace(/export default registerNode\(/, 'const definition = registerNode(')
  const registerNode = def => { registerNodeAnimationProperties(def.type, def.animation || {}); return def }
  return Function('registerNode','THREE','makeRoot','applyBase','hitSphere','arrowToward','lineMat','unitGeometry','registerAtmoRoot',
    `${code}\nreturn definition`)(registerNode,THREE,()=>{},()=>{},()=>{},()=>{},()=>{},()=>{},()=>{})
}
const shake = loadDefinition('camera-shake')
const post = loadDefinition('postvolume')
const atmo = loadDefinition('atmovolume')
const trigger = loadDefinition('trigger')
const shakeObj = () => ({ id:'shake-a',type:'cameraShake',active:true,visible:true,props:shake.create().props })
const postObj = () => ({ id:'post-a',type:'postvolume',active:true,visible:true,...post.create() })
const atmoObj = () => ({ id:'atmo-a',type:'atmovolume',active:true,visible:true,...atmo.create() })
const root = () => ({userData:{}})
const keyOf = (node,id,value) => {
  const timeline=newTimeline('Propietario especializado',{duration:4})
  upsertTimelineNodePropertyKey(timeline,node,id,'scene-1',[node],0,value)
  return normalizeTimeline(timeline).tracks[0].keys[0].v
}

test('Camera Shake registra las 16 propiedades reales de su Inspector en el propietario original',()=>{
  assert.equal(Object.keys(shake.animation).length,16)
  for(const id of Object.keys(shake.animation)) assert.ok(nodeAnimationProperty(shakeObj(),id),id)
  const ui=src('src/components/Inspector.vue')
  for(const id of Object.keys(shake.animation)) assert.ok(ui.includes(`inspectorKeyable('${id}')`),id)
})
test('Camera Shake: claves bool, vec3, enum, número y string conservan sus tipos al guardar',()=>{
  const obj=shakeObj()
  assert.equal(keyOf(obj,'shake.enabled',false),false)
  assert.equal(keyOf(obj,'shake.pattern','noise'),'noise')
  assert.deepEqual(keyOf(obj,'shake.position',[0.02,0.01,0]),[0.02,0.01,0])
  assert.equal(keyOf(obj,'shake.frequency',1.5),1.5)
  assert.equal(keyOf(obj,'shake.camera','cam-7'),'cam-7')
  assert.throws(()=>validatePropertyValue('shake.pattern','unknown'))
})
test('Camera Shake: overrides cambian la receta runtime sin modificar datos autorales',()=>{
  const obj=shakeObj(), visual=root(), p=shake.animation['shake.frequency']
  const snapshot=p.capture(visual,obj),before=structuredClone(obj)
  p.apply(visual,2,obj)
  const live=shakeRuntimeProps({ed:{nodes:new Map([[obj.id,visual]])}},obj)
  assert.equal(live.frequency,2)
  assert.equal(sampleShake({...live,autoPlay:true,blendIn:0},0.125).position[1],0.012)
  assert.deepEqual(obj,before)
  p.restore(visual,snapshot,obj)
  assert.equal(shakeRuntimeProps({ed:{nodes:new Map([[obj.id,visual]])}},obj).frequency,0.65)
  assert.equal(visual.userData.timelineShake,undefined)
})
test('Camera Shake: dos canales independientes restauran snapshots anteriores, incluso en orden inverso',()=>{
  const obj=shakeObj(), visual=root()
  const a=shake.animation['shake.enabled'],b=shake.animation['shake.position']
  const sa=a.capture(visual,obj),sb=b.capture(visual,obj)
  a.apply(visual,false,obj);b.apply(visual,[0.5,0,0],obj)
  assert.equal(shakeRuntimeProps({ed:{nodes:new Map([[obj.id,visual]])}},obj).enabled,false)
  a.restore(visual,sa,obj)
  assert.deepEqual(visual.userData.timelineShake.position,[0.5,0,0])
  b.restore(visual,sb,obj)
  assert.equal(visual.userData.timelineShake,undefined)
})
test('PostProcessVolume registra sus siete parámetros y color, incluidas referencias',()=>{
  const obj=postObj(); assert.equal(Object.keys(post.animation).length,8)
  for(const id of Object.keys(post.animation)) assert.ok(nodeAnimationProperty(obj,id),id)
  const ui=src('src/components/Inspector.vue')
  for(const id of Object.keys(post.animation)) assert.ok(ui.includes(`inspectorKeyable('${id}')`),id)
  assert.equal(keyOf(obj,'post.profile','profile-23'),'profile-23')
  assert.equal(keyOf(obj,'post.shape','sphere'),'sphere')
})
test('PostProcessVolume: forma cambia geometría del propietario y restaura autoría y escala',()=>{
  const obj=postObj();const visual={scale:{setScalar(v){this.value=v},set(x,y,z){this.value=[x,y,z]}}}
  const color={set(v){this.value=v}},a={geometry:new Geometry(),material:{color}},b={geometry:new Geometry(),material:{color}}
  const r={userData:{postVisual:[a,b],postShape:'box',visual}}
  const spec=post.animation['post.shape'],saved=spec.capture(r,obj)
  spec.apply(r,'sphere',obj)
  assert.equal(r.userData.postShape,'sphere'); assert.equal(visual.scale.value,6)
  assert.equal(r.userData.timelinePostProps.shape,'sphere')
  spec.restore(r,saved,obj)
  assert.equal(r.userData.postShape,'box');assert.deepEqual(visual.scale.value,[6,4,6])
  assert.equal(r.userData.timelinePostProps,undefined)
  assert.equal(obj.props.shape,'box')
})
class Vec { constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})} clone(){return new Vec(this.x,this.y,this.z)} sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this} applyQuaternion(){return this} length(){return Math.hypot(this.x,this.y,this.z)} }
class Quat {clone(){return this} invert(){return this}}
test('PostProcessVolume: runtime mezcla overrides en el evaluador real, sin cambiar props persistidos',()=>{
  const original=postObj(); original.props.profile='profile-a'
  const render=Object.fromEntries(PROFILE_EFFECTS.flatMap(e=>e.params.map(p=>[p.key,p.def])))
  const profiles=[{id:'profile-a',name:'A.post',render:{saturation:0.2}}]
  const visual={getWorldPosition:()=>new Vec(),getWorldQuaternion:()=>new Quat(),getWorldScale:()=>new Vec(6,4,6),updateWorldMatrix(){},quaternion:new Quat()}
  const r={parent:{},visible:true,userData:{visual}}
  const camera={position:new Vec(),getWorldPosition:()=>new Vec()}
  const base=volumeRender(render,[original],new Map([[original.id,r]]),camera,profiles)
  assert.equal(base.active,true)
  const spec=post.animation['post.weight'],snapshot=spec.capture(r,original)
  spec.apply(r,0,original)
  const disabled=volumeRender(render,[original],new Map([[original.id,r]]),camera,profiles)
  assert.equal(disabled.active,false)
  assert.equal(original.props.weight,1)
  spec.restore(r,snapshot,original)
  assert.equal(volumeRender(render,[original],new Map([[original.id,r]]),camera,profiles).active,true)
})
test('Volumen atmosférico: intercambio y color se aplican al propietario y se restauran',()=>{
  const obj=atmoObj(), visual=root(), color={set(v){this.value=v}}
  visual.userData.atmoExchange=obj.props.exchange
  visual.userData.fillMat={color};visual.userData.edgeMat={color}
  for (const id of ['atmo.exchange','atmo.color']) assert.ok(nodeAnimationProperty(obj,id))
  const ex=atmo.animation['atmo.exchange'],ss=ex.capture(visual,obj)
  ex.apply(visual,0.75,obj); assert.equal(visual.userData.atmoExchange,0.75)
  ex.restore(visual,ss,obj); assert.equal(visual.userData.atmoExchange,0)
  assert.equal(visual.userData.timelineAtmoExchange,undefined)
  const co=atmo.animation['atmo.color'],cs=co.capture(visual,obj)
  co.apply(visual,'#3399cc',obj);assert.equal(color.value,'#3399cc')
  co.restore(visual,cs,obj);assert.equal(color.value,obj.color)
})
test('Trigger: sus ocho campos reales tienen llaves certificadas, sin escritura autoral', () => {
  const node = { id: 'trigger-a', type: 'trigger', ...trigger.create() }
  const ui = src('src/components/Inspector.vue')
  assert.equal(Object.keys(trigger.animation).length, 8)
  for (const id of Object.keys(trigger.animation)) {
    assert.ok(nodeAnimationProperty(node, id), id)
    assert.ok(ui.includes(`inspectorKeyable('${id}')`), id)
  }
  assert.equal(keyOf(node, 'trigger.look', true), true)
  assert.equal(keyOf(node, 'trigger.onEnter', 'activarPuerta'), 'activarPuerta')
  const visual = root(), authored = structuredClone(node)
  const spec = trigger.animation['trigger.onEnter'], old = spec.capture(visual, node)
  spec.apply(visual, 'abrirPuerta', node)
  assert.equal(visual.userData.timelineTriggerProps.onEnter, 'abrirPuerta')
  assert.deepEqual(node, authored)
  spec.restore(visual, old, node)
  assert.equal(visual.userData.timelineTriggerProps, undefined)
})
test('Trigger: runtime usa callbacks y distancia temporales en el propietario de eventos', () => {
  const code = src('src/engine/runtime/events/play-look.js')
    .replace(/^import .+$/gm, '').replace(/export /g, '')
  class Matrix { copy(){return this} invert(){return this} getNormalMatrix(){return this} }
  class Vector { set(){return this} setComponent(){return this} applyMatrix3(){return this} normalize(){return this} toArray(){return [0,0,0]} }
  const { triggerRuntimeProps, lookMethods } = Function('THREE','layersOf','tagOf','layerIndex', `${code}\nreturn { triggerRuntimeProps, lookMethods }`)(
    {Matrix4:Matrix,Matrix3:Matrix,Vector3:Vector},()=>[0],()=>'',()=>0)
  const node = { id:'trigger-a', name:'Trigger', type:'trigger', props: trigger.create().props }
  const visual = root(), play = {ed:{nodes:new Map([[node.id,visual]])}}
  const info = lookMethods._trigInfo.call(play,node)
  assert.equal(info.tag,'zona')
  trigger.animation['trigger.tag'].apply(visual,'puerta',node)
  trigger.animation['trigger.lookDistance'].apply(visual,8,node)
  trigger.animation['trigger.onLook'].apply(visual,'inspeccionar',node)
  assert.equal(triggerRuntimeProps(play,node).tag,'puerta')
  assert.equal(lookMethods._trigInfo.call(play,node).tag,'puerta')
  assert.equal(lookMethods._lookDistance.call(play,node),8)
  const signals = []
  const context = { ...play, _lookCur:null, _trigInfo:lookMethods._trigInfo, _triggerFire(obj,signal,fn){signals.push({signal,fn})} }
  lookMethods._lookSet.call(context,node)
  assert.deepEqual(signals,[{signal:'triggerLook',fn:'inspeccionar'}])
  assert.equal(node.props.lookDistance,3)
  assert.match(src('src/engine/runtime/events/play-level.js'),/triggerRuntimeProps\(this, t\.obj\)\.onEnter/)
})
test('Trigger: restauración separada de color, bool y métodos', () => {
  const node = { id:'trigger-a', type:'trigger', ...trigger.create() }
  const color={set(v){this.value=v}}, visual={userData:{fillMat:{color},edgeMat:{color}}}
  const specs = ['trigger.color','trigger.look','trigger.onExit'].map(id=>trigger.animation[id])
  const saved=specs.map(spec=>spec.capture(visual,node))
  specs[0].apply(visual,'#ffffff',node)
  specs[1].apply(visual,true,node)
  specs[2].apply(visual,'cerrar',node)
  specs[1].restore(visual,saved[1],node)
  assert.equal(visual.userData.timelineTriggerProps.onExit,'cerrar')
  specs[2].restore(visual,saved[2],node)
  specs[0].restore(visual,saved[0],node)
  assert.equal(color.value,node.color)
  assert.equal(visual.userData.timelineTriggerProps,undefined)
  assert.equal(visual.userData.timelineTriggerColor,undefined)
})
test('La sesión conserva métodos, eventos, audio y no introduce otro evaluador temporal',()=>{
  const panel=src('src/components/TimelinePanel.vue')
  const timeline=src('src/engine/runtime/events/play-timeline.js')
  assert.match(panel,/\.kind === 'method'|kind === 'method'/)
  assert.match(timeline,/audio\(k, run\)/)
  assert.match(timeline,/\bnode\(name, prop, v,/)
  assert.doesNotMatch(src('src/engine/runtime/nodes/camera-shake.js'),/new AnimationPlayer\(/)
})
