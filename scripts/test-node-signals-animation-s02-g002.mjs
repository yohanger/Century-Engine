// Animation S02-G002: las señales salen de AnimRunner/ModelRunner reales o equivalentes del harness.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { AnimRunner } from '../src/engine/runtime/anim/eval.js'
import { registerNode, getNativeSignal, getNativeSignals } from '../src/engine/runtime/nodes/registry.js'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
registerNode({type:'animqa',create:()=>({}),build:()=>({}),update:()=>{}})
registerNode({type:'area3d',create:()=>({}),build:()=>({}),update:()=>{}})
const methods=vm.runInNewContext(read('src/engine/runtime/events/play-nodes.js').replace(/^import .*\n/gm,'').replace('export const nodesMethods','const nodesMethods')+'\nnodesMethods',{resolveNodePath:()=>null})
const modelInstances=[]
class FakeModelRunner {
 constructor(mixer,root,mc,modelId,opts){this.clip={name:mc.desc.name,id:`model:${modelId}:${mc.desc.name}`,model:true,tracks:[]};this.host={};this.mixer=mixer;this.root=root;this.finished=false;this.stopped=false;this.loop=!!opts.loop;this.paused=false;this.done=new Promise(res=>this.resolve=res);modelInstances.push(this)}
 finish(stopped){if(this.finished)return;this.finished=true;this.stopped=stopped;this.resolve({stopped,clip:this.clip.name});this.host.end?.(this,stopped)}
 stop(){this.finish(true)}pause(){this.paused=true}resume(){this.paused=false}seek(){}update(){}
 dispose(){this.finished=true;this.resolve({stopped:true,clip:this.clip.name})}
}
const animMethods=vm.runInNewContext(read('src/engine/runtime/events/play-anim.js').replace(/^import .*\n/gm,'').replace('export const animMethods','const animMethods')+'\nanimMethods',{
 THREE:{Euler:class{}},AnimRunner,ModelRunner:FakeModelRunner,findClip:(list,name)=>list?.find(c=>c.name===name||c.id===name),PROPS:{},DEG:Math.PI/180,findModelClip:()=>null,describeClips:()=>[],resetPose:()=>{},resolveGraphic:()=>null,console
})
const node=(id,scriptIds=[],type='animqa')=>({id,type,name:id,parentId:null,scriptIds})
const clip=(id,dur=1,loop=false)=>({id,name:id,duration:dur,speed:1,loop,tracks:[],events:[]})
const connect=(id,e,r='receiver',name='animation_finished')=>({id,emitterId:e,receiverId:r,signal:name,method:'onAnimation'})
const rScript=(id='rs')=>({id,execution:'node',code:"node.expose('onAnimation', name=>game.record('finished:'+name))"})
function fixture({objects=[node('emitter'),node('receiver',['rs'])],scripts=[rScript()],animations=[clip('Wave'),clip('Idle'),clip('Run')],links=[connect('link','emitter')]}={}) {
 const events=[],errors=[],project={objects,scripts,animations,signalConnections:links,activeSceneId:'scene'}
 const nodes=new Map(objects.map(o=>[o.id,{_lfNodeOwner:o}]))
 const play={project,on:true,_sceneSignalReady:true,_referenceSession:{},ed:{nodes,modelClips:new Map()},game:{api:{record:v=>events.push(v)},report:e=>errors.push(String(e.message||e))},vm:{slots:new Map(),held:new Map()},pos:{},vp:{requestRender(){}},_tagLayerApi:()=>({}),_persistMarked:()=>false,_persistSet:()=>false, _lightHandle:()=>null,
  _vmTarget:(target)=>({obj:objects.find(o=>o.id===(typeof target==='string'?target:target?.id))})}
 const life=new NodeLifecycle({nodes,host:{project}});play.ed.nodeLifecycle=life;Object.assign(play,methods,animMethods);play.game.api.node=id=>play._nodeHandle(id);play._animInit()
 life.scripts=new NodeScriptRuntime(play);life.start()
 return {play,life,events,errors,project,nodes,objects,stop:()=>{life.stop();play.on=false;play._animReset()}}
}
test('SIG-ANIM-01: metadata común sin tipo falso ni reproductor adicional',()=>{
 const m=getNativeSignal('animqa','animation_finished');assert.equal(m?.source,'animation-runner');assert.equal(m?.phase,'natural-end');assert.equal(m?.args[0]?.name,'clipName');assert.equal(m.args[0].type,'string')
 assert.equal(getNativeSignal('unknown','animation_finished'),null)
})
test('SIG-ANIM-02: AnimRunner real emite una vez al terminar',()=>{
 const x=fixture();x.play.animationPlay('emitter','Wave');x.play._animTick(1.1);assert.deepEqual(x.events,['finished:Wave']);x.play._animTick(.5);assert.equal(x.events.length,1);x.stop()
})
test('SIG-ANIM-03: finalización después de _ready y sin script en emisor',()=>{
 const x=fixture();assert.equal(x.life.scripts.instances.has('emitter'),false);assert.equal(x.life.scripts.sceneConnections.size,1)
 x.play.animationPlay('emitter','Idle');x.play._animTick(1.1);assert.deepEqual(x.events,['finished:Idle']);x.stop()
})
test('SIG-ANIM-04: stopAnimation no emite',()=>{
 const x=fixture();x.play.animationPlay('emitter','Wave');x.play.animationStop('emitter','Wave');x.play._animTick(2);assert.deepEqual(x.events,[]);x.stop()
})
test('SIG-ANIM-05: loop de claves no emite al repetirse',()=>{
 const x=fixture({animations:[clip('Loop',.2,true)]});x.play.animationPlay('emitter','Loop');x.play._animTick(1.2);assert.deepEqual(x.events,[]);x.play.animationStop('emitter','Loop');x.stop()
})
test('SIG-ANIM-06: pausa y reanudación',()=>{
 const x=fixture();const h=x.play.animationPlay('emitter','Wave');h.pause();x.play._animTick(2);assert.deepEqual(x.events,[]);h.resume();x.play._animTick(1.1);assert.deepEqual(x.events,['finished:Wave']);x.stop()
})
test('SIG-ANIM-07: reemplazar mismo clip cancela el anterior',()=>{
 const x=fixture();const first=x.play.animationPlay('emitter','Wave');const second=x.play.animationPlay('emitter','Wave');assert.equal(first.finished,true);assert.equal(second.finished,false)
 x.play._animTick(1.1);assert.deepEqual(x.events,['finished:Wave']);x.stop()
})
test('SIG-ANIM-08: dos clips concurrentes entregan dos nombres distintos',()=>{
 const x=fixture();x.play.animationPlay('emitter','Wave');x.play.animationPlay('emitter','Run');x.play._animTick(1.1);assert.deepEqual(x.events,['finished:Wave','finished:Run']);x.stop()
})
test('SIG-ANIM-09: cambio de sesión descarta final tardío',()=>{
 const x=fixture();x.play.animationPlay('emitter','Wave');x.play._referenceSession={};x.play._animTick(1.1);assert.deepEqual(x.events,[]);x.stop()
})
test('SIG-ANIM-10: ID reutilizado no redirige la señal',()=>{
 const x=fixture();x.play.animationPlay('emitter','Wave');const old=x.objects[0];const replacement={...old};x.project.objects[0]=replacement;x.nodes.set(old.id,{_lfNodeOwner:replacement})
 x.play._animTick(1.1);assert.deepEqual(x.events,[]);x.stop()
})
test('SIG-ANIM-11: si el nodo sale del árbol no emite',()=>{
 const x=fixture();x.play.animationPlay('emitter','Wave');x.project.objects.splice(0,1);x.nodes.delete('emitter');x.life.sync();x.play._animTick(1.1);assert.deepEqual(x.events,[]);x.stop()
})
test('SIG-ANIM-12: Stop del Player impide una emisión diferida',()=>{
 const x=fixture();x.play.animationPlay('emitter','Wave');x.play.on=false;x.play._animReset();assert.deepEqual(x.events,[]);x.life.stop()
})
test('SIG-ANIM-13: slot ViewModel no es emisor nativo',()=>{
 const x=fixture();x.play._vmSlot=()=>({id:'right',anchor:{}});x.play.animationPlay({slotId:'right'},'Wave');x.play._animTick(1.1);assert.deepEqual(x.events,[]);x.stop()
})
test('SIG-ANIM-14: ModelRunner: final de clip y argumento',()=>{
 const x=fixture();x.play._modelClip=(root,name)=>({obj:root.obj,mr:{},modelId:'model1',desc:{name},clip:{}});x.play._mixerFor=()=>({})
 x.play.animationPlay('emitter','A-GLB');const last=modelInstances.at(-1);last.finish(false);assert.deepEqual(x.events,['finished:A-GLB']);last.finish(false);assert.equal(x.events.length,1);x.stop()
})
test('SIG-ANIM-15: ModelRunner: stop y reemplazo por capa no emiten',()=>{
 const x=fixture();x.play._modelClip=(root,name)=>({obj:root.obj,mr:{},modelId:'model1',desc:{name},clip:{}});x.play._mixerFor=()=>({})
 x.play.animationPlay('emitter','A-GLB',{layer:'main'});const first=modelInstances.at(-1);x.play.animationPlay('emitter','B-GLB',{layer:'main'});const second=modelInstances.at(-1)
 assert.equal(first.stopped,true);second.stop();assert.deepEqual(x.events,[]);x.stop()
})
test('SIG-ANIM-16: ModelRunner: dos capas independientes emiten por clip',()=>{
 const x=fixture();x.play._modelClip=(root,name)=>({obj:root.obj,mr:{},modelId:'model1',desc:{name},clip:{}});x.play._mixerFor=()=>({})
 x.play.animationPlay('emitter','A-GLB',{layer:'upper'});const first=modelInstances.at(-1);x.play.animationPlay('emitter','B-GLB',{layer:'lower'});const second=modelInstances.at(-1)
 second.finish(false);first.finish(false);assert.deepEqual(x.events,['finished:B-GLB','finished:A-GLB']);x.stop()
})
test('SIG-ANIM-17: suscriptor desconectado no recibe el evento',()=>{
 const x=fixture();assert.equal(x.play._nodeHandle('emitter').disconnect('animation_finished',x.play._nodeHandle('receiver'),'onAnimation'),true)
 x.play.animationPlay('emitter','Wave');x.play._animTick(1.1);assert.deepEqual(x.events,[]);x.stop()
})
test('SIG-ANIM-18: Multiscript en receptor preserva su método expuesto',()=>{
 const x=fixture({objects:[node('emitter'),node('receiver',['noOp','rs'])],scripts:[{id:'noOp',execution:'node',code:'function _ready(){}'},rScript()]})
 x.play.animationPlay('emitter','Wave');x.play._animTick(1.1);assert.deepEqual(x.events,['finished:Wave']);x.stop()
})
test('SIG-ANIM-19: conflicto de Custom Signal no altera el proyecto y informa diagnóstico',()=>{
 const custom={id:'custom',execution:'node',code:"node.define_signal('animation_finished')"};const x=fixture({objects:[node('emitter',['custom'])],scripts:[custom],links:[]})
 assert.equal(x.project.scripts[0],custom);assert.equal(x.project.scripts[0].code,custom.code);assert.ok(x.errors.some(e=>e.includes('Señal nativa reservada')));x.stop()
})
test('SIG-ANIM-20: metadata compartida no afecta Area3D, Audio ni ready',()=>{
 assert.equal(getNativeSignals('area3d').filter(s=>s.source==='jolt-area').length,4)
 assert.equal(getNativeSignal('animqa','ready')?.source,'node-lifecycle')
 assert.equal(getNativeSignal('animqa','finished'),null)
})
test('SIG-ANIM-21: no añade escaneo por fotograma para callbacks',()=>{
 for(const name of ['src/engine/runtime/nodes/registry.js','src/engine/runtime/scene/node-scripts.js','src/engine/runtime/events/play-anim.js'])assert.doesNotMatch(read(name),/setInterval\(|requestAnimationFrame\(/)
})
test('SIG-ANIM-22: final natural usa mecanismos existentes y no modifica mixadores',()=>{
 assert.match(read('src/engine/runtime/events/play-anim.js'),/new AnimRunner\(/)
 assert.match(read('src/engine/runtime/events/play-anim.js'),/new ModelRunner\(/)
 assert.match(read('src/engine/runtime/scene/node-scripts.js'),/emitNativeAnimationFinished\(obj, clipName\)/)
 assert.match(read('src/engine/runtime/nodes/registry.js'),/NODE_ANIMATION_FINISHED_SIGNAL/)
})
