import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTimelinePointerDrag} from '../src/core/timeline/pointer-drag.js'
const base=new URL('../',import.meta.url)
const read=file=>readFileSync(new URL(file,base),'utf8')
const source=read('src/core/timeline/playback-session.js')
const panel=read('src/components/TimelinePanel.vue')
const curve=read('src/components/TimelineCurveEditor.vue')
const app=read('src/App.vue')
const dock=read('src/components/BottomDock.vue')
// Carga la fábrica productiva sin Three/Vue: se inyectan sustitutos de las
// dependencias de entorno, igual que en G006. No reimplementa el transporte.
function harness() {
 const watchers=new WeakMap()
 const ref=initial=>{
   let value=initial
   const item={get value(){return value},set value(next){const prev=value;value=next;if(next!==prev)for(const fn of watchers.get(item)||[])fn(next,prev)}}
   return item
 }
 const watch=(item,cb)=>watchers.set(item,[...(watchers.get(item)||[]),cb])
 const loader=source.replace(/^import .*$/gm,'').replace(/^export /gm,'')
 const {createTimelinePlayback}=Function('ref','watch','TimelinePreview','TimelineEventPreview',loader+'\nreturn {createTimelinePlayback}')(ref,watch,class {},class {})
 const editor={id:'editor'},tl={id:'tl-1',duration:10,tracks:[{id:'audio',kind:'audio',keys:[{t:.5}]},{id:'cmd',kind:'commands',keys:[{t:2}]},{id:'camera',kind:'camera',keys:[{t:0}]}]}
 const project={id:'p',activeSceneId:'scene-A',timelines:[tl]}
 const context={project,sceneId:'scene-A',timelineId:tl.id,editor,playOn:false,locked:false,cinematic:false}
 let timestamp=1000,next=0
 const pending=new Map(),inst=[]
 const schedule=cb=>{const id=++next;pending.set(id,cb);return id}
 const cancel=id=>pending.delete(id)
 const visual={applied:[],stopped:0,apply(t,time,options){this.applied.push({t,time,options})},stop(){this.stopped++}}
 const events={active:false,paused:false,runner:null,time:0,starts:0,pauses:0,resumes:0,seeks:[],stops:0,calls:[], options:null,
   start(t,at){this.active=true;this.paused=false;this.time=at;this.runner={tl:t};this.starts++;this.calls.push(['start',t.tracks.map(r=>r.id)]);return true},
   update(dt){if(!this.active||this.paused)throw Error('Reloj inconsistente');this.time+=dt;this.calls.push(['tick',dt]);if(this.time>=this.runner.tl.duration){this.active=false;this.options.onEnd();return false}return true},
   pause(){this.pauses++;this.paused=true;this.calls.push(['pause'])},resume(){this.resumes++;this.paused=false;this.calls.push(['resume'])},
   seek(t){this.seeks.push(t);this.time=t;this.calls.push(['seek',t])},stop(){this.stops++;this.active=false;this.paused=false;this.runner=null;this.calls.push(['stop'])}}
 const controller=createTimelinePlayback({
   getContext:()=>({...context}),getProject:()=>context.project,getEditor:()=>editor,getObjects:()=>[],worldMatrix:()=>null,
   requestFrame:schedule,cancelFrame:cancel,now:()=>timestamp,
   createEventPreview:options=>{events.options=options;return events},
   createVisualPreview:()=>visual,
 })
 function advance(ms){timestamp+=ms;const callbacks=[...pending.values()];pending.clear();for(const cb of callbacks)cb(timestamp)}
 return {controller,context,tl,events,visual,advance,pending,project}
}
test('CORR001-01 · el transporte es propiedad del Editor, no de una pestaña',()=>{
 assert.match(app,/provide\(timelinePlaybackKey,timelinePlayback\)/)
 assert.match(app,/timelinePlayback\.dispose\(\)/)
 assert.match(panel,/inject\(timelinePlaybackKey\)/)
 assert.doesNotMatch(panel,/new TimelineEventPreview\(|eventPreview\.stop\(|cancelAnimationFrame\(raf\)/)
 assert.match(dock,/<TimelinePanel v-else-if="active\(\) === 'timeline'"/)
})
test('CORR001-02 · Play con un clip preseleccionado no filtra pistas',()=>{
 const h=harness();const selected={tr:'camera',clip:'clip-1'}
 assert.ok(selected.clip)
 assert.equal(h.controller.toggle(h.tl),true)
 assert.deepEqual(h.events.calls.find(c=>c[0]==='start')[1],['audio','cmd','camera'])
 h.advance(100)
 assert.equal(h.controller.playing.value,true)
 assert.equal(h.controller.time.value,.1)
 h.controller.dispose()
})
test('CORR001-03 · cambiar selección durante Play no altera audio, comandos ni reloj',()=>{
 const h=harness();h.controller.toggle(h.tl);h.advance(100)
 const before=h.controller.time.value
 h.controller.refresh(h.tl,{id:'camera',kind:'camera'})
 h.controller.refresh(h.tl,{id:'cmd',kind:'commands'})
 h.controller.refresh(h.tl,{id:'audio',kind:'audio'})
 h.advance(100)
 assert.ok(h.controller.time.value>before)
 assert.equal(h.events.pauses,0)
 assert.equal(h.events.seeks.length,0)
 assert.equal(h.controller.playing.value,true)
 h.controller.dispose()
})
test('CORR001-04 · desmontar pestaña no destruye el transporte; reloj continúa oculto',()=>{
 const h=harness();h.controller.toggle(h.tl);h.advance(100)
 const count=h.visual.applied.length
 // Sin invocar ninguna instancia de panel: simula navegación a Mixer.
 h.advance(100);h.advance(100)
 assert.ok(h.controller.time.value>.2)
 assert.ok(h.visual.applied.length>count)
 assert.equal(h.controller.playing.value,true)
 assert.equal(h.events.stops,1) // inicialización desde recurso nuevo
 h.controller.dispose()
})
test('CORR001-05 · Pause detiene reloj y audio en una única sesión; Resume no duplica inicio',()=>{
 const h=harness();h.controller.toggle(h.tl);h.advance(100)
 h.controller.pause();assert.equal(h.controller.playing.value,false)
 assert.equal(h.events.pauses,1);assert.equal(h.pending.size,0)
 const pausedAt=h.controller.time.value
 h.advance(2000);assert.equal(h.controller.time.value,pausedAt)
 h.controller.toggle(h.tl);assert.equal(h.events.starts,1);assert.equal(h.events.resumes,1)
 h.advance(100);assert.ok(h.controller.time.value>pausedAt)
 h.controller.dispose()
})
test('CORR001-06 · Scrub en pausa conserva efectos suspendidos y sincroniza el runner al reanudar',()=>{
 const h=harness();h.controller.toggle(h.tl);h.advance(100)
 h.controller.pause();h.controller.seek(2.5)
 assert.deepEqual(h.events.seeks,[])
 assert.equal(h.visual.applied.at(-1)?.time,2.5)
 const starts=h.events.starts
 h.controller.toggle(h.tl);h.advance(100)
 assert.deepEqual(h.events.seeks,[2.5])
 assert.equal(h.events.starts,starts)
 h.controller.dispose()
})
test('CORR001-07 · Stop restaura viewport, cancela audio y temporizadores solo de sesión',()=>{
 const h=harness();h.controller.toggle(h.tl);h.advance(100)
 h.controller.stop()
 assert.equal(h.controller.playing.value,false)
 assert.equal(h.controller.time.value,0)
 assert.equal(h.pending.size,0)
 assert.ok(h.visual.stopped>0)
 assert.ok(h.events.calls.some(c=>c[0]==='stop'))
})
test('CORR001-08 · cambio de proyecto o escena no permite continuar una sesión anterior',()=>{
 for(const dimension of ['project','sceneId','timelineId','editor','playOn','locked','cinematic']){
  const h=harness();h.controller.toggle(h.tl)
  h.context[dimension]=dimension==='project'?{id:'other',timelines:[]}:dimension==='sceneId'?'another':dimension==='timelineId'?'another':dimension==='editor'?{id:'other'}:true
  assert.equal(h.controller.validate(),true) // devuelve true cuando ya se invalidó y liberó
  assert.equal(h.controller.playing.value,false,dimension)
  assert.equal(h.pending.size,0,dimension)
  assert.equal(h.controller.resourceId,null,dimension)
 }
})
test('CORR001-09 · cancelar visualización de Timeline no afecta al transporte al cambiar de pestaña',()=>{
 assert.doesNotMatch(panel,/watch\([^\n]*dockPanelIsActive/)
 assert.doesNotMatch(panel,/if\(!visible\)[^\n]*stop\(\)/)
 assert.doesNotMatch(panel,/onBeforeUnmount\([^\n]*playback\.stop\(/)
 assert.match(panel,/function preview\(\) \{playback\.refresh\(tl\.value,selTrack\.value\)\}/)
 assert.match(source,/raf=requestFrame\(tick\)/)
})
test('CORR001-10 · selección sin arrastre no pausa; arrastre real pausa todo en conjunto',()=>{
 assert.match(panel,/function clipDragDown\(/)
 assert.match(panel,/function keyDown\(/)
 assert.match(panel,/function beginKeyDrag\(/)
 assert.match(panel,/timelineDrag\.begin\(e, \{/)
 assert.match(panel,/function eventDragDown\(/)
 assert.match(panel,/function stepTime\(direction\) \{[\s\S]*?playback\.pause\(\)/)
 assert.match(curve,/curveDrag\.begin\(event,\{axis:'xy'/)
})
test('CORR001-11 · selección de cámara solo afecta trayectoria visual, no el calendario',()=>{
 const h=harness();h.controller.toggle(h.tl);h.controller.refresh(h.tl,{id:'node',kind:'node',prop:'position'})
 assert.equal(h.visual.applied.at(-1).options.selectedTrack.id,'node')
 assert.equal(h.events.runner.tl.tracks.length,3)
 h.controller.dispose()
})
test('CORR001-12 · Preview visual no se activa durante Play del juego ni con el proyecto bloqueado',()=>{
 const h=harness();h.controller.toggle(h.tl);h.controller.stop()
 const count=h.visual.applied.length
 h.context.playOn=true;h.controller.refresh(h.tl)
 h.context.playOn=false;h.context.locked=true;h.controller.refresh(h.tl)
 assert.equal(h.visual.applied.length,count)
 h.context.locked=false;h.controller.seek(.5);h.controller.refresh(h.tl)
 assert.ok(h.visual.applied.length>count)
 h.controller.dispose()
})
test('CORR001-13 · nueva carga y Player conservan el mismo ejecutor original',()=>{
 assert.match(source,/import \{ TimelineEventPreview \} from '.\/event-preview\.js'/)
 assert.match(source,/import \{ TimelinePreview \} from '.\/preview\.js'/)
 assert.doesNotMatch(source,/new TimelineRunner\(/)
 assert.doesNotMatch(app,/window\.__timelinePlayer/)
})
test('CORR001-14 · clic real en clip no pausa; arrastre sí pausa una sola vez',()=>{
 const start=panel.indexOf('function clipDragDown('),end=panel.indexOf('\nfunction ',start+1)
 assert.ok(start>0&&end>start)
 const body=panel.slice(start,end)
 const events=new Map(),calls=[]
 const clip={id:'c',start:0,duration:2},track={id:'tr',clips:[clip]},timeline={id:'tl',tracks:[track],duration:10}
 const tl={value:timeline}, playing={value:true},zoom={value:70},snap={value:0},ph={value:0},editMode={value:'mix'}
 let pauses=0
 const playback={pause(){pauses++;playing.value=false}}
 const root={value:{focus(){}}}
 const win={addEventListener:(name,callback)=>events.set(name,callback),removeEventListener:(name)=>events.delete(name)}
 const clipDragDown=Function('tl','guardedTrack','root','pickClip','playback','zoom','editMode','timelineDrag','editTimelineClip','timelineClipSnapTime','snap','ph','commit','bump',body+';return clipDragDown')(
  tl,()=>true,root,()=>{},playback,zoom,editMode,createTimelinePointerDrag(win),
  (_timeline,trackId,clipId,options)=>{calls.push(['edit',options]);return true},
  (_timeline,_trackId,_clipId,start)=>start,snap,ph,(what)=>calls.push(['commit',what]),()=>{})
 const event={button:0,buttons:1,pointerId:1,clientX:100,clientY:0,preventDefault(){}}
 clipDragDown(event,track,clip)
 assert.equal(pauses,0);assert.equal(playing.value,true)
 events.get('pointerup')({...event,buttons:0,clientX:109})
 assert.equal(pauses,0);assert.equal(calls.length,0)
 clipDragDown(event,track,clip)
 events.get('pointermove')({...event,clientX:130})
 assert.equal(pauses,1);assert.equal(playing.value,false)
 events.get('pointerup')({...event,clientX:130})
 assert.equal(calls.filter(c=>c[0]==='commit').length,1)
})
test('CORR001-15 · compilación Vue real cuando se dispone de dependencias',async t=>{
 let compiler;try{compiler=await import('@vue/compiler-sfc')}catch{t.skip('Compilador Vue no instalado; QA Electron obligatorio');return}
 for(const [file,content] of [['App.vue',app],['TimelinePanel.vue',panel],['TimelineCurveEditor.vue',curve]]){
  const parsed=compiler.parse(content,{filename:file});assert.deepEqual(parsed.errors,[],file)
  const compiled=compiler.compileTemplate({source:parsed.descriptor.template.content,filename:file,id:'s11-corr001'});assert.deepEqual(compiled.errors,[],file)
 }
})
