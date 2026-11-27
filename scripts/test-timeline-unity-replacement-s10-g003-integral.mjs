import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as M from '../src/core/timeline/model.js'

const file = rel => readFileSync(new URL('../'+rel,import.meta.url),'utf8')
const ui=file('src/components/TimelinePanel.vue')
const inspector=file('src/components/TemporalResourceInspector.vue')
const store=file('src/core/state/state.js')
const runtime=file('src/engine/runtime/timeline/player.js')
const preview=file('src/core/timeline/preview.js')
const evalSource=file('src/engine/runtime/timeline/eval.js')

// Evaluamos el módulo original en un harness de matemáticas mínimo: no hay Three/WebGL en este contenedor.
class FakeEuler {set(x,y,z){this.x=x;this.y=y;this.z=z;return this} setFromQuaternion(q){this.x=q.x;this.y=q.y;this.z=q.z;return this}}
class FakeQuaternion {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  setFromEuler(e){this.x=e.x;this.y=e.y;this.z=e.z;return this}
  clone(){return new FakeQuaternion(this.x,this.y,this.z)}
  slerp(b,w){this.x+=(b.x-this.x)*w;this.y+=(b.y-this.y)*w;this.z+=(b.z-this.z)*w;return this}
}
const math={Euler:FakeEuler,Quaternion:FakeQuaternion}
const easeValue=(key,u)=>key.ease==='cut'?0:u
function loadEvaluation() {
  const code=evalSource.replace(/^import .*$/gm,'').replace(/^export /gm,'')
  return new Function('THREE','animationEase',code+';return {evalNode,evalCamera,evalTimelineNode,evalTimelineCamera}') (math,easeValue)
}
const evaluate=loadEvaluation()
const make = () => {
  const timeline=M.newTimeline('Prueba de edición',{duration:16})
  const track=M.newTrack('node',{node:'mesh-01',byId:true,prop:'position',interpolation:'linear'})
  track.keys=[
    M.newKey('node',0,{v:[0,0,0],ease:'linear'}),
    M.newKey('node',2,{v:[20,0,0],ease:'linear'}),
    M.newKey('node',4,{v:[100,0,0],ease:'linear'}),
    M.newKey('node',6,{v:[200,0,0],ease:'linear'}),
    M.newKey('node',8,{v:[300,0,0],ease:'linear'}),
    M.newKey('node',10,{v:[400,0,0],ease:'linear'}),
  ]
  timeline.tracks=[track]
  const refs=()=>[0,2,4].map(n=>M.addTimelineClip(timeline,track.id,track.keys[n].id))
  return {timeline,track,refs}
}
const strip=(data)=>JSON.parse(JSON.stringify(data))

// El contrato de origen se mantiene en datos reales, no en un overlay meramente gráfico.
test('G003-01 · tres modos registrados y solo pistas compatibles pueden crear clips',()=>{
  assert.deepEqual(M.TIMELINE_EDIT_MODES.map(m=>m[0]),['mix','ripple','replace'])
  const {timeline,track}=make()
  assert.equal(M.addTimelineClip(timeline,track.id,track.keys[0].id).from,track.keys[0].id)
  assert.equal(track.keys.length,6)
  const evt=M.newTrack('commands');timeline.tracks.push(evt)
  assert.throws(()=>M.addTimelineClip(timeline,evt.id,'whatever'),/Cámara/)
  const visible=M.newTrack('node',{prop:'visible'});timeline.tracks.push(visible)
  assert.throws(()=>M.addTimelineClip(timeline,visible.id,'whatever'),/Cámara/)
})
test('G003-02 · clips guardan referencias a claves originales, no copias de curvas',()=>{
  const {timeline,track}=make(), originalKeys=strip(track.keys)
  const clip=M.addTimelineClip(timeline,track.id,track.keys[2].id)
  assert.deepEqual(track.keys,originalKeys)
  assert.deepEqual(Object.keys(clip).sort(),['duration','from','id','in','out','start','to'].sort())
  assert.equal(clip.start,4);assert.equal(clip.duration,2)
  assert.deepEqual(M.normalizeTimeline(strip(timeline)).tracks[0].clips,[clip])
})
test('G003-03 · Mix permite dos clips simultáneos y rechaza triple solapamiento de forma atómica',()=>{
  const {timeline,track,refs}=make(),clips=refs()
  assert.equal(M.editTimelineClip(timeline,track.id,clips[1].id,{start:1,mode:'mix'}),true)
  assert.equal(M.timelineClipOverlapCount(track.clips),2)
  const before=strip(track.clips)
  assert.throws(()=>M.editTimelineClip(timeline,track.id,clips[2].id,{start:1.5,mode:'mix'}),/dos clips/)
  assert.deepEqual(track.clips,before)
})
test('G003-04 · Mix evalúa mezcla real numérica con interpolación progresiva entre fuentes',()=>{
  const {timeline,track,refs}=make(),[a,b]=refs().slice(0,2)
  M.editTimelineClip(timeline,track.id,b.id,{start:1,mode:'mix'})
  assert.deepEqual(evaluate.evalTimelineNode(track,1),[10,0,0])
  assert.deepEqual(evaluate.evalTimelineNode(track,1.5),[70,0,0])
  assert.deepEqual(evaluate.evalTimelineNode(track,2),[150,0,0])
  assert.equal(evaluate.evalTimelineNode(track,12),undefined) // Las claves fuente no reproducen una segunda animación
  assert.equal(M.timelineClipAt(track,1.5).length,2)
})
test('G003-05 · mezcla de rotación respeta camino angular corto',()=>{
  const {timeline,track}=make()
  track.prop='rotation';track.keys[0].v=[350,0,0];track.keys[1].v=[350,0,0]
  track.keys[2].v=[10,0,0];track.keys[3].v=[10,0,0]
  const a=M.addTimelineClip(timeline,track.id,track.keys[0].id)
  const b=M.addTimelineClip(timeline,track.id,track.keys[2].id)
  M.editTimelineClip(timeline,track.id,b.id,{start:1,mode:'mix'})
  const mid=evaluate.evalTimelineNode(track,1.5)[0]
  assert.ok(Math.abs(mid-360)<1e-6,`ángulo continuo: ${mid}`)
})
test('G003-06 · Ripple desplaza todos los clips posteriores preservando sus separaciones',()=>{
  const {timeline,track,refs}=make(),[a,b,c]=refs()
  assert.equal(M.editTimelineClip(timeline,track.id,a.id,{start:1,mode:'ripple'}),true)
  assert.deepEqual([a,b,c].map(x=>track.clips.find(p=>p.id===x.id).start),[1,5,9])
  assert.equal(track.keys[0].t,0)
})
test('G003-07 · Ripple fuera de duración falla sin modificar ningún clip',()=>{
  const {timeline,track,refs}=make(),[a,b,c]=refs()
  const before=strip(track.clips)
  assert.throws(()=>M.editTimelineClip(timeline,track.id,a.id,{start:7,mode:'ripple'}),/excede/)
  assert.deepEqual(track.clips,before)
})
test('G003-07B · Ripple nunca convierte una inserción superpuesta en Mix implícito',()=>{
  const {timeline,track,refs}=make(),[a,b]=refs().slice(0,2)
  const before=strip(track.clips)
  assert.throws(()=>M.editTimelineClip(timeline,track.id,b.id,{start:1,mode:'ripple'}),/Ripple no permite crear solapamientos/)
  assert.deepEqual(track.clips,before)
})
test('G003-08 · Replace divide clip solapado y mantiene los extremos y el origen exactos',()=>{
  const {timeline,track,refs}=make(),[a,b]=refs().slice(0,2)
  assert.equal(M.editTimelineClip(timeline,track.id,a.id,{start:4.5,mode:'replace'}),true)
  const segments=track.clips.filter(c=>c.from===b.from)
  assert.equal(segments.length,1)
  assert.equal(segments[0].start,4)
  assert.equal(segments[0].duration,.5)
  assert.equal(segments[0].out,.25)
  assert.deepEqual(track.clips.filter(c=>c.from===a.from).map(c=>c.start),[4.5])
})
test('G003-09 · Replace conserva ambos lados del clip cubierto solo en el intervalo central',()=>{
  const {timeline,track,refs}=make(),[a,b]=refs().slice(0,2)
  // acortar clip A a 1s, luego insertarlo a mitad de B (4.5-5.5).
  M.editTimelineClip(timeline,track.id,a.id,{duration:1,mode:'mix'})
  M.editTimelineClip(timeline,track.id,a.id,{start:4.5,mode:'replace'})
  const parts=track.clips.filter(c=>c.from===b.from).sort((a,b)=>a.start-b.start)
  assert.equal(parts.length,2)
  assert.deepEqual(parts.map(c=>[c.start,c.duration]),[[4,.5],[5.5,.5]])
  assert.equal(parts[0].out,.25); assert.equal(parts[1].in,.75)
  assert.notEqual(parts[0].id,parts[1].id)
})
test('G003-10 · el recorte modifica el rango de fuente, no altera las claves originales',()=>{
  const {timeline,track,refs}=make(),[a]=refs()
  const oldKeys=strip(track.keys)
  M.editTimelineClip(timeline,track.id,a.id,{duration:1,mode:'mix'})
  const part=track.clips.find(c=>c.id===a.id)
  assert.equal(part.duration,1);assert.equal(part.out,.5)
  assert.deepEqual(track.keys,oldKeys)
  assert.throws(()=>M.editTimelineClip(timeline,track.id,a.id,{duration:3,mode:'mix'}),/fuente/)
})
test('G003-11 · normalización conserva ids, claves, fracciones y ausencia de conversiones silenciosas',()=>{
  const {timeline,track,refs}=make(),[a,b]=refs().slice(0,2)
  M.editTimelineClip(timeline,track.id,b.id,{start:1,mode:'mix'})
  const before=strip(timeline), after=M.normalizeTimeline(before)
  assert.equal(after.id,before.id)
  assert.deepEqual(after.tracks[0].clips,before.tracks[0].clips)
  assert.deepEqual(after.tracks[0].keys,before.tracks[0].keys)
  const legacy=M.normalizeTimeline({name:'Legacy',duration:9,tracks:[{id:'old',kind:'node',prop:'position',keys:[{id:'orig',t:0,v:[3,4,5]}]}]})
  assert.equal(legacy.tracks[0].keys[0].id,'orig')
  assert.deepEqual(legacy.tracks[0].clips,[])
})
test('G003-12 · datos inválidos nunca se descartan silenciosamente durante normalización',()=>{
  const {timeline,track,refs}=make();refs()
  const invalid=strip(timeline);invalid.tracks[0].clips[0].from='desaparecido'
  assert.throws(()=>M.normalizeTimeline(invalid),/clips inválidos/)
  invalid.tracks[0].clips=[];invalid.tracks[0].clips='malformed'
  assert.throws(()=>M.normalizeTimeline(invalid),/deben ser una lista/)
})
test('G003-13 · clips no pueden salir de duración ni se recorta sin confirmación',()=>{
  const {timeline,track,refs}=make(),[a,b,c]=refs()
  assert.equal(M.timelineMinDuration(timeline),10)
  assert.throws(()=>M.editTimelineClip(timeline,track.id,c.id,{start:15,mode:'mix'}),/fuera/)
  timeline.duration=9
  assert.throws(()=>M.normalizeTimeline(timeline),/excede/)
})
test('G003-14 · borrar claves vinculadas se bloquea; borrar clip permite borrar sus claves',()=>{
  const {timeline,track,refs}=make(),[a]=refs()
  const key=track.keys[0]
  assert.throws(()=>M.deleteTimelineSelection(timeline,[{tr:track.id,k:key.id}]),/Elimina primero el clip/)
  assert.equal(track.keys.length,6)
  assert.equal(M.deleteTimelineClip(timeline,track.id,a.id),true)
  assert.equal(M.deleteTimelineSelection(timeline,[{tr:track.id,k:key.id}]),1)
})
test('G003-15 · movimiento de claves fuente no puede invertir pares de un clip',()=>{
  const {timeline,track,refs}=make(),[a]=refs()
  const before=track.keys.map(k=>k.t)
  assert.equal(M.moveTimelineSelection(timeline,[{tr:track.id,k:a.from}],2.5),0)
  assert.deepEqual(track.keys.map(k=>k.t),before)
  assert.equal(M.moveTimelineSelection(timeline,[{tr:track.id,k:a.from},{tr:track.id,k:a.to}],1),2)
})
test('G003-16 · eventos Ripple conserva su orden y el reloj único',()=>{
  const tl=M.newTimeline('Eventos',{duration:15}),tr=M.newTrack('commands')
  tr.keys=[1,3,5].map(t=>M.newKey('commands',t,{list:[{id:'cmd-'+t,code:'weather',p:{preset:'rain'},b:{}}]}))
  tl.tracks=[tr];const target=tr.keys[0].id
  assert.equal(M.editTimelineEvent(tl,tr.id,target,2,'ripple'),true)
  assert.deepEqual(tr.keys.map(k=>k.t),[2,4,6])
  assert.deepEqual(tr.keys[0].list[0].code,'weather')
})
test('G003-17 · eventos Replace reemplaza coincidencia temporal, no evalúa scripts en seek',()=>{
  const tl=M.newTimeline('Eventos',{duration:15}),tr=M.newTrack('method',{node:'node-1'})
  tr.keys=[1,3,5].map(t=>M.newKey('method',t,{method:'method'+t,args:[t]}));tl.tracks=[tr]
  const keep=tr.keys[0].id
  assert.equal(M.editTimelineEvent(tl,tr.id,keep,3,'replace'),true)
  assert.deepEqual(tr.keys.map(k=>k.t),[3,5]);assert.equal(tr.keys[0].id,keep)
  assert.throws(()=>M.editTimelineEvent(tl,tr.id,keep,2,'mix'),/solo admiten/)
})
test('G003-18 · edición con límites inválidos no muta eventos',()=>{
  const tl=M.newTimeline('Eventos',{duration:6}),tr=M.newTrack('audio')
  tr.keys=[1,3,5].map(t=>M.newKey('audio',t,{clip:'a.wav'}));tl.tracks=[tr]
  const old=strip(tr.keys)
  assert.throws(()=>M.editTimelineEvent(tl,tr.id,tr.keys[0].id,4,'ripple'),/excede/)
  assert.deepEqual(tr.keys,old)
})
test('G003-19 · Snap de clips respeta otras claves, cabezal y límites',()=>{
  const {timeline,track,refs}=make(),[a]=refs()
  assert.equal(M.timelineClipSnapTime(timeline,track.id,a.id,2.95,{snap:.1,playhead:3,zoom:70}),3)
  assert.equal(M.timelineClipSnapTime(timeline,track.id,a.id,2.956,{snap:0,playhead:3}),2.956)
  assert.equal(M.timelineClipSnapTime(timeline,track.id,a.id,20,{snap:.1}),14)
})
test('G003-20 · cámara se mezcla en Player, con poses, fov y quaterniones interpolados',()=>{
  const tl=M.newTimeline('Cámara',{duration:12}),tr=M.newTrack('camera',{path:'linear'})
  tr.keys=[M.newKey('camera',0,{pos:[0,0,0],rot:[0,0,0],fov:60,ease:'linear'}),
    M.newKey('camera',2,{pos:[20,0,0],rot:[0,0,0],fov:60,ease:'linear'}),
    M.newKey('camera',4,{pos:[100,0,0],rot:[0,90,0],fov:100,ease:'linear'}),
    M.newKey('camera',6,{pos:[200,0,0],rot:[0,90,0],fov:100,ease:'linear'})]
  tl.tracks=[tr]
  const a=M.addTimelineClip(tl,tr.id,tr.keys[0].id),b=M.addTimelineClip(tl,tr.id,tr.keys[2].id)
  M.editTimelineClip(tl,tr.id,b.id,{start:1,mode:'mix'})
  const c=evaluate.evalTimelineCamera(tr,1.5)
  assert.deepEqual(c.pos,[70,0,0]);assert.equal(c.fov,80)
  assert.ok(c.quat.y>0)
})
test('G003-21 · evaluador original sigue idéntico cuando no hay clips',()=>{
  const {track}=make()
  for(const time of [0,1,2,3,4,7,11]) assert.deepEqual(evaluate.evalTimelineNode(track,time),evaluate.evalNode(track,time))
  const camera=M.newTrack('camera',{path:'linear'})
  camera.keys=[M.newKey('camera',0,{ease:'linear'}),M.newKey('camera',2,{ease:'linear'})]
  for(const time of [0,1,2]) assert.deepEqual(evaluate.evalTimelineCamera(camera,time),evaluate.evalCamera(camera,time))
})
test('G003-22A · al mover un clip no se duplica la animación en el tiempo fuente original',()=>{
  const {timeline,track}=make()
  const source=M.addTimelineClip(timeline,track.id,track.keys[0].id)
  M.editTimelineClip(timeline,track.id,source.id,{start:12,mode:'mix'})
  assert.equal(evaluate.evalTimelineNode(track,.5),undefined)
  assert.equal(evaluate.evalTimelineNode(track,11.5),undefined)
  assert.deepEqual(evaluate.evalTimelineNode(track,13),[10,0,0])
  assert.equal(evaluate.evalTimelineNode(track,14),undefined)
  assert.deepEqual(evaluate.evalNode(track,.5),[5,0,0],'el evaluador heredado permanece intacto')
})
test('G003-22B · cámara con clips no vuelve a ejecutar la fuente antigua fuera del clip',()=>{
  const tl=M.newTimeline('Film',{duration:12}),cam=M.newTrack('camera',{path:'linear'})
  cam.keys=[M.newKey('camera',0,{pos:[0,0,0],rot:[0,0,0],fov:75,ease:'linear'}),M.newKey('camera',2,{pos:[20,0,0],rot:[0,0,0],fov:75,ease:'linear'})]
  tl.tracks=[cam];const clip=M.addTimelineClip(tl,cam.id,cam.keys[0].id)
  M.editTimelineClip(tl,cam.id,clip.id,{start:6,mode:'mix'})
  assert.equal(evaluate.evalTimelineCamera(cam,1),null)
  assert.deepEqual(evaluate.evalTimelineCamera(cam,7).pos,[10,0,0])
  assert.equal(evaluate.evalTimelineCamera(cam,8),null)
  assert.ok(evaluate.evalCamera(cam,1))
})
test('G003-22 · Runner usa el mismo evalTimelineNode/Camera que Preview',()=>{
  assert.match(runtime,/evalTimelineCamera\(tr, this\.time/)
  assert.match(runtime,/evalTimelineNode\(tr, this\.time\)/)
  assert.match(preview,/evalTimelineNode\(track, time\)/)
  assert.match(preview,/evalTimelineCamera\(track, time/)
  assert.match(preview,/track\.clips, ancestors, parentTracks/)
  assert.match(preview,/for \(const clip of clips\) intervals\.push/)
})
test('G003-22C · Player real evalúa mezcla, seek y eventos sin ejecución durante scrubbing',()=>{
  const runnerSource=runtime.replace(/^import .*$/gm,'').replace(/^export /gm,'')
  const TimelineRunner=new Function('evalTimelineNode','evalTimelineCamera','sampleBakeTrack',runnerSource+';return TimelineRunner')
    (evaluate.evalTimelineNode,evaluate.evalTimelineCamera,()=>null)
  const {timeline,track,refs}=make(),[a,b]=refs().slice(0,2)
  M.editTimelineClip(timeline,track.id,b.id,{start:1,mode:'mix'})
  const hits=[],host={node:(id,prop,value)=>hits.push({id,prop,value}),camera:()=>{},commands:()=>{throw Error('seek disparó comando')} }
  const playback=new TimelineRunner(timeline,host)
  playback.seek(1.5)
  assert.deepEqual(hits.at(-1).value,[70,0,0]);assert.equal(hits.at(-1).id,'mesh-01')
  playback.seek(3)
  assert.equal(hits.length,1,'fuentes sin clip activo no reproducen otra animación')
  playback.seek(1.5)
  assert.equal(hits.length,2)
  playback.stop()
})
test('G003-23 · eventos discretos siguen en calendario de Play, no en la previsualización',()=>{
  assert.match(runtime,/\['audio', 'commands', 'method'\]\.includes\(tr\.kind\)/)
  assert.match(preview,/Ninguna clave de audio, comando o método se ejecuta desde la vista previa/)
  assert.doesNotMatch(preview,/host\.commands\(/)
})
test('G003-24 · barra, clips, Inspector y Commit reales están conectados al modo',()=>{
  assert.match(ui,/role="group" aria-label="Modo de edición de clips"/)
  for(const action of ['addTimelineClip','editTimelineClip','deleteTimelineClip','editTimelineEvent','timelineClipSnapTime']) assert.ok(ui.includes(action),action)
  assert.match(ui,/@pointerdown\.stop="clipDragDown\(\$event,row\.track,clip\)"/)
  assert.match(ui,/@contextmenu\.prevent\.stop="clipMenu\(\$event,row\.track,clip\)"/)
  assert.match(ui,/commit\(resize\s*\?\s*'Ajustar duración clip/)
  assert.match(ui,/commit\('Crear clip de Timeline'\)/)
  assert.match(inspector,/part === 'clip'/)
  assert.match(inspector,/editTimelineClip\(resource\.value,track\.value\.id,timelineClip\.value\.id/)
  assert.match(store,/element === 'clip'/)
})
test('G003-25 · se mantiene el timeline anterior sin duplicar UI ni crear manager',()=>{
  for(const path of ['src/filmmaker/NleTimeline.vue','src/core/timeline/preview.js']) assert.ok(file(path).length>100)
  assert.match(ui,/class="pinned-column"/)
  assert.match(ui,/ref="scroller"/)
  assert.match(ui,/v-for="s in motionSpans\(row\.track\)"/)
  assert.match(ui,/@pointerdown\.stop="pickSegment\(row\.track, s\.id, \$event\)"/)
  assert.doesNotMatch(ui,/new UnityTimeline|UnityEditor|new TimelineManager/)
})
test('G003-26 · compilación Vue real se exige durante QA local',async t=>{
  let compiler
  try{compiler=await import('@vue/compiler-sfc')}catch(e){if(e?.code==='ERR_MODULE_NOT_FOUND'){t.skip('Sin dependencias Vue locales: compilar en Electron del usuario');return}throw e}
  for(const component of ['src/components/TimelinePanel.vue','src/components/TemporalResourceInspector.vue']){
    const data=file(component);const parsed=compiler.parse(data,{filename:component})
    assert.deepEqual(parsed.errors,[],component)
    const result=compiler.compileTemplate({source:parsed.descriptor.template.content,filename:component,id:component})
    assert.deepEqual(result.errors,[],component)
  }
})
