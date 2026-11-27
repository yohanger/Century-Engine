import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {normalizeGroups,migrateObjectGroups,groupsOf,isInGroup,addGroup,removeGroup,defaultTagLayers,normalizeTagLayers,tagOf,layerMask,layersOf} from '../src/engine/runtime/layers.js'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const check=(n,f)=>test(n,f)
const sceneSrc=read('src/core/project.js'), runtimeSrc=read('src/engine/runtime/events/play-steps.js')
const ctx=vm.createContext({THREE:{Vector3:class {constructor(){} }},groupsOf,tagOf,layersOf,layerName:(tl,i)=>tl.layers[i].name,layerIndex:(tl,n)=>tl.layers.findIndex(x=>x.name===n),surfaceOf:()=>'',isInGroup})
vm.runInContext(runtimeSrc.replace(/^import .*$/gm,'').replace('export const stepMethods =','globalThis.stepMethods ='),ctx)
const methods=ctx.stepMethods
function world(){const project={tagLayers:defaultTagLayers(),objects:[{id:'a',name:'A',groups:['enemigos'],tag:'Enemy',layers:[0]},{id:'b',name:'B',groups:['enemigos','voladores'],tag:'Untagged',layers:[0]},{id:'c',name:'C',groups:[],tag:'Untagged',layers:[0]}]},active=new Set(['a','b','c']);const p={project,ed:{nodes:new Map([...active].map(i=>[i,{}]))},_nodeHandle(id){return this.ed.nodes.has(id)?{id}:undefined},_runtimeGroups:new Map()};Object.assign(p,methods);return p}
check('GP-01: normaliza nombres, duplicados y conserva orden',()=>assert.deepEqual(normalizeGroups([' Azul ','Azul','rojo','ROJO','']),['Azul','rojo']))
check('GP-02: limita longitud y cantidad',()=>{assert.equal(normalizeGroups(['x'.repeat(100)])[0].length,40);assert.equal(normalizeGroups(Array.from({length:200},(_,i)=>`g${i}`)).length,128)})
check('GP-03: Tag legacy se migra a group',()=>{const o={tag:'Enemigo'};migrateObjectGroups(o);assert.deepEqual(o.groups,['Enemigo']);assert.equal(o.tag,'Enemigo')})
check('GP-04: Untagged no se migra a grupo artificial',()=>{const o={tag:'Untagged'};migrateObjectGroups(o);assert.deepEqual(o.groups,[])})
check('GP-05: migración es idempotente',()=>{const o={tag:'Guardia'};migrateObjectGroups(o);migrateObjectGroups(o);assert.deepEqual(o.groups,['Guardia'])})
check('GP-06: groups explícitos tienen autoridad sobre tag antiguo',()=>{const o={tag:'Guardia',groups:['Enemigos']};migrateObjectGroups(o);assert.deepEqual(o.groups,['Enemigos'])})
check('GP-07: objeto pertenece a múltiples grupos',()=>assert.equal(isInGroup({groups:['Uno','Dos']},'dos'),true))
check('GP-08: sin groups heredados todavía se consulta tag',()=>assert.deepEqual(groupsOf({tag:'Viejo'}),['Viejo']))
check('GP-09: Layers conservan máscara y prioridad',()=>{assert.deepEqual(layersOf({layers:[3,8,3]}),[3,8]);assert.equal(layerMask({layers:[3,8]}),264)})
check('GP-10: registro permite nombres globales sin identidad de nodo',()=>{const tl=defaultTagLayers();assert.equal(addGroup(tl,'enemigos'),'enemigos');assert.equal(tl.groups.length,1);assert.equal(addGroup(tl,'ENEMIGOS'),null)})
check('GP-11: remover nombre no toca capas ni tags',()=>{const tl=defaultTagLayers();addGroup(tl,'x');assert.equal(removeGroup(tl,'x'),true);assert.equal(tl.groups.length,0);assert.equal(tl.layers.length,32);assert.ok(tl.tags.includes('Player'))})
check('GP-12: registro antiguo carga grupos desde nombres de tags',()=>{const tl=normalizeTagLayers({tags:['Untagged','Player','Legacy','Legacy'],layers:defaultTagLayers().layers});assert.ok(tl.groups.includes('Legacy'));assert.equal(tl.layers.length,32)})
check('GP-13: registro moderno con [] no recrea grupos legacy',()=>{const tl=normalizeTagLayers({tags:['Untagged','Player'],groups:[]});assert.deepEqual(tl.groups,[])})
check('GP-14: lectura de grupos en runtime sin estado paralelo persistido',()=>{const p=world();assert.deepEqual([...p._runtimeGroupsOf(p.project.objects[0])],['enemigos'])})
check('GP-15: añade grupo solo durante Play',()=>{const p=world(),o=p.project.objects[0];assert.equal(p._changeRuntimeGroup(o,'jefes',true),true);assert.deepEqual([...o.groups],['enemigos']);assert.deepEqual([...p._runtimeGroupsOf(o)],['enemigos','jefes'])})
check('GP-16: remover grupo en Play no modifica fuente guardada',()=>{const p=world(),o=p.project.objects[0];assert.equal(p._changeRuntimeGroup(o,'enemigos',false),true);assert.deepEqual([...o.groups],['enemigos']);assert.deepEqual([...p._runtimeGroupsOf(o)],[])})
check('GP-17: operaciones idempotentes',()=>{const p=world(),o=p.project.objects[0];assert.equal(p._changeRuntimeGroup(o,'enemigos',true),false);assert.equal(p._changeRuntimeGroup(o,'a',true),true);assert.equal(p._changeRuntimeGroup(o,'a',true),false)})
check('GP-18: consulta encuentra nodos activos únicos por grupo',()=>{const p=world();assert.deepEqual([...p._findByGroup('ENEMIGOS')].map(n=>n.id),['a','b'])})
check('GP-19: no devuelve nodos inactivos en escena',()=>{const p=world();p.ed.nodes.delete('b');assert.deepEqual([...p._findByGroup('enemigos')].map(n=>n.id),['a'])})
check('GP-20: al cambiar escena se vacía overlay de pertenencia',()=>{const p=world(),o=p.project.objects[0];p._changeRuntimeGroup(o,'nuevo',true);p._runtimeGroups=new Map();assert.deepEqual([...p._runtimeGroupsOf(o)],['enemigos']);assert.match(read('src/engine/runtime/events/play.js'),/_setupScene\(tag, here = false\) \{\s*this\._runtimeGroups = new Map\(\)/)})
check('GP-21: NodeHandle expone cinco contratos sin duplicar API',()=>{for(const key of ['add_to_group','remove_from_group','is_in_group','get_groups'])assert.ok(runtimeSrc.includes(key));assert.match(read('src/engine/runtime/events/play-host.js'),/getNodesInGroup:.*_findByGroup/);assert.match(read('src/engine/runtime/events/interpreter.js'),/get_nodes_in_group:/)})
check('GP-22: generación original de nodos lleva groups[]',()=>assert.match(read('src/engine/runtime/nodes/index.js'),/groups: \[\]/))
check('GP-23: carga de escenas normaliza grupos',()=>assert.match(sceneSrc,/for \(const o of scene\?\.objects \|\| \[\]\) \{\s*migrateObjectGroups\(o\)/))
check('GP-24: prefabs se migran también',()=>assert.match(sceneSrc,/for \(const prefab of meta\.prefabs\) for \(const obj of prefab\.objects \|\| \[\]\) migrateObjectGroups\(obj\)/))
check('GP-25: Inspector conserva Layers y muestra Groups',()=>{const s=read('src/components/TagLayerRow.vue');assert.match(s,/data-testid="insp-groups"/);assert.match(s,/data-testid="insp-layer"/);assert.doesNotMatch(s,/data-testid="insp-tag"/)})
check('GP-26: los Groups no incorporan comandos de eventos',()=>{const s=read('src/engine/runtime/events/commandDefs.js');assert.doesNotMatch(s,/add_to_group|get_nodes_in_group/)})
check('GP-27: IDs de Spawn y Trigger no son Groups',()=>{const s=read('src/engine/runtime/nodes/spawn.js')+read('src/engine/runtime/nodes/trigger.js');assert.match(s,/props: \{ tag:/);assert.doesNotMatch(s,/groups: \[/)})
check('GP-28: API d.ts alineada en Editor y extensión',()=>{for(const p of ['src/core/events/game-api.d.ts','vscode-extension/media/game-api.d.ts']){const s=read(p);for(const key of ['add_to_group','remove_from_group','is_in_group','get_groups','get_nodes_in_group'])assert.ok(s.includes(key),`${p} ${key}`)}})
check('GP-29: registro de Groups no rompe tags heredados de raycast/sensor',()=>{for(const p of ['src/engine/runtime/events/play-look.js','src/engine/runtime/events/play-sense.js'])assert.match(read(p),/tagOf/);assert.match(read('src/engine/runtime/events/play-steps.js'),/_findByTag/)})
check('GP-30: borrar grupo del registro no borra escenas sin abrir',()=>{const s=read('src/components/TagsLayersModal.vue');assert.doesNotMatch(s,/obj\.groups\s*=/);assert.match(s,/removeGroup\(t, name\)/)})

// Prueba de integración del NodeHandle real sin crear un renderer o motor paralelo.
const nodeSource=read('src/engine/runtime/events/play-nodes.js')
const nc=vm.createContext({THREE:{Vector3:class {constructor(){} }},DEG:Math.PI/180})
vm.runInContext(nodeSource.replace(/^import .*$/gm,'').replace('export const nodesMethods =','globalThis.nodesMethods ='),nc)
check('GP-31: NodeHandle de juego ejecuta realmente la API de Groups',()=>{
 const p=world(),o=p.project.objects[0],n={rotation:{x:0,y:0,z:0,set(){}},position:{toArray(){return [0,0,0]},set(){}},scale:{toArray(){return [1,1,1]}},userData:{},visible:true,updateMatrixWorld(){}}
 p.ed.nodes.set(o.id,n)
 p._animMethodsFor=()=>({});p._lightHandle=()=>undefined
 Object.assign(p,nc.nodesMethods)
 const h=p._nodeHandle(o.id)
 assert.equal(h.is_in_group('enemigos'),true)
 assert.equal(h.add_to_group('jefes'),true)
 assert.deepEqual([...h.get_groups()],['enemigos','jefes'])
 assert.deepEqual([...p._findByGroup('jefes')].map(v=>v.id),['a'])
 assert.equal(h.remove_from_group('jefes'),true)
 assert.equal(h.is_in_group('jefes'),false)
 assert.deepEqual([...o.groups],['enemigos'])
})
