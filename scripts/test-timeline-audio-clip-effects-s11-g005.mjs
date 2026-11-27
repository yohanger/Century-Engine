// QA G005: modelo, aislamiento de voces y ruteo de FX por clave de Timeline.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newFx, FX_TYPES, normalizeAudio, resolveAudioClip } from '../src/engine/runtime/audio/config.js'
import { AudioEngine } from '../src/engine/runtime/audio/engine.js'
import { newTimeline, newTrack, newKey, normalizeTimeline, duplicateTimelineSelection } from '../src/core/timeline/model.js'

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const cfg = normalizeAudio({groups:[{id:'film',name:'Film',parent:'music',fx:[{id:'bus-fx',type:'lowpass',on:true,freq:800,q:0.7}]}]})
const eq = () => newFx('eq3',{id:'clip-eq',low:3,mid:-2})
const echo = () => newFx('echo',{id:'clip-echo',time:0.05,feedback:0.2,mix:0.4})
const key = extra => newKey('audio',0,{clip:'test.wav',group:'film',...extra})
class Param {constructor(v=1){this.value=v}cancelScheduledValues(){}setTargetAtTime(v){this.value=v}setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.value=v}}
class Node {constructor(){this.connections=[]}connect(n){this.connections.push(n);return n}disconnect(){this.connections=[]}}
class Gain extends Node {constructor(){super();this.gain=new Param()}}
class Filter extends Node {constructor(){super();this.frequency=new Param();this.Q=new Param();this.gain=new Param()}}
class Source extends Node {constructor(){super();this.playbackRate=new Param()}start(){}stop(){}}
class Compressor extends Node {constructor(){super();for(const k of ['threshold','ratio','knee','attack','release'])this[k]=new Param()}}
class Context {
  constructor(){this.currentTime=0;this.sampleRate=8000}
  createGain(){return new Gain()}createBiquadFilter(){return new Filter()}
  createAnalyser(){const n=new Node();n.getFloatTimeDomainData=()=>{};return n}
  createBufferSource(){return new Source()}createConvolver(){const n=new Node();n.buffer=null;return n}
  createDelay(){const n=new Node();n.delayTime=new Param();return n}
  createWaveShaper(){return new Node()}createDynamicsCompressor(){return new Compressor()}
  createBuffer(channels,length,rate){const arr=Array.from({length:channels},()=>new Float32Array(length));return{duration:length/rate,getChannelData:i=>arr[i]}}
  createPanner(){const p=new Node();for(const k of ['positionX','positionY','positionZ','orientationX','orientationY','orientationZ'])p[k]=new Param();return p}
}
function engine(){const e=new AudioEngine();e.ctx=new Context();e.configure(cfg);return e}
function voice(e,fx=[],options={}){return e._voice({duration:5},{group:'film',mode:'ui',volume:.8,fx,...options})}
const later = ms => new Promise(done=>setTimeout(done,ms))

test('G005-01 · las ocho clases de efectos proceden del catálogo existente',()=>{
 assert.deepEqual(Object.keys(FX_TYPES),['eq3','lowpass','highpass','compressor','limiter','reverb','echo','distortion'])
})
test('G005-02 · una clave antigua sin FX conserva su formato al normalizar',()=>{
 const t=normalizeTimeline(newTimeline('test',{tracks:[newTrack('audio',{keys:[key()]})]}))
 assert.equal(Object.hasOwn(t.tracks[0].keys[0],'fx'),false)
})
test('G005-03 · FX opcionales sobreviven normalización y guardado/reapertura',()=>{
 const t=normalizeTimeline(newTimeline('test',{tracks:[newTrack('audio',{keys:[key({fx:[eq(),echo()]})]})]}))
 const loaded=normalizeTimeline(JSON.parse(JSON.stringify(t)))
 assert.deepEqual(loaded.tracks[0].keys[0].fx,t.tracks[0].keys[0].fx)
})
test('G005-04 · normalización reutiliza rangos y descarta efectos desconocidos',()=>{
 const t=normalizeTimeline(newTimeline('test',{tracks:[newTrack('audio',{keys:[key({fx:[{id:'over',type:'echo',feedback:40,mix:-5,time:999},{id:'bad',type:'not-fx'}]})]})]}))
 const fx=t.tracks[0].keys[0].fx;assert.equal(fx.length,1);assert.equal(fx[0].feedback,.95);assert.equal(fx[0].mix,0);assert.equal(fx[0].time,1.5)
})
test('G005-05 · duplicación conserva parámetros pero no comparte el objeto FX',()=>{
 const t=normalizeTimeline(newTimeline('test',{tracks:[newTrack('audio',{keys:[key({fx:[eq()]})]})]}))
 const track=t.tracks[0]; const source=track.keys[0]
 const refs=duplicateTimelineSelection(t,[{tr:track.id,k:source.id}],1)
 assert.equal(refs.length,1);const duplicate=track.keys.find(k=>k.id===refs[0].k)
 assert.deepEqual(duplicate.fx,source.fx);assert.notEqual(duplicate.fx,source.fx);assert.notEqual(duplicate.fx[0],source.fx[0])
})
test('G005-06 · la cadena privada se conecta en orden: fuente → FX → fader → bus',()=>{
 const e=engine(),v=voice(e,[eq(),echo()]),bus=e.nodes.get('film')
 assert.equal(v.src.connections[0],v.fxInput)
 assert.equal(v.fxInput.connections[0],v.clipEffects[0].fx.input)
 assert.equal(v.clipEffects[0].fx.output.connections[0],v.clipEffects[1].fx.input)
 assert.equal(v.clipEffects[1].fx.output.connections[0],v.gain)
 assert.equal(v.gain.connections[0],bus.input)
 assert.equal(bus.chain.length,1)
 v.stop()
})
test('G005-07 · dos voces simultáneas no comparten instancias DSP',()=>{
 const e=engine(),a=voice(e,[eq()]),b=voice(e,[eq()]);assert.notEqual(a.clipEffects[0].fx,b.clipEffects[0].fx)
 assert.notEqual(a.clipEffects[0].fx.input,b.clipEffects[0].fx.input)
 assert.deepEqual(a.opts.fx,b.opts.fx);a.stop();b.stop()
})
test('G005-08 · otra voz sin FX conserva el camino antiguo',()=>{
 const e=engine(),a=voice(e),b=voice(e,[eq()]);assert.equal(a.fxInput,null)
 assert.equal(a.gain.connections[0],e.nodes.get('film').input)
 assert.equal(b.clipEffects.length,1);a.stop();b.stop()
})
test('G005-09 · la cadena del bus no se mezcla con la privada',()=>{
 const e=engine(),a=voice(e,[eq(),echo()]);assert.equal(e.nodes.get('film').chain.length,1)
 assert.equal(e.nodes.get('film').chain[0].type,'lowpass');assert.equal(a.clipEffects[0].params.type,'eq3');a.stop()
})
test('G005-10 · activación independiente del FX, con bypass por parámetro',()=>{
 const e=engine(),f=eq();f.on=false;const a=voice(e,[f]);assert.equal(a.clipEffects[0].params.on,false)
 assert.equal(e.nodes.get('film').chain[0].type,'lowpass');a.stop()
})
test('G005-11 · FX de reverb y eco generan cola de tiempo acotado',()=>{
 const e=engine(),a=voice(e,[newFx('reverb',{time:.2}),echo()]);assert.ok(a.fxTail>=.3 && a.fxTail<2);a.stop()
})
test('G005-12 · fin natural preserva cola y Stop global la elimina',()=>{
 const e=engine(),a=voice(e,[echo()]);a.src.onended();assert.equal(a.finishedNaturally,true)
 assert.equal(e._tails.has(a),true);e.stopAll();assert.equal(e._tails.size,0);assert.equal(a.clipEffects.length,0)
})
test('G005-13 · pausa y reanudación silencian FX sin destruir la cadena',()=>{
 const e=engine(),a=voice(e,[echo()]);a.pause();assert.equal(a.paused,true);assert.equal(a.gain.gain.value,0)
 a.resume();assert.equal(a.isPlaying,true);assert.equal(a.gain.gain.value,.8);assert.equal(a.clipEffects.length,1);a.stop()
})
test('G005-14 · Stop inmediato libera DSP sin afectar a otra voz del bus',async()=>{
 const e=engine(),a=voice(e,[eq()]),b=voice(e,[echo()]);a.stop();await later(85)
 assert.equal(a.clipEffects.length,0);assert.equal(b.clipEffects.length,1);b.stop()
})
test('G005-15 · efectos espaciales se conectan antes de panner y conservan grupo',()=>{
 const e=engine(),a=voice(e,[eq()],{mode:'3d',position:[1,2,3]});assert.equal(a.gain.connections[0],a.panner)
 assert.equal(a.panner.connections[0],e.nodes.get('film').input);a.stop()
})
test('G005-16 · Preview transmite FX a AudioEngine y conserva ciclo de sesión',()=>{
 const src=read('src/core/timeline/event-preview.js');assert.match(src,/fx:key\.fx/)
 assert.match(src,/this\.audioEngine\(\)\?\.configure\?\.\(project\?\.audio\)/)
})
test('G005-17 · Player transmite FX en ruta ordinaria y avanzada',()=>{
 const src=read('src/engine/runtime/events/play-timeline.js')
 assert.match(src,/offset: k\.offset, fx: k\.fx/);assert.match(src,/loop: k\.loop, fx: k\.fx, wait: false/)
 assert.match(read('src/engine/runtime/events/exec-commands.js'),/fx: p\.fx/)
 assert.match(read('src/engine/runtime/audio/scene.js'),/fx: opts\.fx/)
})
// CA-TIMELINE-AUDIO-CLIP-FX-UX-001 (ratificado 2026-11-08) supersede SOLO la
// aserción histórica de autoría FX en Inspector; conservar todas las de audio/FX.
test('G005-18 · CA-001: Timeline ya no monta editor FX; Mixer de bus sigue disponible',()=>{
 const s=read('src/components/TemporalResourceInspector.vue'),a=read('src/components/AudioMixerInspector.vue')
 assert.doesNotMatch(s,/<AudioMixerInspector/)
 assert.match(s,/data-test="timeline-clip-fx-readonly"/)
 assert.match(s,/savedClipFx\.length/)
 assert.match(a,/fxMode\(\) \? emit\('fx-update'/)
 assert.doesNotMatch(s,/class="chain-head"/)
})
// CA-001: retirado el editor privado, no hay ya acciones FX que bloquear.
// Las demás propiedades editables conservan el bloqueo de pista y Play.
test('G005-19 · CA-001: indicador FX sin controles y protección de pista/Play intacta',()=>{
 const s=read('src/components/TemporalResourceInspector.vue')
 assert.match(s,/!timelineTrackEditable\(track\.value\) \|\| store\.locked \|\| store\.play\.on/)
 assert.match(s,/<fieldset class="track-edit-fields" :disabled="isTimeline && !!track\?\.locked">/)
 assert.doesNotMatch(s,/@fx-(?:add|remove|move|update|preset)/)
})
test('G005-20 · efectos adicionales no se inyectan en Comandos/Naturaleza/Métodos',()=>{
 const s=read('src/core/timeline/model.js')
 assert.match(s,/if \(Array\.isArray\(k\?\.fx\)\) o\.fx = k\.fx/)
 assert.doesNotMatch(read('src/engine/runtime/audio/config.js'),/clipEffects/)
})

test('G005-21 · reproducción normal del Player entrega la cadena de clave al comando sound',()=>{
 const src=read('src/engine/runtime/events/play-timeline.js')
 const fake=()=>{},methods=Function('THREE','TimelineRunner','quatFromRot','resolveCamera3D','sampleBakeTrack','DEG','setCameraFov','verticalFov','resolveAudioGroup',
   src.replace(/^import .*\n/gm,'').replace('export const timelineMethods =','const timelineMethods =')+';return timelineMethods')(
   {Vector3:class{},Quaternion:class{},Euler:class{}},fake,fake,fake,fake,Math.PI/180,fake,fake,()=>({id:'film',missing:false}))
 const calls=[],project={audio:cfg},host=methods._tlHost.call({
   game:{run:cmd=>calls.push(...cmd)},audio:{engine:{cfg}},project,rt:{toast(){}},_tlWarned:new Set(),timers:[],
 })
 const fx=[eq(),echo()];host.audio(key({fx}))
 assert.equal(calls.length,1);assert.equal(calls[0].code,'sound');assert.deepEqual(calls[0].p.fx,fx)
})
test('G005-22 · reproducción avanzada del Player lleva FX hasta AudioEngine.play',async()=>{
 const src=read('src/engine/runtime/events/play-timeline.js')
 const fake=()=>{},methods=Function('THREE','TimelineRunner','quatFromRot','resolveCamera3D','sampleBakeTrack','DEG','setCameraFov','verticalFov','resolveAudioGroup',
   src.replace(/^import .*\n/gm,'').replace('export const timelineMethods =','const timelineMethods =')+';return timelineMethods')(
   {Vector3:class{},Quaternion:class{},Euler:class{}},fake,fake,fake,fake,Math.PI/180,fake,fake,()=>({id:'film',missing:false}))
 const calls=[],project={audio:cfg},host=methods._tlHost.call({
   game:{run(){}},audio:{engine:{cfg,play:async(id,opts)=>{calls.push({id,opts});return{ramp(){},stop(){}}}},resolveClip:()=> 'sound-id'},
   project,rt:{toast(){}},_tlWarned:new Set(),timers:[],
 })
 const fx=[eq()];await host.audio(key({fx,offset:0.2,duration:0.4}))
 assert.equal(calls.length,1);assert.deepEqual(calls[0].opts.fx,fx);assert.equal(calls[0].opts.offset,.2)
})
test('G005-23 · Preview entrega FX reales sin reescribir el recurso',async()=>{
 const src=read('src/core/timeline/event-preview.js')
 const Preview=Function('TimelineRunner','Game','getAudio','resolveAudioClip','resolveAudioGroup',
   src.replace(/^import .*\n/gm,'').replaceAll('export class ','class ').replaceAll('export function ','function ')+';return TimelineEventPreview')(
   class {},class {},()=>({}),()=> 'sound-id',()=>({id:'film',missing:false}))
 const calls=[],fx=[eq()],item=key({fx})
 const p=new Preview({getProject:()=>({audio:cfg}),audioEngine:()=>({ensure:async()=>{},play:async(id,opts)=>{
   calls.push({id,opts});return{stop(){},done:new Promise(()=>{})}
 }})})
 p.active=true;p.runner={time:0}
 await p._playAudio(item)
 assert.deepEqual(calls[0].opts.fx,fx);assert.deepEqual(item.fx,fx)
})
test('G005-24 · eco con feedback cero conserva el primer retardo tras terminar el PCM',()=>{
 const e=engine(),v=voice(e,[newFx('echo',{feedback:0,time:.4})])
 assert.ok(v.fxTail>=.5,'un único eco no puede ser eliminado tras 60 ms')
 v.stop()
})
test('G005-25 · FX en serie acumulan su cola sin mantener nodos indefinidamente',()=>{
 const e=engine(),v=voice(e,[newFx('reverb',{time:2}),newFx('echo',{feedback:0,time:.7})])
 assert.ok(v.fxTail>=2.8)
 assert.ok(v.fxTail<=20)
 v.stop()
})
