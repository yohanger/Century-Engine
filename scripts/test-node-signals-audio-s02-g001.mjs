// QA del Gate LF-NODE-SIGNALS-AUDIO-S02-G001. Sin otro runtime ni emisor ficticio.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { AudioEngine } from '../src/engine/runtime/audio/engine.js'
import { normalizeSource, normalizeAudio } from '../src/engine/runtime/audio/config.js'
import { registerNode, getNativeSignal, getNativeSignals } from '../src/engine/runtime/nodes/registry.js'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
import { audioHost, hasAudio, audible } from '../src/engine/runtime/audio/host.js'
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8')
registerNode({type:'audio',create:()=>({}),build:()=>({}),update:()=>{},nativeSignals:[{name:'finished',source:'audio-voice',phase:'natural-end',args:[]}]})
registerNode({type:'node3d',create:()=>({}),build:()=>({}),update:()=>{}})
const nodeMethods=vm.runInNewContext(read('src/engine/runtime/events/play-nodes.js').replace(/^import .*\n/gm,'').replace('export const nodesMethods','const nodesMethods')+'\nnodesMethods',{resolveNodePath:()=>null})
const AudioScene=vm.runInNewContext(read('src/engine/runtime/audio/scene.js').replace(/^import .*\n/gm,'').replace('export class AudioScene','class AudioScene').replace(/^export \{ normalizeAudio \}\s*$/gm,'')+'\nAudioScene',{
 THREE:{Vector3:class{},Quaternion:class{}},getAudio:()=>fakeEngine, audioHost,hasAudio,audible,normalizeSource,normalizeAudio,AUDIO_EXT:['wav'],gainToDb:x=>x,newFx:()=>({}),FX_TYPES:{},performance:{now:()=>0},console
})
class Param { constructor(v=1){this.value=v}cancelScheduledValues(){}setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.value=v}setTargetAtTime(v){this.value=v} }
class FakeNode { connect(){} disconnect(){} }
class FakeGain extends FakeNode { constructor(){super();this.gain=new Param()} }
class FakeSource extends FakeNode {constructor(){super();this.onended=null;this.playbackRate=new Param();this.stopCount=0;this.loop=false}start(){}stop(){this.stopCount++}end(){this.onended?.()} }
class FakeCtx {constructor(){this.currentTime=2;this.sources=[]}createGain(){return new FakeGain()}createBufferSource(){const s=new FakeSource();this.sources.push(s);return s} }
let fakeEngine
function audioEngine(){ const e=new AudioEngine(); e.ctx=new FakeCtx();e.nodes.set('sfx',{input:new FakeGain()});e.nodes.set('ui',{input:new FakeGain()});e.ensure=async()=>e.ctx;e.buffer=async()=>({duration:2});e.clearOverrides=()=>{};e.configure=()=>{};e.setLoader=()=>{};return e }
function make({autorun=false,loop=false}={}){
 fakeEngine=audioEngine()
 const emitter={id:'a',name:'Audio',type:'audio',scriptIds:[],parentId:null,props:{clip:'clip',playOnStart:autorun,mode:'ui',group:'ui',loop}}
 const receiver={id:'r',name:'Receptor',type:'node3d',scriptIds:['s1','s2'],parentId:null}
 const project={objects:[emitter,receiver],assets:[{id:'clip',name:'clip.wav',ext:'wav'}],audio:{groups:[],snapshots:[],remember:false},scripts:[
  {id:'s1',execution:'node',code:"node.expose('recibir',()=>game.record('finished'))"},
  {id:'s2',execution:'node',code:"function _ready(){game.record('ready')}"}],activeSceneId:'escena',signalConnections:[{id:'c',emitterId:'a',receiverId:'r',signal:'finished',method:'recibir'}]}
 const nodes=new Map([[emitter.id,{_lfNodeOwner:emitter}],[receiver.id,{_lfNodeOwner:receiver}]])
 const events=[],errors=[]
 const play={project,on:true,_sceneSignalReady:true,_referenceSession:{},ed:{nodes},game:{api:{record:v=>events.push(v)},report:e=>errors.push(String(e))},vm:{held:new Map()},pos:{},vp:{requestRender(){}},_tagLayerApi:()=>({}),_animMethodsFor:()=>({}),_persistMarked:()=>false,_persistSet:()=>false}
 const life=new NodeLifecycle({nodes,host:{project}});play.ed.nodeLifecycle=life;Object.assign(play,nodeMethods);play.game.api.node=id=>play._nodeHandle(id)
 life.scripts=new NodeScriptRuntime(play)
 const scene=new AudioScene({scene:{nodes},host:{project,assetData:()=>null,storage:{get:()=>null}},onFinished:obj=>life.scripts?.emitNativeAudioFinished(obj)})
 scene.on=true
 return {engine:fakeEngine,scene,life,play,project,emitter,receiver,events,errors,start:async()=>{life.start();scene.resetSources();if(autorun)await Promise.resolve();},stop:()=>{life.stop();scene.stop()}}
}
const microtasks=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}
test('SIG-AUD-01: catálogo audio finished sin argumentos en UI y 3D',()=>{
 const m=getNativeSignal('audio','finished'); assert.equal(m?.source,'audio-voice'); assert.equal(m?.args.length,0)
 assert.equal(getNativeSignals('node3d').some(s=>s.name==='finished'),false)
 assert.match(read('src/engine/runtime/nodes/audio.js'),/nativeSignals: \[\{ name: 'finished'/)
})
test('SIG-AUD-02: fin natural entrega finished exactamente una vez a un receptor multiscript',async()=>{
 const x=make();await x.start();await x.scene._play(x.scene.sources.get('a'))
 const v=x.scene.sources.get('a').voice; x.engine.ctx.sources[0].end();await v.done;await microtasks()
 assert.deepEqual(x.events,['ready','finished']);assert.equal(v.finishedNaturally,true);x.engine.ctx.sources[0].end();await microtasks();assert.equal(x.events.length,2);x.stop()
})
test('SIG-AUD-03: stop inmediato no emite finished y done sigue resolviendo',async()=>{
 const x=make();await x.start();await x.scene._play(x.scene.sources.get('a'));const v=x.scene.sources.get('a').voice
 v.stop();await v.done;await microtasks();assert.equal(v.finishedNaturally,false);assert.deepEqual(x.events,['ready']);x.stop()
})
test('SIG-AUD-04: pausa y reanudación no notifican hasta el final real',async()=>{
 const x=make();await x.start();await x.scene._play(x.scene.sources.get('a'));const v=x.scene.sources.get('a').voice
 v.pause();x.engine.ctx.sources[0].end();await microtasks();assert.equal(x.events.length,1)
 v.resume();x.engine.ctx.sources[1].end();await v.done;await microtasks();assert.equal(x.events.filter(v=>v==='finished').length,1);x.stop()
})
test('SIG-AUD-05: en loop no se dispara finished durante repeticiones',async()=>{
 const x=make({loop:true});await x.start();await x.scene._play(x.scene.sources.get('a'))
 const s=x.engine.ctx.sources[0],v=x.scene.sources.get('a').voice;assert.equal(s.loop,true);assert.equal(v.finishedNaturally,false)
 // En WebAudio una fuente loop activa no dispara onended naturalmente.
 assert.equal(x.events.length,1);v.stop();await v.done;await microtasks();assert.equal(x.events.length,1);x.stop()
})
test('SIG-AUD-06: reemplazo cancela el clip antiguo',async()=>{
 const x=make();await x.start();const src=x.scene.sources.get('a');await x.scene._play(src);const first=src.voice
 await x.scene._play(src);await first.done;await microtasks();assert.equal(x.events.length,1)
 const second=src.voice;x.engine.ctx.sources[1].end();await second.done;await microtasks();assert.equal(x.events.filter(v=>v==='finished').length,1);x.stop()
})
test('SIG-AUD-07: detener AudioScene suprime finales diferidos',async()=>{
 const x=make();await x.start();await x.scene._play(x.scene.sources.get('a'));const v=x.scene.sources.get('a').voice
 x.scene.stop();await v.done;await microtasks();assert.equal(x.events.filter(v=>v==='finished').length,0);x.life.stop()
})
test('SIG-AUD-08: pérdida de identidad de nodo no envía a otro con el mismo id',async()=>{
 const x=make();await x.start();await x.scene._play(x.scene.sources.get('a'));const v=x.scene.sources.get('a').voice
 x.project.objects[0]={...x.emitter};x.engine.ctx.sources[0].end();await v.done;await microtasks();assert.equal(x.events.filter(v=>v==='finished').length,0);x.stop()
})
test('SIG-AUD-09: desconexión persistente elimina suscriptor',async()=>{
 const x=make();await x.start();assert.equal(x.life.scripts.sceneConnections.size,1)
 x.play._nodeHandle('a').disconnect('finished',x.play._nodeHandle('r'),'recibir')
 await x.scene._play(x.scene.sources.get('a'));const v=x.scene.sources.get('a').voice;x.engine.ctx.sources[0].end();await v.done;await microtasks();assert.equal(x.events.length,1);x.stop()
})
test('SIG-AUD-10: nodo emisor no requiere scripts propios',async()=>{
 const x=make();await x.start();assert.equal(x.life.scripts.instances.has('a'),false)
 await x.scene._play(x.scene.sources.get('a'));const v=x.scene.sources.get('a').voice;x.engine.ctx.sources[0].end();await v.done;await microtasks();assert.equal(x.events.at(-1),'finished');x.stop()
})
test('SIG-AUD-11: el arranque prepara conexiones antes de playOnStart',()=>{
 const code=read('src/engine/runtime/events/play.js')
 assert.ok(code.indexOf('this.ed.nodeLifecycle.start()')<code.indexOf('this.audio.resetSources()'))
 assert.match(code,/await this\.audio\.start\(\{ deferSources: true \}\)/)
})
test('SIG-AUD-12: otra fuente no vinculada al nodo no crea finished',async()=>{
 const x=make();await x.start();const v=x.engine._voice({duration:1},{group:'ui',mode:'ui'});x.engine.ctx.sources[0].end();await v.done;await microtasks()
 assert.equal(x.events.length,1);x.stop()
})
test('SIG-AUD-13: STOP y cambio de escena invalidan tokens',async()=>{
 const x=make();await x.start();await x.scene._play(x.scene.sources.get('a'));const v=x.scene.sources.get('a').voice
 x.scene.resetSources({keep:new Set()});await v.done;await microtasks();assert.equal(x.events.filter(v=>v==='finished').length,0);x.stop()
})
test('SIG-AUD-14: no añade listeners globales de audio ni encuestas por frame',()=>{
 for(const f of ['src/engine/runtime/audio/scene.js','src/engine/runtime/scene/node-scripts.js']){
  const code=read(f);assert.doesNotMatch(code,/addEventListener\(['"]ended|setInterval\(.*finished/)
 }
})
test('SIG-AUD-15: el registro de señales no suplanta a AudioScene ni al mezclador',()=>{
 assert.match(read('src/engine/runtime/scene/node-scripts.js'),/emitNativeAudioFinished\(obj\)/)
 assert.match(read('src/engine/runtime/audio/scene.js'),/v\.finishedNaturally && this\.on/)
 assert.match(read('src/engine/runtime/audio/engine.js'),/this\.finishedNaturally = true/)
})
