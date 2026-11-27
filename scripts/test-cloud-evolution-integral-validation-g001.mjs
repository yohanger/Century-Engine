// LF-CLOUD-EVOLUTION-S00-G001: QA de caracterización del baseline, sin modificar producción.
// Los casos que reproducen limitaciones deben pasar SOLO cuando se acredita el comportamiento actual.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CloudVolume } from '../src/engine/runtime/world/cloud-volume.js'
import { MORPH_TYPE } from '../src/engine/runtime/world/cloudfield.js'
import { World } from '../src/engine/runtime/world/world.js'
import { CLOUD_VOLUME_DENSITY } from '../src/engine/runtime/render/sky-cloud-volume.js'

const src = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const forcing = { coverage: 0.8, humidity: 0.98, storm: 0.3 }
const baseMap = () => ({ N: 32, half: 3200, cx: 0, cz: 0, slabBase: 700, slabThick: 1400 })
const source = (x = 0, type = MORPH_TYPE[3]) => ({ x, y: 1400, z: 0, rx: 850, ry: 600, rz: 850, str: 1.2, type })
function init(map, volumes = [source()]) {
  const volume = new CloudVolume(map)
  volume.rebuild(map, volumes)
  volume.advance(0, forcing, [0, 0])
  return volume
}
const near = (actual, expected, tolerance = 0.011) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (tol ${tolerance})`)

test('G001-01 | modelo 3D mantiene exclusivamente dos muestras temporales por voxel', () => {
  const map = baseMap(), v = init(map)
  assert.equal(v.data.length, v.N * v.N * v.depth * 2)
  assert.equal(v.depth, 16)
  assert.match(CLOUD_VOLUME_DENSITY, /texture\(uCVolume, vec3\(uv, h\)\)\.rg/)
  assert.match(CLOUD_VOLUME_DENSITY, /mix\(frames\.r, frames\.g, uCVolumeBlend\)/)
  assert.doesNotMatch(CLOUD_VOLUME_DENSITY, /frames\.b|frames\.a/)
  console.log('EVIDENCIA G001-01:', JSON.stringify({voxels:v.N*v.N*v.depth,channels:2,bytes:v.data.byteLength}))
})

test('G001-02 | etiqueta de morfología distinta con misma geometría genera exactamente el mismo volumen', () => {
  const a = init(baseMap(), [source(0, MORPH_TYPE[1])]); const b = init(baseMap(), [source(0, MORPH_TYPE[5])])
  assert.notEqual(MORPH_TYPE[1], MORPH_TYPE[5])
  assert.deepEqual(a.data, b.data)
  assert.match(src('src/engine/runtime/world/cloudfield-bake.js'), /A\.tn\[k\] \+= w \* q\.type/)
  assert.match(src('src/engine/runtime/world/cloudfield-bake.js'), /volumes\.push\(\{ x: ax \+ q\.x, y: cy, z: az \+ q\.z, rx: q\.rx, ry: q\.ry, rz: q\.rz, str: q\.str \}\)/)
  console.log('EVIDENCIA G001-02:', JSON.stringify({typeA:MORPH_TYPE[1],typeB:MORPH_TYPE[5],equal3d:true,classificationLostAtSourceTransfer:true}))
})

test('G001-03 | condensado persistente conserva núcleo tras recentrado cercano', () => {
  const map = baseMap(), v = init(map), before = v.sample(0,1400,0)
  assert.ok(before > 0.6)
  map.cx += v.spacing
  v.rebuild(map,[source()])
  v.advance(0,forcing,[0,0])
  const after = v.sample(0,1400,0)
  assert.ok(after > 0.5, `Núcleo perdido: ${after}`)
  assert.ok(Math.abs(after-before) < .08, `Recentrado cercano discontinuo: ${before} -> ${after}`)
  console.log('EVIDENCIA G001-03:', JSON.stringify({distance:v.spacing,before,after,retained:true}))
})

test('S01-04 | región nueva se reconstruye desde fuentes antes del primer frame', () => {
  const map = baseMap(), v = init(map), before=v.sample(0,1400,0)
  assert.ok(before > 0.6)
  map.cx = 20000
  v.rebuild(map,[source(20000)])
  v.advance(0,forcing,[0,0]) // publica el estado remuestreado, todavía sin condensación nueva
  const immediate = v.sample(20000,1400,0)
  assert.ok(immediate > 0.5, `Destino no reconstruido: ${immediate}`)
  v.advance(0.5, forcing, [0,0]); const firstVisible=v.sample(20000,1400,0)
  v.advance(0.5, forcing, [0,0]); const later=v.sample(20000,1400,0)
  assert.ok(firstVisible > 0.5 && later > 0.5, `Región regenerada inestable: ${firstVisible} -> ${later}`)
  console.log('EVIDENCIA G001-04:', JSON.stringify({distance:20000,before,immediate,after05s:firstVisible,after1s:later,limit:'reconstrucción espacial, no certificación GPU'}))
})

test('G001-05 | instantánea existente recupera volumen interpolado dentro de cuantización', () => {
  const map = baseMap(), original=init(map)
  original.advance(0.5,forcing,[1,2]); original.advance(0.25,forcing,[1,2])
  const originalValue=original.sample(900,1400,0), snapshot=original.snapshot()
  assert.ok(snapshot?.water?.length > 0)
  const restored = new CloudVolume(map)
  restored.restore(JSON.parse(JSON.stringify(snapshot)))
  const restoredValue=restored.sample(900,1400,0)
  near(restoredValue,originalValue,0.011)
  near(restored.blend,original.blend,1e-8)
  near(restored.pending,original.pending,1e-8)
  console.log('EVIDENCIA G001-05:', JSON.stringify({original:originalValue,restored:restoredValue,blend:snapshot.blend,pending:snapshot.pending,encodedChars:snapshot.water.length}))
})

test('S01-06 | transición meteorológica se incluye en el snapshot Player', () => {
  const w=new World().configure({weather:{on:true,preset:'partly',cloudModel:'cells',cloudSeed:2468,director:false,moisture:false}})
  assert.equal(w.setWeather('storm',1,20),true)
  w.update(5)
  assert.ok(w._fade && w._fade.t>0 && w._fade.t <w._fade.dur)
  const sourceCode=src('src/engine/runtime/events/play-saves.js')
  assert.match(sourceCode, /weatherEvolution: w\.captureWeatherEvolution\(\)/)
  assert.match(sourceCode, /world\.setWeather\(w\.preset, Number\.isFinite\(w\.intensity\) \? w\.intensity : 1, 0\)/)
  assert.match(sourceCode, /world\.restoreWeatherEvolution\(w\.weatherEvolution\)/)
  console.log('EVIDENCIA G001-06:', JSON.stringify({transitionElapsed:w._fade.t,transitionDuration:w._fade.dur,volumeSaved:true,fadeExplicitInPlayerSnapshot:true}))
})

test('S01-07 | Edit Mode no llama world.update desde liveFx', () => {
  const sourceCode=src('src/engine/runtime/scene-graph.js')
  assert.doesNotMatch(sourceCode, /!this\.isPlaying && this\.vp\.liveFx && this\.world\.weatherOn\) \{ this\.world\.update/)
  const w=new World().configure({time:{on:true,hour:13,latitude:19},weather:{on:true,preset:'partly',cloudModel:'cells',cloudSeed:2468,director:false,moisture:false}})
  const hour=w.hour, evolution=w.field.evolution
  w.update(0.5,{clock:false})
  near(w.hour,hour,1e-9)
  assert.ok(w.field.evolution>evolution)
  assert.ok(w.field.map.volume.version>0)
  console.log('EVIDENCIA G001-07:', JSON.stringify({hourBefore:hour,hourAfter:w.hour,evolutionBefore:evolution,evolutionAfter:w.field.evolution,volumeVersion:w.field.map.volume.version}))
})

test('G001-08 | liveFx conserva consumidores independientes y no puede retirarse indiscriminadamente', () => {
  const vp=src('src/engine/runtime/render/viewport.js')
  const env=src('src/engine/runtime/scene/environment.js')
  assert.match(env, /this\.vp\.liveFx = v\.weather !== false/)
  assert.match(vp, /this\.playing \|\| this\.liveFx/)
  assert.match(vp, /this\.precip\.update\(live \?/)
  assert.match(vp, /this\.nature\?\.update\(/)
  assert.match(vp, /this\.skyMat\.uniforms\.uTime\.value = this\.playing \?/)
  console.log('EVIDENCIA G001-08:', JSON.stringify({editorWeatherControlsLiveFx:true,consumerSkyTime:true,consumerPrecipitation:true,consumerNature:true}))
})

test('G001-09 | fixture WebGL conserva renderer actual y rutas visuales suelo/aire', () => {
  const html=src('scripts/fixtures/weather/cloud-convection.html')
  const runner=src('scripts/test-cloud-convection-electron.mjs')
  assert.match(html, /new Viewport\(/)
  assert.match(html, /new CloudVolume\(/)
  assert.match(html, /vp\.renderer\.getContext\(\)/)
  assert.match(html, /gl\.readPixels\(/)
  assert.match(html, /Suelo · unión por condensación/)
  assert.match(html, /Aire · unión por condensación/)
  assert.match(runner, /qa-electron-webgl-runner\.mjs/)
})
