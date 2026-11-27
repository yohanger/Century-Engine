// G002: ready real y conexiones de escena antes de _ready; no hay segundo árbol ni EventBus.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { registerNode, getNativeSignals, getNativeSignal } from '../src/engine/runtime/nodes/registry.js'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
const read = f => readFileSync(new URL('../'+f, import.meta.url),'utf8')
registerNode({type:'lifeqa',label:'Life QA',create:()=>({}),build:()=>({}),update:()=>{}})
registerNode({type:'area3d',label:'Area QA',create:()=>({}),build:()=>({}),update:()=>{}})
const methods = vm.runInNewContext(read('src/engine/runtime/events/play-nodes.js').replace(/^import .*\n/gm,'').replace('export const nodesMethods','const nodesMethods')+'\nnodesMethods',{resolveNodePath:()=>null})
const obj=(id,scriptIds=[],parentId=null,type='lifeqa')=>({id,name:id,type,parentId,scriptIds})
const src=(id,code)=>({id,code,execution:'node'})
const link=(id,emitterId,receiverId,method='receive',signal='ready')=>({id,emitterId,receiverId,method,signal})
const receiver=src('receiver',"node.expose('receive',()=>game.record('signal:'+node.id));function _ready(){game.record('ready:'+node.id)}")
function fixture({objects=[obj('emitter'),obj('receiver',['receiver'])],scripts=[receiver],links=[link('link','emitter','receiver')], active=true}={}){
 const events=[], errors=[], project={objects,scripts,signalConnections:links,activeSceneId:'scene1'}
 const nodes=new Map(objects.map(o=>[o.id,{_lfNodeOwner:o}]))
 const play={project,on:true,_sceneSignalReady:active,_referenceSession:{},ed:{nodes},
  game:{api:{record:v=>events.push(v)},report:(e)=>errors.push(String(e.message||e))},
  pos:{},vp:{requestRender(){}},vm:{held:new Map()},_tagLayerApi:()=>({}),_animMethodsFor:()=>({}),_persistMarked:()=>false,_persistSet:()=>false}
 const life = new NodeLifecycle({nodes,host:{project}});play.ed.nodeLifecycle=life
 Object.assign(play,methods);play.game.api.node=id=>play._nodeHandle(id)
 life.scripts=new NodeScriptRuntime(play)
 const update=(items,links=project.signalConnections)=>{
  project.objects=items;project.signalConnections=links;nodes.clear();for(const o of items)nodes.set(o.id,{_lfNodeOwner:o});life.sync()
 }
 return {events,errors,project,nodes,play,life,update,start:()=>life.start(),stop:()=>life.stop()}
}
test('SIG-LIFE-01: catálogo ready común, sin argumentos y sin señal inventada en tipo desconocido',()=>{
 const meta=getNativeSignal('lifeqa','ready')
 assert.equal(meta?.source,'node-lifecycle');assert.deepEqual(meta.args,[])
 assert.equal(getNativeSignal('no-such-type','ready'),null)
})
test('SIG-LIFE-02: Area3D conserva cuatro señales Jolt y añade ready',()=>{
 const signals=getNativeSignals('area3d')
 assert.equal(signals.filter(s=>s.source==='jolt-area').length,4)
 assert.equal(signals.filter(s=>s.name==='ready').length,1)
})
test('SIG-LIFE-03: emisor sin script activa la primera conexión antes de ready',()=>{
 const x=fixture();x.start()
 assert.deepEqual(x.events,['ready:receiver','signal:receiver']);assert.equal(x.life.scripts.instances.has('emitter'),false)
 assert.equal(x.life.scripts.sceneConnections.size,1);assert.deepEqual(x.errors,[]);x.stop()
})
test('SIG-LIFE-04: ready se emite exactamente después del _ready propio',()=>{
 const x=fixture({objects:[obj('e',['e']),obj('r',['receiver'])],scripts:[receiver,src('e',"function _ready(){game.record('ready:e')}")],links:[link('link','e','r')]})
 x.start();assert.deepEqual(x.events,['ready:r','ready:e','signal:r']);x.stop()
})
test('SIG-LIFE-05: _enter_tree padre→hijo y ready hijo→padre',()=>{
 const code=id=>src(id,`function _enter_tree(){game.record('enter:${id}')}function _ready(){game.record('ready:${id}')}`)
 const x=fixture({objects:[obj('child',['child'],'parent'),obj('parent',['parent'])],scripts:[code('child'),code('parent')],links:[]})
 x.start();assert.deepEqual(x.events,['enter:parent','enter:child','ready:child','ready:parent']);x.stop()
})
test('SIG-LIFE-06: conexión por script existe desde _enter_tree y llega a ready',()=>{
 const x=fixture({objects:[obj('r',['receiver']),obj('e',['e'])],scripts:[receiver,src('e',"function _enter_tree(){node.connect('ready',game.node('r'),'receive')}")],links:[]})
 x.start();assert.deepEqual(x.events,['signal:r','ready:r']);assert.deepEqual(x.errors,[]);x.stop()
})
test('SIG-LIFE-07: un método expuesto demasiado tarde tiene diagnóstico y no recibe ready retroactivo',()=>{
 const x=fixture({objects:[obj('e'),obj('r',['r'])],scripts:[src('r',"function _ready(){node.expose('receive',()=>game.record('late'));game.record('ready:r')}")],links:[link('early','e','r')]})
 x.start();assert.deepEqual(x.events,['ready:r']);assert.match(x.errors[0],/Método receptor no publicado/)
 assert.equal(x.life.scripts.sceneConnections.size,1) // reintento posterior, sin reemitir ready
 x.stop()
})
test('SIG-LIFE-08: orden de 3 scripts en nodo emisor antes de señal ready',()=>{
 const scripts=['s1','s2','s3'].map(id=>src(id,`function _ready(){game.record('${id}')}`))
 const x=fixture({objects:[obj('e',['s1','s2','s3']),obj('r',['receiver'])],scripts:[...scripts,receiver],links:[link('c','e','r')]})
 x.start();assert.deepEqual(x.events,['ready:r','s1','s2','s3','signal:r']);x.stop()
})
test('SIG-LIFE-09: altas dinámicas conectan antes de ready y no repiten emisiones antiguas',()=>{
 const r=obj('r',['receiver']),x=fixture({objects:[r],links:[link('dynamic','e','r')]})
 x.start();assert.deepEqual(x.events,['ready:r']);x.update([r,obj('e')])
 assert.deepEqual(x.events,['ready:r','signal:r']);x.life.sync();assert.equal(x.events.length,2);x.stop()
})
test('SIG-LIFE-10: reentrada recrea ready una vez; Stop limpia conexiones y fuentes nativas',()=>{
 const x=fixture();x.start();x.update([x.project.objects[1]],[])
 assert.equal(x.life.scripts.nativeSources.size,0)
 x.update([obj('emitter'),x.project.objects[0]],[link('new','emitter','receiver')]);assert.equal(x.events.filter(v=>v==='signal:receiver').length,2)
 x.stop();assert.equal(x.life.scripts.nativeSources.size,0);assert.equal(x.life.scripts.sceneConnections.size,0)
})
test('SIG-LIFE-11: desconectar ready cancela la entrega',()=>{
 const e=obj('e'),r=obj('r',['receiver']),x=fixture({objects:[e,r],links:[]})
 x.start();assert.equal(x.play._nodeHandle('e').connect('ready',x.play._nodeHandle('r'),'receive'),true)
 assert.equal(x.play._nodeHandle('e').disconnect('ready',x.play._nodeHandle('r'),'receive'),true)
 assert.equal(x.life.scripts.nativeSources.size,0);x.stop()
})
test('SIG-LIFE-12: se prohíbe declarar ready personalizado y otros eventos nativos',()=>{
 const x=fixture({objects:[obj('a',['a'])],scripts:[src('a',"node.define_signal('ready')")],links:[]})
 x.start();assert.match(x.errors[0],/Señal nativa reservada/);x.stop()
})
test('SIG-LIFE-13: no se añaden registros por fotograma',()=>{
 const x=fixture();x.start();const n=x.life.scripts.nativeSources.size
 x.life.process(.016);x.life.physicsProcess(.016);assert.equal(x.life.scripts.nativeSources.size,n);x.stop()
})
test('SIG-LIFE-14: Play inicia conexiones antes de NodeLifecycle.start',()=>{
 const s=read('src/engine/runtime/events/play.js');assert.match(s,/this\._sceneSignalReady = true\s+this\.ed\.nodeLifecycle\.start\(\)/)
})
test('SIG-LIFE-15: cambio de escena activa conexiones antes de switchScene',()=>{
 const s=read('src/engine/runtime/events/play-nodes.js');assert.match(s,/this\._sceneSignalReady = true\s+try \{ ok = await this\.rt\.switchScene/)
})
test('SIG-LIFE-16: fase de conexiones situada entre todas las entradas y los ready',()=>{
 const s=read('src/engine/runtime/scene/node-lifecycle.js');const enter=s.indexOf("this._call(obj, 'onEnterTree')"),connect=s.indexOf('this.scripts?.syncSceneConnections?.()',enter),ready=s.indexOf("this._call(obj, 'onReady')",connect)
 assert.ok(enter<connect&&connect<ready)
})
test('SIG-LIFE-17: no se modifica el esquema persistente',()=>{
 assert.match(read('src/engine/runtime/scene/node-scripts.js'),/this\.play\.project\.signalConnections \|\| \[\]/)
})
test('SIG-LIFE-18: errores de conexiones se deduplican y no se pierde autoría',()=>{
 const x=fixture({links:[link('invalid','emitter','receiver','notHere')]});x.start()
 assert.equal(x.life.scripts.sceneConnections.size,0);assert.equal(x.project.signalConnections.length,1)
 assert.equal(x.errors.length,1);x.life.sync();assert.equal(x.errors.length,1);x.stop()
})
