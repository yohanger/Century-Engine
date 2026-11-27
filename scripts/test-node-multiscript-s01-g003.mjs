// S01-G003: pruebas de migración, dependencias, Prefabs, Player y exportación.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const projectSource=read('src/core/project.js'), pkgSource=read('src/core/levelpackage.js'), importSource=read('src/core/levelpackage-import.js')
const prefabs=read('src/core/state/prefabs.js'), objs=read('src/core/state/objects.js'), lfproj=read('src/core/lfproj.js')
const scriptA={id:'scA',name:'A.js',file:'A.js',folder:'Assets/Scripts',execution:'node',code:'node.expose("a",()=>1)'}
const scriptB={id:'scB',name:'B.js',file:'B.js',folder:'Assets/Scripts',execution:'node',code:'node.expose("b",()=>1)'}
const entries=()=>[
 {id:'sceneS',kind:'scene',name:'Escena',file:'Escena.scene.json',folder:'Assets/Scenes',ref:{id:'sceneS',name:'Escena'}},
 ...[scriptA,scriptB].map(ref=>({id:ref.id,kind:'script',name:ref.name,file:ref.file,folder:ref.folder,ref})),
]
const plain=x=>JSON.parse(JSON.stringify(x))
const node=(id,scriptIds=['scB','scA'])=>({id,name:id,type:'node3d',parentId:null,scriptIds})
const simpleScene=(nodes=[node('first')])=>({objects:nodes,environment:{},terrain:{},signalConnections:[]})
const migrateSource=projectSource.slice(projectSource.indexOf('export function migrateNodeScripts(obj)'),projectSource.indexOf('export function migrateScene('))
const migrateNodeScripts=vm.runInNewContext(migrateSource.replace('export function','function')+'\nmigrateNodeScripts',{Object,Set,Error})
const packageCode=pkgSource.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')
const packageApi=vm.runInNewContext(packageCode+'\n({resolveLevelPackageSelection})',{
 allEntries:meta=>meta.entries,ROOT_FOLDER:'Assets',validateSignalConnections:links=>links||[],isSystemUi:()=>false,isSystemUiPath:()=>false,normalizeLiquid:x=>x,validateVfxResource:x=>x,Date,Set,Map,JSON,Error,Object
})
const importCode=importSource.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')
const plan=vm.runInNewContext(importCode+'\nplanLevelPackageImport',{
 allEntries:proj=>proj.entries||[],ROOT_FOLDER:'Assets',sanitizeName:x=>x,isSystemUiPath:()=>false,
 validateSignalConnections:links=>links||[],remapSignalConnections:(links,map,uid)=>links.map(c=>({...c,id:uid(),emitterId:map.get(c.emitterId),receiverId:map.get(c.receiverId)})),
 migrateNodeScripts,LEVELPACKAGE_FORMAT:'levelforge-package',LEVELPACKAGE_VERSION:1,normalizeMaterial:x=>x,normalizeLiquid:x=>x,validateVfxResource:x=>x,
 Map,Set,Error,Object,Uint8Array
})
let unique=0
const uuid=(prefix='t')=>`${prefix}_new_${++unique}`
const pkgFixture=(scripts=[scriptA,scriptB],nodes=[node('first')])=>{
 const es=entries().filter(e=>e.kind==='scene'||scripts.some(s=>s.id===e.id)).map(e=>({id:e.id,kind:e.kind,name:e.name,file:e.file,folder:e.folder,path:`${e.folder}/${e.file}`,metadata:e.kind==='script'?{execution:'node'}:{},dependencies:e.kind==='scene'?scripts.map(s=>s.id):[]}))
 return {manifest:{entries:es,roots:[{kind:'scene',id:'sceneS'}]},contents:new Map([['sceneS',simpleScene(nodes)],...scripts.map(s=>[s.id,s.code])]),project:{entries:[]},selectedIds:['sceneS'],makeId:uuid}
}
test('MS-INT-01: lista y orden preservados en migración real',()=>{const a=node('old',['scB','scA']);migrateNodeScripts(a);assert.deepEqual(a.scriptIds,['scB','scA']);assert.ok(!Object.hasOwn(a,'scriptId'))})
test('MS-INT-02: normalización de Prefab antiguo a una lista',()=>{const old={id:'old',scriptId:'scA'};migrateNodeScripts(old);assert.deepEqual(Array.from(old.scriptIds),['scA']);assert.equal(old.scriptId,undefined)})
test('MS-INT-03: referencias inválidas o duplicadas rechazadas',()=>{for(const scriptIds of [['scA','scA'],['scA',null],[' scA']])assert.throws(()=>migrateNodeScripts({id:'o',scriptIds}),/inválidos/)})
test('MS-INT-04: exportación .levelpackage cierra dependencias de scriptIds',()=>{
 const meta={entries:entries()},scenes=new Map([['sceneS',simpleScene()]])
 const chosen=packageApi.resolveLevelPackageSelection({meta,scenes,selection:[{kind:'scene',id:'sceneS'}]})
 assert.deepEqual([...chosen.entries].filter(e=>e.kind==='script').map(e=>e.id).sort(),['scA','scB'])
 assert.deepEqual([...chosen.dependencyIds.get('sceneS')].sort(),['scA','scB'])
})
test('MS-INT-05: exportación bloquea script ausente sin perder datos',()=>{
 const meta={entries:entries().filter(e=>e.id!=='scB')},scenes=new Map([['sceneS',simpleScene()]])
 assert.throws(()=>packageApi.resolveLevelPackageSelection({meta,scenes,selection:[{kind:'scene',id:'sceneS'}]}),/Script de Nodo/)
})
test('MS-INT-06: exportación rechaza Scripts Globales asociados',()=>{
 const list=entries();list.find(e=>e.id==='scB').ref={...scriptB,execution:'global'}
 assert.throws(()=>packageApi.resolveLevelPackageSelection({meta:{entries:list},scenes:new Map([['sceneS',simpleScene()]]) ,selection:[{kind:'scene',id:'sceneS'}]}),/Script de Nodo/)
})
test('MS-INT-07: importación remapea scriptIds sin cambiar su orden',()=>{
 const args=pkgFixture();const result=plan(args);const imported=result.scenes[0].data.objects[0]
 assert.equal(imported.scriptIds.length,2)
 assert.equal(imported.scriptIds[0],result.idMap.scB)
 assert.equal(imported.scriptIds[1],result.idMap.scA)
 assert.notEqual(imported.id,'first')
})
test('MS-INT-08: importación rechaza dependencia no declarada',()=>{
 const args=pkgFixture();args.manifest.entries[0].dependencies=['scA']
 assert.throws(()=>plan(args),/Script de Nodo no incluido|Dependencia de Script de Nodo no declarada/)
})
test('MS-INT-09: importación rechaza script faltante en el paquete',()=>{
 const args=pkgFixture([scriptA]);assert.throws(()=>plan(args),/Script de Nodo no incluido/)
})
test('MS-INT-10: recurso reutilizado como Script Global no se asigna a Nodo',()=>{
 const args=pkgFixture();args.project.entries=[{id:'existing',kind:'script',name:'A.js',file:'A.js',folder:'Assets/Scripts',ref:{id:'existing',execution:'global'}}]
 args.decisions={scA:'reuse'}
 assert.throws(()=>plan(args),/no es un Script de Nodo/)
})
test('MS-INT-11: recurso Script de Nodo reutilizado conserva ID del destino',()=>{
 const args=pkgFixture();args.project.entries=[{id:'existing',kind:'script',name:'A.js',file:'A.js',folder:'Assets/Scripts',ref:{id:'existing',execution:'node'}}]
 args.decisions={scA:'reuse'};const result=plan(args)
 assert.equal(result.scenes[0].data.objects[0].scriptIds[1],'existing')
})
test('MS-INT-12: importación de escena antigua migra scriptId',()=>{
 const args=pkgFixture([scriptA],[{id:'old',name:'Viejo',scriptId:'scA'}]);const result=plan(args)
 assert.deepEqual(Array.from(result.scenes[0].data.objects[0].scriptIds),[result.idMap.scA]);assert.equal(Object.hasOwn(result.scenes[0].data.objects[0],'scriptId'),false)
})
test('MS-INT-13: Prefab materializa y aplica las listas en orden',()=>{
 assert.match(prefabs,/const deep = \(o\) => migrateNodeScripts/)
 assert.match(prefabs,/migrateNodeScripts\(stripMarks\(JSON\.parse\(JSON\.stringify\(o\)\)\)\)/)
 assert.match(prefabs,/const base = migrateNodeScripts\(pf\.objects\[0\]\)/)
})
test('MS-INT-14: copia, pegado y duplicación mantienen datos originales',()=>{
 assert.match(objs,/const copy = JSON\.parse\(JSON\.stringify\(src\)\)/)
 assert.match(objs,/clip\.objects\.map/)
 assert.match(objs,/cloneSubtree\(/)
})
test('MS-INT-15: formato .lfproj migra Prefabs tras leer archivo',()=>{
 assert.match(lfproj,/e\.ref\.objects = \(prefab\.objects \|\| \[\]\)\.map\(migrateNodeScripts\)/)
 assert.match(lfproj,/JSON\.stringify\(\{ objects: e\.ref\.objects \|\| \[\]/)
})
test('MS-INT-16: nuevo nodo Terreno usa solo scriptIds',()=>{
 const src=read('src/core/state/terrain.js');assert.match(src,/terrainId: t\.id \}, scriptIds: \[\]/);assert.doesNotMatch(src,/scriptId: ''/)
})
test('MS-INT-17: Player valida dependencia y rechaza scripts inexistentes',()=>{
 const source=read('src/core/buildList.js')
 const body=source.slice(source.indexOf('export function validateBuildSources'))
 const validate=vm.runInNewContext(body.replace('export function','function')+'\nvalidateBuildSources',{
  validateSceneVfx:()=>{},modelIdsInScene:()=>new Set(),Set,Map,Error
 })
 const base={models:[],scripts:[scriptA,scriptB],vfx:[],assets:[],prefabs:[]}
 assert.doesNotThrow(()=>validate(base,[{name:'Escena',data:simpleScene()}],new Map()))
 assert.throws(()=>validate({...base,scripts:[scriptA]},[{name:'Escena',data:simpleScene()}],new Map()),/ausente o incompatible/)
})
test('MS-INT-18: Player conserva metadatos y listas al empaquetar',()=>{
 const game=read('src/core/state/game.js'),format=read('src/engine/runtime/package/format.js')
 assert.match(game,/validateBuildSources\(meta, data, files\)/);assert.match(game,/writePackage\(\{ data: meta, scenes: data, files \}\)/)
 assert.match(format,/JSON\.stringify\(s\.data\)/)
})
test('MS-INT-19: Godot bloquea scripts en una o múltiples escenas',()=>{
 const exp=read('src/core/exporter.js');assert.match(exp,/Scripts de Nodo JavaScript no tienen conversión GDScript/)
 assert.match(exp,/exportScenesZip[\s\S]*?items\.some/);assert.match(exp,/exportScenesFiles[\s\S]*?items\.some/)
})
test('MS-INT-20: no se crea otro runtime ni despacho nuevo',()=>{
 const changed=[prefabs,read('src/core/buildList.js'),pkgSource,importSource]
 for(const src of changed)assert.doesNotMatch(src,/new NodeScriptRuntime\(|setInterval\(|requestAnimationFrame\(/)
})
