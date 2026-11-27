// S12: contrato meteorológico, VFX3D compartido, Jolt y FPS sin física paralela.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'
import { vortexVelocityAt } from '../src/engine/runtime/world/windfield.js'
import { normalizeWeather } from '../src/engine/runtime/world/params.js'
import { newVfxResource,validateVfxResource } from '../src/engine/runtime/vfx/resource.js'
import { VfxSimulation } from '../src/engine/runtime/vfx/simulation.js'
const text=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const weather=(extra={})=>({on:true,preset:'storm',tornadoEnabled:true,tornadoX:4,tornadoY:2,tornadoZ:8,tornadoRadius:20,tornadoHeight:80,tornadoIntensity:25,tornadoDuration:5,tornadoMoveSpeed:2,tornadoHeading:90,...extra})
const newWorld=(extra={})=>{const w=new World(12);w.configure({weather:weather({tornadoMode:'script',tornadoDevelopmentSeconds:1,tornadoOrganizationSeconds:1,tornadoFormationSeconds:1,tornadoWeakeningSeconds:1,tornadoDissipationSeconds:1,...extra})});return w}
const state=()=>({active:true,x:4,y:2,z:8,radius:20,height:80,intensity:25})
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`)
const magnitude=(v)=>Math.hypot(v.x,v.y,v.z)
test('TN-01: ausencia de opt-in no crea tornado',()=>{
 const c=normalizeWeather({on:true});assert.equal(c.tornadoEnabled,false)
 const w=new World();w.configure({weather:{on:true}});assert.equal(w.tornado,null);assert.equal(w.tornadoWindAt(0,0,0).inside,false)
})
test('TN-02: parámetros se acotan y jamás propagan NaN',()=>{
 const v=normalizeWeather({tornadoEnabled:true,tornadoRadius:Infinity,tornadoHeight:-1,tornadoIntensity:200,tornadoDuration:0,tornadoX:NaN})
 assert.equal(v.tornadoRadius,18);assert.equal(v.tornadoHeight,5);assert.equal(v.tornadoIntensity,75);assert.equal(v.tornadoDuration,1);assert.equal(v.tornadoX,0)
})
test('TN-03: escena autorizada crea estado único del World',()=>{
 const w=newWorld();assert.equal(w.tornado.active,false);assert.equal(w.tornado.phase,'idle');assert.deepEqual([w.tornado.x,w.tornado.y,w.tornado.z],[4,2,8]);assert.equal(w.tornado.started,false)
})
test('TN-04: altura o radio externos dan vector cero',()=>{
 for(const p of [[25,5,8],[5,90,8],[5,-2,8]]) {let v=vortexVelocityAt(state(),...p);assert.equal(v.inside,false);near(magnitude(v),0)}
})
test('TN-05: componente tangencial gira en torno al eje',()=>{
 const v=vortexVelocityAt(state(),14,15,8);assert.ok(v.z>0);assert.ok(v.x<0);assert.ok(v.y>0)
})
test('TN-06: componente radial converge hacia el centro',()=>{
 const v=vortexVelocityAt(state(),14,15,8);assert.ok(v.x<0)
})
test('TN-07: columna eleva fluidamente sin singularidad en el centro',()=>{
 const v=vortexVelocityAt(state(),4,15,8);assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.z)&&v.y>0);near(v.x,0);near(v.z,0)
})
test('TN-08: extremo superior e inferior son suaves',()=>{
 const at=(h)=>magnitude(vortexVelocityAt(state(),12,h,8))
 assert.ok(at(2.01)<at(12));assert.ok(at(81.99)<at(72))
})
test('TN-09: el campo es independiente de cámara y semilla del render',()=>{
 const w=newWorld();const before=w.tornadoWindAt(14,14,8);w.setObserver(500,900,1000);assert.deepEqual(w.tornadoWindAt(14,14,8),before)
})
test('TN-10: movimiento en X positivo para rumbo 90°',()=>{
 const w=newWorld();w.startTornado({weatherTransition:0});w.tornadoStep(2.5);const x=w.tornado.x;w.tornadoStep(0.5);near(w.tornado.x,x+1);near(w.tornado.z,8);near(w.tornado.age,3)
})
test('TN-11: mismo paso fijo da la misma trayectoria',()=>{
 const a=newWorld(),b=newWorld();a.startTornado({weatherTransition:0});b.startTornado({weatherTransition:0});for(let i=0;i<100;i++)a.tornadoStep(0.03)
 for(let i=0;i<30;i++)b.tornadoStep(0.1)
 near(a.tornado.x,b.tornado.x);near(a.tornado.age,b.tornado.age);near(a.tornado.z,b.tornado.z)
})
test('TN-12: expira exactamente a duración, sin avanzar posteriormente',()=>{
 const w=newWorld();w.startTornado({weatherTransition:0});w.tornadoStep(100);near(w.tornado.age,10);assert.equal(w.tornado.active,false)
 const before=structuredClone(w.tornado);w.tornadoStep(0.01);assert.deepEqual(w.tornado,before)
})
test('TN-13: rechaza dt corrupto sin mutar estado',()=>{
 const w=newWorld(),before=structuredClone(w.tornado)
 for(const dt of [-1,0,NaN,Infinity])assert.throws(()=>w.tornadoStep(dt),/paso físico/)
 assert.deepEqual(w.tornado,before)
})
test('TN-14: windAt 2D preserva contrato y 3D suma velocidad del vórtice',()=>{
 const w=newWorld();w.frame();const legacy=w.windAt(14,8),sample=w.windAt3D(14,15,8),v=w.tornadoWindAt(14,15,8)
 near(sample.x,legacy.x+v.x);near(sample.z,legacy.z+v.z);near(sample.y,v.y)
 assert.deepEqual(Object.keys(legacy),['x','z','speed','dir','factor'])
})
test('TN-15: escena sin clima activo no crea tornado físico',()=>{
 const w=newWorld({on:false});assert.equal(w.tornado.phase,'idle');assert.equal(w.tornado.active,false)
})
test('TN-16: cero intensidad no genera fuerzas',()=>{
 const v=vortexVelocityAt({...state(),intensity:0},10,14,8);near(magnitude(v),0)
})
test('TN-17: configuración malformada no produce infinito',()=>{
 for(const s of [{...state(),radius:0},{...state(),intensity:Infinity},{...state(),active:false}])near(magnitude(vortexVelocityAt(s,10,12,8)),0)
})
test('TN-18: reseteo de mundo restaura estado inicial',()=>{
 const w=newWorld();w.startTornado({weatherTransition:0});w.tornadoStep(3.5);w.reset();near(w.tornado.x,4);near(w.tornado.age,0);assert.equal(w.tornado.phase,'idle');assert.equal(w.tornado.active,false)
})
test('TN-19: VFX recurso legado tiene vórtice desactivado',()=>{
 const r=newVfxResource('r','Smoke.vfx');assert.equal(Object.hasOwn(r.movement,'tornadoFlow'),false)
})
test('TN-20: recurso activo exige espacio mundo, no otro sistema',()=>{
 const r=newVfxResource('r','Smoke.vfx');assert.throws(()=>validateVfxResource({...r,movement:{...r.movement,tornadoFlow:true}}),/Mundo/)
 const valid=validateVfxResource({...r,movement:{...r.movement,tornadoFlow:true,space:'world'}})
 assert.equal(Object.hasOwn(valid.movement,'tornadoFlow'),false)
})
test('TN-21: VFX no altera cantidad/identidad de partículas',()=>{
 const b=newVfxResource('r','Smoke.vfx'),r=validateVfxResource({...b,movement:{...b.movement,tornadoFlow:true,space:'world'}})
 const a=new VfxSimulation(r,{seed:3});a.flowAt=()=>({x:8,y:6,z:4});for(let i=0;i<30;i++)a.step()
 assert.equal(a.totalBirths,6);assert.ok(a.position.every(Number.isFinite))
})
test('TN-22: VFX antiguo sin vórtice no escucha campo externo',()=>{
 const a=new VfxSimulation(newVfxResource('r','Smoke.vfx'));let calls=0;a.flowAt=()=>{calls++;return{x:100,y:100,z:100}}
 for(let i=0;i<30;i++)a.step();assert.equal(calls,0)
})
test('TN-23: VFX con diferentes seeds tiene simulación independiente',()=>{
 const b=newVfxResource('r','Smoke.vfx'),r=validateVfxResource({...b,movement:{...b.movement,tornadoFlow:true,space:'world'}})
 const a=new VfxSimulation(r,{seed:1}),c=new VfxSimulation(r,{seed:2});a.flowAt=c.flowAt=()=>({x:1,y:1,z:1});a.update(0.5);c.update(0.5)
 assert.notDeepEqual([...a.position],[...c.position]);const saved=[...c.position];a.step();assert.deepEqual([...c.position],saved)
})
test('TN-24: el ciclo de Play no controla nodos VFX3D',()=>{
 const src=text('src/engine/runtime/events/play-tornado.js')
 assert.doesNotMatch(src,/tornadoVfxNodeId|tornadoFlowActive|_tornadoVisual/)
})
test('TN-25: recursos VFX ordinarios no dependen de la formación meteorológica',()=>{
 const src=text('src/engine/runtime/events/play-tornado.js')
 assert.doesNotMatch(src,/resource\.movement|Espacio Mundo|\.vfx/)
})
test('TN-26: motor VFX toma el campo de World, no calcula otro tornado',()=>{
 const src=text('src/engine/runtime/nodes/vfx.js');assert.match(src,/scene\.world\.tornadoWindAt/)
})
test('TN-27: Jolt fuerza física solo cuando está habilitado',()=>{
 const src=text('src/engine/runtime/events/play-tornado.js');assert.match(src,/!cfg\.tornadoBodies/);assert.match(src,/B\.impulse\(item,/)
})
test('TN-28: FPS se integra mediante movimiento existente y no impulso rígido',()=>{
 const src=text('src/engine/runtime/player/fps/movement.js');assert.match(src,/wc\?\.tornadoPlayer/);assert.match(src,/ph\.moveCharacter\(dt, this\.vel\.x\+\(d\?\.x\|\|0\)/)
})
test('TN-29: Play utiliza un solo ciclo de física y WindField existente',()=>{
 const src=text('src/engine/runtime/events/play-controls.js');assert.match(src,/_tornadoFixed\?\.\(fdt\)/)
 assert.match(text('src/engine/runtime/events/play-bodies.js'),/_tornadoBodyForces\?\.\(dt\)/)
})
test('TN-30: ciclo de vida limpia eventos sin mover el VFX del usuario',()=>{
 const src=text('src/engine/runtime/events/play-tornado.js')
 assert.match(src,/_tornadoReset\(\)/)
 assert.match(src,/this\._tornadoInside\?\.clear\(\)/)
 assert.doesNotMatch(src,/view\.node\.position/)
})
test('TN-31: el script no reescribe jerarquía ni exporta física nueva',()=>{
 const src=text('src/engine/runtime/events/play-tornado.js');assert.doesNotMatch(src,/new JoltWorld|new World|new WindField|\.push\(\{\s*node:.*particles/)
})
test('TN-32: UI solo acepta nodos VFX3D y expone medidas',()=>{
 const params=text('src/engine/runtime/world/params.js'),ui=text('src/components/VfxEditor.vue')
 assert.match(params,/type:'node',only:\['vfx'\]/);assert.match(params,/Radio \(m\)/)
 // LF-VFX-WEATHER-DECOUPLING-CA-001: solo el migrador admite el antiguo campo meteorológico.
 assert.doesNotMatch(ui,/Vórtice meteorológico/)
 assert.match(text('src/engine/runtime/vfx/resource.js'),/migrateLegacyVfxResource/)
})
test('TN-33: las partidas guardan y restauran la posición del fenómeno',()=>{
 const src=text('src/engine/runtime/events/play-saves.js');assert.match(src,/tornado: \{ \.\.\.this\.ed\.world\.tornado \}/)
 assert.match(src,/restoreTornado\(snapshot\)/)
})
test('TN-34: límites de recursos y cuerpos por paso',()=>{
 const src=text('src/engine/runtime/events/play-tornado.js');assert.match(src,/MAX_BODIES = 64/)
 assert.match(src,/Math\.min\(MAX_BODIES,bodies\.length\)/)
})

// Pruebas directas de Play sin DOM/Three real: mismas funciones que usa la escena.
const vfxSource=text('src/engine/runtime/events/play-tornado.js')
  .replace("import * as THREE from 'three'", `const THREE={Vector3: class { constructor(x=0,y=0,z=0){this.set(x,y,z)} set(x,y,z){this.x=x;this.y=y;this.z=z;return this} copy(v){return this.set(v.x,v.y,v.z)} clone(){return new THREE.Vector3(this.x,this.y,this.z)} }}`)
  .replace("import { createWeatherVfx3D } from '../nodes/vfx.js'", "const createWeatherVfx3D = () => ({tick(){},dispose(){}})")
const { tornadoMethods }=await import(`data:text/javascript,${encodeURIComponent(vfxSource)}`)
function playFixture({vx=true,bodies=false}={}) {
 const world=newWorld({tornadoBodies:bodies,tornadoVfxNodeId:vx?'vfx-1':''});world.startTornado({weatherTransition:0});world.tornadoStep(2.5)
 const visual={position:{x:0,y:0,z:0,clone(){return {...this}},copy(v){Object.assign(this,v);return this}},
   userData:{},parent:null,updateWorldMatrix(){}}
 const objects=vx?[{id:'vfx-1',type:'vfx',props:{vfxId:'fx-1'}}]:[]
 const project={objects,vfx:[{id:'fx-1',movement:{tornadoFlow:true,space:'world'}}]}
 const signals=[],bodyItems=[{id:'b1',item:{mass:1},position:{x:14,y:14,z:8}}],impulses=[]
 const B={centerOf(){return {x:14,y:14,z:8}},impulse(item,v){impulses.push(v)}}
 const play=Object.assign(Object.create(tornadoMethods),{ed:{world,nodes:new Map(vx?[['vfx-1',visual]]:[])},project,
   game:{emit:(name,data)=>signals.push({name,data})},_bodies:bodyItems,phys:{bodies:B},hasPlayer:false,_tlBakeOwners:new Set()})
 return {play,world,visual,signals,impulses}
}
test('TN-35: Play emite inicio y entrada una sola vez',()=>{
 const {play,signals}=playFixture({vx:false});play._tornadoInit();play._tornadoFixed(1/60);play._tornadoFixed(1/60)
 assert.equal(signals.filter((e)=>e.name==='tornadoStart').length,1)
 assert.equal(signals.filter((e)=>e.name==='tornadoEnter').length,1)
})
test('TN-36: al terminar emite salida y fin una vez',()=>{
 const {play,signals}=playFixture({vx:false});play._tornadoInit();play._tornadoFixed(1/60)
 play._tornadoFixed(20);play._tornadoFixed(1/60)
 assert.equal(signals.filter((e)=>e.name==='tornadoExit').length,1)
 assert.equal(signals.filter((e)=>e.name==='tornadoEnd').length,1)
})
test('TN-37: VFX de usuario no se mueve por el tornado ni cambia su emisión',()=>{
 const {play,visual}=playFixture();play._tornadoInit()
 play._tornadoFixed(1/60)
 near(visual.position.x,0)
 assert.equal(visual.userData.tornadoFlowActive,undefined)
 assert.equal(visual.userData.tornadoConditionalActive,undefined)
 play._tornadoReset()
})
test('TN-38: sin asignación ya no se crea emisor meteorológico',()=>{
 const {play}=playFixture({vx:false});play._tornadoInit()
 assert.equal(play._tornadoWeatherVfx,undefined)
 assert.equal(play._tornadoVisual,undefined)
 play._tornadoReset()
})
test('TN-39: VFX de usuario con movimiento local no bloquea Play',()=>{
 const {play}=playFixture();play.project.vfx[0].movement.space='local'
 assert.doesNotThrow(()=>play._tornadoInit())
})
test('TN-40: Jolt recibe impulso sólo con flag de clima y masa válida',()=>{
 const a=playFixture({bodies:true});a.play._tornadoInit();a.play._tornadoBodyForces(1/60)
 assert.equal(a.impulses.length,1);assert.ok(a.impulses[0].every(Number.isFinite))
 const b=playFixture({bodies:false});b.play._tornadoInit();b.play._tornadoBodyForces(1/60);assert.equal(b.impulses.length,0)
})
test('TN-41: trayectoria desactivada no deja fuerzas residuales',()=>{
 const a=playFixture({bodies:true});a.play._tornadoInit();a.world.tornado.active=false
 a.play._tornadoBodyForces(1/60);assert.equal(a.impulses.length,0)
})
test('TN-42: cuerpos horneados por Timeline no reciben fuerzas',()=>{
 const a=playFixture({bodies:true});a.play._tornadoInit();a.play._tlBakeOwners.add('b1')
 a.play._tornadoBodyForces(1/60);assert.equal(a.impulses.length,0)
})
test('TN-43: nunca altera WaterWorld ni volumen de regiones',()=>{
 const src=text('src/engine/runtime/events/play-tornado.js');assert.doesNotMatch(src,/changeVolume\(|rainOnRunoff\(|transferVolume\(|setDisplacements\(/)
})
test('TN-44: los eventos mantienen un payload con identidad estable',()=>{
 const {play,signals}=playFixture({vx:false});play._tornadoInit();play._tornadoFixed(0.1)
 const start=signals.find((e)=>e.name==='tornadoStart').data
 const enter=signals.find((e)=>e.name==='tornadoEnter').data
 assert.equal(start.id,enter.id);assert.equal(enter.objectId,'b1');assert.equal(start.radius,20)
})
