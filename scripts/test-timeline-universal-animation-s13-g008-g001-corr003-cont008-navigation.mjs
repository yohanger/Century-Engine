import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NavGrid } from '../src/engine/runtime/nav/grid.js'
import { navCache, NavWorld } from '../src/engine/runtime/nav/world.js'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'

const source = file => readFileSync(new URL('../'+file,import.meta.url),'utf8')
const code = source('src/engine/runtime/nodes/navigation.js')
  .replace(/^import .*$/gm,'').replace(/^export const navBounds\s*=/m,'const navBounds =')
  .replace('export default registerNode(', 'const definition = registerNode(')
const defaults={cell:1,agentRadius:0,agentHeight:1.8,maxSlope:45,stepHeight:.55,layers:1}
const owner=Function('registerNode','THREE','makeRoot','applyBase','lineMat','hitSphere','unitGeometry','NAV_DEFAULTS','navCache',
  `${code}\nreturn definition`)(registerNode,{},()=>{},()=>{},()=>{},()=>{},()=>{},defaults,navCache)
const node=(id='navigation-1',asset='nav-A')=>({id,type:'navigation',active:true,visible:true,
  props:{...defaults,asset},position:[0,0,0],scale:[4,2,2],color:'#2fd3ff'})
const makeGrid=()=>new NavGrid({cell:1,x0:0,z0:0,nx:2,nz:1,L:1,h:new Float32Array([0,.8]),ok:new Uint8Array([1,1]),step:.55,
  agentRadius:0,agentHeight:1.8,maxSlope:45})
const from=[.5,0,.5],to=[1.5,.8,.5]
const fixture=()=>{
  const grid=makeGrid(),o=node(),root={userData:{}}
  navCache.set('nav-A',grid)
  const nav=new NavWorld([{id:o.id,name:'Región A',grid,node:root}])
  return {grid,o,root,nav}
}

test('NAV-01 · registro único, lectura tipada y llave junto a Escalón máx.',()=>{
  const f=fixture()
  assert.ok(getDef('navigation')?.animation['navigation.stepHeight'])
  assert.equal(nodeAnimationProperty(f.o,'navigation.stepHeight').read(f.o),.55)
  assert.match(source('src/components/Inspector.vue'),/inspectorKeyable\('navigation\.stepHeight'\)/)
  assert.match(source('src/engine/runtime/events/play.js'),/node: ed\.nodes\.get\(o\.id\)/)
})
test('NAV-02 · no anunciar llave si no hay mapa horneado cargado',()=>{
  const f=fixture()
  assert.equal(nodeAnimationProperty(node('empty',''),'navigation.stepHeight'),null)
  assert.equal(nodeAnimationProperty(node('missing','missing-asset'),'navigation.stepHeight'),null)
  assert.ok(nodeAnimationProperty(f.o,'navigation.stepHeight'))
})
test('NAV-03 · tipos/rangos y keyframes persistidos sin mutar el proyecto',()=>{
  const f=fixture(),before=structuredClone(f.o)
  const tl=newTimeline('Rutas',{duration:5})
  upsertTimelineNodePropertyKey(tl,f.o,'navigation.stepHeight','scene-A',[f.o],0,.55)
  upsertTimelineNodePropertyKey(tl,f.o,'navigation.stepHeight','scene-A',[f.o],2,1.2)
  assert.deepEqual(normalizeTimeline(JSON.parse(JSON.stringify(tl))).tracks[0].keys.map(k=>k.v),[.55,1.2])
  assert.deepEqual(f.o,before)
  assert.throws(()=>validatePropertyValue('navigation.stepHeight',-1))
  assert.throws(()=>validatePropertyValue('navigation.stepHeight',3.1))
})
test('NAV-04 · pathfinding real admite/desconecta escalones sin regenerar NavGrid',()=>{
  const f=fixture(),spec=nodeAnimationProperty(f.o,'navigation.stepHeight')
  assert.equal(f.nav.canWalk(from,to),false)
  const snapshot=spec.capture(f.root,f.o)
  spec.apply(f.root,1.1,f.o)
  assert.equal(f.nav.canWalk(from,to),true)
  assert.equal(f.grid.step,.55)
  assert.strictEqual(f.nav.gridAt(.5,.5).ok,f.grid.ok)
  spec.restore(f.root,snapshot,f.o)
  assert.equal(f.nav.canWalk(from,to),false)
  assert.strictEqual(f.nav.gridAt(.5,.5),f.grid)
})
test('NAV-05 · dos regiones usan el mismo recurso sin compartir overrides',()=>{
  const f=fixture(),another={userData:{}}
  const nav2=new NavWorld([{id:'navigation-2',name:'Región B',grid:f.grid,node:another}])
  const spec=nodeAnimationProperty(f.o,'navigation.stepHeight')
  spec.apply(f.root,1.2,f.o)
  assert.equal(f.nav.canWalk(from,to),true)
  assert.equal(nav2.canWalk(from,to),false)
  assert.equal(f.grid.step,.55)
})
test('NAV-06 · el valor temporal autoral previo se restaura sin tocar arrays ni cache',()=>{
  const f=fixture(),spec=nodeAnimationProperty(f.o,'navigation.stepHeight')
  f.root.userData.timelineNavStepHeight=.65
  const saved=spec.capture(f.root,f.o)
  spec.apply(f.root,2.5,f.o)
  spec.restore(f.root,saved,f.o)
  assert.equal(f.root.userData.timelineNavStepHeight,.65)
  assert.equal(navCache.get('nav-A').step,.55)
  assert.equal(f.o.props.stepHeight,.55)
})
test('NAV-07 · STOP limpia el override y vuelve al grid original incluso sin siguiente frame',()=>{
  const f=fixture(),spec=nodeAnimationProperty(f.o,'navigation.stepHeight')
  const saved=spec.capture(f.root,f.o)
  spec.apply(f.root,1,f.o)
  assert.equal(f.nav.canWalk(from,to),true)
  spec.restore(f.root,saved,f.o)
  assert.equal(f.nav.canWalk(from,to),false)
  assert.equal(Object.hasOwn(f.root.userData,'timelineNavStepHeight'),false)
})
test('NAV-08 · las celdas erodidas en Bake NO reaparecen por cambiar escalón (limitación real)',()=>{
  const f=fixture(),spec=nodeAnimationProperty(f.o,'navigation.stepHeight')
  f.grid.ok[1]=0
  spec.apply(f.root,3,f.o)
  assert.equal(f.nav.canWalk(from,to),false)
  assert.equal(f.grid.ok[1],0)
})
test('NAV-09 · el descriptor no altera propiedades de horneado, Assets ni estado de navegación global',()=>{
  const f=fixture(),before=structuredClone(f.o)
  const spec=nodeAnimationProperty(f.o,'navigation.stepHeight')
  spec.apply(f.root,1.5,f.o)
  for(const k of ['cell','agentRadius','agentHeight','maxSlope','layers'])
    assert.ok(nodeAnimationProperty(f.o,`navigation.${k}`),`Canal de bake ausente: ${k}`)
  assert.deepEqual(f.o,before)
  assert.equal(navCache.get('nav-A'),f.grid)
})
test('NAV-10 · selección por región, sin confundir dos nodos que apuntan al mismo NavGrid',()=>{
  const f=fixture(),left={userData:{timelineNavStepHeight:1.4}},right={userData:{}}
  const nav=new NavWorld([{id:'left',grid:f.grid,node:left},{id:'right',grid:f.grid,node:right}])
  assert.equal(nav.gridAt(.5,.5).step,1.4)
  assert.equal(nav.regions[1].grid.step,.55)
})

test('NAV-11 · A* del Player cambia realmente de ruta sin recocinar ni duplicar el grid',()=>{
  const f=fixture(),spec=nodeAnimationProperty(f.o,'navigation.stepHeight')
  const options={smooth:false,allowPartial:false,snap:2}
  assert.equal(f.nav.path(from,to,options),null)
  const snap=spec.capture(f.root,f.o)
  spec.apply(f.root,1.1,f.o)
  const route=f.nav.path(from,to,options)
  assert.ok(route && !route.partial)
  assert.equal(route.points.length,2)
  assert.equal(route.length,1)
  spec.restore(f.root,snap,f.o)
  assert.equal(f.nav.path(from,to,options),null)
  assert.equal(f.grid.step,.55)
})
