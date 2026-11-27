import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import {registerNode,getNativeSignals} from '../src/engine/runtime/nodes/registry.js'
import {discoverNodeSignals,discoverNodeMethods,nodeScriptIds} from '../src/engine/runtime/scene/node-scripts.js'

registerNode({type:'s05method',label:'QA métodos',create:()=>({}),build:()=>({}),update:()=>{}})
const script = (id,code,execution='node') => ({id,code,execution})
const node = (ids,extra={}) => ({id:'r',type:'s05method',scriptIds:ids,...extra})
const get = (code) => discoverNodeMethods(node(['a']),[script('a',code)])
const names = r => r.methods.map(m=>m.name)
const component=readFileSync(new URL('../src/components/SignalConnectionsPanel.vue',import.meta.url),'utf8')
const setup=component.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
const html=component.slice(component.indexOf('<template>'),component.lastIndexOf('</template>'))
function fixture(){
  const objects=[{id:'e',type:'s05method',name:'Emisor',scriptIds:[]},{id:'r',type:'s05method',name:'Receptor',parentId:'e',scriptIds:['a','b']},{id:'other',type:'s05method',name:'Otro',scriptIds:['c']}]
  const scripts=[script('a',"node.expose('abrir',()=>{}); node.expose('cerrar', cerrar)"),script('b',"node.expose('revisar', fn)") ,script('c',"node.expose('externo', fn)")]
  const project={objects,scripts,signalConnections:[{id:'saved',emitterId:'e',receiverId:'r',signal:'ready',method:'metodo_dinamico'}],activeSceneId:'scene'}
  const store={project,selectedId:'e',selectedIds:['e'],sceneSel:null,projSel:null,audioInspector:null,locked:false,play:{on:false},edit:{on:false},paint:{on:false},editor:null}
  const calls=[]
  const context={store,Map,Set,console,computed:f=>({get value(){return f()}}),ref:v=>({value:v}),watch:()=>{},nextTick:cb=>cb?Promise.resolve().then(cb):Promise.resolve(),getNativeSignals,discoverNodeSignals,discoverNodeMethods,nodeScriptIds,toast:(...a)=>calls.push(['toast',...a]),addSceneSignalConnection:data=>calls.push(['add',data]),editSceneSignalConnection:(id,data)=>calls.push(['edit',id,data]),removeSceneSignalConnection:id=>calls.push(['remove',id]),document:{activeElement:null}}
  const source=setup.replace(/^import[^\n]*\n/gm,'')+'\n;({openNew,openEdit,closeDialog,selectReceiver,chooseMethod,chooseManualMethod,receiverMethods,validReceiverMethods,currentReceiver,manualMethod,form,save})'
  return {ui:vm.runInNewContext(source,context),store,calls}
}
test('METHOD-01: detecta exposición literal en script adjunto',()=>assert.deepEqual(names(get("node.expose('abrir', ()=>{})")),['abrir']))
test('METHOD-02: soporta nombre literal doble y callback de referencia',()=>assert.deepEqual(names(get('node.expose("cerrar", cerrarPuerta)')),['cerrar']))
test('METHOD-03: ignora comentarios y cadenas',()=>assert.deepEqual(names(get(`// node.expose('mentira',()=>{})\n/* node.expose('oculta',x) */\nconst s="node.expose('texto',x)";`)),[]))
test('METHOD-04: ignora templates y regex no ejecutables',()=>assert.deepEqual(names(get("const t=`node.expose('falso',a)`;const re=/node.expose\\('otro',x\\)/;")),[]))
test('METHOD-05: expresión dinámica no se promueve a método confirmado',()=>{const r=get('node.expose(prefix+suffix, cb)');assert.deepEqual(names(r),[]);assert.equal(r.diagnostics[0].kind,'dynamic')})
test('METHOD-06: referencia opcional o propiedad ajena no se promueve',()=>assert.deepEqual(names(get("other.node.expose('otro',fn); node?.expose('opcional',fn)")),[]))
test('METHOD-07: requiere callback no evidentemente vacío',()=>{const r=get("node.expose('sin_callback'); node.expose('sin_fn', null)");assert.deepEqual(names(r),[]);assert.equal(r.diagnostics.length,2)})
test('METHOD-08: método duplicado entre varios scripts no es seleccionable',()=>{const r=discoverNodeMethods(node(['a','b']),[script('a',"node.expose('m',f)"),script('b',"node.expose('m',f)")]);assert.equal(r.methods[0].duplicate,true);assert.equal(r.methods[0].owners.join(','),'a,b')})
test('METHOD-09: duplicado en el mismo script también genera conflicto',()=>{const r=get("node.expose('m',fn);node.expose('m',gn)");assert.equal(r.methods[0].duplicate,true)})
test('METHOD-10: callbacks lifecycle reservados se muestran como inválidos',()=>{const r=get("node.expose('_ready',cb)");assert.equal(r.methods[0].reserved,true)})
test('METHOD-11: script faltante y ejecución global producen diagnósticos',()=>{const r=discoverNodeMethods(node(['missing','a']),[script('a','node.expose(\'invalida\',fn)','global')]);assert.equal(r.diagnostics.filter(d=>d.kind==='missing').length,2)})
test('METHOD-12: multiescript y compatibilidad scriptId anterior',()=>{const obj={id:'old',type:'s05method',scriptId:'legacy'};assert.deepEqual(names(discoverNodeMethods(obj,[script('legacy',"node.expose('antiguo',cb)")])),['antiguo'])})
test('METHOD-13: asociación repetida no se analiza dos veces',()=>{const r=discoverNodeMethods(node(['a','a']),[script('a',"node.expose('m',cb)")]);assert.equal(r.methods[0].duplicate,false);assert.equal(r.diagnostics[0].kind,'association')})
test('METHOD-14: modificación del código se refleja sin cache obsoleta',()=>{const sc=script('a',"node.expose('uno',x)");const obj=node(['a']);assert.deepEqual(names(discoverNodeMethods(obj,[sc])),['uno']);sc.code="node.expose('dos',x)";assert.deepEqual(names(discoverNodeMethods(obj,[sc])),['dos'])})
test('METHOD-15: no ejecuta scripts ni altera autoría',()=>{const sc=script('a',"throw Error('NO EJECUTAR'); node.expose('inocuo',x)");const obj=node(['a']);const before=JSON.stringify({sc,obj});assert.deepEqual(names(discoverNodeMethods(obj,[sc])),['inocuo']);assert.equal(JSON.stringify({sc,obj}),before)})
test('METHOD-16: receptor seleccionado aporta catálogo propio, no del emisor',()=>{const {ui}=fixture();ui.openNew('ready');assert.equal(ui.receiverMethods.value.methods.length,0);ui.selectReceiver('r');assert.equal(ui.currentReceiver.value.id,'r');assert.equal(ui.validReceiverMethods.value.map(m=>m.name).join(','),'abrir,cerrar,revisar')})
test('METHOD-17: elegir método rellena campo persistente sin cambiar esquema',()=>{const {ui,calls}=fixture();ui.openNew('ready');ui.selectReceiver('r');ui.chooseMethod('cerrar');assert.equal(ui.form.value.method,'cerrar');ui.save();assert.equal(calls[0][0],'add');assert.equal(calls[0][1].method,'cerrar');assert.deepEqual(Object.keys(calls[0][1]),['emitterId','signal','receiverId','method'])})
test('METHOD-18: método no detectable puede escribirse manualmente',()=>{const {ui,calls}=fixture();ui.openNew('ready');ui.selectReceiver('r');ui.chooseManualMethod();ui.form.value.method='emitido_dinamicamente';ui.save();assert.equal(calls[0][1].method,'emitido_dinamicamente')})
test('METHOD-19: edición histórica preserva método no detectable',()=>{const {ui,store,calls}=fixture();ui.openEdit(store.project.signalConnections[0]);assert.equal(ui.manualMethod.value,true);assert.equal(ui.form.value.method,'metodo_dinamico');ui.save();assert.equal(calls[0][0],'edit');assert.equal(calls[0][2].method,'metodo_dinamico')})
test('METHOD-20: cambiar receptor en conexión nueva borra elección anterior',()=>{const {ui}=fixture();ui.openNew('ready');ui.selectReceiver('r');ui.chooseMethod('abrir');ui.selectReceiver('other');assert.equal(ui.form.value.method,'');assert.equal(ui.validReceiverMethods.value[0].name,'externo')})
test('METHOD-21: no permite seleccionar método en conflicto o reservado',()=>{const {ui,store}=fixture();store.project.scripts[0].code="node.expose('x',fn);node.expose('_ready',fn)";store.project.scripts[1].code="node.expose('x',fn)";ui.openNew('ready');ui.selectReceiver('r');assert.equal(ui.validReceiverMethods.value.length,0);ui.chooseMethod('x');assert.equal(ui.form.value.method,'');ui.chooseMethod('_ready');assert.equal(ui.form.value.method,'')})
test('METHOD-22: el picker usa el mismo analizador, datos y operaciones existentes',()=>{assert.match(setup,/discoverNodeMethods\(currentReceiver\.value, store\.project\?\.scripts/);assert.match(setup,/addSceneSignalConnection\(data\)/);assert.match(setup,/editSceneSignalConnection\(original\.id, data\)/);assert.doesNotMatch(setup,/new Function\(|\beval\(|new EventBus\(/)})
test('METHOD-23: presentación accesible y entrada manual conservada',()=>{for(const fragment of ['aria-label="Métodos públicos detectados del receptor"','@click="chooseMethod(method.name)"','@click="chooseManualMethod"','id="lf-sig-method"','Métodos públicos','Conflicto'])assert.ok(html.includes(fragment),fragment)})
test('METHOD-24: la detección no se considera actividad en Play y la entrada manual se conserva',()=>{assert.match(html,/no se validan hasta Play/i);assert.match(html,/Detectado en código/);assert.match(html,/Escribir método manualmente/);assert.doesNotMatch(setup,/writeFileSync|new EventBus/)})
test('METHOD-25: contacto estático no altera la API runtime de expose',()=>{const runtime=readFileSync(new URL('../src/engine/runtime/scene/node-scripts.js',import.meta.url),'utf8');assert.match(runtime,/Object\.defineProperty\(node, 'expose'/);assert.match(runtime,/entry\.methods\.set\(name, fn\)/);assert.match(runtime,/entry\.conflictedMethods\.add\(name\)/)})
