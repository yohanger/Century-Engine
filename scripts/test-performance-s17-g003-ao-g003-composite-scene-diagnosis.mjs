// S17 AO-G003: contrato de instrumentación, sin sustituir RenderPass/GTAOPass ni modificar el render.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PerfMonitor } from '../src/engine/runtime/render/perf.js'

function harness(gpu = true) {
  const queries = []
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }
  const gl = {
    QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4,
    getExtension(name) { return gpu && name === 'EXT_disjoint_timer_query_webgl2' ? ext : null },
    getParameter() { return false },
    createQuery() { const q = { ms: 1, deleted: false }; queries.push(q); return q },
    beginQuery(_kind, q) { assert.equal(this.open, undefined); this.open = q },
    endQuery() { assert.ok(this.open); this.open = undefined },
    getQueryParameter(q, which) { return which === 3 ? true : q.ms * 1e6 },
    deleteQuery(q) { q.deleted = true },
  }
  const actions = []
  const renderer = {
    getContext: () => gl,
    info: { autoReset: true, reset() {}, render: { calls: 0, triangles: 0, lines: 0, points: 0 }, memory: { geometries: 0, textures: 0 } },
    render(scene) { actions.push('draw:' + scene) },
    clear() { actions.push('clear') },
    clearDepth() { actions.push('depth') },
  }
  const monitor = new PerfMonitor(renderer, (() => { let n = 0; return () => ++n })())
  return { monitor, renderer, queries, actions }
}
function createAO() {
  const output = []
  const pass = {
    width: 640, height: 360, _lfAoFullSize: { w: 1280, h: 720 },
    gtaoRenderTarget: { width: 640, height: 360 },
    gtaoMaterial: { kind: 'gtao' }, pdMaterial: { kind: 'denoise' },
    copyMaterial: { kind: 'copy' }, blendMaterial: { kind: 'blend' },
    normalMaterial: { kind: 'normals' },
    _renderPass(_r, material) { output.push(material.kind) },
    _renderOverride(_r, material) { output.push(material.kind) },
    render(r) {
      this._renderOverride(r, this.normalMaterial)
      this._renderPass(r, this.gtaoMaterial)
      this._renderPass(r, this.pdMaterial)
      this._renderPass(r, this.copyMaterial)
      this._renderPass(r, this.blendMaterial)
    },
  }
  return { pass, output }
}
function createScene() {
  return {
    render(r, _write, _read) {
      r.clear()
      r.render('scene')
      r.clearDepth()
    },
  }
}
const file = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8')

test('AO-SCENE-01 · copia y mezcla se distinguen sin sumar por duplicado', () => {
  const { monitor, renderer } = harness()
  const { pass, output } = createAO()
  monitor.wrapPass(pass, 'AO'); monitor.wrapAO(pass); monitor.enable(true)
  monitor.frameStart(); pass.render(renderer); monitor.frameEnd()
  const snap = monitor.stats.snapshot()
  assert.equal(snap.gpu['AO · composición'].avg, 2)
  assert.equal(snap.gpuDetails['AO · copia'].avg, 1)
  assert.equal(snap.gpuDetails['AO · mezcla'].avg, 1)
  assert.equal(snap.gpuDetails['AO · preparación de salida'].avg, 0) // no se suma de nuevo
  assert.deepEqual(output, ['normals', 'gtao', 'denoise', 'copy', 'blend'])
})

test('AO-SCENE-02 · el total GPU no suma dos veces el detalle de composición', () => {
  const { monitor, renderer, queries } = harness()
  const { pass } = createAO()
  monitor.wrapAO(pass); monitor.wrapPass(pass, 'AO')
  monitor.enable(true); monitor.frameStart(); pass.render(renderer); monitor.frameEnd()
  const s = monitor.stats.snapshot()
  assert.equal(s.gpu['AO · total'].avg, Object.entries(s.gpu).filter(([k]) => k.startsWith('AO · ') && k !== 'AO · total').reduce((n, [,v]) => n + v.avg, s.gpu.AO.avg))
  assert.equal(queries.every(q => q.deleted), true)
  assert.equal(monitor.gpu.stack.length, 0)
})

test('AO-SCENE-03 · RenderPass identifica dibujo y limpieza sin alterar las llamadas', () => {
  const { monitor, renderer, actions } = harness()
  const pass = createScene()
  const before = [renderer.render, renderer.clear, renderer.clearDepth]
  monitor.wrapPass(pass, 'Escena'); monitor.wrapScene(pass)
  monitor.enable(true); monitor.frameStart()
  pass.render(renderer, { width: 100 }, { width: 1280, height: 720 }); monitor.frameEnd()
  const snap = monitor.stats.snapshot()
  assert.deepEqual(actions, ['clear', 'draw:scene', 'depth'])
  assert.ok(snap.gpu['Escena · dibujo'].avg > 0)
  assert.ok(snap.gpu['Escena · limpieza'].avg > 0)
  assert.ok(snap.gpu.Escena.avg > 0)
  assert.equal(snap.extra.sceneBuffer, '1280×720')
  assert.equal(snap.extra.sceneDraws, 1)
  assert.deepEqual([renderer.render, renderer.clear, renderer.clearDepth], before)
})

test('AO-SCENE-04 · con Stats apagado el método original se ejecuta sin envoltorios temporales', () => {
  const { monitor, renderer, actions, queries } = harness()
  const pass = createScene(); monitor.wrapScene(pass)
  const before = [renderer.render, renderer.clear, renderer.clearDepth]
  pass.render(renderer, {}, {})
  assert.deepEqual(actions, ['clear','draw:scene','depth'])
  assert.deepEqual([renderer.render, renderer.clear, renderer.clearDepth], before)
  assert.deepEqual(monitor.stats.snapshot().cpu, {})
  assert.equal(queries.length, 0)
})

test('AO-SCENE-05 · restaura los métodos originales tras una excepción de render', () => {
  const { monitor, renderer } = harness()
  const pass = { render(r) { r.clear(); r.render('scene'); throw new Error('gl error') } }
  const refs = [renderer.render, renderer.clear, renderer.clearDepth]
  monitor.wrapScene(pass); monitor.enable(true)
  assert.throws(() => pass.render(renderer), /gl error/)
  assert.deepEqual([renderer.render, renderer.clear, renderer.clearDepth], refs)
  assert.equal(monitor.gpu.stack.length, 0)
})

test('AO-SCENE-06 · no duplica instrumentación si el compositor reutiliza el mismo RenderPass', () => {
  const { monitor, renderer, actions } = harness()
  const pass = createScene(); monitor.wrapScene(pass)
  const first = pass.render; monitor.wrapScene(pass)
  assert.equal(pass.render, first)
  monitor.enable(true); monitor.frameStart(); pass.render(renderer); monitor.frameEnd()
  assert.deepEqual(actions, ['clear','draw:scene','depth'])
  assert.equal(monitor.stats.snapshot().extra.sceneDraws, 1)
})

test('AO-SCENE-07 · buffer interno GTAO y composición se registran con dimensiones separadas', () => {
  const { monitor, renderer } = harness()
  const { pass } = createAO(); monitor.wrapAO(pass)
  monitor.enable(true); monitor.frameStart(); pass.render(renderer); monitor.frameEnd()
  assert.equal(monitor.stats.snapshot().extra.aoWorking, '640×360')
  assert.equal(monitor.stats.snapshot().extra.aoCompositing, '1280×720')
})

test('AO-SCENE-08 · las fases ausentes del desglose reciben ceros en muestras posteriores', () => {
  const { monitor, renderer } = harness()
  const { pass } = createAO(); monitor.wrapAO(pass); monitor.enable(true)
  monitor.frameStart(); pass.render(renderer); monitor.frameEnd()
  monitor.frameStart(); monitor.gpu.begin('Escena'); monitor.gpu.end(); monitor.frameEnd()
  const details = monitor.stats.snapshot().gpuDetails
  assert.equal(details['AO · copia'].avg, 0.5)
  assert.equal(details['AO · mezcla'].avg, 0.5)
})

test('AO-SCENE-09 · la latencia de la consulta GPU informa retraso y no altera tiempos', () => {
  const { monitor, renderer } = harness()
  monitor.enable(true); monitor.frameStart()
  monitor.time('Escena', () => {})
  monitor.frameEnd()
  const snap = monitor.stats.snapshot()
  assert.equal(snap.extra.gpuLatencyFrames, 1)
  assert.equal(snap.gpu.Escena.avg, 1)
})

test('AO-SCENE-10 · pruebas base de AO siguen usando el addon oficial y muestras 16+16', () => {
  const look = file('src/engine/runtime/render/look.js')
  assert.match(look, /new GTAOPass\(vp\.scene, vp\.camera/)
  assert.match(look, /samples: 16, distanceFallOff: 1/)
  assert.match(look, /rings: 2, samples: 16/)
  assert.match(look, /this\.vp\.perf\.wrapScene\(p\)/)
  assert.match(look, /this\.vp\.perf\.wrapAO\(p\)/)
})

test('AO-SCENE-11 · Stats distingue los detalles de los totales sin modificar el Runtime', () => {
  const panel = file('src/components/PerfPanel.vue')
  const player = file('src/runtime-app/RuntimeApp.vue')
  assert.match(panel, /gpuDetails/)
  assert.match(panel, /Más pasadas/)
  assert.match(panel, /name === 'AO · total' \? 0 : v\.avg/)
  assert.match(player, /statsAllowed && statsOpen/)
})
