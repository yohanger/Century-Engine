import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const solver = await import('../src/engine/runtime/geometry/water-solver.js')
let source=readFileSync(new URL('../src/engine/runtime/geometry/waterworld.js',import.meta.url),'utf8')
source=source.replace("import { collectWaterBodies, riverLine } from './waterfx.js'",'const collectWaterBodies=()=>[];const riverLine=()=>[]')
 .replace("import { waveSet } from './water.js'",'const waveSet=()=>({big:[]})')
 .replace("import { WaterRegion } from './water-solver.js'",`const WaterRegion=globalThis.__S10_WaterRegion`)
globalThis.__S10_WaterRegion=solver.WaterRegion
const { WaterWorld }=await import(`data:text/javascript,${encodeURIComponent(source)}`)
delete globalThis.__S10_WaterRegion
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} !== ${b}`)
const water={id:'water',densityKgM3:1000}
const coffee={id:'coffee',densityKgM3:1035,viscosity:2,color:'#442511'}
const cup=(id,liquid=water,initial=0.0002)=>({id,shape:'cylinder',size:[0.09,0.12,0.09],initialM3:initial,liquid,pourRate:0.7})
const flat={position:[0,1,0],quaternion:[0,0,0,1]}
const tilt={position:[0,1,0],quaternion:[Math.sin(Math.PI/4),0,0,Math.cos(Math.PI/4)]}
test('S10-01: perfil y capacidad física',()=>{let w=new WaterWorld();let c=w.addContainer(cup('a'));near(c.capacityM3,Math.PI*0.09**2/4*0.12);near(w.liquidBalances().water.currentM3,0.0002)})
test('S10-02: líquido de mayor densidad, masa correspondiente',()=>{let w=new WaterWorld();w.addContainer(cup('a',coffee));near(w.liquidBalances().coffee.massKg,0.0002*1035)})
test('S10-03: volumen inicial fuera de capacidad se rechaza',()=>{assert.throws(()=>new WaterWorld().addContainer(cup('a',water,2)),/volumen inicial/)})
test('S10-04: no derrama vertical durante paso fijo',()=>{let w=new WaterWorld();w.addContainer(cup('a'));w.step(1/60);near(w.containerState('a').volumeM3,0.0002)})
test('S10-05: superficie libre horizontal y cambia al girar',()=>{let w=new WaterWorld();w.addContainer(cup('a'));let a=solver.WaterRegion.containerOutflow(w.containerState('a'),1/60,flat);let b=solver.WaterRegion.containerOutflow(w.containerState('a'),1/60,tilt);assert.ok(b.surface.rimY<a.surface.rimY);assert.ok(b.surface.headM>0)})
test('S10-06: inclinar derrama por salida externa contabilizada',()=>{let w=new WaterWorld();w.addContainer(cup('a'));w.setContainerPose('a',tilt);w.step(1/60);let b=w.liquidBalances().water;assert.ok(b.containedM3<0.0002);near(b.errorM3,0);assert.ok(b.externalOutM3>0)})
test('S10-07: recipient A a B conserva masa',()=>{let w=new WaterWorld();w.addContainer(cup('a'));w.addContainer(cup('b',water,0));near(w.transferContainer('a','b',0.0001),0.0001);near(w.liquidBalances().water.errorM3,0)})
test('S10-08: recipiente lleno no consume origen',()=>{let w=new WaterWorld();w.addContainer(cup('a'));let cap=Math.PI*0.09**2/4*0.12;w.addContainer(cup('b',water,cap));assert.equal(w.transferContainer('a','b',0.0001),0);near(w.containerState('a').volumeM3,0.0002)})
test('S10-09: café y agua no se mezclan',()=>{let w=new WaterWorld();w.addContainer(cup('a',coffee));w.addContainer(cup('b',water,0));assert.throws(()=>w.transferContainer('a','b',0.0001),/incompatibles/);near(w.containerState('a').volumeM3,0.0002)})
test('S10-10: destino de agua en región existente',()=>{let w=new WaterWorld();w.addRegion({id:'r',width:3,height:3,depth:Array(9).fill(0),bed:Array(9).fill(0)});w.addContainer(cup('a'));w.pourContainer('a',0.0001,{regionId:'r',col:1,row:1});w.step(1/60);near(w.liquidBalances().water.errorM3,0);near(w.liquidBalances().water.currentM3,0.0002)})
test('S10-11: rechazo atómico de café en región agua',()=>{let w=new WaterWorld();w.addRegion({id:'r',width:3,height:3});w.addContainer(cup('a',coffee));const before=w.snapshot();assert.throws(()=>w.pourContainer('a',0.0001,{regionId:'r',col:1,row:1}),/incompatibles/);assert.deepEqual(w.snapshot(),before)})
test('S10-12: región de café homogénea admite vertido',()=>{let w=new WaterWorld();w.addRegion({id:'c',width:3,height:3,liquid:coffee});w.addContainer(cup('a',coffee));w.pourContainer('a',0.0001,{regionId:'c',col:1,row:1});w.step(1/60);near(w.liquidBalances().coffee.errorM3,0);near(w.liquidBalances().coffee.currentM3,0.0002)})
test('S10-13: snapshot v6 restaura contenido, pose, balance',()=>{let w=new WaterWorld();w.addContainer(cup('a'));let snap=w.snapshot();assert.equal(snap.version,6);w.setContainerPose('a',tilt);w.step(1/60);w.restore(snap);assert.deepEqual(w.snapshot(),snap)})
test('S10-14: snapshot alterado no muta el mundo',()=>{let w=new WaterWorld();w.addContainer(cup('a'));let s=w.snapshot(),before=w.snapshot();s.containers[0].volumeM3=99;assert.throws(()=>w.restore(s),/inválido/);assert.deepEqual(w.snapshot(),before)})
test('S10-15: rollback de solver restituye líquido',()=>{let w=new WaterWorld();let r=w.addRegion({id:'r',width:3,height:3});w.addContainer(cup('a'));w.setContainerPose('a',tilt);let s=w.snapshot();r.step=()=>{throw new Error('fallo')};assert.throws(()=>w.step(1/60),/fallo/);assert.deepEqual(w.snapshot(),s)})
test('S10-16: IDs duplicados y formas arbitrarias se rechazan',()=>{let w=new WaterWorld();w.addContainer(cup('a'));assert.throws(()=>w.addContainer(cup('a')),/duplicado/);assert.throws(()=>w.addContainer({...cup('b'),shape:'mesh'}),/no soportada/)})
test('S10-17: no se acepta cantidad negativa ni NaN',()=>{let w=new WaterWorld();w.addContainer(cup('a'));for(let v of [-1,NaN,Infinity])assert.throws(()=>w.pourContainer('a',v),/inválido/);near(w.containerState('a').volumeM3,0.0002)})
test('S10-18: vertido automático de taza a otro recipiente compatible',()=>{
  const w=new WaterWorld();w.addContainer(cup('a'),flat)
  w.addContainer(cup('b',water,0),{position:[0,0.5,0.045],quaternion:[0,0,0,1]})
  w.setContainerPose('a',tilt);w.step(1/60)
  assert.ok(w.containerState('b').volumeM3>0)
  near(w.liquidBalances().water.errorM3,0)
  near(w.liquidBalances().water.externalOutM3,0)
})
test('S10-19: viscosidad alta reduce momento sin cambiar masa regional',()=>{
  const args={id:'r',width:3,height:3,depth:[0,0,0,0,0.2,0,0,0,0],velocityX:Array(9).fill(1),velocityZ:Array(9).fill(0)}
  const w=new solver.WaterRegion({...args,liquid:water})
  const thick=new solver.WaterRegion({...args,liquid:{...coffee,viscosity:8}})
  w.step(1/60);thick.step(1/60)
  near(w.volume(),thick.volume())
  assert.ok(Math.abs(thick.qx[4])<Math.abs(w.qx[4]))
})
test('S10-20: recursos líquidos se serializan como JSON, no como binarios de IndexedDB',()=>{
  const code=(n)=>readFileSync(new URL('../src/'+n,import.meta.url),'utf8')
  const project=code('core/state/project.js'),lfproj=code('core/lfproj.js'),lp=code('core/levelpackage.js')
  assert.match(project,/e\.kind === 'vfx' \|\| e\.kind === 'liquid'\) continue/)
  assert.match(project,/'vfx', 'liquids', 'assets', 'folders'/)
  assert.match(lfproj,/e\.kind === 'liquid'/)
  assert.match(lp,/e\.kind === 'liquid'/)
})
test('S10-21: guarda de recursos compartidos comprueba escenas, prefabs y Terrain',()=>{
  const code=readFileSync(new URL('../src/core/state/filesystem.js',import.meta.url),'utf8')
  assert.match(code,/kind !== 'vfx' && kind !== 'texture' && kind !== 'liquid'/)
  assert.match(code,/db\.loadScene\(p\.id, s\.id\)/)
  assert.match(code,/hasRef\(data\.environment\?\.waterSimulation\)/)
  assert.match(code,/for \(const pf of p\.prefabs/)
})
test('S10-22: el PlayMode mantiene un inventario físico y limpia meshes propios',()=>{
  const code=readFileSync(new URL('../src/engine/runtime/events/play-liquid.js',import.meta.url),'utf8')
  assert.match(code,/this\.water\.addContainer\(spec,pose\)/)
  assert.match(code,/this\.water\.setContainerPose/)
  assert.match(code,/_liquidReset\(\) \{/ )
})
