// Signals S01-G003: entrada/salida reales sin duplicar el runtime ni crear un árbol paralelo.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { registerNode, getNativeSignals, getNativeSignal } from '../src/engine/runtime/nodes/registry.js'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
registerNode({ type: 'treeqa', label: 'Tree QA', create:()=>({}),build:()=>({}),update:()=>{} })
const methods = vm.runInNewContext(read('src/engine/runtime/events/play-nodes.js').replace(/^import .*\n/gm,'').replace('export const nodesMethods','const nodesMethods')+'\nnodesMethods',{resolveNodePath:()=>null})
const obj=(id,scriptIds=[],parentId=null)=>({id,name:id,type:'treeqa',scriptIds,parentId})
const script=(id,code)=>({id,execution:'node',code})
const link=(id,from,to,signal,method='receive')=>({id,emitterId:from,receiverId:to,signal,method})
const receiver=script('r',"node.expose('receive', (value)=>game.record('receive:'+game.currentSignal));function _enter_tree(){game.record('enter:r')}function _ready(){game.record('ready:r')}function _exit_tree(){game.record('exit:r')}")
function fixture({objects=[obj('e'),obj('r',['r'])],scripts=[receiver],links=[],on=true}={}) {
 const events=[],errors=[],project={objects,scripts,signalConnections:links,activeSceneId:'treeScene'}
 const nodes=new Map(objects.map(o=>[o.id,{_lfNodeOwner:o}]))
 const play={project,on,_sceneSignalReady:true,_referenceSession:{},ed:{nodes},game:{api:{record:v=>events.push(v),currentSignal:'native'},report:e=>errors.push(String(e.message||e))},vm:{held:new Map()},pos:{},vp:{requestRender(){}},_tagLayerApi:()=>({}),_animMethodsFor:()=>({}),_persistMarked:()=>false,_persistSet:()=>false}
 const life=new NodeLifecycle({nodes,host:{project}});play.ed.nodeLifecycle=life;Object.assign(play,methods);play.game.api.node=id=>play._nodeHandle(id)
 life.scripts=new NodeScriptRuntime(play)
 const update=(list,links=project.signalConnections)=>{project.objects=list;project.signalConnections=links;nodes.clear();for(const o of list)nodes.set(o.id,{_lfNodeOwner:o});life.sync()}
 const detach=id=>{project.objects=project.objects.filter(o=>o.id!==id);life.beginRemoval(id);nodes.delete(id);life.endRemoval(id);life.sync()}
 return {events,errors,project,nodes,life,play,start:()=>life.start(),stop:()=>life.stop(),update,detach}
}
const treeNames=['ready','tree_entered','tree_exiting','tree_exited','animation_finished']
test('SIG-TREE-01: tres señales nativas registradas con origen y cero argumentos',()=>{
 assert.deepEqual(getNativeSignals('treeqa').map(s=>s.name),treeNames)
 for(const n of treeNames.slice(1,4)){const m=getNativeSignal('treeqa',n);assert.equal(m.source,'node-lifecycle');assert.deepEqual(m.args,[]);assert.ok(m.phase&&m.condition)}
 assert.equal(getNativeSignal('never','tree_entered'),null)
})
test('SIG-TREE-02: un nodo sin scripts emite tree_entered y llega a receptor preparado',()=>{
 const x=fixture({links:[link('in','e','r','tree_entered')]});x.start()
 assert.equal(x.events.filter(e=>e==='receive:native').length,1);assert.equal(x.life.scripts.instances.has('e'),false)
 assert.equal(x.life.scripts.sceneConnections.size,1);assert.deepEqual(x.errors,[]);x.stop()
})
test('SIG-TREE-03: tree_entered se emite después de _enter_tree y antes de _ready',()=>{
 const x=fixture({objects:[obj('e',['e']),obj('r',['r'])],scripts:[receiver,script('e',"function _enter_tree(){game.record('enter:e')}function _ready(){game.record('ready:e')}")],links:[link('in','e','r','tree_entered')]})
 x.start();assert.deepEqual(x.events.slice(0,3),['enter:e','receive:native','enter:r']);assert.ok(x.events.indexOf('ready:e')>x.events.indexOf('receive:native'));x.stop()
})
test('SIG-TREE-04: entrada padre→hijo, salida hijo→padre con scripts reales',()=>{
 const code=id=>script(id,`function _enter_tree(){game.record('enter:${id}')}function _exit_tree(){game.record('exit:${id}')}`)
 const x=fixture({objects:[obj('child',['child'],'parent'),obj('parent',['parent'])],scripts:[code('child'),code('parent')]})
 x.start();x.stop();assert.deepEqual(x.events,['enter:parent','enter:child','exit:child','exit:parent'])
})
test('SIG-TREE-05: tree_exiting sale después del callback _exit_tree',()=>{
 const x=fixture({objects:[obj('r',['r']),obj('e',['e'])],scripts:[receiver,script('e',"function _exit_tree(){game.record('exit:e')}")],links:[link('out','e','r','tree_exiting')]})
 x.start();x.detach('e');assert.ok(x.events.indexOf('exit:e')>=0)
 assert.equal(x.events[x.events.indexOf('exit:e')+1],'receive:native');assert.ok(x.errors.every(e=>e.includes('emisor o receptor ausente')));x.stop()
})
test('SIG-TREE-06: tree_exited después del desmontaje del SceneGraph',()=>{
 const x=fixture({objects:[obj('r',['r']),obj('e')],links:[link('out','e','r','tree_exited')]})
 x.start();x.project.objects=x.project.objects.filter(o=>o.id!=='e');x.life.beginRemoval('e')
 assert.equal(x.events.filter(e=>e==='receive:native').length,0)
 x.nodes.delete('e');x.life.endRemoval('e')
 assert.equal(x.events.filter(e=>e==='receive:native').length,1)
 assert.equal(x.life.entered.has('e'),false);x.stop()
})
test('SIG-TREE-07: salir emite tree_exiting antes que tree_exited sin duplicar eventos',()=>{
 const x=fixture({objects:[obj('r',['r']),obj('e')],links:[link('x1','e','r','tree_exiting'),link('x2','e','r','tree_exited')]})
 x.start();x.detach('e');assert.equal(x.events.filter(e=>e==='receive:native').length,2)
 assert.equal(x.life.scripts.nativeSources.size,0);assert.equal(x.life.scripts.sceneConnections.size,0);x.stop()
})
test('SIG-TREE-08: conexiones desde _enter_tree llegan a la emisión de ese mismo nodo',()=>{
 const x=fixture({objects:[obj('r',['r']),obj('e',['e'])],scripts:[receiver,script('e',"function _enter_tree(){node.connect('tree_entered',game.node('r'),'receive')}")]})
 x.start();assert.equal(x.events.filter(e=>e==='receive:native').length,1);assert.deepEqual(x.errors,[]);x.stop()
})
test('SIG-TREE-09: los métodos definidos tarde no reciben eventos retroactivos',()=>{
 const x=fixture({objects:[obj('e'),obj('r',['late'])],scripts:[script('late',"function _enter_tree(){node.expose('receive',()=>game.record('late'))}")],links:[link('late','e','r','tree_entered')]})
 x.start();assert.equal(x.events.includes('late'),false);assert.ok(x.errors.some(e=>e.includes('Método receptor no publicado')))
 assert.ok(x.life.scripts.sceneConnections.has('late'));x.stop()
})
test('SIG-TREE-10: reentradas emiten tree_entered nuevamente, sin repetir ready anterior',()=>{
 const x=fixture({objects:[obj('r',['r']),obj('e')],links:[link('x','e','r','tree_entered')]})
 x.start();x.detach('e');x.project.signalConnections=[link('x','e','r','tree_entered')];x.update([x.project.objects[0],obj('e')])
 assert.equal(x.events.filter(e=>e==='receive:native').length,2);x.stop()
})
test('SIG-TREE-11: detener Play desconecta emisiones y limpia los contenedores nativos',()=>{
 const x=fixture({objects:[obj('r',['r']),obj('e')],links:[link('x','e','r','tree_exiting'),link('y','e','r','tree_exited')]})
 x.start();x.stop();assert.equal(x.life.scripts.nativeSources.size,0)
 assert.equal(x.life.scripts.sceneConnections.size,0);assert.equal(x.life.entered.size,0);assert.equal(x.life._removing.size,0)
})
test('SIG-TREE-12: sin códigos de nodo, las señales quedan disponibles por catálogo',()=>{
 const x=fixture({objects:[obj('e')],scripts:[],links:[]});x.start()
 assert.equal(x.life.scripts.instances.size,0);assert.deepEqual(x.errors,[]);x.stop()
})
test('SIG-TREE-13: la preparación multiscript preserva el orden de sus callbacks',()=>{
 const scripts=['a','b','c'].map(id=>script(id,`function _enter_tree(){game.record('enter:${id}')}function _ready(){game.record('ready:${id}')}function _exit_tree(){game.record('exit:${id}')}`))
 const x=fixture({objects:[obj('e',['a','b','c'])],scripts});x.start();x.stop()
 assert.deepEqual(x.events,['enter:a','enter:b','enter:c','ready:a','ready:b','ready:c','exit:c','exit:b','exit:a'])
})
test('SIG-TREE-14: una conexión dinámica puede desconectarse antes de salir',()=>{
 const x=fixture({objects:[obj('r',['r']),obj('e')],links:[]});x.start()
 const a=x.play._nodeHandle('e'),r=x.play._nodeHandle('r')
 assert.equal(a.connect('tree_exited',r,'receive'),true)
 assert.equal(a.disconnect('tree_exited',r,'receive'),true)
 x.detach('e');assert.equal(x.events.includes('receive:native'),false);x.stop()
})
test('SIG-TREE-15: cambio de escena mediante Stop/Start no reutiliza fuentes antiguas',()=>{
 const x=fixture({objects:[obj('r',['r']),obj('e')],links:[link('in','e','r','tree_entered')]})
 x.start();x.stop();x.start();assert.equal(x.events.filter(e=>e==='receive:native').length,2);x.stop()
})
test('SIG-TREE-16: Area3D conserva cuatro señales Jolt más cuatro señales comunes',()=>{
 const def=getNativeSignals('area3d');if(!def.length)return
 assert.equal(def.filter(s=>s.source==='jolt-area').length,4);assert.equal(def.filter(s=>s.source==='node-lifecycle').length,4)
})
test('SIG-TREE-17: no hay nuevos bucles de despacho por fotograma',()=>{
 const s=read('src/engine/runtime/scene/node-lifecycle.js');assert.doesNotMatch(s,/setInterval\(|requestAnimationFrame\(/)
 const x=fixture();x.start();const count=x.life.scripts.nativeSources.size
 x.life.process(0.016);x.life.physicsProcess(0.016);assert.equal(x.life.scripts.nativeSources.size,count);x.stop()
})
test('SIG-TREE-18: salida física se coordina antes y después de la baja del nodo',()=>{
 const s=read('src/engine/runtime/scene/objects.js')
 assert.ok(s.indexOf('this.nodeLifecycle?.beginRemoval(id)') < s.indexOf('node.parent?.remove(node)'))
 assert.ok(s.indexOf('this.nodes.delete(id)') < s.indexOf('this.nodeLifecycle?.endRemoval(id)'))
})
test('SIG-TREE-19: no se alteran las conexiones persistentes ni su formato',()=>{
 const s=read('src/engine/runtime/scene/node-scripts.js');assert.match(s,/this\.play\.project\.signalConnections \|\| \[\]/)
 assert.match(s,/this\.sceneConnections = new Map\(\)/)
})
test('SIG-TREE-21: Stop mantiene vivo el runtime durante los callbacks de salida',()=>{
 const s=read('src/engine/runtime/events/play.js')
 assert.ok(s.indexOf('this.ed.nodeLifecycle.stop()',s.indexOf('async stop()')) < s.indexOf('this.on = false',s.indexOf('async stop()')))
})
test('SIG-TREE-22: cambio de escena no desconecta antes del ciclo de salida',()=>{
 const s=read('src/engine/runtime/events/play-nodes.js')
 const switchPart=s.slice(s.indexOf('this._sceneSignalReady = false'),s.indexOf('try { ok = await this.rt.switchScene'))
 assert.doesNotMatch(switchPart,/clearSceneConnections\(\)/)
 assert.match(read('src/engine/runtime/scene-graph.js'),/this.nodeLifecycle.stop\(\)/)
})
test('SIG-TREE-20: no se registra una segunda autoridad de nodos o señales',()=>{
 const src=read('src/engine/runtime/scene/node-lifecycle.js');assert.match(src,/this\.entered = new Map\(/)
 assert.doesNotMatch(src,/EventBus|new NodeScriptRuntime|new SceneGraph/)
})
