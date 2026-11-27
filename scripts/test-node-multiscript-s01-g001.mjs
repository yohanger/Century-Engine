// QA S01-G001 — múltiples instancias reales sobre NodeScriptRuntime/NodeLifecycle existentes.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { Game } from '../src/engine/runtime/events/interpreter.js'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime, nodeScriptIds } from '../src/engine/runtime/scene/node-scripts.js'
import { registerNode } from '../src/engine/runtime/nodes/registry.js'
registerNode({type:'multiscriptQA',label:'Multiscript QA',create:()=>({}),build:()=>({}),update:()=>{}})
const read=(file)=>readFileSync(new URL('../'+file, import.meta.url),'utf8')
const methodsSource=read('src/engine/runtime/events/play-nodes.js').replace(/^import .*\n/gm,'').replace('export const nodesMethods','const nodesMethods')
const methods=vm.runInNewContext(methodsSource+'\nnodesMethods',{resolveNodePath:()=>null})
const n=(id,ids=[],parentId=null)=>({id,name:id,type:'multiscriptQA',parentId,scriptIds:ids})
const s=(id,code)=>({id,execution:'node',name:`${id}.js`,code})
function fixture(objects,scripts){
 const records=[],errors=[],project={objects,scripts,signalConnections:[],activeSceneId:'uno'}
 const nodes=new Map(objects.map(obj=>[obj.id,{_lfNodeOwner:obj}]))
 const life=new NodeLifecycle({host:{project},nodes})
 const game=new Game({host:{error:(message,error)=>errors.push([message,error?.message || String(error)])}})
 game.api.record=(...v)=>records.push(v)
 const play={on:true,_referenceSession:{},project,ed:{nodes,nodeLifecycle:life},game,
  _tagLayerApi:()=>({}),_animMethodsFor:()=>({}),_persistMarked:()=>false,_persistSet:()=>{},
  vm:{held:new Map()},pos:{},vp:{requestRender(){}}}
 Object.assign(play,methods);play.game.api.node=(id)=>play._nodeHandle(id)
 life.scripts=new NodeScriptRuntime(play)
 const sync=(objectsNew)=>{project.objects=objectsNew;nodes.clear();for(const o of objectsNew)nodes.set(o.id,{_lfNodeOwner:o});life.sync()}
 return {records,errors,project,nodes,life,play,game,sync,stop:()=>life.stop(),handle:(id)=>play._nodeHandle(id)}
}
const TRACE=(name)=>`let counter=0;function _enter_tree(){game.record('${name}:enter')};function _ready(){game.record('${name}:ready')};function _process(){game.record('${name}:frame:'+ ++counter)};function _exit_tree(){game.record('${name}:exit')}`
test('MS-01 · lectura de scriptId legado y scriptIds como fuente preferente',()=>{
 assert.deepEqual(nodeScriptIds({scriptId:'s'}),['s']);assert.deepEqual(nodeScriptIds({scriptId:'s',scriptIds:['a','b']}),['a','b'])
 assert.deepEqual(nodeScriptIds({scriptId:'s',scriptIds:[]}),[])
})
test('MS-02 · tres scripts se evalúan/entran/listan en orden',()=>{
 const x=fixture([n('a',['A','B','C'])],[s('A',TRACE('A')),s('B',TRACE('B')),s('C',TRACE('C'))]);x.life.start()
 assert.deepEqual(x.records.map(v=>v[0]),['A:enter','B:enter','C:enter','A:ready','B:ready','C:ready']);assert.equal(x.life.scripts.instances.get('a').slots.length,3);x.stop()
})
test('MS-03 · padre e hijo preservan recorrido y scripts ordenados',()=>{
 const x=fixture([n('child',['C','D'],'parent'),n('parent',['A','B'])],[s('A',TRACE('A')),s('B',TRACE('B')),s('C',TRACE('C')),s('D',TRACE('D'))]);x.life.start()
 assert.deepEqual(x.records.map(v=>v[0]).slice(0,8),['A:enter','B:enter','C:enter','D:enter','C:ready','D:ready','A:ready','B:ready']);x.stop()
})
test('MS-04 · cierre inverso de scripts en orden hijos→padres',()=>{
 const x=fixture([n('p',['A','B']),n('c',['C'],'p')],[s('A',TRACE('A')),s('B',TRACE('B')),s('C',TRACE('C'))]);x.life.start();x.records.length=0;x.stop()
 assert.deepEqual(x.records.map(v=>v[0]),['C:exit','B:exit','A:exit']);assert.equal(x.life.scripts.instances.size,0)
})
test('MS-05 · cada script conserva estado privado (mismo recurso en nodos distintos)',()=>{
 const x=fixture([n('a',['A','B']),n('b',['A'])],[s('A',`let n=0;node.expose('aumento',()=>++n)`),s('B',`let privateB=7;node.expose('valorB',()=>++privateB)`)]);x.life.start()
 assert.equal(x.handle('a').call('aumento'),1);assert.equal(x.handle('a').call('valorB'),8)
 assert.equal(x.handle('b').call('aumento'),1);assert.equal(x.handle('a').call('aumento'),2);x.stop()
})
test('MS-06 · métodos de distintos scripts visibles por node.call',()=>{
 const x=fixture([n('a',['A','B'])],[s('A',`node.expose('primero',()=>2)`),s('B',`node.expose('segundo',(n)=>n*3)`)]);x.life.start()
 assert.equal(x.handle('a').call('primero'),2);assert.equal(x.handle('a').call('segundo',4),12);x.stop()
})
test('MS-07 · colisión de métodos públicos no elige ningún propietario',()=>{
 const x=fixture([n('a',['A','B'])],[s('A',`node.expose('mismo',()=>1)`),s('B',`node.expose('mismo',()=>2)`)]);x.life.start()
 assert.equal(x.errors.length,1);assert.match(JSON.stringify(x.errors),/A.*B|B.*A/)
 assert.throws(()=>x.handle('a').call('mismo'),/ambiguo/);assert.equal(x.life.scripts.instances.get('a').methods.has('mismo'),false);x.stop()
})
test('MS-08 · señales duplicadas por scripts diferentes se invalidan explícitamente',()=>{
 const x=fixture([n('a',['A','B'])],[s('A',`node.define_signal('alerta')`),s('B',`node.define_signal('alerta')`)]);x.life.start()
 assert.equal(x.errors.length,1);assert.match(JSON.stringify(x.errors),/ambigua/)
 assert.throws(()=>x.life.scripts.emitSignal(x.project.objects[0],'alerta',[]),/no declarada/);x.stop()
})
test('MS-09 · los scripts de un nodo comparten espacio público de Signals',()=>{
 const x=fixture([n('a',['A','B']),n('b',['C'])],[s('A',`node.define_signal('alerta')`),s('B',`node.expose('emitir',(v)=>node.emit_signal('alerta',v))`),s('C',`node.expose('recibir',(v)=>game.record('recibido',v))`)]);x.life.start()
 const a=x.handle('a'),b=x.handle('b');assert.equal(a.connect('alerta',b,'recibir'),true)
 a.call('emitir',42);assert.deepEqual(x.records,[['recibido',42]]);x.stop()
})
test('MS-10 · solo callbacks periódicos reales se registran, sin escaneo por script',()=>{
 const x=fixture([n('a',['A','B','C']),n('b',['B'])],[s('A',`game.record('eval')`),s('B',`function _process(){game.record('frame')}`),s('C',`function _physics_process(){game.record('fixed')}`)]);x.life.start();x.records.length=0
 assert.equal(x.life.processEntries.size,2);assert.equal(x.life.physicsEntries.size,1)
 x.life.process(.016);x.life.physicsProcess(.02);assert.deepEqual(x.records,[['frame'],['frame'],['fixed']]);x.stop()
})
test('MS-11 · cambiar orden scriptIds implica reentrada determinista',()=>{
 const a=n('a',['A','B']),x=fixture([a],[s('A',TRACE('A')),s('B',TRACE('B'))]);x.life.start();x.records.length=0
 a.scriptIds.reverse();x.life.sync();assert.deepEqual(x.records.map(v=>v[0]),['B:exit','A:exit','B:enter','A:enter','B:ready','A:ready']);x.stop()
})
test('MS-12 · error de evaluación de un script no bloquea los demás',()=>{
 const x=fixture([n('a',['BAD','GOOD'])],[s('BAD',`node.expose('fuga',()=>true);throw Error('boom')`),s('GOOD',`node.expose('listo',()=>8);function _ready(){game.record('good')}`)]);x.life.start()
 assert.equal(x.errors.length,1);assert.equal(x.handle('a').call('listo'),8);assert.throws(()=>x.handle('a').call('fuga'),/no encontrado/)
 assert.deepEqual(x.records,[['good']]);x.stop()
})
test('MS-13 · script inexistente o global no impide crear los válidos',()=>{
 const x=fixture([n('a',['MISSING','GLOBAL','GOOD'])],[{id:'GLOBAL',execution:'global',code:''},s('GOOD',`node.expose('listo',()=>5)`)]);x.life.start()
 assert.equal(x.errors.length,2);assert.equal(x.handle('a').call('listo'),5);x.stop()
})
test('MS-14 · script repetido en mismo nodo no crea dos instancias',()=>{
 const x=fixture([n('a',['A','A'])],[s('A',TRACE('A'))]);x.life.start()
 assert.equal(x.errors.length,1);assert.equal(x.life.scripts.instances.get('a').slots.length,1)
 assert.equal(x.records.filter(v=>v[0]==='A:enter').length,1);x.stop()
})
test('MS-15 · eliminar/recrear el nodo limpia conexiones de señales antiguas',()=>{
 const a=n('a',['A','B']),b=n('b',['C'])
 const x=fixture([a,b],[s('A',`node.define_signal('alerta')`),s('B',`node.expose('emitir',()=>node.emit_signal('alerta',7))`),s('C',`node.expose('recv',(v)=>game.record(v))`)]);x.life.start()
 x.handle('a').connect('alerta',x.handle('b'),'recv');x.sync([b]);assert.equal(x.life.scripts.instances.get('b').incomingSignals.size,0)
 const second=n('a',['A','B']);x.sync([b,second]);x.handle('a').call('emitir');assert.deepEqual(x.records,[]);x.stop()
})
test('MS-16 · stop/play libera todas las instancias de los scripts',()=>{
 const x=fixture([n('a',['A','B'])],[s('A',TRACE('A')),s('B',TRACE('B'))]);x.life.start();const before=x.life.scripts.instances.get('a')
 x.stop();assert.equal(x.life.scripts.instances.size,0);x.life.start();assert.notEqual(x.life.scripts.instances.get('a'),before);x.stop()
})
test('MS-17 · cambiar scriptIds invalida inmediatamente las llamadas previas',()=>{
 const a=n('a',['A']),x=fixture([a],[s('A',`node.expose('antiguo',()=>1)`),s('B',`node.expose('nuevo',()=>2)`)]);x.life.start()
 a.scriptIds=['B'];assert.throws(()=>x.handle('a').call('antiguo'),/no disponible/)
 x.life.sync();assert.equal(x.handle('a').call('nuevo'),2);x.stop()
})
test('MS-18 · suscripciones game.on por script se cancelan tras Stop',async()=>{
 const x=fixture([n('a',['A','B'])],[s('A',`game.on('event',()=>game.record('A'))`),s('B',`game.on('event',()=>game.record('B'))`)]);x.life.start()
 await x.game.signal('event');assert.deepEqual(x.records,[['A'],['B']]);x.stop();assert.equal(x.game.listeners.get('event').length,0)
 await x.game.signal('event');assert.equal(x.records.length,2)
})
test('MS-19 · waitFor de cada script cancela por instancia',async()=>{
 const x=fixture([n('a',['A','B'])],[s('A',`game.waitFor('go',60).then(v=>game.record('A',v))`),s('B',`game.waitFor('go',60).then(v=>game.record('B',v))`)]);x.life.start()
 assert.equal(x.game.waiters.get('go').length,2);x.stop();await new Promise(r=>setImmediate(r))
 assert.equal(x.game.waiters.get('go')?.length || 0,0);assert.deepEqual(x.records.map(v=>v[0]).sort(),['A','B']);assert.ok(x.records.every(v=>v[1]===undefined))
})
test('MS-20 · sin scriptId ni scriptIds mantiene coste periódico cero',()=>{
 const x=fixture([n('a',[]),{id:'b',name:'b',type:'multiscriptQA',parentId:null}],[]);x.life.start()
 assert.equal(x.life.scripts.instances.size,0);assert.equal(x.life.processEntries.size,0);assert.equal(x.life.physicsEntries.size,0);x.stop()
})
test('MS-21 · G002 extiende autoría sin alterar despacho de G001',()=>{
 assert.match(read('src/components/Inspector.vue'),/authoredNodeScriptIds/)
 assert.match(read('src/engine/runtime/nodes/index.js'),/scriptIds: \[\]/)
 assert.match(read('src/engine/runtime/scene/node-lifecycle.js'),/nodeScriptIds\(obj\)/)
})
