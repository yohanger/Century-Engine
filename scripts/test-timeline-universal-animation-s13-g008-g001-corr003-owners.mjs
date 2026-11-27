import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'

const source = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
function camMethods() {
  const code=source('src/engine/runtime/events/play-camera.js').replace(/^import .+$/gm,'').replace(/export /g,'')
  return Function('THREE','setCameraFov','resolveCamera3D', `${code};return cameraMethods`)({},()=>{},()=>{})
}
const camera = camMethods()
function cameraFixture() {
  const objects=[{id:'a',type:'camera',props:{fov:70,main:true}}, {id:'b',type:'camera',props:{fov:60,main:false}}]
  const nodes=new Map(objects.map(o=>[o.id,{userData:{},id:o.id}]))
  const ctx={project:{objects,activeSceneId:'scene'},_gm:{camera:'a'},ed:{nodes},_nodeEnabled:()=>true}
  return {ctx,objects,nodes}
}

test('C003-01 · CA-005 evita conflicto de main temporal y autoral sin alterar Camera Orchestration',()=>{
  const {ctx,objects,nodes}=cameraFixture()
  assert.equal(camera._mainCameraNode.call(ctx).obj.id,'a')
  nodes.get('b').userData.timelineMain=true
  assert.equal(camera._mainCameraNode.call(ctx),null) // A autoral y B temporal son dos principales.
  objects[0].props.main=false
  assert.equal(camera._mainCameraNode.call(ctx)?.obj.id,'b')
  assert.equal(objects[1].props.main,false)
  delete nodes.get('b').userData.timelineMain
  objects[0].props.main=true
  assert.equal(camera._mainCameraNode.call(ctx).obj.id,'a')
})
test('C003-02 · Desactivar la única cámara principal permite recurrir al jugador',()=>{
  const {ctx,nodes}=cameraFixture()
  nodes.get('a').userData.timelineMain=false
  assert.equal(camera._mainCameraNode.call(ctx),null)
})
test('C003-03 · Dos cámaras animadas principales no eligen una por orden arbitrario',()=>{
  const {ctx,nodes}=cameraFixture()
  nodes.get('a').userData.timelineMain=true
  nodes.get('b').userData.timelineMain=true
  assert.equal(camera._mainCameraNode.call(ctx),null)
})
test('C003-04 · La selección de cámara no cambia el orden de FilmMaker/Timeline y solicitudes',()=>{
  const code=source('src/engine/runtime/events/play-camera.js')
  const frame=code.slice(code.indexOf('  _cameraFrame(cam) {'),code.indexOf('  _cameraApply(cam, pose)'))
  assert.ok(frame.indexOf('this.film?.camera')<frame.indexOf('source?.kind === \'request\''))
  assert.ok(frame.indexOf('source?.kind === \'request\'')<frame.indexOf('else if (timeline)'))
  assert.match(source('src/components/Inspector.vue'),/inspectorKeyable\('camera\.main'\)/)
})
test('C003-05 · El registro extiende update original sin modificar el objeto del proyecto ni la pose',()=>{
  let seen=[]
  const def={type:'visualqa',create:()=>({}),build:()=>({}), update(root,obj){
    seen.push({color:obj.color, opacity:obj.props.opacity,opacityOriginal:obj.props.other})
    root.position.value='RESET'; root.quaternion.value='RESET'; root.userData.visual.scale.value='RESET';root.visible=false
  },visualAnimationFields:{
    opacity:{label:'Opacidad',kind:'number',def:1,min:0,max:1},
    color:{label:'Color',kind:'color',def:'#ffffff',scope:'object'},
  }}
  registerNode(def)
  const node={id:'qa',type:'visualqa',color:'#ffffff',props:{opacity:1,other:'preservado'}}
  const userData={ visual:{scale:{value:'SCALE',clone(){return {...this,copy:this.copy}},copy(x){this.value=x.value}}} }
  const cameraPose={value:'POSE', clone(){return {...this,copy:this.copy}},copy(x){this.value=x.value}}
  const root={userData,position:{...cameraPose},quaternion:{...cameraPose},visible:true,updateMatrixWorld(){}}
  const before=JSON.stringify(node)
  const op=getDef('visualqa').animation['visualqa.opacity']
  const color=getDef('visualqa').animation['visualqa.color']
  const o=op.capture(root,node),c=color.capture(root,node)
  op.apply(root,0.3,node)
  color.apply(root,'#ff0022',node)
  assert.deepEqual(seen.at(-1),{color:'#ff0022',opacity:0.3,opacityOriginal:'preservado'})
  assert.equal(root.position.value,'POSE')
  assert.equal(root.quaternion.value,'POSE')
  assert.equal(root.userData.visual.scale.value,'SCALE')
  assert.equal(root.visible,true)
  assert.equal(JSON.stringify(node),before)
  op.restore(root,o,node)
  assert.equal(seen.at(-1).opacity,1)
  assert.equal(seen.at(-1).color,'#ff0022')
  color.restore(root,c,node)
  assert.equal(seen.at(-1).color,'#ffffff')
  assert.equal(root.userData.timelineVisualFields,undefined)
})
test('C003-06 · La normalización de clave valida valores, tiempos y roundtrip del registro visual',()=>{
  const node={id:'qa',type:'visualqa',color:'#ffffff',props:{opacity:1}}
  assert.ok(nodeAnimationProperty(node,'visualqa.opacity'))
  assert.equal(validatePropertyValue('visualqa.opacity',0.25),0.25)
  assert.throws(()=>validatePropertyValue('visualqa.opacity',2))
  const tl=newTimeline('Visual',{duration:3})
  upsertTimelineNodePropertyKey(tl,node,'visualqa.opacity','scene',[node],1,0.25)
  assert.equal(normalizeTimeline(tl).tracks[0].keys[0].v,0.25)
})
test('C003-07 · Las definiciones originales declaran sus propios campos visuales',()=>{
  for(const [file,expect] of [['text',15],['decal',4],['sprite',12]]) {
    const text=source('src/engine/runtime/nodes/'+file+'.js')
    assert.match(text,/visualAnimationFields:/,file)
    assert.ok((text.match(/kind:'(number|bool|color|string|enum|vec3)'/g)||[]).length>=expect-5,file)
  }
  const inspector=source('src/components/Inspector.vue')
  for(const id of ['text.text','text.neon','text.neonAngle','decal.opacity','decal.size'])
    assert.match(inspector,new RegExp("inspectorKeyable\\('"+id.replace('.','\\.')+"'\\)"))
  assert.match(source('src/components/SpriteSection.vue'),/emit\('insert-key'/)
})
test('C003-08 · Canvas aplica alfa y parámetros sobre .ui runtime sin modificar props',()=>{
  const code=source('src/engine/runtime/nodes/canvas.js')
    .replace(/^import .+$/gm,'')
    .replace(/export default registerNode\(/,'const canvasDef = registerNode(')
    .replace(/export /g,'')
  const def=Function('registerNode','SYSTEM_ROLE','THREE','makeCanvas','makeRoot','applyBase','lineMat',`${code};return canvasDef`)(
    d=>d,{fade:{key:'fade',layer:10}}, {},()=>{},()=>{},()=>{},()=>{})
  const obj={id:'canvas',props:{...def.create().props,ui:'original'}}
  const r={userData:{}}
  const alpha=def.animation['canvas.alpha'],ui=def.animation['canvas.ui']
  const snapshot=alpha.capture(r),old=JSON.stringify(obj)
  alpha.apply(r,0.4,obj);ui.apply(r,'ui-2',obj)
  assert.equal(alpha.runtimeRead(r,obj),0.4)
  assert.equal(ui.runtimeRead(r,obj),'ui-2')
  assert.equal(JSON.stringify(obj),old)
  alpha.restore(r,snapshot,obj)
  assert.equal(alpha.runtimeRead(r,obj),1)
  assert.equal(r.userData.timelineCanvas.ui,'ui-2')
  assert.match(source('src/engine/runtime/ui/UiRoot.vue'),/opacity: s\.alpha \?\? 1/)
  assert.match(source('src/engine/runtime/events/play.js'),/timelineCanvas/)
})
test('C003-09 · Sprite2D usa estado temporal en su consumidor overlay real',()=>{
  const code=source('src/engine/runtime/events/play.js')
  assert.match(code,/timelineVisualFields/)
  assert.match(code,/normalizeSprite\(effective\.props, true\)/)
  assert.match(code,/sprite2dScreen\(overlay, canvas\)/)
  assert.match(code,/position: root\.position\?\.toArray/)
  assert.match(code,/rotation: root\.rotation/)
  assert.match(code,/scale: root\.userData\?\.visual\?\.scale/)
  assert.match(source('src/engine/runtime/ui/UiRoot.vue'),/state\?\.spriteRev/)
  assert.match(source('src/engine/runtime/ui/UiRoot.vue'),/spriteStyle\(sp\)/)
})
test('C003-10 · No se modifican Audio, métodos, eventos, la física ni formatos serializados',()=>{
  const src=source('src/engine/runtime/events/play-timeline.js')
  assert.match(src,/method\(nodeId, method, args\)/)
  assert.match(src,/audio\(k, run\)/)
  assert.match(src,/custom\.apply\(node, v, o\)/)
  assert.match(src,/custom\.restore|rec\.spec\.restore/)
})
