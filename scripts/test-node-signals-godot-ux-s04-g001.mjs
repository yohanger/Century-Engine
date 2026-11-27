// S04-G001: auditoría funcional del árbol Signals y del diálogo básico al estilo Godot.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { registerNode, getNativeSignals } from '../src/engine/runtime/nodes/registry.js'
import { discoverNodeSignals, nodeScriptIds } from '../src/engine/runtime/scene/node-scripts.js'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const src=read('src/components/SignalConnectionsPanel.vue')
const setup=src.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
const template=src.slice(src.indexOf('<template>')+10, src.lastIndexOf('</template>'))
assert.ok(setup && template)
registerNode({type:'s04uxqa',label:'QA UX',create:()=>({}),build:()=>({}),update:()=>{},nativeSignals:[{name:'body_entered',source:'jolt-area',phase:'physics',condition:'Área activa',args:[{name:'event',type:'Area3DEvent'}]}]})
function fixture() {
 const obj=(id,parentId=null,scriptIds=[])=>({id,name:id,type:'s04uxqa',parentId,scriptIds})
 const root=obj('root',null,['a']),child=obj('child','root'),grand=obj('grand','child'),other=obj('other'),cyc1=obj('cycle1','cycle2'),cyc2=obj('cycle2','cycle1')
 const project={objects:[grand,root,cyc1,child,other,cyc2],activeSceneId:'scene',scripts:[{id:'a',execution:'node',code:"node.define_signal('puerta_abierta')"}],signalConnections:[{id:'c1',emitterId:'root',signal:'ready',receiverId:'grand',method:'recibir'}]}
 const store={project,selectedId:'root',selectedIds:['root'],sceneSel:null,projSel:null,audioInspector:null,locked:false,play:{on:false},edit:{on:false},paint:{on:false},editor:null}
 const operations=[]
 const refs=value=>({value})
 const context={store,Set,Map,console,
  computed:fn=>({get value(){return fn()}}),ref:refs,watch:()=>{},nextTick:cb=>cb?Promise.resolve().then(cb):Promise.resolve(),
  discoverNodeSignals,nodeScriptIds,getNativeSignals,toast:(...args)=>operations.push(['toast',...args]),
  addSceneSignalConnection:data=>operations.push(['add',data]),editSceneSignalConnection:(id,data)=>operations.push(['edit',id,data]),removeSceneSignalConnection:id=>operations.push(['remove',id]),
  document:{activeElement:null},
 }
 const js=setup.replace(/^import[^\n]*\n/gm,'')+'\n;({groups,receiverRows,receiverScope,receiverSearch,foldedGroups,foldedSignals,toggleGroup,toggleSignal,signature,openNew,openEdit,form,dialogSignal,save,remove,dialog,closeDialog,receiverKeydown,selectReceiver,linkStatus,customLabel,signalInfo,search,editable})'
 return {ui:vm.runInNewContext(js,context),store,operations,objects:{root,child,grand,other,cyc1,cyc2}}
}
test('UX-01: árbol reemplaza tarjetas, mantiene componente original y roles accesibles',()=>{
 for(const p of ['role="tree"','role="treeitem"','role="group"','sig-tree-category','sig-signal-row','sig-link-target']) assert.ok(template.includes(p),p)
 assert.doesNotMatch(template,/class="sig-section"|class="sig-group"/)
 assert.match(read('src/components/InspectorDock.vue'),/SignalConnectionsPanel v-if="tab === 'signals'"/)
})
test('UX-02: fuente real, Nodo separado de Jolt y Animation',()=>{
 const {ui}=fixture();const groups=ui.groups.value
 assert.equal(groups.find(g=>g.key==='node').signals.map(s=>s.name).includes('ready'),true)
 assert.equal(groups.find(g=>g.key==='area3d').signals[0].name,'body_entered')
 assert.equal(groups.find(g=>g.key==='animation').signals[0].name,'animation_finished')
 assert.equal(groups.find(g=>g.key==='custom').signals[0].name,'puerta_abierta')
})
test('UX-03: firma nativa procede de metadata, no de texto ficticio',()=>{
 const {ui}=fixture();assert.equal(ui.signature(getNativeSignals('s04uxqa').find(s=>s.name==='body_entered')),'body_entered(event: Area3DEvent)')
 assert.equal(ui.signature(getNativeSignals('s04uxqa').find(s=>s.name==='animation_finished')),'animation_finished(clipName: string)')
 assert.equal(ui.signature(null),'')
})
test('UX-04: señales Custom sin conexiones no se ocultan ni inventan firma',()=>{
 const {ui}=fixture();assert.equal(ui.groups.value.some(g=>g.key==='custom'&&g.signals.some(s=>s.name==='puerta_abierta'&&s.meta===null)),true)
 assert.equal(ui.customLabel('puerta_abierta'),'Detectada en código · pendiente de validar en Play')
})
test('UX-05: búsqueda, plegado de grupos y señales sin estado duplicado',()=>{
 const {ui}=fixture();ui.search.value='body';assert.equal(ui.groups.value.length,1)
 assert.equal(ui.groups.value[0].signals[0].name,'body_entered');ui.search.value=''
 ui.toggleGroup('node');assert.equal(ui.foldedGroups.value.has('node'),true)
 ui.toggleGroup('node');assert.equal(ui.foldedGroups.value.has('node'),false)
 ui.toggleSignal('ready');assert.equal(ui.foldedSignals.value.has('ready'),true)
})
test('UX-06: abrir y cerrar desde señal concreta preserva selección',()=>{
 const {ui}=fixture();ui.openNew('ready');assert.equal(ui.dialog.value,true);assert.equal(ui.dialogSignal.value,'ready')
 ui.closeDialog();assert.equal(ui.dialog.value,false)
})
test('UX-07: árbol receptor conserva padre-hijo y evita ciclos',()=>{
 const {ui}=fixture();const r=ui.receiverRows.value
 assert.equal(r.length,3);assert.ok(r.findIndex(x=>x.id==='root')<r.findIndex(x=>x.id==='child'))
 assert.equal(r.find(x=>x.id==='grand').depth,2)
 ui.receiverScope.value='scene';assert.equal(ui.receiverRows.value.length,6)
 assert.equal(ui.receiverRows.value.filter(x=>x.id==='cycle1').length,1)
})
test('UX-08: filtro de receptor conserva ancestros relevantes',()=>{
 const {ui}=fixture();ui.receiverSearch.value='grand'
 assert.equal(ui.receiverRows.value.map(x=>x.id).join(','),'root,child,grand')
})
test('UX-09: conexión usa acciones existentes, nunca escribe señalConnections directamente',()=>{
 const {ui,operations}=fixture();ui.openNew('tree_entered');ui.form.value={receiverId:'grand',method:'recibir'}
 ui.save();assert.equal(operations[0][0],'add');assert.equal(operations[0][1].receiverId,'grand')
 assert.deepEqual(Object.keys(operations[0][1]),['emitterId','signal','receiverId','method'])
})
test('UX-10: editar y desconectar conservan API de historial',()=>{
 const {ui,operations,store}=fixture();const c=store.project.signalConnections[0]
 ui.openEdit(c);ui.form.value.method='nuevo';ui.save();assert.equal(operations[0][0],'edit');assert.equal(operations[0][1],c.id)
 ui.remove(c);assert.equal(operations[1][0],'remove');assert.equal(operations[1][1],c.id)
})
test('UX-11: teclado Enter y flechas, foco del modal, Escape y árbol jerárquico previstos',()=>{
 for(const text of ['@dblclick.stop="openNew(signal.name)"','@keydown.enter.prevent="openNew(signal.name)"','@keydown="onTreeKeydown"','@keydown="receiverKeydown($event,i)"','@keydown.esc="closeDialog"','onDialogKeydown','aria-modal="true"','aria-selected=']) assert.ok(src.includes(text),text)
})
test('UX-12: opciones avanzadas no implementadas siguen ausentes y el método manual se conserva',()=>{
 assert.doesNotMatch(template,/Deferred|One Shot|Unbind|Generar script/)
 assert.match(template,/Escribir método manualmente/)
})
test('UX-13: los diagnósticos estáticos S03 permanecen visibles',()=>{
 for(const k of ['customDiagnostics','nombre nativo reservado','declaración no confirmada','Diagnósticos de scripts','Detectada en código · pendiente de validar en Play']) assert.ok(src.includes(k),k)
})
test('UX-14: solo metadata, no se ejecuta código JS de scripts de usuario',()=>{
 assert.doesNotMatch(setup,/new Function\(|\beval\(|\.runScript\(/)
 const {ui}=fixture();assert.ok(ui.signalInfo.value.has('puerta_abierta'))
})
test('UX-15: nativa seleccionada muestra método destino sin inventarlo',()=>{
 for(const k of ['Método del receptor','node.expose()','no se validan hasta Play']) assert.ok(template.includes(k))
})
test('UX-16: bloqueo real de edición durante Play/edición',()=>{
 const {ui,store}=fixture();store.play.on=true;assert.equal(ui.editable.value,false)
 ui.openNew('ready');assert.equal(ui.dialog.value,false)
})
test('UX-17: receptor faltante no se guarda y no borra autoría',()=>{
 const {ui,operations}=fixture();ui.openNew('ready');ui.form.value={receiverId:'missing',method:'recibir'};ui.save()
 assert.equal(operations.length,1);assert.equal(operations[0][0],'toast')
})
test('UX-18: conexión existente mantiene estado guardado en Edit Mode',()=>{
 const {ui,store}=fixture();assert.equal(ui.linkStatus(store.project.signalConnections[0]).label,'Registrada')
})
