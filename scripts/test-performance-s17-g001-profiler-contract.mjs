// S17-G001: contrato del profiler existente. No mide FPS reales ni sustituye QA WebGL.
import test from 'node:test'
import assert from 'node:assert/strict'
import { PerfStats, PerfMonitor, GpuTimer, summarize } from '../src/engine/runtime/render/perf.js'

test('S17: conjunto vacío no inventa FPS', () => {
  assert.deepEqual(summarize([]), { avg: 0, median: 0, max: 0, p95: 0, n: 0 })
  assert.equal(new PerfStats().snapshot().fps, 0)
})

test('S17: media, mediana, máximo y p95 se calculan sin modificar la muestra', () => {
  const data = [10, 18, 12, 16, 11, 33, 14, 13, 15, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]
  const original = [...data]
  const s = summarize(data)
  assert.equal(s.avg, data.reduce((a, b) => a + b, 0) / data.length)
  assert.equal(s.median, 19.5)
  assert.equal(s.max, 33)
  assert.equal(s.p95, 33)
  assert.deepEqual(data, original)
})

test('S17: ventana cronológica circular mantiene solo las últimas 120 muestras', () => {
  const s = new PerfStats()
  for (let i = 1; i <= 130; ++i) s.frame(i)
  const h = s.snapshot().history
  assert.equal(h.length, 120)
  assert.deepEqual(h.slice(0, 2), [11, 12])
  assert.deepEqual(h.slice(-2), [129, 130])
})

test('S17: no incorpora pausas ni intervalos no positivos al FPS', () => {
  const s = new PerfStats()
  for (const dt of [0, -2, 500, 1200, 16, 18]) s.frame(dt)
  assert.deepEqual(s.snapshot().history, [16, 18])
  assert.equal(s.snapshot().fps, 1000 / 17)
})

test('S17: tiempos CPU por pasada se acumulan en un frame', () => {
  const s = new PerfStats(4)
  s.begin('post', 12); s.end('post', 14)
  s.begin('post', 16); s.end('post', 19)
  s.endFrame()
  assert.equal(s.snapshot().cpu.post.avg, 5)
  s.endFrame()
  assert.equal(s.snapshot().cpu.post.avg, 2.5)
})

test('S17: el snapshot copia contadores y series; reset reinicia tiempos', () => {
  const s = new PerfStats()
  s.frame(20); s.gpuSample('sombras', 4); s.info = { calls: 17 }; s.extra = { lodSwaps: 5 }
  assert.equal(s.snapshot().gpu.sombras.avg, 4)
  assert.equal(s.snapshot().info.calls, 17)
  s.reset()
  assert.equal(s.snapshot().fps, 0)
  assert.deepEqual(s.snapshot().gpu, {})
})

test('S17: sin extensión WebGL no se finge medición GPU', () => {
  const g = new GpuTimer({ getExtension: () => null })
  assert.equal(g.supported, false)
  g.begin('scene'); g.end(); g.endFrame()
  assert.equal(g.pending.length, 0)
})

test('S17: el monitor desactivado ejecuta la pasada sin cronometrarla', () => {
  let t = 0, runs = 0, resets = 0
  const renderer = { info: { autoReset: true, reset: () => { resets++ }, render: { calls: 3, triangles: 9, lines: 0, points: 0 }, memory: { geometries: 2, textures: 1 } }, getContext: () => ({ getExtension: () => null }) }
  const p = new PerfMonitor(renderer, () => t++)
  assert.equal(p.time('scene', () => (++runs, 'ok')), 'ok')
  assert.equal(runs, 1); assert.equal(resets, 0)
  assert.deepEqual(p.stats.snapshot().cpu, {})
  p.enable(true)
  assert.equal(renderer.info.autoReset, false)
  p.frameStart()
  p.time('scene', () => (++runs, 'on'))
  p.frameEnd()
  assert.equal(p.stats.snapshot().cpu.scene.avg, 1)
  assert.equal(p.stats.snapshot().info.calls, 3)
  assert.equal(resets, 1)
  p.enable(false)
  assert.equal(renderer.info.autoReset, true)
})

test('S17: wrapPass conserva retorno y mide únicamente si está activado', () => {
  let n = 0, t = 0
  const renderer = { info: { autoReset: true, reset() {}, render: { calls: 0, triangles: 0, lines: 0, points: 0 }, memory: { geometries: 0, textures: 0 } }, getContext: () => ({ getExtension: () => null }) }
  const p = new PerfMonitor(renderer, () => t++)
  const pass = { render: x => (++n, x * 2) }
  p.wrapPass(pass, 'efecto'); p.wrapPass(pass, 'efecto')
  assert.equal(pass.render(4), 8)
  assert.equal(n, 1)
  p.enable(true)
  assert.equal(pass.render(5), 10)
  p.stats.endFrame()
  assert.equal(p.stats.snapshot().cpu.efecto.avg, 1)
  assert.equal(n, 2)
})
