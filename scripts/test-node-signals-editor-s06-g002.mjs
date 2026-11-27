// S06-G002: esquema de escena y activación real del mismo runtime S04/S05.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
import { registerNode } from '../src/engine/runtime/nodes/registry.js'

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const source = read('src/core/project.js')
const section = (a,b) => source.slice(source.indexOf(a),source.indexOf(b)).replaceAll('export function','function ').replaceAll('export const','const ')
const migration = vm.runInNewContext([
 section('export function validateSignalConnections','export function createSceneContent'),
 section('export function createSceneContent','export function createProjectData'),
 section('export const SCENE_KEYS','export function migrateRecord'),
 section('export function migrateRecord','export function ensureFs'),
 '({validateSignalConnections,migrateScene,createSceneContent,SCENE_KEYS,splitProject,migrateRecord})'
 ].join('\n'),{
 toRaw:(x)=>x,authoredSceneTree:(record)=>({objects:record.objects,signalConnections:record.signalConnections || []}),
 uid:(s)=>s+'_1',migrateObjectGroups:()=>{},normalizeWorld:(w)=>w,makeObject:(type,kind,data)=>({type,kind,...data}),
 getTemplate:()=>({scene:[],emptyDatabase:false}),DEFAULT_TEMPLATE:'default',DEFAULT_LAYERS:[],defaultEnvironment:()=>({}),
 ensureFs:()=>{},ROOT_FOLDER:'Assets',PROJECT_VERSION:3
 })
const {validateSignalConnections,migrateScene,createSceneContent,splitProject,migrateRecord}=migration
const connection=(id='c1',emitterId='a',receiverId='b',signal='alerta',method='recibir')=>({id,emitterId,receiverId,signal,method})
const scene=(links=[])=>({objects:[],environment:{},terrain:null,signalConnections:links})

test('PERSIST-01 · escena antigua se normaliza sin perder otros campos',()=>{
 const s={objects:[],environment:{},terrain:null};assert.equal(migrateScene(s),s);assert.deepEqual(Array.from(s.signalConnections),[])
})
test('PERSIST-02 · plantilla incorpora lista vacía',()=>assert.deepEqual(Array.from(createSceneContent().signalConnections),[]))
test('PERSIST-03 · validación acepta orden y conserva campos futuros',()=>{
 const data=[{...connection(),extension:{x:1}},connection('c2','a','b','otra')]
 assert.equal(validateSignalConnections(data),data)
})
test('PERSIST-04 · entradas corruptas se rechazan, nunca se eliminan silenciosamente',()=>{
 for(const v of [null,{},[null],[{id:'a'}],[{...connection(),id:' '}],[{...connection(),method:4}]]){
  assert.throws(()=>validateSignalConnections(v))
 }
})
test('PERSIST-05 · IDs y enlaces duplicados se rechazan',()=>{
 assert.throws(()=>validateSignalConnections([connection(),connection()]),/duplicad/)
 assert.throws(()=>validateSignalConnections([connection(),connection('c2')]),/duplicad/)
})
test('PERSIST-06 · splitProject guarda connections en escena, no en meta',()=>{
 const p={objects:[],environment:{},terrain:{},signalConnections:[connection()],name:'P',activeSceneId:'uno'}
 const {meta,scene:out}=splitProject(p,{size:12})
 assert.equal(meta.signalConnections,undefined);assert.equal(out.signalConnections[0].id,'c1');assert.equal(out.terrain.size,12)
})
test('PERSIST-07 · v3 inline y legado migran connections a la escena',()=>{
 const a=migrateRecord({version:3,scenes:[{id:'uno'}],objects:[],environment:{},terrain:null,signalConnections:[connection()]})
 assert.equal(a.scene.signalConnections[0].id,'c1');assert.equal(a.meta.signalConnections,undefined)
 const b=migrateRecord({version:2,name:'Legado',objects:[],environment:{},terrain:null})
 assert.deepEqual(Array.from(b.scene.signalConnections),[])
})
test('PERSIST-08 · escena duplicada conserva registros pero no crea conexiones runtime',()=>{
 const old=scene([connection()]);const copy=structuredClone(old)
 assert.notEqual(copy,old);assert.deepEqual(copy,old);copy.signalConnections[0].id='otro';assert.equal(old.signalConnections[0].id,'c1')
})

registerNode({type:'s06persist',label:'QA G002',create:()=>({}),build:()=>({}),update:()=>{}})
const node=(id,scriptId=id,parentId=null)=>({id,name:id,type:'s06persist',scriptId,parentId})
const scripts=[{id:'a',execution:'node',code:"node.define_signal('alerta');node.expose('enviar',()=>node.emit_signal('alerta',13))"},
{id:'b',execution:'node',code:"node.expose('recibir',(v)=>game.record(v))"}]
const handles = vm.runInNewContext(read('src/engine/runtime/events/play-nodes.js').replace(/^import .*\n/gm,'').replace('export const nodesMethods','const nodesMethods')+'\nnodesMethods',{resolveNodePath:()=>null})
function fixture({links=[connection()],receiverScripts=scripts,area=false}={}){
 const a=node('a'),b=node('b'),objects=[a,b],events=[],errors=[],project={objects,scripts:receiverScripts,signalConnections:links,activeSceneId:'uno'}
 const nodes=new Map(objects.map((o)=>[o.id,{_lfNodeOwner:o}]))
 const play={project,on:true,_referenceSession:{},_sceneSignalReady:false,ed:{nodes},game:{api:{record:(v)=>events.push(v)},report:(e)=>errors.push(e.message)},
 pos:{},vp:{requestRender(){}},vm:{held:new Map()},_animMethodsFor:()=>({}),_tagLayerApi:()=>({}),_persistMarked:()=>false,_persistSet:()=>false}
 const life=new NodeLifecycle({host:{project},nodes});play.ed.nodeLifecycle=life
 Object.assign(play,handles);play.game.api.node=(id)=>play._nodeHandle(id)
 life.scripts=new NodeScriptRuntime(play);life.start()
 const activate=()=>{play._sceneSignalReady=true;life.scripts.syncSceneConnections()}
 const update=(newObjects)=>{project.objects=newObjects;nodes.clear();for(const o of newObjects)nodes.set(o.id,{_lfNodeOwner:o});life.sync()}
 return {a,b,play,life,project,nodes,events,errors,activate,update,stop:()=>{play._sceneSignalReady=false;life.stop()}}
}
test('PERSIST-09 · antes de activar no conecta, después de _ready sí',()=>{
 const x=fixture();assert.equal(x.life.scripts.sceneConnections.size,0)
 x.play._nodeHandle('a').call('enviar');assert.deepEqual(x.events,[])
 x.activate();assert.equal(x.life.scripts.sceneConnections.size,1)
 x.play._nodeHandle('a').call('enviar');assert.deepEqual(x.events,[13]);x.stop()
})
test('PERSIST-10 · sincronización repetida no duplica conexiones ni callbacks',()=>{
 const x=fixture();x.activate();x.life.sync();x.life.sync()
 x.play._nodeHandle('a').call('enviar');assert.deepEqual(x.events,[13]);assert.equal(x.life.processEntries.size,0)
 assert.equal(x.life.physicsEntries.size,0);x.stop()
})
test('PERSIST-11 · eliminación y regreso del receptor recrean el enlace sin revivir objeto viejo',()=>{
 const x=fixture();x.activate();const old=x.play._nodeHandle('b');x.update([x.a]);assert.equal(x.life.scripts.sceneConnections.size,0)
 const fresh=node('b');x.update([x.a,fresh]);assert.equal(old.is_valid(),false)
 assert.equal(x.life.scripts.sceneConnections.size,1);x.play._nodeHandle('a').call('enviar');assert.deepEqual(x.events,[13]);x.stop()
})
test('PERSIST-12 · cambios de identidad del emisor fuerzan nuevo registro',()=>{
 const x=fixture();x.activate();const replacement=node('a');x.update([replacement,x.b]);assert.equal(x.life.scripts.sceneConnections.size,1)
 x.play._nodeHandle('a').call('enviar');assert.deepEqual(x.events,[13]);x.stop()
})
test('PERSIST-13 · reparentado reconstruye conexión tras salir y entrar',()=>{
 const x=fixture();x.activate();x.b.parentId='a';x.life.sync();assert.equal(x.life.scripts.sceneConnections.size,1)
 x.play._nodeHandle('a').call('enviar');assert.deepEqual(x.events,[13]);x.stop()
})
test('PERSIST-14 · enlace inválido mantiene autoría y produce diagnóstico con ID y extremos',()=>{
 const c=connection('faltante','a','b','inexistente');const x=fixture({links:[c]});x.activate()
 assert.equal(x.life.scripts.sceneConnections.size,0);assert.equal(x.project.signalConnections[0],c)
 assert.match(x.errors[0],/faltante.*a\.inexistente.*b\.recibir/);x.life.sync();assert.equal(x.errors.length,1);x.stop()
})
test('PERSIST-15 · Stop/Play no retiene conexiones anteriores',()=>{
 const x=fixture();x.activate();const old=x.play._nodeHandle('a');x.stop()
 assert.equal(x.life.scripts.sceneConnections.size,0);x.play.on=false;x.play._referenceSession=null;assert.equal(old.is_valid(),false)
})
test('PERSIST-16 · cambio de escena limpia enlaces y reactivación usa datos de la escena entrante',()=>{
 const x=fixture();x.activate();x.play._sceneSignalReady=false;x.life.scripts.clearSceneConnections()
 x.project.activeSceneId='dos';x.project.signalConnections=[];x.update([x.a,x.b]);x.activate();assert.equal(x.life.scripts.sceneConnections.size,0)
 x.play._nodeHandle('a').call('enviar');assert.equal(x.events.length,0);x.stop()
})
test('PERSIST-17 · actualización de identidad de conexión desconecta la antigua',()=>{
 const x=fixture();x.activate();x.project.signalConnections=[connection('c1','a','b','otra')];x.life.sync()
 assert.equal(x.life.scripts.sceneConnections.size,0);assert.match(x.errors[0],/otra/)
 x.play._nodeHandle('a').call('enviar');assert.equal(x.events.length,0);x.stop()
})
test('PERSIST-18 · rutas actuales conservan .levelpackage, bloquean Godot y preservan Player',()=>{
 // G004 añade soporte para conexiones en formatos nativos, sustituyendo el bloqueo provisional de G002.
 assert.match(read('src/core/levelpackage.js'),/validateSignalConnections\(data\.signalConnections\)/)
 assert.match(read('src/core/levelpackage-import.js'),/data: remapNodes\(replace\(plain\(data\)\)\)/)
 assert.match(read('src/core/levelpackage-import.js'),/importación bloqueada para evitar pérdida de datos/)
 assert.match(read('src/core/exporter.js'),/Exportación Godot bloqueada: las conexiones visuales/)
 assert.match(read('src/engine/runtime/package/format.js'),/JSON\.stringify\(s\.data\)/)
})
test('PERSIST-19 · las operaciones de escena copiadas incluyen signalConnections',()=>{
 const p=read('src/core/state/project.js')
 for(const fragment of ['signalConnections: clone(sceneData.signalConnections)','p.signalConnections = clone(r.signalConnections)','signalConnections: rec.signalConnections','signalConnections: x.signalConnections'])assert.ok(p.includes(fragment))
 assert.match(read('src/engine/runtime/scene/node-lifecycle.js'),/scripts\?\.syncSceneConnections\?\.\(\)/)
})
