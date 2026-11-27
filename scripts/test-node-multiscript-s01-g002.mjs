// LF-NODE-MULTISCRIPT-S01-G002 · autoría, migración, validación y límites de formato
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')
const objects=read('src/core/state/objects.js')
const project=read('src/core/project.js')
const nodes=read('src/engine/runtime/nodes/index.js')
const inspector=read('src/components/Inspector.vue')
const tree=read('src/components/SceneTree.vue')
const levelpackage=read('src/core/levelpackage.js')
const levelpackageImport=read('src/core/levelpackage-import.js')
let changes=[], messages=[]
const store={project:{objects:[{id:'a',name:'Nodo',type:'node',scriptId:'legacy'}],scripts:[{id:'legacy',execution:'node',name:'Legacy.js'},{id:'b',execution:'node',name:'B.js'},{id:'c',execution:'node',name:'C.js'},{id:'global',execution:'global',name:'Global.js'}]}}
const getObject=id=>store.project.objects.find(o=>o.id===id)
const updateObject=(id,patch,{label})=>{Object.assign(getObject(id),patch);changes.push(label);return true}
const operations=objects.slice(objects.indexOf('export function authoredNodeScriptIds'),objects.indexOf('/** Mezcla `patch`'))
const ops=vm.runInNewContext(operations.replaceAll('export function','function')+'\n({authoredNodeScriptIds,setNodeScriptIds,addNodeScript,removeNodeScript,moveNodeScript})', {store,getObject,updateObject,toast:message=>messages.push(message),Set,JSON,Number})
function reset(){store.project.objects=[{id:'a',name:'Nodo',type:'node',scriptId:'legacy'}];changes=[];messages=[]}
const migrate=project.slice(project.indexOf('export function migrateNodeScripts(obj)'),project.indexOf('export function createSceneContent('))
const migrateScene=vm.runInNewContext(migrate.replaceAll('export function','function')+'\nmigrateScene', {migrateObjectGroups:()=>{},validateSignalConnections:value=>value||[],normalizeWorld:()=>({}),uid:()=> 'terrain_x',makeObject:()=>({}),Set,Array,Object,Error})
const scene=objects=>({objects,environment:{},signalConnections:[]})
const ids=()=>JSON.parse(JSON.stringify(ops.authoredNodeScriptIds(getObject('a'))))
test('MS-UI-01 · migrateScene convierte scriptId antiguo en lista ordenada',()=>{
 const s=scene([{id:'o',name:'Antiguo',type:'node',scriptId:'legacy'}]);migrateScene(s)
 assert.deepEqual(JSON.parse(JSON.stringify(s.objects[0].scriptIds)),['legacy']);assert.equal(Object.hasOwn(s.objects[0],'scriptId'),false)
})
test('MS-UI-02 · scriptId vacío se convierte en scriptIds vacío',()=>{
 const s=scene([{id:'o',type:'node',scriptId:''}]);migrateScene(s);assert.deepEqual(JSON.parse(JSON.stringify(s.objects[0].scriptIds)),[])
})
test('MS-UI-03 · scriptIds existentes no se sobrescriben y se borra campo legado',()=>{
 const s=scene([{id:'o',type:'node',scriptIds:['b','legacy'],scriptId:'legacy'}]);migrateScene(s)
 assert.deepEqual(s.objects[0].scriptIds,['b','legacy']);assert.equal(Object.hasOwn(s.objects[0],'scriptId'),false)
})
test('MS-UI-04 · migración rechaza duplicados y datos corruptos sin perderlos',()=>{
 for(const bad of [['b','b'],['b',null],[' b']])assert.throws(()=>migrateScene(scene([{id:'o',type:'node',scriptIds:bad}])),/inválidos/)
})
test('MS-UI-05 · alta agrega, conserva orden y elimina el campo antiguo',()=>{
 reset();assert.equal(ops.addNodeScript('a','b'),true);assert.deepEqual(ids(),['legacy','b'])
 assert.equal(Object.hasOwn(getObject('a'),'scriptId'),false);assert.equal(changes.length,1)
})
test('MS-UI-06 · alta repetida no cambia historial',()=>{
 reset();ops.addNodeScript('a','b');assert.equal(ops.addNodeScript('a','b'),false);assert.equal(changes.length,1);assert.match(messages[0],/ya pertenece/)
})
test('MS-UI-07 · Script Global se rechaza, sin mutar asociaciones',()=>{
 reset();assert.equal(ops.addNodeScript('a','global'),false);assert.deepEqual(ids(),['legacy']);assert.equal(changes.length,0)
})
test('MS-UI-08 · quitar referencia inexistente preserva las otras',()=>{
 reset();ops.addNodeScript('a','b');assert.equal(ops.removeNodeScript('a','legacy'),true)
 assert.deepEqual(ids(),['b']);assert.equal(changes.length,2)
})
test('MS-UI-09 · reordenar y movimientos nulos no crean commits innecesarios',()=>{
 reset();ops.addNodeScript('a','b');ops.addNodeScript('a','c');const n=changes.length
 assert.equal(ops.moveNodeScript('a',2,0),true);assert.deepEqual(ids(),['c','legacy','b']);assert.equal(changes.length,n+1)
 assert.equal(ops.moveNodeScript('a',0,0),false);assert.equal(changes.length,n+1)
})
test('MS-UI-10 · soporta recursos faltantes sin borrarlos',()=>{
 reset();getObject('a').scriptIds=['missing','legacy'];delete getObject('a').scriptId
 assert.equal(ops.addNodeScript('a','b'),true);assert.deepEqual(ids(),['missing','legacy','b']);assert.match(inspector,/Recurso inexistente/)
})
test('MS-UI-11 · un mismo script puede asociarse a nodos distintos',()=>{
 reset();store.project.objects.push({id:'other',type:'node',scriptIds:[]});assert.equal(ops.addNodeScript('other','b'),true)
 assert.equal(ops.addNodeScript('a','b'),true);assert.deepEqual(ids(),['legacy','b'])
})
test('MS-UI-12 · la autoría evita duplicar la tabla de estado',()=>{
 assert.match(objects,/return updateObject\(nodeId, \{ scriptIds: ids \}, \{ label \}\)/)
 assert.match(read('src/core/state/history.js'),/objects: JSON\.stringify\(toRaw\(p\.objects\)\)/)
})
test('MS-UI-13 · modelos nuevos usan únicamente scriptIds',()=>{
 assert.match(nodes,/props: \{\}, scriptIds: \[\]/);assert.match(nodes,/delete obj\.scriptId/)
})
test('MS-UI-14 · UI lista, abre, ordena y retira cada asociación',()=>{
 for(const token of ['v-for="(id, index) in assignedScriptIds"','moveNodeScript(obj.id, index, index + 1)','removeNodeScript(obj.id, id)','openInVSCode(id)','assignSelectedScript']) assert.ok(inspector.includes(token),token)
})
test('MS-UI-15 · Inspector usa el contrato de Assets y arrastre ordenado',()=>{
 assert.match(inspector,/nodeScriptFromDrop\(event\.dataTransfer/);assert.match(inspector,/onScriptSortStart/);assert.match(inspector,/onScriptSortDrop/)
})
test('MS-UI-16 · Jerarquía preserva un script o accede a Inspector con varios',()=>{
 assert.match(tree,/ids\.length === 1 && scriptNames\.value\.has\(ids\[0\]\)/);assert.match(tree,/store\.prefs\.rightTab = 'object'/)
 assert.match(tree,/addNodeScript\(row\.o\.id, script\.id\)/);assert.match(tree,/class="script-count"/)
})
test('MS-UI-17 · modelos guardan la lista por JSON sin duplicar scriptId',()=>{
 reset();ops.addNodeScript('a','b');const roundtrip=JSON.parse(JSON.stringify(store.project.objects));assert.deepEqual(roundtrip[0].scriptIds,['legacy','b']);assert.equal(Object.hasOwn(roundtrip[0],'scriptId'),false)
})
test('MS-UI-18 · .levelpackage incorpora referencias multiscript en G003',()=>{
 assert.match(levelpackage,/Script de Nodo: /)
 assert.match(levelpackageImport,/Dependencia de Script de Nodo no declarada/)
})
test('MS-UI-19 · no se introduce otro runtime ni otra jerarquía',()=>{
 assert.doesNotMatch(inspector+tree+objects,/new NodeScriptRuntime\(|new EventBus\(/)
})
test('MS-UI-20 · regresión G001: lista ordenada sigue siendo la autoridad en Play',()=>{
 const runtime=read('src/engine/runtime/scene/node-scripts.js')
 assert.match(runtime,/if \(Array\.isArray\(obj\?\.scriptIds\)\) return obj\.scriptIds/)
 assert.match(read('src/engine/runtime/scene/node-lifecycle.js'),/nodeScriptIds\(obj\)/)
})
