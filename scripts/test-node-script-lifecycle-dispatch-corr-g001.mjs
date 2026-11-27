import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Game } from '../src/engine/runtime/events/interpreter.js'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
import { registerNode } from '../src/engine/runtime/nodes/registry.js'

const trace = []
registerNode({ type:'corrNode', label:'Nodo', create:()=>({}), build:()=>({}), update:()=>{} })
registerNode({ type:'corrNative', label:'Nativo', create:()=>({}), build:()=>({}), update:()=>{},
  onProcess:o=>trace.push(`native-frame:${o.id}`), onPhysicsProcess:o=>trace.push(`native-fixed:${o.id}`) })
const obj=(id,scriptId='',parentId=null,type='corrNode')=>({id,name:id,type,scriptId,parentId})
const src=(id,code)=>({id,execution:'node',name:`${id}.js`,code})
const tick=()=>new Promise(r=>setImmediate(r))
function setup(objects,scripts){
  const project={objects,scripts}, nodes=new Map(objects.map(o=>[o.id,{}])),errors=[]
  const game=new Game({host:{error:(msg,e)=>errors.push([msg,e])}})
  const scene={host:{project},nodes}
  const play={project,game,_nodeEnabled:()=>true,_nodeHandle(id){return nodes.has(id)?{id,name:id}:null}}
  const life=new NodeLifecycle(scene);life.scripts=new NodeScriptRuntime(play)
  const sync=(objs)=>{project.objects=objs;nodes.clear();for(const o of objs)nodes.set(o.id,{});life.sync()}
  return {life,project,game,errors,scene,play,sync}
}

test('LC-01 · sin callbacks periódicos, registros vacíos incluso con 10000 nodos',()=>{
 const objects=Array.from({length:10000},(_,i)=>obj(String(i)))
 const x=setup(objects,[]);x.life.start()
 assert.equal(x.life.entered.size,10000)
 assert.equal(x.life.processEntries.size,0);assert.equal(x.life.physicsEntries.size,0)
 // Si se recorre entered por fotograma este test fallaría en lugar de confiar en mediciones relativas.
 const realValues=x.life.entered.values.bind(x.life.entered)
 x.life.entered.values=()=>{throw Error('scan O(N) prohibido en el frame')}
 x.life.process(.016);x.life.physicsProcess(.02)
 x.life.entered.values=realValues
 x.life.stop()
})
test('LC-02 · solo se registran los 20 scripts con _process y los 3 con _physics_process',()=>{
 const objects=Array.from({length:1000},(_,i)=>obj(String(i),i<20?'proc':i<23?'fixed':''))
 const x=setup(objects,[src('proc','function _process(dt){game.state.count=(game.state.count||0)+1}'),src('fixed','function _physics_process(dt){game.state.fixed=(game.state.fixed||0)+1}')])
 x.life.start();assert.equal(x.life.processEntries.size,20);assert.equal(x.life.physicsEntries.size,3)
 x.life.process(.01);x.life.physicsProcess(.02)
 assert.equal(x.game.state.count,20);assert.equal(x.game.state.fixed,3)
 x.life.stop()
})
test('LC-03 · callback nativo sin script permanece en ambos registros',()=>{
 trace.length=0;const x=setup([obj('fx','',null,'corrNative')],[]);x.life.start()
 assert.equal(x.life.processEntries.size,1);assert.equal(x.life.physicsEntries.size,1)
 x.life.process(.1);x.life.physicsProcess(.01)
 assert.deepEqual(trace,['native-frame:fx','native-fixed:fx']);x.life.stop()
})
test('LC-04 · nativo y script conservan el orden de cada nodo y padre/hijo',()=>{
 trace.length=0;const objects=[obj('child','s','parent','corrNative'),obj('parent','s',null,'corrNative')]
 const x=setup(objects,[src('s','function _process(){game.state.trace.push("script:"+node.id)}')]);x.game.state.trace=[]
 x.life.start();x.life.process(.1)
 assert.deepEqual(trace,['native-frame:parent','native-frame:child'])
 assert.deepEqual(x.game.state.trace,['script:parent','script:child']);x.life.stop()
})
test('LC-05 · alta, baja y cambio de script actualizan los registros en sync, no en frame',()=>{
 const a=obj('a','proc');const x=setup([a],[src('proc','function _process(){}'),src('fixed','function _physics_process(){}')]);x.life.start()
 assert.equal(x.life.processEntries.size,1)
 a.scriptId='fixed';x.life.sync();assert.equal(x.life.processEntries.size,0);assert.equal(x.life.physicsEntries.size,1)
 x.sync([]);assert.equal(x.life.physicsEntries.size,0);x.life.stop()
})
test('LC-06 · callbacks son opcionales y top-level se evalúa una sola vez',()=>{
 const x=setup([obj('a','s')],[src('s','game.state.init=(game.state.init||0)+1')]);x.life.start()
 x.life.process(.1);x.life.process(.1);x.life.physicsProcess(.01)
 assert.equal(x.game.state.init,1);assert.equal(x.life.processEntries.size,0);x.life.stop()
})
test('LC-07 · game.on perteneciente al nodo se libera al retirarlo',async()=>{
 const x=setup([obj('a','s')],[src('s','game.on("alerta",()=>{game.state.n=(game.state.n||0)+1})')]);x.life.start()
 assert.equal(x.game.listeners.get('alerta').length,1)
 await x.game.signal('alerta');assert.equal(x.game.state.n,1)
 x.sync([]);assert.equal(x.game.listeners.get('alerta').length,0)
 await x.game.signal('alerta');assert.equal(x.game.state.n,1)
 x.life.stop()
})
test('LC-08 · reentrar tres veces no multiplica callbacks',async()=>{
 const a=obj('a','s'),x=setup([a],[src('s','game.on("alerta",()=>{game.state.n=(game.state.n||0)+1})')]);x.life.start()
 for(let i=0;i<3;i++) {x.sync([]);x.sync([a]);assert.equal(x.game.listeners.get('alerta').length,1)}
 await x.game.signal('alerta');assert.equal(x.game.state.n,1);x.life.stop()
})
test('LC-09 · game.once se libera incluso sin haber recibido la señal',async()=>{
 const x=setup([obj('a','s')],[src('s','game.once("go",()=>{game.state.once=(game.state.once||0)+1})')]);x.life.start();x.life.stop()
 assert.equal(x.game.listeners.get('go').length,0)
 await x.game.signal('go');assert.equal(x.game.state.once,undefined)
})
test('LC-10 · game.once se dispara exactamente una vez y desconecta',async()=>{
 const x=setup([obj('a','s')],[src('s','game.once("go",()=>{game.state.once=(game.state.once||0)+1})')]);x.life.start()
 await x.game.signal('go');await x.game.signal('go');assert.equal(x.game.state.once,1)
 assert.equal(x.game.listeners.get('go').length,0);x.life.stop()
})
test('LC-11 · desuscribir a mano y salir dos veces es idempotente',async()=>{
 const x=setup([obj('a','s')],[src('s','const off=game.on("go",()=>{game.state.n=1});function _exit_tree(){off();off()}')]);x.life.start();x.life.stop();x.life.stop()
 assert.equal(x.game.listeners.get('go').length,0);assert.equal(x.errors.length,0)
})
test('LC-12 · waitFor se cancela y libera waiters/timers al salir',async()=>{
 const x=setup([obj('a','s')],[src('s','game.waitFor("llego",90).then(v=>{game.state.result=v===undefined?"cancelado":"dato"})')]);x.life.start()
 assert.equal(x.game.waiters.get('llego').length,1);assert.equal(x.game._waitCancel.size,1)
 x.life.stop();await tick();assert.equal(x.game.state.result,'cancelado')
 assert.equal(x.game.waiters.has('llego'),false);assert.equal(x.game._waitCancel.size,0)
})
test('LC-13 · waitFor de nodo recibe señal y devuelve datos sin cambiar el contrato',async()=>{
 const x=setup([obj('a','s')],[src('s','game.waitFor("llego").then(v=>game.state.result=v)')]);x.life.start()
 await x.game.signal('llego',{value:9});await tick()
 assert.deepEqual(x.game.state.result,{value:9});x.life.stop()
})
test('LC-14 · temporizador waitFor ya vencido no se cancela dos veces',async()=>{
 const x=setup([obj('a','s')],[src('s','game.waitFor("llego",.001).then(v=>game.state.res=v)')]);x.life.start();await new Promise(r=>setTimeout(r,12))
 assert.equal(x.game._waitCancel.size,0);x.life.stop();assert.equal(x.game.waiters.has('llego'),false)
})
test('LC-15 · script global conserva la suscripción tras eliminar el nodo',async()=>{
 const x=setup([obj('a','s')],[src('s','game.on("go",()=>{game.state.local=1})')]);x.game.api.on('go',()=>{x.game.state.global=(x.game.state.global||0)+1})
 x.life.start();x.life.stop();await x.game.signal('go')
 assert.equal(x.game.state.global,1);assert.equal(x.game.state.local,undefined)
})
test('LC-16 · callback async tardío no puede registrar escuchas del nodo eliminado',async()=>{
 const x=setup([obj('a','s')],[src('s','Promise.resolve().then(()=>game.on("go",()=>game.state.leak=true))')]);x.life.start();x.life.stop();await tick()
 assert.equal(x.game.listeners.get('go')?.length||0,0)
})
test('LC-17 · error al evaluar script después de suscribirse libera el listener',async()=>{
 const x=setup([obj('a','s')],[src('s','game.on("go",()=>game.state.leak=true);throw Error("fallo de instancia")')]);x.life.start()
 assert.equal(x.errors.length,1);assert.equal(x.game.listeners.get('go').length,0)
 assert.equal(x.life.processEntries.size,0)
 x.life.stop()
})
test('LC-18 · error en _exit_tree no impide liberar la instancia',async()=>{
 const x=setup([obj('a','s')],[src('s','game.on("go",()=>game.state.leak=true);function _exit_tree(){throw Error("salida") }')]);x.life.start();x.life.stop()
 assert.equal(x.errors.length,1);assert.equal(x.game.listeners.get('go').length,0);assert.equal(x.life.scripts.instances.size,0)
})
test('LC-19 · sustituir script mantiene listeners solo del nuevo',async()=>{
 const a=obj('a','one'),x=setup([a],[src('one','game.on("uno",()=>game.state.one=true)'),src('two','game.on("dos",()=>game.state.two=true)')]);x.life.start()
 a.scriptId='two';x.life.sync();assert.equal(x.game.listeners.get('uno').length,0);assert.equal(x.game.listeners.get('dos').length,1)
 await x.game.signal('uno');await x.game.signal('dos');assert.equal(x.game.state.one,undefined);assert.equal(x.game.state.two,true);x.life.stop()
})
test('LC-20 · cambio de escena (stop/start) libera y monta pertenencias de la nueva escena',async()=>{
 const a=obj('a','one'),b=obj('b','two'),x=setup([a],[src('one','game.on("uno",()=>game.state.one=true)'),src('two','game.on("dos",()=>game.state.two=true)')]);x.life.start()
 x.life.stop();x.sync([b]);x.life.start()
 assert.equal(x.game.listeners.get('uno').length,0);assert.equal(x.game.listeners.get('dos').length,1);x.life.stop()
})
test('LC-21 · callback nativo no se ejecuta si el nodo fue retirado en ese frame',()=>{
 trace.length=0;const x=setup([obj('a','',null,'corrNative'),obj('b','',null,'corrNative')],[])
 x.life.start();const old=x.life._call.bind(x.life)
 x.life._call=(o,m,dt)=>{if(o.id==='a'&&m==='onProcess') x.sync([x.project.objects[0]]);old(o,m,dt)}
 x.life.process(.01);assert.deepEqual(trace,['native-frame:a']);x.life.stop()
})
test('LC-22 · no se modifican archivos de eventos ni el Game global',()=>{
 const play=readFileSync(new URL('../src/engine/runtime/events/play-controls.js',import.meta.url),'utf8')
 assert.match(play,/nodeLifecycle\?\.physicsProcess\(fdt\)/)
 assert.match(readFileSync(new URL('../src/engine/runtime/nodes/vfx.js',import.meta.url),'utf8'),/onProcess\(obj, dt, scene\)/)
})
test('LC-23 · _exit_tree no crea una nueva suscripción al desmontar',async()=>{
 const x=setup([obj('a','s')],[src('s','function _exit_tree(){game.on("go",()=>game.state.leak=true)}')]);x.life.start();x.life.stop()
 assert.equal(x.game.listeners.get('go')?.length||0,0)
 await x.game.signal('go');assert.equal(x.game.state.leak,undefined)
})
test('LC-24 · excepción de script no deja callbacks periódicos pendientes',()=>{
 const x=setup([obj('a','bad'),obj('b','ok')],[src('bad','function _process(){throw Error("error") }'),src('ok','function _process(){game.state.good=(game.state.good||0)+1}')]);x.life.start();x.life.process(.016)
 assert.equal(x.errors.length,1);assert.equal(x.game.state.good,1)
 x.life.stop();assert.equal(x.life.processEntries.size,0);assert.equal(x.life.physicsEntries.size,0)
})
