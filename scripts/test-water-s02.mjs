// WATER S02: integración real WaterRegion / WaterWorld con terreno y clima, sin render ni paquetes gráficos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'

const root = resolve(import.meta.dirname, '..')
const path = (name) => resolve(root, 'src/engine/runtime/', name)
const solver = pathToFileURL(path('geometry/water-solver.js')).href
const worldSrc = readFileSync(path('geometry/waterworld.js'), 'utf8')
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies = (objects) => objects; const riverLine = () => []')
  .replace("import { waveSet } from './water.js'", 'const waveSet = () => ({ big: [] })')
  .replace("import { WaterRegion } from './water-solver.js'", `import { WaterRegion } from '${solver}'`)
const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(worldSrc)}`)
const linkSrc = readFileSync(path('geometry/water-terrain.js'), 'utf8')
  .replace("import { groundAtAll } from './terrains.js'", `const groundAtAll = (pieces, x, z) => { for (const p of pieces) { const y = p.groundAt(x, z); if (Number.isFinite(y)) return y } return NaN }`)
  .replace("import { precipMm } from '../world/atmosphere.js'", 'const precipMm = (r, s = 0) => 45 * r * r + 6 * s * s')
  .replace("import { hydrologyGrid } from './water-hydrology.js'", `import { hydrologyGrid } from '${pathToFileURL(path('geometry/water-hydrology.js')).href}'`)
const { waterSceneConfig, terrainWaterGeometry, liquidPrecipitation, TerrainWaterConnection } =
  await import(`data:text/javascript,${encodeURIComponent(linkSrc)}`)
const near = (actual, expected, tol = 1e-9) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`)
const terrain = (fn = () => 0) => ({ id: 'ground', version: 0, enabled: true, groundAt(x, z) { return this.enabled ? fn(x, z) : NaN } })
const config = (over = {}) => ({ enabled: true, regions: [{ id: 'pond', x: 0, z: 0, width: 6, height: 6, cellSize: 1, ...over }] })
const climate = (rain = 0.7, snow = 0, enabled = true) => ({
  weatherOn: enabled, cur: { rain, snow }, precipitationAt(x, z, y) { return 45 * rain * rain + 6 * snow * snow },
})

test('W10: sin habilitar la escena no se crean regiones', () => {
  const water = new WaterWorld()
  const c = new TerrainWaterConnection(water, undefined, [terrain()], climate())
  assert.equal(c.entries.length, 0)
  assert.equal(water.empty, true)
  assert.deepEqual(waterSceneConfig({ enabled: false, regions: [] }), [])
})

test('W10: configuración optativa valida dimensiones, tamaños y presupuesto', () => {
  assert.throws(() => waterSceneConfig({ enabled: true, regions: [] }), /regiones/)
  assert.throws(() => waterSceneConfig(config({ cellSize: -1 })), /inválida/)
  assert.throws(() => waterSceneConfig(config({ width: 65, height: 65 })), /4096/)
  assert.throws(() => waterSceneConfig(config({ initialDepth: -2 })), /inválida/)
  const c = waterSceneConfig({ enabled: true, regions: [{ x: 0, z: 0, width: 2, height: 2 }] })
  assert.equal(c[0].id, 'terrain-water-1')
})

test('W10: WaterWorld crea región física con alturas reales del terreno', () => {
  const w = new WaterWorld()
  const c = new TerrainWaterConnection(w, config(), [terrain((x, z) => x + z)], climate(0))
  assert.equal(c.entries.length, 1)
  const r = w.regions.get('pond')
  near(r.bed[0], 1); near(r.bed[35], 11)
  assert.equal(r.valid.every(Boolean), true)
})

test('W11: hueco real queda inválido, sin extrapolación ni agua creada', () => {
  const w = new WaterWorld()
  const t = terrain((x) => x < 3 ? 0 : NaN)
  new TerrainWaterConnection(w, config(), [t], climate(1))
  const r = w.regions.get('pond')
  assert.equal(r.valid.filter(Boolean).length, 18)
  for (let i = 0; i < 10; i++) w.step(1 / 60)
  assert.equal(r.depth[3], 0)
  assert.equal(r.sample(4.5, 0.5), null)
})

test('W11: piezas contiguas alimentan una misma región sin separación artificial', () => {
  const a = terrain((x) => x < 3 ? 0 : NaN), b = terrain((x) => x >= 3 ? 0 : NaN)
  b.id = 'piece2'
  const w = new WaterWorld(), c = new TerrainWaterConnection(w, config({ initialDepth: 0.3 }), [a, b], climate(0))
  const r = c.entries[0].region
  assert.equal(r.valid.every(Boolean), true)
  for (let i = 0; i < 20; i++) c.step(1 / 60)
  near(r.balanceError(), 0)
})

test('W12: barrera sólida bloquea masa entre dos columnas sin invalidar el terreno', () => {
  const blocker = (o, d) => d[0] === 1 && o[0] === 1.5
  const geo = terrainWaterGeometry({ x: 0, z: 0, width: 4, height: 4, dx: 1, dz: 1 }, [terrain()], blocker)
  assert.equal(geo.blockX[2], 1)
  const r = new WaterRegion({ id: 'barrier', width: 4, height: 4,
    bed: geo.bed, valid: geo.valid, blockX: geo.blockX, blockZ: geo.blockZ,
    depth: Array.from({ length: 16 }, (_, k) => k % 4 < 2 ? 1 : 0) })
  for (let i = 0; i < 40; i++) r.step(1 / 60)
  near(r.volume(), 8, 1e-7)
  near(r.depth[2], 0, 1e-7) // en la fila 0, cerrada por la barrera
})

test('W12: cubiertas impiden aportes, pero no borran suelo bajo techo', () => {
  const w = new WaterWorld(), t = terrain()
  const cast = (o, d) => d[1] === 1 && o[0] < 3
  const c = new TerrainWaterConnection(w, config(), [t], climate(1), cast)
  assert.equal(c.entries[0].cover.filter(Boolean).length, 18)
  c.step(1 / 60)
  const r = w.regions.get('pond')
  near(r.ledger.added, 18 * 45 / 3600000 / 60)
  assert.equal(r.valid.every(Boolean), true)
})

test('W13: precipitación mm/h entra como metros cúbicos durante paso fijo', () => {
  const w = new WaterWorld(), c = new TerrainWaterConnection(w, config(), [terrain()], climate(1))
  for (let i = 0; i < 60; i++) c.step(1 / 60)
  const r = w.regions.get('pond')
  near(r.ledger.added, 36 * 45 / 3600000, 1e-12)
  near(r.volume(), r.ledger.added, 1e-9)
})

test('W13: nieve pura no añade volumen líquido; mezcla utiliza fracción de lluvia', () => {
  const snowy = climate(0, 1), mix = climate(0.5, 0.5)
  near(liquidPrecipitation(snowy, 0, 0), 0)
  near(liquidPrecipitation(mix, 0, 0), 45 * 0.25)
  near(liquidPrecipitation(climate(1, 0, false), 0, 0), 0)
})

test('W13: lluvia localizada respeta la máscara meteorológica por posición', () => {
  const w = new WaterWorld(), c = new TerrainWaterConnection(w, config(), [terrain()], {
    weatherOn: true, cur: { rain: 1, snow: 0 }, precipitationAt: (x) => x < 3 ? 45 : 0,
  })
  c.step(1 / 60)
  near(w.regions.get('pond').ledger.added, 18 * 45 / 3600000 / 60)
})

test('W14: la lluvia se acumula físicamente en la depresión y respeta el balance', () => {
  const t = terrain((x, z) => x > 2 && x < 4 && z > 2 && z < 4 ? -0.4 : 0)
  const w = new WaterWorld(), c = new TerrainWaterConnection(w, config({ initialDepth: 0.04 }), [t], climate(1))
  for (let i = 0; i < 40; i++) c.step(1 / 60)
  const r = w.regions.get('pond')
  assert.ok(r.depth[3 * 6 + 3] > r.depth[0])
  near(r.balanceError(), 0, 1e-8)
})

test('W15: modificación de altura conserva volumen sin inventar suelo', () => {
  let height = 0
  const t = terrain(() => height)
  const w = new WaterWorld(), c = new TerrainWaterConnection(w, config({ initialDepth: 0.25 }), [t], climate(0))
  const r = w.regions.get('pond'), before = r.volume()
  height = 2; t.version++
  c.step(1 / 60)
  near(r.volume(), before, 1e-8); near(r.bed[0], 2)
  near(r.balanceError(), 0, 1e-8)
})

test('W15: terreno eliminado redistribuye volumen; sin suelo registra salida explícita', () => {
  let missing = false
  const t = terrain((x) => missing && x < 2 ? NaN : 0)
  const w = new WaterWorld(), c = new TerrainWaterConnection(w, config({ initialDepth: 0.5 }), [t], climate(0))
  const r = w.regions.get('pond'), before = r.volume()
  missing = true; t.version++
  c.step(1 / 60)
  near(r.volume(), before, 1e-8)
  for (let j = 0; j < 6; j++) assert.equal(r.valid[j * 6], 0)
  t.enabled = false
  c.step(1 / 60)
  near(r.volume(), 0)
  near(r.ledger.exited, before, 1e-8)
  near(r.balanceError(), 0, 1e-8)
})

test('W16: mismo número de pasos produce idéntico resultado independientemente del agrupamiento', () => {
  const run = (chunks) => {
    const w = new WaterWorld(), c = new TerrainWaterConnection(w, config(), [terrain()], climate(0.4))
    for (const frames of chunks) for (let i = 0; i < frames; i++) c.step(1 / 60)
    return [...w.regions.get('pond').depth]
  }
  assert.deepEqual(run([20, 40]), run([15, 15, 30]))
})

test('W16 CA-005: integración del ciclo físico es nativa Lago/Río y se ejecuta antes de fixedUpdate', () => {
  const src = readFileSync(path('events/play-controls.js'), 'utf8')
  const start = src.indexOf('for (let i = 0; i < n; i++) {')
  const end = src.indexOf('this.player.late(fdt)', start)
  const body = src.slice(start, end)
  assert.ok(body.indexOf('this._waterConnection?.step(fdt)') < body.indexOf('this.game.fixedUpdate(fdt)'))
  const play = readFileSync(path('events/play.js'), 'utf8')
  assert.match(play, /nativeWaterConfiguration\(this\.water, p\.environment\?\.waterSimulation, ed\.terrains\)/)
  assert.match(play, /this\.water = WaterWorld\.fromObjects\(p\.objects\)/)
  const level = readFileSync(path('events/play-level.js'), 'utf8')
  assert.match(level, /this\._waterConnection = null/)
})

test('W17: la fuente y el drenaje existentes se conservan bajo la conexión al terreno', () => {
  const w = new WaterWorld(), c = new TerrainWaterConnection(w, config(), [terrain()], climate(0))
  w.changeVolume('pond', 1, 1, 2)
  c.step(1 / 60)
  const r = w.regions.get('pond')
  near(r.volume(), 2)
  w.changeVolume('pond', 1, 1, -1)
  c.step(1 / 60)
  near(r.volume(), 1)
  near(r.balanceError(), 0)
})

test('W18: el proyecto anterior continúa con su agua legada sin región activa', () => {
  const w = new WaterWorld([{ id: 'lake', name: 'Anterior', x: 0, y: 2, z: 0, yaw: 0,
    p: { shape: 'rect', width: 50, length: 50, color: '#158', deepColor: '#024', clarity: 5 } }])
  const c = new TerrainWaterConnection(w, undefined, [terrain()], climate(1))
  c.step(1 / 60)
  near(w.at(0, 0, 0).surface, 2)
  assert.equal(w.regions.size, 0)
})

test('W15: aportes en cola se transfieren si el terreno cambia antes de aplicarlos', () => {
  let cut = false
  const t = terrain((x) => cut && x < 2 ? NaN : 0)
  const w = new WaterWorld(), c = new TerrainWaterConnection(w, config(), [t], climate(0))
  w.changeVolume('pond', 0, 0, 1)
  cut = true; t.version++
  c.step(1 / 60)
  const r = w.regions.get('pond')
  near(r.volume(), 1)
  near(r.balanceError(), 0)
  assert.equal(r.depth[0], 0)
})

test('W18: un error de creación revierte las regiones registradas en WaterWorld', () => {
  const w = new WaterWorld()
  assert.throws(() => new TerrainWaterConnection(w, { enabled: true, regions: [
    { id: 'first', x: 0, z: 0, width: 3, height: 3 },
    { id: 'second', x: 1, z: 1, width: 3, height: 3 },
  ] }, [terrain()], climate(0)), /solapadas/)
  assert.equal(w.regions.size, 0)
})

test('W18 CA-005: la configuración coexiste con un dominio nativo sin otra autoridad', () => {
  const project = readFileSync(resolve(root, 'src/core/project.js'), 'utf8')
  const play = readFileSync(path('events/play.js'), 'utf8')
  assert.match(project, /environment: toRaw\(project.environment\)/)
  assert.match(play, /new TerrainWaterConnection\(this.water, waterConfig/)
  assert.equal(play.match(/this.water = WaterWorld.fromObjects\(p.objects\)/g)?.length, 1)
})
