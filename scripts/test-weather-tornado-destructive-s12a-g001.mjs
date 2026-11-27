// S12A: contratos físicos puros y recorridos de agua suspendida. Integraciones reales por QA local.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TornadoCombustion, vegetationResponse,vegetationResistance } from '../src/engine/runtime/world/tornado-destruction.js'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'
import { normalizeWeather } from '../src/engine/runtime/world/params.js'
const source=readFileSync(new URL('../src/engine/runtime/geometry/waterworld.js',import.meta.url),'utf8')
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'",'const collectWaterBodies = () => [];const riverLine=()=>[]')
  .replace("import { waveSet } from './water.js'",'const waveSet=()=>({big:[]})')
  .replace("import { WaterRegion } from './water-solver.js'",`import { WaterRegion } from '${new URL('../src/engine/runtime/geometry/water-solver.js',import.meta.url).href}'`)
const {WaterWorld}=await import(`data:text/javascript,${encodeURIComponent(source)}`)
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`)
const wind=(speed=40)=>({inside:true,weight:1,x:speed,y:8,z:speed})
const model=()=>{const w=new WaterWorld();w.suspensionEnabled=true;w.addRegion({id:'pond',x:0,z:0,width:4,height:4,depth:Array(16).fill(2)});return w}
const src=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('TD-01 perfiles de vegetación previos desactivan destrucción',()=>{assert.equal(vegetationResistance({}).rootN,2400);assert.equal(normalizeWeather({on:true}).tornadoDestruction,false)})
test('TD-02 viento débil no arranca árbol fuerte',()=>{assert.equal(vegetationResponse({rootResistanceN:50000},wind(3)).uproot,false)})
test('TD-03 tornado fuerte sí arranca árbol vulnerable',()=>{assert.equal(vegetationResponse({rootResistanceN:250},wind(50)).uproot,true)})
test('TD-04 árbol resistente tiene umbral distinto al tronco',()=>{const r=vegetationResponse({rootResistanceN:100000,trunkResistanceN:500},wind(50));assert.equal(r.uproot,false);assert.equal(r.breakTrunk,true)})
test('TD-05 fuera de radio no se genera desprendimiento',()=>{assert.equal(vegetationResponse({}, {inside:false,weight:0,x:100,y:100,z:100}).forceN,0)})
test('TD-06 resistencia negativa o indefinida se rechaza',()=>{for(const rootResistanceN of [-1,Infinity,NaN])assert.throws(()=>vegetationResistance({rootResistanceN}),/rango/)})
test('TD-07 escala y fuerza tienen límite acotado',()=>{assert.ok(vegetationResponse({},wind(500),50).forceN<=3e6)})
test('TD-08 sin agua suspendida no existe snapshot v7',()=>{const w=new WaterWorld();w.addRegion({id:'a',width:3,height:3});assert.equal(w.snapshot().version,2)})
test('TD-09 activar suspensión habilita snapshot v7',()=>{const w=model();assert.equal(w.snapshot().version,7);assert.equal(w.snapshot().suspension.active,true)})
test('TD-10 extraer 0.05 m³ limita y conserva masa tras paso',()=>{const w=model();const before=w.liquidBalance().currentM3;near(w.liftWater('pond',1,1,0.05,[1,4,1]),0.05);w.step(1/60);near(w.liquidBalance().currentM3,before);near(w.liquidBalance().errorM3,0);near(w.liquidBalances().water.errorM3,0)})
test('TD-11 fuente seca limita extracción al inventario local',()=>{const w=new WaterWorld();w.suspensionEnabled=true;w.addRegion({id:'a',width:3,height:3,depth:Array(9).fill(0.01)});near(w.liftWater('a',1,1,1,[1,2,1]),0.01);w.step(1/60);near(w.liquidBalance().errorM3,0)})
test('TD-12 no se extrae agua sin opt-in',()=>{const w=model();w.suspensionEnabled=false;assert.throws(()=>w.liftWater('pond',1,1,0.01,[1,2,1]),/desactivada/)})
test('TD-13 volumen no finito rechaza sin mutación',()=>{const w=model(),s=w.snapshot();assert.throws(()=>w.liftWater('pond',1,1,NaN,[1,2,1]),/inválida/);assert.deepEqual(w.snapshot(),s)})
test('TD-14 región incompatible no se mezcla',()=>{const w=model();w.addRegion({id:'coffee',x:5,z:0,width:3,height:3,liquid:{id:'coffee',densityKgM3:1030}});assert.throws(()=>w.liftWater('coffee',1,1,0.01,[6,2,1]),/incompatible/)})
test('TD-15 no crea más de 64 paquetes suspendidos',()=>{const w=model();for(let i=0;i<70;i++)w.liftWater('pond',1,1,0.001,[1,5,1]);assert.equal(w.suspended.length,64)})
test('TD-16 viento transporta el líquido sin modificar masa',()=>{const w=model();w.liftWater('pond',1,1,0.01,[1,5,1]);w.step(1/60);const x=w.suspended[0].position[0];w.advanceSuspended(1/60,()=>({x:20,y:10,z:0}),()=>0);assert.ok(w.suspended[0].position[0]>x);near(w.liquidBalance().errorM3,0)})
test('TD-17 depósito retorna agua al receptor compatible',()=>{const w=model(),start=w.liquidBalance().currentM3;w.liftWater('pond',1,1,0.01,[1,0.01,1]);w.step(1/60);w.advanceSuspended(1/60,()=>({x:0,y:0,z:0}),()=>0);w.step(1/60);near(w.suspended.length,0);near(w.liquidBalance().currentM3,start);near(w.liquidBalance().errorM3,0);assert.ok(w.suspendedDepositM3>0)})
test('TD-18 salida fuera del dominio queda contabilizada',()=>{const w=model(),start=w.liquidBalance().currentM3;w.liftWater('pond',1,1,0.01,[10,0.01,10]);w.step(1/60);w.advanceSuspended(1/60,()=>({x:0,y:0,z:0}),()=>0);w.step(1/60);near(w.liquidBalance().currentM3,start-0.01);near(w.liquidBalance().errorM3,0);near(w.suspendedExitM3,0.01)})
test('TD-19 restore v7 conserva posición e inventario',()=>{const w=model();w.liftWater('pond',1,1,0.01,[1,5,1]);w.step(1/60);const s=w.snapshot();w.advanceSuspended(1/60,()=>({x:5,y:5,z:0}),()=>0);w.restore(s);assert.deepEqual(w.snapshot(),s)})
test('TD-20 snapshot corrupto rechaza sin mutar región',()=>{const w=model();w.liftWater('pond',1,1,0.01,[1,5,1]);w.step(1/60);const before=w.snapshot(),s=structuredClone(before);s.suspension.parcels[0].volumeM3+=5;assert.throws(()=>w.restore(s),/balance suspendido/);assert.deepEqual(w.snapshot(),before)})
test('TD-21 snapshot v6 anterior no se puede restaurar con suspensión activa',()=>{const w=model();const s=w.snapshot();delete s.suspension;s.version=6;assert.throws(()=>w.restore(s),/incompatible/)})
test('TD-22 región con agua suspendida no se elimina silenciosamente',()=>{const w=model();w.liftWater('pond',1,1,0.01,[1,5,1]);assert.throws(()=>w.removeRegion('pond'),/suspendida/)})
test('TD-23 combustibles necesitan temperatura de ignición',()=>{const f=new TornadoCombustion();f.add('a');assert.equal(f.ignite('a',500),false);assert.equal(f.ignite('a',750),true)})
test('TD-24 material no combustible nunca prende',()=>{const f=new TornadoCombustion();f.add('a',{combustible:false});assert.equal(f.ignite('a',1200),false)})
test('TD-25 humedad mayor exige mayor temperatura',()=>{const f=new TornadoCombustion();f.add('a',{moisture:1});assert.equal(f.ignite('a',600),false)})
test('TD-26 agua enfría y puede extinguir combustible',()=>{const f=new TornadoCombustion();f.add('a',{moisture:0});f.ignite('a',650);f.wet('a',0.1);assert.equal(f.sources.get('a').burning,false)})
test('TD-27 brasa se desplaza con campo de viento',()=>{const f=new TornadoCombustion();f.add('a',{moisture:0});f.ignite('a',800);f.step(1/60,()=>({x:20,y:15,z:0}),()=>-10);assert.ok(f.embers.length>0);assert.ok(f.embers[0].x>0)})
test('TD-28 la fuente consume combustible con el tiempo',()=>{const f=new TornadoCombustion();f.add('a',{moisture:0});f.ignite('a',800);f.step(0.1,()=>({x:0,y:0,z:0}),()=>-10);assert.ok(f.sources.get('a').fuel<1)})
test('TD-29 snapshot de fuego se restaura',()=>{const f=new TornadoCombustion();f.add('a',{moisture:0});f.ignite('a',800);const s=f.snapshot();f.step(0.1,()=>({x:0,y:0,z:0}),()=>-10);f.restore(s);assert.deepEqual(f.snapshot(),s)})
test('TD-30 snapshot de fuego corrupto se rechaza',()=>{const f=new TornadoCombustion();f.add('a');const s=f.snapshot();s.sources[0].fuel=Infinity;assert.throws(()=>f.restore(s),/inválida/)})
test('TD-31 presupuestos de fuentes y brasas explícitos',()=>{const f=new TornadoCombustion({maxSources:1,maxEmbers:1});f.add('a');assert.throws(()=>f.add('b'),/capacidad/);assert.equal(f.maxEmbers,1)})
test('TD-32 infraestructura de Play crea cuerpos dinámicos reales',()=>{const s=src('src/engine/runtime/events/play-tornado-destruction.js');assert.match(s,/this\.phys\.dynamics\(\)\.add\(/);assert.match(s,/detachPlayInstance/);assert.match(s,/\.bodies\?\.remove/)})
test('TD-33 vegetación original solo se oculta en modo Play',()=>{const s=src('src/engine/runtime/geometry/foliage.js');assert.match(s,/detachPlayInstance/);assert.match(s,/pl\.removed\.set/);assert.match(s,/this\.play = \{ chunks, hidden/)})
test('TD-34 clima conserva opt-in y perfiles configurables',()=>{const c=normalizeWeather({on:true,tornadoEnabled:true,tornadoDestruction:true,tornadoWaterLift:true,tornadoFire:true,tornadoTreeBudget:1000});assert.equal(c.tornadoDestruction,true);assert.equal(c.tornadoWaterLift,true);assert.equal(c.tornadoFire,true);assert.ok(c.tornadoTreeBudget<=64)})
test('TD-35 Jolt consume fuerzas desde el ciclo fijo existente',()=>{const p=src('src/engine/runtime/events/play-bodies.js');const c=src('src/engine/runtime/events/play-controls.js');assert.match(p,/_destructionBodyForces\?\.\(dt\)/);assert.match(c,/_destructionFixed\?\.\(fdt\)/)})
test('TD-36 el agua no se visualiza desde emisor paralelo',()=>{const p=src('src/engine/runtime/events/play-tornado-destruction.js');assert.match(p,/tornadoWaterVfxNodeId/);assert.match(p,/type==='vfx'/);assert.doesNotMatch(p,/new VfxSimulation/)})
test('TD-37 la ignición de rayos utiliza su punto de impacto físico',()=>{const p=src('src/engine/runtime/events/play-lightning.js');assert.match(p,/_destructionIgniteAt\?\.\(impact\)/)})
test('TD-38 masa suspendida en océano abierto registra entrada externa',()=>{
  const w=new WaterWorld([{id:'ocean',name:'Mar',x:0,y:0,z:0,yaw:0,p:{shape:'rect',width:100,length:100}}])
  w.suspensionEnabled=true;const before=w.liquidBalance().currentM3
  near(w.liftLegacyWater('ocean',0,0,0.003),0.003);near(w.liquidBalance().currentM3,before+0.003)
  near(w.liquidBalance().externalInM3,0.003);near(w.liquidBalance().errorM3,0)
})
test('TD-39 no se roba agua oceánica fuera de su frontera',()=>{
  const w=new WaterWorld([{id:'ocean',name:'Mar',x:0,y:0,z:0,yaw:0,p:{shape:'rect',width:10,length:10}}])
  w.suspensionEnabled=true;assert.throws(()=>w.liftLegacyWater('ocean',200,200,0.01),/fuera/)
})
test('TD-40 el agua oceánica puede salir externamente sin inventario negativo',()=>{
  const w=new WaterWorld([{id:'ocean',name:'Mar',x:0,y:0,z:0,yaw:0,p:{shape:'rect',width:100,length:100}}])
  w.suspensionEnabled=true;w.liftLegacyWater('ocean',0,0,0.02)
  w.advanceSuspended(1/60,()=>({x:0,y:0,z:0}),()=>3)
  near(w.liquidBalance().currentM3,0);near(w.liquidBalance().errorM3,0);near(w.suspendedExitM3,0.02)
})
test('TD-41 el snapshot v7 guarda inventario procedente del océano',()=>{
  const w=new WaterWorld([{id:'ocean',name:'Mar',x:0,y:0,z:0,yaw:0,p:{shape:'rect',width:100,length:100}}])
  w.suspensionEnabled=true;w.liftLegacyWater('ocean',0,0,0.02);const s=w.snapshot()
  w.advanceSuspended(1/60,()=>({x:0,y:0,z:0}),()=>2);w.restore(s);assert.deepEqual(w.snapshot(),s)
})
test('TD-42 incendio inicial se define en nodos existentes, no en VFX',()=>{
 const code=src('src/components/Inspector.vue');assert.match(code,/tornado-combustion-inspector/);assert.match(code,/combustion\.ignited/)
})
test('TD-43 modelo de incendio sigue funcionando después del final del tornado',()=>{
 const code=src('src/engine/runtime/events/play-tornado-destruction.js');assert.match(code,/if\(!t\|\|!Number\.isFinite\(dt\)/)
})
test('TD-44 el array de cuerpos de árbol registra fragmentos individuales',()=>{
 const code=src('src/engine/runtime/events/play-tornado-destruction.js');assert.match(code,/BUILTIN_FOLIAGE\[type\.cfg\.builtin\]\.build\(\)/)
 assert.match(code,/for\(const f of b\.parts\)/)
})
test('TD-45 el hash espacial limita consultas de vegetación',()=>{
 const code=src('src/engine/runtime/geometry/foliage.js');assert.match(code,/nearbyPlayInstances/);assert.match(code,/this\._hashFor\(state\)/)
})
test('TD-46 el ciclo de guardado declara árboles y combustión',()=>{
 const code=src('src/engine/runtime/events/play-saves.js');assert.match(code,/tornadoDestruction/);assert.match(code,/_destructionRestore/)
})
test('TD-47 el balance por especie usa el mismo volumen suspendido que balance heredado',()=>{
 const w=model();w.liftWater('pond',1,1,0.05,[1,5,1]);w.step(1/60)
 near(w.liquidBalances().water.currentM3,w.liquidBalance().currentM3);near(w.liquidBalances().water.errorM3,0)
})
test('TD-48 CA-004 snapshot v7 coexiste con recipiente S10',()=>{
 const w=model();w.addContainer({id:'cup',shape:'box',size:[1,1,1],initialM3:0.1})
 w.liftWater('pond',1,1,0.02,[1,5,1]);w.step(1/60);const s=w.snapshot();assert.equal(s.version,7)
 w.advanceSuspended(1/60,()=>({x:5,y:0,z:0}),()=>0);w.restore(s)
 assert.deepEqual(w.snapshot(),s);near(w.liquidBalances().water.errorM3,0)
})
test('TD-49 snapshot v7 sin el inventario de suspenso no muta las regiones',()=>{
 const w=model();const s=w.snapshot(),before=w.snapshot();delete s.suspension
 assert.throws(()=>w.restore(s),/incompatible/);assert.deepEqual(w.snapshot(),before)
})
test('TD-50 máscaras de instancias se pueden restaurar en Play sin tocar matrices del editor',()=>{
 const code=src('src/engine/runtime/geometry/foliage.js')
 assert.match(code,/restoreDetachedInstances/);assert.match(code,/s\.meshes\.find/)
})
test('TD-51 modelo térmico mantiene identidad tras mover árbol',()=>{
 const f=new TornadoCombustion();f.add('tree');const s=f.sources.get('tree');s.x=5;s.y=6
 assert.equal(f.snapshot().sources[0].x,5)
})
test('TD-52 la escena conserva el estado térmico en una única save',()=>{
 const code=src('src/engine/runtime/events/play-tornado-destruction.js')
 assert.match(code,/this\._combustion\.snapshot\(\)/)
 assert.match(code,/model\.restore\(data\.fire\)/)
 assert.match(code,/if\(validatedFire\)this\._combustion=validatedFire/)
})
test('TD-53 el runtime deja continuar agua suspendida cuando expira el tornado',()=>{
 const code=src('src/engine/runtime/events/play-tornado-destruction.js')
 assert.match(code,/if\(!t\|\|!Number\.isFinite\(dt\)\|\|dt<=0\)return/)
 assert.match(code,/this\.water\.advanceSuspended\(dt/)
})

test('TD-54 agua suspendida devuelve contactos físicos para enfriar fuentes cercanas',()=>{
 const w=model();w.liftWater('pond',1,1,0.015,[1,0.01,1]);w.step(1/60)
 const landed=w.advanceSuspended(1/60,()=>({x:0,y:0,z:0}),()=>0)
 assert.equal(landed.length,1);near(landed[0].volumeM3,0.015)
 w.step(1/60);near(w.liquidBalance().errorM3,0)
})
test('TD-55 VFX condicionado no emite brasas si no existe combustión',async()=>{
 const {newVfxResource}=await import('../src/engine/runtime/vfx/resource.js')
 const {VfxSimulation}=await import('../src/engine/runtime/vfx/simulation.js')
 const fx=newVfxResource('fx-fire','Fuego.vfx'),sim=new VfxSimulation(fx)
 sim.emissionEnabled=false
 for(let i=0;i<60;i++)sim.step()
 assert.equal(sim.totalBirths,0)
 sim.emissionEnabled=true;sim.elapsed=0
 for(let i=0;i<60;i++)sim.step()
 assert.ok(sim.totalBirths>0)
})
test('TD-56 desactivar VFX conserva el envejecimiento sin crear partículas',async()=>{
 const {newVfxResource}=await import('../src/engine/runtime/vfx/resource.js')
 const {VfxSimulation}=await import('../src/engine/runtime/vfx/simulation.js')
 const s=new VfxSimulation(newVfxResource('fx-water','Agua.vfx'))
 s.step();const b=s.totalBirths
 s.emissionEnabled=false;for(let i=0;i<60;i++)s.step()
 assert.equal(s.totalBirths,b);assert.ok(s.elapsed>0)
})
test('TD-57 VFX de tornado no conserva emisión forzada tras Stop',()=>{
 const code=src('src/engine/runtime/events/play-tornado-destruction.js')
 assert.match(code,/tornadoConditionalActive/)
 assert.match(code,/delete view\.node\.userData\.tornadoConditionalActive/)
 assert.match(code,/this\._combustion\.wet\(fire\.id/)
})
