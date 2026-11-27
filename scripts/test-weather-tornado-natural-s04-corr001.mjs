import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
import { World } from '../src/engine/runtime/world/world.js'
import { tornadoVisualState, tornadoFunnelRadius } from '../src/engine/runtime/world/tornado-visual.js'
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const env = read('src/engine/runtime/render/viewport-env.js')
const params = read('src/engine/runtime/world/params.js')
const wind = read('src/engine/runtime/world/windfield.js')
const root = SKY_FRAG.slice(SKY_FRAG.indexOf('float tornadoCloudRoot('),SKY_FRAG.indexOf('// La condensación del embudo'))
const funnel = SKY_FRAG.slice(SKY_FRAG.indexOf('float tornadoCondensation('),SKY_FRAG.indexOf('// hf = altura relativa'))
const march = SKY_FRAG.slice(SKY_FRAG.indexOf('vec4 cloudLayer('),SKY_FRAG.indexOf('// estrellas: celdas 3D'))
const durations = {development:8, organization:6, formation:5, weakening:5, dissipation:5}
const state=(phase,phaseAge)=>tornadoVisualState({phase,phaseAge,radius:25,height:65,y:0,duration:50,active:phase==='active'},900,durations)
const eps=1e-6

test('TC4-01: desarrollo y organización prolongan la nube sin activar viento físico',()=>{
 const a=state('development',4),b=state('organization',3),c=state('formation',0.5)
 assert.ok(a.reach>0 && a.reach<0.05)
 assert.ok(b.reach>a.reach && b.reach<0.18)
 assert.ok(c.reach>b.reach)
 const w=new World(23).configure({weather:{on:true,preset:'storm',tornadoEnabled:true,tornadoMode:'script'}})
 w.startTornado({weatherTransition:0});w.tornadoStep(4)
 assert.equal(w.tornado.active,false)
})
test('TC4-02: fases sin saltos de longitud ni opacidad al cambiar de etapa',()=>{
 for(const [a,sa,b] of [['development',8,'organization'],['organization',6,'formation'],['formation',5,'active']]) {
   const left=state(a,sa),right=state(b,0)
   assert.ok(Math.abs(left.reach-right.reach)<eps, `${a} -> ${b}: reach`)
   assert.ok(Math.abs(left.opacity-right.opacity)<eps, `${a} -> ${b}: opacity`)
 }
})
test('TC4-03: progresión no decreciente y punta llega a base física solo al estar activo',()=>{
 const series=[...Array.from({length:9},(_,i)=>state('development',i)), ...Array.from({length:7},(_,i)=>state('organization',i)), ...Array.from({length:6},(_,i)=>state('formation',i)),state('active',0)]
 for(let i=1;i<series.length;i++) assert.ok(series[i].reach+eps>=series[i-1].reach)
 assert.equal(series.at(-1).reach,1)
 assert.equal(series.at(-1).ground,true)
 assert.equal(state('organization',6).ground,false)
})
test('TC4-04: radio geométrico crece en el tramo VISIBLE, nunca es cilindro uniforme',()=>{
 const active=state('active',10)
 const radii=[0,0.25,0.5,0.75,1].map(h=>tornadoFunnelRadius(active,h))
 for(let i=1;i<radii.length;i++) assert.ok(radii[i]>radii[i-1]*1.04)
 assert.ok(radii[4]>radii[0]*10)
 assert.match(funnel,/float hVisible = clamp\(\(wp\.y - bottomY\)/)
 assert.match(funnel,/pow\(hVisible, 1\.62\)/)
 assert.doesNotMatch(funnel,/mix\(0\.16, 0\.94, pow\(h, 1\.28\)\)/)
})
test('TC4-05: la punta se reduce y redondea, sin base plana cortada',()=>{
 assert.match(funnel,/float foot = smoothstep\(0\.0, min\(18\.0, \(topY-bottomY\)\*0\.16\), wp\.y-bottomY\)/)
 assert.match(funnel,/return envelope \* .* \* foot;/)
 assert.match(funnel,/if \(wp\.y < bottomY \|\| wp\.y > topY\) return 0\.0;/)
})
test('TC4-06: topY es base de la nube existente, no altura artificial del Inspector',()=>{
 assert.match(funnel,/float topY = max\(uTornadoShape\.y, uTornadoShape\.x \+ 1\.0\)/)
 assert.match(march,/float bottomY = mix\(uTornadoShape\.y,uTornadoShape\.x/)
 assert.doesNotMatch(env,/tornadoHeight/)
})
test('TC4-07: Inspector distingue alcance vertical de viento y no cambia clave persistida',()=>{
 assert.match(params,/key:'tornadoHeight', label:'Alcance del viento \(m\)'/)
 assert.match(params,/Límite vertical de la fuerza física/)
 assert.match(params,/tornadoHeight: 65/)
 assert.match(wind,/h>=v\.height/)
})
test('TC4-08: único puente visual deriva el progreso de World, sin anulaciones por fase',()=>{
 assert.match(env,/v\?\.reach \?\? 0, v\?\.rope \?\? 1\)/)
 assert.doesNotMatch(env,/includes\(v\.phase\) \? 0/)
 assert.match(env,/tornadoVisualState\(t, base/)
})
test('TC4-09: sin tornado, no cambia cielo ni aparece volumen adicional',()=>{
 assert.match(root,/if \(uTornadoCloud\.w <= 0\.001\) return 0\.0/)
 assert.match(funnel,/if \(uTornadoCloud\.w <= 0\.005/)
 assert.match(march,/if \(uTornadoCloud\.w > 0\.005 && uTornadoShape\.z > 0\.005\)/)
 assert.equal((SKY_FRAG.match(/vec4 cl = cloudLayer\(dir\);/g)||[]).length,1)
})
test('TC4-10: no reaparece el artefacto CORR-002 por intersección vacía',()=>{
 assert.match(march,/float lowerOpacity=clamp\(1\.0-lowerT,0\.0,1\.0\)/)
 assert.match(march,/return vec4\(acc,T\)/)
 assert.doesNotMatch(march,/if \(funnelSteps==0\)/)
})
test('TC4-11: sin vfx adicionales ni modificaciones de física del viento',()=>{
 assert.doesNotMatch(SKY_FRAG,/new THREE|VfxSimulation|VfxBillboardRenderer|tornadoCloudVolume/)
 assert.match(funnel,/texture\(uShape, q \* 2\.0/)
 assert.match(root,/texture\(uShape, q \+/)
})
test('TC4-12: mantiene coste acotado 64 nubes y 12 muestras inferiores',()=>{
 assert.match(march,/int funnelSteps = funnelFar > funnelNear \? 12 : 0/)
 assert.match(march,/for \(int i=0;i<76;i\+\+\)/)
})
test('TC4-13: fixture Electron comprueba la nueva formación con shader real',()=>{
 const fixture=read('scripts/fixtures/weather/tornado-natural-s04.html')
 assert.match(fixture,/inicio del descenso desde la nube/)
 assert.match(fixture,/maduración no adelanta la fuerza física/)
 const electron=read('scripts/test-weather-tornado-natural-electron-s04-corr001.mjs')
 assert.match(electron,/verifyWebGL\(/)
 assert.doesNotMatch(electron,/Brave|puppeteer/)
})
