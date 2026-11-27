// S03: regresión directa sobre PlayMode, Groups y NodeScriptRuntime existentes.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
import { registerNode } from '../src/engine/runtime/nodes/registry.js'
import { groupsOf } from '../src/engine/runtime/layers.js'

registerNode({ type:'s03CallNode', label:'QA S03', create:()=>({}), build:()=>({}), update:()=>{} })
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
function load(path,exportName,context={}) {
  return vm.runInNewContext(read(path).replace(/^import .*\n/gm,'').replace(`export const ${exportName}`,`const ${exportName}`)+`\n${exportName}`,context)
}
const nodeMethods=load('src/engine/runtime/events/play-nodes.js','nodesMethods',{resolveNodePath:()=>null})
const stepMethods=load('src/engine/runtime/events/play-steps.js','stepMethods',{groupsOf,THREE:{Vector3:class { constructor() {} }}})
const obj=(id,groups=['enemigos'],scriptId='s')=>({id,name:id,type:'s03CallNode',parentId:null,groups,scriptId})
const source=(id,code)=>({id,execution:'node',code})
function setup(objects,scripts) {
  const actions=[],errors=[]
  const project={activeSceneId:'escena-1',objects,scripts}
  const nodes=new Map(objects.map(o=>[o.id,{_lfNodeOwner:o}]))
  const lifecycle=new NodeLifecycle({host:{project},nodes})
  const p={on:true,_referenceSession:{},_runtimeGroups:new Map(),project,ed:{nodes,nodeLifecycle:lifecycle},
    game:{api:{record:(...args)=>actions.push(args)},report:(error,where)=>errors.push([error.message,where])},
    _animMethodsFor:()=>({}),_persistMarked:()=>false,_persistSet:()=>false,
    vm:{held:new Map()},pos:{},vp:{requestRender(){}}}
  Object.assign(p,nodeMethods,stepMethods)
  p.game.api.node=(id)=>p._nodeHandle(id)
  p.game.api.call_group=(...args)=>p._callGroup(...args)
  lifecycle.scripts=new NodeScriptRuntime(p)
  lifecycle.start()
  const replace=(items)=>{
    project.objects=items
    for (const id of [...nodes.keys()]) if (!items.some(o=>o.id===id)) nodes.delete(id)
    for (const o of items) if (nodes.get(o.id)?._lfNodeOwner!==o) nodes.set(o.id,{_lfNodeOwner:o})
    lifecycle.sync()
  }
  return {p,project,nodes,lifecycle,actions,errors,replace}
}

test('GC-01: miembros activos, orden del proyecto y argumentos',()=>{
  const x=setup([obj('c'),obj('a'),obj('b')],[source('s',`node.expose('ping',(v)=>game.record(node.id,v))`)])
  assert.equal(x.p.game.api.call_group('ENEMIGOS','ping',8),undefined)
  assert.deepEqual(x.actions,[['c',8],['a',8],['b',8]])
  x.lifecycle.stop()
})
test('GC-02: grupo vacío o inexistente no ejecuta nada',()=>{
  const x=setup([obj('a',[])],[source('s',`node.expose('ping',()=>game.record('ping'))`)])
  x.p._callGroup('desconocido','ping');x.p._callGroup('','ping');assert.deepEqual(x.actions,[]);x.lifecycle.stop()
})
test('GC-03: miembros sin script o método publicado se omiten',()=>{
  const x=setup([obj('a'),obj('b',['enemigos'],null),obj('c',['enemigos'],'otro')],[source('s',`node.expose('ping',()=>game.record(node.id))`),source('otro',`node.expose('distinto',()=>true)`)])
  x.p._callGroup('enemigos','ping');assert.deepEqual(x.actions,[['a']]);assert.equal(x.errors.length,0);x.lifecycle.stop()
})
test('GC-04: eliminar miembro siguiente durante iteración lo omite',()=>{
  const a=obj('a'),b=obj('b'),c=obj('c')
  const x=setup([a,b,c],[source('s',`node.expose('ping',()=>{game.record(node.id);if(node.id==='a')game.dropB()})`)])
  x.p.game.api.dropB=()=>x.replace([a,c]);x.p._callGroup('enemigos','ping')
  assert.deepEqual(x.actions,[['a'],['c']]);x.lifecycle.stop()
})
test('GC-05: borrar miembro y recrearlo con mismo ID no redirige snapshot',()=>{
  const a=obj('a'),b=obj('b'),c=obj('c');const x=setup([a,b,c],[source('s',`node.expose('ping',()=>{game.record(node.id);if(node.id==='a')game.replaceB()})`)])
  x.p.game.api.replaceB=()=>x.replace([a,obj('b'),c]);x.p._callGroup('enemigos','ping')
  assert.deepEqual(x.actions,[['a'],['c']]);x.lifecycle.stop()
})
test('GC-06: retirar miembro del grupo durante iteración lo omite',()=>{
  const x=setup([obj('a'),obj('b')],[source('s',`node.expose('ping',()=>{game.record(node.id);if(node.id==='a')game.node('b').remove_from_group('enemigos')})`)])
  x.p._callGroup('enemigos','ping');assert.deepEqual(x.actions,[['a']]);x.lifecycle.stop()
})
test('GC-07: añadir miembro durante iteración lo reserva para siguiente llamada',()=>{
  const x=setup([obj('a'),obj('b',[])],[source('s',`node.expose('ping',()=>{game.record(node.id);if(node.id==='a')game.node('b').add_to_group('enemigos')})`)])
  x.p._callGroup('enemigos','ping');assert.deepEqual(x.actions,[['a']]);x.p._callGroup('enemigos','ping')
  assert.deepEqual(x.actions,[['a'],['a'],['b']]);x.lifecycle.stop()
})
test('GC-08: cambio de escena detiene despacho aunque permanezcan IDs',()=>{
  const x=setup([obj('a'),obj('b')],[source('s',`node.expose('ping',()=>{game.record(node.id);if(node.id==='a')game.switchScene()})`)])
  x.p.game.api.switchScene=()=>{x.project.activeSceneId='escena-2';x.p._runtimeGroups=new Map()}
  x.p._callGroup('enemigos','ping');assert.deepEqual(x.actions,[['a']]);x.lifecycle.stop()
})
test('GC-09: Stop durante despacho impide miembros posteriores',()=>{
  const x=setup([obj('a'),obj('b')],[source('s',`node.expose('ping',()=>{game.record(node.id);if(node.id==='a')game.stopPlay()})`)])
  x.p.game.api.stopPlay=()=>{x.p.on=false;x.p._referenceSession=null}
  x.p._callGroup('enemigos','ping');assert.deepEqual(x.actions,[['a']]);x.lifecycle.stop()
})
test('GC-10: excepción síncrona reportada no detiene siguientes miembros',()=>{
  const x=setup([obj('a'),obj('b')],[source('s',`node.expose('ping',()=>{if(node.id==='a')throw Error('sinc');game.record(node.id)})`)])
  x.p._callGroup('enemigos','ping');assert.deepEqual(x.actions,[['b']]);assert.match(x.errors[0][0],/sinc/);assert.match(x.errors[0][1],/call_group/);x.lifecycle.stop()
})
test('GC-11: Promise rechazada reportada sin esperar el grupo',async()=>{
  const x=setup([obj('a'),obj('b')],[source('s',`node.expose('ping',()=>node.id==='a'?Promise.reject(Error('async')):game.record('b'))`)])
  assert.equal(x.p._callGroup('enemigos','ping'),undefined);assert.deepEqual(x.actions,[['b']])
  await new Promise(resolve=>setImmediate(resolve));assert.match(x.errors[0][0],/async/);x.lifecycle.stop()
})
test('GC-12: un call_group anidado conserva instantáneas independientes',()=>{
  const x=setup([obj('a'),obj('b')],[source('s',`node.expose('ping',()=>{game.record('outer',node.id);if(node.id==='a')game.call_group('enemigos','inner')});node.expose('inner',()=>game.record('inner',node.id))`)])
  x.p._callGroup('enemigos','ping');assert.deepEqual(x.actions,[['outer','a'],['inner','a'],['inner','b'],['outer','b']]);x.lifecycle.stop()
})
test('GC-13: grupos múltiples, pertenencia temporal y sin modificar escena guardada',()=>{
  const a=obj('a',['enemigos','voladores']),b=obj('b',[])
  const x=setup([a,b],[source('s',`node.expose('ping',()=>game.record(node.id))`)])
  x.p._changeRuntimeGroup(b,'voladores',true)
  x.p._callGroup('voladores','ping');assert.deepEqual(x.actions,[['a'],['b']]);assert.deepEqual(b.groups,[]);x.lifecycle.stop()
})
test('GC-14: la consulta de método exige instancia, identidad y vigencia',()=>{
  const a=obj('a'),x=setup([a],[source('s',`node.expose('ping',()=>game.record(node.id))`)])
  assert.equal(x.lifecycle.scripts.hasPublic(a,'ping'),true)
  const nuevo=obj('a');assert.equal(x.lifecycle.scripts.hasPublic(nuevo,'ping'),false)
  x.replace([nuevo]);assert.equal(x.lifecycle.scripts.hasPublic(a,'ping'),false)
  x.lifecycle.stop()
})
test('GC-15: llamada no añade trabajos por fotograma',()=>{
  const x=setup([obj('a'),obj('b')],[source('s',`node.expose('ping',()=>{})`)])
  assert.equal(x.lifecycle.processEntries.size,0);assert.equal(x.lifecycle.physicsEntries.size,0)
  x.p._callGroup('enemigos','ping');assert.equal(x.lifecycle.processEntries.size,0);x.lifecycle.stop()
})
test('GC-16: integración de la API global con host y tipos',()=>{
  const interpreter=read('src/engine/runtime/events/interpreter.js'),host=read('src/engine/runtime/events/play-host.js')
  assert.match(interpreter,/call_group:.*h\(\)\.callGroup/)
  assert.match(host,/callGroup:.*self\._callGroup/)
  for(const file of ['src/core/events/game-api.d.ts','vscode-extension/media/game-api.d.ts']) assert.match(read(file),/call_group\(group: string, method: string, \.\.\.args: any\[\]\): void/)
})
