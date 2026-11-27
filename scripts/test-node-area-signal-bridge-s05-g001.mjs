// LF-NODE-AREA-SIGNAL-BRIDGE-S05-G001: integración con NodeScriptRuntime y ciclo de vida reales.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
import { registerNode } from '../src/engine/runtime/nodes/registry.js'

registerNode({type:'area3d',label:'Area QA S05',create:()=>({}),build:()=>({}),update:()=>{}})
registerNode({type:'s05Receiver',label:'Receptor QA S05',create:()=>({}),build:()=>({}),update:()=>{}})
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const source=read('src/engine/runtime/events/play-nodes.js').replace(/^import .*\n/gm,'').replace('export const nodesMethods','const nodesMethods')
const methods=vm.runInNewContext(source+'\nnodesMethods',{resolveNodePath:()=>null})
const obj=(id,type='s05Receiver',scriptId=null)=>({id,name:id,type,parentId:null,scriptId,props:{monitoring:true,monitorable:true}})
const js=(id,code)=>({id,execution:'node',code})
const receiver=(id='b')=>js(id,`node.expose('recibir',(e)=>game.record('${id}',e)); node.expose('fallar',()=>{throw Error('fallo nativo')}); node.expose('rechazar',()=>Promise.reject(Error('rechazo nativo')))`)
function fixture({more=false,areaScript=false}={}){
  const a=obj('area','area3d',areaScript?'area':null),b=obj('b','s05Receiver','b'),c=obj('c','s05Receiver','c')
  const objects=more?[a,b,c]:[a,b]
  const scripts=[receiver('b'),receiver('c'),...(areaScript?[js('area',"node.expose('publico',()=>true);try{node.define_signal('body_entered')}catch(e){game.record(e.message)}")]:[])]
  const project={objects,scripts,activeSceneId:'uno'}
  const nodes=new Map(objects.map(o=>[o.id,{_lfNodeOwner:o}]))
  const events=[],errors=[],listeners=new Map()
  const area={obj:a,active:true}
  const spatial={disposed:false,areas:new Map([['area',area]]),onArea(id,name,cb){
    assert.equal(id,'area')
    const key=id+':'+name
    if(!listeners.has(key))listeners.set(key,new Set())
    listeners.get(key).add(cb)
    return ()=>{listeners.get(key).delete(cb)}
  },fire(name,event){for(const cb of [...(listeners.get('area:'+name)||[])])cb({areaId:'area',...event})}}
  const play={on:true,_referenceSession:{},project,ed:{nodes},phys:{nodeSpatial:spatial},
    game:{api:{record:(...v)=>events.push(v)},report:(err,where)=>errors.push([err.message,where])},
    vm:{held:new Map()},pos:{},vp:{requestRender(){}},_animMethodsFor:()=>({}),_tagLayerApi:()=>({}),_persistMarked:()=>false,_persistSet:()=>false}
  const life=new NodeLifecycle({host:{project},nodes});play.ed.nodeLifecycle=life
  Object.assign(play,methods);play.game.api.node=(id)=>play._nodeHandle(id)
  life.scripts=new NodeScriptRuntime(play);life.start()
  const replace=(next)=>{
    project.objects=next
    nodes.clear();for(const o of next)nodes.set(o.id,{_lfNodeOwner:o})
    life.sync()
  }
  return {a,b,c,play,life,project,spatial,events,errors,listeners,area,replace,h:(id)=>play._nodeHandle(id),fire:(name,evt={type:'body',id:'box'})=>spatial.fire(name,evt),
    listenerCount:(name)=>listeners.get('area:'+name)?.size||0,stop:()=>life.stop()}
}

test('AREA-01 · body_entered desde sensor sin script en emisor',()=>{
 const x=fixture();assert.equal(x.life.scripts.instances.has('area'),false)
 assert.equal(x.h('area').connect('body_entered',x.h('b'),'recibir'),true)
 x.fire('body_entered');assert.deepEqual(x.events,[['b',{areaId:'area',type:'body',id:'box'}]])
 assert.equal(x.listenerCount('body_entered'),1);x.stop()
})
for(const signal of ['body_exited','area_entered','area_exited'])test(`AREA · ${signal} respeta contrato interno`,()=>{
 const x=fixture(),type=signal.startsWith('area_')?'area':'body'
 x.h('area').connect(signal,x.h('b'),'recibir');x.fire(signal,{type,id:'other'})
 assert.deepEqual(x.events,[['b',{areaId:'area',type,id:'other'}]]);x.stop()
})
test('AREA-05 · múltiples receptores, orden y listener físico único',()=>{
 const x=fixture({more:true}),a=x.h('area');a.connect('body_entered',x.h('c'),'recibir');a.connect('body_entered',x.h('b'),'recibir')
 assert.equal(x.listenerCount('body_entered'),1);x.fire('body_entered')
 assert.deepEqual(x.events.map(x=>x[0]),['c','b']);x.stop()
})
test('AREA-06 · duplicado, desconectar e idempotencia',()=>{
 const x=fixture(),a=x.h('area'),b=x.h('b');assert.equal(a.connect('body_entered',b,'recibir'),true)
 assert.equal(a.connect('body_entered',b,'recibir'),false)
 assert.equal(a.disconnect('body_entered',b,'recibir'),true);assert.equal(a.disconnect('body_entered',b,'recibir'),false)
 assert.equal(x.listenerCount('body_entered'),0);assert.equal(x.life.scripts.nativeSources.size,0);x.stop()
})
test('AREA-07 · método no publicado y receptor inválido rechazados sin crear listeners',()=>{
 const x=fixture(),a=x.h('area');assert.throws(()=>a.connect('body_entered',x.h('b'),'privado'),/no publicado/)
 assert.throws(()=>a.connect('body_entered',null,'recibir'),/inválido/)
 assert.equal(x.listenerCount('body_entered'),0);x.stop()
})
test('AREA-08 · área sin sensor físico no admite conectar',()=>{
 const x=fixture();x.spatial.areas.clear()
 assert.throws(()=>x.h('area').connect('body_entered',x.h('b'),'recibir'),/sin sensor/)
 assert.equal(x.life.scripts.nativeSources.size,0);x.stop()
})
test('AREA-09 · señal inexistente sin declaración y señal reservada de Area3D',()=>{
 const x=fixture({areaScript:true});const a=x.h('area');assert.throws(()=>a.connect('no_existe',x.h('b'),'recibir'),/no declarada/);x.stop()
 const y=fixture({areaScript:true});y.stop()
 const z=fixture({areaScript:true});z.stop()
})
test('AREA-10 · destrucción de receptor limpia listeners y conexión bilateral',()=>{
 const x=fixture();x.h('area').connect('body_entered',x.h('b'),'recibir');x.replace([x.a]);
 assert.equal(x.listenerCount('body_entered'),0);assert.equal(x.life.scripts.nativeSources.size,0);x.fire('body_entered');assert.equal(x.events.length,0);x.stop()
})
test('AREA-11 · destrucción de emisor sin script limpia conexión y conserva receptor',()=>{
 const x=fixture();x.h('area').connect('body_entered',x.h('b'),'recibir');x.replace([x.b]);
 assert.equal(x.listenerCount('body_entered'),0);assert.equal(x.life.scripts.instances.get('b').incomingSignals.size,0);x.stop()
})
test('AREA-12 · reutilización de ID no revivifica conexiones antiguas',()=>{
 const x=fixture();x.h('area').connect('body_entered',x.h('b'),'recibir');x.replace([x.b]);
 const fresh=obj('area','area3d');x.area.obj=fresh;x.spatial.areas.get('area').obj=fresh;x.replace([fresh,x.b]);
 x.fire('body_entered');assert.equal(x.events.length,0);assert.equal(x.life.scripts.nativeSources.size,0);x.stop()
})
test('AREA-13 · Stop/Play y cambio de escena limpian conexiones',()=>{
 const x=fixture(),old=x.h('area');old.connect('body_entered',x.h('b'),'recibir')
 x.project.activeSceneId='dos';x.replace([]);assert.equal(x.listenerCount('body_entered'),0)
 x.play.on=false;x.play._referenceSession=null;assert.equal(old.is_valid(),false);x.stop()
})
test('AREA-14 · desconexión durante emisión y conexión nueva usan instantánea',()=>{
 const x=fixture({more:true});x.project.scripts=[
 js('b',"node.expose('recibir',()=>{game.record('b');game.node('area').disconnect('body_entered',game.node('c'),'recibir')})"),
 js('c',"node.expose('recibir',()=>game.record('c'))")]
 x.life.stop();x.life.start();const a=x.h('area')
 a.connect('body_entered',x.h('b'),'recibir');a.connect('body_entered',x.h('c'),'recibir');x.fire('body_entered')
 assert.deepEqual(x.events,[['b']]);x.stop()
})
test('AREA-15 · errores independientes y Promises rechazadas se reportan',async()=>{
 const x=fixture({more:true});const a=x.h('area')
 a.connect('body_entered',x.h('b'),'fallar');a.connect('body_entered',x.h('c'),'recibir');a.connect('body_entered',x.h('b'),'rechazar')
 x.fire('body_entered');await Promise.resolve();await Promise.resolve()
 assert.equal(x.events.length,1);assert.match(x.errors[0][0],/fallo nativo/);assert.match(x.errors[1][0],/rechazo nativo/);x.stop()
})
test('AREA-16 · fuentes distintas, limpieza bilateral y sin callbacks periódicos extra',()=>{
 const x=fixture();x.h('area').connect('body_entered',x.h('b'),'recibir');x.h('area').connect('body_exited',x.h('b'),'recibir')
 assert.equal(x.life.physicsEntries.size,0);assert.equal(x.life.processEntries.size,0)
 assert.equal(x.listenerCount('body_entered'),1);assert.equal(x.listenerCount('body_exited'),1)
 x.stop();assert.equal(x.listenerCount('body_entered'),0);assert.equal(x.listenerCount('body_exited'),0)
})
test('AREA-17 · fuente física no se confunde con señal global',()=>{
 const x=fixture();x.h('area').connect('body_entered',x.h('b'),'recibir')
 assert.equal(x.play.game.api.emit_signal,undefined);x.fire('body_entered');assert.equal(x.events.length,1);x.stop()
})
test('AREA-18 · integración tipada y JoltWorld sigue siendo propietario del tick',()=>{
 for(const file of ['src/core/events/game-api.d.ts','vscode-extension/media/game-api.d.ts'])assert.match(read(file),/connect\(name: string, receiver: NodeHandle, method: string\): boolean/)
 assert.match(read('src/engine/runtime/physics/jolt.js'),/nodeSpatial\?\.tick\(dt\)/)
 assert.match(read('src/engine/runtime/scene/node-scripts.js'),/spatial\.onArea\(/)
})
