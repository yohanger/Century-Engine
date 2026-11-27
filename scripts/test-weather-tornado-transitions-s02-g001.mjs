// S02: contratos de ciclo meteorológico y desacoplamiento del recurso VFX.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'
import { makeWorldApi } from '../src/engine/runtime/world/api.js'
import { normalizeWeather } from '../src/engine/runtime/world/params.js'
import { newVfxResource, validateVfxResource, migrateLegacyVfxResource } from '../src/engine/runtime/vfx/resource.js'
import { VfxSimulation } from '../src/engine/runtime/vfx/simulation.js'
const root = (p) => readFileSync(new URL('../'+p,import.meta.url),'utf8')
const config = (extra = {}) => ({ on:true, preset:'storm', directorSeed:73, tornadoEnabled:true,
  tornadoMode:'script', tornadoDevelopmentSeconds:1, tornadoOrganizationSeconds:1,
  tornadoFormationSeconds:1, tornadoWeakeningSeconds:1, tornadoDissipationSeconds:1,
  tornadoDuration:2, ...extra })
function scene(extra={}) { const w=new World(5);w.configure({weather:config(extra)});return w }
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`)
test('WT-01: desactivación conserva entorno sin fenómeno',()=>{
  const w=new World(5);w.configure({weather:{on:true,preset:'storm'}})
  assert.equal(w.tornado,null);assert.equal(w.tornadoWindAt(0,0,0).inside,false)
})
test('WT-02: permiso de Inspector no significa activación instantánea',()=>{
  const w=scene();assert.equal(w.tornado.phase,'idle');assert.equal(w.tornado.active,false)
  assert.equal(w.tornado.intensity,0);assert.equal(w.tornado.started,false)
})
test('WT-03: script inicia desarrollo y avanza todas las fases',()=>{
  const w=scene();assert.equal(w.startTornado({weatherTransition:0}),true)
  assert.equal(w.tornado.phase,'development');w.tornadoStep(1)
  assert.equal(w.tornado.phase,'organization');assert.equal(w.tornado.active,false)
  w.tornadoStep(1);assert.equal(w.tornado.phase,'formation');assert.equal(w.tornado.active,false)
  w.tornadoStep(0.5);assert.equal(w.tornado.phase,'formation');assert.equal(w.tornado.active,true)
  assert.ok(w.tornado.intensity>0 && w.tornado.intensity<w.tornado.targetIntensity)
  w.tornadoStep(0.5);assert.equal(w.tornado.phase,'active');w.tornadoStep(2)
  assert.equal(w.tornado.phase,'weakening');w.tornadoStep(1)
  assert.equal(w.tornado.phase,'dissipation');w.tornadoStep(1)
  assert.equal(w.tornado.phase,'ended');assert.equal(w.tornado.active,false);assert.equal(w.tornado.intensity,0)
})
test('WT-04: modificación válida y errores atómicos',()=>{
  const w=scene();assert.equal(w.modifyTornado({direction:90,moveSpeed:3,intensity:21,duration:4}),true)
  assert.equal(w.tornado.heading,90);assert.equal(w.tornado.targetIntensity,21)
  const before=structuredClone(w.tornado)
  assert.throws(()=>w.modifyTornado({x:5,duration:-2}),/inválido/)
  assert.deepEqual(w.tornado,before)
})
test('WT-05: debilitamiento solicitado e interrupción explícita',()=>{
  const w=scene();w.startTornado({weatherTransition:0});w.tornadoStep(2.8)
  assert.equal(w.stopTornado(false),true);assert.equal(w.tornado.phase,'weakening')
  w.tornadoStep(0.5);assert.ok(w.tornado.intensity<w.tornado.targetIntensity)
  assert.equal(w.stopTornado(true),true);assert.equal(w.tornado.phase,'ended');assert.equal(w.tornado.active,false)
})
test('WT-06: tormenta sin tornado (probabilidad 0)',()=>{
  const w=scene({tornadoMode:'automatic',tornadoChance:0})
  for(let i=0;i<5;i++){w.update(0.25);w.tornadoStep(0.25)}
  assert.equal(w.tornado.phase,'idle')
})
test('WT-07: desarrollo automático con probabilidad 1',()=>{
  const w=scene({tornadoMode:'automatic',tornadoChance:1})
  w.update(0.5);w.tornadoStep(0.5)
  assert.equal(w.tornado.phase,'development')
  w.tornadoStep(20);assert.equal(w.tornado.phase,'ended')
  w.setWeather('clear',1,0);w.tornadoStep(0.1)
  assert.equal(w.tornado.phase,'ended')
  w.setWeather('storm',1,0);w.tornadoStep(0.1)
  assert.equal(w.tornado.phase,'development')
})
test('WT-08: mismos pasos y semilla producen trayectorias idénticas',()=>{
  const a=scene({tornadoMode:'automatic',tornadoChance:1}),b=scene({tornadoMode:'automatic',tornadoChance:1})
  for(let i=0;i<60;i++){a.update(0.2);b.update(0.2);a.tornadoStep(0.2);b.tornadoStep(0.2)}
  assert.deepEqual(a.tornado,b.tornado)
})
test('WT-09: snapshot completo reproduce la fase sin inventar componentes',()=>{
  const a=scene(),b=scene();a.startTornado({weatherTransition:0});a.tornadoStep(2.5)
  b.restoreTornado(structuredClone(a.tornado));assert.deepEqual(a.tornado,b.tornado)
  const invalid={...a.tornado,intensity:NaN};assert.throws(()=>b.restoreTornado(invalid),/snapshot/)
  assert.deepEqual(a.tornado,b.tornado)
})
test('WT-10: API pública reutiliza game.weather sin estado duplicado',()=>{
  const w=scene(),api=makeWorldApi(()=>w,()=>null,()=>null).weather
  assert.equal(api.tornado.phase,'idle');assert.equal(api.startTornado({weatherTransition:0}),true)
  assert.equal(api.modifyTornado({direction:45}),true)
  assert.equal(api.tornado.heading,45)
  const snapshot=api.tornado;snapshot.heading=180;assert.equal(w.tornado.heading,45)
  assert.equal(api.stopTornado(),true);assert.equal(api.tornado.phase,'weakening')
})
test('WT-11: VFX nuevo sin concepto meteorológico',()=>{
  const r=newVfxResource('smoke','Smoke.vfx')
  assert.equal(Object.hasOwn(r.movement,'tornadoFlow'),false)
})
test('WT-12: migración comprobable de VFX legados sin mutar origen',()=>{
  const old=newVfxResource('legacy','Old.vfx');old.movement.space='world';old.movement.tornadoFlow=true
  const before=structuredClone(old),converted=migrateLegacyVfxResource(old)
  assert.equal(converted.migrated,true);assert.ok(converted.warnings[0].includes('World'))
  assert.equal(Object.hasOwn(converted.resource.movement,'tornadoFlow'),false)
  assert.deepEqual(old,before)
  assert.deepEqual(validateVfxResource(old),converted.resource)
})
test('WT-13: corrupción heredada rechazada, otros campos desconocidos también',()=>{
  const r=newVfxResource('id','A.vfx');r.movement.tornadoFlow='yes'
  assert.throws(()=>validateVfxResource(r),/legado/)
  delete r.movement.tornadoFlow;r.movement.weather='storm'
  assert.throws(()=>validateVfxResource(r),/desconocida/)
})
test('WT-14: influencia externa genérica en simulación, no en recurso',()=>{
  const r=newVfxResource('id','A.vfx');r.movement.space='world'
  const s=new VfxSimulation(r,{seed:4});let calls=0
  s.flowAt=()=>{calls++;return{x:2,y:4,z:6}}
  for(let i=0;i<60;i++)s.step()
  assert.ok(calls>0);assert.equal(Object.hasOwn(s.resource.movement,'tornadoFlow'),false)
})
test('WT-15: el tornado visual deja de poseer VFX temporal',()=>{
 const node=root('src/engine/runtime/nodes/vfx.js');const sky=root('src/engine/runtime/render/skylib.js')
 assert.doesNotMatch(node,/createWeatherVfx3D|weather-runtime/)
 assert.match(sky,/float atmosphericDensity\(vec3 p, bool full\)/)
 assert.doesNotMatch(sky,/vec4 tornadoCloudVolume\(/)
 assert.doesNotMatch(root('src/engine/runtime/events/play-tornado.js'),/VfxSimulation|VfxBillboardRenderer/)
})
test('WT-16: Play conserva fases, Jolt y eventos sin emisor temporal',()=>{
 const text=root('src/engine/runtime/events/play-tornado.js')
 assert.match(text,/w\.tornadoStep\(dt\)/)
 assert.match(text,/_tornadoEmit\('tornadoPhase'/)
 assert.match(text,/B\.impulse\(item,/)
 assert.doesNotMatch(text,/_tornadoWeatherVfx|_tornadoVisual/)
})
test('WT-17: Inspector expone meteorología sin selector VFX del tornado',()=>{
 const text=root('src/engine/runtime/world/params.js')
 assert.match(text,/Permitir tornados|tornadoMode|tornadoChance|tornadoDissipationSeconds/)
 assert.doesNotMatch(text,/key:'tornadoVfxNodeId'|Emisor VFX3D del tornado/)
})
test('WT-18: fase no modifica viento 2D ajeno',()=>{
  const w=scene();w.startTornado({weatherTransition:0});w.tornadoStep(2.5)
  const expected=w.windAt(6,8), v=w.windAt3D(6,8,8),t=w.tornadoWindAt(6,8,8)
  approx(v.x,expected.x+t.x);approx(v.z,expected.z+t.z)
})
test('WT-19: el director del tiempo conserva su transición existente',()=>{
  const w=scene({preset:'clear'});w.setWeather('storm',1,4)
  const old=w.cur.coverage;w.update(1)
  assert.ok(w.cur.coverage>old&&w.cur.coverage<1)
})
test('WT-20: parámetros normalizados no admiten modo/campos inválidos',()=>{
  const c=normalizeWeather({tornadoEnabled:true,tornadoMode:'unknown',tornadoChance:3})
  assert.equal(c.tornadoMode,'automatic');assert.equal(c.tornadoChance,1)
})
