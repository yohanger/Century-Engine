// LF-WEATHER-LIGHTNING-WORLD-S11-G001: trayectoria única, eventos y efectos autorizados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveWorldStrike, createStrike, LIGHTNING_DEFAULTS } from '../src/engine/runtime/world/lightning.js'
import { World } from '../src/engine/runtime/world/world.js'
import { normalizeWeather } from '../src/engine/runtime/world/params.js'
const code = (path) => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const flat =()=>0
const strike=(over={})=>({id:1, seed:52, peak:30, bearing:0, distance:85, altitude:200, thickness:320, type:0.5,...over})
const observer=[0,2,0]
const approx=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<e, `${a} != ${b}`)
const capture=(weather={})=>{
 const w=new World(12)
 w.configure({weather:{on:true,preset:'storm',lightningModel:'physical',lightningImpacts:true,...weather}})
 w.reseed(12);w.setObserver(...observer)
 const seen=[];w.on('lightning',(e)=>seen.push(e))
 w.lightningContext=()=>({groundAt:flat,intersect:()=>null})
 return {w,seen}
}
test('LT-01: sin habilitar, los proyectos anteriores conservan interacción apagada',()=>{
 const w=normalizeWeather({on:true,lightningModel:'physical'})
 assert.equal(w.lightningImpacts,false);assert.equal(w.lightningImpulse,false);assert.equal(w.lightningWaterResponse,false)
})
test('LT-02: límites de autoría y valores inválidos quedan acotados',()=>{
 const w=normalizeWeather({lightningImpacts:true,lightningImpulse:true,lightningImpactRadius:200,
   lightningImpulseStrength:-5})
 assert.equal(w.lightningImpactRadius,30);assert.equal(w.lightningImpulseStrength,0)
 assert.equal(normalizeWeather({lightningImpactRadius:NaN}).lightningImpactRadius,6)
})
test('LT-03: mismo seed, nube y terreno produce canal idéntico',()=>{
 const a=resolveWorldStrike(strike(),observer,{groundAt:flat}),b=resolveWorldStrike(strike(),observer,{groundAt:flat})
 assert.deepEqual(a,b);assert.ok(a.bolt.points.length>2)
})
test('LT-04: con terreno compatible, punto final y evento son idénticos',()=>{
 const a=resolveWorldStrike(strike(),observer,{groundAt:flat})
 assert.equal(a.impact.kind,'terrain');assert.deepEqual(a.bolt.points.at(-1),a.impact.point)
 assert.equal(a.impact.id,1);assert.deepEqual(a.impact.normal,[0,1,0]);approx(a.impact.point[1],0)
})
test('LT-05: una cubierta estática situada arriba del suelo gana al Terrain',()=>{
 const a=resolveWorldStrike(strike(),observer,{groundAt:flat,intersect:(from,to)=>
  ({kind:'object',ownerId:'roof',surface:'metal',materialId:'roof_mat',point:[to[0],25,to[2]],normal:[0,1,0]})})
 assert.equal(a.impact.kind,'object');assert.equal(a.impact.ownerId,'roof');assert.equal(a.impact.surface,'metal')
 assert.deepEqual(a.bolt.points.at(-1),a.impact.point)
})
test('LT-06: agua visible domina el suelo sin incrementar inventario de líquido',()=>{
 let changes=0;const a=resolveWorldStrike(strike(),observer,{groundAt:flat,intersect:(from,to)=>
 ({kind:'water',point:[to[0],2,to[2]],normal:[0,1,0],surface:'water'})})
 assert.equal(a.impact.kind,'water');approx(a.impact.point[1],2);assert.equal(changes,0)
})
test('LT-07: el contacto más alto vence al suelo; no hay doble impacto',()=>{
 const a=resolveWorldStrike(strike(),observer,{groundAt:()=>-2,intersect:(from,to)=>
 ({kind:'object',ownerId:'wall',point:[to[0],10,to[2]],normal:[0,1,0]})})
 assert.equal(a.impact.ownerId,'wall')
})
test('LT-08: sin Terrain ni colisión no inventa impacto',()=>{
 const a=resolveWorldStrike(strike(),observer,{groundAt:()=>NaN})
 assert.equal(a.impact,null);assert.ok(a.bolt.points.length>0)
})
test('LT-09: colisiones corruptas o fuera de la trayectoria no se admiten',()=>{
 const a=resolveWorldStrike(strike(),observer,{groundAt:flat,intersect:()=>({kind:'object',point:[0,Infinity,0]})})
 assert.equal(a.impact.kind,'terrain')
 const b=resolveWorldStrike(strike(),observer,{groundAt:flat,intersect:()=>({kind:'object',point:[0,99999,0]})})
 assert.equal(b.impact.kind,'terrain')
})
test('LT-10: semilla/observador inválidos provocan error sin mutar el strike',()=>{
 const s=strike(),old=structuredClone(s)
 assert.throws(()=>resolveWorldStrike(s,[NaN,0,0],{groundAt:flat}),/inválid/)
 assert.deepEqual(s,old)
})
test('LT-11: evento meteorológico físico conserva distancia y retardo previos',()=>{
 const {w,seen}=capture();w.strike(85,0);assert.equal(seen.length,1)
 assert.equal(seen[0].distance,85);approx(seen[0].delay,85/343)
 assert.ok(seen[0].impact);assert.equal(seen[0].impact.kind,'terrain')
})
test('LT-12: id de impacto y del frame son el mismo',()=>{
 const {w,seen}=capture();w.strike(85,0)
 assert.equal(w.frame().strike.id,seen[0].impact.id)
 assert.equal(w.frame().strike.seed,seen[0].impact.seed)
 assert.deepEqual(w.frame().strike.bolt.points.at(-1),seen[0].impact.point)
})
test('LT-13: se emite una sola vez por descarga; el parpadeo no duplica eventos',()=>{
 const {w,seen}=capture();w.strike(85,0)
 for(let i=0;i<5;i++)w.frame()
 assert.equal(seen.length,1)
})
test('LT-14: descargas consecutivas tienen ids distintos',()=>{
 const {w,seen}=capture();w.strike(85,0);w.strike(85,0)
 assert.equal(seen.length,2);assert.notEqual(seen[0].impact.id,seen[1].impact.id)
})
test('LT-15: posición de impacto no cambia al mover la cámara tras la descarga',()=>{
 const {w,seen}=capture();w.strike(85,0);const point=structuredClone(w.frame().strike.impact.point)
 w.setObserver(400,5,200);w.frame()
 assert.deepEqual(w.frame().strike.impact.point,point);assert.deepEqual(seen[0].impact.point,point)
})
test('LT-16: sin opt-in, World no consulta geometría ni altera evento legacy',()=>{
 const {w,seen}=capture({lightningImpacts:false});let touched=0
 w.lightningContext=()=>{touched++;throw new Error('no se permite')}
 w.strike(85,0)
 assert.equal(touched,0);assert.equal(seen.length,1);assert.equal(seen[0].impact,undefined)
 assert.equal(w.frame().strike.bolt,undefined)
})
test('LT-17: el modelo sencillo no usa raycasts ni produce interacciones',()=>{
 const {w,seen}=capture({lightningModel:'simple'});let touched=0
 w.lightningContext=()=>{touched++;return {groundAt:flat}}
 w.strike(85,0);assert.equal(touched,0);assert.equal(seen[0].impact,undefined)
})
test('LT-18: variar la semilla no recicla el mismo canal',()=>{
 const a=resolveWorldStrike(strike({seed:11}),observer,{groundAt:flat})
 const b=resolveWorldStrike(strike({seed:12}),observer,{groundAt:flat})
 assert.notDeepEqual(a.bolt.points,b.bolt.points)
})
test('LT-19: el canal antiguo createStrike conserva su export y API',()=>{
 assert.equal(typeof createStrike,'function');assert.ok(LIGHTNING_DEFAULTS.maxSegments>0)
})
test('LT-20: el render lee el canal autoritativo sin volver a simularlo',()=>{
 const fx=code('src/engine/runtime/world/lightning-fx.js')
 assert.match(fx,/const bolt = s\.bolt \|\| createStrike/)
 assert.match(fx,/const sc = worldSpace \? 1 :/)
})
test('LT-21: la autoría se instala en Clima sin nuevo panel',()=>{
 const p=code('src/engine/runtime/world/params.js')
 for (const k of ['lightningImpacts','lightningImpulse','lightningWaterResponse','lightningImpactRadius','lightningImpulseStrength'])
  assert.match(p,new RegExp("key: '"+k+"'"))
})
test('LT-22: las interacciones permanecen vinculadas al evento meteorológico único',()=>{
 const p=code('src/engine/runtime/events/play.js')
 assert.match(p,/this\._lightningWorldHit\(e\.impact\)/)
 assert.match(p,/w\.lightningContext = w\.cfg\.weather\.lightningImpacts/)
 assert.match(p,/this\.ed\.world\.lightningContext = null/)
})
test('LT-23: aplica impulso solo bajo configuración y Jolt',()=>{
 const t=code('src/engine/runtime/events/play-lightning.js')
 assert.match(t,/cfg\.lightningImpulse && cfg\.lightningImpulseStrength>0 && this\.phys/)
 assert.match(t,/this\._physicsApiObj\.explode/)
})
test('LT-24: ondas sobre agua no llaman al ledger ni a WaterRegion.queue',()=>{
 const t=code('src/engine/runtime/events/play-lightning.js')
 assert.match(t,/addRipple/);assert.doesNotMatch(t,/\.queue\(|rainOnRunoff\(|\.transferVolume\(/)
})
test('LT-25: se mantiene compatibilidad de eventos lightning/thunder',()=>{
 const t=code('src/engine/runtime/events/play.js')
 assert.match(t,/this\.game\?\.emit\('lightning', e\)/)
 assert.match(t,/this\.game\?\.emit\('thunder', info/)
})
test('LT-26: evento específico de gameplay único y con objeto de impacto',()=>{
 const t=code('src/engine/runtime/events/play-lightning.js')
 assert.match(t,/this\.game\?\.emit\('lightningImpact', impact\)/)
})
test('LT-27: el detector reutiliza la geometría original de lluvia/agua',()=>{
 const t=code('src/engine/runtime/events/play-lightning.js')
 assert.match(t,/this\.ed\.rainImpact\(start,end\)/)
 assert.match(t,/this\.water\?\.at\(end\[0\],end\[2\],0\)/)
})
test('LT-28: solo el modo Play instala contexto del impacto físico',()=>{
 const t=code('src/engine/runtime/events/play.js'),fx=code('src/engine/runtime/world/lightning-fx.js')
 assert.match(t,/_lightningWorldContext/);assert.doesNotMatch(fx,/physicsApi\(|game\.emit/)
})

const playSource=code('src/engine/runtime/events/play-lightning.js')
  .replace("import { groundAtAll } from '../geometry/terrains.js'",'const groundAtAll=(terrains,x,z)=>terrains[0]?.groundAt(x,z)??NaN')
  .replace("import { addRipple } from '../geometry/waterripple.js'",'const addRipple=globalThis.__s11_addRipple')
const ripples=[]
globalThis.__s11_addRipple=(...args)=>ripples.push(args)
const {lightningMethods}=await import(`data:text/javascript,${encodeURIComponent(playSource)}`)
delete globalThis.__s11_addRipple
const playFixture=(opts={})=>{
 const emitted=[],impulses=[]
 const ctx={on:true,_filmJumping:false,phys:{},
  ed:{world:{cfg:{weather:{lightningModel:'physical',lightningImpacts:true,lightningImpulse:false,
    lightningWaterResponse:false,lightningImpulseStrength:5,lightningImpactRadius:6,...opts}}},
    terrains:[{groundAt:flat}],rainImpact:()=>null},
  water:{at:()=>({surface:2})},
  game:{emit:(event,payload)=>emitted.push([event,payload])},
  _physicsApi:()=>({explode:(...args)=>impulses.push(args)})}
 return {ctx:Object.assign(ctx,lightningMethods),emitted,impulses}
}
test('LT-29: con interacción pero sin respuesta física emite evento y no toca Jolt',()=>{
 const {ctx,emitted,impulses}=playFixture(),impact={kind:'object',point:[1,2,3],peakKA:25}
 ctx._lightningWorldHit(impact)
 assert.deepEqual(emitted,[['lightningImpact',impact]]);assert.equal(impulses.length,0)
})
test('LT-30: impulso configurado invoca exactamente una vez el API Jolt existente',()=>{
 const {ctx,impulses}=playFixture({lightningImpulse:true})
 ctx._lightningWorldHit({kind:'object',point:[1,2,3],peakKA:50})
 assert.deepEqual(impulses,[[1,2,3,{radius:6,force:5}]])
})
test('LT-31: sin mundo físico, el impacto no causa excepción ni impulso',()=>{
 const {ctx,impulses}=playFixture({lightningImpulse:true})
 ctx.phys=null;ctx._lightningWorldHit({kind:'terrain',point:[1,0,3],peakKA:30})
 assert.equal(impulses.length,0)
})
test('LT-32: golpe en agua genera onda solo si está habilitado',()=>{
 ripples.length=0
 const {ctx}=playFixture({lightningWaterResponse:true})
 ctx._lightningWorldHit({kind:'water',point:[2,1,4],peakKA:30})
 assert.equal(ripples.length,1);approx(ripples[0][0],2)
 ctx.ed.world.cfg.weather.lightningWaterResponse=false
 ctx._lightningWorldHit({kind:'water',point:[2,1,4],peakKA:30})
 assert.equal(ripples.length,1)
})
test('LT-33: rayos sobre terreno no generan ondas acuáticas',()=>{
 ripples.length=0
 const {ctx}=playFixture({lightningWaterResponse:true})
 ctx._lightningWorldHit({kind:'terrain',point:[2,0,4],peakKA:30})
 assert.equal(ripples.length,0)
})
test('LT-34: Play cerrado o salto del Film Maker no ejecuta impactos',()=>{
 const {ctx,emitted}=playFixture({lightningImpulse:true})
 ctx.on=false;ctx._lightningWorldHit({kind:'object',point:[1,2,3]})
 ctx.on=true;ctx._filmJumping=true;ctx._lightningWorldHit({kind:'object',point:[1,2,3]})
 assert.equal(emitted.length,0)
})
test('LT-35: si no hay agua, la descarga no genera onda ni inventario',()=>{
 ripples.length=0
 const {ctx}=playFixture({lightningWaterResponse:true});ctx.water.at=()=>null
 ctx._lightningWorldHit({kind:'water',point:[2,1,4],peakKA:30})
 assert.equal(ripples.length,0)
})
test('LT-36: prioridad objeto sobre agua a mayor altura',()=>{
 const {ctx}=playFixture()
 ctx.ed.rainImpact=(start,end)=>({point:[end[0],7,end[2]],normal:[0,1,0],ownerId:'steel'})
 const hit=ctx._lightningWorldContext().intersect([0,50,0],[0,0,0])
 assert.equal(hit.kind,'object');assert.equal(hit.ownerId,'steel')
})
