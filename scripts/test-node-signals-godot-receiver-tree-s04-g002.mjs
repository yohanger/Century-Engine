import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { registerNode, getNativeSignals } from '../src/engine/runtime/nodes/registry.js'
import { discoverNodeSignals, nodeScriptIds } from '../src/engine/runtime/scene/node-scripts.js'
const src=readFileSync(new URL('../src/components/SignalConnectionsPanel.vue',import.meta.url),'utf8')
const setup=src.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
const template=src.slice(src.indexOf('<template>')+10, src.lastIndexOf('</template>'))
assert.ok(setup && template)
registerNode({type:'s04receiverqa',label:'QA receptor',create:()=>({}),build:()=>({}),update:()=>{}})
function fixture(){
 const obj=(id,parentId=null)=>({id,name:id,type:'s04receiverqa',parentId,scriptIds:[]})
 const project={objects:[obj('grand','child'),obj('emitter','world'),obj('other'),obj('world'),obj('child','emitter'),obj('sibling','world'),obj('bad1','bad2'),obj('bad2','bad1')],scripts:[],signalConnections:[{id:'old',emitterId:'emitter',signal:'ready',receiverId:'sibling',method:'avisar'}],activeSceneId:'scene'}
 const store={project,selectedId:'emitter',selectedIds:['emitter'],sceneSel:null,projSel:null,audioInspector:null,locked:false,play:{on:false},edit:{on:false},paint:{on:false},editor:null}
 const operations=[]
 const context={store,Set,Map,console,computed:fn=>({get value(){return fn()}}),ref:value=>({value}),watch:()=>{},nextTick:cb=>cb?Promise.resolve().then(cb):Promise.resolve(),discoverNodeSignals,nodeScriptIds,getNativeSignals,toast:(...args)=>operations.push(['toast',...args]),addSceneSignalConnection:data=>operations.push(['add',data]),editSceneSignalConnection:(id,data)=>operations.push(['edit',id,data]),removeSceneSignalConnection:id=>operations.push(['remove',id]),document:{activeElement:null}}
 const expr=setup.replace(/^import[^\n]*\n/gm,'')+'\n;({receiverRows,receiverScope,receiverSearch,isInEmitterTree,openNew,openEdit,closeDialog,form,save,dialog,receiverKeydown,selectReceiver})'
 return {ui:vm.runInNewContext(expr,context),store,operations}
}
const ids=rows=>rows.map(o=>o.id).join(',')
test('TREE-01: la vista predeterminada inicia en emisor y solo muestra descendientes',()=>{const {ui}=fixture();assert.equal(ui.receiverScope.value,'subtree');assert.equal(ids(ui.receiverRows.value),'emitter,child,grand');assert.equal(ui.receiverRows.value.map(o=>o.depth).join(','),'0,1,2')})
test('TREE-02: al conectar se reinicia alcance contextual tras abrir otra vez',()=>{const {ui}=fixture();ui.receiverScope.value='scene';ui.openNew('ready');assert.equal(ui.receiverScope.value,'subtree');assert.equal(ids(ui.receiverRows.value),'emitter,child,grand');ui.closeDialog();ui.receiverScope.value='scene';ui.openNew('ready');assert.equal(ui.receiverScope.value,'subtree')})
test('TREE-03: opción explícita muestra escena completa sin modificar proyecto',()=>{const {ui,store}=fixture();const before=JSON.stringify(store.project.objects);ui.receiverScope.value='scene';assert.equal(ui.receiverRows.value.length,8);assert.equal(new Set(ui.receiverRows.value.map(o=>o.id)).size,8);assert.equal(JSON.stringify(store.project.objects),before)})
test('TREE-04: la escena conserva huérfanos y ciclos sin duplicar filas',()=>{const {ui}=fixture();ui.receiverScope.value='scene';assert.equal(ui.receiverRows.value.filter(o=>o.id==='bad1').length,1);assert.equal(ui.receiverRows.value.filter(o=>o.id==='bad2').length,1)})
test('TREE-05: buscar un descendiente incluye ancestros dentro del emisor',()=>{const {ui}=fixture();ui.receiverSearch.value='grand';assert.equal(ids(ui.receiverRows.value),'emitter,child,grand')})
test('TREE-06: la búsqueda contextual no filtra nodos fuera del subárbol',()=>{const {ui}=fixture();ui.receiverSearch.value='sibling';assert.equal(ui.receiverRows.value.length,0);ui.receiverScope.value='scene';assert.equal(ids(ui.receiverRows.value),'world,sibling')})
test('TREE-07: un receptor histórico externo se expone sin cambiar su identidad',()=>{const {ui,store}=fixture();ui.openEdit(store.project.signalConnections[0]);assert.equal(ui.receiverScope.value,'scene');assert.equal(ui.form.value.receiverId,'sibling');assert.ok(ui.receiverRows.value.some(o=>o.id==='sibling'))})
test('TREE-08: receptor histórico descendiente mantiene vista acotada',()=>{const {ui,store}=fixture();store.project.signalConnections[0].receiverId='grand';ui.openEdit(store.project.signalConnections[0]);assert.equal(ui.receiverScope.value,'subtree');assert.equal(ids(ui.receiverRows.value),'emitter,child,grand')})
test('TREE-09: vínculo guardado no cambia al alternar el alcance',()=>{const {ui,store,operations}=fixture();const c=store.project.signalConnections[0];ui.openEdit(c);ui.receiverScope.value='subtree';assert.equal(ui.form.value.receiverId,'sibling');ui.save();assert.equal(operations[0][0],'edit');assert.equal(operations[0][1],c.id);assert.equal(operations[0][2].receiverId,'sibling')})
test('TREE-10: método y emisor se conservan en edición histórica',()=>{const {ui,store,operations}=fixture();ui.openEdit(store.project.signalConnections[0]);ui.form.value.method='nuevo';ui.save();assert.equal(operations[0][2].emitterId,'emitter');assert.equal(operations[0][2].signal,'ready');assert.equal(operations[0][2].method,'nuevo')})
test('TREE-11: conexión a receptor externo requiere selección explícita en escena',()=>{const {ui,operations}=fixture();ui.openNew('ready');assert.ok(!ui.receiverRows.value.some(o=>o.id==='other'));ui.receiverScope.value='scene';ui.selectReceiver('other');ui.form.value.method='metodo';ui.save();assert.equal(operations[0][0],'add');assert.equal(operations[0][1].receiverId,'other')})
test('TREE-12: alcance explícito no altera señales registradas o runtime',()=>{assert.match(template,/Subárbol del emisor/);assert.match(template,/Toda la escena/);assert.match(template,/aria-pressed/);assert.doesNotMatch(setup,/new Function\(|\beval\(/);assert.match(setup,/addSceneSignalConnection\(data\)/)})
test('TREE-13: el diálogo mantiene árbol accesible y foco por teclado',()=>{for(const t of ['role="tree" aria-label="Árbol de nodos receptores"','role="treeitem" class="sig-receiver-row"','@keydown="receiverKeydown($event,i)"','aria-label="Alcance del árbol receptor"'])assert.ok(template.includes(t),t)})
test('TREE-14: la vista empieza en el emisor aunque este no sea raíz',()=>{const {ui}=fixture();assert.equal(ui.receiverRows.value[0].id,'emitter');assert.equal(ui.receiverRows.value[0].depth,0);assert.equal(ui.receiverRows.value.length,3)})
test('TREE-15: recorrido de ancestros maneja referencias cíclicas y ausentes',()=>{const {ui}=fixture();assert.equal(ui.isInEmitterTree('bad1'),false);assert.equal(ui.isInEmitterTree('none'),false);assert.equal(ui.isInEmitterTree('grand'),true)})
