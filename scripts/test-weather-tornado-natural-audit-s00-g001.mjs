// S00: diagnóstico del modelo actual. Los huecos son hallazgos, no requisitos implementados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'
import { tornadoVisualState } from '../src/engine/runtime/world/tornado-visual.js'
import { SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const worldSrc = read('src/engine/runtime/world/world.js')
const cloudSrc = read('src/engine/runtime/world/cloudfield.js')
const querySrc = read('src/engine/runtime/world/cloudfield-query.js')
const envSrc = read('src/engine/runtime/render/viewport-env.js')
const skySrc = read('src/engine/runtime/render/skylib.js')
const w = () => new World(31).configure({ weather: { on:true, preset:'storm', cloudModel:'classic', tornadoEnabled:true, tornadoMode:'script', tornadoDevelopmentSeconds:2, tornadoOrganizationSeconds:2, tornadoFormationSeconds:2, tornadoDuration:3, tornadoWeakeningSeconds:2, tornadoDissipationSeconds:2 } })
test('TN-AUD-01: World conserva fase única y empieza inactivo', () => {
  const a=w();assert.equal(a.tornado.phase,'idle');assert.equal(a.tornado.active,false);assert.strictEqual(a.frame().tornado,a.tornado)
})
test('TN-AUD-02: desarrollo y organización no aplican fuerza tornádica', () => {
  const a=w();assert.equal(a.startTornado({ weatherTransition:0 }),true);a.tornadoStep(1);assert.equal(a.tornado.phase,'development');assert.equal(a.tornado.active,false);a.tornadoStep(2);assert.equal(a.tornado.phase,'organization');assert.equal(a.tornado.active,false)
})
test('TN-AUD-03: formación/activo avanzan sin crear un segundo World', () => {
  const a=w();a.startTornado({weatherTransition:0});a.tornadoStep(5);assert.equal(a.tornado.phase,'formation');a.tornadoStep(2);assert.equal(a.tornado.phase,'active');assert.equal(a.tornado.active,true)
})
test('TN-AUD-04: condensación visible es una función derivada, no la física', () => {
  const a=w();a.startTornado({weatherTransition:0});let v=tornadoVisualState(a.tornado,900);assert.ok(v.reach>0);assert.equal(a.tornado.active,false);assert.equal(a.tornado.radius,a.cfg.weather.tornadoRadius)
})
test('TN-AUD-05: modos clásico y celdas crean solo un CloudField opcional', () => {
  const a=w();assert.equal(a.field,null);const b=new World(31).configure({weather:{on:true,preset:'storm',cloudModel:'cells',cloudSeed:123,tornadoEnabled:true,tornadoMode:'script'}});assert.ok(b.field)
})
// S00 detectó la ausencia de vínculo; S01 la resuelve sin alterar la consulta de rayos.
test('TN-AUD-06: S01 conserva la búsqueda de rayos e incorpora vínculo independiente', () => {
  assert.match(querySrc,/lightningOrigin\(x, z, maxDistance\)/)
  assert.match(worldSrc,/nearestStorm\(maxDistance/)
  assert.match(worldSrc,/this\.field\.selectTornadoMother\(t\.x, t\.z\)/)
})
test('TN-AUD-07: tras S02, el shader conserva la raíz sin la segunda composición', () => {
  assert.match(SKY_FRAG,/float tornadoCloudRoot\(/)
  assert.doesNotMatch(SKY_FRAG,/vec4 tornadoCloudVolume\(/)
  assert.match(SKY_FRAG,/vec4 cl = cloudLayer\(dir\);/)
})
test('TN-AUD-08: el embudo puede existir aunque la celda no contenga nubes', () => {
  assert.match(SKY_FRAG,/if \(cov <= 0\.004\) return root;/);assert.match(SKY_FRAG,/if \(cov <= 0\.002\) return root;/)
})
// S00 documentó ondas simples; S04 sustituye su silueta por erosión y cizalladura del mismo campo.
test('TN-AUD-09: S04 conserva una sola raíz y columna, con ruido compartido y cizalladura visual', () => {
  assert.match(SKY_FRAG,/float wrinkle = \(mass - 0\.5\)/)
  assert.match(SKY_FRAG,/float spiral = sin\(atan\(rel\.y, rel\.x\)/)
  assert.match(SKY_FRAG,/vec2 bend = uTornadoCloud\.z \* shear/)
})
test('TN-AUD-10: Viewport transmite radio, base, fase y posición sin parent key de nube', () => {
  assert.match(envSrc,/tornadoVisualState\(t, base/);assert.match(envSrc,/u\.uTornadoCloud\.value\.set\(t\?\.x/);assert.match(envSrc,/u\.uTornadoShape\.value\.set\(t\?\.y/);assert.doesNotMatch(envSrc,/tornadoParentCloud|parentCloudKey/)
})
test('TN-AUD-11: presupuesto S02 comparte marcha con hasta 12 muestras inferiores', () => {
  assert.match(skySrc,/int funnelSteps = funnelFar > funnelNear \? 12 : 0/)
  assert.match(skySrc,/for \(int i=0;i<76;i\+\+\)/)
  assert.match(skySrc,/for \(int j=0;j<4;j\+\+\)/)
})
test('TN-AUD-12: la nube por celdas tiene semilla configurable y mapa residente', () => {
  assert.match(cloudSrc,/export class CloudField/);assert.match(cloudSrc,/_signature\(\)/);assert.match(cloudSrc,/maintain\(x, z, dt = 0, force = false\)/)
})
test('TN-AUD-13: la fase ended, apagado y ausencia deben limpiar el cielo', () => {
  const a=w();assert.equal(tornadoVisualState(a.tornado).opacity,0);a.startTornado({weatherTransition:0});a.stopTornado(true);assert.equal(tornadoVisualState(a.tornado).opacity,0);assert.match(envSrc,/v && v\.opacity > 0\.005 \? v\.opacity : 0/)
})
test('TN-AUD-14: no se incorpora VFX3D meteorológico al shader de condensación', () => {
  assert.doesNotMatch(skySrc,/new VfxSimulation|createWeatherVfx3D|THREE\.Points/)
  assert.match(read('docs/architecture/LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md'),/SUPERSEDIDA/)
})
test('TN-AUD-15: documentación S00 diferencia hechos, propuesta y QA real', () => {
  const d=read('docs/architecture/LF-WEATHER-TORNADO-NATURAL-S00-G001_AUDIT.md')
  for(const needle of ['OBSERVADO','INFERENCIA','NO VERIFICADO','NUBE MADRE','MODO CLÁSICO','CA-001 PROPUESTO']) assert.ok(d.includes(needle),needle)
})
test('TN-AUD-16: QA Electron usa el fixture real existente sin navegador externo', () => {
  const s=read('scripts/test-weather-tornado-natural-electron-s00-g001.mjs')
  assert.match(s,/verifyWebGL\(/);assert.match(s,/tornado-cohesion\.html/);assert.doesNotMatch(s,/chromium|Brave|puppeteer/)
})
