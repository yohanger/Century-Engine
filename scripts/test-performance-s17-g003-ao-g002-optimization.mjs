import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PerfMonitor } from '../src/engine/runtime/render/perf.js'

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function fixture(w = 1280, h = 720) {
  const calls = []
  const pass = {
    width: w, height: h,
    gtaoMaterial: {}, pdMaterial: {},
    setSize(width, height) { this.width = width; this.height = height; calls.push([width, height]) },
    _renderPass() {}, _renderOverride() {},
  }
  const renderer = { getContext: () => ({ getExtension: () => null }), info: { autoReset: true } }
  const monitor = new PerfMonitor(renderer, () => 0)
  monitor.wrapAO(pass)
  return { monitor, pass, calls, renderer }
}

test('AO-OPT-01 · resolución por defecto 100 %, sin cambiar la escena', () => {
  const { pass, monitor, calls } = fixture(1920, 1080)
  assert.equal(monitor.aoScale, 1)
  assert.deepEqual(calls.at(-1), [1920, 1080])
  assert.equal(pass.width, 1920)
  assert.equal(pass.height, 1080)
})

test('AO-OPT-02 · variante 75 % cambia solo los targets internos del addon', () => {
  const { pass, monitor, calls } = fixture(1920, 1080)
  assert.equal(monitor.setAoScale(0.75), true)
  assert.deepEqual(calls.at(-1), [1440, 810])
  assert.deepEqual(pass._lfAoFullSize, { w: 1920, h: 1080 })
  assert.equal(monitor.aoPass, pass)
})

test('AO-OPT-03 · variante 50 % y tamaños impares se redondean y limitan', () => {
  const { monitor, calls } = fixture(1281, 721)
  monitor.setAoScale(0.5)
  assert.deepEqual(calls.at(-1), [641, 361])
  const { monitor: one, calls: single } = fixture(1, 1)
  one.setAoScale(0.5)
  assert.deepEqual(single.at(-1), [1, 1])
})

test('AO-OPT-04 · resize de Composer respeta escala AO, sin cambiar su entrada completa', () => {
  const { monitor, pass, calls } = fixture(1920, 1080)
  monitor.setAoScale(0.75)
  pass.setSize(800, 600)
  assert.deepEqual(calls.at(-1), [600, 450])
  assert.deepEqual(pass._lfAoFullSize, { w: 800, h: 600 })
  monitor.setAoScale(1)
  assert.deepEqual(calls.at(-1), [800, 600])
})

test('AO-OPT-05 · cerrar F3 restaura el 100 % y los contadores del renderer', () => {
  const { monitor, pass, renderer } = fixture()
  monitor.enable(true)
  monitor.setAoScale(0.5)
  assert.equal(renderer.info.autoReset, false)
  monitor.enable(false)
  assert.equal(monitor.aoScale, 1)
  assert.equal(pass.width, 1280)
  assert.equal(pass.height, 720)
  assert.equal(renderer.info.autoReset, true)
})

test('AO-OPT-06 · composición posterior reconstruye pase sin estado de dimensiones obsoleto', () => {
  const { monitor, pass } = fixture(1000, 600)
  monitor.enable(true)
  monitor.setAoScale(0.75)
  monitor.forgetAO(pass)
  assert.equal(monitor.aoPass, null)
  const other = { width: 600, height: 400, setSize(w,h){ this.width=w;this.height=h }, _renderPass() {}, _renderOverride() {}, gtaoMaterial: {},pdMaterial:{} }
  monitor.wrapAO(other)
  assert.equal(other.width, 450)
  assert.equal(other.height, 300)
  monitor.enable(false)
  assert.equal(other.width, 600)
  assert.equal(other.height, 400)
})

test('AO-OPT-07 · valores ajenos al contrato se rechazan sin cambio ni resize', () => {
  const { monitor, calls } = fixture()
  const count = calls.length
  for (const invalid of [-1, 0, 0.1, 0.65, 2, NaN, Infinity, 'error']) assert.equal(monitor.setAoScale(invalid), false)
  assert.equal(monitor.aoScale, 1)
  assert.equal(calls.length, count)
})

test('AO-OPT-08 · seleccionar de nuevo escala actual no recompila targets', () => {
  const { monitor, calls } = fixture()
  monitor.setAoScale(0.75)
  const count = calls.length
  monitor.setAoScale(0.75)
  assert.equal(calls.length, count)
})

test('AO-OPT-09 · el mismo GTAOPass conserva G-buffer, oclusión, denoising y composición', () => {
  const look = source('src/engine/runtime/render/look.js')
  assert.match(look, /new GTAOPass\(vp\.scene, vp\.camera/)
  assert.match(look, /samples: 16, distanceFallOff/)
  assert.match(look, /rings: 2, samples: 16/)
  assert.match(look, /this\.vp\.perf\?\.forgetAO\(this\.aoPass\)/)
  assert.doesNotMatch(look, /new (?:SSAO|HBAO)Pass/)
})

test('AO-OPT-10 · Stats no ofrece controles experimentales de resolución AO', () => {
  const panel = source('src/components/PerfPanel.vue')
  const cfg = source('src/engine/runtime/render/config.js')
  assert.doesNotMatch(panel, /lf-ao-test-scale|setAoScale|AO · resolución experimental/)
  assert.match(panel, /onBeforeUnmount\(\(\) => \{ clearInterval\(timer\); perf\(\)\?\.enable\(false\)/)
  assert.doesNotMatch(cfg, /aoScale|aoDiagnostic/)
})

test('AO-OPT-11 · Stats del AppImage permanece condicionado por NGME-STATS', () => {
  const player = source('src/runtime-app/RuntimeApp.vue')
  assert.match(player, /statsAllowed && statsOpen && game\?\.graph\?\.vp\?\.perf/)
  const panel = source('src/components/PerfPanel.vue')
  assert.match(panel, /GPU · pasadas/)
  assert.doesNotMatch(panel, /snap\.aoAvailable/)
})

test('AO-OPT-12 · estadísticas reinician tras cambiar modo y no contienen medias mixtas', () => {
  const { monitor } = fixture()
  monitor.stats.gpuSample('AO · total', 45)
  monitor.setAoScale(0.75)
  assert.equal(monitor.stats.snapshot().gpu['AO · total'], undefined)
})
