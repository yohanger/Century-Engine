import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNodeAnimationProperties, nodeAnimationProperty } from '../src/engine/runtime/anim/model.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'
const src = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')

function spatialDescriptors() {
  const text = src('src/engine/runtime/nodes/physics.js')
  const start = text.indexOf('const spatialAnimationFields =')
  const end = text.indexOf('function bodyDefinition',start)
  assert.ok(start>0 && end>start)
  return Function(`${text.slice(start,end)}; return spatialAnimation`)()
}
const spatial = spatialDescriptors()
for (const type of ['characterbody3d','area3d']) registerNodeAnimationProperties(type,spatial(type))
const fakeRoot=()=>({userData:{}})
const bodyNode=(type,props)=>({id:'body-1',type,visible:true,active:true,props})

function spatialRuntime() {
  const text = src('src/engine/runtime/physics/node-spatial.js')
    .replace(/^import .+$/gm,'')
    .replace(/export (class|function)/g,'$1')
  const fakeTHREE={Vector3:class {
    constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}
    set(x,y,z){Object.assign(this,{x,y,z});return this}
  },Quaternion:class{}}
  return Function('THREE','getNativeSignal','validatePhysicsTree','createVirtualCharacter',
    text+'; return NodeSpatialRuntime')(
      fakeTHREE,()=>{},()=>{},()=>{})
}

test('CORR003-P01 · CharacterBody3D expone velocidad, masa, pendiente y canales seguros; Area3D dos, sin exponer formas',()=>{
  const c=bodyNode('characterbody3d',{gravity:9.81,stepHeight:0.35,floorSnap:0.5})
  const a=bodyNode('area3d',{monitoring:true,monitorable:true})
  assert.deepEqual(Object.keys(spatial('characterbody3d')),['physics.velocity','physics.gravity','physics.maxSlopeAngle','physics.characterMass','physics.stepHeight','physics.floorSnap'])
  assert.deepEqual(Object.keys(spatial('area3d')),['physics.monitoring','physics.monitorable'])
  for(const key of Object.keys(spatial('characterbody3d'))) assert.ok(nodeAnimationProperty(c,key),key)
  for(const key of Object.keys(spatial('area3d'))) assert.ok(nodeAnimationProperty(a,key),key)
  assert.equal(nodeAnimationProperty(c,'physics.mass'),null) // ID genérico sin dueño; se usa physics.characterMass
})
test('CORR003-P02 · valores físicos del Timeline guardan booleanos y números validados',()=>{
  const a=bodyNode('area3d',{monitoring:true,monitorable:true})
  const c=bodyNode('characterbody3d',{gravity:9.81,stepHeight:0.35,floorSnap:0.5})
  const tl=newTimeline('Física temporal',{duration:3})
  upsertTimelineNodePropertyKey(tl,a,'physics.monitoring','scene',[a],1,false)
  upsertTimelineNodePropertyKey(tl,c,'physics.gravity','scene',[c],2,15)
  assert.deepEqual(normalizeTimeline(tl).tracks.map(t=>t.keys[0].v),[false,15])
  assert.throws(()=>upsertTimelineNodePropertyKey(tl,c,'physics.gravity','scene',[c],1,-1))
})
test('CORR003-P03 · canales de Jolt aplican y restauran sin cambiar los objetos guardados',()=>{
  const obj=bodyNode('characterbody3d',{gravity:9.81,stepHeight:0.35,floorSnap:0.5})
  const old=JSON.stringify(obj), r=fakeRoot()
  const grav=spatial('characterbody3d')['physics.gravity']
  const step=spatial('characterbody3d')['physics.stepHeight']
  const gs=grav.capture(r,obj),ss=step.capture(r,obj)
  grav.apply(r,15,obj);step.apply(r,1,obj)
  assert.equal(grav.runtimeRead(r,obj),15)
  assert.equal(step.runtimeRead(r,obj),1)
  grav.restore(r,gs,obj)
  assert.equal(grav.runtimeRead(r,obj),9.81)
  assert.equal(step.runtimeRead(r,obj),1)
  step.restore(r,ss,obj)
  assert.equal(r.userData.timelineSpatial,undefined)
  assert.equal(JSON.stringify(obj),old)
})
test('CORR003-P04 · el NodeSpatialRuntime original consulta la configuración temporal',()=>{
  const Klass=spatialRuntime(), obj=bodyNode('characterbody3d',{gravity:9.81})
  const r=fakeRoot(), project={objects:[obj]}
  const play={project,ed:{nodes:new Map([[obj.id,r]])}}
  const runtime=new Klass(play,()=>{})
  assert.equal(runtime._effectiveSpatial(obj).gravity,9.81)
  r.userData.timelineSpatial={gravity:27}
  assert.equal(runtime._effectiveSpatial(obj).gravity,27)
  assert.equal(obj.props.gravity,9.81)
  delete r.userData.timelineSpatial
  assert.equal(runtime._effectiveSpatial(obj).gravity,9.81)
})
test('CORR003-P05 · tick de Jolt consulta gravedad, escalón y Snap efectivos sin reconstruir',()=>{
  const code=src('src/engine/runtime/physics/node-spatial.js')
  assert.match(code,/const spatial = this\._effectiveSpatial\(c\.obj\)/)
  for(const prop of ['gravity','stepHeight','floorSnap']) assert.match(code,new RegExp(`spatial\\.${prop}`))
  assert.doesNotMatch(code,/world\.update\.mWalkStairsStepUp\.Set\(0, c\.obj\.props\.stepHeight/)
  assert.match(code,/this\._effectiveSpatial\(area\.obj\)\.monitoring/)
  assert.match(code,/this\._effectiveSpatial\(other\.obj\)\.monitorable/)
})
test('CORR003-P06 · el Inspector tiene llave para cada propiedad física certificada',()=>{
  const inspector=src('src/components/Inspector.vue')
  for(const [type,id] of [['characterbody3d','gravity'],['characterbody3d','stepHeight'],
    ['characterbody3d','floorSnap'],['area3d','monitoring'],['area3d','monitorable']]) {
    assert.match(inspector,new RegExp(`inspectorKeyable\\('physics\\.${id}'\\)`),`${type}:${id}`)
  }
})
test('CORR003-P07 · Nature comparte registro original y llaves para tres propiedades',()=>{
  const n=src('src/engine/runtime/nodes/nature.js'), inspector=src('src/components/Inspector.vue')
  for(const [key,kind] of [['color','color'],['castShadow','bool'],['windSway','number']]) {
    assert.match(n,new RegExp(`${key}: \\{label:.*kind:'${kind}'`))
    assert.match(inspector,new RegExp(`inspectorKeyable\\('nature\\.${key}'\\)`))
  }
  assert.match(n,/applyWind\(mesh\.material/)
})
test('CORR003-P08 · AudioSource consulta estado temporal y no inicia voces al inspeccionar',()=>{
  const audio=src('src/engine/runtime/audio/scene.js')
  assert.match(audio,/_sourceConfig\(obj\)/)
  assert.match(audio,/timelineAudio/)
  assert.match(audio,/if \(!s\.liveSourceKey\) s\.liveSourceKey=key/)
  assert.match(audio,/if \(key !== s\.liveSourceKey && !s\.pendingLiveChange\)/)
  assert.match(audio,/v\.setVolume\(config\.volume\)/)
})
test('CORR003-P09 · VFX3D reutiliza la simulación del propietario y no modifica el recurso',()=>{
  const vfx=src('src/engine/runtime/nodes/vfx.js')
  assert.match(vfx,/timelineVfx\?\.seed/)
  assert.match(vfx,/timelineVfx\?\.vfxId/)
  assert.match(vfx,/timelineVfx\?\.enabled/)
  assert.match(vfx,/new VfxSimulation\(resource, \{ seed \}\)/)
  assert.match(vfx,/renderer\.sync\(scene\.vp\.camera\)/)
})
test('CORR003-P10 · CameraMain no crea otra autoridad de cámara y no modifica props.main',()=>{
  const camera=src('src/engine/runtime/nodes/camera.js'),play=src('src/engine/runtime/events/play-camera.js')
  assert.match(camera,/'camera\.main'/)
  assert.match(camera,/timelineMain/)
  assert.match(play,/_mainCameraNode\(/)
  assert.doesNotMatch(camera,/obj\.props\.main\s*=/)
})
