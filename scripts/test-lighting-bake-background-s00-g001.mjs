import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { tileShape, nextGpuBudget, estimatedTraceMemoryBytes, waitForGpu, GPU_TILE_MAX, GPU_TILE_MIN } from '../src/engine/runtime/bake/scheduler.js'
import { runBakeWorkerJob } from '../src/engine/runtime/bake/worker-protocol.js'

const root = new URL('../', import.meta.url)
const source = name => fs.readFileSync(new URL(name, root), 'utf8')

test('tiles: ningún despacho supera el presupuesto de píxeles', () => {
  for (const w of [9, 64, 512, 2048]) for (const b of [GPU_TILE_MIN, 64, GPU_TILE_MAX]) {
    const t = tileShape(w, b)
    assert.ok(t.width >= 1 && t.height >= 1)
    assert.ok(t.width * t.height <= b)
    assert.ok(t.width <= w)
  }
})
test('la adaptación reduce trabajo lento y aumenta trabajo rápido con límites', () => {
  assert.ok(nextGpuBudget(128, 35) < 128)
  assert.ok(nextGpuBudget(128, 1) > 128)
  assert.equal(nextGpuBudget(GPU_TILE_MIN, 400), GPU_TILE_MIN)
  assert.equal(nextGpuBudget(GPU_TILE_MAX, 0.1), GPU_TILE_MAX)
})
test('la estimación impide el atlas 2048 de alto consumo', () => {
  assert.ok(estimatedTraceMemoryBytes(1024) < 160 * 1024 * 1024)
  assert.ok(estimatedTraceMemoryBytes(2048) > 160 * 1024 * 1024)
})
function fakeGL(states = []) {
  let n = 0, deleted = 0
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3, WAIT_FAILED: 4, TIMEOUT_EXPIRED: 5,
    fenceSync: () => ({}), flush: () => {}, clientWaitSync: () => states[Math.min(n++, states.length - 1)] ?? 2,
    isContextLost: () => false, deleteSync: () => { deleted++ },
  }
  return { gl, get deleted() { return deleted } }
}
test('fence GPU progresa sin gl.finish y libera el sync', async () => {
  const f = fakeGL([5,5,3])
  const ms = await waitForGpu(f.gl, { sleep: async () => {}, now: () => 0 })
  assert.equal(ms, 0)
  assert.equal(f.deleted, 1)
})
test('fence cancela sin bloquear ni dejar sync', async () => {
  const f = fakeGL([5,5,5])
  let aborted = false
  await assert.rejects(waitForGpu(f.gl, { cancelled: () => aborted, sleep: async () => { aborted = true } }), /Cancelado/)
  assert.equal(f.deleted, 1)
})
test('fence detecta timeout sin publicar datos', async () => {
  const f = fakeGL([5,5,5])
  let clock = 0
  await assert.rejects(waitForGpu(f.gl, { timeoutMs: 8, now: () => clock, sleep: async () => { clock += 5 } }), e => e.gpuTimeout === true)
  assert.equal(f.deleted, 1)
})
class FakeWorker {
  posted = []; terminated = 0
  postMessage(data, transfer) { this.posted.push({ data, transfer }) }
  terminate() { this.terminated++ }
  emit(m) { this.onmessage?.({ data: m }) }
}
function job(options = {}) {
  const w = new FakeWorker()
  const p = runBakeWorkerJob({ createWorker: () => w, input: {}, cfg: {}, transfer: [], ...options })
  return { w, p }
}
test('Worker entrega progreso y resultado y termina exactamente una vez', async () => {
  const progress = []
  const {w,p} = job({ onProgress: p => progress.push(p) })
  w.emit({type:'progress',label:'Sondas',fraction:0.9})
  w.emit({type:'done',res:{lightmaps:[1]}})
  assert.deepEqual(await p, {lightmaps:[1]})
  assert.equal(progress[0].fraction,0.9)
  assert.equal(w.terminated,1)
  w.emit({type:'error',message:'tarde'})
})
test('Worker abortado cancela, elimina oyentes y no publica', async () => {
  const controller = new AbortController()
  const {w,p} = job({ signal:controller.signal })
  controller.abort()
  await assert.rejects(p,/Cancelado/)
  assert.equal(w.terminated,1)
})
test('Worker emite error GPU y conserva clasificación', async () => {
  const {w,p} = job()
  w.emit({type:'error',message:'GPU agotada',contextLost:true})
  await assert.rejects(p,e=>e.contextLost===true)
  assert.equal(w.terminated,1)
})
test('pérdida del contexto del editor cancela el Worker GPU', async () => {
  const events = new EventTarget()
  const {w,p} = job({viewportCanvas:events})
  events.dispatchEvent(new Event('webglcontextlost'))
  await assert.rejects(p,e=>e.contextLost===true)
  assert.equal(w.terminated,1)
})
test('contrato: solo Worker GPU, sin gl.finish ni fallback en viewport', () => {
  const core = source('src/engine/runtime/bake/core.js')
  const bake = source('src/engine/runtime/bake/baker.js')
  assert.ok(core.includes('waitForGpu('))
  assert.ok(!/gl\.finish\s*\(/.test(core))
  assert.ok(bake.includes('runBakeWorkerJob('))
  assert.ok(!bake.includes('runBake({ renderer: vp.renderer'))
})
test('contrato: activos previos se eliminan solo después de aplicar', () => {
  const code = source('src/core/state/bake.js')
  assert.ok(code.indexOf('await ed.bake.apply()') < code.indexOf('await dropBakeAssets(previous'))
  assert.ok(code.includes('env.bake = previous'))
})
