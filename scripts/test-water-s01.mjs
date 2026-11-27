// LF-WATER-S01-G001: solver numérico independiente de Three.js y compatibilidad con WaterWorld.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'

const EPS = 1e-8
function near(value, expected, tolerance = EPS) {
  assert.ok(Math.abs(value - expected) <= tolerance, `${value} ≠ ${expected} (tolerancia ${tolerance})`)
}
const make = (options = {}) => new WaterRegion({ id: 'r', width: 12, height: 12, ...options })
const n = 144
function simulate(r, frames = 30, dt = 1 / 60) {
  for (let i = 0; i < frames; i++) r.step(dt)
  return r
}

// Esta suite prueba el WaterWorld real sin exigir dependencias visuales para el solver.
const root = resolve(import.meta.dirname, '..')
const source = readFileSync(resolve(root, 'src/engine/runtime/geometry/waterworld.js'), 'utf8')
const solverUrl = pathToFileURL(resolve(root, 'src/engine/runtime/geometry/water-solver.js')).href
const asModule = source
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies = (objects) => objects; const riverLine = () => []')
  .replace("import { waveSet } from './water.js'", 'const waveSet = () => ({ big: [] })')
  .replace("import { WaterRegion } from './water-solver.js'", `import { WaterRegion } from '${solverUrl}'`)
const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(asModule)}`)

test('W01: conserva API y cuerpos heredados de WaterWorld', () => {
  const w = new WaterWorld([{ id: 'old', name: 'Lago anterior', x: 0, y: 3, z: 0, yaw: 0,
    p: { shape: 'rect', width: 10, length: 10, flowSpeed: 1, flowDir: 0, color: '#147', deepColor: '#025', clarity: 6 } }])
  assert.equal(w.empty, false)
  near(w.at(0, 0, 0).surface, 3)
  near(w.at(0, 0, 0).flowX, 1)
  assert.equal(w.at(50, 50, 0), null)
  assert.equal(w.step(1 / 60).length, 0)
  near(w.at(0, 0, 10).surface, 3)
  const r = w.addRegion({ id: 'new', x: -1, z: -1, width: 2, height: 2, depth: [0, 0, 0, 0] })
  assert.equal(w.at(0, 0, 0), null, 'dentro de región simulada seca no aparece el lago heredado')
  w.changeVolume('new', 1, 1, 2)
  w.step(1 / 60)
  assert.equal(w.at(0, 0, 0)?.id, 'new')
  assert.equal(w.removeRegion('new'), true)
  assert.equal(w.at(0, 0, 0)?.id, 'old')
  assert.equal(r.id, 'new')
})

test('W02: datos compactos por celda, consultas físicas y coordenadas del mundo', () => {
  const w = new WaterWorld()
  const r = w.addRegion({ id: 'pool', x: 10, z: -4, width: 2, height: 2, cellSize: 2,
    bed: [2, 2, 3, 3], depth: [0.5, 0, 1, 0], velocityX: [2, 0, 0, 0], color: '#47a' })
  assert.ok(r.depth instanceof Float64Array)
  assert.ok(r.qx instanceof Float64Array)
  assert.equal(w.empty, false)
  const sample = w.at(10.5, -3.5)
  near(sample.surface, 2.5)
  near(sample.depth, 0.5)
  near(sample.flowX, 2)
  assert.equal(w.at(12.5, -3.5), null)
  assert.equal(w.at(8, -4), null)
  assert.equal(sample.color, '#47a')
})

test('W03: agua en reposo sobre fondo irregular no genera corrientes espurias', () => {
  const bed = Array.from({ length: n }, (_, k) => 0.3 * Math.sin(k % 12) + 0.2 * Math.cos(Math.floor(k / 12)))
  const r = make({ bed, depth: bed.map((b) => 1.5 - b) })
  const volume = r.volume()
  simulate(r, 80)
  near(r.volume(), volume, 1e-9)
  for (let k = 0; k < n; k++) {
    near(r.bed[k] + r.depth[k], 1.5, 1e-9)
    near(r.qx[k], 0, 1e-8)
    near(r.qz[k], 0, 1e-8)
  }
})

test('W03: agua uniforme no se acelera contra paredes cerradas', () => {
  const r = make({ depth: new Array(n).fill(1) })
  simulate(r)
  for (let k = 0; k < n; k++) { near(r.depth[k], 1); near(r.qx[k], 0); near(r.qz[k], 0) }
})

test('W03: rotura de presa redistribuye agua sin crear volumen', () => {
  const r = make({ depth: Array.from({ length: n }, (_, k) => k % 12 < 5 ? 1 : 0) })
  const before = r.volume()
  simulate(r, 50)
  near(r.volume(), before, 1e-8)
  assert.ok(r.depth[8] > 0, 'el frente entra en la zona seca')
  assert.ok(r.qx.some((q) => q > 0), 'el flujo se dirige a la derecha')
})

test('W04: pendiente con distinto nivel libre genera transporte descendente', () => {
  const bed = Array.from({ length: n }, (_, k) => 0.05 * (11 - k % 12))
  const r = make({ bed, depth: new Array(n).fill(0.4) })
  simulate(r, 5)
  assert.ok(r.qx[5 * 12 + 5] > 0)
  near(r.balanceError(), 0, 1e-8)
})

test('W04: barrera sólida interna mantiene sectores separados y sin velocidades falsas', () => {
  const valid = Array.from({ length: n }, (_, k) => k % 12 !== 5)
  const depth = Array.from({ length: n }, (_, k) => k % 12 < 5 ? 1 : 0)
  const r = make({ depth, valid })
  simulate(r, 40)
  for (let row = 0; row < 12; row++) {
    for (let col = 6; col < 12; col++) near(r.depth[row * 12 + col], 0)
  }
  near(r.balanceError(), 0, 1e-9)
})

test('W04: límite abierto pierde volumen contabilizado, pero nunca lo absorbe desde fuera', () => {
  const r = make({ depth: new Array(n).fill(1), boundaries: { east: 'open' } })
  simulate(r, 20)
  assert.ok(r.ledger.exited > 0)
  near(r.volume(), r.initialVolume - r.ledger.exited, 1e-8)
})

test('W05: frente húmedo/seco permanece no negativo y sin valores no finitos', () => {
  const r = make({ depth: Array.from({ length: n }, (_, k) => k === 30 ? 4 : 0), boundaries: { east: 'open' } })
  simulate(r, 100)
  for (let k = 0; k < n; k++) {
    assert.ok(Number.isFinite(r.depth[k]) && r.depth[k] >= 0)
    assert.ok(Number.isFinite(r.qx[k]) && Number.isFinite(r.qz[k]))
  }
  near(r.balanceError(), 0, 1e-7)
})

test('W06: fuentes y drenajes se aplican al siguiente paso y registran volumen real', () => {
  const r = make()
  r.queue(2, 2, 3)
  r.queue(2, 2, -1)
  near(r.volume(), 0)
  const first = r.step(1 / 120)
  near(first.added, 3)
  near(first.drained, 1)
  near(r.balanceError(), 0, 1e-10)
  r.queue(2, 2, -100)
  const second = r.step(1 / 120)
  assert.ok(second.drained <= first.after)
  near(r.balanceError(), 0, 1e-9)
})

test('W06: fuentes sobre celdas inválidas y volúmenes no finitos son rechazados', () => {
  const valid = new Array(n).fill(1); valid[0] = 0
  const r = make({ valid })
  assert.throws(() => r.queue(0, 0, 1), /sin suelo/)
  assert.throws(() => r.queue(2, 3, NaN), /no finito/)
  assert.throws(() => r.queue(20, 0, 1), /fuera/)
  assert.equal(r.pending.length, 0)
})

test('W07: pasos deterministas producen el mismo resultado', () => {
  const initial = { depth: Array.from({ length: n }, (_, k) => k % 12 < 4 ? 1 : 0) }
  const a = simulate(make(initial), 48)
  const b = simulate(make(initial), 48)
  assert.deepEqual(Array.from(a.depth), Array.from(b.depth))
  assert.deepEqual(Array.from(a.qx), Array.from(b.qx))
  assert.deepEqual(Array.from(a.qz), Array.from(b.qz))
})

test('W07: entradas inválidas no corrompen el estado', () => {
  assert.throws(() => make({ width: 9999 }), /dimensiones/)
  assert.throws(() => make({ depth: new Array(n).fill(-1) }), /depth/)
  assert.throws(() => make({ bed: [0] }), /longitud/)
  assert.throws(() => make({ boundaries: { west: 'portal' } }), /Borde/)
  const r = make({ depth: new Array(n).fill(1) })
  const before = Array.from(r.depth)
  assert.throws(() => r.step(-1), /Paso/)
  assert.throws(() => r.step(10000), /subpasos/)
  assert.deepEqual(Array.from(r.depth), before)
})

test('W08: ids duplicados y regiones solapadas se rechazan sin estado paralelo', () => {
  const w = new WaterWorld()
  w.addRegion({ id: 'a', width: 2, height: 2 })
  assert.throws(() => w.addRegion({ id: 'a', width: 2, height: 2, x: 5 }), /duplicado/)
  assert.throws(() => w.addRegion({ id: 'b', width: 2, height: 2, x: 1 }), /solapadas/)
  assert.equal(w.regions.size, 1)
  w.addRegion({ id: 'c', width: 2, height: 2, x: 2 })
  assert.equal(w.regions.size, 2)
})

test('W07: presupuesto de memoria y coste de una región de 32×32 medible', () => {
  const r = new WaterRegion({ id: 'bench', width: 32, height: 32, depth: new Array(1024).fill(0.5) })
  const t = performance.now()
  simulate(r, 30)
  const elapsed = performance.now() - t
  assert.ok(elapsed >= 0 && Number.isFinite(elapsed))
  near(r.balanceError(), 0, 1e-8)
  // Indicador informativo, no umbral de rendimiento ni comparación entre equipos.
  console.log(`WATER_S01_BENCH 32x32 30 steps: ${elapsed.toFixed(2)} ms; state ${(r.depth.byteLength + r.qx.byteLength + r.qz.byteLength + r.bed.byteLength + r.valid.byteLength)} bytes`)
})

test('W04: lago quieto junto a un obstáculo interno tampoco se acelera', () => {
  const valid = Array.from({ length: n }, (_, k) => k % 12 !== 4)
  const bed = Array.from({ length: n }, (_, k) => 0.2 * Math.sin(k % 12))
  const depth = bed.map((b, k) => valid[k] ? 1 - b : 0)
  const r = make({ bed, depth, valid })
  simulate(r, 40)
  for (let k = 0; k < n; k++) { near(r.qx[k], 0, 1e-9); near(r.qz[k], 0, 1e-9) }
  near(r.balanceError(), 0, 1e-9)
})

test('W07: un aporte desmesurado se rechaza antes de cambiar el estado o consumir la cola', () => {
  const r = make()
  r.queue(1, 1, 1e12)
  const before = r.volume()
  assert.throws(() => r.step(1 / 30), /subpasos/)
  near(r.volume(), before)
  assert.equal(r.pending.length, 1)
  near(r.ledger.added, 0)
})

test('W08: las regiones simuladas no necesitan inicializarse en la carga de proyectos anteriores', () => {
  const world = WaterWorld.fromObjects([])
  assert.equal(world.empty, true)
  assert.equal(world.at(0, 0, 0), null)
  assert.deepEqual(world.step(1 / 60), [])
  assert.equal(world.regions.size, 0)
})
