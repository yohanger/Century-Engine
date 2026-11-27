import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {newTimeline,newTrack,newKey,normalizeTimeline} from '../src/core/timeline/model.js'
import {Game} from '../src/engine/runtime/events/interpreter.js'
import {resolveAudioClip,resolveAudioGroup} from '../src/engine/runtime/audio/config.js'
// El Runner importa Three.js, no disponible aquí: el harness usa el código productivo
// sin sustituir el calendario ni las operaciones de la sesión de eventos.
function loadRunner(){
 const source=readFileSync(new URL('../src/engine/runtime/timeline/player.js',import.meta.url),'utf8')
 return Function('evalTimelineCamera','evalTimelineNode','sampleBakeTrack',
   source.replace(/^import .*\n/gm,'').replace('export class TimelineRunner','class TimelineRunner')+';return TimelineRunner')
   (()=>null,()=>undefined,()=>null)
}
const TimelineRunner=loadRunner()
const sourcePreview=readFileSync(new URL('../src/core/timeline/event-preview.js',import.meta.url),'utf8')
const {TimelineEventPreview,timelinePreviewCommandBlock}=Function('TimelineRunner','Game','getAudio','resolveAudioClip','resolveAudioGroup',
  sourcePreview.replace(/^import .*\n/gm,'').replaceAll('export class ','class ').replaceAll('export function ','function ')+
  ';return {TimelineEventPreview,timelinePreviewCommandBlock}')
  (TimelineRunner,Game,()=>({}),resolveAudioClip,resolveAudioGroup)

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const panel=read('src/components/TimelinePanel.vue')
const scene=read('src/engine/runtime/audio/scene.js')
const project=()=>({assets:[{id:'sound-01',name:'Rain.ogg',ext:'ogg'},{id:'sound-02',name:'Impact.wav',ext:'wav'}],audio:{groups:[{id:'sfx',name:'SFX'}]},database:{switches:['Lluvia'],variables:['Fuerza']}})
const timeline=(events=[],opts={})=>normalizeTimeline(newTimeline('QA',{duration:4,...opts,tracks:events}))
const audioTrack=(key)=>{const tr=newTrack('audio',{name:'Audio'});tr.keys=[key];return tr}
const commandTrack=(list,time=.5)=>{const tr=newTrack('commands',{name:'Comandos'});tr.keys=[newKey('commands',time,{name:'Probar',list})];return tr}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve()}
function fixture(opts={}){
 const voices=[],log=[],caption=[],events=[],warnings=[]
 const activeProject=opts.project||project()
 const engine={ensure:async()=>{},play:async(id,params)=>{
   const voice={id,params,stopped:0,paused:0,resumed:0,done:new Promise(()=>{}),
     stop(){this.stopped++},pause(){this.paused++},resume(){this.resumed++},ramp(to,s,from){this.ramped=[to,s,from]}}
   voices.push(voice);return voice
 }}
 const world=opts.world||null,ed={world,applyWorld(){events.push('restore-world')},vp:{requestRender(){events.push('render')}}}
 const preview=new TimelineEventPreview({getProject:()=>activeProject,getEditor:()=>ed,audioEngine:()=>engine,
   onCaption:value=>caption.push(value),onWarning:message=>warnings.push(message),onEnd:()=>events.push('ended')})
 return {preview,voices,log,caption,events,warnings,engine,ed,activeProject}
}
const audioKey=(t=.5,extra={})=>newKey('audio',t,{action:'play',clip:'Rain',group:'sfx',volume:.6,pitch:1,fadeIn:0,fadeOut:0,duration:0,...extra})

test('S11-G001-01 · resolución de audio única en Editor y Player (ID/nombre/extensión)',()=>{
 const p=project()
 assert.equal(resolveAudioClip(p,'Rain'),'sound-01')
 assert.equal(resolveAudioClip(p,'Rain.ogg'),'sound-01')
 assert.equal(resolveAudioClip(p,'sound-01'),'sound-01')
 assert.equal(resolveAudioClip(p,'unknown'),null)
 assert.match(scene,/resolveClip\(x\) \{\s*return resolveAudioClip\(this\.project, x\)/)
})
test('S11-G001-02 · Timeline usa el Runner original mediante el transporte único del Editor',()=>{
 const playback=read('src/core/timeline/playback-session.js')
 const app=read('src/App.vue')
 assert.match(playback,/new TimelineEventPreview\(options\)/)
 assert.match(playback,/events\.update\(dt\)/)
 assert.match(playback,/visual\.apply\(/)
 assert.match(panel,/playback\.toggle\(tl\.value\)/)
 assert.match(app,/provide\(timelinePlaybackKey,timelinePlayback\)/)
 const t=timeline([]),p=fixture();p.preview.start(t)
 assert.ok(p.preview.runner instanceof TimelineRunner)
 assert.equal(p.preview.runner.host.eventsOnly,true)
 p.preview.stop()
})
test('S11-G001-03 · el audio reproduce la clave en su instante real, sin duplicar por fotograma',async()=>{
 const p=fixture(),tl=timeline([audioTrack(audioKey(.4))])
 p.preview.start(tl);p.preview.update(.2);await flush();assert.equal(p.voices.length,0)
 p.preview.update(.3);await flush();assert.equal(p.voices.length,1)
 assert.equal(p.voices[0].id,'sound-01');assert.equal(p.voices[0].params.group,'sfx')
 p.preview.update(.4);await flush();assert.equal(p.voices.length,1)
 p.preview.stop();assert.equal(p.voices[0].stopped,1)
})
test('S11-G001-04 · Stop de Audio afecta solo voces propias y respeta fade/duración',async()=>{
 const start=audioKey(.1,{duration:1,fadeIn:.25,fadeOut:.2});const p=fixture()
 p.preview.start(timeline([audioTrack(start)]));p.preview.update(.2);await flush()
 assert.deepEqual(p.voices[0].ramped,[.6,.15,0]);p.preview.update(1.05)
 assert.equal(p.voices[0].stopped,1);assert.equal(p.preview.voices.size,0)
 p.preview.stop()
})
test('S11-G001-05 · Pause/Resume conserva voz y reloj del Runner',async()=>{
 const p=fixture();p.preview.start(timeline([audioTrack(audioKey(0))]));await flush()
 p.preview.update(.5);p.preview.pause();p.preview.update(.8)
 assert.equal(p.preview.time,.5);assert.equal(p.voices[0].paused,1)
 p.preview.resume();p.preview.update(.2)
 assert.equal(p.preview.time,.7);assert.equal(p.voices[0].resumed,1)
 p.preview.stop()
})
test('S11-G001-06 · Seek libera voz anterior sin repetir comandos pasados',async()=>{
 const cmd=commandTrack([{code:'switch',p:{id:1,value:'on'}},{code:'text',p:{text:'Visible',speaker:'Actor'}}],1)
 const p=fixture();p.preview.start(timeline([audioTrack(audioKey(.5,{duration:3})),cmd]))
 p.preview.update(1.2);await flush();assert.equal(p.voices.length,1)
 assert.equal(p.preview.game.getSw(1),true)
 assert.ok(p.caption.includes('Actor: Visible'))
 p.preview.seek(2);await flush();assert.equal(p.voices[0].stopped,1)
 assert.equal(p.voices.length,2);assert.ok(!p.caption.at(-1))
 p.preview.update(.3);await flush();assert.equal(p.caption.at(-1),'')
 p.preview.stop()
})
test('S11-G001-07 · Loop no conserva voces del ciclo anterior',async()=>{
 const p=fixture();p.preview.start(timeline([audioTrack(audioKey(.2))],{duration:1,loop:true}))
 p.preview.update(.5);await flush();assert.equal(p.voices.length,1)
 p.preview.update(.6);await flush();assert.equal(p.voices[0].stopped,1)
 p.preview.update(.3);await flush();assert.equal(p.voices.length,2)
 p.preview.stop()
})
test('S11-G001-08 · carga de audio tardía tras Stop se cancela, nunca resucita',async()=>{
 let resolve;const engine={ensure:()=>Promise.resolve(),play:()=>new Promise(r=>resolve=r)}
 const p=fixture();p.preview.audioEngine=()=>engine
 p.preview.start(timeline([audioTrack(audioKey(0))]));await flush()
 p.preview.stop()
 const voice={stopped:0,stop(){this.stopped++}}
 resolve(voice);await flush()
 assert.equal(voice.stopped,1)
})
test('S11-G001-09 · whitelist de comandos bloquea IO, scripts, métodos externos y anidamiento peligroso',()=>{
 for(const code of ['saveGame','loadGame','deleteSave','runEvent','nodePersist','script','weatherLightning','weatherThunder','method','signal','wait','inputAction'])
   assert.ok(timelinePreviewCommandBlock([{code,p:{}}],true),code)
 assert.match(timelinePreviewCommandBlock([{code:'if',p:{kind:'switch'},b:{then:[{code:'saveGame'}]}}],true),/saveGame/)
 assert.ok(timelinePreviewCommandBlock([{code:'variable',p:{src:'script'}}],true))
 assert.ok(timelinePreviewCommandBlock([{code:'match',p:{src:'script'}}],true))
 assert.ok(timelinePreviewCommandBlock([{code:'if',p:{kind:'script'}}],true))
 assert.ok(timelinePreviewCommandBlock([{code:'weather',p:{seconds:4,wait:true}}],true))
 assert.equal(timelinePreviewCommandBlock([{code:'text',p:{text:'Hola'}},{code:'comment',p:{}}],false),null)
})
test('S11-G001-10 · comando seguro real usa Game sandbox y no muta proyecto',async()=>{
 const p=fixture(),original=JSON.stringify(p.activeProject)
 const tr=commandTrack([{code:'switch',p:{id:1,value:'on'}},{code:'variable',p:{id:1,src:'number',value:4,op:'set'}},
   {code:'text',p:{text:'Llueve {v:1}',speaker:'NPC'}}],0)
 p.preview.start(timeline([tr]));await flush()
 assert.equal(p.preview.game.getSw(1),true)
 assert.equal(p.preview.game.getVar(1),4)
 assert.ok(p.caption.at(-1)?.includes('NPC:'))
 assert.equal(JSON.stringify(p.activeProject),original)
 p.preview.stop()
})
test('S11-G001-11 · comando no aislable nunca se ejecuta parcialmente',async()=>{
 const p=fixture(),tr=commandTrack([{code:'switch',p:{id:1,value:'on'}},{code:'saveGame',p:{slot:1}}],0)
 p.preview.start(timeline([tr]));await flush()
 assert.equal(p.preview.game.getSw(1),false)
 assert.equal(p.warnings.length,1)
 assert.match(p.warnings[0],/saveGame/)
 p.preview.stop()
})
test('S11-G001-12 · Naturaleza weather cambia el mundo real y Stop restaura estado',async()=>{
 const world={preset:'clear',intensity:.5,forceWeather:false,cur:{rain:0},_fade:null,dir:{current:'clear',busy:1,dwell:5},
   setWeather(id,intensity,seconds){this.preset=id;this.intensity=intensity;this.forceWeather=true;this.cur={rain:1};this._fade={dur:seconds};Object.assign(this.dir,{current:id,busy:0,dwell:12});return true}}
 const p=fixture({world}),tr=commandTrack([{code:'weather',p:{preset:'rain',intensity:1,seconds:0}}],0)
 p.preview.start(timeline([tr]));await flush()
 assert.equal(world.preset,'rain');assert.equal(world.cur.rain,1)
 p.preview.stop()
 assert.deepEqual({preset:world.preset,intensity:world.intensity,forceWeather:world.forceWeather,cur:world.cur,fade:world._fade,dir:world.dir},
   {preset:'clear',intensity:.5,forceWeather:false,cur:{rain:0},fade:null,dir:{current:'clear',busy:1,dwell:5}})
 assert.ok(p.events.includes('restore-world'))
})
test('S11-G001-13 · la mutación irreversible de Naturaleza no ocurre en Preview',async()=>{
 const p=fixture({world:{setWeather(){},cur:{rain:0},dir:{current:'a',busy:0,dwell:0}}})
 p.preview.start(timeline([commandTrack([{code:'weatherLightning',p:{distance:1200}}],0)]));await flush()
 assert.equal(p.warnings.length,1);assert.match(p.warnings[0],/weatherLightning/)
 p.preview.stop()
})
test('S11-G001-14 · método de scripts no se ejecuta; avisos no se repiten indefinidamente',()=>{
 const p=fixture(),tr=newTrack('method',{node:'node1'});tr.keys=[newKey('method',0,{method:'destroyFiles'})]
 p.preview.start(timeline([tr]));p.preview.update(.5);p.preview.update(.5)
 assert.equal(p.warnings.length,1);assert.match(p.warnings[0],/no aislable/)
 p.preview.stop()
})
test('S11-G001-15 · restauración final y limpieza de sesión al finalizar el tramo',async()=>{
 const p=fixture();p.preview.start(timeline([audioTrack(audioKey(0))],{duration:1}));await flush()
 p.preview.update(1);await flush()
 assert.equal(p.preview.active,false);assert.equal(p.voices[0].stopped,1)
 assert.equal(p.events.filter(v=>v==='ended').length,1)
})
test('S11-G001-16 · la lectura de claves y la serialización permanecen intactas',()=>{
 const key=audioKey(.5),tr=audioTrack(key),tl=timeline([tr])
 const before=JSON.stringify(tl),p=fixture()
 p.preview.start(tl);p.preview.update(.8);p.preview.stop()
 assert.equal(JSON.stringify(tl),before)
})
test('S11-G001-17 · cambio de recurso o contexto detiene el transporte, no cambiar pestañas',()=>{
 const playback=read('src/core/timeline/playback-session.js')
 const app=read('src/App.vue')
 assert.match(playback,/contextValid\(\)/)
 assert.match(playback,/current\.sceneId === origin\.sceneId/)
 assert.match(playback,/current\.timelineId === resource\.id/)
 assert.match(app,/timelinePlayback\.validate\(\)/)
 assert.match(panel,/if\(!visible\)\{\s*libraryOpen\.value=false/)
 assert.doesNotMatch(panel,/eventPreview\.stop\(\)/)
 assert.doesNotMatch(panel,/cancelAnimationFrame\(raf\)/)
})
test('S11-G001-18 · Stop de grupo invalida un audio que aún está cargándose',async()=>{
 let resolve;const engine={ensure:()=>Promise.resolve(),play:()=>new Promise(r=>resolve=r)}
 const first=audioKey(0), stop=newKey('audio',.2,{action:'stop',group:'sfx',clip:'Rain'})
 const track=audioTrack(first);track.keys.push(stop)
 const p=fixture();p.preview.audioEngine=()=>engine
 p.preview.start(timeline([track]));await flush()
 p.preview.update(.3)
 const voice={stopped:0,stop(){this.stopped++}}
 resolve(voice);await flush()
 assert.equal(voice.stopped,1)
 assert.equal(p.preview.voices.size,0)
 p.preview.stop()
})
test('S11-G001-19 · una transición de tiempo no adelanta el final de Audio',async()=>{
 const p=fixture(),k=audioKey(.4,{duration:1.1,fadeOut:.2})
 p.preview.start(timeline([audioTrack(k)]));p.preview.update(.5);await flush()
 assert.equal(p.preview.voices.size,1)
 assert.ok(Math.abs([...p.preview.voices][0].deadline-1.3)<1e-6)
 p.preview.update(.82);assert.equal(p.voices[0].stopped,1)
 p.preview.stop()
})
test('S11-G001-20 · clima anidado registra y restaura el mismo mundo',async()=>{
 const world={preset:'clear',intensity:1,forceWeather:false,cur:{rain:0},_fade:null,dir:{current:'clear',busy:0,dwell:10},
   setWeather(id,value){this.preset=id;this.forceWeather=true;this.cur={rain:value};this.dir.current=id}}
 const p=fixture({world})
 const block={code:'if',p:{kind:'switch',id:1,on:false},b:{then:[{code:'weather',p:{preset:'rain',intensity:.7,seconds:0}}]}}
 p.preview.start(timeline([commandTrack([block],0)]));await flush()
 assert.equal(world.preset,'rain')
 p.preview.stop();assert.equal(world.preset,'clear');assert.equal(world.cur.rain,0)
})
test('S11-G001-21 · invalidación de escena mantiene el control en el Editor',()=>{
 const playback=read('src/core/timeline/playback-session.js')
 const app=read('src/App.vue')
 assert.match(playback,/current\.sceneId === origin\.sceneId/)
 assert.match(app,/store\.project\?\.activeSceneId/)
 assert.match(app,/timelinePlayback\.dispose\(\)/)
})
test('S11-G001-22 · compilación real de Vue pendiente si no existe paquete local',async t=>{
 let compiler;try{compiler=await import('@vue/compiler-sfc')}catch{t.skip('Compilador Vue ausente; requiere Electron del usuario');return}
 const {errors,descriptor}=compiler.parse(panel,{filename:'TimelinePanel.vue'});assert.deepEqual(errors,[])
 assert.deepEqual(compiler.compileTemplate({source:descriptor.template.content,filename:'TimelinePanel.vue',id:'s11-g001'}).errors,[])
})
