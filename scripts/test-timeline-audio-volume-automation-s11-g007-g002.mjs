import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeVolumeAutomation, volumeAutomationAt, scheduleVolumeAutomation, MAX_VOLUME_POINTS } from '../src/engine/runtime/audio/automation.js'
import { editTimelineAudioVolumePoint, newKey, newTrack, newTimeline, normalizeTimeline, resizeTimelineAudioKey, duplicateTimelineSelection } from '../src/core/timeline/model.js'
import { AudioEngine } from '../src/engine/runtime/audio/engine.js'
import { normalizeAudio } from '../src/engine/runtime/audio/config.js'
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
// El Runner no necesita Three.js para su contrato temporal en Node aislado.
const TimelineRunner = Function('evalTimelineCamera','evalTimelineNode','sampleBakeTrack',
  read('src/engine/runtime/timeline/player.js').replace(/^import .*\n/gm,'').replace('export class TimelineRunner','class TimelineRunner') + ';return TimelineRunner',
)(()=>null,()=>undefined,()=>null)
const points = [{id:'p0',t:0,value:.4},{id:'p1',t:1,value:.8},{id:'p2',t:3,value:.2}]
function fixture(extra={}) {
  const key=newKey('audio',2,{id:'audio-key',clip:'sample.wav',duration:4,volume:.8,fadeIn:.3,fadeOut:.5,volumeAutomation:structuredClone(points),...extra})
  const track=newTrack('audio',{id:'audio-track',keys:[key]})
  const timeline=newTimeline('QA',{id:'timeline',duration:12,tracks:[track]})
  return {key,track,timeline,edit:(action,patch)=>editTimelineAudioVolumePoint(timeline,track.id,key.id,action,patch)}
}
class Param {
  constructor(v=1){this.value=v;this.events=[]}
  cancelScheduledValues(t){this.events.push(['cancel',t])}
  setTargetAtTime(v,t){this.value=v;this.events.push(['target',v,t])}
  setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t])}
  linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t])}
}
class Node {constructor(){this.connections=[]}connect(node){this.connections.push(node);return node}disconnect(){this.connections=[]}}
class Gain extends Node {constructor(){super();this.gain=new Param()}}
class Filter extends Node {constructor(){super();this.frequency=new Param();this.Q=new Param();this.gain=new Param()}}
class Source extends Node {constructor(){super();this.playbackRate=new Param()}start(){}stop(){}}
class Context {
  constructor(){this.currentTime=0;this.sampleRate=8000}
  createGain(){return new Gain()}createBiquadFilter(){return new Filter()}
  createAnalyser(){const n=new Node();n.getFloatTimeDomainData=()=>{};return n}
  createBufferSource(){return new Source()}createConvolver(){const n=new Node();n.buffer=null;return n}
  createDelay(){const n=new Node();n.delayTime=new Param();return n}
  createWaveShaper(){return new Node()}createDynamicsCompressor(){const n=new Node();for(const k of ['threshold','ratio','knee','attack','release'])n[k]=new Param();return n}
}
function engine(){const e=new AudioEngine();e.ctx=new Context();e.configure(normalizeAudio({}));return e}
const approx=(a,b)=>Math.abs(a-b)<1e-5

// Modelo y compatibilidad

test('AUTO-01 · claves históricas no reciben puntos al normalizar',()=>{
  const a=fixture();delete a.key.volumeAutomation
  const b=normalizeTimeline(a.timeline).tracks[0].keys[0]
  assert.equal(Object.hasOwn(b,'volumeAutomation'),false)
})
test('AUTO-02 · punto al inicio define factor inicial',()=>{assert.equal(volumeAutomationAt(points,0),.4)})
test('AUTO-03 · puntos interpolan linealmente entre sí',()=>{assert.ok(approx(volumeAutomationAt(points,2),.5))})
test('AUTO-04 · el último punto conserva su volumen al final',()=>{assert.equal(volumeAutomationAt(points,4),.2)})
test('AUTO-05 · antes del primer punto se interpola desde ganancia unitaria',()=>{
  assert.ok(approx(volumeAutomationAt([{id:'later',t:2,value:0}],1),.5))
})
test('AUTO-06 · sin puntos la ganancia sigue intacta',()=>{assert.equal(volumeAutomationAt([],3),1)})
test('AUTO-07 · normalización ordena, conserva IDs y no añade puntos extra',()=>{
  const b=normalizeTimeline(fixture({volumeAutomation:[points[2],points[0],points[1]]}).timeline)
  assert.deepEqual(b.tracks[0].keys[0].volumeAutomation,points)
})
test('AUTO-08 · datos inválidos, repetidos o externos a duración no se admiten',()=>{
  assert.deepEqual(normalizeVolumeAutomation([
    {id:'ok',t:1,value:.4},{id:'duplicate',t:1,value:.2},{id:'negative',t:-1,value:1},
    {id:'bad-factor',t:2,value:2},{id:'bad-nan',t:3,value:NaN},{id:'ok',t:4,value:.4},
    {id:'out',t:5,value:.3}
  ],4),[{id:'ok',t:1,value:.4}])
})
test('AUTO-09 · sin duración explícita la automatización no se serializa',()=>{
  assert.equal(Object.hasOwn(normalizeTimeline(fixture({duration:0}).timeline).tracks[0].keys[0],'volumeAutomation'),false)
})
test('AUTO-10 · cantidad máxima acotada a 64 puntos',()=>{
  assert.equal(MAX_VOLUME_POINTS,64)
  assert.equal(normalizeVolumeAutomation(Array.from({length:100},(_,i)=>({id:'v'+i,t:i/100,value:.5})),4).length,64)
})
test('AUTO-11 · añadir un punto modifica solo la clave autorizada',()=>{
  const a=fixture(), before={...a.key};delete a.key.volumeAutomation
  assert.equal(a.edit('add',{id:'added',t:2,value:.3}),true)
  assert.deepEqual(a.key.volumeAutomation,[{id:'added',t:2,value:.3,name:'Punto-1',createdOrder:1}])
  for(const field of ['t','duration','clip','volume','fadeIn','fadeOut','fx','pitch','offset','group','loop'])assert.deepEqual(a.key[field],before[field])
})
test('AUTO-12 · mover punto no duplica ni crea otras claves',()=>{
  const a=fixture()
  assert.equal(a.edit('move',{id:'p1',t:1.4,value:.25,createdOrder:2}),true)
  assert.deepEqual(a.key.volumeAutomation.map(p=>p.id),['p0','p1','p2'])
  assert.deepEqual(a.key.volumeAutomation[1],{id:'p1',t:1.4,value:.25,createdOrder:2})
  assert.equal(a.track.keys.length,1)
})
test('AUTO-13 · eliminar último punto elimina propiedad opcional',()=>{
  const a=fixture({volumeAutomation:[points[0]]});assert.equal(a.edit('remove',{id:'p0'}),true)
  assert.equal(Object.hasOwn(a.key,'volumeAutomation'),false)
})
test('AUTO-14 · clave Stop y pista bloqueada impiden edición',()=>{
  const a=fixture();a.track.locked=true
  assert.equal(a.edit('add',{id:'x',t:2,value:.2}),false)
  a.track.locked=false;a.key.action='stop'
  assert.equal(a.edit('add',{id:'x',t:2,value:.2}),false)
})
test('AUTO-15 · duración cero y puntos fuera del tramo no permiten edición',()=>{
  const a=fixture({duration:0});assert.equal(a.edit('add',{id:'x',t:0,value:.8}),false)
  a.key.duration=4
  assert.equal(a.edit('add',{id:'x',t:4.1,value:.8}),false)
  assert.equal(a.edit('add',{id:'x',t:2,value:1.01}),false)
  assert.equal(a.edit('add',{id:'x',t:-1,value:.8}),false)
})
test('AUTO-16 · tiempos repetidos y IDs duplicados se rechazan',()=>{
  const a=fixture()
  assert.equal(a.edit('add',{id:'p0',t:2,value:.4}),false)
  assert.equal(a.edit('add',{id:'new',t:1,value:.4}),false)
  assert.equal(a.edit('move',{id:'p1',t:3,value:.4}),false)
})
test('AUTO-17 · recortar audio no elimina puntos fuera del nuevo final',()=>{
  const a=fixture()
  assert.equal(resizeTimelineAudioKey(a.timeline,a.track.id,a.key.id,2),false)
  assert.equal(a.key.duration,4)
  assert.equal(resizeTimelineAudioKey(a.timeline,a.track.id,a.key.id,3.5),true)
  assert.equal(a.key.volumeAutomation.length,3)
})
test('AUTO-18 · deshacer/reabrir conserva IDs, tiempos y factores',()=>{
  const a=fixture();a.edit('move',{id:'p1',t:1.5,value:.63})
  const clone=normalizeTimeline(JSON.parse(JSON.stringify(a.timeline)))
  assert.deepEqual(clone.tracks[0].keys[0].volumeAutomation,a.key.volumeAutomation)
})
test('AUTO-19 · duplicar clave separa los objetos de puntos',()=>{
  const a=fixture();const refs=duplicateTimelineSelection(a.timeline,[{tr:a.track.id,k:a.key.id}],1)
  assert.equal(refs.length,1);const copy=a.track.keys.find(k=>k.id===refs[0].k)
  assert.deepEqual(copy.volumeAutomation,a.key.volumeAutomation)
  assert.notStrictEqual(copy.volumeAutomation,a.key.volumeAutomation)
  assert.notStrictEqual(copy.volumeAutomation[0],a.key.volumeAutomation[0])
})
// AudioEngine y scheduling real con nodos WebAudio falsos solo en Node.
test('AUTO-20 · rampa de automatización comienza al valor interpolado y respeta los tiempos',()=>{
  const p=new Param(), t=5
  scheduleVolumeAutomation(p,t,points,1.5)
  assert.deepEqual(p.events,[['cancel',5],['set',.65,5],['ramp',.2,6.5]])
})
test('AUTO-21 · seek avanzado no reprocesa puntos anteriores',()=>{
  const p=new Param();scheduleVolumeAutomation(p,10,points,2,2)
  assert.deepEqual(p.events,[['cancel',10],['set',.5,10],['ramp',.2,10.5]])
})
test('AUTO-22 · sin puntos no se crean ni cancelan automatizaciones',()=>{
  const p=new Param();scheduleVolumeAutomation(p,0,[],0);assert.deepEqual(p.events,[])
})
test('AUTO-23 · voz automatizada tiene etapa independiente y no modifica el bus',()=>{
  const e=engine(),v=e._voice({duration:12},{group:'sfx',mode:'ui',volume:.8,volumeAutomation:points})
  assert.equal(v.src.connections[0],v.automationGain)
  assert.equal(v.automationGain.connections[0],v.gain)
  assert.equal(v.gain.gain.value,.8)
  assert.ok(v.automationGain.gain.events.some(event=>event[0]==='ramp'))
  v.stop()
})
test('AUTO-24 · voces históricas continúan conectando directo al fader',()=>{
  const e=engine(),v=e._voice({duration:12},{group:'sfx',mode:'ui',volume:.8})
  assert.equal(v.automationGain,null);assert.equal(v.src.connections[0],v.gain);v.stop()
})
test('AUTO-25 · ramp Fade In/Stop se programa en fader separado',()=>{
  const e=engine(),v=e._voice({duration:12},{group:'sfx',mode:'ui',volume:0,volumeAutomation:points})
  const old=v.automationGain.gain.events.length
  v.ramp(.8,.5,0)
  assert.equal(v.automationGain.gain.events.length,old)
  assert.ok(v.gain.gain.events.some(event=>event[0]==='ramp'))
  v.stop(.1)
  assert.equal(v.automationGain.gain.events.at(-1)[0],'cancel')
})
test('AUTO-26 · pausa y reanudación reprograman la curva desde la posición correcta',()=>{
  const e=engine(),v=e._voice({duration:12},{group:'sfx',mode:'ui',volume:.8,volumeAutomation:points})
  e.ctx.currentTime=.5;v.pause();assert.equal(v.automationElapsed,.5)
  const before=v.automationGain.gain.events.length
  e.ctx.currentTime=1;v.resume()
  assert.equal(v.paused,false)
  assert.ok(v.automationGain.gain.events.slice(before).some(ev=>ev[0]==='set'&&approx(ev[1],.6)))
  v.stop()
})
test('AUTO-27 · dos voces automatizadas no comparten el nodo de ganancia',()=>{
  const e=engine(),a=e._voice({duration:12},{group:'sfx',mode:'ui',volume:1,volumeAutomation:points}),b=e._voice({duration:12},{group:'sfx',mode:'ui',volume:1,volumeAutomation:points})
  assert.notEqual(a.automationGain,b.automationGain);assert.notEqual(a.gain,b.gain)
  a.stop();b.stop()
})
test('AUTO-28 · cambio de velocidad reprograma la automatización sin tocar el fader',()=>{
  const e=engine(),v=e._voice({duration:12},{group:'sfx',mode:'ui',volume:.9,volumeAutomation:points})
  const before=v.gain.gain.events.length
  e.ctx.currentTime=2;v.setAutomationPosition(2,2)
  assert.equal(v.automationRate,2)
  assert.equal(v.gain.gain.events.length,before)
  assert.ok(v.automationGain.gain.events.some(event=>event[0]==='ramp'&&event[2]===2.5))
  v.stop()
})
// Runner envía hooks sin modificar comportamiento sin handlers.
test('AUTO-29 · TimelineRunner notifica pausas, seek y stop solo si el host lo implementa',()=>{
  const calls=[],tl=fixture().timeline
  const r=new TimelineRunner(tl,{audio:(key,owner)=>calls.push(['audio',key.id,owner===r]),audioPause:()=>calls.push('pause'),audioResume:()=>calls.push('resume'),audioSeek:()=>calls.push('seek'),audioStop:()=>calls.push('stop')})
  r.update(2);r.pause();r.resume();r.seek(2.5);r.stop()
  assert.deepEqual(calls,[['audio','audio-key',true],'pause','resume','seek','stop'])
})
test('AUTO-30 · montaje e Inspector reutilizan la misma clave/ID y los controles de teclado',()=>{
  const panel=read('src/components/TimelinePanel.vue'), inspector=read('src/components/TemporalResourceInspector.vue')
  assert.match(panel,/class="audio-volume-point"/)
  assert.match(panel,/audioVolumeDown\(/)
  assert.match(panel,/audioVolumeKeydown\(/)
  assert.match(panel,/audioVolumeAddFromClip\(/)
  assert.match(inspector,/editInspectorVolumePoint\(/)
  assert.match(inspector,/volumeAutomation \|\| \[\]/)
})
test('AUTO-31 · Preview y Player reciben la misma lista de puntos, no crean un Mixer nuevo',()=>{
  const preview=read('src/core/timeline/event-preview.js'),play=read('src/engine/runtime/events/play-timeline.js')
  assert.match(preview,/volumeAutomation:key\.volumeAutomation/)
  assert.match(play,/volumeAutomation: key\.volumeAutomation/)
  assert.match(play,/audioSeek\(run\)/)
  assert.match(play,/audioPause\(run\)/)
})

test('AUTO-32 · Player integra la ganancia automatizada con una sola voz y su bus existente',async()=>{
  const src=read('src/engine/runtime/events/play-timeline.js')
  const fakeClass=class{constructor(){}},fake=()=>{}
  const methods=Function('THREE','TimelineRunner','quatFromRot','resolveCamera3D','sampleBakeTrack','DEG','setCameraFov','verticalFov','resolveAudioGroup',
    src.replace(/^import .*\n/gm,'').replace('export const timelineMethods =','const timelineMethods =')+';return timelineMethods')(
    {Vector3:fakeClass,Quaternion:fakeClass,Euler:fakeClass},TimelineRunner,fake,fake,fake,Math.PI/180,fake,fake,()=>({id:'sfx',missing:false}))
  const produced=[]
  const ctx={
    game:{run(){}},rt:{toast(){}},_tlWarned:new Set(),project:{audio:normalizeAudio({})},
    audio:{resolveClip:clip=>clip,engine:{cfg:normalizeAudio({}),play:async(clip,opts)=>{
      const voice={clip,opts,stopped:false,paused:false,done:new Promise(()=>{}),
        stop(fade){this.stopped=true;this.fade=fade},pause(){this.paused=true},resume(){this.paused=false},
        ramp(to,seconds,from){this.fadeIn={to,seconds,from}},setAutomationPosition() {},setPitch(){}}
      produced.push(voice);return voice
    }}}
  }
  Object.assign(ctx,methods)
  const a=fixture(),runner={finished:false,paused:false,time:a.key.t,speed:1,tl:a.timeline}
  const host=ctx._tlHost()
  await host.audio(a.key,runner)
  assert.equal(produced.length,1)
  assert.equal(produced[0].opts.volume,.0)
  assert.deepEqual(produced[0].opts.volumeAutomation,a.key.volumeAutomation)
  assert.equal(produced[0].opts.group,'sfx')
  assert.ok(approx(produced[0].fadeIn.seconds,.3))
  host.audioPause(runner);assert.equal(produced[0].paused,true)
  host.audioResume(runner);assert.equal(produced[0].paused,false)
  runner.time=a.key.t+a.key.duration-a.key.fadeOut
  host.audioUpdate(runner);assert.equal(produced[0].stopped,true);assert.ok(approx(produced[0].fade,.5))
  host.audioStop(runner)
  assert.equal(runner._automationVoices.size,0)
})
test('AUTO-33 · Seek del Player cancela solo su voz y reanuda dentro del clip',async()=>{
  const src=read('src/engine/runtime/events/play-timeline.js')
  const Fake=class{},stub=()=>{}
  const methods=Function('THREE','TimelineRunner','quatFromRot','resolveCamera3D','sampleBakeTrack','DEG','setCameraFov','verticalFov','resolveAudioGroup',
    src.replace(/^import .*\n/gm,'').replace('export const timelineMethods =','const timelineMethods =')+';return timelineMethods')(
    {Vector3:Fake,Quaternion:Fake,Euler:Fake},TimelineRunner,stub,stub,stub,Math.PI/180,stub,stub,()=>({id:'sfx',missing:false}))
  const produced=[]
  const env={game:{run(){}},rt:{toast(){}},_tlWarned:new Set(),project:{audio:normalizeAudio({})},
    audio:{resolveClip:clip=>clip,engine:{cfg:normalizeAudio({}),play:async(clip,opts)=>{
      const v={opts,stopped:false,done:new Promise(()=>{}),stop(){this.stopped=true},pause(){},resume(){},ramp(){}}
      produced.push(v);return v
    }}}}
  Object.assign(env,methods)
  const a=fixture(),run={finished:false,time:2,paused:false,speed:1,tl:a.timeline},host=env._tlHost()
  await host.audio(a.key,run)
  assert.equal(produced.length,1)
  run.time=3.5;host.audioSeek(run)
  await Promise.resolve();await Promise.resolve();await Promise.resolve()
  assert.equal(produced[0].stopped,true)
  assert.equal(produced.length,2)
  assert.ok(approx(produced[1].opts.automationElapsed,1.5))
  assert.ok(approx(produced[1].opts.offset,1.5))
  host.audioStop(run)
})
test('AUTO-34 · los cambios de Inspector impiden cortar por debajo del último punto',()=>{
  const s=read('src/components/TemporalResourceInspector.vue')
  assert.match(s,/param\.key === 'duration' && track\.value\.kind === 'audio'/)
  assert.match(s,/Math\.max\(0\.05, \.\.\.item\.value\.volumeAutomation\.map\(point => point\.t\)\)/)
  assert.match(s,/item\.value\.action = 'play'/)
})
test('AUTO-35 · pausar durante Fade In conserva el tramo restante al reanudar',()=>{
  const e=engine(),v=e._voice({duration:12},{group:'sfx',mode:'ui',volume:0,volumeAutomation:points})
  v.ramp(.8,1,0)
  e.ctx.currentTime=.3;v.pause()
  assert.ok(approx(v._automationFadeResume.remaining,.7))
  assert.ok(approx(v._automationFadeResume.from,.24))
  v.resume()
  assert.equal(v._automationFadeResume,null)
  assert.ok(v.gain.gain.events.some(ev=>ev[0]==='ramp'&&approx(ev[1],.8)&&approx(ev[2],1)))
  v.stop()
})
test('AUTO-36 · fixture Electron conserva sus 36 checks y añade una regresión de zoom/scroll',()=>{
  const fixture=read('scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002.html')
  assert.equal(fixture.split('\n').filter(line=>line.trimStart().startsWith('check(')).length,37)
  assert.match(fixture,/output\.dataset\.stage=stage/)
  assert.match(fixture,/checks\.length===37/)
  assert.match(fixture,/Watchdog/)
  assert.match(fixture,/await import\('vue'\)/)
})
