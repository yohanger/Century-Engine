import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { buildNodeCallbackCode, discoverNodeMethods, discoverNodeSignals, nodeScriptIds } from '../src/engine/runtime/scene/node-scripts.js'
import { getNativeSignal, registerNode } from '../src/engine/runtime/nodes/registry.js'

registerNode({type:'cb-test',label:'Callback QA',create:()=>({}),build:()=>({}),update:()=>{}})
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const historySource=file('src/core/state/history.js').replace(/^import[^\n]*\n/gm,'').replace(/\bexport /g,'')
const projectSource=file('src/core/state/project.js')
const txSource=projectSource.slice(projectSource.indexOf('/** No hay CAS'),projectSource.indexOf('//  PROYECTO · ESCENAS · GUARDADO')).replace(/\bexport /g,'')
const sample=()=>{
 const original="function _ready() {}\n"
 const store={project:{id:'p',scripts:[{id:'sc1',execution:'node',name:'puerta.js',folder:'Assets/Scripts',code:original}],objects:[{id:'a',name:'Emisor',type:'cb-test'},{id:'b',name:'Receptor',type:'cb-test',scriptIds:['sc1'],parentId:'a'}],signalConnections:[],terrain:{enabled:false,layers:[],foliage:[]},scenes:[],materials:[],profiles:[],gameManagers:[],timelines:[],captures:[],assets:[],models:[],render:{},audio:{},environment:{}},selectedId:'a',selectedIds:['a'],scriptEditId:null,modal:null,locked:false,play:{on:false},edit:{on:false},paint:{on:false},disk:{state:'saved'},pendingRevision:0,saveState:'saved',editor:{snapshotTerrain(){return {enabled:false,layers:[],foliage:[]}},syncAll(){},syncEnvironment(){},setSelection(){},restoreEdit(){},afterUndo(){},setCaptureClips(){},applyView(){}}}
 let seq=0
 const validateSignalConnections=links=>{const keys=new Set();for(const c of links){assert.ok(c.id&&c.emitterId&&c.signal&&c.receiverId&&c.method);const key=[c.emitterId,c.signal,c.receiverId,c.method].join(':');assert.ok(!keys.has(key));keys.add(key)};return links}
 const ctx={store,console,Map,Set,JSON,Object,String,Error,Array,Math,uid:()=>`sig-${++seq}`,getNativeSignal,discoverNodeMethods,discoverNodeSignals,nodeScriptIds,buildNodeCallbackCode,validateSignalConnections,toRaw:v=>v,debounce:()=>()=>{},projLoc:null,vsc:null}
 vm.createContext(ctx)
 const h=vm.runInContext(historySource+'\n;({resetHistory,commit,undo,redo,configureHistory})',ctx)
 ctx.commit=h.commit
 const tx=vm.runInContext(txSource+'\n;({callbackGenerationBlockReason,createSceneSignalCallback})',ctx)
 h.configureHistory({canEditGeneratedScript:tx.callbackGenerationBlockReason,hasDisk:()=>false})
 h.resetHistory()
 return {store,h,tx,original,ctx}
}
test('CB-01: publica callback válido al entrar el recurso en Play',()=>{
 const code=buildNodeCallbackCode('function _ready() {}', 'on_ready',[])
 const names=[];new Function('game','node',`"use strict";\n${code}`)({}, {expose(name,fn){names.push(name);assert.equal(typeof fn,'function');fn()}})
 assert.deepEqual(names,['on_ready'])
})
test('CB-02: preserva cuerpo del script y saltos CRLF',()=>{const input='function _process(delta) {\r\n}\r\n';const out=buildNodeCallbackCode(input,'on_signal',['event']);assert.ok(out.endsWith(input));assert.ok(out.includes('event) {\r\n'));assert.match(out,/node\.expose\("on_signal"/)} )
test('CB-03: no elimina directiva estricta inicial',()=>{const input='"use strict";\nfunction _ready() {}';const out=buildNodeCallbackCode(input,'on_ready');assert.ok(out.startsWith('"use strict";\nnode.expose('))})
test('CB-04: rechaza código inválido y firmas incompatibles',()=>{assert.throws(()=>buildNodeCallbackCode('function (','on_signal'),/sintaxis/);assert.throws(()=>buildNodeCallbackCode('','no válido'),/inválido/);assert.throws(()=>buildNodeCallbackCode('','ok',['arg','arg']),/Firma/)})
test('CB-05: conexión y código se confirman con un único commit reversible',()=>{const {store,h,tx,original}=sample();const result=tx.createSceneSignalCallback({emitterId:'a',signal:'ready',receiverId:'b',scriptId:'sc1',method:'on_ready',expectedCode:original});assert.equal(store.project.signalConnections[0].id,result.id);assert.match(store.project.scripts[0].code,/node\.expose/);assert.equal(store.canUndo,true);h.undo();assert.equal(store.project.scripts[0].code,original);assert.equal(store.project.signalConnections.length,0);h.redo();assert.equal(store.project.signalConnections.length,1);assert.match(store.project.scripts[0].code,/node\.expose/)})
test('CB-06: edición posterior bloquea Undo sin mover estado',()=>{const {store,h,tx,original}=sample();tx.createSceneSignalCallback({emitterId:'a',signal:'ready',receiverId:'b',scriptId:'sc1',method:'on_ready',expectedCode:original});store.project.scripts[0].code += '\n// Cambio local';assert.throws(()=>h.undo(),/Conflicto/);assert.equal(store.project.signalConnections.length,1);assert.equal(store.canUndo,true);assert.match(store.project.scripts[0].code,/Cambio local/)})
test('CB-07: conflicto antes de confirmación no crea conexión ni código',()=>{const {store,tx,original}=sample();assert.throws(()=>tx.createSceneSignalCallback({emitterId:'a',signal:'ready',receiverId:'b',scriptId:'sc1',method:'on_ready',expectedCode:original+' ' }),/cambió/);assert.equal(store.project.signalConnections.length,0);assert.equal(store.project.scripts[0].code,original)})
test('CB-08: método existente impide duplicación',()=>{const {store,tx}=sample();store.project.scripts[0].code="node.expose('on_ready', ()=>{});";assert.throws(()=>tx.createSceneSignalCallback({emitterId:'a',signal:'ready',receiverId:'b',scriptId:'sc1',method:'on_ready',expectedCode:store.project.scripts[0].code}),/Métodos ambiguos/);assert.equal(store.project.signalConnections.length,0)})
test('CB-09: Scripts de Nodo no asociados se rechazan',()=>{const {store,tx,original}=sample();store.project.objects[1].scriptIds=[];assert.throws(()=>tx.createSceneSignalCallback({emitterId:'a',signal:'ready',receiverId:'b',scriptId:'sc1',method:'on_ready',expectedCode:original}),/asociación/);assert.equal(store.project.scripts[0].code,original)})
test('CB-10: estado de sincronización VS Code bloquea',()=>{const {store,ctx,tx,original}=sample();vm.runInContext('projLoc = {kind:"path"}',ctx);assert.match(tx.callbackGenerationBlockReason('sc1'),/Sincronización/);assert.throws(()=>tx.createSceneSignalCallback({emitterId:'a',signal:'ready',receiverId:'b',scriptId:'sc1',method:'on_ready',expectedCode:original}),/Sincronización/);assert.equal(store.project.signalConnections.length,0)})
test('CB-11: editor abierto bloquea sin perder buffer',()=>{const {store,tx}=sample();store.modal='script';store.scriptEditId='sc1';assert.match(tx.callbackGenerationBlockReason('sc1'),/Cierra el editor/)})
test('CB-12: emisión de Custom Signal sin firma no inventa argumentos',()=>{const {store,tx,original}=sample();store.project.objects[0].scriptIds=['sc2'];store.project.scripts.push({id:'sc2',execution:'node',code:"node.define_signal('puerta_abierta')"});tx.createSceneSignalCallback({emitterId:'a',signal:'puerta_abierta',receiverId:'b',scriptId:'sc1',method:'on_abierta',expectedCode:original});assert.match(store.project.scripts[0].code,/function \(\)/)})
test('CB-13: tras Undo código divergente impide Redo',()=>{const {store,h,tx,original}=sample();tx.createSceneSignalCallback({emitterId:'a',signal:'ready',receiverId:'b',scriptId:'sc1',method:'on_ready',expectedCode:original});h.undo();store.project.scripts[0].code='// cambiado';assert.throws(()=>h.redo(),/Conflicto/);assert.equal(store.project.signalConnections.length,0)})
test('CB-14: modificación de script de otro nodo no se restaura',()=>{const {store,h,tx,original}=sample();store.project.scripts.push({id:'independiente',execution:'node',code:'x'});tx.createSceneSignalCallback({emitterId:'a',signal:'ready',receiverId:'b',scriptId:'sc1',method:'on_ready',expectedCode:original});store.project.scripts[1].code='y';h.undo();assert.equal(store.project.scripts[1].code,'y')})
test('CB-15: no incorpora gestores ni nuevo esquema de conexiones',()=>{assert.doesNotMatch(txSource,/new EventBus|new Manager|globalThis/);assert.match(txSource,/validateSignalConnections\(nextLinks\)/);assert.match(historySource,/scriptDelta/);assert.doesNotMatch(historySource,/JSON\.stringify\(toRaw\(p\.scripts/)})
test('CB-16: UI con selección explícita, vista previa y VS Code',()=>{const src=file('src/components/SignalConnectionsPanel.vue');for(const t of ['lf-callback-script','lf-callback-name','lf-callback-preview','Generar método y conectar','openInVSCode(result.scriptId)','expectedCode:generationCode.value'])assert.ok(src.includes(t),t)})
test('CB-17: conservar manual/edición y no crear scripts silenciosamente',()=>{const src=file('src/components/SignalConnectionsPanel.vue');assert.match(src,/chooseManualMethod/);assert.match(src,/<template v-if="!editingId">[\s\S]+?Generar método y conectar/);assert.doesNotMatch(txSource,/createScript\(/)})
test('CB-18: la generación no depende de frame ni ejecuta el código al previsualizar',()=>{assert.doesNotMatch(txSource,/requestAnimationFrame|setInterval/);assert.match(file('src/engine/runtime/scene/node-scripts.js'),/new Function\('game', 'node'/)})
