// S04: regresión de integración y del coste de actualización sin variar la calidad visual.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CloudField } from '../src/engine/runtime/world/cloudfield.js'
import { World } from '../src/engine/runtime/world/world.js'
import { PerfStats, summarize } from '../src/engine/runtime/render/perf.js'

const SRC = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const clear = { coverage: 0.12, density: 0.3, humidity: 0.45, storm: 0, rain: 0, altitude: 1900 }
const storm = { coverage: 1, density: 1, humidity: 0.88, storm: 1, rain: 45, altitude: 900 }
const make = (s = storm) => { const f = new CloudField({ seed: 43 }); f.update(s, [8, -3], 0); f.prepare(0, 0); return f }

test('WU4-01: las celdas residentes comparten scratch, sin asignar por celda', () => {
  const f = make(), c = f.cells.find(c => c.active)
  assert.ok(c)
  assert.strictEqual(f._residentDifferential(c), f._residentDifferential(c))
  assert.strictEqual(f._jitter(c.key, f._residentJitter), f._residentJitter)
  assert.strictEqual(f._residentDifferential(c), f._residentD)
})
test('WU4-02: resultado de interpolación del viento igual al cálculo de referencia', () => {
  const f = make(), c = f.cells.find(c => c.active)
  for (const blend of [0, 0.25, 0.5, 0.75, 1]) {
    c.blend = blend; c.prevMorph = 3; c.morph = 5
    const a = f._differential(c.key, c.prevMorph, [0, 0])
    const b = f._differential(c.key, c.morph, [0, 0])
    const want = a.map((v, i) => v + (b[i] - v) * blend)
    assert.deepEqual([...f._residentDifferential(c)], want)
  }
})
test('WU4-03: misma semilla y secuencia producen idénticas posiciones de celdas', () => {
  const a = make(), b = make()
  for (let i = 0; i < 180; i++) { a.update(storm, [10, -3], 1 / 60); b.update(storm, [10, -3], 1 / 60) }
  assert.deepEqual(a.cells.map(c => [c.key, c.x, c.y, c.z, c.morph, c.condensate]), b.cells.map(c => [c.key, c.x, c.y, c.z, c.morph, c.condensate]))
})
test('WU4-04: tiempo despejado, lluvia y tormenta conservan nubes y presupuesto de celdas', () => {
  for (const s of [clear, { ...storm, storm: 0, rain: 25 }, storm]) {
    const f = make(s)
    for (let i = 0; i < 45; i++) f.update(s, [5, 1], 1 / 60)
    assert.ok(f.cells.filter(c => c.active).length <= f.cfg.maxCells)
    const m = f.maintain(0, 0, 0.7)
    assert.ok(m.version > 0)
    assert.equal(m.data.length, m.N * m.N * 4)
  }
})
test('WU4-05: el mapa no se rehornea cuando no hay cambios', () => {
  const f = make(), m = f.maintain(0, 0, 1)
  const v = m.version
  f.maintain(0, 0, 0.01)
  assert.equal(m.version, v)
})
test('WU4-06: tormenta desactivada no inyecta vórtice en el campo de viento', () => {
  const w = new World(9)
  w.configure({ weather: { on: true, preset: 'storm', tornadoEnabled: false } })
  w.update(.2)
  const a = w.windAt(2, 1), b = w.windAt3D(2, 10, 1)
  assert.equal(a.x, b.x); assert.equal(a.z, b.z); assert.equal(b.inside, false)
})
test('WU4-07: mediana impar, par y vacía en PerfStats', () => {
  assert.equal(summarize([]).median, 0)
  assert.equal(summarize([17, 12, 22]).median, 17)
  assert.equal(summarize([25, 10, 15, 20]).median, 17.5)
})
test('WU4-08: p50 y p95 se registran sin alterar FPS ni samples', () => {
  const p = new PerfStats(10)
  for (const d of [12, 16, 17, 20]) p.frame(d)
  const s = p.snapshot()
  assert.equal(s.medianMs, 16.5)
  assert.equal(s.frameMs, 16.25)
  assert.equal(s.history.length, 4)
  assert.ok(s.p95 >= s.medianMs && s.fps > 0)
})
test('WU4-09: el panel muestra p50/p95 sin crear un sistema de perfilado paralelo', () => {
  assert.match(SRC('src/components/PerfPanel.vue'), /snap\.medianMs/)
  assert.match(SRC('src/engine/runtime/render/viewport.js'), /new PerfMonitor\(this\.renderer\)/)
})
test('WU4-10: sin reducción de calidad ni pasos del shader de nubes', () => {
  const s = SRC('src/engine/runtime/render/viewport.js')
  assert.match(s, /56 : this\.look\.profile === 'medio' \? 36 : 24/)
  const sky = SRC('src/engine/runtime/render/skylib.js')
  assert.match(sky, /uTornadoCloud/)
})
test('WU4-11: no se alteran las fuerzas específicas ni la persistencia física', () => {
  const t = SRC('src/engine/runtime/events/play-tornado.js')
  assert.match(t, /tornadoWindAt/)
  const w = SRC('src/engine/runtime/geometry/waterworld.js')
  assert.match(w, /suspendedDepositM3/)
})
test('WU4-12: el QA WebGL sigue usando Electron y conserva tres fixtures', () => {
  const runner = SRC('scripts/qa-electron-webgl-runner.mjs')
  assert.match(runner, /qa-electron-webgl\.cjs/)
  assert.match(SRC('scripts/qa-electron-webgl.cjs'), /BrowserWindow/)
  for (const name of ['vfx','tornado-visual','tornado-cohesion']) {
    const p = name === 'vfx' ? 'scripts/test-vfx-webgl-s02-g001.mjs' : name === 'tornado-visual' ? 'scripts/test-weather-tornado-visual-webgl-corr-g001.mjs' : 'scripts/test-weather-tornado-visual-cohesion-webgl-corr-g001.mjs'
    assert.match(SRC(p), /verifyWebGL/)
  }
})
test('WU4-13: otros efectos meteorológicos permanecen separados de la incidencia negra', () => {
  const fx = SRC('src/engine/runtime/world/fx.js')
  assert.match(fx, /class PrecipFX/)
  assert.match(fx, /this\.splash\.visible/)
  assert.match(SRC('src/engine/runtime/render/viewport.js'), /new LightningFX\(this\.scene\)/)
})
test('WU4-14: no se creó otro CloudField, viento o Player', () => {
  const s = SRC('src/engine/runtime/world/cloudfield.js')
  assert.equal((s.match(/export class CloudField/g) || []).length, 1)
  assert.match(SRC('src/engine/runtime/world/world.js'), /windAt3D\(/)
})
