// S04-G001_CORR-001: una conexión nueva solo nace de una señal del nodo emisor.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { registerNode,getNativeSignals } from '../src/engine/runtime/nodes/registry.js'
import { discoverNodeSignals,nodeScriptIds } from '../src/engine/runtime/scene/node-scripts.js'
registerNode({type:'area3d',label:'Area3D',create:()=>({}),build:()=>({}),update:()=>{},nativeSignals:[{name:'body_entered',source:'jolt-area',phase:'physics',condition:'Jolt',args:[{name:'event',type:'Area3DEvent'}]}]})
registerNode({type:'collisionshape3d',label:'CollisionShape3D',create:()=>({}),build:()=>({}),update:()=>{}})
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
const component=read('src/components/SignalConnectionsPanel.vue')
const source=component.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
const html=component.slice(component.indexOf('<template>'),component.lastIndexOf('</template>'))
function fixture() {
 const objects=[{id:'area',name:'Sensor',type:'area3d',scriptIds:['custom']},{id:'shape',name:'Colisión',type:'collisionshape3d'},{id:'receiver',name:'Destino',type:'node3d',parentId:'area'}]
 const saved=[{id:'old',emitterId:'area',receiverId:'receiver',signal:'señal_renombrada',method:'antiguo'}]
 const project={activeSceneId:'scene1',objects,signalConnections:saved,scripts:[{id:'custom',execution:'node',code:"node.define_signal('aviso')"}]}
 const store={project,selectedId:'area',selectedIds:['area'],projSel:null,sceneSel:null,audioInspector:null,locked:false,play:{on:false},edit:{on:false},paint:{on:false},editor:null}
 const calls=[]
 const context={store,Set,Map,computed:f=>({get value(){return f()}}),ref:v=>({value:v}),watch:()=>{},nextTick:cb=>cb?Promise.resolve().then(cb):Promise.resolve(),getNativeSignals,discoverNodeSignals,nodeScriptIds,
 toast:(...args)=>calls.push(['error',...args]),addSceneSignalConnection:data=>calls.push(['add',data]),editSceneSignalConnection:(id,data)=>calls.push(['edit',id,data]),removeSceneSignalConnection:id=>calls.push(['delete',id]),document:{activeElement:null}}
 const names=['selected','groups','dialog','dialogSignal','form','openNew','openEdit','closeDialog','save','remove','editable','nativeSignals','customSignals','connectableSignals','canConnectSignal','currentLink','search','outgoing']
 const expression=source.replace(/^import[^\n]*\n/gm,'')+`\n;({${names.join(',')}})`
 const ui=vm.runInNewContext(expression,context)
 return {ui,calls,store,saved,objects}
}
test('CORR-01: el panel no ofrece inicio genérico ni permite escribir origen libre',()=>{
 assert.doesNotMatch(html,/class="sig-new"|@click="openNew\(\)"|<input[^>]+id="lf-sig-name"|<datalist/)
 assert.match(html,/<div id="lf-sig-name" class="sig-fixed-source"/)
 assert.match(html,/v-if="editable && canConnectSignal\(signal.name\)"/)
})
test('CORR-02: cada señal nativa del nodo seleccionado permite conexión',()=>{
 const {ui}=fixture();const names=ui.nativeSignals.value
 assert.ok(names.includes('body_entered')&&names.includes('ready'))
 for(const n of names)assert.equal(ui.canConnectSignal(n),true,n)
 ui.openNew('body_entered');assert.equal(ui.dialog.value,true);assert.equal(ui.dialogSignal.value,'body_entered')
})
test('CORR-03: el catálogo cambia por el tipo seleccionado, no es global',()=>{
 const {ui,store}=fixture();assert.equal(ui.canConnectSignal('body_entered'),true)
 store.selectedId='shape';store.selectedIds=['shape']
 assert.equal(ui.canConnectSignal('body_entered'),false)
 assert.equal(ui.canConnectSignal('ready'),true)
 ui.closeDialog();ui.openNew('body_entered');assert.equal(ui.dialog.value,false)
})
test('CORR-04: abrir sin nombre o con nombre inventado no crea diálogo',()=>{
 const {ui}=fixture()
 ui.openNew();assert.equal(ui.dialog.value,false)
 ui.openNew('codigo_no_registrado');assert.equal(ui.dialog.value,false)
 ui.openNew('señal_renombrada');assert.equal(ui.dialog.value,false)
})
test('CORR-05: Custom Signal literal del emisor se puede conectar aun sin conexiones',()=>{
 const {ui}=fixture();assert.equal(ui.canConnectSignal('aviso'),true)
 ui.openNew('aviso');assert.equal(ui.dialogSignal.value,'aviso')
})
test('CORR-06: una señal guardada sin declaración permanece en árbol pero no permite nuevas conexiones',()=>{
 const {ui}=fixture();assert.ok(ui.customSignals.value.includes('señal_renombrada'))
 assert.equal(ui.canConnectSignal('señal_renombrada'),false)
 ui.openNew('señal_renombrada');assert.equal(ui.dialog.value,false)
})
test('CORR-07: al editar conexión histórica el origen está fijado y se preserva',()=>{
 const {ui,calls,saved}=fixture();ui.openEdit(saved[0])
 assert.equal(ui.dialogSignal.value,'señal_renombrada');ui.form.value.method='actualizado';ui.save()
 assert.equal(calls[0][0],'edit');assert.equal(calls[0][1],'old')
 assert.equal(calls[0][2].signal,'señal_renombrada')
 assert.equal(calls[0][2].method,'actualizado')
})
test('CORR-08: una conexión histórica conserva el emisor pero permite cambiar receptor',()=>{
 const {ui,calls,saved}=fixture();ui.openEdit(saved[0]);ui.form.value.receiverId='shape';ui.save()
 assert.equal(calls[0][2].receiverId,'shape');assert.equal(calls[0][2].emitterId,'area')
})
test('CORR-09: la mutación programática del campo no puede inyectar un nombre de señal',()=>{
 const {ui,calls}=fixture();ui.openNew('ready');ui.form.value.signal='evento_inventado';ui.form.value.receiverId='receiver';ui.form.value.method='recibir';ui.save()
 assert.equal(calls[0][1].signal,'ready')
})
test('CORR-10: la nueva conexión persiste únicamente los cuatro campos anteriores',()=>{
 const {ui,calls}=fixture();ui.openNew('body_entered');ui.form.value.receiverId='receiver';ui.form.value.method='escuchar';ui.save()
 assert.equal(calls[0][0],'add');assert.deepEqual(Object.keys(calls[0][1]),['emitterId','signal','receiverId','method'])
})
test('CORR-11: eliminar/renombrar declaración durante diálogo bloquea una nueva conexión',()=>{
 const {ui,store,calls}=fixture();ui.openNew('aviso');store.project.scripts[0].code="node.define_signal('otra')"
 ui.form.value.receiverId='receiver';ui.form.value.method='escuchar';ui.save()
 assert.equal(calls[0][0],'error');assert.equal(calls.some(c=>c[0]==='add'),false)
})
test('CORR-12: cambiar nodo mientras el diálogo está abierto bloquea guardar',()=>{
 const {ui,store,calls}=fixture();ui.openNew('ready');store.selectedId='shape';store.selectedIds=['shape'];ui.form.value.receiverId='receiver';ui.form.value.method='escuchar';ui.save()
 assert.equal(calls[0][0],'error')
})
test('CORR-13: la conexión editada debe seguir existiendo con el mismo origen',()=>{
 const {ui,store,calls,saved}=fixture();ui.openEdit(saved[0]);store.project.signalConnections=[];ui.form.value.method='nuevo';ui.save()
 assert.equal(calls[0][0],'error');assert.equal(calls.some(c=>c[0]==='edit'),false)
})
test('CORR-14: conflicto nativo o duplicado entre scripts bloquea nuevas conexiones sin borrar historial',()=>{
 const {ui,store}=fixture();store.project.scripts=[{id:'custom',execution:'node',code:"node.define_signal('duplicada');node.define_signal('ready')"},{id:'dos',execution:'node',code:"node.define_signal('duplicada')"}];store.project.objects[0].scriptIds=['custom','dos']
 assert.equal(ui.canConnectSignal('duplicada'),false)
 assert.equal(ui.canConnectSignal('ready'),true) // Es nativa, no se pierde por colisión de script.
 ui.openNew('duplicada');assert.equal(ui.dialog.value,false)
})
test('CORR-15: estado Play no permite crear ni editar conexiones',()=>{
 const {ui,store,saved}=fixture();store.play.on=true;ui.openNew('ready');ui.openEdit(saved[0]);assert.equal(ui.dialog.value,false)
})
test('CORR-16: teclado y doble clic conectan únicamente la fila señal seleccionada',()=>{
 assert.match(html,/@dblclick.stop="openNew\(signal.name\)"/)
 assert.match(html,/@keydown.enter.prevent="openNew\(signal.name\)"/)
 assert.match(html,/@click="openNew\(signal.name\)"/)
 assert.doesNotMatch(html,/onclick="openNew\(\)"/)
})
test('CORR-17: señales antiguas no se borran al corregir el UI',()=>{
 const {ui,saved,calls}=fixture();assert.equal(ui.outgoing.value.length,1)
 ui.remove(saved[0]);assert.deepEqual(calls[0],['delete','old'])
})
test('CORR-18: arquitectura sin scripts ejecutados en Edit Mode ni nuevos gestores',()=>{
 assert.doesNotMatch(source,/new Function\(|\beval\(|\.runScript\(|new EventBus\(/)
 assert.match(source,/discoverNodeSignals\(selected.value, store.project\?\.scripts \|\| \[\]\)/)
 assert.match(source,/getNativeSignals\(selected.value\?\.type\)/)
})

// Regresión del compilador Vue real: una comprobación textual no detectó el
// v-else huérfano de CORR-001. Usar la dependencia incluida por Vue/Vite.
test('CORR-19: la plantilla SFC compila con el compilador Vue real', async (t) => {
 let compiler
 try { compiler = await import('@vue/compiler-sfc') }
 catch (error) {
   if (error.code === 'ERR_MODULE_NOT_FOUND') {
     t.skip('Compilador Vue no instalado en este entorno; ejecutar npm ci y repetir')
     return
   }
   throw error
 }
 const { descriptor, errors: parseErrors } = compiler.parse(component, { filename:'SignalConnectionsPanel.vue' })
 assert.deepEqual(parseErrors, [], parseErrors.map(e=>e.message).join('\n'))
 assert.ok(descriptor.template, 'Plantilla Vue ausente')
 const result = compiler.compileTemplate({
   source:descriptor.template.content,
   filename:'SignalConnectionsPanel.vue',
   id:'lf-node-signals-s04-g001-corr002',
 })
 assert.deepEqual(result.errors, [], result.errors.map(e=>e.message).join('\n'))
 assert.match(result.code, /render|_ctx/)
})

test('CORR-20: la fixture comprueba el origen solo con el diálogo abierto',()=>{
 const fixture=read('scripts/fixtures/nodes/node-signals-godot-ux-s04-g001-corr001.html')
 const close=fixture.indexOf("check('Sin selección'")
 const reopen=fixture.indexOf("check('Más abre diálogo con señal fija'")
 const inspect=fixture.indexOf("check('Origen fijo es un div no editable'")
 assert.ok(close>0 && reopen>close && inspect>reopen, 'La comprobación del origen debe ocurrir tras reabrir el diálogo')
 assert.match(fixture.slice(reopen,inspect), /sig-name/)
})
