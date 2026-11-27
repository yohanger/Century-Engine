// S03: integración natural del viento único sin duplicar fuerzas Jolt.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { vegetationResponse, TornadoCombustion } from '../src/engine/runtime/world/tornado-destruction.js'
import { World } from '../src/engine/runtime/world/world.js'

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const path='src/engine/runtime/events/play-tornado-destruction.js'
const code=read(path)
const THREE={Vector3:class {set(x,y,z){Object.assign(this,{x,y,z});return this}}}
const context={THREE,vegetationResponse,TornadoCombustion,BUILTIN_FOLIAGE:{}}
vm.runInNewContext(code.replace(/^import .*\n/gm,'').replace('export const destructiveTornadoMethods =','const destructiveTornadoMethods =')+'\nthis.methods=destructiveTornadoMethods',context)
const methods=context.methods
const world=(cfg={},active=true)=>({
  tornado:{x:0,y:0,z:0,radius:40,active},weatherOn:true,
  cfg:{weather:{tornadoDestruction:false,tornadoWaterLift:false,tornadoFire:false,tornadoTreeBudget:4,tornadoWaterRateM3s:0,...cfg}},
  windAt3D:()=>({x:0,y:0,z:0,inside:false,weight:0}),
  tornadoWindAt:()=>{throw Error('No consultar vórtice aislado en consumidores ambientales')},
  precipitationAt:()=>0,_f:{precipMm:0},
})
const base=w=>({
  ed:{world:w,terrains:[],groundAt:()=>0,nodes:new Map()},project:{objects:[]},
  _destructiveTrees:[],_treeKeys:new Set(),_destructionCandidates:[],
  _destructionWaterVisual:null,_destructionFireVisual:null,_combustion:null,
  phys:{},water:{regions:new Map(),bodies:[],suspended:[],at:()=>null},game:{emit(){}},
})
const step=(c,dt=1/60)=>methods._destructionFixed.call(c,dt)

test('WU3-01: WaterWorld conserva un único dueño del inventario suspendido',()=>{
  assert.match(code,/this\.water\.advanceSuspended\(dt,\(x,y,z\)=>w\.windAt3D\(x,y,z\)/)
  assert.doesNotMatch(code,/this\.water\.advanceSuspended\(dt,\(x,y,z\)=>w\.tornadoWindAt/)
})
test('WU3-02: agua suspendida consulta viento efectivo en cada posición',()=>{
  const w=world({tornadoWaterLift:true}),calls=[]
  w.windAt3D=(x,y,z)=>{calls.push([x,y,z]);return {x:17,y:3,z:-9}}
  const c=base(w);c.water.bodies=[{}];c.water.suspended=[{position:[1,2,3]}]
  c.water.advanceSuspended=(_dt,windAt)=>{assert.deepEqual(windAt(1,2,3),{x:17,y:3,z:-9});return []}
  step(c);assert.equal(calls.length,1);assert.deepEqual(calls[0],[1,2,3])
})
test('WU3-03: agua suspendida continúa con viento ambiente sin vórtice activo',()=>{
  const w=world({tornadoWaterLift:true},false);const c=base(w)
  w.windAt3D=()=>({x:5,y:0,z:0})
  c.water.bodies=[{}];c.water.suspended=[{position:[1,2,3]}]
  let advanced=false
  c.water.advanceSuspended=(_dt,fn)=>{advanced=fn(1,2,3).x===5;return []}
  step(c);assert.ok(advanced)
})
test('WU3-04: la elevación de agua sigue opt-in',()=>{
  const w=world({tornadoWaterLift:false}),c=base(w)
  c.water.bodies=[{}];c.water.advanceSuspended=()=>{throw Error('No suspender sin opt-in')}
  step(c)
})
test('WU3-05: la respuesta de raíces usa viento atmosférico local, sin fuerzas globales adicionales',()=>{
  const w=world({tornadoDestruction:true}),c=base(w);let calls=0,spawned=0
  w.windAt3D=(x,y,z)=>{calls++;assert.equal(y,2);return {inside:true,weight:1,x:48,y:6,z:0}}
  const type={cfg:{id:'maple',builtin:'tree',destructible:true,rootResistanceN:60,trunkResistanceN:100000},data:[0,0,0,1]}
  const terrain={ox:0,oz:0,id:'terrain',foliage:{nearbyPlayInstances:()=>[0]},heightAt:()=>0}
  c._destructionCandidates=[{terrain,type}];c._destructionTreeSpawn=()=>{spawned++}
  step(c);assert.equal(calls,1);assert.equal(spawned,1)
})
test('WU3-06: la evaluación no arranca árboles fuera del volumen',()=>{
  const w=world({tornadoDestruction:true}),c=base(w);let spawned=0
  w.windAt3D=()=>({inside:false,weight:0,x:80,y:0,z:0})
  const type={cfg:{id:'tree',builtin:'tree',destructible:true,rootResistanceN:20},data:[0,0,0,1]}
  const terrain={ox:0,oz:0,id:'terrain',foliage:{nearbyPlayInstances:()=>[0]},heightAt:()=>0}
  c._destructionCandidates=[{terrain,type}];c._destructionTreeSpawn=()=>{spawned++}
  step(c);assert.equal(spawned,0)
})
test('WU3-07: el fuego consulta lluvia local, no precipitación global',()=>{
  const w=world({tornadoFire:true}),c=base(w);let consulted=0,volume=0
  w._f.precipMm=50;w.precipitationAt=(x,z,y)=>{consulted++;assert.deepEqual([x,z,y],[3,5,4]);return 0}
  c._combustion={sources:new Map([['f',{id:'f',x:3,y:4,z:5,burning:true}]]),wet:(_id,v)=>{volume+=v},step:()=>{}}
  step(c);assert.equal(consulted,1);assert.equal(volume,0)
})
test('WU3-08: precipitación localizada enfría una fuente incluso con frame global seco',()=>{
  const w=world({tornadoFire:true}),c=base(w);let wet=0
  w._f.precipMm=0;w.precipitationAt=()=>35
  c._combustion={sources:new Map([['f',{id:'f',x:0,y:0,z:0,burning:true}]]),wet:(_id,v)=>{wet+=v},step:()=>{}}
  step(c);assert.ok(wet>0)
})
test('WU3-09: agua cercana conserva prioridad sobre enfriamiento atmosférico',()=>{
  const w=world({tornadoFire:true}),c=base(w);const volumes=[]
  w.precipitationAt=()=>50;c.water.at=()=>({surface:10})
  c._combustion={sources:new Map([['f',{id:'f',x:0,y:0,z:0,burning:true}]]),wet:(_id,v)=>volumes.push(v),step:()=>{}}
  step(c);assert.equal(volumes.length,1);assert.equal(volumes[0],(1/60)*0.02)
})
test('WU3-10: brasas usan el mismo viento efectivo sin mezclador nuevo',()=>{
  const w=world({tornadoFire:true}),c=base(w);let value=null
  w.windAt3D=()=>({x:9,y:2,z:-4})
  c._combustion={sources:new Map(),step:(_dt,fn)=>{value=fn(1,2,3)}}
  step(c);assert.deepEqual(value,{x:9,y:2,z:-4})
})
test('WU3-11: objetos Jolt conservan contribución específica del tornado',()=>{
  const s=read('src/engine/runtime/events/play-tornado.js')
  assert.match(s,/_tornadoBodyForces\(dt\)/);assert.match(s,/wind=w\.tornadoWindAt\(p\.x,p\.y,p\.z\)/)
  assert.doesNotMatch(s,/windAt3D\(/)
})
test('WU3-12: jugador FPS no recibe un segundo impulso ambiental',()=>{
  const s=read('src/engine/runtime/player/fps/movement.js')
  assert.match(s,/world\.tornadoWindAt\(p\.x,p\.y,p\.z\)/)
  assert.match(s,/_tornadoDrift/)
})
test('WU3-13: cuerpos de árboles usan sólo contribución del vórtice',()=>{
  assert.match(code,/_destructionBodyForces\(dt\)/)
  assert.match(code,/flow=w\.tornadoWindAt\(pos\.x,pos\.y,pos\.z\)/)
})
test('WU3-14: viento efectivo respeta el contrato ambiente más vórtice',()=>{
  const w=new World(19);const ambient=w.windAt(1,3), effective=w.windAt3D(1,5,3); assert.equal(effective.x,ambient.x); assert.equal(effective.z,ambient.z); assert.equal(effective.y,0); assert.equal(effective.inside,false)
})
test('WU3-15: no se alteran los contratos de snapshot de WaterWorld y combustión',()=>{
  assert.match(read('src/engine/runtime/geometry/waterworld.js'),/suspendedDepositM3/)
  assert.match(read('src/engine/runtime/world/tornado-destruction.js'),/snapshot\(\)/)
  assert.match(code,/_destructionRestore\(data\)/)
})
test('WU3-16: rendimiento acotado y sin consultas atmosféricas dentro de un bucle global de instancias',()=>{
  assert.match(code,/let budget=256/);assert.match(code,/this\._destructionCandidates/)
  assert.match(code,/this\._combustion\.step\(dt,\(x,y,z\)=>w\.windAt3D\(x,y,z\)/)
})
