import test from 'node:test'
import assert from 'node:assert/strict'
import { FrameBudgetPolicy, RuntimePerformanceController } from '../src/engine/runtime/render/performance-controller.js'
import { PerfMonitor } from '../src/engine/runtime/render/perf.js'
import { normalizeRender } from '../src/engine/runtime/render/config.js'
import { terrainMethods } from '../src/engine/runtime/scene/terrain.js'
import { environmentBakeDelay } from '../src/engine/runtime/render/viewport-env.js'

function drive(policy, seconds, sample, start = 0) {
  let changes = 0, now = start
  const frameMs = sample.frameMs ?? 1000 / 60
  for (let i = 0; i < Math.ceil(seconds * 1000 / frameMs); i++) {
    now += frameMs
    changes += +policy.sample({ cpuMs: 4, logicMs: 2, calls: 50, ...sample, frameMs }, now)
  }
  return { now, changes }
}

test('no reduce nada a 60 FPS y no confunde VSync con margen ilimitado', () => {
  const p = new FrameBudgetPolicy()
  drive(p, 15, { frameMs: 1000 / 60, gpuMs: 14 })
  assert.equal(p.geometry + p.effects, 0)
  assert.equal(p.report.state, 'stable')
})

test('presión GPU sostenida ajusta en pasos, respeta calentamiento y límites', () => {
  const p = new FrameBudgetPolicy()
  assert.equal(drive(p, 3, { frameMs: 30, gpuMs: 27 }).changes, 0)
  const { changes } = drive(p, 35, { frameMs: 30, gpuMs: 27 }, 3000)
  assert.equal(changes, 6)
  assert.equal(p.geometry, 3); assert.equal(p.effects, 3)
  assert.equal(p.report.state, 'limited')
})

test('lógica CPU lenta se informa sin sacrificar gráficos ni cambiar la simulación', () => {
  const p = new FrameBudgetPolicy()
  drive(p, 12, { frameMs: 34, cpuMs: 31, logicMs: 29, gpuMs: 5 })
  assert.equal(p.report.bottleneck, 'logic')
  assert.equal(p.report.state, 'limited')
  assert.equal(p.geometry + p.effects, 0)
})

test('frames costosos de verdad no se descartan como pausas de pestaña', () => {
  const p = new FrameBudgetPolicy()
  drive(p, 18, { frameMs: 300, cpuMs: 290, logicMs: 280, gpuMs: 3 })
  assert.equal(p.report.bottleneck, 'logic')
  assert.equal(p.report.state, 'limited')
  assert.ok(p.report.frameMs >= 300)
})

test('GPU lento con consultas diferidas no reinicia calentamiento en cada frame', () => {
  const p = new FrameBudgetPolicy()
  let now = 0
  for (let i = 0; i < 120; i++) {
    now += 380
    p.sample({ frameMs: 380, cpuMs: 8, logicMs: 3, gpuMs: i % 2 === 0 ? 350 : null, canGeometry: false }, now)
  }
  assert.equal(p.effects, 3)
  assert.equal(p.report.bottleneck, 'gpu')
  assert.equal(p.report.state, 'limited')
})

test('la lógica que aún cabe en el presupuesto permite optimizar el envío de dibujos', () => {
  const p = new FrameBudgetPolicy()
  drive(p, 12, { frameMs: 30, cpuMs: 26, logicMs: 15, gpuMs: 5 })
  assert.equal(p.report.bottleneck, 'submission')
  assert.ok(p.geometry > 0)
})

test('coste de envío de dibujos ajusta geometría, no efectos', () => {
  const p = new FrameBudgetPolicy()
  drive(p, 20, { frameMs: 25, cpuMs: 23, logicMs: 2, gpuMs: 6 })
  assert.equal(p.report.bottleneck, 'submission')
  assert.equal(p.geometry, 3); assert.equal(p.effects, 0)
})

test('30 Hz externos y GPU no medible no provocan degradación ciega', () => {
  for (const gpuMs of [null, 3]) {
    const p = new FrameBudgetPolicy()
    drive(p, 12, { frameMs: 1000 / 30, gpuMs })
    assert.equal(p.geometry + p.effects, 0)
    assert.equal(p.report.state, 'limited')
    assert.equal(p.report.bottleneck, gpuMs === null ? 'unknown' : 'pacing')
    assert.equal(p.report.gpuMs, gpuMs)
  }
})

test('un tirón aislado y pausas de pestaña no reducen calidad', () => {
  const p = new FrameBudgetPolicy()
  let { now } = drive(p, 4, { frameMs: 1000 / 60, gpuMs: 5 })
  p.sample({ frameMs: 160, cpuMs: 4, logicMs: 2, gpuMs: 5 }, now += 160)
  drive(p, 4, { frameMs: 1000 / 60, gpuMs: 5 }, now)
  p.sample({ frameMs: 8000, cpuMs: 4, logicMs: 2 }, now + 12000)
  assert.equal(p.geometry + p.effects, 0)
  assert.equal(p.report.state, 'warming')
})

test('recupera calidad gradualmente tras margen sostenido', () => {
  const p = new FrameBudgetPolicy()
  const { now } = drive(p, 14, { frameMs: 30, gpuMs: 28 })
  const reduced = p.geometry + p.effects
  assert.ok(reduced > 0)
  const short = drive(p, 3, { frameMs: 1000 / 60, gpuMs: 4 }, now)
  assert.equal(p.geometry + p.effects, reduced)
  drive(p, 65, { frameMs: 1000 / 60, gpuMs: 4 }, short.now)
  assert.equal(p.geometry + p.effects, 0)
})

test('no anuncia ajustes a subsistemas ausentes o desactivados', () => {
  const p = new FrameBudgetPolicy()
  drive(p, 12, { frameMs: 30, gpuMs: 28, canGeometry: false, canEffects: false })
  assert.equal(p.geometry + p.effects, 0)
  assert.equal(p.report.state, 'limited')
})

function monitorFixture({ gpu = true, ready = true } = {}) {
  let open = null, resets = 0, created = 0, deleted = 0
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }
  const gl = { QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4,
    getExtension: () => gpu ? ext : null, getParameter: () => false,
    createQuery: () => ({ id: ++created }),
    beginQuery(_kind, q) { assert.equal(open, null); open = q },
    endQuery() { assert.ok(open); open = null }, deleteQuery() { deleted++ },
    getQueryParameter: (_q, key) => key === 3 ? ready : 5e6,
  }
  const renderer = { getContext: () => gl, info: { autoReset: true,
    reset() { resets++ }, render: { calls: 5, triangles: 10 }, memory: { geometries: 2, textures: 1 } } }
  const monitor = new PerfMonitor(renderer, () => 1)
  return { monitor, renderer, counts: () => ({ created, deleted, resets, open }) }
}

test('medición ligera funciona con F3 cerrado sin instrumentar pasadas y consume GPU una vez', () => {
  const { monitor: p, renderer, counts } = monitorFixture()
  p.setBudgetEnabled(true)
  for (let i = 0; i < 16; i++) { p.frameStart(); p.time('Escena', () => {}); p.frameEnd() }
  assert.deepEqual(counts(), { created: 2, deleted: 2, resets: 16, open: null })
  assert.equal(p.takeBudgetGpu(), 5); assert.equal(p.takeBudgetGpu(), null)
  assert.deepEqual(p.stats.snapshot().gpu, {})
  assert.deepEqual(p.stats.snapshot().cpu, {})
  assert.equal(renderer.info.autoReset, false)
  p.setBudgetEnabled(false)
  assert.equal(renderer.info.autoReset, true)
})

test('a pocos FPS puede muestrear cada dos dibujos manteniendo la misma cola acotada', () => {
  const { monitor: p, counts } = monitorFixture()
  p.setBudgetEnabled(true); p.budgetStride = 2
  for (let i = 0; i < 8; i++) { p.frameStart(); p.frameEnd() }
  assert.equal(counts().created, 4)
  assert.equal(p.takeBudgetGpu(), 5)
})

test('la cola de consultas está acotada aunque el driver nunca publique resultados', () => {
  const { monitor: p, counts } = monitorFixture({ ready: false })
  p.setBudgetEnabled(true)
  for (let i = 0; i < 500; i++) { p.frameStart(); p.frameEnd() }
  assert.equal(counts().created, 8)
  assert.equal(p.takeBudgetGpu(), null)
  p.setBudgetEnabled(false)
  assert.equal(counts().deleted, 8)
})

test('F3 y controlador comparten temporizador sin solapar consultas ni duplicar AO total', () => {
  const { monitor: p, renderer, counts } = monitorFixture()
  p.setBudgetEnabled(true); p.enable(true)
  p.frameStart()
  p.time('Fotograma (CPU)', () => { p.time('AO · copia', () => {}); p.time('AO · mezcla', () => {}) })
  p.frameEnd()
  assert.equal(p.takeBudgetGpu(), counts().created * 5)
  p.enable(false)
  assert.equal(renderer.info.autoReset, false)
  p.frameStart(); p.frameEnd()
  assert.equal(counts().open, null)
  p.setBudgetEnabled(false)
  assert.equal(renderer.info.autoReset, true)
})

test('sin extensión no inventa tiempos GPU', () => {
  const { monitor: p, counts } = monitorFixture({ gpu: false })
  p.setBudgetEnabled(true); p.frameStart(); p.frameEnd()
  assert.equal(counts().created, 0)
  assert.equal(p.takeBudgetGpu(), null)
})

test('cerrar F3 respeta AO adaptativo y restaura solamente su experimento', () => {
  const { monitor: p } = monitorFixture({ gpu: false })
  const pass = { width: 1280, height: 720, gtaoMaterial: {}, pdMaterial: {},
    setSize(w, h) { this.width = w; this.height = h }, _renderPass() {}, _renderOverride() {} }
  p.wrapAO(pass); p.setRuntimeAoScale(0.75)
  p.enable(true); p.setAoScale(0.5); p.enable(false)
  assert.equal(p.aoScale, 1)
  assert.equal(pass.width, 960)
  pass.setSize(800, 600)
  assert.equal(pass.width, 600)
  p.setRuntimeAoScale(1)
  assert.equal(pass.width, 800)
})

test('adaptador conserva configuración y restaura LOD/AO al detener Play, ocultar o desactivar', () => {
  const { monitor } = monitorFixture({ gpu: false })
  const lod = { quality: 1, enableLod: true, meshes: [], terrains: [], foliages: [], clusters: { entries: [] },
    setBudgetQuality(q) { this.quality = q } }
  const vp = { perf: monitor, playing: true, lodManager: lod, requestRender() {} }
  const controller = new RuntimePerformanceController(vp)
  const cfg = Object.freeze(normalizeRender({ look: 'realista', resScale: 1, lodQuality: 1.5 }))
  controller.configure(cfg); controller.sync(0)
  controller.policy.geometry = 3; controller.policy.effects = 3; controller.apply()
  assert.equal(lod.quality, 0.75); assert.equal(monitor.runtimeAoScale, 0.5)
  assert.equal(controller.cloudScale, 1, 'la presión no reduce las muestras de nubes')
  assert.equal(cfg.resScale, 1); assert.equal(cfg.profile, 'alto'); assert.equal(cfg.lodQuality, 1.5)
  controller.sync(1000, false)
  assert.equal(lod.quality, 1.5); assert.equal(monitor.runtimeAoScale, 1)
  controller.sync(2000); assert.equal(controller.active, true)
  controller.configure({ ...cfg, performanceAuto: false })
  assert.equal(controller.active, false)
  assert.equal(monitor.budgetEnabled, false)
})

test('configuración acepta exclusión explícita y conserva TAA/resolución dinámica retirados', () => {
  assert.equal(normalizeRender({}).performanceAuto, true)
  assert.equal(normalizeRender({ performanceAuto: false }).performanceAuto, false)
  const cfg = normalizeRender({ targetFps: NaN, dynRes: true, taa: true })
  assert.equal(cfg.targetFps, 60); assert.equal(cfg.dynRes, false); assert.equal(cfg.taa, false)
})

test('montar terreno programa el BakeRuntime vigente y permite cargar escenas reales', () => {
  let scheduled = 0
  const mounted = []
  const piece = { mesh: { position: { set() {} } }, foliage: { group: { position: { set() {} } } }, ox: 0, oy: 0, oz: 0 }
  const graph = { vp: { world: { add: (...items) => mounted.push(...items) }, requestRender() {} },
    bake: { schedule() { scheduled++ } }, _foliageCounts() {} }
  terrainMethods._mountPiece.call(graph, piece)
  assert.equal(scheduled, 1)
  assert.deepEqual(mounted, [piece.mesh, piece.foliage.group])
})

test('captura IBL respeta presupuesto incluso con más de 140 ms entre frames', () => {
  const cfg = { interval: 6000, ready: true, immediate: false, throttled: true }
  assert.equal(environmentBakeDelay({ ...cfg, age: 500 }), 5500)
  assert.equal(environmentBakeDelay({ ...cfg, age: 900 }), 5100) // mismo instante objetivo, sin aplazarlo cada frame
  assert.equal(environmentBakeDelay({ ...cfg, age: 6100 }), 0)
  assert.equal(environmentBakeDelay({ ...cfg, age: 500, immediate: true }), 0)
  assert.equal(environmentBakeDelay({ ...cfg, age: 500, ready: false }), 0)
  assert.equal(environmentBakeDelay({ ...cfg, age: 500, throttled: false }), 140) // respuesta del editor intacta
})

test('nubes solas no provocan ajustes de calidad que ya no tienen actuador', () => {
  const { monitor } = monitorFixture({ gpu: false })
  const vp = { perf: monitor, playing: true, look: { aoPass: null, profile: 'bajo' }, requestRender() {} }
  const controller = new RuntimePerformanceController(vp)
  controller.configure(normalizeRender({ profile: 'bajo', ao: 0, dynamicReflections: false, indirectProbeGrid: false }))
  controller.sync(0)
  for (let i = 1; i <= 400; i++) controller.sample({ frameMs: 30, cpuMs: 4, logicMs: 2, gpuMs: 27 }, i * 30)
  assert.equal(controller.policy.effects, 0)
  assert.equal(controller.policy.report.state, 'limited')
  assert.equal(controller.cloudScale, 1)
})
