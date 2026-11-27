// QA funcional del recorrido real de salidas. No intercepta console en producción.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import * as THREE from 'three'
import {reactive,isReactive,toRaw} from '@vue/reactivity'
import {parse,compileScript as compileVue,compileTemplate} from '@vue/compiler-sfc'
import {Game} from '../src/engine/runtime/events/interpreter.js'
import {createScriptConsole,compileScript} from '../src/engine/runtime/host.js'
import {NodeScriptRuntime} from '../src/engine/runtime/scene/node-scripts.js'
import {NodeLifecycle} from '../src/engine/runtime/scene/node-lifecycle.js'
import {registerNode} from '../src/engine/runtime/nodes/registry.js'
import {nodesMethods} from '../src/engine/runtime/events/play-nodes.js'
import {routeMethods} from '../src/engine/runtime/events/play-route.js'
import {createPackageHost} from '../src/engine/runtime/package/host.js'
import {store,toast} from '../src/core/state/state.js'
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8')
function fixture(){const rows=[],errors=[];const host={log:(msg,kind,context)=>rows.push({msg,kind,context}),error:(msg)=>errors.push(msg)};return {rows,errors,host,game:new Game({host})}}
registerNode({type:'consoleQA',label:'QA',create:()=>({}),build:()=>({}),update:()=>{}})
function nodes(codes,{reactiveProject=false,canonicalOwner=true}={}){
 const x=fixture(),obj={id:'n',name:'Nodo QA',type:'consoleQA',scriptIds:codes.map((_,i)=>'s'+i)}
 const data={objects:[obj],scripts:codes.map((code,i)=>({id:'s'+i,name:'Script '+i,execution:'node',code})),signalConnections:[]}
 const project=reactiveProject?reactive(data):data
 const graphNodes=new Map([[obj.id,new THREE.Group()]]);graphNodes.get(obj.id)._lfNodeOwner=canonicalOwner?project.objects[0]:obj
 const life=new NodeLifecycle({host:{project},nodes:graphNodes})
 const play={on:true,project,game:x.game,_referenceSession:{},ed:{nodes:graphNodes,nodeLifecycle:life},_tagLayerApi:()=>({}),_animMethodsFor:()=>({}),_persistMarked:()=>false,_persistSet:()=>{},vm:{held:new Map()},pos:new THREE.Vector3(),vp:{requestRender(){}}}
 Object.assign(play,nodesMethods);x.game.api.node=id=>play._nodeHandle(id);life.scripts=new NodeScriptRuntime(play)
 return {...x,obj:project.objects[0],rawObj:obj,life,play,project}
}
for(const level of ['log','info','warn','error','debug'])test(`CON-01-${level}: nivel y salida única del script global`,async()=>{
 const x=fixture();await x.game.loadScripts([{name:'global.js',code:`console.${level}('salida', 7)`}]);assert.deepEqual(x.rows,[{msg:'salida 7',kind:level,context:'global.js'}])
})
test('CON-02: game.log conserva una sola salida',()=>{const x=fixture();x.game.api.log('A',2);assert.equal(x.rows.length,1);assert.equal(x.rows[0].msg,'A 2')})
test('CON-03: declaraciones propias console no colisionan',async()=>{
 for(const declaration of ['const console={log:v=>game.state.value=v}','let console={log:v=>game.state.value=v}','var console={log:v=>game.state.value=v}','function console(){};console.log=v=>game.state.value=v','class console{static log(v){game.state.value=v}}']){
  const x=fixture();await x.game.loadScripts([{code:`${declaration};console.log(42)`}]);assert.equal(x.game.state.value,42);assert.equal(x.rows.length,0);assert.deepEqual(x.errors,[])
 }
})
test('CON-04: callbacks y await globales conservan su contexto',async()=>{
 const x=fixture();await x.game.loadScripts([{name:'A.js',code:`await Promise.resolve();console.info('inicio');game.on('mensaje',()=>console.warn('callback'))`}]);await x.game.signal('mensaje');assert.deepEqual(x.rows.map(r=>r.context),['A.js','A.js']);assert.equal(x.rows[1].kind,'warn')
})
test('CON-05: eventos y caché no comparten el contexto de consola',async()=>{
 const x=fixture(),list=[{code:'script',p:{code:`console.debug(event.name, args[0])`}}]
 await x.game.run(list,{name:'Evento A',args:[1]}).done;await x.game.run(list,{name:'Evento B',args:[2]}).done
 assert.deepEqual(x.rows.map(r=>[r.msg,r.context]),[['Evento A 1','Evento A'],['Evento B 2','Evento B']])
})
test('CON-06: expresiones conservan valores y nivel',()=>{const x=fixture();assert.equal(x.game.evalExpr(`(console.warn('expr'),3*4)`,{name:'Condición'}),12);assert.equal(x.rows[0].kind,'warn');assert.equal(x.rows[0].context,'Condición')})
test('CON-07: excepción global y evento tienen diagnóstico con contexto',async()=>{
 const x=fixture();await x.game.loadScripts([{name:'roto.js',code:`throw Error('fallo global')`}]);await x.game.run([{code:'script',p:{code:`throw Error('fallo evento')`}}],{name:'Puerta'}).done
 assert.equal(x.errors.length,2);assert.match(x.errors[0],/roto.js.*fallo global/);assert.match(x.errors[1],/Puerta.*fallo evento/)
})
test('CON-08: una sesión cerrada no escribe en la siguiente',async()=>{
 const x=fixture();await x.game.loadScripts([{code:`game.state.late=()=>{console.log('tarde');game.log('viejo')}`}]);x.game.closeOutput();x.game.state.late();assert.equal(x.rows.length,0)
 const next=new Game({host:x.host});next.api.log('nuevo');assert.deepEqual(x.rows.map(r=>r.msg),['nuevo'])
})
test('CON-09: evento cancelado silencia sus closures',async()=>{const x=fixture();const run=x.game.run([{code:'script',p:{code:`game.state.late=()=>{console.log('cancelado');game.log('cancelado')}`}}]);await run.done;run.cancel();x.game.state.late();assert.equal(x.rows.length,0)})
test('CON-10: Multiscript, Signals y niveles usan cierres independientes',()=>{
 const x=nodes([`node.define_signal('listo');node.expose('emitir',()=>node.emit_signal('listo',8));function _ready(){console.info('A')}`,`node.expose('recibir',v=>console.warn('B',v));function _ready(){game.log('B listo')}`]);x.life.start()
 const handle=x.play._nodeHandle('n');handle.connect('listo',handle,'recibir');handle.call('emitir')
 assert.deepEqual(x.rows.map(r=>r.msg),['A','B listo','B 8']);assert.match(x.rows[0].context,/Script 0/);assert.match(x.rows[1].context,/Script 1/);assert.equal(x.rows[2].kind,'warn');x.life.stop()
})
test('CON-11: eliminar o cambiar escena invalida consola y game.log del slot',()=>{
 const x=nodes([`game.state.late=()=>{console.log('viejo');game.log('viejo')};function _exit_tree(){console.debug('salida')}`]);x.life.start();const late=x.game.state.late;x.life.stop();assert.equal(x.rows[0].msg,'salida');late();assert.equal(x.rows.length,1)
 x.life.start();x.game.state.late();assert.equal(x.rows.length,3);x.life.stop()
})
test('CON-12: console local de nodo y fallos no bloquean scripts vecinos',()=>{
 const x=nodes([`const console={info:()=>{}};function _ready(){console.info('privado')}`,`function _ready(){throw Error('roto')}`,`function _ready(){console.log('sano')}`]);x.life.start();assert.deepEqual(x.rows.map(r=>r.msg),['sano']);assert.match(x.errors[0],/Nodo QA.*s1.*roto/);x.life.stop()
})
test('CON-13: script de ruta conserva nivel y usa la API existente',async()=>{
 const x=fixture(),play={on:true,game:x.game,pos:new THREE.Vector3(),_playerApi:()=>({})},actor={yaw:()=>0,pos:()=>play.pos,player:true},state={token:1}
 await routeMethods._routeStep.call(play,actor,state,{c:'script',p:{code:`console.error('ruta');game.state.late=()=>{console.log('cancelada');game.log('cancelada')}`}},true,1)
 assert.equal(x.rows[0].kind,'error');assert.equal(x.rows[0].context,'Ruta Jugador');state.token++;x.game.state.late();assert.equal(x.rows.length,1)
})
test('CON-14: serialización tolera objetos circulares, BigInt, Error y valores hostiles',()=>{
 const x=fixture(),o={a:1};o.self=o;x.game.console.log(o,2n,undefined,null,new Error('detalle'),new Proxy({},{get(){throw Error('getter')}}));assert.match(x.rows[0].msg,/Circular/);assert.match(x.rows[0].msg,/2n/);assert.match(x.rows[0].msg,/detalle/);assert.match(x.rows[0].msg,/Valor no representable/)
 x.game.console.info('x'.repeat(10000));assert.equal(x.rows[1].msg.length,8000)
})
test('CON-15: captura léxica no cambia el objeto console global',()=>{
 const native=globalThis.console,log=native.log;const x=fixture();compileScript([],`console.log('local')`)(x.game.console)();assert.equal(globalThis.console,native);assert.equal(globalThis.console.log,log);assert.equal(x.rows.length,1)
})
test('CON-16: toast conserva notificación y excluye historial',()=>{
 store.log.splice(0);store.toasts.splice(0);toast('Guardado administrativo','ok',1);assert.equal(store.log.length,0);assert.equal(store.toasts[0].msg,'Guardado administrativo')
})
test('CON-17: host real del Editor acota historial a 300 y conserva niveles',()=>{
 const code=read('src/core/editor/editor-host.js').replace(/^import .*\n/gm,'').replace('export const EDITOR_HOST','const EDITOR_HOST')
 let seq=0;const editor=vm.runInNewContext(code+'\nEDITOR_HOST',{store,uid:()=>String(++seq),getObject(){},assetData(){},assetImage(){},assetUrl(){},toast,switchScene(){}})
 store.log.splice(0);for(let i=0;i<305;i++)editor.log(String(i),'debug','QA');assert.equal(store.log.length,300);assert.equal(store.log[0].msg,'5');assert.equal(store.log.at(-1).kind,'debug');store.log.splice(0);assert.equal(store.log.length,0)
})
test('CON-18: Player usa host propio y conserva nivel sin store del Editor',async()=>{
 const rows=[],pkg={game:{id:'player'},file:async()=>null};const host=createPackageHost({pkg,storage:{},log:(...a)=>rows.push(a)}),game=new Game({host});await game.loadScripts([{name:'Player.js',code:`console.warn('player');game.log('api')`}]);assert.deepEqual(rows,[['player','warn','Player.js'],['api','log','Player.js']]);assert.doesNotMatch(read('src/engine/runtime/package/host.js'),/import .*core\/store/)
})
test('CON-19: fallback del Player entrega scripts a consola nativa',t=>{
 const calls=[];t.mock.method(console,'debug',(...a)=>calls.push(a));const host=createPackageHost({pkg:{game:{}},storage:{}});new Game({host}).console.debug('player nativo');assert.deepEqual(calls,[['player nativo']])
})
test('CON-20: compilador Vue verifica panel y contador existentes',()=>{
 for(const file of ['src/components/ConsolePanel.vue','src/components/BottomDock.vue']){const {descriptor,errors}=parse(read(file));assert.deepEqual(errors,[]);const script=compileVue(descriptor,{id:'console-qa'});const result=compileTemplate({source:descriptor.template.content,filename:file,id:'console-qa',compilerOptions:{bindingMetadata:script.bindings}});assert.deepEqual(result.errors,[])}
})

test('CON-21: UI real conserva consola en setup y callbacks (render SSR)',async()=>{
 const {UiManager}=await import('../src/engine/runtime/ui/manager.js'),{createSSRApp,h}=await import('vue'),{renderToString}=await import('@vue/server-renderer')
 const x=fixture(),doc={id:'ui',name:'Pantalla.ui',code:`<template><button @click="write">QA</button></template><script>console.warn('setup');game.state.write=()=>{console.info('callback');game.log('api ui')};return {write:game.state.write}</script>`}
 const manager=new UiManager({play:{},getDocs:()=>[doc],getConfig:()=>({}),getGame:()=>x.game,host:x.host}),c=manager.compiled('ui');assert.equal(c.ok,true)
 assert.match(await renderToString(createSSRApp({render:()=>h(c.component,{screen:{key:'ui',props:{}}})})),/QA/);x.game.state.write()
 assert.deepEqual(x.rows.map(r=>[r.msg,r.kind,r.context]),[['setup','warn','Interfaz Pantalla.ui'],['callback','info','Interfaz Pantalla.ui'],['api ui','log','Interfaz Pantalla.ui']])
 x.game.closeOutput();x.game.state.write();assert.equal(x.rows.length,3)
})
test('CON-22: console propio en UI, diagnóstico setup y onUpdate',async()=>{
 const {UiManager}=await import('../src/engine/runtime/ui/manager.js'),{createSSRApp,h}=await import('vue'),{renderToString}=await import('@vue/server-renderer')
 const x=fixture(),doc={id:'ui',name:'Pantalla.ui',code:`<template><span>QA</span></template><script>const console={log:v=>game.state.value=v};console.log(5);throw Error('setup esperado')</script>`}
 const manager=new UiManager({play:{},getDocs:()=>[doc],getConfig:()=>({}),getGame:()=>x.game,host:x.host}),c=manager.compiled('ui');await renderToString(createSSRApp({render:()=>h(c.component,{screen:{key:'ui',props:{}}})}))
 assert.equal(x.game.state.value,5);assert.equal(x.rows.length,0);assert.match(x.errors[0],/Pantalla.ui.*setup esperado/)
 manager.updaters.add(async()=>{throw Error('update esperado')});manager.sync(1,1,.01);await Promise.resolve();assert.match(x.errors[1],/onUpdate.*update esperado/)
})
test('CON-23: avisos internos de presentación no se convierten en salida del autor',async()=>{
 const code=read('src/engine/runtime/events/exec-commands.js'),start=code.indexOf('async function presentDatabaseAction'),end=code.indexOf('export const cmp')
 const native=[],rows=[],present=vm.runInNewContext(code.slice(start,end)+'\npresentDatabaseAction',{console:{warn:msg=>native.push(msg)}})
 await present({log:msg=>rows.push(msg),audio:{play(){throw Error('archivo ausente')}}},{name:'Objeto',actionSound:'missing'},'event')
 assert.equal(rows.length,0);assert.match(native[0],/Sonido.*archivo ausente/)
})
test('CON-24: host Play conserva nivel, error único y notificación técnica',t=>{
 const source=read('src/engine/runtime/events/play-host.js').replace(/^import .*\n/gm,'').replace('export const hostMethods','const hostMethods'),technical=[]
 const methods=vm.runInNewContext(source+'\nhostMethods',{console:{error:msg=>technical.push(msg)}}),rows=[],notices=[]
 const play={on:true,ui:{api:{}},state:{errors:0},rt:{log:(...a)=>rows.push(a),toast:(...a)=>notices.push(a)}}
 const host=methods._host.call(play);host.log('salida','debug','Nodo');host.error('fallo');assert.deepEqual(rows,[['salida','debug','Nodo'],['fallo','error','Script']]);assert.equal(notices.length,1);assert.equal(technical.length,1);assert.equal(play.state.errors,1)
 play.on=false;host.log('obsoleto');host.error('obsoleto');assert.equal(rows.length,2)
})

test('CON-25: caché de código evita recrear consola y cierre al evaluar el mismo contexto',()=>{
 const x=fixture(),a={name:'A'},b={name:'B'},src=`(console.log('eval'),42)`
 assert.equal(x.game._fn('expr',src,a),x.game._fn('expr',src,a));assert.notEqual(x.game._fn('expr',src,a),x.game._fn('expr',src,b));assert.equal(x.game._fn('expr',src),x.game._fn('expr',src))
})
test('CON-26: rechazo UI tardío no se atribuye a la siguiente sesión',async()=>{
 const {UiManager}=await import('../src/engine/runtime/ui/manager.js'),x=fixture();let current=x.game,reject
 const manager=new UiManager({play:{},getDocs:()=>[],getConfig:()=>({}),getGame:()=>current,host:x.host})
 manager.updaters.add(()=>new Promise((_,fail)=>{reject=fail}));manager.sync(1,1,.01);x.game.closeOutput();current=new Game({host:x.host});reject(Error('sesión vieja'));await Promise.resolve();assert.equal(x.errors.length,0)
})

const reactiveScripts=[
 `node.define_signal('listo');node.expose('emitir',()=>node.emit_signal('listo',9));function _ready(){console.info('nodo A')};game.state.late=()=>console.warn('obsoleto')`,
 `node.expose('recibir',v=>console.warn('señal',v));function _ready(){console.debug('nodo B')}`,
]
test('CON-CORR-01: reproduce la fixture raw incompatible con proyecto reactivo',()=>{
 const x=nodes(reactiveScripts,{reactiveProject:true,canonicalOwner:false})
 assert.ok(isReactive(x.obj));assert.equal(toRaw(x.obj),x.rawObj)
 assert.notEqual(x.play.ed.nodes.get(x.obj.id)._lfNodeOwner,x.project.objects[0])
 try {
  x.life.start();assert.equal(x.rows.length,0);assert.equal(x.errors.length,2)
  for(const error of x.errors)assert.match(error,/Script de nodo inactivo/)
 } finally {x.life.stop()}
})
test('CON-CORR-02: identidad canónica permite salidas, Signals y reentrada reactiva',()=>{
 const x=nodes(reactiveScripts,{reactiveProject:true})
 assert.ok(isReactive(x.project));assert.equal(x.play.ed.nodes.get(x.obj.id)._lfNodeOwner,x.obj)
 try {
  x.life.start();assert.deepEqual(x.errors,[])
  assert.deepEqual(x.rows.map(r=>[r.msg,r.kind]),[['nodo A','info'],['nodo B','debug']])
  const handle=x.play._nodeHandle('n');assert.equal(handle.is_valid(),true)
  assert.equal(handle.connect('listo',handle,'recibir'),true);handle.call('emitir')
  assert.equal(x.rows.at(-1).msg,'señal 9');assert.match(x.rows.at(-1).context,/Script 1/)
  const late=x.game.state.late;x.life.stop();const count=x.rows.length;late();assert.equal(x.rows.length,count)
  x.life.start();assert.equal(x.rows.length,count+2);assert.deepEqual(x.errors,[])
  x.play._nodeHandle('n').call('emitir');assert.equal(x.rows.length,count+2)
 } finally {x.life.stop()}
})
test('CON-CORR-03: fixture conserva cobertura e identidad explícita, sin relajar el runner',()=>{
 const html=read('scripts/fixtures/editor/console-script-output-corr-g001.html')
 assert.match(html,/const mountedObject=store\.project\.objects\[0\]/)
 assert.match(html,/_lfNodeOwner=mountedObject/)
 for(const name of ['Dos scripts de nodo, dos salidas','Callback Signals escribe una vez','Excepción Vue visible una vez','Autoscroll funciona con límite lleno','Player sin store conserva sus salidas'])assert.ok(html.includes(name),name)
 assert.match(read('scripts/test-editor-console-script-output-electron-corr-g001.mjs'),/minChecks:35/)
})
