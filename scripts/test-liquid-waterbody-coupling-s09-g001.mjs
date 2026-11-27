// S09 · Acoplamiento hidráulico sobre el WaterWorld existente. Sin Three.js/Jolt real en Node.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'

const src = readFileSync(new URL('../src/engine/runtime/geometry/waterworld.js', import.meta.url), 'utf8')
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies = (x) => x; const riverLine = () => []')
  .replace("import { waveSet } from './water.js'", 'const waveSet = () => ({ big: [] })')
  .replace("import { WaterRegion } from './water-solver.js'", `import { WaterRegion } from '${new URL('../src/engine/runtime/geometry/water-solver.js', import.meta.url).href}'`)
const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(src)}`)
const near = (a, b, eps=1e-6) => assert.ok(Math.abs(a-b)<=eps, `${a} no es ${b}`)
const endpoint=(id,col=1,row=1)=>({id,col,row})
const link=(from=endpoint('A'),to=endpoint('B'),extra={})=>({id:'puerto-1',from,to,apertureM2:0.02,coefficient:0.6,maxFlowM3s:1,direction:'from-to',...extra})
function world({h=2,legacy=false,emptyB=true}={}){
 const bodies=legacy?[{id:'mar',name:'Mar',x:0,y:3,z:0,yaw:0,p:{shape:'rect',width:100,length:100}}]:[]
 const w=new WaterWorld(bodies)
 const A=w.addRegion({id:'A',x:0,z:0,width:4,height:4,depth:Array(16).fill(h),boundaries:{west:'closed'}})
 const B=w.addRegion({id:'B',x:5,z:0,width:4,height:4,depth:Array(16).fill(emptyB?0:1)})
 return {w,A,B}
}

test('WB-01: sin acoplamiento un cuerpo tradicional no cambia el inventario',()=>{
 const {w}=world({legacy:true}); assert.equal(w.liquidDomain('mar').finite,false)
 w.step(1/60);near(w.liquidBalance().externalInM3,0);near(w.liquidBalance().errorM3,0)
})
test('WB-02: puerto entre regiones transfiere volumen manteniendo masa',()=>{
 const {w,A,B}=world();w.configureCouplings([link()]);const before=w.liquidBalance().currentM3
 w.step(1/60);assert.ok(B.volume()>0);assert.ok(A.volume()<32)
 near(w.liquidBalance().currentM3,before);near(w.liquidBalance().externalInM3,0);near(w.liquidBalance().externalDrainM3,0);near(w.liquidBalance().errorM3,0)
})
test('WB-03: flujo nulo con igual cota, sin transferencias falsas',()=>{
 const {w,A,B}=world({h:1,emptyB:false});w.configureCouplings([link()]);w.step(1/60)
 near(A.volume(),16);near(B.volume(),16);near(w.liquidBalance().internalTransferredM3,0)
})
test('WB-04: enlace de un solo sentido no invierte el flujo',()=>{
 const {w,A,B}=world({h:0,emptyB:false});w.configureCouplings([link()]);w.step(1/60)
 near(A.volume(),0);near(B.volume(),16)
})
test('WB-05: enlace bidireccional sí permite invertir el caudal',()=>{
 const {w,A,B}=world({h:0,emptyB:false});w.configureCouplings([link(undefined,undefined,{direction:'both'})]);w.step(1/60)
 assert.ok(A.volume()>0);assert.ok(B.volume()<16);near(w.liquidBalance().errorM3,0)
})
test('WB-06: sección y caudal máximo limitan el intercambio',()=>{
 const {w,B}=world();w.configureCouplings([link(undefined,undefined,{apertureM2:100,maxFlowM3s:0.05})]);w.step(0.1)
 assert.ok(B.volume() <= 0.00501);assert.ok(B.volume()>0)
})
test('WB-07: origen seco no pierde volumen ni crea masa',()=>{
 const {w,A,B}=world({h:0});w.configureCouplings([link()]);w.step(0.1)
 near(A.volume(),0);near(B.volume(),0);near(w.liquidBalance().errorM3,0)
})
test('WB-08: varios enlaces desde misma celda respetan presupuesto físico',()=>{
 const {w,A}=world({h:0.005});w.configureCouplings([link(undefined,endpoint('B'),{id:'1',apertureM2:100,maxFlowM3s:100}),link(undefined,endpoint('B',2,1),{id:'2',apertureM2:100,maxFlowM3s:100})]);w.step(1/60)
 assert.ok(A.depth[5]>=-1e-10);near(w.liquidBalance().errorM3,0)
})
test('WB-09: frontera heredada aporta líquido externo contabilizado',()=>{
 const {w,A}=world({h:0,legacy:true});w.configureCouplings([link({id:'mar'},endpoint('A'))]);w.step(1/60)
 assert.ok(A.volume()>0);assert.ok(w.liquidBalance().coupledBoundaryInM3>0)
 near(w.liquidBalance().currentM3,w.liquidBalance().externalInM3);near(w.liquidBalance().errorM3,0)
})
test('WB-10: región descarga a frontera heredada con salida explícita',()=>{
 const {w,A}=world({h:5,legacy:true});w.configureCouplings([link(endpoint('A'),{id:'mar'})]);const start=w.liquidBalance().currentM3;w.step(1/60)
 assert.ok(A.volume()<80);assert.ok(w.liquidBalance().coupledBoundaryOutM3>0)
 near(w.liquidBalance().currentM3,start-w.liquidBalance().externalDrainM3);near(w.liquidBalance().errorM3,0)
})
test('WB-11: no conecta automáticamente un océano con una región solapada',()=>{
 const {w}=world({legacy:true});const start=w.snapshot();w.step(1/60)
 assert.deepEqual(w.snapshot(),start)
})
test('WB-12: el puerto externo requiere cobertura real del cuerpo seleccionado',()=>{
 const {w}=world({legacy:true});w.bodies[0].x=1000;w.configureCouplings([link({id:'mar'},endpoint('A'))]);const before=w.snapshot()
 assert.throws(()=>w.step(1/60),/fuera de la huella/);assert.deepEqual(w.snapshot(),before)
})
test('WB-13: rechaza ID duplicado y extremos inválidos sin configurar parcialmente',()=>{
 const {w}=world();const a=link();assert.throws(()=>w.configureCouplings([a,a]),/duplicado/);assert.equal(w.couplings.length,0)
 assert.throws(()=>w.configureCouplings([link(endpoint('none'))]),/desconocido/)
 assert.equal(w.couplings.length,0)
})
test('WB-14: rechaza enlaces entre dos reservas heredadas',()=>{
 const {w}=world({legacy:true});assert.throws(()=>w.configureCouplings([link({id:'mar'},{id:'mar'})]),/mismo punto|reservas/)
})
test('WB-15: rechaza coeficientes y secciones corruptos',()=>{
 const {w}=world();for(const extra of [{apertureM2:-1},{coefficient:2},{maxFlowM3s:Infinity},{direction:'reverse'}])
 assert.throws(()=>w.configureCouplings([link(undefined,undefined,extra)]),/inválidos/)
})
test('WB-16: snapshot v5 conserva enlace, inventario y contadores',()=>{
 const {w}=world({legacy:true});w.configureCouplings([link({id:'mar'},endpoint('A'))]);w.step(1/60);const saved=w.snapshot()
 assert.equal(saved.version,5);w.step(1/60);w.restore(saved);assert.deepEqual(w.snapshot(),saved)
})
test('WB-17: snapshot v5 rechaza configuración distinta, sin mutar',()=>{
 const {w}=world();w.configureCouplings([link()]);const saved=w.snapshot()
 w.configureCouplings([link(undefined,undefined,{apertureM2:0.03})]);const before=w.snapshot()
 assert.throws(()=>w.restore(saved),/incompatible/);assert.deepEqual(w.snapshot(),before)
})
test('WB-18: rollback íntegro si un solver falla durante caudal',()=>{
 const {w,B}=world();w.configureCouplings([link()]);const snap=w.snapshot();const original=B.step.bind(B)
 B.step=()=>{throw new Error('falla de solver')}
 assert.throws(()=>w.step(1/60),/falla de solver/);assert.deepEqual(w.snapshot(),snap);B.step=original
})
test('WB-19: snapshots v2/3/4 se aceptan en modo nuevo',()=>{
 const {w}=world();const legacy=w.snapshot();w.configureCouplings([link()]);w.restore(legacy);near(w.liquidBalance().errorM3,0)
})
test('WB-20: ocupación de esfera modifica superficie sin crear agua',()=>{
 const {w,A}=world({h:2});const before=A.volume();const surface=A.sample(1.5,1.5).surface
 w.setDisplacements([{center:[1.5,1.5,1.5],size:[1,1,1],kind:'sphere'}])
 assert.ok(A.sample(1.5,1.5).surface>surface);near(A.volume(),before);near(w.liquidBalance().errorM3,0)
})
test('WB-21: cuerpo fuera del agua no desplaza ni inventa masa',()=>{
 const {w,A}=world();w.setDisplacements([{center:[1.5,20,1.5],size:[1,1,1],kind:'box'}]);near(A.sample(1.5,1.5).surface,2)
})
test('WB-22: al retirar el cuerpo se libera ocupación sin restar agua',()=>{
 const {w,A}=world();w.setDisplacements([{center:[1.5,1.5,1.5],size:[1,1,1],kind:'box'}])
 w.setDisplacements([]);near(A.sample(1.5,1.5).surface,2);near(w.liquidBalance().errorM3,0)
})
test('WB-23: caja inclinada no se aproxima falsamente como caja vertical',()=>{
 const {w,A}=world();w.setDisplacements([{center:[1.5,1.5,1.5],size:[1,1,1],kind:'box',upright:false}]);near(A.sample(1.5,1.5).surface,2)
})
test('WB-24: snapshot de ocupación restaura una superficie sin alterar volumen',()=>{
 const {w,A}=world();w.setDisplacements([{center:[1.5,1.5,1.5],size:[1,1,1],kind:'capsule'}]);const saved=w.snapshot();assert.equal(saved.version,5)
 w.setDisplacements([]);w.restore(saved);assert.deepEqual(w.snapshot(),saved);near(w.liquidBalance().errorM3,0)
})
test('WB-25: ocupación inválida no altera estado previo',()=>{
 const {w}=world();const before=w.snapshot();assert.throws(()=>w.setDisplacements([{center:[1,2,3],size:[1,NaN,1],kind:'sphere'}]),/inválido/);assert.deepEqual(w.snapshot(),before)
})
test('WB-26: solver usa nivel geométrico efectivo y conserva el balance',()=>{
 const {w}=world();w.setDisplacements([{center:[1.5,1.5,1.5],size:[1,1,1],kind:'sphere'}]);const first=w.liquidBalance().currentM3
 w.step(1/60);near(w.liquidBalance().currentM3,first);near(w.liquidBalance().errorM3,0)
})
test('WB-27: la física usa mismo WaterWorld y se ejecuta antes del paso fijo',()=>{
 const controls=readFileSync(new URL('../src/engine/runtime/events/play-controls.js',import.meta.url),'utf8')
 const bodies=readFileSync(new URL('../src/engine/runtime/events/play-bodies.js',import.meta.url),'utf8')
 assert.match(controls,/_waterDisplacementSync\?\.\(\)[\s\S]*_waterConnection\?\.step\(fdt\)/)
 assert.match(bodies,/this\.water\.setDisplacements\(solids\)/)
})
test('WB-28: vistas físicas consumen elevación efectiva, no render paralelo',()=>{
 const view=readFileSync(new URL('../src/engine/runtime/geometry/water-surface.js',import.meta.url),'utf8')
 assert.match(view,/region\.effectiveBed\[k\] \+ region\.depth\[k\]/)
})

test('WB-29: objeto ancho reparte ocupación entre múltiples celdas',()=>{
 const {w,A}=world({h:3})
 w.setDisplacements([{center:[1.5,2,1.5],size:[2,1,2],kind:'box'}])
 const active=[...A.occupied].filter((v)=>v>0)
 assert.equal(active.length,9)
 assert.ok(active.every((v)=>v<=3))
 near(w.liquidBalance().errorM3,0)
})
test('WB-30: zona física inválida no causa excepciones por cuerpos externos',()=>{
 const w=new WaterWorld();w.addRegion({id:'r',width:2,height:2,valid:[0,1,1,1],depth:[0,2,2,2]})
 assert.doesNotThrow(()=>w.setDisplacements([{center:[0.5,1,0.5],size:[1,1,1],kind:'sphere'}]))
 near(w.liquidBalance().errorM3,0)
})
test('WB-31: no se puede eliminar región con enlaces activos',()=>{
 const {w}=world();w.configureCouplings([link()]);assert.throws(()=>w.removeRegion('A'),/puertos/)
 assert.equal(w.regions.size,2)
})
test('WB-32: escena y autoría mantienen asociaciones explícitas, no conversiones por proximidad',()=>{
 const source=readFileSync(new URL('../src/engine/runtime/geometry/water-terrain.js',import.meta.url),'utf8')
 const waterPanel=readFileSync(new URL('../src/components/WaterPanel.vue',import.meta.url),'utf8')
 const terrain=readFileSync(new URL('../src/components/TerrainPanel.vue',import.meta.url),'utf8')
 assert.match(source,/water\.configureCouplings\(config\.couplings\)/)
 assert.match(source,/coupledRegion !== cfg\.id/)
 assert.match(waterPanel,/physicalRegionId/)
 assert.match(terrain,/saveCouplings/)
 assert.match(terrain,/toggleDisplacement/)
})

const bridgeSource = readFileSync(new URL('../src/engine/runtime/geometry/water-terrain.js',import.meta.url),'utf8')
  .replace("import { groundAtAll } from './terrains.js'", 'const groundAtAll = (t,x,z) => t[0]?.groundAt(x,z) ?? NaN')
  .replace("import { precipMm } from '../world/atmosphere.js'", 'const precipMm = (r,s=0) => 45*r*r + 6*s*s')
  .replace("import { hydrologyGrid } from './water-hydrology.js'", 'const hydrologyGrid = () => null')
const { TerrainWaterConnection } = await import(`data:text/javascript,${encodeURIComponent(bridgeSource)}`)
const terrain = { id:'land',version:0,ox:0,oz:0,enabled:true,groundAt(x,z){return x>=0 && x<4 && z>=0 && z<4?0:NaN} }
const sceneCfg = {enabled:true,regions:[{id:'A',x:0,z:0,width:4,height:4,cellSize:1,initialDepth:0}],
  couplings:[link({id:'mar'},endpoint('A'))],displacement:{enabled:true}}
function sceneWater(associated=true) {return new WaterWorld([{id:'mar',name:'Mar',x:0,y:3,z:0,yaw:0,
 p:{shape:'rect',width:100,length:100,...(associated?{physicalRegionId:'A'}:{})}}])}

test('WB-33: puente S09 enlaza región, frontera heredada y desplazamiento sin otro solver',()=>{
 const w=sceneWater();const conn=new TerrainWaterConnection(w,sceneCfg,[terrain],null)
 assert.equal(w.regions.size,1);assert.equal(w.couplings.length,1);assert.equal(w.displacementEnabled,true)
 assert.equal(w.at(1.5,1.5,0),null) // la región física seca tiene prioridad sobre malla oceánica
 conn.step(1/60)
 assert.ok(w.regions.get('A').volume()>0)
 near(w.liquidBalance().errorM3,0)
})
test('WB-34: sin asociación explícita, el solapamiento heredado sigue bloqueado',()=>{
 const w=sceneWater(false)
 assert.throws(()=>new TerrainWaterConnection(w,sceneCfg,[terrain],null),/se solapa/)
 assert.equal(w.regions.size,0)
})
test('WB-35: CA-002 no habilita nada en escenas anteriores',()=>{
 const w=sceneWater(false)
 assert.equal(w.couplings.length,0);assert.equal(w.displacementEnabled,false)
 assert.equal(w.at(1.5,1.5,0)?.id,'mar')
})
test('WB-36: malla acoplada se oculta solo mientras existe representación física',()=>{
 const scene=readFileSync(new URL('../src/engine/runtime/scene/water.js',import.meta.url),'utf8')
 assert.match(scene,/this\._coupledWaterVisibility\.push\(\[node, node\.visible\]\)/)
 assert.match(scene,/for \(const \[node, wasVisible\] of this\._coupledWaterVisibility/)
})
test('WB-37: Jolt solo autoriza ocupación de recursos CollisionShape3D simples verificables',()=>{
 const nodes=readFileSync(new URL('../src/engine/runtime/physics/node-bodies.js',import.meta.url),'utf8')
 const physics=readFileSync(new URL('../src/engine/runtime/events/play-bodies.js',import.meta.url),'utf8')
 assert.match(nodes,/displacement: obj\.props\.shape\.type === 'BoxShape3D'/)
 assert.match(nodes,/displacement: null/)
 assert.match(physics,/item\.displacementSupported === false/)
})
