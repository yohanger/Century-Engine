import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'
import { PRESETS } from '../src/engine/runtime/world/weather.js'
const code = p => readFileSync(new URL('../'+p, import.meta.url),'utf8')
const fixture = code('scripts/fixtures/weather/storm-activation.html')
const precipitation = code('src/engine/runtime/world/fx.js')
const viewport = code('src/engine/runtime/render/viewport.js')

test('SA-01: los presets mantienen precipitación desactivada hasta Llovizna',()=>{
  for(const preset of ['clear','partly','cloudy','overcast']) assert.equal(PRESETS[preset].rain,0)
  for(const preset of ['drizzle','rain','storm']) assert.ok(PRESETS[preset].rain>0)
})
test('SA-02: el mundo sin tornados sigue generando precipitación',()=>{
  const w=new World(21)
  w.configure({weather:{on:true,preset:'drizzle',tornadoEnabled:false,lightning:false,director:false}})
  w.update(0.05,{clock:false})
  assert.equal(w.tornado,null)
  assert.ok(w.frame().precip.rain>0)
})
test('SA-03: PrecipFX crea cuatro objetos ocultos en el constructor',()=>{
  assert.match(precipitation,/this\.rain\s*=\s*new THREE\.Mesh/)
  assert.match(precipitation,/this\.mist\s*=\s*new THREE\.Mesh/)
  assert.match(precipitation,/this\.snow\s*=\s*new THREE\.Points/)
  assert.match(precipitation,/this\.splash\s*=\s*new THREE\.Mesh/)
  assert.match(precipitation,/o\.visible\s*=\s*false/)
})
test('SA-04: lluvia y bruma cambian juntas de visibilidad',()=>{
  assert.match(precipitation,/this\.rain\.visible\s*=\s*this\.mist\.visible\s*=\s*rainScale\s*>\s*0\.01/)
  assert.match(viewport,/this\.precip\.update\(/)
})
test('SA-05: el diagnóstico usa el Viewport y World existentes y aísla subsistemas',()=>{
  for(const needle of ['new Viewport(', 'new World(', 'setWeather(', 'vp.setWorld(', "['rain','mist','splash']", "['sky']", 'gpuError', 'uuid', 'nearlyBlackPixels']) assert.ok(fixture.includes(needle), needle)
})
test('SA-06: el diagnóstico no crea otro Player ni requiere navegador externo',()=>{
  const runner = code('scripts/test-weather-storm-activation-electron-g001.mjs')
  assert.match(runner,/verifyWebGL/)
  assert.doesNotMatch(runner,/spawnSync|chromium|brave-browser/)
})
