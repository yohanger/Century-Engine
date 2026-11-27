// CA-005: simulación nativa de Lago/Río sin Three.js ni Jolt duplicados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'

const read = (name) => readFileSync(new URL('../src/engine/runtime/' + name, import.meta.url), 'utf8')
const solverUrl = new URL('../src/engine/runtime/geometry/water-solver.js', import.meta.url).href
const worldSrc = read('geometry/waterworld.js')
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies = (objects) => objects; const riverLine = (p) => p.points || []')
  .replace("import { waveSet } from './water.js'", 'const waveSet = () => ({ big: [] })')
  .replace("import { WaterRegion } from './water-solver.js'", `import { WaterRegion } from '${solverUrl}'`)
const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(worldSrc)}`)
const terrainSrc = read('geometry/water-terrain.js')
  .replace("import { groundAtAll } from './terrains.js'", 'const groundAtAll = (terrains, x, z) => { for (const t of terrains) { const y = t.groundAt(x,z); if (Number.isFinite(y)) return y } return NaN }')
  .replace("import { precipMm } from '../world/atmosphere.js'", 'const precipMm = (r) => 45 * r * r')
  .replace("import { hydrologyGrid } from './water-hydrology.js'", 'const hydrologyGrid = () => null')
const { nativeWaterConfiguration, TerrainWaterConnection } = await import(`data:text/javascript,${encodeURIComponent(terrainSrc)}`)
const pLake = { shape:'rect', width:12, length:8, res:1.5, waveHeight:0, flowSpeed:0, color:'#377eb8', deepColor:'#123358', clarity:6 }
const body = (id='lake', shape='rect', props={}) => ({ id, name: id, x:0, y:2, z:0, yaw:0,
  p:{ ...pLake, ...props, shape } })
const terrain = (height) => [{id:'terrain',version:0,ox:0,oz:0,enabled:true,groundAt:()=>height}]
const near = (a,b,epsilon=1e-5) => assert.ok(Math.abs(a-b)<epsilon, `${a} != ${b}`)
function native(bodies, { config=null, terrains=[], climate=null, cast=null }={}) {
  const water = new WaterWorld(bodies)
  const cfg = nativeWaterConfiguration(water, config)
  const conn = cfg ? new TerrainWaterConnection(water, cfg, terrains, climate, cast) : null
  return { water, cfg, conn }
}

test('NW-01: Lago crea región nativa sin interruptor ni configuración de escena', () => {
  const {water,cfg,conn} = native([body()])
  assert.equal(cfg.enabled,true); assert.equal(cfg.regions.length,1)
  const r=conn.entries[0].region
  assert.ok(r.valid.some(Boolean)); assert.ok(r.totalVolume()>0)
  assert.equal(water.at(0,0).id,'lake'); assert.equal(water.at(0,0).name,'lake')
  assert.equal(water.bodies[0].coupledRegion,r.id)
  near(water.at(0,0).surface,2)
  near(water.liquidBalance().errorM3,0)
})

test('NW-02: el río conserva su huella de cauce y dirección física de corriente', () => {
  const river = body('river','river',{points:[[-10,0,0],[0,0,0],[10,0,0]],riverWidth:4,flowSpeed:0.7})
  const {water,conn} = native([river]); const r=conn.entries[0].region
  assert.ok(r.valid.some(Boolean)); assert.ok(r.valid.some(v=>!v), 'fuera del cauce no hay líquido')
  near(water.at(0,0).flowX,0.7,0.001)
  assert.equal(water.at(0,5),null)
  assert.ok(!r.valid.every(Boolean))
})

test('NW-03: el terreno delimita profundidad y no se simula sobre suelo más alto', () => {
  const {water,conn} = native([body()],{terrains:terrain(1.3)})
  near(water.at(0,0).surface,2)
  assert.ok(water.at(0,0).depth>0)
  const blocked=native([body()],{terrains:terrain(3)})
  assert.equal(blocked.water.at(0,0),null)
  assert.equal(blocked.conn.entries[0].region.totalVolume(),0)
})

test('NW-04: una región manual solapada se asocia a un solo Lago y evita duplicados', () => {
  const {water,conn,cfg} = native([body('lago')],{config:{enabled:true,regions:[{id:'agua-terreno',x:-3,z:-3,width:6,height:6,initialDepth:0.6}]},terrains:terrain(0)})
  assert.equal(cfg.regions.length,1)
  assert.equal(water.bodies[0].coupledRegion,'agua-terreno')
  assert.equal(water.regions.size,1)
  near(conn.entries[0].region.volume(),21.6)
})

test('NW-05: varios nodos reclamando la misma región manual se bloquean', () => {
  const two=[body('lago1'),body('lago2')]
  assert.throws(()=>native(two,{config:{enabled:true,regions:[{id:'misma',x:-3,z:-3,width:6,height:6,initialDepth:1}]}}),/ambigua/)
})

test('NW-06: océano permanece fuera del solver nativo integral de Lago/Río', () => {
  const {water,cfg} = native([body('ocean','ocean',{size:4000})])
  assert.equal(cfg,null)
  assert.equal(water.regions.size,0)
  assert.equal(water.at(0,0).id,'ocean')
})

test('NW-07: río y Lago respetan el límite global de 4096 celdas', () => {
  const {cfg,conn}=native([body('large','rect',{width:650,length:900,res:0.5})])
  const cells=cfg.regions.reduce((n,r)=>n+r.width*r.height,0)
  assert.ok(cells<=4096 && cells>=4)
  assert.ok(conn.entries[0].region.valid.some(Boolean))
})

test('NW-08: la salpicadura cambia momento, no volumen, y sigue el solver', () => {
  const {water}=native([body()])
  const r=[...water.regions.values()][0], before=water.liquidBalance().currentM3
  assert.equal(water.disturb(0,0,0.8,1.5),true)
  assert.ok(r.qx.some(v=>Math.abs(v)>0) || r.qz.some(v=>Math.abs(v)>0))
  near(water.liquidBalance().currentM3,before)
  for(let i=0;i<8;i++) water.step(1/60)
  near(water.liquidBalance().currentM3,before,1e-3)
  near(water.liquidBalance().errorM3,0,1e-3)
})

test('NW-09: impulso de agua fuera del dominio no altera inventario', () => {
  const {water}=native([body()]); const snapshot=water.snapshot()
  assert.equal(water.disturb(200,200,1,1),false)
  assert.deepEqual(water.snapshot(),snapshot)
})

test('NW-10: lluvia alimenta volumen físico y mantiene balance', () => {
  const weather={weatherOn:true,cur:{rain:1,snow:0},precipitationAt:()=>45}
  const {water,conn}=native([body()],{climate:weather})
  const before=water.liquidBalance().currentM3
  conn.step(0.1)
  assert.ok(water.liquidBalance().currentM3>before)
  near(water.liquidBalance().errorM3,0,1e-4)
})

test('NW-11: una barrera Jolt estática bloquea caras del solver nativo', () => {
  const cast=(_o,d)=>d[0]===1
  const {conn}=native([body()],{cast})
  const r=conn.entries[0].region
  assert.ok(r.blockX.some(Boolean))
  assert.ok(!r.blockZ.some(Boolean))
})

test('NW-12: cuerpo Jolt ocupa espacio sin incrementar masa de agua', () => {
  const {water}=native([body()]);const before=water.liquidBalance().currentM3
  water.setDisplacements([{kind:'sphere',center:[0,1.8,0],size:[1,1,1]}])
  const r=[...water.regions.values()][0]
  assert.ok(r.occupied.some(x=>x>0))
  near(water.liquidBalance().currentM3,before)
  water.step(1/60)
  near(water.liquidBalance().errorM3,0,1e-4)
})

test('NW-13: un snapshot restaura la perturbación y el volumen', () => {
  const {water}=native([body()]);water.disturb(0,0,1,2);water.step(1/60)
  const before=water.snapshot();water.step(1/60);water.restore(before)
  assert.deepEqual(water.snapshot(),before)
})

test('NW-14: geometría del río se rehace al cambiar Terrain sin borrar volumen',()=>{
  const t=terrain(0)[0], {water,conn}=native([body('river','river',{points:[[-8,0,0],[8,0,0]],riverWidth:4})],{terrains:[t]})
  const before=water.liquidBalance().currentM3
  t.version++; t.groundAt=()=>0.5
  conn.step(1/60)
  near(water.liquidBalance().currentM3,before,1e-3)
  near(water.liquidBalance().errorM3,0,1e-3)
})

test('NW-15: no se acepta configuración de 4097 celdas manuales',()=>{
  assert.throws(()=>native([body()],{config:{enabled:true,regions:[{id:'excesiva',x:0,z:0,width:65,height:65}]}}),/4096/)
})

test('NW-16: selector de clima/lago/Player comparte los mismos métodos sin duplicar renderizador',()=>{
  const play=read('events/play.js'), scene=read('scene/water.js')
  assert.match(play,/nativeWaterConfiguration\(this\.water/)
  assert.match(scene,/nativeWaterConfiguration\(water, config, this\.terrains\)/)
  assert.match(play,/ed\.showPhysicalWater\(this\.water\)/)
  const controls=read('events/play-controls.js')
  assert.match(controls,/this\._waterConnection\?\.step\(fdt\)/m)
})

test('NW-17: región autoral unida a Lago conserva volumen y usa identidad visual del nodo', () => {
  const {water,cfg,conn}=native([body('lago','rect',{color:'#82bbdc'})], {
    config:{enabled:true,regions:[{id:'agua-terreno',x:-3,z:-3,width:6,height:6,initialDepth:0.6}]},
    terrains:terrain(0),
  })
  assert.equal(cfg.regions[0].visualBodyId,'lago')
  assert.equal(conn.entries[0].region.bodyId,'lago')
  assert.equal(water.at(0,0).id,'lago')
  near(water.liquidBalance().currentM3,21.6)
})

test('NW-18: Editor/Play no duplican WaterWorld ni el render de regiones', () => {
  const world=read('geometry/waterworld.js'), scene=read('scene/water.js'), play=read('events/play.js')
  const surface=read('geometry/water-surface.js')
  assert.match(scene,/new WaterSurfaceView\(this\.vp\.world, water\)/)
  assert.match(play,/ed\._activeWaterWorld = this\.water/)
  assert.match(scene,/this\.showPhysicalWater\(water\)/)
  assert.match(surface,/region\.qx\[k\]/)
  assert.match(surface,/rtSimFoam/)
  assert.match(world,/const physical=region\.sample\(x,z\)/)
})

test('NW-19: río largo con presupuesto acotado monta región sin exceder memoria', (t) => {
  const points=Array.from({length:1201},(_,i)=>[i-600,0,3*Math.sin(i*0.015)])
  const start=performance.now()
  const {water,cfg}=native([body('large-river','river',{points,riverWidth:12,flowSpeed:0.6})])
  const elapsed=performance.now()-start
  t.diagnostic(`Geometría 2.5D: ${cfg.regions[0].width*cfg.regions[0].height} celdas, ${elapsed.toFixed(1)} ms en este entorno; no extrapolable a N5030`)
  assert.ok(cfg.regions[0].width*cfg.regions[0].height<=4096)
  assert.ok(water.regions.size===1)
})

test('NW-20: shader simulado consume atributos del solver y no desplaza la malla con olas ficticias', () => {
  const shader = read('geometry/watershader.js')
    .replace(/^import .*$/gm,'')
    .replace(/\bexport /g,'')
  const { patchWaterMaterial } = Function('THREE','RIPPLE_GLSL','RIPPLES','waveSet', `${shader}; return {patchWaterMaterial}`)(
    {},'',[],()=>({big:[],fine:[]}))
  const mat={userData:{}}, uniforms={}
  patchWaterMaterial(mat,uniforms,{simulated:true})
  const sh={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',
    fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_begin>'}
  mat.onBeforeCompile(sh)
  assert.match(sh.vertexShader,/attribute float rtSimFoam;/)
  assert.match(sh.vertexShader,/rtSimFoamV = rtSimFoam;/)
  assert.match(sh.fragmentShader,/rtF = max\(rtF, rtSimFoamV/)
  assert.match(sh.fragmentShader,/cross\(dFdx\(rtWPos\), dFdy\(rtWPos\)\)/)
  assert.match(sh.vertexShader,/transformed\.y \+= 0\.0/)
  assert.equal(mat.customProgramCacheKey(),'lfwater-sim')
})

test('NW-21: shader de océano legado conserva su variante sin contaminación del solver', () => {
  const shader = read('geometry/watershader.js').replace(/^import .*$/gm,'').replace(/\bexport /g,'')
  const {patchWaterMaterial}=Function('THREE','RIPPLE_GLSL','RIPPLES','waveSet',`${shader}; return {patchWaterMaterial}`)(
    {},'',[],()=>({big:[],fine:[]}))
  const mat={userData:{}}
  patchWaterMaterial(mat,{},{simulated:false})
  const sh={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',
    fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_begin>'}
  mat.onBeforeCompile(sh)
  assert.doesNotMatch(sh.vertexShader,/attribute float rtSimFoam;/)
  assert.match(sh.vertexShader,/transformed\.y \+= rtH \*/)
  assert.equal(mat.customProgramCacheKey(),'lfwater')
})


test('NW-22: orilla con suelo a 5 mm no inventa 10 cm de agua', () => {
  const {water}=native([body()],{terrains:terrain(1.995)})
  const sample=water.at(0,0)
  assert.ok(sample?.depth>0 && sample.depth<0.006, `Profundidad ${sample?.depth}`)
  near(water.liquidBalance().errorM3,0)
})
