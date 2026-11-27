// LF-NODE-CUSTOM-SIGNALS-S04-G001: contrato de instancia, identidad y despacho de señales locales.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
import { registerNode } from '../src/engine/runtime/nodes/registry.js'

registerNode({type:'s04SignalNode',label:'QA S04',create:()=>({}),build:()=>({}),update:()=>{}})
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const src=read('src/engine/runtime/events/play-nodes.js').replace(/^import .*\n/gm,'').replace('export const nodesMethods','const nodesMethods')
const methods=vm.runInNewContext(src+'\nnodesMethods',{resolveNodePath:()=>null})
const obj=(id,scriptId=id,parentId=null)=>({id,name:id,type:'s04SignalNode',parentId,scriptId})
const js=(id,code)=>({id,execution:'node',code})
function setup(objects,scripts,extraApi={}) {
  const events=[],errors=[]
  const project={activeSceneId:'uno',objects,scripts}
  const nodes=new Map(objects.map(o=>[o.id,{_lfNodeOwner:o}]))
  const life=new NodeLifecycle({host:{project},nodes})
  const play={on:true,_referenceSession:{},project,ed:{nodes,nodeLifecycle:life},
    game:{api:{record:(...args)=>events.push(args),...extraApi},report:(e,at)=>errors.push([e.message,at])},
    _animMethodsFor:()=>({}),_tagLayerApi:()=>({}),_persistMarked:()=>false,_persistSet:()=>false,
    vm:{held:new Map()},pos:{},vp:{requestRender(){}}}
  Object.assign(play,methods);play.game.api.node=(name)=>play._nodeHandle(name)
  life.scripts=new NodeScriptRuntime(play);life.start()
  const replace=(items)=>{
    project.objects=items
    for(const id of [...nodes.keys()]) if(!items.some(o=>o.id===id))nodes.delete(id)
    for(const o of items)if(nodes.get(o.id)?._lfNodeOwner!==o)nodes.set(o.id,{_lfNodeOwner:o})
    life.sync()
  }
  return {play,life,project,nodes,events,errors,replace,h:(id)=>play._nodeHandle(id)}
}
const emitter=js('a',`node.define_signal('cambio');node.expose('emitir',(...args)=>node.emit_signal('cambio',...args));node.expose('conectar',()=>game.node('a').connect('cambio',game.node('b'),'recibir'))`)
const receiver=js('b',`let total=0;node.expose('recibir',(n=1)=>{total+=n;game.record('b',total)});node.expose('total',()=>total)`)
const pair=()=>setup([obj('a'),obj('b')],[emitter,receiver])

test('SIG-01 · declaración, conexión y argumentos en el mismo runtime',()=>{
  const x=pair();assert.equal(x.h('a').connect('cambio',x.h('b'),'recibir'),true)
  x.h('a').call('emitir',3);x.h('a').call('emitir',4)
  assert.deepEqual(x.events,[['b',3],['b',7]]);x.life.stop()
})
test('SIG-02 · nombres vacíos, repetidos y no declarados se rechazan',()=>{
  const x=setup([obj('a')],[js('a',`node.define_signal('ok');for(const name of ['ok','', ' mal ',null])try{node.define_signal(name)}catch(e){game.record(e.message)}`)])
  assert.equal(x.events.length,4)
  assert.throws(()=>x.life.scripts.emitSignal(x.project.objects[0],'inexistente',[]),/no declarada/)
  x.life.stop()
})
test('SIG-03 · receptor exige método publicado y referencia vigente',()=>{
  const x=pair(),a=x.h('a'),b=x.h('b')
  assert.throws(()=>a.connect('cambio',b,'privado'),/no publicado/)
  assert.throws(()=>a.connect('inexistente',b,'recibir'),/no declarada/)
  assert.throws(()=>a.connect('cambio',{},'recibir'),/inválido/)
  x.life.stop()
})
test('SIG-04 · conexión duplicada no crea dos entregas',()=>{
  const x=pair(),a=x.h('a'),b=x.h('b');assert.equal(a.connect('cambio',b,'recibir'),true)
  assert.equal(a.connect('cambio',b,'recibir'),false);a.call('emitir',2)
  assert.deepEqual(x.events,[['b',2]]);x.life.stop()
})
test('SIG-05 · desconexión explícita es idempotente',()=>{
  const x=pair(),a=x.h('a'),b=x.h('b');a.connect('cambio',b,'recibir')
  assert.equal(a.disconnect('cambio',b,'recibir'),true)
  assert.equal(a.disconnect('cambio',b,'recibir'),false)
  a.call('emitir',3);assert.equal(x.events.length,0);x.life.stop()
})
test('SIG-06 · destruir emisor limpia las conexiones salientes',()=>{
  const a=obj('a'),b=obj('b'),x=setup([a,b],[emitter,receiver]);x.h('a').connect('cambio',x.h('b'),'recibir')
  const source=x.life.scripts.instances.get('a'),target=x.life.scripts.instances.get('b')
  x.replace([b]);assert.equal(source.signals.size,0);assert.equal(target.incomingSignals.size,0)
  x.life.stop()
})
test('SIG-07 · destruir receptor limpia ambas direcciones',()=>{
  const a=obj('a'),b=obj('b'),x=setup([a,b],[emitter,receiver]);x.h('a').connect('cambio',x.h('b'),'recibir')
  const source=x.life.scripts.instances.get('a');x.replace([a]);assert.equal(source.signals.get('cambio').size,0)
  x.h('a').call('emitir',3);assert.deepEqual(x.events,[]);x.life.stop()
})
test('SIG-08 · reutilización del ID no recupera conexiones viejas',()=>{
  const a=obj('a'),b=obj('b'),x=setup([a,b],[emitter,receiver]);x.h('a').connect('cambio',x.h('b'),'recibir')
  x.replace([a,obj('b')]);x.h('a').call('emitir',8);assert.equal(x.events.length,0)
  assert.equal(x.h('b').call('total'),0);x.life.stop()
})
test('SIG-09 · cambiar de escena invalida conexiones desmontadas',()=>{
  const a=obj('a'),b=obj('b'),x=setup([a,b],[emitter,receiver]);x.h('a').connect('cambio',x.h('b'),'recibir')
  x.project.activeSceneId='dos';x.replace([])
  assert.equal(x.life.scripts.instances.size,0);x.life.stop()
})
test('SIG-10 · reparentar y reintegrar no retiene conexiones anteriores',()=>{
  const a=obj('a'),b=obj('b'),x=setup([a,b],[emitter,receiver]);x.h('a').connect('cambio',x.h('b'),'recibir')
  b.parentId='a';x.life.sync();x.h('a').call('emitir',1)
  assert.equal(x.events.length,0);x.life.stop()
})
test('SIG-11 · Stop/Play libera conexiones y no revive handles',()=>{
  const x=pair(),old=x.h('a');old.connect('cambio',x.h('b'),'recibir');x.life.stop()
  x.play.on=false;x.play._referenceSession=null;assert.equal(old.is_valid(),false)
  x.play.on=true;x.play._referenceSession={};x.life.start()
  assert.throws(()=>old.connect('cambio',x.h('b'),'recibir'),/inválida/)
  x.h('a').call('emitir',1);assert.equal(x.events.length,0);x.life.stop()
})
test('SIG-12 · varios receptores mantienen orden de conexión',()=>{
  const x=setup([obj('a'),obj('b'),obj('c')],[emitter,js('b',`node.expose('recibir',()=>game.record('b'))`),js('c',`node.expose('recibir',()=>game.record('c'))`)])
  x.h('a').connect('cambio',x.h('c'),'recibir');x.h('a').connect('cambio',x.h('b'),'recibir')
  x.h('a').call('emitir');assert.deepEqual(x.events,[['c'],['b']]);x.life.stop()
})
test('SIG-13 · excepción síncrona de receptor no detiene otros',()=>{
  const x=setup([obj('a'),obj('b'),obj('c')],[emitter,js('b',`node.expose('recibir',()=>{throw Error('sincrono')})`),js('c',`node.expose('recibir',()=>game.record('c'))`)])
  x.h('a').connect('cambio',x.h('b'),'recibir');x.h('a').connect('cambio',x.h('c'),'recibir');x.h('a').call('emitir')
  assert.deepEqual(x.events,[['c']]);assert.match(x.errors[0][0],/sincrono/);x.life.stop()
})
test('SIG-14 · Promise rechazada se reporta sin bloquear receptor siguiente',async()=>{
  const x=setup([obj('a'),obj('b'),obj('c')],[emitter,js('b',`node.expose('recibir',()=>Promise.reject(Error('asíncrono')))`),js('c',`node.expose('recibir',()=>game.record('c'))`)])
  x.h('a').connect('cambio',x.h('b'),'recibir');x.h('a').connect('cambio',x.h('c'),'recibir');x.h('a').call('emitir')
  await Promise.resolve();await Promise.resolve();assert.deepEqual(x.events,[['c']]);assert.match(x.errors[0][0],/asíncrono/);x.life.stop()
})
test('SIG-15 · desconexión y conexión durante emisión respetan instantánea',()=>{
  const x=setup([obj('a'),obj('b'),obj('c'),obj('d')],[emitter,
    js('b',`node.expose('recibir',()=>{game.record('b');game.node('a').disconnect('cambio',game.node('c'),'recibir');game.node('a').connect('cambio',game.node('d'),'recibir')})`),
    js('c',`node.expose('recibir',()=>game.record('c'))`),js('d',`node.expose('recibir',()=>game.record('d'))`)])
  x.h('a').connect('cambio',x.h('b'),'recibir');x.h('a').connect('cambio',x.h('c'),'recibir')
  x.h('a').call('emitir');assert.deepEqual(x.events,[['b']]);x.h('a').call('emitir');assert.deepEqual(x.events,[['b'],['b'],['d']]);x.life.stop()
})
test('SIG-16 · señales anidadas ejecutan instantáneas independientes',()=>{
  const x=setup([obj('a'),obj('b')],[emitter,js('b',`let count=0;node.expose('recibir',()=>{game.record(++count);if(count===1)game.node('a').call('emitir')})`)])
  x.h('a').connect('cambio',x.h('b'),'recibir');x.h('a').call('emitir')
  assert.deepEqual(x.events,[[1],[2]]);x.life.stop()
})
test('SIG-17 · señal local no altera bus global y sin callbacks no hay barridos',()=>{
  const x=pair();x.h('a').connect('cambio',x.h('b'),'recibir');x.h('a').call('emitir',1)
  assert.equal(x.life.processEntries.size,0);assert.equal(x.life.physicsEntries.size,0)
  x.life.process(.016);x.life.physicsProcess(.02);assert.deepEqual(x.events,[['b',1]])
  assert.equal(x.play.game.api.emit_signal,undefined);assert.equal(x.h('a').define_signal,undefined)
  x.life.stop()
})
test('SIG-18 · fallo de evaluación y limpieza no retienen suscripciones',()=>{
  const a=obj('a'),x=setup([a],[js('a',`node.define_signal('hola');throw Error('fallo')`)])
  assert.equal(x.errors.length,1);assert.equal(x.life.scripts.instances.size,0);x.life.stop()
})
test('SIG-19 · firma de tipos y puntos de integración reutilizados',()=>{
  for(const file of ['src/core/events/game-api.d.ts','vscode-extension/media/game-api.d.ts']){
    assert.match(read(file),/connect\(name: string, receiver: NodeHandle, method: string\): boolean/)
    assert.match(read(file),/define_signal\(name: string\): void/)
    assert.match(read(file),/emit_signal\(name: string, \.\.\.args: any\[\]\): void/)
  }
  assert.match(read('src/engine/runtime/events/play-nodes.js'),/runtime\.connectSignal\(/)
})
