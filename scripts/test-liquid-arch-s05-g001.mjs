// S05 — transferencia real entre las WaterRegion existentes, sin Three.js ni Jolt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'

const src = readFileSync(new URL('../src/engine/runtime/geometry/waterworld.js', import.meta.url), 'utf8')
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies = (x) => x; const riverLine = () => []')
  .replace("import { waveSet } from './water.js'", 'const waveSet = () => ({ big: [] })')
  .replace("import { WaterRegion } from './water-solver.js'", `import { WaterRegion } from '${new URL('../src/engine/runtime/geometry/water-solver.js', import.meta.url).href}'`)
const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(src)}`)
const near = (a,b,eps=1e-7) => assert.ok(Math.abs(a-b) <= eps, `${a} ≠ ${b}`)
function setup(initial=3, two=true) {
  const w = new WaterWorld()
  const a = w.addRegion({id:'a',x:0,z:0,width:4,height:4,depth:Array(16).fill(initial),cellSize:1})
  const b = two ? w.addRegion({id:'b',x:5,z:0,width:4,height:4}) : null
  return {w,a,b,from:{id:'a',col:1,row:1},to:{id:'b',col:1,row:1}}
}

test('LQ-01: identidad agua única y densidad explicitada, sin instanciar fluidos ajenos',()=> {
  const {w,a}=setup()
  assert.equal(a.liquid.id,'water')
  assert.equal(a.liquid.densityKgM3,1000)
  assert.deepEqual(w.liquidDomain('a'),{id:'a',kind:'region',finite:true,liquid:a.liquid,volumeM3:48})
  assert.throws(()=>new WaterRegion({id:'c',width:2,height:2,liquidId:'coffee'}),/no soportado/)
})
test('LQ-02: rechazo del depósito heredado infinito, sin convertirlo en reserva finita',()=>{
  const w=new WaterWorld([{id:'ocean',name:'Mar',x:0,y:0,z:0,yaw:0,p:{shape:'rect',width:10,length:10}}])
  assert.deepEqual(w.liquidDomain('ocean'),{id:'ocean',kind:'legacy-boundary',finite:false,liquid:WaterRegion.liquid,volumeM3:null})
  assert.throws(()=>w.transferVolume({id:'ocean',col:0,row:0},{id:'x',col:0,row:0},1,'ocean-1'),/regiones finitas/)
  assert.equal(w.at(0,0,0).id,'ocean')
})
test('LQ-03: dos regiones no conectan automáticamente; paso sin traspaso conserva sus volúmenes',()=>{
  const {w,b}=setup()
  w.step(1/60)
  near(b.volume(),0)
  near(w.liquidBalance().externalInM3,0)
})
test('LQ-04: la transferencia explícita se difiere al siguiente paso y no modifica antes',()=>{
  const {w,a,b,from,to}=setup()
  const startA=a.volume(),startB=b.volume()
  w.transferVolume(from,to,0.2,'tx01')
  near(a.volume(),startA); near(b.volume(),startB)
  assert.equal(w.transfers.length,1)
  w.step(1/60)
  near(a.volume(),startA-0.2)
  near(b.volume(),startB+0.2)
  near(w.liquidBalance().currentM3,startA+startB)
})
test('LQ-05: ledger físico local y global distinguen transferencia de entradas externas',()=>{
 const {w,a,b,from,to}=setup(2)
 w.transferVolume(from,to,0.5,'transfer-5')
 w.step(1/60)
 near(a.ledger.drained,0.5);near(b.ledger.added,0.5)
 const x=w.liquidBalance()
 near(x.externalInM3,0);near(x.externalDrainM3,0);near(x.internalTransferredM3,0.5)
 near(x.massKg,32_000);near(x.errorKg,0)
})
test('LQ-06: origen no puede donar más agua de la celda física',()=>{
 const {w,from,to}=setup(0.1)
 const before=w.snapshot()
 assert.throws(()=>w.transferVolume(from,to,0.1001,'too-much'),/volumen suficiente/)
 assert.deepEqual(w.snapshot(),before)
})
test('LQ-07: solicitar varias transferencias reserva el volumen de la celda origen',()=>{
 const {w,from,to}=setup(0.5)
 w.transferVolume(from,to,0.4,'r1')
 assert.throws(()=>w.transferVolume(from,to,0.2,'r2'),/volumen suficiente/)
 assert.equal(w.transfers.length,1)
 w.step(1/60);near(w.liquidBalance().internalTransferredM3,0.4)
})
test('LQ-08: fuente con lluvia pendiente puede transferir sin duplicarla',()=>{
 const {w,a,b,from,to}=setup(0)
 w.changeVolume('a',1,1,0.7)
 w.transferVolume(from,to,0.4,'rain-to-pool')
 w.step(1/60)
 near(a.volume(),0.3);near(b.volume(),0.4)
 const x=w.liquidBalance()
 near(x.externalInM3,0.7);near(x.internalTransferredM3,0.4);near(x.currentM3,0.7)
})
test('LQ-09: el drenaje externo encolado reduce el presupuesto transferible',()=>{
 const {w,from,to}=setup(0.5)
 w.changeVolume('a',1,1,-0.3)
 assert.throws(()=>w.transferVolume(from,to,0.3,'oversub'),/volumen suficiente/)
 w.transferVolume(from,to,0.2,'remaining')
 w.step(1/60)
 near(w.liquidBalance().externalDrainM3,0.3)
})
test('LQ-10: invalidaciones no mutan ninguna cola ni región',()=>{
 const {w,from,to}=setup()
 const orig=w.snapshot()
 const invalid=[[-1,null],[0,null],[NaN,null],[Infinity,null],[1,''],[1,5],[1,{}]]
 for (const [vol,id] of invalid) assert.throws(()=>w.transferVolume(from,to,vol,id))
 assert.deepEqual(w.snapshot(),orig)
})
test('LQ-11: mismo origen/destino exactos se rechaza',()=>{
 const {w,from}=setup()
 assert.throws(()=>w.transferVolume(from,from,0.3,'same'),/idénticos/)
})
test('LQ-12: celda inválida e ID inexistente no generan transferencias',()=>{
 const {w,from,to}=setup()
 assert.throws(()=>w.transferVolume({...from,col:99},to,0.3,'bad'),/fuera/)
 assert.throws(()=>w.transferVolume({...from,id:'unlisted'},to,0.3,'bad'),/regiones finitas/)
 assert.equal(w.transfers.length,0)
})
test('LQ-13: ID evita repetición dentro de la cola y una vez aplicado',()=>{
 const {w,from,to}=setup()
 w.transferVolume(from,to,0.3,'req-13')
 assert.throws(()=>w.transferVolume(from,to,0.3,'req-13'),/duplicado/)
 w.step(1/60)
 assert.throws(()=>w.transferVolume(from,to,0.3,'req-13'),/duplicado/)
 assert.equal(w.completedTransferIds.length,1)
})
test('LQ-14: tras aplicar, conserva comprobante origen/destino/cantidad',()=>{
 const {w,from,to}=setup()
 w.transferVolume(from,to,1,'audit-14')
 w.step(1/60)
 assert.deepEqual(w.transferHistory[0],{from,to,volumeM3:1,requestId:'audit-14'})
 assert.equal(w.transfers.length,0)
})
test('LQ-15: snapshot v2 guarda cola y auditoría, restauración atómica',()=>{
 const {w,from,to}=setup()
 w.transferVolume(from,to,0.6,'snap-15')
 const snap=JSON.parse(JSON.stringify(w.snapshot()))
 assert.equal(snap.version,2)
 w.step(1/60)
 w.restore(snap)
 assert.deepEqual(w.snapshot(),snap)
 w.step(1/60)
 near(w.liquidBalance().internalTransferredM3,0.6)
})
test('LQ-16: snapshot v1 legado sigue siendo válido',()=>{
 const {w,a,b}=setup()
 const old={version:1,regions:[a.snapshot(),b.snapshot()]}
 w.changeVolume('a',0,0,0.3);w.step(1/60)
 w.restore(old)
 assert.equal(w.snapshot().version,2)
 near(w.liquidBalance().errorKg,0)
 assert.equal(w.transfers.length,0)
})
test('LQ-17: snapshot inválido no corrompe ninguna región ni historial',()=>{
 const {w,from,to}=setup()
 w.transferVolume(from,to,0.3,'tx17')
 const good=w.snapshot()
 for(const alter of [
    s=>s.regions[1].bed[0]=100,
    s=>s.transfers[0].to.id='noexiste',
    s=>s.transfers[0].volumeM3=-1,
    s=>s.completedTransferIds=['tx17'],
    s=>s.transferHistory=[{from,to,volumeM3:9,requestId:null}],
  ]) {
    const bad=structuredClone(good);alter(bad)
    assert.throws(()=>w.restore(bad))
    assert.deepEqual(w.snapshot(),good)
  }
})
test('LQ-18: fallo del solver en destino revierte las transferencias y estados',()=>{
 const {w,from,to}=setup()
 w.changeVolume('b',0,0,1e11) // hace exceder presupuesto CFL del segundo solver
 w.transferVolume(from,to,0.2,'rollback')
 const before=w.snapshot()
 assert.throws(()=>w.step(2),/demasiados subpasos|Límite/)
 assert.deepEqual(w.snapshot(),before)
})
test('LQ-19: remover región con transferencia pendiente no pierde el volumen',()=>{
 const {w,from,to}=setup()
 w.transferVolume(from,to,0.2,'locked')
 assert.throws(()=>w.removeRegion('a'),/pendientes/)
 assert.throws(()=>w.removeRegion('b'),/pendientes/)
 assert.equal(w.regions.size,2)
})
test('LQ-20: factor negativo o volumen no finito no pasa a la simulación',()=>{
 const {w,from,to}=setup()
 for(const v of [-2,NaN,-Infinity,Infinity,0]) assert.throws(()=>w.transferVolume(from,to,v,'invalid'))
 assert.equal(w.transfers.length,0)
})
test('LQ-21: determinismo de pasos y de transferencia interregión',()=>{
 const run=()=>{
   const {w,from,to}=setup(0.8)
   for (let i=0;i<10;i++) {
      if(i===3) w.transferVolume(from,to,0.2,'det-1')
      if(i===5) w.transferVolume(from,to,0.1,'det-2')
      w.step(1/60)
   }
   return w.snapshot()
 }
 assert.deepEqual(run(),run())
})
test('LQ-22: metadata finita nunca confunde mar legado con región',()=>{
 const {w}=setup()
 assert.equal(w.liquidDomain('x'),null)
 assert.equal(w.liquidDomain('a').finite,true)
 assert.equal(w.liquidBalance().densityKgM3,1000)
})
test('LQ-23: precipitación entra mediante autoridad WaterWorld; visual no añade volumen',()=>{
 const terrain=readFileSync(new URL('../src/engine/runtime/geometry/water-terrain.js',import.meta.url),'utf8')
 const fx=readFileSync(new URL('../src/engine/runtime/world/fx.js',import.meta.url),'utf8')
 assert.match(terrain,/this\.water\.changeVolume\(region\.id, i, j/)
 assert.match(fx,/volumen.*WaterWorld/)
})
test('LQ-24: coste de paso vacío conserva API y no genera historial',()=>{
 const w=new WaterWorld()
 assert.deepEqual(w.step(1/60),[])
 assert.equal(w.transferHistory.length,0)
 near(w.liquidBalance().massKg,0)
})
