import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NavGrid } from '../src/engine/runtime/nav/grid.js'
import { NavWorld, navCache } from '../src/engine/runtime/nav/world.js'
import { NAV_DEFAULTS, bakeNav, normalizeNavParams } from '../src/engine/runtime/nav/bake.js'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'
const source = f => readFileSync(new URL('../'+f,import.meta.url),'utf8')
const code = source('src/engine/runtime/nodes/navigation.js')
  .replace(/^import .*$/gm,'').replace(/^export const navBounds\s*=/m,'const navBounds =')
  .replace('export default registerNode(', 'const definition = registerNode(')
Function('registerNode','THREE','makeRoot','applyBase','lineMat','hitSphere','unitGeometry','NAV_DEFAULTS','navCache',
  code+'\nreturn definition')(registerNode,{},()=>{},()=>{},()=>{},()=>{},()=>{},NAV_DEFAULTS,navCache)
const obj=(id='n1',asset='nav1')=>({id,name:id,type:'navigation',props:{...NAV_DEFAULTS,asset},position:[0,0,0],scale:[6,3,6],color:'#22ff22',active:true})
const original=()=>new NavGrid({cell:1,x0:0,z0:0,nx:2,nz:1,L:1,h:new Float32Array([0,1]),ok:new Uint8Array([1,1]),step:.55,agentRadius:0,agentHeight:1.8,maxSlope:45})
const fixture=(id='n1')=>{
  const grid=original(),root={userData:{}},o=obj(id),nav=new NavWorld([{id,name:id,grid,node:root}])
  navCache.set('nav1',grid)
  return {grid,root,o,nav,spec:k=>nodeAnimationProperty(o,`navigation.${k}`)}
}
const sleep=t=>new Promise(resolve=>setTimeout(resolve,t))
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const bounds={min:[0,-2,0],max:[2,3,1]}
const cast=(origin,dir,max)=>{
  if(dir[1]>0)return null
  const level=origin[0] < 1 ? 0 : 1
  if(origin[1] < level)return null
  const distance=origin[1]-level
  return distance > max ? null : {point:[origin[0],level,origin[2]],normal:[0,1,0],distance}
}

test('NB-01 · cinco descriptores propios habilitados solo con NavGrid real',()=>{
 const f=fixture()
 for(const id of ['cell','agentRadius','agentHeight','maxSlope','layers']) {
   const spec=f.spec(id);assert.ok(spec);assert.equal(spec.kind,'number')
   assert.equal(spec.read(f.o),f.o.props[id]);assert.equal(spec.capture(f.root,f.o).had,false)
 }
 assert.equal(Object.keys(getDef('navigation').animation).length,7) // 5 bake + step + color
 assert.equal(nodeAnimationProperty(obj('orphan','missing'),'navigation.cell'),null)
})
test('NB-02 · claves persistidas por ID, escena y rango, sin alterar proyecto ni Assets',()=>{
 const f=fixture(),authored=structuredClone(f.o),tl=newTimeline('Rehorneado',{duration:5})
 for(const [id,val] of [['cell',1.2],['agentRadius',.6],['agentHeight',2.4],['maxSlope',75],['layers',4]]){
  upsertTimelineNodePropertyKey(tl,f.o,`navigation.${id}`,'scene',[f.o],2,val)
  assert.deepEqual(normalizeTimeline(JSON.parse(JSON.stringify(tl))).tracks.at(-1).keys[0].v,val)
 }
 assert.deepEqual(f.o,authored)
 for(const [id,val] of [['cell',0],['agentRadius',-1],['agentHeight',6.1],['maxSlope',0],['layers',7]])
   assert.throws(()=>validatePropertyValue(`navigation.${id}`,val))
})
test('NB-03 · aplicación/lectura/restauración de cinco pistas sobre el MISMO nodo',()=>{
 const f=fixture(),calls=[];f.root.userData.navBakeRuntime={refresh(){calls.push({...f.root.userData.timelineNavBake})}}
 const saved=[]
 for(const [id,val] of [['cell',.4],['agentRadius',.3],['agentHeight',2],['maxSlope',60],['layers',3]]){
  const spec=f.spec(id);saved.push([spec,spec.capture(f.root,f.o)])
  spec.apply(f.root,val,f.o)
  assert.equal(spec.runtimeRead(f.root,f.o),val)
 }
 assert.equal(calls.length,5)
 assert.deepEqual(f.o.props,{...NAV_DEFAULTS,asset:'nav1'})
 for(const [spec,snap] of saved.reverse())spec.restore(f.root,snap,f.o)
 assert.equal(f.root.userData.timelineNavBake,undefined)
 assert.equal(calls.length,10)
 assert.deepEqual(f.o.props,{...NAV_DEFAULTS,asset:'nav1'})
})
test('NB-04 · capas fraccionarias se cuantizan a capas enteras antes del bake',()=>{
 const f=fixture(),spec=f.spec('layers')
 spec.apply(f.root,2.6,f.o)
 assert.equal(spec.runtimeRead(f.root,f.o),3)
 spec.apply(f.root,2.9,f.o)
 assert.equal(spec.runtimeRead(f.root,f.o),3)
})
test('NB-05 · stepHeight sin bake conserva la consulta rápida y con otros campos refresca región',()=>{
 const f=fixture(),step=f.spec('stepHeight'),triggers=[]
 f.root.userData.navBakeRuntime={refresh(){triggers.push(true)}}
 step.apply(f.root,1.2,f.o);assert.equal(triggers.length,0)
 const other=f.spec('agentRadius');other.apply(f.root,.8,f.o);assert.equal(triggers.length,1)
 step.apply(f.root,1.8,f.o);assert.equal(triggers.length,2)
})
test('NB-06 · bakeNav real usa celdas, alturas, niveles y pendiente con su lógica autoral',async()=>{
 const low=await bakeNav(bounds,{raycast:cast,params:{cell:1,layers:1,agentRadius:0,agentHeight:1.8,maxSlope:45,stepHeight:.55},yieldEvery:Infinity})
 assert.equal(low.nx,2);assert.equal(low.nz,1);assert.deepEqual(Array.from(low.h),[0,1]);assert.deepEqual(Array.from(low.ok),[1,1])
 const hi=await bakeNav(bounds,{raycast:cast,params:{cell:.5,layers:1,agentRadius:0,agentHeight:1.8,maxSlope:45,stepHeight:.55},yieldEvery:Infinity})
 assert.equal(hi.nx,4);assert.equal(hi.nz,2)
})
test('NB-07 · al rehornear con radio positivo la erosión cambia las celdas disponibles',async()=>{
 const p={cell:1,layers:1,agentRadius:1,agentHeight:1.8,maxSlope:45,stepHeight:1.1}
 const grid=await bakeNav(bounds,{raycast:cast,params:p,yieldEvery:Infinity})
 assert.ok(Array.from(grid.ok).every(v=>v===0))
 assert.equal(normalizeNavParams(p).agentRadius,1)
})
test('NB-08 · el límite de memoria rechaza antes de asignar arrays o raycast',async()=>{
 let casts=0
 await assert.rejects(()=>bakeNav({min:[0,0,0],max:[40,3,40]}, {params:{cell:.1,layers:6},maxCells:50_000,
  raycast(){casts++;return null}}),/demasiado grande/)
 assert.equal(casts,0)
})
test('NB-09 · NavWorld sustituye solo la región solicitante y preserva caché compartida',async()=>{
 const f=fixture(),other={id:'n2',grid:f.grid,node:{userData:{}}}
 f.nav.regions.push(other)
 const updated=original();updated.ok[1]=0
 f.nav.requestBake(f.o.id,'sig1',()=>Promise.resolve(updated))
 await sleep(225)
 assert.strictEqual(f.nav.regions[0].grid,updated)
 assert.strictEqual(f.nav.regions[1].grid,f.grid)
 assert.strictEqual(navCache.get('nav1'),f.grid)
 f.nav.restoreBake(f.o.id)
 assert.strictEqual(f.nav.regions[0].grid,f.grid)
 f.nav.dispose()
})
test('NB-10 · ráfagas de valores previas al debounce ejecutan solo última muestra',async()=>{
 const f=fixture(),invocations=[]
 for(let i=0;i<14;i++)f.nav.requestBake(f.o.id,String(i),()=>{invocations.push(i);return Promise.resolve(original())})
 await sleep(225)
 assert.deepEqual(invocations,[13]);f.nav.dispose()
})
test('NB-11 · STOP antes del debounce cancela y no instala grid tardío',async()=>{
 const f=fixture(),calls=[]
 f.nav.requestBake(f.o.id,'sig1',()=>{calls.push('run');return Promise.resolve(original())})
 f.nav.restoreBake(f.o.id)
 await sleep(220)
 assert.deepEqual(calls,[])
 assert.strictEqual(f.nav.regions[0].grid,f.grid)
})
test('NB-12 · tarea asíncrona resuelta después de STOP no reinstala mapa',async()=>{
 const f=fixture(),promise=deferred(),newGrid=original()
 f.nav.requestBake(f.o.id,'sig1',()=>promise.promise)
 await sleep(225)
 f.nav.restoreBake(f.o.id)
 promise.resolve(newGrid)
 await sleep(5)
 assert.strictEqual(f.nav.regions[0].grid,f.grid)
})
test('NB-13 · petición obsoleta no publica ni pisa la última solicitud',async()=>{
 const f=fixture(),pending=deferred(),latest=original()
 f.nav.requestBake(f.o.id,'sig1',()=>pending.promise)
 await sleep(210)
 f.nav.requestBake(f.o.id,'sig2',()=>Promise.resolve(latest))
 pending.resolve(original())
 await sleep(225)
 assert.strictEqual(f.nav.regions[0].grid,latest)
 f.nav.dispose()
})
test('NB-14 · dos regiones nunca ejecutan dos mundos de bake a la vez',async()=>{
 const f=fixture(),root={userData:{}},second=original(),d=deferred(),calls=[]
 f.nav.regions.push({id:'n2',node:root,grid:f.grid})
 f.nav.requestBake(f.o.id,'first',()=>{calls.push('first');return d.promise})
 f.nav.requestBake('n2','second',()=>{calls.push('second');return Promise.resolve(second)})
 await sleep(225)
 assert.deepEqual(calls,['first'])
 d.resolve(original())
 await sleep(240)
 assert.deepEqual(calls,['first','second'])
 f.nav.dispose()
})
test('NB-15 · un fallo de bake se informa y vuelve al mapa original',async()=>{
 const f=fixture(),errors=[]
 f.nav.requestBake(f.o.id,'fault',()=>Promise.reject(new Error('native failed')),e=>errors.push(e.message))
 await sleep(215)
 assert.deepEqual(errors,['native failed'])
 assert.strictEqual(f.nav.regions[0].grid,f.grid)
 f.nav.dispose()
})
test('NB-16 · cancelar por cambio de escena invalida todas las regiones',async()=>{
 const f=fixture(),deferredGrid=deferred()
 f.nav.requestBake(f.o.id,'sig',()=>deferredGrid.promise)
 await sleep(200)
 f.nav.dispose()
 deferredGrid.resolve(original());await sleep(5)
 assert.equal(f.nav.regions.length,0)
 assert.equal(f.nav._bakeJobs.size,0)
})
test('NB-17 · editor original y Player comparten bakeNavRegion, sin copiar algoritmo',()=>{
 const ed=source('src/core/nav/editorBake.js'),engine=source('src/engine/runtime/nav/bake.js'),play=source('src/engine/runtime/events/play.js')
 assert.match(ed,/import \{ bakeNavRegion as bakeRegion \} from '..\/..\/engine\/runtime\/nav\/bake.js'/)
 assert.match(engine,/export async function bakeNavRegion/)
 assert.match(play,/import \{ bakeNavRegion \} from '..\/nav\/bake.js'/)
 assert.match(play,/refreshBrushes:false, maxCells:100_000/)
})
test('NB-18 · Inspector usa las cinco llaves del registro original, no un formulario separado',()=>{
 const inspector=source('src/components/Inspector.vue')
 for(const f of ['cell','agentRadius','agentHeight','maxSlope','layers'])
   assert.match(inspector,new RegExp(`inspectorKeyable\\('navigation\\.${f}'\\)`))
})
test('NB-19 · teardown aborta async, elimina enlaces y no deja sobrescribir NavWorld siguiente',()=>{
 const play=source('src/engine/runtime/events/play-level.js')
 assert.match(play,/this\.nav\?\.dispose\?\.\(\)/)
 assert.match(play,/delete node\.userData\.navBakeRuntime/)
 assert.match(play,/delete node\.userData\.timelineNavBake/)
})

test('NB-20 · pendiente horneada controla celdas, no solo un número de Inspector',async()=>{
 const ray=(origin,dir,max)=>{
  if(dir[1]>0)return null
  const elevation=origin[0]<1 ? 0 : 1
  const distance=origin[1]-elevation
  return distance<0 || distance>max ? null : {point:[origin[0],elevation,origin[2]],normal:[0,origin[0]<1?1:.4,0],distance}
 }
 const params={cell:1,layers:1,agentRadius:0,agentHeight:1.8,stepHeight:1.1}
 const narrow=await bakeNav(bounds,{raycast:ray,params:{...params,maxSlope:35},yieldEvery:Infinity})
 const wide=await bakeNav(bounds,{raycast:ray,params:{...params,maxSlope:80},yieldEvery:Infinity})
 assert.deepEqual(Array.from(narrow.ok),[1,0]);assert.deepEqual(Array.from(wide.ok),[1,1])
})
test('NB-21 · altura del agente descarta espacio insuficiente y rehorneado pequeño lo recupera',async()=>{
 const ray=(origin,dir,max)=>{
  if(dir[1]>0)return {point:[origin[0],.8,origin[2]],normal:[0,-1,0],distance:.6}
  return {point:[origin[0],0,origin[2]],normal:[0,1,0],distance:origin[1]}
 }
 const params={cell:1,layers:1,agentRadius:0,maxSlope:45,stepHeight:.5}
 const high=await bakeNav(bounds,{raycast:ray,params:{...params,agentHeight:1.8},yieldEvery:Infinity})
 const low=await bakeNav(bounds,{raycast:ray,params:{...params,agentHeight:.3},yieldEvery:Infinity})
 assert.deepEqual(Array.from(high.ok),[0,0]);assert.deepEqual(Array.from(low.ok),[1,1])
})
test('NB-22 · número de capas cambia realmente el muestreo multicapa y densidad de NavGrid',async()=>{
 const ray=(origin,dir,max)=>{
  if(dir[1]>0)return null
  const y=origin[1] > 2 ? 2 : origin[1]>0 ? 0 : null
  if(y===null || origin[1]-y>max)return null
  return {point:[origin[0],y,origin[2]],normal:[0,1,0],distance:origin[1]-y}
 }
 const params={cell:1,agentRadius:0,agentHeight:1.8,maxSlope:45,stepHeight:.55}
 const one=await bakeNav({min:[0,-1,0],max:[1,4,1]}, {raycast:ray,params:{...params,layers:1},yieldEvery:Infinity})
 const two=await bakeNav({min:[0,-1,0],max:[1,4,1]}, {raycast:ray,params:{...params,layers:2},yieldEvery:Infinity})
 assert.equal(one.L,1);assert.deepEqual(Array.from(one.h),[2]);assert.equal(two.L,2);assert.deepEqual(Array.from(two.h),[2,0])
})
test('NB-23 · cancelación de bakeNav impide muestrear y publicar una región retirada',async()=>{
 const controller=new AbortController();controller.abort()
 let count=0
 await assert.rejects(()=>bakeNav(bounds,{params:{cell:1,layers:1},signal:controller.signal,
   raycast(){count++;return null}}),/Cancelado/)
 assert.equal(count,0)
})
