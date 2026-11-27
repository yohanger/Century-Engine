import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTimeline, normalizeTimeline, timelineFrameTime, timelineFps, timelineSnapFrame,
  newTrack, newKey, upsertTimelineNodePropertyKey, readTimelineNodeProperty } from '../src/core/timeline/model.js'
import { PROPS, nodeAnimationProperty, nodeAnimationProperties, registerNodeAnimationProperties } from '../src/engine/runtime/anim/model.js'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const propertyNode = (id, active = true) => ({id, type:'node', name:id, active, visible:true, parentId:null, props:{}})

// Métodos originales cargados con colaboradores mínimos; no se replica el algoritmo de activación.
function actualMethods(path, symbol, injected) {
  const code = source(path).replace(/^import .*$/gm, '')
    .replace(`export const ${symbol} =`, `const ${symbol} =`)
  return Function(...Object.keys(injected), `${code}; return ${symbol}`)(...Object.values(injected))
}
const Dummy = class {}
const timelineMethods = actualMethods('src/engine/runtime/events/play-timeline.js', 'timelineMethods',
  {THREE:{ Vector3:Dummy,Quaternion:Dummy,Euler:Dummy }, PROPS, nodeAnimationProperty})
const nodesMethods = actualMethods('src/engine/runtime/events/play-nodes.js','nodesMethods',
  { nodeActive: obj => obj.active !== false })
function runtime(objects) {
  const roots = new Map(objects.map(obj => [obj.id,{userData:{},visible:true}]))
  const changes = { lifecycle:0, physics:[], audio:[], frames:0 }
  const context = {
    ...nodesMethods, ...timelineMethods,
    project:{activeSceneId:'scene-A',objects},
    ed:{nodes:roots,nodeLifecycle:{sync(){changes.lifecycle++}}},
    _referenceSession:'session-A',
    _tlChannels:new Map(), _tlWriting:null,
    _tlWarned:new Set(),
    hidden:[], events:[], state:{},
    vp:{requestRender(){changes.frames++}},
    phys:{setNodeEnabled(_root,on){changes.physics.push(on)}},
    audio:{setNodeEnabled(_id,on){changes.audio.push(on)}},
    _find(id){return objects.find(obj=>obj.id===id) || null},
    rt:{toast(){throw new Error('unexpected timeline warning')}},
  }
  return {context,roots,changes}
}
function activeRun(obj, keys = [[0,true],[1,false],[2,true]]) {
  const tr = newTrack('node',{node:obj.id,sceneId:'scene-A',byId:true,prop:'active',name:'Activo'})
  tr.keys=keys.map(([t,v])=>newKey('node',t,{v}))
  return {tl:{tracks:[tr]}, _tlChannelKeys:[]}
}

test('FPS por recurso: defecto 30, legado 30, 24/25/30/60 y personalizado 48',()=>{
  for (const fps of [24,25,30,48,60,120,240]) {
    const tl=normalizeTimeline(newTimeline('FPS',{fps}))
    assert.equal(tl.fps,fps)
    assert.equal(normalizeTimeline(JSON.parse(JSON.stringify(tl))).fps,fps)
  }
  const old=newTimeline('Legacy');delete old.fps
  assert.equal(normalizeTimeline(old).fps,30)
})
test('FPS inválido se rechaza, no se clampa silenciosamente',()=>{
  for (const v of [0,-1,1.5,241,Infinity,NaN,'30',null]) {
    assert.throws(()=>timelineFps(v))
    assert.throws(()=>normalizeTimeline(newTimeline('Invalid',{fps:v})))
  }
})
test('Snap usa fotogramas, sin alterar duración ni reproducción en segundos',()=>{
  assert.equal(timelineSnapFrame(0.043,24),timelineFrameTime(1,24))
  assert.equal(timelineSnapFrame(1.001,30),1)
  assert.equal(timelineSnapFrame(0.05,30),timelineFrameTime(2,30))
  assert.equal(timelineFrameTime(30,30),1)
  assert.equal(timelineFrameTime(48,48),1)
})
test('Todos los nodos ofrecen active, incluso Node sin transformación o legacy sin campo',()=>{
  for(const type of ['node','node3d','camera','light','canvas','terrain','rigidbody3d','area3d','vfx']) {
    const obj={id:type,type,visible:true,active:true,props:{}}
    assert.strictEqual(nodeAnimationProperty(obj,'active'),PROPS.active)
    assert.ok(nodeAnimationProperties(obj).some(([id])=>id==='active'))
  }
  assert.equal(readTimelineNodeProperty({type:'node',visible:true},'active'),true)
})
test('Inserta false/true de Node con una sola pista por identidad',()=>{
  const obj=propertyNode('N'), timeline=newTimeline('Activar',{duration:5})
  const a=upsertTimelineNodePropertyKey(timeline,obj,'active','scene-A',[obj],1,false)
  const b=upsertTimelineNodePropertyKey(timeline,obj,'active','scene-A',[obj],2,true)
  assert.equal(a.track.id,b.track.id)
  assert.deepEqual(a.track.keys.map(k=>k.v),[false,true])
  assert.deepEqual(normalizeTimeline(timeline).tracks[0].keys.map(k=>k.v),[false,true])
})
test('Player: active usa NodeLifecycle y física, y restaura valor autoral sin persistir estado',()=>{
  const obj=propertyNode('N'), {context,roots,changes}=runtime([obj])
  const run=activeRun(obj)
  context._tlChannelAcquire(run)
  const host=context._tlHost()
  context._tlApplyNode(run, host.node, obj.id,'active',false,{byId:true,sceneId:'scene-A'})
  assert.equal(roots.get(obj.id).userData._lfRuntimeActive,false)
  assert.equal(roots.get(obj.id).visible,false)
  assert.equal(changes.physics.at(-1),false)
  assert.equal(changes.audio.at(-1),false)
  assert.equal(changes.lifecycle,1)
  assert.equal(context._tlChannels.size,1)
  context._tlApplyNode(run, host.node, obj.id,'active',true,{byId:true,sceneId:'scene-A'})
  assert.equal(roots.get(obj.id).visible,true)
  assert.equal(changes.lifecycle,2)
  context._tlChannelRelease(run)
  assert.equal(Object.hasOwn(roots.get(obj.id).userData,'_lfRuntimeActive'),false)
  assert.equal(obj.active,true)
  assert.equal(context._tlChannels.size,0)
})
test('Player: Node inicialmente inactivo puede recibir la clave true y restaurarse a false',()=>{
  const obj=propertyNode('N',false),{context,roots}=runtime([obj]),run=activeRun(obj)
  context._tlChannelAcquire(run)
  context._tlApplyNode(run,context._tlHost().node,obj.id,'active',true,{byId:true,sceneId:'scene-A'})
  assert.equal(roots.get(obj.id).userData._lfRuntimeActive,true)
  context._tlChannelRelease(run)
  assert.equal(obj.active,false)
  assert.equal(roots.get(obj.id).visible,false)
})
test('Player: una segunda cinemática no puede reclamar el mismo canal active',()=>{
  const obj=propertyNode('N'), {context}=runtime([obj])
  context._tlChannelAcquire(activeRun(obj))
  assert.throws(()=>context._tlChannelAcquire(activeRun(obj)),/ocupado/)
})
test('PlayMode: no activa ID de escena incorrecto ni referencias por nombre',()=>{
  const obj=propertyNode('N'), {context,roots}=runtime([obj]),run=activeRun(obj)
  context._tlChannelAcquire(run)
  const host=context._tlHost()
  context._tlApplyNode(run,host.node,obj.id,'active',false,{byId:true,sceneId:'wrong'})
  context._tlApplyNode(run,host.node,obj.id,'active',false,{byId:false,sceneId:'scene-A'})
  assert.equal(roots.get(obj.id).userData._lfRuntimeActive,undefined)
})
test('Contrato UI: Active aparece junto al control, FPS tiene entrada propia y frame Snap',()=>{
  const inspector=source('src/components/Inspector.vue'),panel=source('src/components/TimelinePanel.vue')
  assert.match(inspector, /PropertyKey v-if="inspectorKeyable\('active'\)"/)
  assert.match(panel, /aria-label="Fotogramas por segundo del Timeline"/)
  assert.match(panel, /value="frame">1 fotograma/)
  assert.match(panel, /timelineSnapFrame\(t, tl\.value\.fps/)
})

test('Al desactivar un padre, sus descendientes heredan el estado sin cambiar su dato autoral',()=>{
  const parent=propertyNode('P'), child={...propertyNode('C'),parentId:parent.id}
  const {context,roots,changes}=runtime([parent,child]),run=activeRun(parent)
  context._tlChannelAcquire(run)
  const host=context._tlHost()
  context._tlApplyNode(run,host.node,parent.id,'active',false,{byId:true,sceneId:'scene-A'})
  assert.equal(roots.get(parent.id).visible,false)
  assert.equal(roots.get(child.id).visible,false)
  assert.equal(child.active,true)
  assert.deepEqual(changes.physics.slice(-2),[false,false])
  context._tlChannelRelease(run)
  assert.equal(roots.get(child.id).visible,true)
})
test('Un canal especializado conserva su snapshot al desactivar el mismo nodo',()=>{
  const owner='qa-corr002-owner', prop='qaCorr002.power'
  registerNodeAnimationProperties(owner,{[prop]:{
    label:'Potencia',kind:'number',def:1,
    read:obj=>obj.props.power,apply:(root,value)=>{root.userData.power=value},
    capture:root=>root.userData.power,restore:(root,value)=>{root.userData.power=value},
  }})
  const obj={...propertyNode('N'),type:owner,props:{power:1}}
  const {context,roots}=runtime([obj]);roots.get(obj.id).userData.power=100
  const powerTrack=newTrack('node',{node:obj.id,sceneId:'scene-A',byId:true,prop,keys:[newKey('node',0,{v:20})]})
  const activeTrack=activeRun(obj).tl.tracks[0]
  const run={tl:{tracks:[powerTrack,activeTrack]},_tlChannelKeys:[]}
  context._tlChannelAcquire(run)
  const host=context._tlHost()
  context._tlApplyNode(run,host.node,obj.id,prop,20,{byId:true,sceneId:'scene-A'})
  context._tlApplyNode(run,host.node,obj.id,'active',false,{byId:true,sceneId:'scene-A'})
  assert.equal(context._tlChannels.size,2)
  context._tlChannelRelease(run)
  assert.equal(roots.get(obj.id).userData.power,100)
  assert.equal(roots.get(obj.id).visible,true)
})

test('Animation Clips comparte active con el ciclo de vida original y no cambia datos autorales',()=>{
  class Euler { setFromQuaternion(){return this} }
  const animMethods=actualMethods('src/engine/runtime/events/play-anim.js','animMethods',{
    THREE:{Euler},AnimRunner:class{},findClip(){},PROPS,nodeAnimationProperty,
    DEG:Math.PI/180,ModelRunner:class{},findModelClip(){},describeClips(){},resetPose(){},resolveGraphic(){},
  })
  const obj=propertyNode('clip'), {context,roots,changes}=runtime([obj])
  Object.assign(context,animMethods)
  const host=context._animHost({obj},'Prueba')
  const tr={path:'',prop:'active',keys:[{t:0,v:false}]}
  assert.equal(host.read(tr),true)
  host.apply(tr,false)
  assert.equal(host.read(tr),false)
  assert.equal(changes.lifecycle,1)
  assert.equal(changes.physics.at(-1),false)
  assert.equal(obj.active,true)
  host.apply(tr,true)
  assert.equal(host.read(tr),true)
  assert.equal(changes.lifecycle,2)
})
