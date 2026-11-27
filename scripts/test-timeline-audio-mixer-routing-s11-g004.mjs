import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultAudio, defaultGroup, normalizeAudio, resolveAudioGroup, resolveAudioClip } from '../src/engine/runtime/audio/config.js'
import { AudioEngine } from '../src/engine/runtime/audio/engine.js'
import { newTimeline, newTrack, newKey, normalizeTimeline } from '../src/core/timeline/model.js'

const base = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, base), 'utf8')
const cfg = normalizeAudio({ groups: [
  { id:'mix-7', name:'Ambiente exterior', parent:'music', volume:-9, fx:[{id:'fx-7', type:'lowpass', freq:720}] },
  { id:'mix-8', name:'Diálogo propio', parent:'master', volume:-3 },
] })
const project = () => ({ audio:cfg, assets:[{id:'clip-1',name:'lluvia.wav',ext:'wav'}], database:{} })
const key = (overrides={}) => newKey('audio', 0, {clip:'lluvia.wav',group:'mix-7',volume:.65,...overrides})

function previewFixture() {
  const source = read('src/core/timeline/event-preview.js')
  const Preview = Function('TimelineRunner','Game','getAudio','resolveAudioClip','resolveAudioGroup',
    source.replace(/^import .*\n/gm,'').replaceAll('export class ','class ').replaceAll('export function ','function ') + ';return TimelineEventPreview')(
      class {}, class {}, () => ({}),resolveAudioClip,resolveAudioGroup)
  const played=[],stopped=[],warned=[]
  const engine={ensure:async()=>{}, async play(id,opts){
    const voice={id,opts,stop(fade){stopped.push({id,group:opts.group,fade})},pause(){},resume(){},done:new Promise(()=>{})}
    played.push(voice);return voice
  }}
  const item = new Preview({getProject:project,audioEngine:()=>engine,onWarning:message=>warned.push(message)})
  item.active=true;item.runner={time:0}
  return {item,played,stopped,warned}
}
function playerHostFixture() {
  const source=read('src/engine/runtime/events/play-timeline.js')
  const fakeThree={Vector3:class{},Quaternion:class{},Euler:class{}}
  const fake=()=>{}
  const methods=Function('THREE','TimelineRunner','quatFromRot','resolveCamera3D','sampleBakeTrack','DEG','setCameraFov','verticalFov','resolveAudioGroup',
    source.replace(/^import .*\n/gm,'').replace('export const timelineMethods =','const timelineMethods =')+';return timelineMethods')(
      fakeThree,fake,fake,fake,Math.PI/180,fake,fake,fake,resolveAudioGroup)
  const calls=[],played=[],warned=[],timers=[]
  const self={project:project(),_tlWarned:new Set(),rt:{toast:(msg)=>warned.push(msg)},timers,
    game:{run:(commands)=>calls.push(...commands)},
    audio:{engine:{cfg,async play(id,opts){played.push({id,opts});return {ramp(){},stop(){}}}},resolveClip:clip=>resolveAudioClip(project(),clip)},
  }
  return {host:methods._tlHost.call(self),calls,played,warned,timers,self}
}

test('G004-01 · el ID prevalece sobre los nombres del mezclador',()=>{
  assert.equal(resolveAudioGroup(cfg,'mix-7').id,'mix-7')
  assert.equal(resolveAudioGroup(cfg,'mix-7').legacy,false)
  assert.equal(resolveAudioGroup(cfg,'mix-8').id,'mix-8')
})
test('G004-02 · una clave antigua con nombre y distinta capitalización resuelve el ID canónico',()=>{
  const result=resolveAudioGroup(cfg,'aMbIeNtE ExTeRiOr')
  assert.deepEqual(result,{id:'mix-7',reference:'aMbIeNtE ExTeRiOr',missing:false,legacy:true})
})
test('G004-03 · el valor vacío mantiene SFX y no avisa como referencia ausente',()=>{
  assert.deepEqual(resolveAudioGroup(cfg,''),{id:'sfx',reference:'sfx',missing:false,legacy:false})
  assert.deepEqual(resolveAudioGroup(cfg,null),{id:'sfx',reference:'sfx',missing:false,legacy:false})
})
test('G004-04 · una referencia eliminada es detectable sin perder el destino seguro',()=>{
  assert.deepEqual(resolveAudioGroup(cfg,'deleted-9'),{id:'sfx',reference:'deleted-9',missing:true,legacy:false})
})
test('G004-05 · resolución no muta el proyecto ni la clave antigua',()=>{
  const before=JSON.stringify(cfg),k=key({group:'Ambiente exterior'})
  assert.equal(resolveAudioGroup(cfg,k.group).id,'mix-7')
  assert.equal(JSON.stringify(cfg),before)
  assert.equal(k.group,'Ambiente exterior')
})
test('G004-06 · guardar/normalizar/reabrir conserva el ID sin convertirlo al nombre',()=>{
  const timeline=newTimeline('QA',{tracks:[newTrack('audio',{keys:[key()]})]})
  const result=normalizeTimeline(JSON.parse(JSON.stringify(timeline)))
  assert.equal(result.tracks[0].keys[0].group,'mix-7')
})
test('G004-07 · los proyectos antiguos sin definición de audio reciben los buses base',()=>{
  const old=defaultAudio();assert.ok(old.groups.some(g=>g.id==='sfx'))
  const created=normalizeAudio({groups:[defaultGroup('mix-7','Ambiente exterior','music')]})
  assert.equal(resolveAudioGroup(created,'Ambiente exterior').id,'mix-7')
})
test('G004-08 · Preview entrega ID canónico al motor para nombre antiguo y bus personalizado',async()=>{
  const {item,played,warned}=previewFixture(); await item._playAudio(key({group:'AMBIENTE EXTERIOR'}))
  assert.equal(played.length,1);assert.equal(played[0].opts.group,'mix-7');assert.equal(warned.length,0)
})
test('G004-09 · Preview envía grupo eliminado a SFX y avisa sin alterar el recurso',async()=>{
  const {item,played,warned}=previewFixture();const orphan=key({group:'deleted-9'})
  await item._playAudio(orphan)
  assert.equal(played[0].opts.group,'sfx');assert.match(warned[0],/bus de audio ausente.*deleted-9/)
  assert.equal(orphan.group,'deleted-9')
})
test('G004-10 · Stop inválido de Preview no detiene las voces legítimas de SFX',async()=>{
  const {item,stopped}=previewFixture()
  await item._playAudio(key({group:'sfx'}))
  await item._playAudio(key({group:'deleted-9',action:'stop',clip:'lluvia.wav'}))
  assert.equal(stopped.length,0);assert.equal(item.voices.size,1)
})
test('G004-11 · Stop válido de Preview afecta solo al bus seleccionado',async()=>{
  const {item,stopped}=previewFixture()
  await item._playAudio(key());await item._playAudio(key({group:'sfx'}))
  await item._playAudio(key({group:'Ambiente exterior',action:'stop',clip:'lluvia.wav',fade:.2}))
  assert.deepEqual(stopped,[{id:'clip-1',group:'mix-7',fade:.2}]);assert.equal(item.voices.size,2) // el fundido permanece hasta done
})
test('G004-12 · Stop global antiguo sigue deteniendo todas las voces propias de Preview',async()=>{
  const {item,stopped}=previewFixture()
  await item._playAudio(key());await item._playAudio(key({group:'sfx'}))
  await item._playAudio(key({action:'stop',group:'sfx',clip:''}))
  assert.equal(stopped.length,2);assert.equal(item.voices.size,0)
})
test('G004-13 · Player ordinario canonicaliza los nombres antes de lanzar el comando sound',()=>{
  const {host,calls}=playerHostFixture();host.audio(key({group:'Ambiente exterior'}))
  assert.equal(calls.length,1);assert.equal(calls[0].code,'sound');assert.equal(calls[0].p.group,'mix-7')
})
test('G004-14 · Player avanzado reproduce por el mismo bus y conserva offset/duración',async()=>{
  const {host,played,timers}=playerHostFixture()
  await host.audio(key({group:'AMBIENTE EXTERIOR',offset:.3,fadeIn:.2,duration:1.5,fadeOut:.2}))
  assert.equal(played[0].opts.group,'mix-7');assert.equal(played[0].opts.offset,.3)
  assert.equal(timers[0].t,1.3)
})
test('G004-15 · Player ordinario reproduce referencia inválida en SFX con diagnóstico',()=>{
  const {host,calls,warned}=playerHostFixture()
  host.audio(key({group:'eliminado'}))
  assert.equal(calls[0].p.group,'sfx');assert.match(warned[0],/bus de audio ausente.*eliminado/)
})
test('G004-16 · Player avanzado usa el mismo fallback ante una referencia inválida',async()=>{
  const {host,played,warned}=playerHostFixture()
  await host.audio(key({group:'eliminado',duration:1}))
  assert.equal(played[0].opts.group,'sfx');assert.equal(warned.length,1)
})
test('G004-17 · Player rechaza Stop de grupo eliminado, sin comando global accidental',()=>{
  const {host,calls,warned}=playerHostFixture()
  host.audio(key({group:'eliminado',action:'stop'}))
  assert.equal(calls.length,0);assert.equal(warned.length,1)
})
test('G004-18 · Player conserva Stop dirigido por nombre antiguo y Stop global por SFX vacío',()=>{
  const {host,calls}=playerHostFixture()
  host.audio(key({group:'Ambiente exterior',action:'stop'}))
  host.audio(key({group:'sfx',clip:'',action:'stop'}))
  assert.deepEqual(calls.map(c=>c.p.group),['mix-7',''])
})
test('G004-19 · Inspector expone referencias huérfanas y heredadas sin sobreescribirlas',()=>{
  const inspector=read('src/components/ParamForm.vue')
  assert.match(inspector,/Bus ausente/);assert.match(inspector,/Referencia antigua/)
  assert.match(inspector,/:value="values\[p\.key\]" disabled/)
  assert.match(inspector,/<option v-for="g in store\.project\.audio\.groups"/)
})
test('G004-20 · no se crean Mixer paralelo, efectos por clip ni nuevas claves serializadas',()=>{
  const preview=read('src/core/timeline/event-preview.js'),player=read('src/engine/runtime/events/play-timeline.js')
  const model=read('src/core/timeline/model.js')
  assert.match(preview,/resolveAudioGroup/);assert.match(player,/resolveAudioGroup/)
  assert.match(model,/group: String\(k\?\.group \|\| 'sfx'\)/)
  assert.doesNotMatch(player,/clipEffects|effectsByClip|clipFx/)
})


test('G004-21 · AudioEngine conecta una voz del Timeline al bus, FX y padre existentes',()=>{
  class Param { constructor(value=1){this.value=value} cancelScheduledValues(){} setTargetAtTime(v){this.value=v} setValueAtTime(v){this.value=v} }
  class Node { constructor(){this.connections=[]} connect(n){this.connections.push(n);return n} disconnect(){this.connections=[]} }
  class Gain extends Node { constructor(){super();this.gain=new Param()} }
  class Filter extends Node { constructor(){super();this.frequency=new Param();this.Q=new Param()} }
  class Source extends Node { constructor(){super();this.playbackRate=new Param()} start(){} stop(){} }
  class Context {
    constructor(){this.currentTime=0;this.sampleRate=48000}
    createGain(){return new Gain()}
    createBiquadFilter(){return new Filter()}
    createAnalyser(){const n=new Node();n.fftSize=512;n.getFloatTimeDomainData=()=>{};return n}
    createBufferSource(){return new Source()}
  }
  const engine=new AudioEngine();engine.ctx=new Context();engine.configure(cfg)
  const custom=engine.nodes.get('mix-7'),music=engine.nodes.get('music')
  assert.equal(custom.parent,'music');assert.equal(custom.chain.length,1)
  assert.equal(custom.vol.connections.includes(music.input),true)
  const destination=resolveAudioGroup(cfg,'Ambiente exterior')
  const voice=engine._voice({duration:5},{group:destination.id,mode:'ui',volume:.6,pitch:1})
  assert.equal(voice.opts.group,'mix-7')
  assert.equal(voice.gain.connections[0],custom.input)
  assert.equal(voice.gain.gain.value,.6)
  assert.equal(custom.vol.gain.value,Math.pow(10,-9/20))
  voice.stop()
})
test('G004-22 · Preview prepara buses al iniciar aunque el Mixer nunca se haya abierto',()=>{
  const source=read('src/core/timeline/event-preview.js')
  assert.match(source,/this\.audioEngine\(\)\?\.configure\?\.\(project\?\.audio\)/)
})
