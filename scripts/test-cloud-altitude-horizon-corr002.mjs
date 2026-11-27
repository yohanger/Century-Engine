// LF-VOLUMETRIC-CLOUDS-S01-G001-CORR-002 — QA Node sin DOM/GPU.
// Ejecutar: node --test scripts/test-cloud-altitude-horizon-corr002.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { CloudField, MORPH } from '../src/engine/runtime/world/cloudfield.js'
import { SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
import { SKY_PLANET } from '../src/engine/runtime/render/sky-planet.js'
import { CLOUD_CURVATURE_RADIUS, cloudHeightAtDistance } from '../src/engine/runtime/world/cloud-curvature.js'

const base = { coverage: 0.55, density: 0.63, humidity: 0.7, storm: 0, rain: 0, altitude: 1500 }
const field = (state, seed = 42) => {
  const f = new CloudField({ seed })
  f.update(state, [0, 0], 0)
  return f
}
const sample = (f, predicate = () => true) => {
  const arr = []
  for (let x = -32; x <= 32; x++) for (let z = -32; z <= 32; z++) {
    const s = f.evaluate(x, z)
    if (s.condensate > 0.15 && predicate(s)) arr.push({ ...s })
  }
  return arr
}
const extent = (arr) => Math.max(...arr) - Math.min(...arr)

test('C002-01: cúmulos vecinos no tienen una única base de altura', () => {
  const f = field(base), clouds = sample(f, s => s.morph === MORPH.CUMULUS)
  assert.ok(clouds.length > 50)
  assert.ok(extent(clouds.map(s => s.base)) > f.layer * 0.25)
  assert.ok(clouds.every(s => Math.abs(s.base - (base.altitude + f._altOffset(s.morph))) <= f.layer * 0.38 + 1e-8))
})

test('C002-02: nubes estratiformes conservan alturas próximas', () => {
  const f = field({ ...base, coverage: 0.94, density: 0.75, humidity: 0.92, rain: 22, altitude: 900 })
  const clouds = sample(f, s => s.morph === MORPH.NIMBOSTRATUS)
  assert.ok(clouds.length > 50)
  assert.ok(extent(clouds.map(s => s.base)) <= f.layer * 0.22 + 1e-8)
})

test('C002-03: altitudes reproducibles por seed y coordenadas, incluso con viento', () => {
  const a = field(base), b = field(base), other = field(base, 999)
  const p = a.evaluate(8, -13), q = b.evaluate(8, -13), r = other.evaluate(8, -13)
  assert.equal(p.base, q.base)
  assert.notEqual(p.base, r.base)
  a.update(base, [18, -12], 8)
  assert.equal(a.evaluate(8, -13).base, p.base)
  assert.equal(a.evaluate(8, -13).thick, p.thick)
})

test('C002-04: el centro, la lluvia y el rayo conservan la base efectiva de su propia nube', () => {
  const state = { coverage: 1, density: 1, humidity: 0.88, storm: 1, rain: 45, altitude: 900 }
  const f = field(state), p = f.evaluate(8, -13)
  assert.ok(Math.abs(p.y - p.base - 0.55 * p.thick) < 1e-8)
  assert.ok(p.base > 0)
  assert.ok(f.effectivePrecipitationAt(p.x, 0, p.z) >= 0)
  const strike = f.lightningOrigin(p.x, p.z, 9000)
  if (strike) assert.ok(strike.y > strike.base)
})

test('C002-05: solo un campo de condensado, sin buffers 3D adicionales', () => {
  const f = field(base)
  f.prepare(0, 0)
  f.bake()
  const volume = f.map.volume
  assert.equal(volume.depth, 16)
  assert.equal(volume.data.length, volume.N * volume.N * volume.depth * 2)
  assert.ok(f.map.slabThick >= 200)
  assert.ok(volume.height >= 800)
})

test('C002-06: shader manual usa relief de base y espesor en el mismo volumen', () => {
  assert.match(SKY_FRAG, /float base = clamp\(0\.11 \+ mix\(0\.05, 0\.20, relief\)/)
  assert.match(SKY_FRAG, /float top = min\(1\.0, base \+ mix\(0\.26, 0\.35 \+ 0\.25 \* weather\.b, relief\)\)/)
  assert.match(SKY_FRAG, /float hf = \(altitude-uCBase\) \/ max\(uCThick,1\.0\)/)
  assert.match(SKY_FRAG, /simulatedCloudDensity\(wp, organized, altitude, full\)/)
})

test('C002-07: horizonte conserva un único radio compartido por World y shader', () => {
  assert.ok(CLOUD_CURVATURE_RADIUS > 0)
  assert.match(SKY_FRAG, new RegExp(`const float CLOUD_RADIUS = ${CLOUD_CURVATURE_RADIUS.toFixed(1).replace('.', '\\.')}\\s*;`))
  assert.match(SKY_FRAG, /cloudSphereHits\(rd, 0\.0\)/)
  assert.match(SKY_FRAG, /horizonDip = sqrt\(eyeHeight \* \(2\.0 \* CLOUD_RADIUS \+ eyeHeight\)\)/)
  const h = 1500, at = cloudHeightAtDistance(h, 12000 ** 2)
  assert.ok(at < h && Number.isFinite(at))
})

test('C002-08: silueta planetaria no se funde por completo con el aire', () => {
  assert.match(SKY_PLANET, /float elevated = smoothstep\(120\.0, 3000\.0, max\(0\.0, uCamY\)\)/)
  assert.match(SKY_PLANET, /float airBlend = clamp\(haze \* 0\.30 \+ grazing \* limbHaze, 0\.0, mix\(0\.965, 0\.90, elevated\)\)/)
  assert.match(SKY_PLANET, /return mix\(surface, air, airBlend\)/)
  assert.match(SKY_FRAG, /if \(uMode != 2\) col = planetBackdrop/)
})
