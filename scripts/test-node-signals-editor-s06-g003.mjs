// S06-G003: autoría visual e historial; la UI nunca ejecuta scripts del usuario en Edit Mode.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const read = (f) => readFileSync(new URL('../'+f, import.meta.url), 'utf8')
const projectSource = read('src/core/state/project.js')
const block = projectSource.slice(projectSource.indexOf('// Conexiones visuales: una sola fuente'), projectSource.indexOf('//  PROYECTO · ESCENAS · GUARDADO'))
const make = (id) => ({id,name:id,type:'node3d'})
let commits = [],seq=1
const store = {locked:false,play:{on:false},edit:{on:false},paint:{on:false},project:{objects:[make('a'),make('b')],signalConnections:[]}}
const validate = (connections) => {
 const ids=new Set(),pairs=new Set()
 for(const c of connections){
  for(const k of ['id','emitterId','signal','receiverId','method']) assert.equal(typeof c[k], 'string')
  for(const k of ['id','emitterId','signal','receiverId','method']) assert.ok(c[k] && c[k]===c[k].trim())
  assert.ok(!ids.has(c.id));ids.add(c.id)
  const pair=JSON.stringify([c.emitterId,c.signal,c.receiverId,c.method]);assert.ok(!pairs.has(pair),'duplicado');pairs.add(pair)
 }
}
const context=vm.createContext({store,uid:()=>`sig-${seq++}`,commit:(name)=>commits.push(name),validateSignalConnections:validate,Error,Set})
const api=vm.runInContext(block.replace(/export function/g,'function')+'\n({addSceneSignalConnection,editSceneSignalConnection,removeSceneSignalConnection})',context)
function reset(){store.project.signalConnections=[];store.locked=false;store.play.on=false;store.edit.on=false;store.paint.on=false;commits=[]}
test('UI-01 · el panel existe y usa el InspectorDock actual',()=>{
 const src=read('src/components/InspectorDock.vue');assert.match(src,/\['signals', 'Señales'/);assert.match(src,/SignalConnectionsPanel v-if="tab === 'signals'"/)
})
test('UI-02 · se muestra catálogo nativo de Area3D',()=>{
 const src=read('src/components/SignalConnectionsPanel.vue');for(const s of ['body_entered','body_exited','area_entered','area_exited'])assert.ok(src.includes(s))
})
test('UI-03 · sin nuevo registro de conexiones',()=>assert.match(read('src/components/SignalConnectionsPanel.vue'),/store\.project\?\.signalConnections/))
test('UI-04 · creación preserva identidad y marca historial',()=>{
 reset();const id=api.addSceneSignalConnection({emitterId:'a',signal:' alerta ',receiverId:'b',method:' recibir '})
 assert.equal(store.project.signalConnections[0].id,id);assert.equal(store.project.signalConnections[0].signal,'alerta');assert.equal(commits[0],'Conectar señal')
})
test('UI-05 · edición conserva ID y modifica el método',()=>{
 reset();const id=api.addSceneSignalConnection({emitterId:'a',signal:'a',receiverId:'b',method:'m'})
 api.editSceneSignalConnection(id,{emitterId:'a',signal:'a',receiverId:'b',method:'n'});assert.equal(store.project.signalConnections[0].id,id)
 assert.equal(store.project.signalConnections[0].method,'n');assert.equal(commits.at(-1),'Editar conexión de señal')
})
test('UI-06 · eliminar desconecta por ID sin tocar scripts',()=>{
 reset();const id=api.addSceneSignalConnection({emitterId:'a',signal:'a',receiverId:'b',method:'m'})
 assert.equal(api.removeSceneSignalConnection(id),true);assert.equal(api.removeSceneSignalConnection(id),false);assert.equal(store.project.signalConnections.length,0)
})
test('UI-07 · rechaza duplicados sin alterar autoría',()=>{
 reset();api.addSceneSignalConnection({emitterId:'a',signal:'a',receiverId:'b',method:'m'});const prior=JSON.stringify(store.project.signalConnections)
 assert.throws(()=>api.addSceneSignalConnection({emitterId:'a',signal:'a',receiverId:'b',method:'m'}));assert.equal(JSON.stringify(store.project.signalConnections),prior)
})
test('UI-08 · rechaza vínculos cruzados y receptor ausente',()=>{
 reset();assert.throws(()=>api.addSceneSignalConnection({emitterId:'x',signal:'a',receiverId:'b',method:'m'}));assert.equal(store.project.signalConnections.length,0)
})
test('UI-09 · bloquea editar mientras está en Play',()=>{
 reset();store.play.on=true;assert.throws(()=>api.addSceneSignalConnection({emitterId:'a',signal:'x',receiverId:'b',method:'m'}));assert.equal(store.project.signalConnections.length,0);store.play.on=false
})
test('UI-10 · bloquea editar en Edit Mode o Paint Mode',()=>{
 reset();store.edit.on=true;assert.throws(()=>api.addSceneSignalConnection({emitterId:'a',signal:'x',receiverId:'b',method:'m'}));store.edit.on=false;store.paint.on=true
 assert.throws(()=>api.addSceneSignalConnection({emitterId:'a',signal:'x',receiverId:'b',method:'m'}));store.paint.on=false
})
test('UI-11 · historial captura y restaura signalConnections sin duplicar estructuras',()=>{
 const text=read('src/core/state/history.js');assert.match(text,/signalConnections: JSON\.stringify\(toRaw\(p\.signalConnections \|\| \[\]\)\)/)
 assert.match(text,/p\.signalConnections = JSON\.parse\(e\.signalConnections \|\| '\[\]'\)/)
})
test('UI-12 · el Editor no ejecuta scripts para hacer descubrimiento',()=>{
 const src=read('src/components/SignalConnectionsPanel.vue');assert.doesNotMatch(src,/new Function\(|\beval\(|\.runScript\(/)
 assert.match(src,/Pendiente de validar en Play/)
})
test('UI-13 · estados activos y errores proceden del runtime existente',()=>{
 const src=read('src/components/SignalConnectionsPanel.vue');assert.match(src,/runtime\.value\.sceneConnections\?\.has\(c\.id\)/)
 assert.match(src,/runtime\.value\.sceneConnectionErrors\?\.has\(c\.id\)/)
})
test('UI-14 · el diálogo mantiene roles accesibles y Escape',()=>{
 const src=read('src/components/SignalConnectionsPanel.vue');assert.match(src,/role="dialog"/);assert.match(src,/@keydown\.esc="closeDialog"/);assert.match(src,/type="search"/)
})
test('UI-15 · conexión duplicada en edición rechazada, sin mutación',()=>{
 reset();const first=api.addSceneSignalConnection({emitterId:'a',signal:'x',receiverId:'b',method:'a'})
 const second=api.addSceneSignalConnection({emitterId:'a',signal:'x',receiverId:'b',method:'b'})
 assert.throws(()=>api.editSceneSignalConnection(second,{emitterId:'a',signal:'x',receiverId:'b',method:'a'}));assert.equal(store.project.signalConnections[1].method,'b');assert.equal(store.project.signalConnections[0].id,first)
})
test('UI-16 · archivo modificado no crea nuevo intérprete, Events ni SceneGraph',()=>{
 const src=read('src/components/SignalConnectionsPanel.vue');assert.doesNotMatch(src,/(new EventBus|new SceneGraph|new NodeScriptRuntime)/)
})
