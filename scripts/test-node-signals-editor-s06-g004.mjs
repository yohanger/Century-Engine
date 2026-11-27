// Integración G004: relaciones de escena, remapeo, Prefabs y formatos sin ejecutar el Editor.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const project = read('src/core/project.js')
const objects = read('src/core/state/objects.js')
const prefabs = read('src/core/state/prefabs.js')
const imports = read('src/core/levelpackage-import.js')
const lfproj = read('src/core/lfproj.js')
const packageText = read('src/core/levelpackage.js')
const getBlock = (source, begin, end) => {
  const a = source.indexOf(begin), b = source.indexOf(end, a)
  assert.ok(a >= 0 && b > a, `No aparece bloque ${begin}`)
  return source.slice(a, b).replaceAll('export function', 'function')
}
const block = getBlock(project, 'export function validateSignalConnections(', 'export function migrateScene(')
let sequence = 0
const ctx = vm.createContext({ uid: () => `sig_${++sequence}`, Map, Set, JSON, Error })
const { validateSignalConnections, remapSignalConnections, migrateNodeScripts } = vm.runInContext(block + '\n({validateSignalConnections,remapSignalConnections,migrateNodeScripts})', ctx)
const conn = (id, a = 'a', b = 'b') => ({ id, emitterId:a, receiverId:b, signal:'alerta', method:'recibir' })
const plain = (value) => JSON.parse(JSON.stringify(value))
test('FINAL-01 · remapeo de ambos extremos y nueva identidad', () => {
 const links = plain(remapSignalConnections([conn('old')], new Map([['a','A'],['b','B']])))
 assert.equal(links.length, 1);assert.equal(links[0].emitterId,'A');assert.equal(links[0].receiverId,'B');assert.notEqual(links[0].id,'old')
})
test('FINAL-02 · copia solo conexiones completamente internas', () => {
 const links=plain(remapSignalConnections([conn('internal'),conn('external','a','outside')],new Map([['a','A'],['b','B']])))
 assert.equal(links.length,1);assert.equal(links[0].emitterId,'A')
})
test('FINAL-03 · conexiones múltiples conservan sus argumentos editoriales', () => {
 const l=conn('c');l.signal='precipitación';l.method='activar'
 const res=plain(remapSignalConnections([l],new Map([['a','x'],['b','y']])))
 assert.equal(res[0].signal,l.signal);assert.equal(res[0].method,l.method)
})
test('FINAL-04 · ID duplicado no se acepta antes de copiar', () => {
 assert.throws(()=>remapSignalConnections([conn('x'),conn('x')],new Map([['a','x'],['b','y']])))
})
test('FINAL-05 · duplicación comparte un único mapa para múltiples raíces', () => {
 assert.match(objects,/const ids = new Map\(\)[\s\S]*?roots\.map\(\(id\) => cloneSubtree\(id,[^\n]*ids\)/)
 assert.match(objects,/store\.project\.signalConnections\.push\(\.\.\.remapSignalConnections\(store\.project\.signalConnections, ids\)\)/)
})
test('FINAL-06 · Alt+D remapea conexiones sin alterar política de malla', () => {
 assert.match(objects,/cloneSubtree\(id, getObject\(id\)\.parentId \|\| null, offset, true, ids\)/)
 assert.match(objects,/store\.project\.signalConnections = originalConnections/)
})
test('FINAL-07 · portapapeles captura solo conexiones de la selección', () => {
 assert.match(objects,/included\.has\(c\.emitterId\) && included\.has\(c\.receiverId\)/)
 assert.match(objects,/signalConnections: JSON\.parse\(JSON\.stringify\(signalConnections\)\)/)
})
test('FINAL-08 · cada pegado crea IDs distintos para los nodos y enlaces', () => {
 assert.match(objects,/const map = new Map\(clip\.objects\.map\(\(o\) => \[o\.id, uid\(\)\]\)\)/)
 assert.match(objects,/remapSignalConnections\(clip\.signalConnections, map\)/)
 const mapping = new Map([['a','copy-a'],['b','copy-b']])
 assert.notEqual(remapSignalConnections([conn('copy')],mapping)[0].id,remapSignalConnections([conn('copy')],mapping)[0].id)
})
test('FINAL-09 · eliminar nodos retira conexiones recuperables por historial', () => {
 assert.match(objects,/store\.project\.signalConnections = \(store\.project\.signalConnections \|\| \[\]\)\.filter\(\(c\) => !doomed\.has\(c\.emitterId\) && !doomed\.has\(c\.receiverId\)\)/)
 const h=read('src/core/state/history.js');assert.match(h,/signalConnections: JSON\.stringify/);assert.match(h,/p\.signalConnections = JSON\.parse/)
})
test('FINAL-10 · recurso Prefab incluye sus conexiones internas', () => {
 assert.match(prefabs,/const pf = \{ id: uid\('pf'\), name: fname, folder, rev: 1, objects: data, signalConnections:/)
 assert.match(prefabs,/const \{ objects: objs, connections \} = materialize\(pf, parentId\)/)
})
test('FINAL-11 · materialización de Prefab remapea ambos extremos por instancia', () => {
 const extract=getBlock(prefabs,'function materialize(pf, parentId) {','/** Instancia un prefab')
 const c=vm.createContext({ uid:()=>`obj_${++sequence}`,stripMarks:(o)=>o,remapSignalConnections,migrateNodeScripts,Map,JSON })
 const materialize=vm.runInContext(extract+'\nmaterialize',c)
 const pf={objects:[{id:'a',parentId:null},{id:'b',parentId:'a'}],signalConnections:[conn('old')]}
 const first=materialize(pf,null),second=materialize(pf,null)
 assert.equal(first.connections[0].emitterId,first.objects[0].id)
 assert.equal(first.connections[0].receiverId,first.objects[1].id)
 assert.notEqual(first.connections[0].receiverId,second.connections[0].receiverId)
})
test('FINAL-12 · refresco de Prefab no redirige enlaces externos sin equivalencia', () => {
 assert.match(prefabs,/internalIds\.has\(c\.emitterId\) && internalIds\.has\(c\.receiverId\)/)
 assert.match(prefabs,/remapSignalConnections\(pf\.signalConnections \|\| \[\], map\)/)
})
test('FINAL-13 · Apply, Revert y Unpack respetan autoría de escena', () => {
 assert.match(prefabs,/pf\.signalConnections = JSON\.parse/)
 assert.match(prefabs,/export function revertInstance\(/)
 assert.match(prefabs,/export function unpackInstance\(/)
})
test('FINAL-14 · .lfproj serializa y lee conexiones de Prefabs', () => {
 assert.match(lfproj,/JSON\.stringify\(\{ objects: e\.ref\.objects \|\| \[\], signalConnections: e\.ref\.signalConnections \|\| \[\] \}\)/)
 assert.match(lfproj,/e\.ref\.signalConnections = prefab\.signalConnections \|\| \[\]/)
 assert.match(lfproj,/objects, signalConnections, \.\.\.rest/)
})
test('FINAL-15 · .levelpackage conserva conexiones y remapea IDs al importar', () => {
 assert.doesNotMatch(packageText,/exportación \.levelpackage pendiente de remapeo seguro/)
 assert.match(imports,/data: remapNodes\(replace\(plain\(data\)\)\)/)
 assert.match(imports,/ref\.signalConnections = prefab\.signalConnections/)
 assert.match(imports,/importación bloqueada para evitar pérdida de datos/)
})
test('FINAL-16 · export Godot bloqueado de modo preventivo para todas las escenas', () => {
 const src=read('src/core/exporter.js')
 assert.match(src,/exportScenesZip[\s\S]*?items\.some\(\(\{project\}\) => project\.signalConnections\?\.length\)/)
 assert.match(src,/exportScenesFiles[\s\S]*?items\.some\(\(\{project\}\) => project\.signalConnections\?\.length\)/)
})
test('FINAL-17 · Player conserva la serialización de conexiones y Jolt', () => {
 const src=read('src/core/state/game.js');assert.match(src,/buildProjectFile\(/);assert.match(src,/writePackage\(/)
 const runtime=read('src/engine/runtime/scene/node-scripts.js');assert.match(runtime,/project\.signalConnections/)
})
test('FINAL-18 · no hay despachador adicional por fotograma en los cambios', () => {
 const active=[objects,prefabs,imports,lfproj,packageText];for(const src of active) assert.doesNotMatch(src,/setInterval\(|requestAnimationFrame\(/)
})
const loadImporter = () => {
 const compiled = imports.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')
 const scope=vm.createContext({Map,Set,JSON,Object,Error,Uint8Array,
   allEntries:()=>[],ROOT_FOLDER:'Assets',sanitizeName:(n)=>n,
   validateSignalConnections,remapSignalConnections,migrateNodeScripts,
   normalizeMaterial:x=>x,normalizeLiquid:x=>x,validateVfxResource:x=>x,
   isSystemUiPath:()=>false,LEVELPACKAGE_FORMAT:'levelforge-package',LEVELPACKAGE_VERSION:1})
 return vm.runInContext(compiled+'\n({planLevelPackageImport})',scope).planLevelPackageImport
}
const importFixture = () => {
 const entry={id:'s_old',kind:'scene',name:'Prueba',file:'Prueba.scene.json',folder:'Assets/Scenes',path:'Assets/Scenes/Prueba.scene.json',metadata:{},dependencies:[]}
 const scene={objects:[{id:'a',parentId:null,name:'A'},{id:'b',parentId:'a',name:'B'}],environment:{},terrain:{},signalConnections:[conn('old')]}
 return {manifest:{entries:[entry],roots:[{id:'s_old',kind:'scene'}]},contents:new Map([['s_old',scene]]),project:{},selectedIds:['s_old'],makeId:(prefix='n')=>`${prefix}_${++sequence}`}
}
test('FINAL-19 · importación real de .levelpackage remapea nodos, padre y conexiones',()=>{
 const result=loadImporter()(importFixture())
 const scene=result.scenes[0].data
 assert.equal(scene.objects.length,2);assert.notEqual(scene.objects[0].id,'a')
 assert.equal(scene.objects[1].parentId,scene.objects[0].id)
 assert.equal(scene.signalConnections[0].emitterId,scene.objects[0].id)
 assert.equal(scene.signalConnections[0].receiverId,scene.objects[1].id)
 assert.notEqual(scene.signalConnections[0].id,'old')
})
test('FINAL-20 · importación real rechaza conexión con receptor externo sin perderla',()=>{
 const args=importFixture();args.contents.get('s_old').signalConnections[0].receiverId='desconocido'
 assert.throws(()=>loadImporter()(args),/importación bloqueada para evitar pérdida de datos/)
})
