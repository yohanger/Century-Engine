import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'
import { SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
import { tornadoVisualState } from '../src/engine/runtime/world/tornado-visual.js'
const file = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')
const shader = SKY_FRAG
const setup=(cloudModel='classic')=>new World(55).configure({weather:{on:true,preset:'storm',cloudModel,cloudSeed:144,
  tornadoEnabled:true,tornadoMode:'script',tornadoDevelopmentSeconds:3,tornadoOrganizationSeconds:3,
  tornadoFormationSeconds:4,tornadoDuration:5,tornadoWeakeningSeconds:3,tornadoDissipationSeconds:3}})
test('TN2-01: Sky conserva único ShaderMaterial y campos S01',()=>{
 const v=file('src/engine/runtime/render/viewport.js')
 assert.equal((v.match(/this\.skyMat = new THREE\.ShaderMaterial\(/g)||[]).length,1)
 assert.match(shader,/organizedCloudOffset\(/)
 assert.match(shader,/uTornadoOrganization/)
})
test('TN2-02: desaparece composición posterior de la capa del embudo',()=>{
 assert.doesNotMatch(shader,/tornadoCloudVolume\(/)
 assert.match(shader,/vec4 cl = cloudLayer\(dir\);\s*col = col \* cl\.a \+ cl\.rgb;/)
 assert.equal((shader.match(/vec4 cl = cloudLayer\(dir\);/g)||[]).length,1)
})
test('TN2-03: toda densidad usa una función de extinción con nube madre y condensación',()=>{
 assert.match(shader,/float atmosphericDensity\(vec3 p, bool full\)/)
 assert.match(shader,/d = cloudDensity\(p, hf, full\)/)
 assert.match(shader,/return max\(d, tornadoCondensation\(p\)\)/)
 assert.match(shader,/float d=atmosphericDensity\(p,true\)/)
})
test('TN2-04: orden espacial, un solo T/acc y dispersión para nube y columna',()=>{
 const s=shader.slice(shader.indexOf('vec4 cloudLayer(vec3 rd) {'),shader.indexOf('// estrellas: celdas 3D'))
 assert.match(s,/float T=1\.0, lowerT=1\.0;vec3 acc=vec3\(0\.0\)/)
 assert.match(s,/bool inCloud=tc<=tf/)
 assert.match(s,/acc\+=T\*alpha\*\(sunL\+ambL\)\*uCTint/)
 assert.match(s,/T\*=1\.0-alpha/)
 assert.doesNotMatch(s,/vec4 funnel\s*=|\bsecondPass\b/)
})
test('TN2-05: capacidad máxima 64 nubes +12 parte inferior, sin otro recorrido',()=>{
 assert.match(shader,/for \(int i=0;i<76;i\+\+\)/)
 assert.match(shader,/int funnelSteps = funnelFar > funnelNear \? 12 : 0/)
 assert.match(shader,/int cloudSteps = cloudFar > cloudNear \? uCloudSteps : 0/)
 assert.match(shader,/if \(\(ci>=cloudSteps && fi>=funnelSteps\) \|\| T<0\.02\) break/)
})
test('TN2-06: sin tornado no se calcula recorrido inferior ni material extra',()=>{
 assert.match(shader,/if \(uTornadoCloud\.w > 0\.005 && uTornadoShape\.z > 0\.005\)/)
 assert.match(shader,/if \(cloudSteps == 0 && funnelSteps == 0\)/)
 assert.match(shader,/if \(rd\.y < 0\.0 && uCamY >= 0\.0\)/)
})
test('TN2-07: debajo de nube se toma y real; no se clampa densidad de nube fuera de su capa',()=>{
 assert.match(shader,/if \(altitude >= uCBase && altitude <= uCBase \+ uCThick\)/)
 assert.match(shader,/float bottomY = mix\(uTornadoShape\.y,uTornadoShape\.x/)
 assert.match(shader,/float topY = min\(uCBase,max\(bottomY\+1\.0,uTornadoShape\.y\)\)/)
})
test('TN2-08: rayo ascendente, descendente y casi horizontal usan intersección ordenada',()=>{
 assert.match(shader,/return vec2\(min\(q,other\), max\(q,other\)\)/)
 assert.match(shader,/vec2 outer = cloudSphereHits\(rd, uCBase \+ uCThick\)/)
 assert.match(shader,/vec2 inner = cloudSphereHits\(rd, uCBase\)/)
 assert.match(shader,/cloudFar = min\(cloudFar, inner.x\)/)
 assert.match(shader,/else if \(inner.y > cloudNear\) cloudNear = inner.y/)
})
test('TN2-09: la iluminación solar y ambiental comparten la dispersión del paso',()=>{
 assert.match(shader,/for \(int j = 0; j < 4; j\+\+\)/)
 assert.match(shader,/depth \+= atmosphericDensity\(p \+ dir \* \(distance \+ stepLen \* 0\.5\), false\) \* stepLen/)
 assert.match(shader,/vec3 sunL = \(uSunColor \* sunScatter.x \+ uMoonColor \* moonScatter.x\) \* uCLight/)
 assert.match(shader,/vec3 ambL=uCAmb\*mix/)
})
test('TN2-10: el cono puede estar incompleto sin alterar fuerza física',()=>{
 const w=setup();w.startTornado({weatherTransition:0});w.tornadoStep(7)
 const t=w.tornado, v=tornadoVisualState(t,900,{development:3,organization:3,formation:4})
 assert.equal(t.phase,'formation');assert.ok(v.reach>0 && v.reach<1)
 assert.equal(t.radius,w.cfg.weather.tornadoRadius)
 assert.match(shader,/float bottomY = mix\(topY, uTornadoShape\.x, clamp\(uTornadoShape\.z/)
})
test('TN2-11: en ambos modos se conserva World y el vínculo madre',()=>{
 for(const mode of ['classic','cells']) {
  const w=setup(mode);w.startTornado({weatherTransition:0});w.tornadoStep(2);const f=w.frame()
  assert.strictEqual(f.tornado,w.tornado)
  assert.equal(f.clouds.cells,mode==='cells')
  if(mode==='cells')assert.ok(Number.isSafeInteger(w.tornado.motherKey))
 }
})
test('TN2-12: el cielo no depende de VFX3D ni introduce partículas adicionales',()=>{
 assert.doesNotMatch(shader,/VfxSimulation|VfxBillboardRenderer|new THREE/)
 assert.match(file('src/engine/runtime/render/viewport.js'),/this\.sky = new THREE\.Mesh/)
})
test('TN2-13: fixture de QA usa Electron con capturas de distintas alturas',()=>{
 const fixture=file('scripts/fixtures/weather/tornado-natural-s02.html')
 assert.match(fixture,/cam\.position\.set\(0,1200,0\)/)
 assert.match(fixture,/difference\(downwardOn,downwardOff\)>0/)
 const runner=file('scripts/test-weather-tornado-natural-electron-s02-g001.mjs')
 assert.match(runner,/verifyWebGL\(/);assert.doesNotMatch(runner,/puppeteer|brave|spawnSync/)
})
test('TN2-14: la ruta de profundidad de la escena existe, pero no autoriza certificar oclusión atmosférica',()=>{
 const look=file('src/engine/runtime/render/look.js')
 assert.match(look,/depthTexture = new THREE\.DepthTexture/)
 assert.match(file('src/engine/runtime/render/viewport.js'),/this\.sky\.renderOrder = -10/)
})

test('TN2-15: alcance cero apaga columna inferior, no raíz de nube madre S01',()=>{
 const root=shader.slice(shader.indexOf('float tornadoCloudRoot('),shader.indexOf('float tornadoCondensation('))
 const funnel=shader.slice(shader.indexOf('float tornadoCondensation('),shader.indexOf('// hf = altura relativa'))
 assert.match(root,/uTornadoCloud\.w <= 0\.001/)
 assert.doesNotMatch(root,/uTornadoShape\.z/)
 assert.match(funnel,/uTornadoShape\.z <= 0\.005/)
})
test('TN2-16: fixture compara raíz sin embudo contra raíz con embudo y restaura cielo',()=>{
 const fixture=file('scripts/fixtures/weather/tornado-natural-s02.html')
 assert.match(fixture,/const rootOnly=capture\(\)/)
 assert.match(fixture,/const withFunnel=capture\(\)/)
 assert.match(fixture,/difference\(rootOnly,withFunnel\)>0/)
 assert.match(fixture,/difference\(before,zero\)===0/)
 const runner=file('scripts/qa-electron-webgl-runner.mjs')
 assert.match(runner,/serverLog/)
 assert.match(runner,/Vite finalizó con estado/)
})
