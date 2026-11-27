import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'

import { normalizedHydrology, normalizeLayers } from '../src/engine/runtime/geometry/terrain-splat.js'
import { hydrologyAt, hydrologyGrid } from '../src/engine/runtime/geometry/water-hydrology.js'

const root = resolve(import.meta.dirname, '..')
const path = (name) => resolve(root, 'src/engine/runtime/geometry/', name)
const solver = pathToFileURL(path('water-solver.js')).href
const wh = pathToFileURL(path('water-hydrology.js')).href
const worldCode = readFileSync(path('waterworld.js'), 'utf8')
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies = (objects) => objects; const riverLine = () => []')
  .replace("import { waveSet } from './water.js'", 'const waveSet = () => ({ big: [] })')
  .replace("import { WaterRegion } from './water-solver.js'", `import { WaterRegion } from '${solver}'`)
const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(worldCode)}`)
const bridgeCode = readFileSync(path('water-terrain.js'), 'utf8')
  .replace("import { groundAtAll } from './terrains.js'", 'const groundAtAll = (pieces,x,z) => { for(const t of pieces) {const h=t.groundAt(x,z);if(Number.isFinite(h))return h} return NaN }')
  .replace("import { precipMm } from '../world/atmosphere.js'", 'const precipMm = (r,s=0) => 45*r*r + 6*s*s')
  .replace("import { hydrologyGrid } from './water-hydrology.js'", `import { hydrologyGrid } from '${wh}'`)
const { TerrainWaterConnection } = await import(`data:text/javascript,${encodeURIComponent(bridgeCode)}`)

const approx=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b) <= t*Math.max(1,Math.abs(b)), `${a} vs ${b}`)
const profile=(over={})=>({infiltrationMmH:3600,capacityMm:100,initialSaturation:0,drainageMmH:0,...over})
const terrain=(layers=[profile()], weights=null)=>{
 const ls=normalizeLayers(layers.map((h,i)=>({name:`Capa ${i}`,hydrology:h})))
 return {id:'tile',version:0,ox:0,oz:0,size:4,segments:1,enabled:true,layers:ls,
   splat:Uint8Array.from(weights || [...Array(4)].flatMap(()=>[255,0,0,0,0,0,0,0])),
   groundAt(x,z){return x>=-2&&x<=2&&z>=-2&&z<=2?0:NaN}}
}
const sim=(t=terrain(),extra={})=>{
 const water=new WaterWorld()
 const config={enabled:true,hydrology:{enabled:true},regions:[{id:'soil',width:2,height:2,x:-2,z:-2,cellSize:2,initialDepth:0,boundaries:{west:'closed',east:'closed',north:'closed',south:'closed'}}],...extra}
 const con=new TerrainWaterConnection(water,config,[t],null)
 return {water,con,region:water.regions.get('soil')}
}
const volume=(r,h)=>r.depth.fill(h)

test('HYD-01: capas heredadas no adquieren hidrología implícita',()=>{
 const l=normalizeLayers([{name:'Arena',surface:'dirt'}])[0]
 assert.equal(l.hydrology,undefined)
 assert.deepEqual(normalizedHydrology(),{infiltrationMmH:0,capacityMm:0,initialSaturation:0,drainageMmH:0})
})
test('HYD-02: perfiles mantienen campos tras normalización de Terrain',()=>{
 const p=profile({capacityMm:120,initialSaturation:0.25})
 assert.deepEqual(normalizeLayers([{name:'Arena',hydrology:p}])[0].hydrology,p)
})
test('HYD-03: perfil rechaza valores no finitos, negativos y cadenas',()=>{
 for(const bad of [NaN,-1,Infinity,'10']) assert.throws(()=>normalizedHydrology({capacityMm:bad}),/capacidad|capacityMm|fuera de rango/)
})
test('HYD-04: normalización rechaza saturación fuera del intervalo',()=>{
 assert.throws(()=>normalizedHydrology({initialSaturation:1.01}),/initialSaturation/)
})
test('HYD-05: interpolación real de splat no confunde material visual con físico',()=>{
 const a=profile({infiltrationMmH:0,capacityMm:0})
 const b=profile({infiltrationMmH:400,capacityMm:200})
 const splat=Array.from({length:4},()=>[128,127,0,0,0,0,0,0]).flat()
 const h=hydrologyAt([terrain([a,b],splat)],0,0)
 approx(h.infiltrationMmH,400*127/255,1e-6)
 approx(h.capacityMm,200*127/255,1e-6)
})
test('HYD-06: sin pieza física devuelve perfil impermeable',()=>{
 assert.equal(hydrologyAt([],0,0).capacityMm,0)
})
test('HYD-07: remuestreo de atributos usa centros de celdas y m/h internos',()=>{
 const geo=hydrologyGrid({width:2,height:2,x:-2,z:-2,dx:2,dz:2},[terrain()],new Uint8Array(4).fill(1))
 approx(geo.infiltration[0],0.001)
 approx(geo.capacity[0],0.1)
})
test('HYD-08: activación es explícita y legacy conserva mismo volumen',()=>{
 const {water,region}=sim(terrain(),{hydrology:{enabled:false}})
 assert.equal(region.hydrology,null)
 assert.equal(water.snapshot().version,2)
})
test('HYD-09: infiltración retiene masa sin registrarse como drenaje',()=>{
 const {water,region}=sim()
 water.changeVolume('soil',0,0,0.04)
 water.step(1)
 assert.ok(region.hydrology.storage[0]>0)
 approx(region.ledger.drained,0)
 approx(water.liquidBalance().errorM3,0)
 approx(water.liquidBalance().surfaceM3+water.liquidBalance().soilM3,0.04)
})
test('HYD-10: impermeable no absorbe y conserva el agua superficial',()=>{
 const {water,region}=sim(terrain([profile({infiltrationMmH:0,capacityMm:0})]))
 water.changeVolume('soil',0,0,0.04)
 water.step(1)
 approx(region.storedVolume(),0)
 approx(water.liquidBalance().currentM3,0.04)
})
test('HYD-11: capilaridad limitada por la capacidad; el exceso queda en WaterRegion',()=>{
 const {water,region}=sim(terrain([profile({infiltrationMmH:10000,capacityMm:5})]))
 water.changeVolume('soil',0,0,1)
 water.step(1)
 assert.ok(region.hydrology.storage[0]<=0.005+1e-9)
 assert.ok(region.volume()>0)
 approx(water.liquidBalance().errorM3,0)
})
test('HYD-12: suelo ya saturado no infiltra más',()=>{
 const {water,region}=sim(terrain([profile({initialSaturation:1})]))
 const before=region.storedVolume()
 water.changeVolume('soil',0,0,0.4);water.step(1)
 approx(region.storedVolume(),before)
 approx(water.liquidBalance().errorM3,0)
})
test('HYD-13: infiltración respeta dt en segundos',()=>{
 const {region}=sim()
 region.queue(0,0,0.4); region.step(0.5)
 approx(region.hydrology.storage[0],0.0005)
})
test('HYD-14: almacenamiento inicial forma parte de masa inicial',()=>{
 const {water,region}=sim(terrain([profile({initialSaturation:.3})]))
 approx(region.storedVolume(),4*.1*.3*4)
 approx(water.liquidBalance().initialM3,region.storedVolume())
 approx(water.liquidBalance().errorM3,0)
})
test('HYD-15: el drenaje del suelo es salida externa, no evaporación implícita',()=>{
 const {water,region}=sim(terrain([profile({initialSaturation:1,drainageMmH:3600})]))
 water.step(1)
 assert.ok(region.hydrology.drainedVolume>0)
 approx(region.ledger.drained,region.hydrology.drainedVolume)
 approx(water.liquidBalance().externalDrainM3,region.hydrology.drainedVolume)
 approx(water.liquidBalance().errorM3,0)
})
test('HYD-16: snapshot v3 conserva estado hidráulico y rollback',()=>{
 const {water,region}=sim()
 water.changeVolume('soil',1,1,.4);water.step(.5)
 const before=water.snapshot()
 assert.equal(before.version,3)
 water.step(.5)
 water.restore(before)
 assert.deepEqual(water.snapshot(),before)
 approx(water.liquidBalance().errorM3,0)
})
test('HYD-17: snapshot inválido no muta la región',()=>{
 const {water}=sim(), good=water.snapshot()
 const bad=structuredClone(good)
 bad.regions[0].hydrology.storage[0]=-1
 assert.throws(()=>water.restore(bad),/almacenamiento inválido/)
 assert.deepEqual(water.snapshot(),good)
})
test('HYD-18: versiones 1 y 2 anteriores restauran sin romper el modelo vigente',()=>{
 const {water,region}=sim()
 const modern=water.snapshot()
 for (const version of [1,2]) {
  const old=structuredClone(modern);old.version=version
  delete old.regions[0].hydrology
  water.restore(old)
  approx(region.balanceError(),0)
 }
})
test('HYD-19: al reducir capacidad el excedente vuelve a superficie sin desaparecer',()=>{
 const {water,region}=sim(terrain([profile({initialSaturation:1})]))
 const before=region.totalVolume()
 const updated=hydrologyGrid(region,[terrain([profile({capacityMm:50,initialSaturation:0})])],region.valid)
 region.updateHydrology(updated)
 approx(region.totalVolume(),before)
 approx(region.balanceError(),0)
})
test('HYD-20: transferencias S05 conservan masa con origen y destino hidratados',()=>{
 const water=new WaterWorld()
 const sample={capacity:new Float64Array(4).fill(.1),infiltration:new Float64Array(4).fill(.001),drainage:new Float64Array(4),initial:new Float64Array(4)}
 water.addRegion({id:'a',width:2,height:2,depth:[.5,0,0,0],hydrology:sample})
 water.addRegion({id:'b',width:2,height:2,x:10,depth:[0,0,0,0],hydrology:sample})
 water.transferVolume({id:'a',col:0,row:0},{id:'b',col:0,row:0},.2,'hydro-transfer')
 water.step(.1)
 approx(water.liquidBalance().errorM3,0)
 approx(water.liquidBalance().internalTransferredM3,.2)
})
test('HYD-21: lluvia una sola vez sobre regiones con absorción',()=>{
 const w={weatherOn:true,cur:{rain:1,snow:0},precipitationAt:()=>45}
 const {water,con}=sim(terrain(),{})
 con.world=w
 con.step(1)
 approx(water.liquidBalance().externalInM3,4*4*45/3600000)
 approx(water.liquidBalance().errorM3,0)
})
test('HYD-22: cambio de perfil en Terrain permite conservar todo el inventario',()=>{
 const t=terrain([profile({initialSaturation:1})]),{water,con,region}=sim(t)
 const original=water.liquidBalance().currentM3
 t.layers=normalizeLayers([{hydrology:profile({capacityMm:0,infiltrationMmH:0})}]); t.version++
 con.step(.2)
 approx(water.liquidBalance().currentM3,original)
 approx(water.liquidBalance().errorM3,0)
 assert.equal(region.storedVolume(),0)
})
test('HYD-23: geometría inválida no introduce capacidad ni agua ficticia',()=>{
 const g=hydrologyGrid({width:2,height:2,dx:1,dz:1,x:0,z:0},[terrain()],Uint8Array.from([1,0,0,1]))
 assert.equal(g.capacity[1],0);assert.equal(g.initial[2],0)
})
test('HYD-24: escenas legadas no cambian su configuración de hidratación',()=>{
 const w=new WaterWorld()
 new TerrainWaterConnection(w,{enabled:false,regions:[]},[],null)
 assert.equal(w.regions.size,0)
})
test('HYD-25: modelo y límites de 4096 celdas están presentes',()=>{
 const s=readFileSync(new URL('../src/engine/runtime/geometry/water-terrain.js',import.meta.url),'utf8')
 assert.match(s,/4096 celdas activas/)
})
test('HYD-26: humedad shader procede de textura de regiones y no de gotas decorativas',()=>{
 const shader=readFileSync(new URL('../src/engine/runtime/render/wetlib.js',import.meta.url),'utf8')
 const scene=readFileSync(new URL('../src/engine/runtime/scene/water.js',import.meta.url),'utf8')
 assert.match(shader,/rtHydroWet/);assert.match(shader,/terrainWet/)
 assert.match(scene,/hydrology\.storage\[k\]/)
})
test('HYD-27: renderer mantiene regla histórica de charcos sin simulador físico',()=>{
 const shader=readFileSync(new URL('../src/engine/runtime/render/wetlib.js',import.meta.url),'utf8')
 assert.match(shader,/uPhysicalCount == 0 && !rtHasPhysicalWater/)
})
test('HYD-28: UI y normalización de capas conservan propiedades y commit por Terrain',()=>{
 const ui=readFileSync(new URL('../src/components/TerrainPanel.vue',import.meta.url),'utf8')
 const layers=readFileSync(new URL('../src/engine/runtime/geometry/terrain-layers.js',import.meta.url),'utf8')
 assert.match(ui,/Hidrología física en las regiones/)
 assert.match(ui,/piece\.setLayers\(normalized\)/)
 assert.match(layers,/this\.version\+\+/)
})
