// S10-G006: contratos integrados de Editor, persistencia y Player desde fuentes reales.
// Este test no sustituye el QA visual de Electron ni la exportación ejecutada.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import {
  newTimeline, newTrack, newKey, normalizeTimeline, addTimelineGroup, addTimelineMarker,
  moveTimelineTrack, addTimelineClip, editTimelineClip
} from '../src/core/timeline/model.js'
import { editTimelineCurveTangent } from '../src/core/timeline/curves.js'

const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8')
const sourcePlayer = read('src/engine/runtime/timeline/player.js')
const sourceEval = read('src/engine/runtime/timeline/eval.js')
const sourcePreview = read('src/core/timeline/preview.js')
const sourceProject = read('src/core/project.js')
const sourceState = read('src/core/state/timelines.js')
const sourceInspector = read('src/components/TemporalResourceInspector.vue')
const sourcePanel = read('src/components/TimelinePanel.vue')

// Solo para el harness de Node sin Three: NO reemplaza el evaluador de producción en el proyecto.
function createRunner({camera=null,node=null,bake=null}={}) {
  const code = sourcePlayer.replace(/^import .*\n/gm,'').replace('export class TimelineRunner','class TimelineRunner')
  const ctx = vm.createContext({Promise,Set,Map, console,
    evalTimelineCamera:camera || (()=>null), evalTimelineNode:node || (()=>undefined), sampleBakeTrack:bake || (()=>null)})
  vm.runInContext(code+'\nglobalThis.TimelineRunner = TimelineRunner',ctx,{filename:'src/engine/runtime/timeline/player.js'})
  return ctx.TimelineRunner
}
function cameraTracks() {
  const early=newTrack('camera',{name:'Primera'}), late=newTrack('camera',{name:'Segunda'})
  early.keys=[newKey('camera',0,{mode:'free',pos:[1,0,0]})]
  late.keys=[newKey('camera',4,{mode:'free',pos:[2,0,0]})]
  return newTimeline('QA·Cámaras',{duration:8,tracks:[early,late]})
}
const fakeCamera=(track,time)=>track.keys?.[0] && time>=track.keys[0].t ? {source:track.id, pos:track.keys[0].pos, fov:70} : null

// Evidencia 1: coincidir con Preview (última cámara con pose válida) en lugar de sobrescribir con null.
test('G006-01 · cámara válida persiste si una segunda pista no ha empezado',()=>{
  const tl=cameraTracks(), calls=[]
  const runner=new (createRunner({camera:fakeCamera}))(tl,{camera:p=>calls.push(p)})
  runner.update(1)
  assert.equal(calls.length,1,'la cámara se decide una sola vez por fotograma')
  assert.equal(calls.at(-1)?.source,tl.tracks[0].id)
})
test('G006-02 · segunda cámara toma prioridad al empezar; mute y seek restauran prioridad',()=>{
  const tl=cameraTracks(), calls=[]
  const runner=new (createRunner({camera:fakeCamera}))(tl,{camera:p=>calls.push(p)})
  runner.update(1);runner.seek(5)
  assert.equal(calls.at(-1)?.source,tl.tracks[1].id)
  tl.tracks[1].muted=true;runner.seek(6)
  assert.equal(calls.at(-1)?.source,tl.tracks[0].id)
  tl.tracks[0].muted=true;runner.seek(2)
  assert.equal(calls.at(-1),null,'sin cámara activa el Player devuelve control a la cámara principal')
})
test('G006-03 · orden editorial y grupos no cambian la prioridad runtime',()=>{
  const tl=cameraTracks(),g=addTimelineGroup(tl,'Montaje'),original=tl.tracks.map(x=>x.id)
  moveTimelineTrack(tl,tl.tracks[1].id,{groupId:g.id})
  const out=[];new (createRunner({camera:fakeCamera}))(tl,{camera:p=>out.push(p)}).update(5)
  assert.equal(out[0]?.source,original[1]);assert.deepEqual(tl.tracks.map(x=>x.id),original)
})
test('G006-04 · una clave con mismo ID en otra pista NO suprime el otro evento',()=>{
  const a=newTrack('audio'), b=newTrack('commands')
  a.keys=[newKey('audio',.25,{id:'reused-key',clip:'rain.ogg'})]
  b.keys=[newKey('commands',.25,{id:'reused-key',list:[{code:'visible'}]})]
  const tl=normalizeTimeline(newTimeline('QA·Eventos',{duration:2,tracks:[a,b]})),calls=[]
  const runner=new (createRunner())(tl,{audio:k=>calls.push('audio:'+k.clip),commands:()=>calls.push('command')})
  runner.update(0.5)
  assert.deepEqual(calls,['audio:rain.ogg','command'])
})
test('G006-05 · el avance parcial no redispara, seek retrocede únicamente lo esperado',()=>{
  const a=newTrack('commands'),b=newTrack('method',{node:'node1'})
  a.keys=[newKey('commands',0.5,{id:'same',list:[{code:'a'}]})]
  b.keys=[newKey('method',1,{id:'same',method:'ping'})]
  const calls=[],r=new (createRunner())(normalizeTimeline(newTimeline('Events',{duration:2,tracks:[a,b]})),{
    commands:()=>calls.push('a'),method:()=>calls.push('b')})
  r.update(.6);r.update(.5);r.update(.5)
  assert.deepEqual(calls,['a','b'])
  r.seek(.75);r.update(.35)
  assert.deepEqual(calls,['a','b','b'])
})
test('G006-06 · el bucle reinicia los eventos por identidad de pista+clave',()=>{
  const a=newTrack('audio'),b=newTrack('commands');a.keys=[newKey('audio',.1,{id:'same'})];b.keys=[newKey('commands',.2,{id:'same',list:[{code:'a'}]})]
  const calls=[],tl=normalizeTimeline(newTimeline('Loop',{duration:1,loop:true,tracks:[a,b]}))
  const r=new (createRunner())(tl,{audio:()=>calls.push('audio'),commands:()=>calls.push('command')})
  r.update(.8);r.update(.3);r.update(.8)
  assert.deepEqual(calls,['audio','command','audio','command'])
})
test('G006-07 · la carga/guardado JSON conserva grupos, clips, marcadores y tangentes',()=>{
  const tr=newTrack('node',{name:'Actor',node:'node-123',byId:true,interpolation:'cubic'})
  tr.keys=[newKey('node',0,{v:[0,0,0]}),newKey('node',2,{v:[10,0,0]}),newKey('node',4,{v:[20,0,0]})]
  const tl=newTimeline('QA·Persistencia',{duration:9,tracks:[tr]})
  const group=addTimelineGroup(tl,'Animaciones');moveTimelineTrack(tl,tr.id,{groupId:group.id});group.collapsed=true
  const marker=addTimelineMarker(tl,3,'Cambio');tr.locked=false
  const clip=addTimelineClip(tl,tr.id,tr.keys[0].id)
  editTimelineCurveTangent(tr,tr.keys[0].id,'v0','out',15)
  tr.locked=true
  const original=normalizeTimeline(tl)
  const loaded=normalizeTimeline(JSON.parse(JSON.stringify(original)))
  assert.deepEqual(loaded,original)
  assert.equal(loaded.groups[0].collapsed,true)
  assert.equal(loaded.tracks[0].locked,true)
  assert.equal(loaded.tracks[0].clips[0].from,clip.from)
  assert.equal(loaded.tracks[0].keys[0].tanOut[0],15)
  assert.equal(loaded.markers[0].id,marker.id)
})
test('G006-08 · un recurso anterior sin grupos ni marcadores continúa siendo compatible',()=>{
  const legacy={id:'old-tl',name:'Antigua',duration:4,tracks:[{id:'old-tr',kind:'node',name:'Pos',node:'node',prop:'position',keys:[{id:'old-k',t:1,v:[1,2,3]}]}]}
  const normalized=normalizeTimeline(legacy)
  assert.deepEqual(normalized.groups,[]);assert.deepEqual(normalized.markers,[])
  assert.equal(normalized.tracks[0].locked,false)
  assert.equal(normalized.tracks[0].keys[0].id,'old-k')
  assert.equal(legacy.groups,undefined,'normalizar no muta el proyecto de origen')
})
test('G006-09 · clips sobreviven a guardado y cumplen referencia de fuente y duración',()=>{
  const tr=newTrack('node',{node:'actor',byId:true,prop:'position',interpolation:'linear'})
  tr.keys=[newKey('node',0,{v:[0,0,0]}),newKey('node',2,{v:[10,0,0]}),newKey('node',4,{v:[20,0,0]})]
  const tl=newTimeline('Edición',{duration:10,tracks:[tr]})
  const clip=addTimelineClip(tl,tr.id,tr.keys[0].id)
  editTimelineClip(tl,tr.id,clip.id,{start:4,duration:1.5,mode:'mix'})
  const reloaded=normalizeTimeline(JSON.parse(JSON.stringify(tl)))
  const loadedClip=reloaded.tracks[0].clips.find(c=>c.id===clip.id)
  assert.equal(loadedClip.start,4);assert.equal(loadedClip.duration,1.5)
  assert.ok(reloaded.tracks[0].keys.some(k=>k.id===loadedClip.from))
  assert.ok(reloaded.tracks[0].keys.some(k=>k.id===loadedClip.to))
})
test('G006-10 · no se introducen comandos continuos ni segunda colección runtime',()=>{
  assert.match(sourceProject,/meta\.timelines = normalizeTimelines\(meta\.timelines\)/)
  assert.match(sourceState,/normalizeTimeline\(JSON\.parse\(JSON\.stringify\(src\)\)\)/)
  assert.match(sourcePanel,/timelineTrackEditable|guardedTrack/)
  assert.match(sourcePreview,/evalTimelineCamera\(/)
  assert.match(sourcePreview,/evalTimelineNode\(/)
  assert.match(sourcePlayer,/evalTimelineCamera\(/)
  assert.match(sourcePlayer,/evalTimelineNode\(/)
  assert.doesNotMatch(sourcePlayer,/setTimeout|requestAnimationFrame|new TimelineManager/)
})
test('G006-11 · operaciones del Inspector conservan rutas compartidas de duración y curvas',()=>{
  assert.match(sourceInspector,/keyParams\(track\.value\)/)
  assert.match(sourceInspector,/timelineMinDuration\(resource\.value\)/)
  assert.match(sourcePanel,/<TimelineCurveEditor/)
  assert.match(sourcePanel,/commit\('Redimensionar duración del Timeline'\)/)
})
test('G006-12 · errores de clips y grupos inválidos bloquean en vez de reparar silenciosamente',()=>{
  const tl=newTimeline('Corrupto'),tr=newTrack('node',{prop:'position'})
  tr.keys=[newKey('node',0,{v:[0,0,0]}),newKey('node',2,{v:[2,0,0]})];tl.tracks.push(tr)
  const clip=addTimelineClip(tl,tr.id,tr.keys[0].id)
  clip.to='missing'
  assert.throws(()=>normalizeTimeline(tl),/inválidos|referencia/)
  delete tr.clips;tr.groupId='inexistente'
  assert.throws(()=>normalizeTimeline(tl),/grupo inexistente/)
})
// Evalúa muestras reales desde el mismo archivo de producción, sin importar Three en el host de QA.
function numericEvaluator() {
  const scriptEase=read('src/engine/runtime/anim/eval.js').replace(/^import .*\n/gm,'').replace(/\bexport /g,'')
  const scriptTimeline=sourceEval.replace(/^import .*\n/gm,'').replace(/\bexport /g,'')
  const fakeThree={Euler:class {set(){return this} setFromQuaternion(){return this}}, Quaternion:class {setFromEuler(){return this} clone(){return new fakeThree.Quaternion()} slerp(){return this}}}
  const ctx=vm.createContext({THREE:fakeThree,PROPS:{},Math,Set,Map,console})
  vm.runInContext(scriptEase+'\nconst animationEase = easeValue;\n'+scriptTimeline+'\nglobalThis.evalTimelineNode = evalTimelineNode',ctx)
  return ctx.evalTimelineNode
}
test('G006-13 · Preview y Runner usan la misma curva numérica y fuente G003',()=>{
  const evaluator=numericEvaluator(), node=newTrack('node',{prop:'position',node:'mesh',byId:true,interpolation:'cubic'})
  node.keys=[newKey('node',0,{v:[0,0,0]}),newKey('node',2,{v:[10,1,0]}),newKey('node',4,{v:[20,5,0]})]
  const tl=newTimeline('Shared evaluator',{duration:9,tracks:[node]})
  const clip=addTimelineClip(tl,node.id,node.keys[0].id)
  editTimelineClip(tl,node.id,clip.id,{start:4,duration:1.5})
  editTimelineCurveTangent(node,node.keys[0].id,'v0','out',18)
  const Runner=createRunner({node:evaluator}), samples=[]
  const r=new Runner(tl,{node:(id,prop,value)=>samples.push({t:r.time,v:JSON.parse(JSON.stringify(value))})})
  for(const t of [4,4.2,4.8,5.4,7]) r.seek(t)
  for(const result of samples) assert.deepEqual(result.v,JSON.parse(JSON.stringify(evaluator(node,result.t))))
  assert.equal(samples.length,4,'no se aplica pista de nodo fuera del clip')
  assert.match(sourcePreview,/evalTimelineNode\(track, time\)/)
})
test('G006-14 · interpolación angular y tangentes se conservan tras normalización',()=>{
  const evaluator=numericEvaluator(), track=newTrack('node',{node:'actor',byId:true,prop:'rotation',interpolation:'cubic-angle'})
  track.keys=[newKey('node',0,{v:[350,0,0]}),newKey('node',2,{v:[10,0,0]})]
  const tl=newTimeline('Angular',{duration:3,tracks:[track]})
  editTimelineCurveTangent(track,track.keys[0].id,'v0','out',9)
  const a=evaluator(track,1)[0], b=evaluator(normalizeTimeline(JSON.parse(JSON.stringify(tl))).tracks[0],1)[0]
  assert.equal(a,b);assert.ok(a>345&&a<375,`La rotación debe cruzar 360° sin salto: ${a}`)
})
// Microbenchmark sin umbral de FPS: informa coste de Node, no acredita N5030/4GB.
test('G006-15 · benchmark de normalización y muestreo deja medidas, no PASS de FPS',()=>{
  const timeline=newTimeline('Carga',{duration:80})
  for(let i=0;i<24;i++){
    const tr=newTrack('node',{node:'node-'+i,byId:true,prop:'position',interpolation:'cubic'})
    tr.keys=Array.from({length:80},(_,j)=>newKey('node',j,{v:[j,j+i,j-i]}))
    timeline.tracks.push(tr)
  }
  const before=performance.now(),normalized=normalizeTimeline(timeline),elapsed=performance.now()-before
  assert.equal(normalized.tracks.length,24)
  assert.equal(normalized.tracks.reduce((n,t)=>n+t.keys.length,0),1920)
  console.log(`G006-PERF Node benchmark: 24 tracks × 80 keys, normalize=${elapsed.toFixed(3)}ms; no es FPS de Electron/Player`)
})
test('G006-16 · compilación Vue real solo si existe el compilador de producción',async t=>{
  let vue
  try {vue=await import('@vue/compiler-sfc')}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND'){t.skip('Compiler Vue no instalado; Electron local requerido');return}throw e}
  for(const file of ['TimelinePanel.vue','TimelineCurveEditor.vue','TemporalResourceInspector.vue']){
    const src=read('src/components/'+file)
    const parsed=vue.parse(src,{filename:file})
    assert.deepEqual(parsed.errors,[],file)
    const compiled=vue.compileTemplate({source:parsed.descriptor.template.content,filename:file,id:'lf-g006'})
    assert.deepEqual(compiled.errors,[],file)
  }
})
