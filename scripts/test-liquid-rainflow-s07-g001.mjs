// S07 — balance físico y vínculo de precipitación sobre mallas estáticas.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'
import { normalizeMaterial, normalizedRunoff } from '../src/engine/runtime/render/material-resource.js'
const root = resolve(import.meta.dirname, '..')
const path = (f) => resolve(root, 'src/engine/runtime/geometry/', f)
const solver = pathToFileURL(path('water-solver.js')).href
const wh = pathToFileURL(path('water-hydrology.js')).href
const worldCode = readFileSync(path('waterworld.js'), 'utf8')
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies = (x) => x; const riverLine = () => []')
  .replace("import { waveSet } from './water.js'", 'const waveSet = () => ({ big: [] })')
  .replace("import { WaterRegion } from './water-solver.js'", `import { WaterRegion } from '${solver}'`)
const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(worldCode)}`)
const bridgeCode = readFileSync(path('water-terrain.js'), 'utf8')
  .replace("import { groundAtAll } from './terrains.js'", 'const groundAtAll = (pieces,x,z) => { for(const t of pieces){ const h=t.groundAt(x,z); if(Number.isFinite(h)) return h } return NaN }')
  .replace("import { precipMm } from '../world/atmosphere.js'", 'const precipMm = (r,s=0) => 45*r*r + 6*s*s')
  .replace("import { hydrologyGrid } from './water-hydrology.js'", `import { hydrologyGrid } from '${wh}'`)
const { TerrainWaterConnection } = await import(`data:text/javascript,${encodeURIComponent(bridgeCode)}`)
const near = (a,b,t=1e-7) => assert.ok(Math.abs(a-b) <= t * Math.max(1,Math.abs(b)), `${a} != ${b}`)
function world() {
  const water = new WaterWorld()
  const region = water.addRegion({id:'ground',width:4,height:4,x:0,z:0,cellSize:1,boundaries:{west:'closed',east:'closed',north:'closed',south:'closed'}})
  return {water,region}
}
function sheet(roof=[5,6], config={}) {
  return Array.from({length:16}, (_,k) => roof.includes(k) ? {
    owner:'techo',height:k === 5 ? 3 : 2,retentionMm:0,runoffMps:20,...config} : null)
}
const terrain = {id:'land',version:0,ox:0,oz:0,enabled:true,groundAt(x,z){return x >= 0 && x < 4 && z >= 0 && z < 4 ? 0 : NaN}}
const climate = {weatherOn:true,cur:{rain:1,snow:0},precipitationAt(){return 45}}
const setup = (roof=true, extra={}) => {
  const water=new WaterWorld()
  const cfg={enabled:true,runoff:{enabled:true},regions:[{id:'ground',width:4,height:4,x:0,z:0,cellSize:1}],...extra}
  const cast=(from,dir)=>dir[1] === 1 && from[0] < 2 && from[2] < 2
  const sampler=roof ? (from,to)=>from[0] < 2 && from[2] < 2 ? {ownerId:'techo',point:[from[0],3,from[2]],normal:[0,1,0],materialId:'zinc',runoff:{enabled:true,retentionMm:0,runoffMps:10}} : null : ()=>null
  const conn=new TerrainWaterConnection(water,cfg,[terrain],climate,cast,sampler,()=> 'initial')
  return {water,conn}
}

test('RF-01: material heredado no participa ni cambia propiedades',()=>{
  const mat=normalizeMaterial({id:'z',name:'Zinc',mat:{shader:'builtin:blockout',params:{uTile:2}}})
  assert.equal(mat.mat.runoff,undefined)
  assert.equal(mat.mat.params.uTile,2)
  assert.equal(normalizedRunoff().enabled,false)
})
test('RF-02: recurso compartido conserva contrato hidráulico y otros datos',()=>{
  const m=normalizeMaterial({id:'z',mat:{physical:{clearcoat:0.5},runoff:{enabled:true,retentionMm:8,runoffMps:3}}})
  assert.deepEqual(m.mat.runoff,{enabled:true,retentionMm:8,runoffMps:3})
  assert.equal(m.mat.physical.clearcoat,0.5)
})
test('RF-03: errores físicos nunca habilitan perfiles inválidos',()=>{
  for(const raw of [{enabled:true,retentionMm:-1},{enabled:true,runoffMps:Infinity},{enabled:true,runoffMps:'10'},{enabled:1},{enabled:true,retentionMm:1001}])
    assert.throws(()=>normalizedRunoff(raw),/inválido/)
})
test('RF-04: habilitar S07 es explícito y snapshot heredado no cambia',()=>{
  const w=new WaterWorld();w.addRegion({id:'ground',width:4,height:4})
  assert.equal(w.snapshot().version,2);assert.equal(w.runoff.size,0)
})
test('RF-05: geometría alineada con región y validación atómica',()=>{
  const {water}=world(), before=water.snapshot()
  assert.throws(()=>water.setRunoff('ground',[{}]),/celdas incompatibles/)
  assert.deepEqual(water.snapshot(),before)
  water.setRunoff('ground',sheet())
  assert.equal(water.runoffCell('ground',1,1).owner,'techo')
  assert.equal(water.snapshot().version,4)
})
test('RF-06: solo superficie sobre relieve válida',()=>{
  const {water}=world()
  assert.throws(()=>water.setRunoff('ground',sheet([5],{height:-1})),/superficie inválida/)
  assert.throws(()=>water.setRunoff('ground',sheet([5],{retentionMm:NaN})),/superficie inválida/)
})
test('RF-07: lluvia en tejado se cuenta una sola vez, no en suelo cubierto',()=>{
  const {water,conn}=setup()
  conn.step(1/60)
  const r=water.regions.get('ground'), f=water.runoff.get('ground')
  const a=45/3600000/60
  near(f.ledger.rain,4*a)
  assert.ok(r.ledger.added >= 12*a && r.ledger.added < 16*a, "El solver también recibe escurrimiento en este paso")
  near(water.liquidBalance().externalInM3,16*a,1e-10)
  near(water.liquidBalance().errorM3,0,1e-10)
})
test('RF-08: techo sin perfil hidráulico sigue cubriendo suelo, sin lluvia duplicada',()=>{
  const {water,conn}=setup(false)
  conn.step(1/60)
  const a=45/3600000/60
  near(water.regions.get('ground').ledger.added,12*a)
  near(water.liquidBalance().externalInM3,12*a)
})
test('RF-09: flujo desciende a la celda contigua y acaba en la región física',()=>{
  const {water,region}=world()
  water.setRunoff('ground',sheet())
  water.rainOnRunoff('ground',1,1,0.04)
  water.step(0.05)
  near(water.runoffCell('ground',1,1).volumeM3,0)
  near(water.runoffCell('ground',2,1).volumeM3,0.04)
  near(region.volume(),0)
  water.step(0.05)
  near(water.runoffCell('ground',2,1).volumeM3,0)
  near(region.volume(),0.04)
  near(water.liquidBalance().errorM3,0)
})
test('RF-10: retención guarda agua sin sacarla de WaterWorld',()=>{
  const {water,region}=world();water.setRunoff('ground',sheet([5],{retentionMm:10}))
  water.rainOnRunoff('ground',1,1,0.009);water.step(0.05)
  near(water.runoffCell('ground',1,1).volumeM3,0.009)
  near(region.volume(),0)
  near(water.liquidBalance().currentM3,0.009)
  near(water.liquidBalance().errorM3,0)
})
test('RF-11: velocidad 0 retiene toda la película finita',()=>{
  const {water}=world();water.setRunoff('ground',sheet([5],{runoffMps:0}))
  water.rainOnRunoff('ground',1,1,0.02);water.step(0.1)
  near(water.runoffCell('ground',1,1).volumeM3,0.02)
})
test('RF-12: entrada negativa o no finita se rechaza sin mutar snapshot',()=>{
  const {water}=world();water.setRunoff('ground',sheet())
  const before=water.snapshot()
  for(const v of [-0.1,Infinity,NaN]) assert.throws(()=>water.rainOnRunoff('ground',1,1,v))
  assert.deepEqual(water.snapshot(),before)
})
test('RF-13: snapshot v4 restaura película, ledger y colas',()=>{
  const {water}=world();water.setRunoff('ground',sheet())
  water.rainOnRunoff('ground',1,1,0.02);water.step(0.01)
  const snap=water.snapshot();water.step(0.01)
  water.restore(snap)
  assert.deepEqual(water.snapshot(),snap)
})
test('RF-14: snapshot v4 corrupto no modifica física ni balances',()=>{
  const {water}=world();water.setRunoff('ground',sheet())
  const before=water.snapshot(), bad=structuredClone(before)
  bad.runoff[0].stored[5]=-1
  assert.throws(()=>water.restore(bad),/snapshot incompatible/)
  assert.deepEqual(water.snapshot(),before)
})
test('RF-15: snapshot heredado v2 inicia película seca',()=>{
  const {water}=world();const old=water.snapshot()
  water.setRunoff('ground',sheet())
  water.rainOnRunoff('ground',1,1,0.02);water.step(0.01)
  water.restore(old)
  near(water.runoffCell('ground',1,1).volumeM3,0)
  near(water.liquidBalance().errorM3,0)
})
test('RF-16: quitar cubierta redistribuye agua almacenada sin perder masa',()=>{
  const {water,region}=world();water.setRunoff('ground',sheet([5],{runoffMps:0}))
  water.rainOnRunoff('ground',1,1,0.03);water.step(0.01)
  water.setRunoff('ground',Array(16).fill(null));water.step(0.01)
  near(region.volume(),0.03)
  near(water.liquidBalance().errorM3,0)
})
test('RF-17: cambio de material en el mismo objeto conserva agua',()=>{
  const {water}=world();water.setRunoff('ground',sheet([5],{runoffMps:0}))
  water.rainOnRunoff('ground',1,1,0.01);water.step(0.01)
  water.setRunoff('ground',sheet([5],{runoffMps:20,materialId:'nuevo'}))
  near(water.runoffCell('ground',1,1).volumeM3,0.01)
})
test('RF-18: rollback total de película cuando el solver rechaza el paso',()=>{
  const {water}=world();water.setRunoff('ground',sheet())
  water.rainOnRunoff('ground',1,1,0.1)
  const snap=water.snapshot()
  const r=water.regions.get('ground'), original=r.step
  r.step=()=>{throw new Error('solver forzado')}
  assert.throws(()=>water.step(0.01),/solver forzado/)
  r.step=original
  assert.deepEqual(water.snapshot(),snap)
})
test('RF-19: componentes y controles S07 conectan escena y material sin otro gestor',()=>{
  const from=(p)=>readFileSync(resolve(root,p),'utf8')
  assert.match(from('src/engine/runtime/events/play.js'),/ed\.rainImpact\(from, to\)/)
  assert.match(from('src/engine/runtime/scene/water.js'),/roadSlotMaterial/)
  assert.match(from('src/components/TerrainPanel.vue'),/Escurrimiento sobre geometría 3D estática/)
  assert.match(from('src/components/MaterialSection.vue'),/Retención \(mm\)/)
  assert.doesNotMatch(from('src/engine/runtime/world/rain-impact.js'),/changeVolume|rainOnRunoff/)
})
test('RF-20: límite externo registra salida y no la vuelve a añadir al suelo',()=>{
  const {water,region}=world();water.setRunoff('ground',sheet([0],{runoffMps:20,height:2}))
  water.rainOnRunoff('ground',0,0,0.02);water.step(0.1)
  near(region.volume(),0);near(water.liquidBalance().openBoundaryOutM3,0.02)
  near(water.liquidBalance().currentM3,0);near(water.liquidBalance().errorM3,0)
})
test('RF-21: superficie superior sin Jolt aún tapa suelo y no genera agua en la región',()=>{
  const w=new WaterWorld(), cfg={enabled:true,runoff:{enabled:true},regions:[{id:'ground',width:4,height:4,x:0,z:0,cellSize:1}]}
  const visible=(a)=>a[0] < 2 && a[2] < 2 ? {ownerId:'techo',point:[a[0],3,a[2]],normal:[0,1,0],runoff:null} : null
  const c=new TerrainWaterConnection(w,cfg,[terrain],climate,()=>false,visible)
  c.step(1/60)
  near(w.regions.get('ground').ledger.added,12*45/3600000/60,1e-11)
})
test('RF-22: cambios de topología redistribuyen agua y permiten continuar lloviendo',()=>{
  const {water}=world();water.setRunoff('ground',sheet([5],{runoffMps:0}))
  water.rainOnRunoff('ground',1,1,0.01);water.step(0.05)
  water.setRunoff('ground',sheet([6],{runoffMps:0}))
  water.rainOnRunoff('ground',2,1,0.03);water.step(0.05)
  near(water.liquidBalance().currentM3,0.04);near(water.liquidBalance().errorM3,0)
})
test('RF-23: una cubierta deshabilitada no crea snapshots v4 innecesarios',()=>{
  const {water}=setup(false)
  assert.equal(water.runoff.size,0);assert.equal(water.snapshot().version,2)
})
test('RF-24: entrada en película sin volumen finito es rechazada de manera atómica',()=>{
  const {water}=world();water.setRunoff('ground',sheet())
  const film=water.runoff.get('ground');film.pending[5]=Number.MAX_VALUE
  assert.throws(()=>water.rainOnRunoff('ground',1,1,Number.MAX_VALUE),/no finita/)
  assert.equal(film.pending[5],Number.MAX_VALUE)
})
test('RF-25: snapshots sin firmas de superficie o con ledgers contradictorios se rechazan',()=>{
  const {water}=world();water.setRunoff('ground',sheet())
  water.rainOnRunoff('ground',1,1,0.01);water.step(0.01)
  const good=water.snapshot(), bad=structuredClone(good)
  bad.runoff[0].signature='otra geometría'
  assert.throws(()=>water.restore(bad),/snapshot incompatible/)
  bad.runoff[0].signature=good.runoff[0].signature;bad.runoff[0].ledger.rain+=2
  assert.throws(()=>water.restore(bad),/balance del snapshot/)
  assert.deepEqual(water.snapshot(),good)
})
test('RF-26: depresión interior de cubierta no descarga atravesando su material',()=>{
  const {water,region}=world()
  const roof=Array.from({length:16},(_,k)=>({owner:'azotea',height:k===5?1:4,retentionMm:0,runoffMps:20}))
  water.setRunoff('ground',roof)
  water.rainOnRunoff('ground',1,1,0.04);water.step(0.1)
  near(water.runoffCell('ground',1,1).volumeM3,0.04)
  near(region.volume(),0)
  near(water.liquidBalance().errorM3,0)
})
test('RF-27: película de dos regiones mantiene balance global y dominios separados',()=>{
  const water=new WaterWorld()
  water.addRegion({id:'r1',x:0,z:0,width:4,height:4})
  water.addRegion({id:'r2',x:5,z:0,width:4,height:4})
  water.setRunoff('r1',sheet([5],{runoffMps:0}))
  water.setRunoff('r2',sheet([5],{runoffMps:0}))
  water.rainOnRunoff('r1',1,1,0.02)
  water.rainOnRunoff('r2',1,1,0.03)
  water.step(0.05)
  near(water.liquidDomain('r1').volumeM3,0.02)
  near(water.liquidDomain('r2').volumeM3,0.03)
  near(water.liquidBalance().currentM3,0.05)
  near(water.liquidBalance().errorM3,0)
})
test('RF-28: cubierta eliminada sobre celda de terreno inválida devuelve su agua a celda válida',()=>{
  const {water,region}=world()
  water.setRunoff('ground',sheet([5],{runoffMps:0}))
  water.rainOnRunoff('ground',1,1,0.02);water.step(0.05)
  const valid=Uint8Array.from(region.valid)
  valid[5]=0
  const bed=Array.from(region.bed)
  region.replaceTerrain({bed,valid,blockX:region.blockX,blockZ:region.blockZ})
  water.setRunoff('ground',Array(16).fill(null))
  water.step(0.05)
  near(water.liquidBalance().currentM3,0.02)
  near(water.liquidBalance().errorM3,0)
})
test('RF-29: desaparición de todo el suelo contabiliza la salida del líquido',()=>{
  const {water,region}=world()
  water.setRunoff('ground',sheet([5],{runoffMps:0}))
  water.rainOnRunoff('ground',1,1,0.02);water.step(0.05)
  const valid=Array(16).fill(0)
  region.replaceTerrain({bed:Array.from(region.bed),valid,blockX:region.blockX,blockZ:region.blockZ})
  water.setRunoff('ground',Array(16).fill(null))
  water.step(0.05)
  near(water.liquidBalance().currentM3,0)
  near(water.liquidBalance().openBoundaryOutM3,0.02)
  near(water.liquidBalance().errorM3,0)
})
