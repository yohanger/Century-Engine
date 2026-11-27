// LF-VOLUMETRIC-CLOUDS-S01-G001-CORR-003 — calibración sin GPU.
// Ejecutar: node --test scripts/test-cloud-natural-scale-corr003.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { CloudField, MORPH } from '../src/engine/runtime/world/cloudfield.js'
import { CLOUD_CURVATURE_RADIUS, CLOUD_VIEW_DISTANCE, cloudHeightAtDistance } from '../src/engine/runtime/world/cloud-curvature.js'
import { SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
import { SKY_PLANET } from '../src/engine/runtime/render/sky-planet.js'

const clear = { coverage: 0.55, density: 0.63, humidity: 0.7, storm: 0, rain: 0, altitude: 1500 }
const rain = { coverage: 0.94, density: 0.75, humidity: 0.92, storm: 0, rain: 22, altitude: 900 }
const storm = { coverage: 1, density: 1, humidity: 0.88, storm: 1, rain: 45, altitude: 900 }
function field(state, seed = 42) { const f = new CloudField({ seed }); f.update(state, [0, 0], 0); return f }
function bases(f, morph) {
  const out = []
  for (let x = -32; x <= 32; x++) for (let z = -32; z <= 32; z++) {
    const s = f.evaluate(x, z)
    if (s.condensate > 0.15 && s.morph === morph) out.push(s.base)
  }
  assert.ok(out.length > 50, `morfología ${morph}: muestras insuficientes`)
  return out
}
const extent = x => Math.max(...x) - Math.min(...x)
const dipDegrees = h => Math.asin(Math.sqrt(h * (2 * CLOUD_CURVATURE_RADIUS + h)) / (CLOUD_CURVATURE_RADIUS + h)) * 180 / Math.PI

test('C003-01: cúmulos con bases variadas pero sin separación vertical exagerada', () => {
  const f = field(clear), values = bases(f, MORPH.CUMULUS)
  assert.ok(extent(values) > f.layer * 0.30)
  assert.ok(extent(values) < f.layer * 0.85)
  assert.ok(values.every(v => Math.abs(v - clear.altitude) <= f.layer * 0.38 + 1e-8))
})

test('C003-02: nube estratiforme mantiene banda compacta; tormenta no dispersa las bases', () => {
  const a = field(rain), b = field(storm)
  const s = bases(a, MORPH.NIMBOSTRATUS), t = bases(b, MORPH.CUMULONIMBUS)
  assert.ok(extent(s) > a.layer * 0.05 && extent(s) < a.layer * 0.24)
  assert.ok(extent(t) > b.layer * 0.25 && extent(t) < b.layer * 0.75)
})

test('C003-03: semilla y viento conservan alturas por celda y centro vertical', () => {
  const a = field(clear), b = field(clear), c = field(clear, 7)
  const before = { ...a.evaluate(6, -15) }
  assert.equal(before.base, b.evaluate(6, -15).base)
  assert.notEqual(before.base, c.evaluate(6, -15).base)
  a.update(clear, [18, 4], 11)
  const after = a.evaluate(6, -15)
  assert.equal(after.base, before.base)
  assert.equal(after.thick, before.thick)
  assert.ok(Math.abs(after.y - after.base - 0.55 * after.thick) < 1e-8)
})

test('C003-04: curvatura compartida natural, sin efecto planeta diminuto', () => {
  assert.ok(CLOUD_CURVATURE_RADIUS >= 6000000 && CLOUD_CURVATURE_RADIUS <= 7000000)
  assert.ok(CLOUD_VIEW_DISTANCE <= 30000)
  assert.ok(dipDegrees(2) < 0.1)
  assert.ok(dipDegrees(120) < 0.5)
  assert.ok(dipDegrees(1000) < 1.2)
  assert.ok(dipDegrees(3000) > 1.5 && dipDegrees(3000) < 2.2)
  assert.ok([2, 120, 1000, 3000].map(dipDegrees).every((x, i, arr) => i === 0 || x > arr[i - 1]))
})

test('C003-05: caída de nube a distancia plausible y sin inventar curvatura del Terrain', () => {
  const h = 1500
  const near = cloudHeightAtDistance(h, 12000 ** 2)
  const far = cloudHeightAtDistance(h, 28000 ** 2)
  assert.ok(h - near > 5 && h - near < 20)
  assert.ok(h - far > 45 && h - far < 80)
  assert.ok(near > far)
  assert.match(SKY_FRAG, new RegExp(`const float CLOUD_RADIUS = ${CLOUD_CURVATURE_RADIUS.toFixed(1).replace('.', '\\.')}\\s*;`))
  assert.match(SKY_FRAG, /cloudSphereHits\(rd, 0\.0\)/)
})

test('C003-06: el shader manual conserva variación moderada en el MISMO volumen', () => {
  assert.match(SKY_FRAG, /float base = clamp\(0\.11 \+ mix\(0\.05, 0\.20, relief\)/)
  assert.match(SKY_FRAG, /float top = min\(1\.0, base \+ mix\(0\.26, 0\.35 \+ 0\.25 \* weather\.b, relief\)\)/)
  assert.match(SKY_FRAG, /if \(uCCells == 1\)/)
  assert.match(SKY_FRAG, /simulatedCloudDensity\(wp, organized, altitude, full\)/)
})

test('C003-07: limbo de menor contraste, sin eliminar superficie ni dispersión', () => {
  assert.match(SKY_PLANET, /mix\(0\.955, 0\.79, elevated\)/)
  assert.match(SKY_PLANET, /mix\(0\.965, 0\.90, elevated\)/)
  assert.match(SKY_PLANET, /limb \* \(0\.10 \* \(1\.0 - uNight\)/)
  assert.match(SKY_PLANET, /return mix\(surface, air, airBlend\)/)
  assert.match(SKY_FRAG, /planetBackdrop\(dir, skyY, pxAng, eyeHeight/)
})

test('C003-08: capacidad de volumen conservada sin buffers nuevos', () => {
  const f = field(clear)
  f.prepare(0, 0); f.bake()
  const volume = f.map.volume
  assert.equal(volume.depth, 16)
  assert.equal(volume.data.length, volume.N * volume.N * volume.depth * 2)
  assert.ok(f.effectivePrecipitationAt(0, 0, 0) >= 0)
})
