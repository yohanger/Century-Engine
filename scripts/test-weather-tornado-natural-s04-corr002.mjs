import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SKY_FRAG, stormCoverFromFrame } from '../src/engine/runtime/render/skylib.js'
import { World } from '../src/engine/runtime/world/world.js'
const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8')
const env = read('src/engine/runtime/render/viewport-env.js')
const vp = read('src/engine/runtime/render/viewport.js')
const fog = read('src/engine/runtime/render/atmofog.js')

test('TA2-01: tormenta real activa cubierta derivada sin estado paralelo', () => {
  const w=new World(33).configure({weather:{on:true,preset:'storm',intensity:1}})
  const f=w.frame()
  assert.ok(stormCoverFromFrame(f)>0.9,JSON.stringify(f.clouds))
  assert.equal(stormCoverFromFrame(null),0)
  assert.equal(stormCoverFromFrame({...f,weatherOn:false}),0)
})
test('TA2-02: climas ordinarios no reciben cubierta de tormenta',()=>{
  for(const preset of ['clear','partly','cloudy','overcast','rain','fog']){
    const f=new World(5).configure({weather:{on:true,preset,intensity:1}}).frame()
    assert.equal(stormCoverFromFrame(f),0,preset)
  }
})
test('TA2-03: transiciones atmosféricas graduales sin saltos por preset',()=>{
  const mk=(coverage,density,type)=>({weatherOn:true,clouds:{on:true,coverage,density,type}})
  const seq=[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1].map(t=>stormCoverFromFrame(mk(.6+.4*t,1+t,.55+.45*t)))
  for(let i=1;i<seq.length;i++)assert.ok(seq[i]>=seq[i-1]&&seq[i]-seq[i-1]<.45)
})
test('TA2-04: el cielo físico atenúa el disco, no la dirección de luz global',()=>{
  assert.match(SKY_FRAG,/beamTransmission = uClouds == 1 \? 1\.0 : uSolarTransmission/)
  assert.match(SKY_FRAG,/col \+= solarDisk[\s\S]*col = col \* cl\.a \+ cl\.rgb/)
  assert.doesNotMatch(env,/uSunDir\.value\.set\(0,0,0\)/)
  assert.match(env,/u\.uStormCover\.value = stormCoverFromFrame\(w\)/)
})
test('TA2-05: el sol de catálogo y luna tampoco traspasan una tormenta espesa',()=>{
  assert.match(SKY_FRAG,/vec3 preCelestial = col/)
  assert.match(SKY_FRAG,/col = mix\(preCelestial, col, 1\.0 - 0\.97 \* uStormCover\)/)
})
test('TA2-06: la paleta manual conserva la luz y la cubierta meteorológica oscurece el cielo',()=>{
  assert.match(env,/lightingMode\(env\) === 'manual'/)
  assert.match(SKY_FRAG,/col = mix\(col, overcast, uStormCover\)/)
  assert.match(SKY_FRAG,/uCTint \* 0\.82 \+ uCAmb \* 0\.18/)
})
test('TA2-07: niebla FogExp2 que no recibía Sky se integra en el ShaderMaterial existente',()=>{
  assert.match(SKY_FRAG,/float tau = uSkyFogDensity \* skyDistance/)
  assert.match(SKY_FRAG,/float transmission = exp\(-tau \* tau\)/)
  assert.match(SKY_FRAG,/col = mix\(uSkyFogColor, col, transmission\)/)
  assert.match(vp,/uSkyFogDensity: \{ value: 0 \}/)
  assert.match(vp,/uSkyFogColor: \{ value: new THREE\.Color\(\) \}/)
})
test('TA2-08: la niebla simple es uniforme y la bruma meteorológica baja',()=>{
  const m=SKY_FRAG.match(/if \(uSkyFogDensity > 0\.0\) \{([\s\S]*?)\n  \}/)
  assert.ok(m)
  assert.doesNotMatch(m[1].split('if (uWeatherHazeFalloff')[0],/dir\.y|smoothstep|uStormCover/)
  assert.match(m[1],/uWeatherHazeFalloff \* max\(0\.0, dir\.y\)/)
})
test('TA2-09: el compositor físico conserva autoridad exclusiva sin doble niebla',()=>{
  assert.match(env,/this\._fogState\?\.physical && this\.look\?\._physFog/)
  assert.match(env,/skyFog\.uSkyFogDensity\.value =/)
  assert.match(fog,/class AtmosphericFogPass extends Pass/)
})
test('TA2-10: niebla física sigue usando sus fórmulas y su pase',()=>{
  const fogJs=read('src/engine/runtime/world/fog.js')
  assert.match(fogJs,/export function integrateHeight/)
  assert.match(fog,/float integHeight\(/)
  assert.match(fog,/this\.compMat\.uniforms\.tDiffuse\.value/)
})
test('TA2-11: toda la atmósfera se modifica sin VFX nuevo ni otra esfera',()=>{
  assert.equal((SKY_FRAG.match(/vec4 cl = cloudLayer\(dir\)/g)||[]).length,1)
  assert.doesNotMatch(SKY_FRAG,/tornadoCloudVolume|VfxSimulation/)
  assert.match(vp,/this\.sky = new THREE\.Mesh\(new THREE\.SphereGeometry/)
})
test('TA2-12: calidad GPU verificable con shader real y Electron',()=>{
  const fixture=read('scripts/fixtures/weather/tornado-natural-s04-corr002.html')
  const runner=read('scripts/test-weather-tornado-natural-electron-s04-corr002.mjs')
  assert.match(fixture,/SKY_VERT, SKY_FRAG/)
  assert.match(fixture,/tormenta cubre el horizonte/)
  assert.match(fixture,/niebla persiste al mirar arriba y abajo/)
  assert.match(fixture,/sol físico queda velado/)
  assert.match(runner,/verifyWebGL/)
})
