import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNodeAnimationProperties, nodeAnimationProperty, validatePropertyValue, PROPS } from '../src/engine/runtime/anim/model.js'
import { sampleTrack, blendValue } from '../src/engine/runtime/anim/eval.js'
import { newTimeline, newTrack, newKey, upsertTimelineNodePropertyKey, findTimelineNodePropertyTrack, normalizeTimeline } from '../src/core/timeline/model.js'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const imported = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const factory = (kind, def) => ({ kind, def, label: 'Prueba', read: node => node.props.value,
  apply: (root, value) => { root.userData.value = value },
  capture: root => root.userData.value,
  restore: (root, value) => { root.userData.value = value },
  ...(kind === 'enum' ? {options:['idle','running','paused']} : {}),
})
const owner = 'qa-s13-g008-g001'
registerNodeAnimationProperties(owner, {
  'qaIntegral.number':factory('number', 1),
  'qaIntegral.bool':factory('bool', false),
  'qaIntegral.enum':factory('enum', 'idle'),
  'qaIntegral.string':factory('string', ''),
  'qaIntegral.color':factory('color', '#123456'),
})
const scene = 'scene-universal'
const obj = {id:'owner-1',name:'Owner',type:owner,props:{value:1},visible:true}
const tl = () => newTimeline('Universal QA',{duration:5})
const track = (prop, keys) => ({prop,keys})
const clipKeys = (...values) => values.map(([t,v]) => ({t,v,ease:'linear'}))

for (const [prop,kind] of [['number','number'],['bool','bool'],['enum','enum'],['string','string'],['color','color']]) {
  test(`Descriptor propietario ${prop} registrado una sola vez y elegible`, () => {
    const id = 'qaIntegral.'+prop
    assert.equal(PROPS[id].kind,kind)
    assert.strictEqual(nodeAnimationProperty({...obj,props:{value:PROPS[id].def}},id),PROPS[id])
    assert.equal(nodeAnimationProperty({...obj,type:'camera'},id),null)
  })
}
test('Propiedades discretas no se interpolan ni generan valores intermedios inválidos', () => {
  for (const [prop,a,b] of [['bool',false,true],['enum','idle','running'],['string','a','b']]) {
    const tr=track('qaIntegral.'+prop,clipKeys([0,a],[2,b]))
    assert.equal(sampleTrack(tr,1),a)
    assert.equal(sampleTrack(tr,2),b)
    assert.equal(blendValue(tr.prop,a,b,.25),a)
    assert.equal(blendValue(tr.prop,a,b,.75),b)
  }
})
test('Números y colores del propietario usan el muestreador compartido', () => {
  assert.equal(sampleTrack(track('qaIntegral.number',clipKeys([0,0],[2,10])),1),5)
  assert.equal(sampleTrack(track('qaIntegral.color',clipKeys([0,'#000000'],[2,'#ffffff'])),1),'#808080')
})
test('Strings y enums rechazan valores ajenos a sus tipos', () => {
  assert.throws(()=>validatePropertyValue('qaIntegral.enum','unknown'),/Tipo|válido|reconocido/)
  assert.throws(()=>validatePropertyValue('qaIntegral.string',7),/Tipo|reconocido/)
  assert.throws(()=>validatePropertyValue('qaIntegral.number',NaN),/numérico/)
})
test('Inspector y Timeline reutilizan la misma clave y la persistencia conserva su ID', () => {
  const timeline=tl(), prop='qaIntegral.number', items=[obj]
  const a=upsertTimelineNodePropertyKey(timeline,obj,prop,scene,items,1,2)
  const b=upsertTimelineNodePropertyKey(timeline,obj,prop,scene,items,1,3)
  assert.equal(a.track.id,b.track.id)
  assert.equal(a.key.id,b.key.id)
  assert.equal(b.updated,true)
  assert.equal(timeline.tracks.length,1)
  assert.equal(findTimelineNodePropertyTrack(timeline,obj,prop,scene,items)?.keys[0]?.v,3)
  const loaded=normalizeTimeline(JSON.parse(JSON.stringify(timeline)))
  assert.equal(loaded.tracks[0].keys[0].id,a.key.id)
  assert.equal(loaded.tracks[0].keys[0].v,3)
})
test('No se crean claves para nodos ausentes o escenas no identificadas',()=>{
  assert.throws(()=>upsertTimelineNodePropertyKey(tl(),obj,'qaIntegral.number',scene,[],1,2),/no existe/)
  assert.throws(()=>upsertTimelineNodePropertyKey(tl(),obj,'qaIntegral.number','',[obj],1,2),/obligatoria/)
})
test('Los clips históricos Nodo siguen conservando referencias, duración y trim al guardar',()=>{
  const timeline=newTimeline('Legacy',{duration:3})
  const tr=newTrack('node',{node:'node-legacy',byId:true,sceneId:'scene-legacy',prop:'position'})
  tr.keys=[newKey('node',0,{v:[0,0,0]}),newKey('node',2,{v:[2,0,0]})]
  tr.clips=[{id:'legacy-clip',from:tr.keys[0].id,to:tr.keys[1].id,start:0,duration:2,in:0,out:1}]
  timeline.tracks.push(tr)
  const loaded=normalizeTimeline(JSON.parse(JSON.stringify(timeline)))
  assert.deepEqual(loaded.tracks[0].clips,tr.clips)
  assert.deepEqual(normalizeTimeline(loaded).tracks[0].clips,tr.clips)
})
test('La UI conserva PropertyKey del Inspector y usa transporte y upsert originales',()=>{
  const inspector=read('src/components/Inspector.vue')
  assert.match(inspector,/import PropertyKey from '\.\/PropertyKey\.vue'/)
  assert.match(inspector,/inject\(timelinePlaybackKey/)
  assert.match(inspector,/upsertTimelineNodePropertyKey\(/)
  assert.match(inspector,/<PropertyKey v-if="inspectorKeyable\('camera\.fov'\)"/)
  assert.match(inspector,/store\.temporalEditRevision\+\+/)
  const timeline=read('src/components/TimelinePanel.vue')
  assert.match(timeline,/upsertTimelineNodePropertyKey\(/)
  assert.doesNotMatch(timeline,/>\s*\+ Clip\s*</)
  assert.doesNotMatch(timeline,/Crear clip desde este tramo/)
  assert.doesNotMatch(timeline,/function createClip\(/)
})
test('Audio, métodos, eventos, toma y reproducción de clips históricos permanecen',()=>{
  const panel=read('src/components/TimelinePanel.vue')
  for(const kind of ["'audio'","'commands'","'method'"]) assert.ok(panel.includes(kind),`${kind} no disponible`)
  assert.match(panel,/addTimelineCameraBinding\(/)
  assert.match(panel,/timeline-live-clip/)
  assert.match(panel,/editTimelineClip\(/)
  assert.match(panel,/deleteTimelineClip\(/)
  const runtime=read('src/engine/runtime/events/play-timeline.js')
  assert.match(runtime,/_tlHost\(\)/)
  assert.match(runtime,/method\(nodeId, method, args\)/)
  assert.match(runtime,/commands\(list, \{ name \}\)/)
})

test('Timeline runtime usa el evaluador compartido para los canales especializados',()=>{
  const runtime=read('src/engine/runtime/timeline/eval.js')
  assert.match(runtime,/sampleAnimationTrack\(track, t\)/)
})

const srcCamera = read('src/engine/runtime/nodes/camera.js')
  .replace("import * as THREE from 'three'", 'const THREE={Float32BufferAttribute:class {constructor(value,size){this.value=value;this.size=size}}}')
  .replace("import { registerNode } from './registry.js'", 'const registerNode=def=>def')
  .replace("import { makeRoot, applyBase, iconMat } from './three-helpers.js'", 'const makeRoot=()=>null, applyBase=()=>{}, iconMat=()=>null')
const {default:camera}=await imported(srcCamera)
const fakeCamera=()=>({userData:{iconMat:{color:{set(){}}},frustum:{geometry:{setAttribute(){},computeBoundingSphere(){}},userData:{fov:70},material:{color:{set(){}}}}},})
test('Camera3D: FOV autoral, evaluación temporal y restauración conservan sus propietarios',()=>{
  const root=fakeCamera(),obj={props:{fov:70},color:'#ffffff'}
  const spec=camera.animation['camera.fov']
  const snap=spec.capture(root,obj)
  spec.apply(root,98,obj)
  assert.equal(root.userData.timelineFov,98)
  assert.equal(root.userData.frustum.userData.fov,98)
  camera.update(root,obj)
  assert.equal(root.userData.frustum.userData.fov,98,'update no debe pisar el FOV de Timeline')
  spec.restore(root,snap,obj)
  assert.equal(root.userData.timelineFov,undefined)
  assert.equal(root.userData.frustum.userData.fov,70)
  assert.equal(obj.props.fov,70,'se debe preservar FOV autoral')
})

const srcLight = read('src/engine/runtime/nodes/light.js')
  .replace("import { normalizeLight, kelvinToRgb } from '../render/lightlib.js'", 'const normalizeLight=p=>({...p, penumbra:p.penumbra??1, shadowBias:p.shadowBias??0.0004, shadowNormalBias:p.shadowNormalBias??0}),kelvinToRgb=()=>[1,1,1]')
  .replace("import * as THREE from 'three'",'const THREE={}')
  .replace("import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js'",'const Lensflare=class{}, LensflareElement=class{}')
  .replace("import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js'",'const RectAreaLightHelper=class{}')
  .replace("import { registerNode } from './registry.js'",'const registerNode=def=>def')
  .replace("import { makeRoot, applyBase, iconMat, arrowToward } from './three-helpers.js'",'const makeRoot=()=>null,applyBase=()=>{},iconMat=()=>null,arrowToward=()=>null')
  .replace("import { DEG } from '../util.js'",'const DEG=Math.PI/180')
  .replace("import { LIGHT_STYLES } from '../render/lightfx.js'",'const LIGHT_STYLES={}')
const {default:light}=await imported(srcLight)

test('Luz: rango, ángulo, penumbra y sombras usan el emisor real y restauran snapshot',()=>{
  const emitter={distance:10,angle:Math.PI/4,penumbra:.2,isSpotLight:true,shadow:{bias:-.004,normalBias:.3,needsUpdate:false}}
  const root={userData:{light:emitter}}
  const obj={light:{type:'spot',range:10,spotAngle:45,penumbra:.2,shadow:true,shadowBias:.004,shadowNormalBias:.3}}
  for(const [prop,value,readNow] of [
    ['light.range',20,()=>emitter.distance],
    ['light.spotAngle',60,()=>Math.round(emitter.angle*180/Math.PI)],
    ['light.penumbra',.75,()=>emitter.penumbra],
    ['light.shadowBias',.01,()=>-emitter.shadow.bias],
    ['light.shadowNormalBias',.7,()=>emitter.shadow.normalBias],
  ]) {
    const spec=light.animation[prop], old=spec.capture(root,obj)
    assert.equal(spec.available(obj),true)
    spec.apply(root,value,obj)
    assert.ok(Math.abs(readNow()-value)<1e-7,`${prop} apply`)
    spec.restore(root,old,obj)
    assert.ok(Math.abs(readNow()-old)<1e-7,`${prop} restore`)
  }
  assert.equal(light.animation['light.areaWidth'].available(obj),false)
})
test('Luz: flare y FX ajustan el propietario sin mutar el objeto autoral',()=>{
  const root={userData:{flareIntensity:.2,fx:{speed:1,amount:.5},refreshLightEffects(){this.refreshed=true}}}
  const obj={light:{type:'omni',style:'pulse',flareOn:true,flareIntensity:.2,speed:1,amount:.5}}
  const snap=light.animation['light.flareIntensity'].capture(root,obj)
  light.animation['light.flareIntensity'].apply(root,1.2,obj)
  assert.equal(root.userData.flareIntensity,1.2)
  assert.equal(obj.light.flareIntensity,.2)
  light.animation['light.flareIntensity'].restore(root,snap,obj)
  assert.equal(root.userData.flareIntensity,.2)
  light.animation['light.speed'].apply(root,2,obj)
  assert.equal(root.userData.fx.speed,2)
  assert.equal(obj.light.speed,1)
})
