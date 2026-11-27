// S15-G005 · Cámara editorial, pilotaje y Preview. No sustituye el QA WebGL del usuario.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nodeAnimationProperty } from '../src/engine/runtime/anim/model.js'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
class V3 {
  constructor(x=0,y=0,z=0) { this.set(x,y,z) }
  set(x,y,z) { Object.assign(this,{x,y,z}); return this }
  fromArray(v) { return this.set(...v) }
  toArray() { return [this.x,this.y,this.z] }
  copy(v) { return this.set(v.x,v.y,v.z) }
  clone() { return new V3(this.x,this.y,this.z) }
}
class Euler extends V3 { constructor() { super();this.order='YXZ' } copy(v) { super.copy(v); this.order=v.order;return this } }
class Quaternion { clone() {return new Quaternion()} copy() {return this} }
class PerspectiveCamera {
  constructor() { this.position=new V3();this.quaternion=new Quaternion();this.fov=70 }
  updateProjectionMatrix() {}
}
const THREE={Vector3:V3,Quaternion,PerspectiveCamera}
const DEG=Math.PI/180
function makePreview() {
  const code=read('src/core/timeline/preview.js').replace(/^import .*$/gm,'').replace('export class TimelinePreview','class TimelinePreview')
  const TimelinePreview=Function('THREE','evalTimelineCamera','evalTimelineNode','quatFromRot','sampleBakeTrack','DEG','localMatrix','resolveCamera3D','nodeAnimationProperty',
    code+'\nreturn TimelinePreview')(THREE,(track,t)=>track.kind==='camera' ? {pos:[t,0,0],quat:new Quaternion(),fov:75} : null,
    (track,t)=>track.keys[0].v.map((n,i)=>n+(track.keys[1].v[i]-n)*t),()=>new Quaternion(),()=>null,DEG,()=>null,()=>null,nodeAnimationProperty)
  const persp={name:'persp'}, ortho={name:'ortho'}
  const vp={persp,ortho,camera:ortho,controls:{enabled:false},container:{clientWidth:800,clientHeight:600}, requestRender(){this.renders=(this.renders||0)+1}}
  const calls={pilot:0,gizmo:0,boxes:0}
  const editor={vp,nodes:new Map(), stopCameraPilot(){calls.pilot++}, _updateGizmoMode(){calls.gizmo++}, _updateBoxes(){calls.boxes++}}
  let objects=[]
  const preview=new TimelinePreview({getEditor:()=>editor,getObjects:()=>objects,worldMatrix:()=>null})
  return {preview,editor,vp,calls,setObjects(v){objects=v}}
}
const cameraTrack={kind:'camera',muted:false,keys:[{t:0}]}

test('G005-01 · Preview no convierte vista ortográfica previa en perspectiva al salir',()=>{
  const {preview,vp}=makePreview()
  preview.apply({tracks:[cameraTrack]},1)
  assert.equal(vp.camera,preview.camera)
  assert.equal(vp.controls.enabled,false)
  preview.stop()
  assert.equal(vp.camera,vp.ortho)
  assert.equal(vp.controls.enabled,false)
})
test('G005-02 · también restaura perspectiva y controles habilitados',()=>{
  const {preview,vp}=makePreview();vp.camera=vp.persp;vp.controls.enabled=true
  preview.apply({tracks:[cameraTrack]},1);preview.stop()
  assert.equal(vp.camera,vp.persp)
  assert.equal(vp.controls.enabled,true)
})
test('G005-03 · pilotaje termina una sola vez al tomar Preview y no compite por frame',()=>{
  const {preview,calls}=makePreview()
  preview.apply({tracks:[cameraTrack]},1)
  preview.apply({tracks:[cameraTrack]},2)
  preview.apply({tracks:[cameraTrack]},3)
  assert.equal(calls.pilot,1)
  assert.equal(calls.gizmo,1)
  preview.stop()
  assert.equal(calls.gizmo,2)
  preview.stop()
  assert.equal(calls.gizmo,2)
})
test('G005-04 · corte temporal sin pista de cámara restaura la vista anterior',()=>{
  const {preview,vp}=makePreview()
  preview.apply({tracks:[cameraTrack]},1)
  preview.apply({tracks:[]},2)
  assert.equal(vp.camera,vp.ortho)
  assert.equal(vp.controls.enabled,false)
})
test('G005-05 · cambio de FOV/pose en cada scrub no altera la cámara editorial',()=>{
  const {preview,vp}=makePreview()
  preview.apply({tracks:[cameraTrack]},1)
  preview.apply({tracks:[cameraTrack]},4)
  assert.equal(preview.camera.position.x,4)
  assert.equal(preview.camera.fov,75)
  preview.stop();assert.equal(vp.camera,vp.ortho)
  assert.deepEqual([vp.ortho.name,vp.persp.name],['ortho','persp'])
})
test('G005-06 · animación temporal no escribe datos del proyecto y restaura la pose',()=>{
  const f=makePreview(),obj={id:'camera-a',type:'camera',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1],active:true,visible:true}
  const node={position:new V3(1,2,3),rotation:new Euler(),scale:new V3(1,1,1),userData:{},visible:true,updateMatrixWorld(){}}
  f.editor.nodes.set('camera-a',node);f.setObjects([obj])
  const tr={kind:'node',node:'camera-a',byId:true,prop:'position',keys:[{t:0,v:[1,2,3]},{t:2,v:[5,6,7]}]}
  f.preview.apply({tracks:[tr]},0.5)
  assert.equal(node.position.x,3)
  assert.deepEqual(obj.position,[1,2,3])
  f.preview.stop()
  assert.deepEqual(node.position.toArray(),[1,2,3])
})
test('G005-07 · cambios del Inspector durante scrubbing prevalecen sobre snapshot temporal',()=>{
  const f=makePreview(),obj={id:'camera-a',type:'camera',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1],active:true,visible:true}
  const node={position:new V3(1,2,3),rotation:new Euler(),scale:new V3(1,1,1),userData:{},visible:true,updateMatrixWorld(){}}
  f.editor.nodes.set('camera-a',node);f.setObjects([obj])
  const tr={kind:'node',node:'camera-a',byId:true,prop:'position',keys:[{t:0,v:[1,2,3]},{t:2,v:[5,6,7]}]}
  f.preview.apply({tracks:[tr]},.5)
  obj.position=[9,8,7];obj.rotation=[0,90,0];obj.visible=false
  f.preview.stop()
  assert.deepEqual(node.position.toArray(),[9,8,7])
  assert.ok(Math.abs(node.rotation.y-Math.PI/2)<1e-10)
  assert.equal(node.visible,false)
  assert.deepEqual(obj.position,[9,8,7])
})
test('G005-08 · siguiente scrub parte de nueva pose de autoría, no snapshot anterior',()=>{
  const f=makePreview(),obj={id:'camera-a',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1],active:true,visible:true}
  const node={position:new V3(1,2,3),rotation:new Euler(),scale:new V3(1,1,1),userData:{},visible:true,updateMatrixWorld(){}}
  f.editor.nodes.set('camera-a',node);f.setObjects([obj])
  const tr={kind:'node',node:'camera-a',byId:true,prop:'position',keys:[{t:0,v:[1,2,3]},{t:2,v:[5,6,7]}]}
  f.preview.apply({tracks:[tr]},.5)
  obj.position=[11,12,13]
  f.preview.apply({tracks:[tr]},.8)
  f.preview.stop()
  assert.deepEqual(node.position.toArray(),[11,12,13])
})
test('G005-09 · selección temporal de Timeline no es mutada por el código de selección espacial',()=>{
  const source=read('src/core/editor/selection.js')
  const code=source.replace(/^import .*$/gm,'').replace('export const selectionMethods','const selectionMethods')
  const store={tool:'select',selectedId:'camera-a',selectedIds:['camera-a'],play:{on:false},prefs:{selectionStyle:'none'}, gizmo:'translate',space:'world',temporalSelection:{kind:'timeline',resourceId:'tl',element:'key',trackId:'tr',itemId:'key'}}
  const selected=store.temporalSelection
  const methods=Function('THREE','store','getDef','getObject','makeCanvas',code+'\nreturn selectionMethods')(
    {LineBasicMaterial:class{},BoxHelper:class{}},store,()=>({scalable:false}),()=>({id:'camera-a',type:'camera'}),()=>{})
  const vp={overlay:{remove(){}},look:{setEditorOutline(){}},camera:{},requestRender(){}}
  const ed={vp,edit:null,nodes:new Map([['camera-a',{userData:{}}]]),boxes:[],_rsId:null,
    _syncNodeGizmos(){},_detachAll(){},_lockedChain(){return false},_multiTargets(){return []},_updateGizmoMode(){},_syncRoadHandles(){},_syncTerrainGizmo(){},_tcs(){return []}}
  methods.setSelection.call(ed,'camera-a',['camera-a'])
  assert.equal(store.temporalSelection,selected)
  assert.equal(store.temporalSelection.itemId,'key')
})
test('G005-10 · no se adjuntan TransformControls cuando la vista está en Preview',()=>{
  const s=read('src/core/editor/selection.js'),cam=read('src/core/editor/camera-tools.js')
  assert.match(s,/this\.vp\.camera !== this\.vp\.persp && this\.vp\.camera !== this\.vp\.ortho/)
  assert.match(cam,/this\.vp\.camera !== this\.vp\.persp && this\.vp\.camera !== this\.vp\.ortho/)
})
test('G005-11 · Camera3D utiliza TransformControls originales y prohíbe escala',()=>{
  assert.match(read('src/engine/runtime/nodes/camera.js'),/scalable: false/)
  const gizmo=read('src/core/editor/gizmo.js')
  assert.match(gizmo,/new TransformControls\(this\.vp\.camera, this\.dom\)/)
  assert.match(read('src/core/editor/selection.js'),/getDef\(obj\.type\)\.scalable/)
})
test('G005-12 · Preview no añade keys automáticas ni muta un Timeline en disco',()=>{
  const code=read('src/core/timeline/preview.js')
  assert.doesNotMatch(code,/\b(?:newKey|addTimelineKey|commit|updateObject)\(/)
  assert.match(code,/this\.restoreNodes\(\)/)
})
