// G001: el registro existente es la única fuente de metadata nativa de señales.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getDef, registerNode, getNativeSignals, getNativeSignal, AREA3D_NATIVE_SIGNALS } from '../src/engine/runtime/nodes/registry.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const names = ['body_entered', 'body_exited', 'area_entered', 'area_exited']
const common = ['ready','tree_entered','tree_exiting','tree_exited','animation_finished']
const stub=(type,nativeSignals)=>registerNode({type,create:()=>({}),build:()=>({}),update:()=>{},...(nativeSignals===undefined?{}:{nativeSignals})})

test('SIG-CAT-01 · registro simplificado conserva metadata nativa Area3D',()=>{
 stub('area3d');assert.deepEqual(getNativeSignals('area3d').map(s=>s.name),[...common,...names])
 assert.equal(getDef('area3d').nativeSignals.length,9)
})
test('SIG-CAT-02 · metadata nativa identifica fuente y fase física',()=>{
 for(const s of getNativeSignals('area3d').filter(s=>s.source==='jolt-area')){assert.equal(s.source,'jolt-area');assert.equal(s.phase,'physics');assert.ok(s.condition)}
})
test('SIG-CAT-03 · firma física preserva el evento real del runtime',()=>{
 for(const s of getNativeSignals('area3d').filter(s=>s.source==='jolt-area')) assert.deepEqual(s.args.map(a=>[a.name,a.type,[...a.fields]]),[['event','Area3DEvent',['areaId','type','id']]])
 assert.match(read('src/engine/runtime/physics/node-spatial.js'),/callback\(\{ areaId: id, \.\.\.other \}\)/)
})
test('SIG-CAT-04 · todas las señales reservadas aparecen en el registro',()=>{
 for(const n of names) assert.equal(getNativeSignal('area3d',n)?.name,n)
 assert.equal(getNativeSignal('area3d','area_shape_entered'),null)
})
test('SIG-CAT-05 · otros nodos no tienen señales inventadas',()=>{
 stub('staticbody3d',[]);stub('s01EmptyNode')
 assert.deepEqual(getNativeSignals('staticbody3d').map(s=>s.name),common)
 assert.deepEqual(getNativeSignals('s01EmptyNode').map(s=>s.name),common)
 assert.deepEqual(getNativeSignals('absent'),[])
})
test('SIG-CAT-06 · nombre no registrado devuelve null',()=>{
 assert.equal(getNativeSignal('area3d','ready')?.source,'node-lifecycle')
 assert.equal(getNativeSignal('area3d',''),null)
})
test('SIG-CAT-07 · lista y metadata son inmutables',()=>{
 const list=getNativeSignals('area3d')
 assert.equal(Object.isFrozen(list),true)
 assert.equal(Object.isFrozen(list[0]),true)
 assert.equal(Object.isFrozen(list[0].args),true)
 assert.throws(()=>list.push({name:'inventada'}),TypeError)
})
test('SIG-CAT-08 · metadata defectuosa/duplicada se rechaza',()=>{
 assert.throws(()=>stub('s01Bad', [{name:'z',source:'jolt',phase:'physics',args:[]},{name:'z',source:'jolt',phase:'physics',args:[]}]),/inválida/)
 assert.throws(()=>stub('s01Bad', [{name:' ',source:'jolt',phase:'physics',args:[]}]),/inválida/)
 assert.throws(()=>stub('s01Bad', [{name:'z',source:'',phase:'physics',args:[]}]),/inválida/)
 assert.deepEqual(getNativeSignals('s01Bad'),[])
})
test('SIG-CAT-09 · el registro estándar y el físico usan la misma constante',()=>{
 assert.equal(AREA3D_NATIVE_SIGNALS.length,4)
 assert.match(read('src/engine/runtime/nodes/physics.js'),/nativeSignals: type === 'area3d' \? AREA3D_NATIVE_SIGNALS : \[\]/)
})
test('SIG-CAT-10 · NodeScriptRuntime no mantiene lista propia de nativas',()=>{
 const src=read('src/engine/runtime/scene/node-scripts.js')
 assert.doesNotMatch(src,/const AREA_SIGNALS/)
 assert.match(src,/getNativeSignal\(emitter\.type, key\)/)
 assert.match(src,/getNativeSignal\(obj\.type, key\)/)
 assert.match(src,/spatial\.onArea\(/)
})
test('SIG-CAT-11 · el sensor reutiliza registro y conserva un solo mapa de listeners',()=>{
 const src=read('src/engine/runtime/physics/node-spatial.js')
 assert.match(src,/getNativeSignal\('area3d', signal\)\?\.source/)
 assert.match(src,/this\.listeners\.get\(key\)\.add\(callback\)/)
 assert.match(src,/this\.listeners\.get\(key\)\?\.delete\(callback\)/)
})
test('SIG-CAT-12 · Inspector lee la metadata sin ejecutar JS del usuario',()=>{
 const src=read('src/components/SignalConnectionsPanel.vue')
 assert.match(src,/getNativeSignals\(selected\.value\?\.type\)/)
 assert.doesNotMatch(src,/const AREA_SIGNALS|new Function\(|\beval\(/)
})
test('SIG-CAT-13 · Inspector conserva conexiones de escena y diálogo actual',()=>{
 const src=read('src/components/SignalConnectionsPanel.vue')
 assert.match(src,/store\.project\?\.signalConnections/)
 assert.match(src,/addSceneSignalConnection/)
 assert.match(src,/role="dialog"/)
})
test('SIG-CAT-14 · registro nativo no requiere instanciar un runtime',()=>{
 const src=read('src/engine/runtime/nodes/registry.js')
 assert.doesNotMatch(src,/new NodeSpatialRuntime|new JoltWorld|new NodeScriptRuntime/)
 assert.equal(getNativeSignals('area3d').length,9)
})
test('SIG-CAT-15 · un catálogo sin emisores no se presenta como implementado',()=>{
 for(const type of ['s01EmptyNode','staticbody3d'])assert.deepEqual(getNativeSignals(type).map(s=>s.name),common);assert.equal(getNativeSignals('unknown').length,0)
})
test('SIG-CAT-16 · no hay segundo bucle de despacho de señales',()=>{
 const production=['src/engine/runtime/nodes/registry.js','src/engine/runtime/nodes/physics.js','src/engine/runtime/scene/node-scripts.js','src/engine/runtime/physics/node-spatial.js','src/components/SignalConnectionsPanel.vue']
 for(const file of production)assert.doesNotMatch(read(file),/setInterval\(|requestAnimationFrame\(/)
})
test('SIG-CAT-17 · la metadata personalizada puede registrar un tipo futuro, sin crear emisor',()=>{
 const metadata=[{name:'otra',source:'fake-source',phase:'custom',args:[]}]
 stub('s01Additional',metadata)
 assert.equal(getNativeSignal('s01Additional','otra')?.source,'fake-source')
 assert.equal(getNativeSignal('s01Additional','no_existe'),null)
})
test('SIG-CAT-18 · contrato base de conexión y desconexión sigue disponible',()=>{
 assert.equal(typeof NodeScriptRuntime.prototype.connectSignal,'function')
 assert.equal(typeof NodeScriptRuntime.prototype.disconnectSignal,'function')
 assert.equal(typeof NodeScriptRuntime.prototype._releaseNative,'function')
})
