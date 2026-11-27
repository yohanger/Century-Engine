// LF-NODE-SCRIPT-METHOD-CALL-S02-G001: contrato público sobre el runtime real de Scripts de Nodo.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
import { registerNode } from '../src/engine/runtime/nodes/registry.js'

registerNode({type:'s02MethodNode',label:'QA S02',create:()=>({}),build:()=>({}),update:()=>{}})
const file = readFileSync(new URL('../src/engine/runtime/events/play-nodes.js',import.meta.url),'utf8')
const body = file.replace(/^import .*\n/gm,'').replace('export const nodesMethods','const nodesMethods')
const methods = vm.runInNewContext(body+'\nnodesMethods',{resolveNodePath:(objects,origin,path)=>{
  let current=path.startsWith('/')?null:origin
  for(const part of String(path).split('/').filter(Boolean)){
    if(part==='.')continue
    if(part==='..'){current=objects.find(o=>o.id===current?.parentId)||null;continue}
    current=objects.find(o=>(o.parentId||null)===(current?.id||null)&&(o.name===part||o.id===part))||null
  }
  return current
}})
const obj=(id,scriptId='s',parentId=null)=>({id,name:id,type:'s02MethodNode',parentId,scriptId})
const src=(id,code)=>({id,execution:'node',code})
function setup(objects,scripts){
  const events=[],errors=[]
  const project={objects,scripts},nodes=new Map(objects.map(o=>[o.id,{_lfNodeOwner:o}]))
  const scene={host:{project},nodes}
  const life=new NodeLifecycle(scene)
  const play={on:true,_referenceSession:{},project,ed:{nodes,nodeLifecycle:life},game:{api:{record:(...args)=>events.push(args)},report:(e,at)=>errors.push([e.message,at])},
    _tagLayerApi:()=>({}),_animMethodsFor:()=>({}),_persistMarked:()=>false,_persistSet:()=>{},vm:{held:new Map()},pos:{},vp:{requestRender(){}}}
  Object.assign(play,methods)
  play.game.api.node=(name)=>play._nodeHandle(name)
  life.scripts=new NodeScriptRuntime(play)
  const sync=(newObjects)=>{project.objects=newObjects;for(const [id] of nodes){if(!newObjects.some(o=>o.id===id))nodes.delete(id)}
    for(const o of newObjects){if(!nodes.has(o.id)||nodes.get(o.id)._lfNodeOwner!==o)nodes.set(o.id,{_lfNodeOwner:o})}life.sync()}
  return {events,errors,project,play,life,sync,nodes}
}

test('MC-01 · llamada desde game.node y estado privado por instancia',()=>{
  const x=setup([obj('a'),obj('b')],[src('s',`let count=0;node.expose('inc',function(n=1){count+=n;return count})`)]);x.life.start()
  assert.equal(x.play.game.api.node('a').call('inc',2),2)
  assert.equal(x.play.game.api.node('b').call('inc',3),3)
  assert.equal(x.play.game.api.node('a').call('inc',4),6)
  x.life.stop()
})
test('MC-02 · nodo propietario invoca otro desde _ready y devuelve resultado',()=>{
  const x=setup([obj('a','caller'),obj('b','target')],[src('target',`node.expose('sumar',(a,b)=>a+b)`),src('caller',`function _ready(){game.record(game.node('b').call('sumar',4,7))}`)])
  x.life.start();assert.deepEqual(x.events,[[11]]);x.life.stop()
})
test('MC-03 · acceso privado, inexistente, sin Script y firma inválida fallan claramente',()=>{
  const a=obj('a'),b=obj('b',null),x=setup([a,b],[src('s',`let secreto=4;function privado(){return secreto};node.expose('publico',()=>secreto)`)]);x.life.start()
  assert.equal(x.play._nodeHandle('a').call('publico'),4)
  assert.throws(()=>x.play._nodeHandle('a').call('privado'),/no encontrado/)
  assert.throws(()=>x.play._nodeHandle('b').call('algo'),/no disponible/)
  assert.throws(()=>x.play._nodeHandle('a').call(''),/inválido/)
  assert.equal(x.play._nodeHandle('a').expose,undefined)
  x.life.stop()
})
test('MC-04 · excepciones síncronas y Promise rechazada se propagan sin swallowed',async()=>{
  const x=setup([obj('a')],[src('s',`node.expose('fallar',()=>{throw Error('propagado')});node.expose('async',async()=>{throw Error('rechazo')})`)]);x.life.start()
  assert.throws(()=>x.play._nodeHandle('a').call('fallar'),/propagado/)
  await assert.rejects(x.play._nodeHandle('a').call('async'),/rechazo/)
  assert.equal(x.errors.length,0);x.life.stop()
})
test('MC-05 · argumentos, this y retorno Promise original',async()=>{
  const x=setup([obj('a')],[src('s',`node.expose('id',function(v){return this.id+v});node.expose('promesa',()=>Promise.resolve(22))`)]);x.life.start()
  assert.equal(x.play._nodeHandle('a').call('id','!'),'a!')
  const p=x.play._nodeHandle('a').call('promesa');assert.ok(p instanceof Promise);assert.equal(await p,22);x.life.stop()
})
test('MC-06 · métodos reservados, duplicados y argumentos incorrectos no se registran',()=>{
  const x=setup([obj('a')],[src('s',`node.expose('bien',()=>3);for(const [name,fn] of [['_ready',()=>{}],['bien',()=>{}],['',()=>{}],['sinFuncion',1]]){try{node.expose(name,fn)}catch(e){game.record(e.message)}}`)]);x.life.start()
  assert.equal(x.events.length,4)
  assert.equal(x.play._nodeHandle('a').call('bien'),3)
  assert.throws(()=>x.play._nodeHandle('a').call('_ready'),/no encontrado/)
  x.life.stop()
})
test('MC-07 · la publicación durante evaluación está disponible en _enter_tree',()=>{
  const x=setup([obj('a')],[src('s',`node.expose('saludo',()=>18);function _enter_tree(){game.record(node.call('saludo'))}`)]);x.life.start()
  assert.deepEqual(x.events,[[18]]);assert.equal(x.errors.length,0);x.life.stop()
})
test('MC-08 · limpiar instancia impide llamada a handle previo y no filtra métodos',()=>{
  const a=obj('a'),x=setup([a],[src('s',`node.expose('saludar',()=>5)`)]);x.life.start();const h=x.play._nodeHandle('a')
  x.sync([]);assert.equal(h.is_valid(),false);assert.throws(()=>h.call('saludar'),/inválida/)
  assert.equal(x.life.scripts.instances.size,0);x.life.stop()
})
test('MC-09 · reemplazo del mismo ID desmonta el método antiguo, no reorienta handles',()=>{
  const a=obj('a','uno'),x=setup([a],[src('uno',`node.expose('metodo',()=>1)`),src('dos',`node.expose('metodo',()=>2)`)]);x.life.start();const old=x.play._nodeHandle('a')
  const replacement=obj('a','dos');x.sync([replacement]);assert.equal(old.is_valid(),false)
  assert.equal(x.play._nodeHandle('a').call('metodo'),2);assert.throws(()=>old.call('metodo'),/inválida/)
  assert.equal(x.errors.length,0);x.life.stop()
})
test('MC-10 · cambio de scriptId invalida publicación anterior',()=>{
  const a=obj('a','uno'),x=setup([a],[src('uno',`node.expose('anterior',()=>1)`),src('dos',`node.expose('nuevo',()=>2)`)]);x.life.start();a.scriptId='dos'
  assert.throws(()=>x.play._nodeHandle('a').call('anterior'),/no disponible/)
  x.life.sync();assert.equal(x.play._nodeHandle('a').call('nuevo'),2)
  assert.throws(()=>x.play._nodeHandle('a').call('anterior'),/no encontrado/);x.life.stop()
})
test('MC-11 · _exit_tree no acepta una llamada pública ni publicación nueva',()=>{
  const a=obj('a'),x=setup([a],[src('s',`node.expose('uno',()=>1);function _exit_tree(){try{node.call('uno')}catch(e){game.record('rechazo')};try{node.expose('dos',()=>2)}catch(e){game.record('inactivo')}}`)]);x.life.start()
  x.sync([]);assert.deepEqual(x.events,[['rechazo'],['inactivo']]);x.life.stop()
})
test('MC-12 · eliminación durante invocación no redirige la siguiente llamada',()=>{
  const a=obj('a'),x=setup([a],[src('s',`node.expose('eliminar',()=>{game.quitar();return 1});node.expose('vivo',()=>true)`)]);
  x.play.game.api.quitar=()=>x.sync([]);x.life.start();const h=x.play._nodeHandle('a');assert.equal(h.call('eliminar'),1)
  assert.throws(()=>h.call('vivo'),/inválida/);x.life.stop()
})
test('MC-13 · Stop/Play separa instancias y no reactiva callbacks anteriores',()=>{
  const a=obj('a'),x=setup([a],[src('s',`node.expose('ping',()=>5)`)]);x.life.start();const before=x.play._nodeHandle('a');x.life.stop();x.play.on=false;x.play._referenceSession=null
  assert.equal(before.is_valid(),false);x.play.on=true;x.play._referenceSession={};x.life.start()
  assert.throws(()=>before.call('ping'),/inválida/);assert.equal(x.play._nodeHandle('a').call('ping'),5);x.life.stop()
})
test('MC-14 · fallos de evaluación no mantienen métodos públicos ni suscripciones',()=>{
  const x=setup([obj('a')],[src('s',`node.expose('fuga',()=>true);throw Error('evaluación')`)]);x.life.start()
  assert.equal(x.errors.length,1);assert.equal(x.life.scripts.instances.size,0)
  assert.throws(()=>x.play._nodeHandle('a').call('fuga'),/no disponible/);x.life.stop()
})
test('MC-15 · no se incorpora despacho por fotograma sin callbacks',()=>{
  const x=setup([obj('a')],[src('s',`node.expose('metodo',()=>1)`)]);x.life.start()
  assert.equal(x.life.processEntries.size,0);assert.equal(x.life.physicsEntries.size,0);x.life.process(.016);x.life.physicsProcess(.02)
  assert.equal(x.play._nodeHandle('a').call('metodo'),1);x.life.stop()
})
test('MC-16 · reparentado conserva handle y reinicia instancia tras salida y reentrada',()=>{
  const a=obj('a'),b=obj('b'),c=obj('c'),x=setup([a,b,c],[src('s',`let n=0;node.expose('sumar',()=>++n)`)]);x.life.start();const h=x.play._nodeHandle('a')
  assert.equal(h.call('sumar'),1);a.parentId='b';x.life.sync();assert.equal(h.call('sumar'),1) // Reentrada produce una instancia nueva sobre el mismo registro.
  assert.equal(h.is_valid(),true);x.life.stop()
})
