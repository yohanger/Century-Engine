// S15-G005 CORR-001 reconciliado con CA-005: solo la edición explícita cede Preview.
// Node puro: la manipulación Three.js real requiere QA local en Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL('../' + file, import.meta.url),'utf8')

function playbackFixture() {
  const subscriptions = new WeakMap()
  const ref = initial => {
    let value=initial
    const handle={get value(){return value},set value(next){value=next;for(const fn of subscriptions.get(handle)||[])fn(next)}}
    subscriptions.set(handle,[])
    return handle
  }
  const watch = (source, fn) => {subscriptions.get(source).push(fn)}
  const code=read('src/core/timeline/playback-session.js')
    .replace(/^import .*$/gm,'')
    .replace('export const timelinePlaybackKey','const timelinePlaybackKey')
    .replace('export function createTimelinePlayback','function createTimelinePlayback')
  const create=Function('ref','watch',code+'\nreturn createTimelinePlayback')(ref,watch)
  const timeline={id:'timeline-a',duration:12,tracks:[{kind:'camera',keys:[{t:0},{t:5}]}]}
  const project={timelines:[timeline]}, editor={id:'ed'}, cameraChanges=[]
  const calls={starts:0,stops:0,pauses:0,resumes:0,preview:0,restore:0}
  let running=false, suspended=false, time=0
  const events={get active(){return running},get paused(){return suspended},get time(){return time},
    get runner(){return {tl:timeline}},start(tl,t){assert.equal(tl,timeline);running=true;suspended=false;time=t;calls.starts++},
    resume(){suspended=false;calls.resumes++},pause(){suspended=true;calls.pauses++},
    stop(){running=false;suspended=false;calls.stops++},seek(t){time=t},update(){return true}}
  const session=create({getContext:()=>({project,sceneId:'scene-a',editor,timelineId:'timeline-a',playOn:false,locked:false,cinematic:false}),
    getProject:()=>project,getEditor:()=>editor,getObjects:()=>[],worldMatrix:()=>null,
    createEventPreview:()=>events,createVisualPreview:()=>({apply(){calls.preview++},stop(){calls.restore++}}),
    requestFrame:()=>1,cancelFrame:()=>{},now:()=>0})
  return {session,events,project,timeline,calls}
}
function selectionFixture({tool='select',gizmo='translate',play=false,selected='camera-a'}={}) {
  const code=read('src/core/editor/selection.js').replace(/^import .*$/gm,'').replace('export const selectionMethods','const selectionMethods')
  const store={tool,gizmo,selectedId:selected,selectedIds:selected?[selected]:[],play:{on:play},prefs:{selectionStyle:'none'},space:'world'}
  const obj={id:'camera-a',type:'camera',locked:false}
  const methods=Function('THREE','store','getDef','getObject','makeCanvas',code+'\nreturn selectionMethods')(
    {LineBasicMaterial:class{},BoxHelper:class{}},store,()=>({scalable:false}),id=>id===obj.id?obj:null,()=>{})
  const actions=[]
  const ed={edit:null, nodes:new Map([['camera-a',{userData:{}}]]),boxes:[],_rsId:null,
    vp:{overlay:{remove(){}},look:{setEditorOutline(){}},requestRender(){}},
    onSpatialEditRequest(){actions.push('yield')},_syncNodeGizmos(){},_detachAll(){actions.push('detach')},
    _lockedChain(){return false},_multiTargets(){return []},
    _updateGizmoMode(){actions.push('gizmo')},_syncRoadHandles(){},_syncTerrainGizmo(){},
    _isPath(){return false}}
  return {ed,store,methods,actions}
}

test('CORR-01 · seleccionar un nodo no cede Preview ni interrumpe Timeline',()=>{
  const f=selectionFixture()
  f.methods.setSelection.call(f.ed,'camera-a',['camera-a'])
  assert.ok(!f.actions.includes('yield'))
  assert.ok(f.actions.includes('gizmo'))
})
test('CORR-02 · seleccionar repetidamente no cede la cámara temporal',()=>{
  const f=selectionFixture()
  f.methods.setSelection.call(f.ed,'camera-a',['camera-a'])
  f.methods.setSelection.call(f.ed,'camera-a',['camera-a'])
  assert.equal(f.actions.filter(x=>x==='yield').length,0)
})
test('CORR-03 · no cede Preview por una selección nula o herramienta no espacial',()=>{
  const noNode=selectionFixture({selected:null})
  noNode.methods.setSelection.call(noNode.ed,null,[])
  assert.ok(!noNode.actions.includes('yield'))
  const terrain=selectionFixture({tool:'terrain'})
  terrain.methods.setSelection.call(terrain.ed,'camera-a',['camera-a'])
  assert.ok(!terrain.actions.includes('yield'))
})
test('CORR-04 · no cede Preview mientras Play Mode controla la ejecución',()=>{
  const f=selectionFixture({play:true})
  f.methods.setSelection.call(f.ed,'camera-a',['camera-a'])
  assert.ok(!f.actions.includes('yield'))
})
test('CORR-05 · Preview explícito conserva autoridad mientras Timeline reproduce',()=>{
  const f=playbackFixture()
  assert.equal(f.session.toggle(f.timeline),true)
  assert.equal(f.session.playing.value,true)
  assert.equal(f.session.yieldToEditing(),false)
  assert.equal(f.session.previewEnabled.value,true)
  assert.ok(f.calls.preview>0)
})
test('CORR-06 · pausa conserva pose, cabezal y runner sin restaurar el Preview',()=>{
  const f=playbackFixture()
  f.session.toggle(f.timeline);f.session.seek(3.5)
  const restores=f.calls.restore
  f.session.pause()
  assert.equal(f.session.playing.value,false)
  assert.equal(f.session.previewEnabled.value,true)
  assert.equal(f.session.time.value,3.5)
  assert.equal(f.session.resourceId,'timeline-a')
  assert.equal(f.calls.pauses,1)
  assert.equal(f.calls.stops,1) // stop de la sesión vacía previo a iniciar la primera reproducción
  assert.equal(f.calls.restore,restores)
})
test('CORR-07 · cesión explícita en pausa preserva claves y cabezal',()=>{
  const f=playbackFixture()
  f.session.toggle(f.timeline);f.session.seek(2);f.session.pause()
  f.session.previewEnabled.value=true
  f.session.refresh(f.timeline)
  assert.equal(f.session.yieldToEditing(),true)
  assert.equal(f.session.time.value,2)
  assert.equal(f.session.resourceId,'timeline-a')
  assert.equal(f.calls.stops,1)
  assert.equal(f.session.previewEnabled.value,false)
  assert.equal(f.timeline.tracks[0].keys.length,2)
})
test('CORR-08 · se puede activar Preview explícitamente después de editar',()=>{
  const f=playbackFixture()
  f.session.refresh(f.timeline)
  const before=f.calls.preview
  assert.equal(f.session.yieldToEditing(),true)
  f.session.previewEnabled.value=true
  f.session.refresh(f.timeline)
  assert.ok(f.calls.preview>before)
})
test('CORR-09 · desactivar Preview mientras reproduce detiene el transporte (comportamiento existente)',()=>{
  const f=playbackFixture()
  f.session.toggle(f.timeline)
  f.session.previewEnabled.value=false
  assert.equal(f.session.playing.value,false)
  assert.equal(f.session.resourceId,null)
})
test('CORR-10 · el handoff inactivo es idempotente',()=>{
  const f=playbackFixture()
  assert.equal(f.session.yieldToEditing(),true)
  const n=f.calls.restore
  assert.equal(f.session.yieldToEditing(),false)
  assert.equal(f.calls.restore,n)
})
test('CORR-11 · App no cede Timeline al cambiar de herramienta o selección',()=>{
  const app=read('src/App.vue')
  assert.doesNotMatch(app,/editor\.onSpatialEditRequest = \(\) => timelinePlayback\.yieldToEditing\(\)/)
  assert.doesNotMatch(app,/watch\(\(\) => \[store\.tool, store\.gizmo\]/)
  assert.doesNotMatch(read('src/core/editor/selection.js'),/this\.onSpatialEditRequest\?\.\(\)/)
})
test('CORR-12 · Timeline conserva Preview al abrir y ofrece edición autoral explícita',()=>{
  const panel=read('src/components/TimelinePanel.vue')
  assert.doesNotMatch(panel,/if \(store\.selectedId && store\.tool === 'select' && store\.gizmo !== 'none'\) playback\.yieldToEditing\(\)/)
  assert.match(panel,/function togglePreviewEditing\(\)/)
  assert.match(panel,/Editar pose autoral/)
})
test('CORR-13 · Preview conserva la restauración de cámara ortográfica y la pose base',()=>{
  const preview=read('src/core/timeline/preview.js')
  assert.match(preview,/viewport\.camera = this\.previousCamera \|\| viewport\.persp/)
  assert.match(preview,/this\.restoreNodes\(\)/)
  assert.doesNotMatch(preview,/\b(?:newKey|addTimelineKey|updateObject)\(/)
})
test('CORR-14 · no se sustituyen los TransformControls oficiales ni el sistema de Undo',()=>{
  const gizmo=read('src/core/editor/gizmo.js')
  assert.match(gizmo,/new TransformControls\(this\.vp\.camera, this\.dom\)/)
  assert.match(gizmo,/updateObject\(obj\.id, patch, \{ label:/)
  assert.match(read('src/core/editor/selection.js'),/this\._updateGizmoMode\(\)/)
})
