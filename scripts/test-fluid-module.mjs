import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { FluidRegion, displacementHeights } from '../src/engine/runtime/fluids/index.js'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'
import { WaterWorld } from '../src/engine/runtime/geometry/waterworld.js'
import { TerrainWaterConnection, nativeWaterConfiguration } from '../src/engine/runtime/geometry/water-terrain.js'
import { bodyMethods } from '../src/engine/runtime/events/play-bodies.js'
import { loadJolt, JoltWorld } from '../src/engine/runtime/physics/jolt.js'
import { readFileSync } from 'node:fs'

const near = (a,b,e=1e-8) => assert.ok(Math.abs(a-b)<=e, `${a} != ${b}`)
const sum = a => a.reduce((x,y)=>x+y,0)
const makeRegion = (extra={}) => new FluidRegion({id:'fluid',width:4,height:4,depth:Array(16).fill(2),...extra})
const solid = (extra={}) => ({kind:'box',center:[1,1,1],size:[1,1,1],...extra})
const land = fn => ({id:'land',version:0,ox:0,oy:0,oz:0,enabled:true,groundAt:fn})
const lake = (id='lake',x=0) => ({id,name:id,type:'water',position:[x,1,0],rotation:[0,0,0],props:{shape:'rect',width:4,length:4,res:0.5,waveHeight:0}})
const cfg = {enabled:true,regions:[{id:'r',x:0,z:0,width:4,height:4,initialDepth:1}]}

test('agua y clientes genéricos comparten el mismo núcleo y snapshots', () => {
  const w = new WaterRegion({id:'water',width:2,height:2,depth:[1,1,1,1]})
  assert.ok(w instanceof FluidRegion)
  const snapshot=w.snapshot(); w.disturb(1,1,0.5,1); w.step(1/60)
  w.restoreValidated(w.validateSnapshot(snapshot)); assert.deepEqual(w.snapshot(),snapshot)
})

for (const axis of ['x','z']) test(`pared ${axis}: profundidades distintas conservan reposo a ambos lados`, () => {
  const bed = Array.from({length:16},(_,k)=>axis==='x' ? (k%4<2 ? 0:0.7) : (k<8 ? 0:0.7))
  const blocks = new Uint8Array(20)
  for(let i=0;i<4;i++) blocks[axis==='x' ? i*5+2 : 8+i]=1
  const r=makeRegion({bed,depth:bed.map(y=>2-y),[axis==='x'?'blockX':'blockZ']:blocks})
  for(let i=0;i<120;i++)r.step(1/60)
  r.depth.forEach((h,k)=>near(h,2-bed[k]));r.qx.forEach(q=>near(q,0));r.qz.forEach(q=>near(q,0))
  near(r.balanceError(),0)
})

test('sólido con centro fuera del dominio ocupa solo su intersección real',()=>{
  const r=makeRegion(), out=displacementHeights([r],[solid({center:[-0.25,1,0.5]})]).get(r.id)
  near(sum(out),0.25);near(r.volume(),32)
})
test('sólido atravesando dos dominios no duplica el volumen recortado',()=>{
  const a=makeRegion(), b=makeRegion({id:'B',x:4})
  const result=displacementHeights([a,b],[solid({center:[4,1,1]})])
  near(sum(result.get(a.id)),0.5);near(sum(result.get(b.id)),0.5)
})
test('caja rotada usa su volumen orientado, sin descartarla ni usar su AABB como sólido',()=>{
  const r=makeRegion({depth:Array(16).fill(5)})
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/4).toArray()
  const out=displacementHeights([r],[solid({center:[2,2,2],size:[2,1,2],quaternion:q,upright:false})]).get(r.id)
  near(sum(out),4,0.12)
})
test('ocupación no incluye el sólido enterrado ni el que queda sobre el agua',()=>{
  const r=makeRegion({bed:Array(16).fill(1)})
  const out=displacementHeights([r],[solid({center:[1,0.5,1]}),solid({center:[1,10,1]})]).get(r.id)
  near(sum(out),0)
})
test('esfera y cápsula horizontal siguen las dimensiones físicas de Jolt',()=>{
  const r=makeRegion({depth:Array(16).fill(5)})
  const sphere=displacementHeights([r],[solid({kind:'sphere',center:[2,2,2],size:[1,2,3]})]).get(r.id)
  near(sum(sphere),4*Math.PI/3,0.14)
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2).toArray()
  const cap=displacementHeights([r],[solid({kind:'capsule',center:[2,2,2],size:[1,3,1],quaternion:q})]).get(r.id)
  near(sum(cap),Math.PI*0.25*2+4*Math.PI*0.125/3,0.12)
})
test('sincronizar un sólido inmóvil no aumenta la ocupación repetidamente',()=>{
  const w=new WaterWorld(),r=w.addRegion({id:'r',width:4,height:4,depth:Array(16).fill(2)})
  w.setDisplacements([solid({center:[1,2,1]})]); const first=r.occupied.slice()
  for(let i=0;i<60;i++)w.setDisplacements([solid({center:[1,2,1]})])
  assert.deepEqual(r.occupied,first);near(w.liquidBalance().errorM3,0)
})
test('un cuerpo genera propagación física de superficie sin añadir agua',()=>{
  const w=new WaterWorld(),r=w.addRegion({id:'r',width:8,height:8,depth:Array(64).fill(2)})
  const initial=r.volume()
  w.setDisplacements([solid({center:[4,1.8,4],size:[2,1,2]})])
  for(let i=0;i<30;i++)w.step(1/60)
  assert.ok(r.depth.some(h=>Math.abs(h-2)>0.01))
  assert.ok(r.qx.some(q=>Math.abs(q)>0.01) || r.qz.some(q=>Math.abs(q)>0.01))
  near(r.volume(),initial,1e-6);near(w.liquidBalance().errorM3,0,1e-6)
})
test('orientación inválida se rechaza antes de modificar cualquier región',()=>{
  const w=new WaterWorld(); w.addRegion({id:'r',width:2,height:2,depth:[1,1,1,1]})
  const before=w.snapshot()
  assert.throws(()=>w.setDisplacements([solid(),solid({quaternion:[0,0,0,0]})]),/inválida/)
  assert.deepEqual(w.snapshot(),before)
})

test('agua nativa avanza fuera de su huella inicial sobre suelo seco y conserva masa',()=>{
  const t=land(()=>0),w=WaterWorld.fromObjects([lake()]),config=nativeWaterConfiguration(w,null,[t])
  const connection=new TerrainWaterConnection(w,config,[t],null),r=connection.entries[0].region
  assert.ok(r.x < -2 && r.x+r.width*r.dx>2)
  assert.equal(w.at(2.25,0),null)
  const initial=r.volume()
  for(let i=0;i<120;i++)connection.step(1/60)
  assert.ok(w.at(2.25,0)?.depth>0.01)
  near(r.volume(),initial,1e-6);near(w.liquidBalance().errorM3,0,1e-6)
})
test('el suelo alto sigue seco y el fondo real no se sustituye por un plano ficticio',()=>{
  const t=land(x=>x>=0 ? 3:-4),w=WaterWorld.fromObjects([lake()])
  const config=nativeWaterConfiguration(w,null,[t]),conn=new TerrainWaterConnection(w,config,[t],null)
  near(w.at(-1,0).depth,5)
  for(let i=0;i<60;i++)conn.step(1/60)
  assert.equal(w.at(1,0),null);near(w.liquidBalance().errorM3,0,1e-6)
})
test('márgenes de lagos vecinos no crean regiones solapadas',()=>{
  const t=land(()=>0),w=WaterWorld.fromObjects([lake('A',-2.1),lake('B',2.1)])
  const config=nativeWaterConfiguration(w,null,[t])
  assert.doesNotThrow(()=>new TerrainWaterConnection(w,config,[t],null))
  assert.equal(w.regions.size,2)
})
test('mover o retirar barreras actualiza caras aunque runoff esté desactivado',()=>{
  let enabled=true,revision=0
  const w=new WaterWorld(), t=land(()=>0)
  const conn=new TerrainWaterConnection(w,cfg,[t],null,(_o,d)=>enabled && Math.abs(d[0])===1,null,()=>revision)
  const r=w.regions.get('r'),before=r.volume()
  assert.ok(r.blockX.some(Boolean))
  enabled=false;revision++
  for(let i=0;i<31;i++)conn.step(1/60)
  assert.ok(!r.blockX.some(Boolean));near(r.volume(),before);near(r.balanceError(),0)
})
test('un puente alto no bloquea el agua, una barrera sumergida sí',()=>{
  const t=land(()=>0),w=new WaterWorld()
  new TerrainWaterConnection(w,cfg,[t],null,(o,d)=>Math.abs(d[0])===1 && o[1]>1.1)
  assert.ok(!w.regions.get('r').blockX.some(Boolean))
  const other=new WaterWorld()
  new TerrainWaterConnection(other,cfg,[t],null,(o,d)=>Math.abs(d[0])===1 && o[1]>0.05 && o[1]<0.2)
  assert.ok(other.regions.get('r').blockX.some(Boolean))
})
test('las barreras se remuestrean al subir el agua aunque los nodos estén quietos',()=>{
  const t=land(()=>0),w=new WaterWorld()
  const conn=new TerrainWaterConnection(w,cfg,[t],null,(o,d)=>Math.abs(d[0])===1 && o[1]>1.1)
  const r=w.regions.get('r')
  assert.ok(!r.blockX.some(Boolean))
  for(let j=0;j<4;j++)for(let i=0;i<4;i++)r.queue(i,j,1)
  for(let i=0;i<31;i++)conn.step(1/60)
  assert.ok(r.blockX.some(Boolean));near(r.balanceError(),0,1e-6)
})
test('un nivel estable no repite raycasts de barreras cada medio segundo',()=>{
  let casts=0
  const w=new WaterWorld(),conn=new TerrainWaterConnection(w,cfg,[land(()=>0)],null,()=>{casts++;return false})
  const initial=casts
  for(let i=0;i<90;i++)conn.step(1/60)
  assert.equal(casts,initial)
})
test('retirar un techo libera la lluvia aunque runoff esté desactivado',()=>{
  let roof=true,revision=0
  const t=land(()=>0),w=new WaterWorld()
  const climate={weatherOn:true,cur:{rain:1,snow:0},precipitationAt:()=>45}
  const conn=new TerrainWaterConnection(w,cfg,[t],climate,(_o,d)=>roof && d[1]===1,null,()=>revision)
  const r=w.regions.get('r'),initial=r.volume()
  for(let i=0;i<30;i++)conn.step(1/60)
  near(r.volume(),initial)
  roof=false;revision++
  for(let i=0;i<60;i++)conn.step(1/60)
  assert.ok(r.volume()>initial);near(r.balanceError(),0,1e-6)
})
test('trasladar terreno verticalmente invalida la geometría sin borrar volumen',()=>{
  const t=land(()=>t.oy),w=new WaterWorld(),conn=new TerrainWaterConnection(w,cfg,[t],null)
  const r=w.regions.get('r'),volume=r.volume();t.oy=0.5;conn.step(1/60)
  near(r.bed[0],0.5);near(r.volume(),volume);near(r.balanceError(),0)
})
test('la firma de obstáculos sigue el padre en espacio mundial',()=>{
  const parent=new THREE.Group(),node=new THREE.Object3D();parent.add(node)
  const host={project:{objects:[{id:'wall',type:'staticbody3d'}]},ed:{nodes:new Map([['wall',node]])}}
  const before=bodyMethods._waterObjectSignature.call(host)
  parent.position.x=2
  assert.notEqual(bodyMethods._waterObjectSignature.call(host),before)
})
test('la firma detecta activación heredada y cambios de Shape3D en Timeline',()=>{
  let enabled=true
  const node=new THREE.Object3D()
  const host={project:{objects:[{id:'wall',type:'staticbody3d'}]},ed:{nodes:new Map([['wall',node]])},_nodeEnabled:()=>enabled}
  const initial=bodyMethods._waterObjectSignature.call(host)
  enabled=false;assert.notEqual(bodyMethods._waterObjectSignature.call(host),initial)
  const disabled=bodyMethods._waterObjectSignature.call(host)
  node.userData.timelineCollision={size:[2,2,2]}
  assert.notEqual(bodyMethods._waterObjectSignature.call(host),disabled)
})
test('colliders se registran antes de construir barreras en Play',()=>{
  const source=readFileSync(new URL('../src/engine/runtime/events/play.js',import.meta.url),'utf8')
  assert.ok(source.indexOf('this._bodiesInit()') < source.indexOf('new TerrainWaterConnection'))
})

test('Jolt WASM: rayos hidráulicos omiten dinámicos y siguen viendo paredes estáticas detrás',async()=>{
  const J=await loadJolt(),w=new JoltWorld(J)
  try {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,2));mesh.position.set(3,1,0);mesh.updateMatrixWorld()
    w.addBox(mesh,[1,2,2])
    w.dynamics().add({pos:new THREE.Vector3(1,1,0),quat:new THREE.Quaternion(),center:new THREE.Vector3(),size:new THREE.Vector3(1,1,1)},{shape:'box',mass:1})
    w.finalize()
    near(w.raycast([0,1,0],[1,0,0],5).distance,0.5,0.01)
    const hit=w.raycast([0,1,0],[1,0,0],5,{staticOnly:true,backFaces:true})
    near(hit.distance,2.5,0.01);assert.equal(hit.mesh,mesh)
  } finally {w.dispose()}
})
