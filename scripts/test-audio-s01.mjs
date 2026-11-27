// QA de audio sin navegador: simula los nodos Web Audio para comprobar el ciclo de vida.
import test from 'node:test'
import assert from 'node:assert/strict'
import { AudioEngine } from '../src/engine/runtime/audio/engine.js'
import { newFx, normalizeAudio } from '../src/engine/runtime/audio/config.js'

class Param {
  constructor(value = 1) { this.value = value; this.ramps = []; this.targets = [] }
  cancelScheduledValues(t) { this.cancelledAt = t }
  setValueAtTime(value) { this.value = value }
  linearRampToValueAtTime(value, time) { this.ramps.push([value, time]) }
  setTargetAtTime(value) { this.targets.push(value); this.value = value }
}
class Node {
  constructor() { this.connections = []; this.disconnected = false }
  connect(node) { this.connections.push(node); return node }
  disconnect() { this.disconnected = true; this.connections = [] }
}
class Gain extends Node { constructor() { super(); this.gain = new Param() } }
class Source extends Node {
  constructor() { super(); this.playbackRate = new Param(); this.stopCalls = []; this.onended = null }
  start(time, offset) { this.startArgs = [time, offset] }
  stop(time) { this.stopCalls.push(time) }
  end() { this.onended?.() }
}
class Filter extends Node { constructor() { super(); this.frequency = new Param(); this.Q = new Param() } }
class Context {
  constructor() { this.currentTime = 3; this.sampleRate = 48000; this.sources = []; this.filters = [] }
  createGain() { return new Gain() }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source }
  createAnalyser() { const a = new Node(); a.fftSize = 512; a.getFloatTimeDomainData = () => {}; return a }
  createBiquadFilter() { const f = new Filter(); this.filters.push(f); return f }
}
function engine() {
  const e = new AudioEngine()
  e.ctx = new Context()
  e._build()
  return e
}
function play(e) { return e._voice({ duration: 12 }, { group: 'sfx', mode: 'ui' }) }

// A01: no soltar el grafo de audio antes de que termine el fundido real.
test('A01: un fundido conserva la voz hasta onended', async () => {
  const e = engine(), v = play(e), src = e.ctx.sources[0]
  let done = false; v.done.then(() => { done = true })
  v.stop(2)
  assert.deepEqual(src.stopCalls, [5.02])
  assert.deepEqual(v.gain.gain.ramps, [[0, 5]])
  assert.equal(v.isPlaying, false)
  assert.equal(e.voices.has(v), true)
  assert.equal(v.gain.disconnected, false)
  await Promise.resolve()
  assert.equal(done, false)
  src.end()
  await v.done
  assert.equal(done, true)
  assert.equal(e.voices.has(v), false)
})

test('A01: parada inmediata libera la voz sin esperar al evento', async () => {
  const e = engine(), v = play(e), src = e.ctx.sources[0]
  v.stop(0)
  await v.done
  assert.deepEqual(src.stopCalls, [undefined])
  assert.equal(e.voices.has(v), false)
})

test('A01: repetir stop durante un fade no desconecta antes de tiempo', async () => {
  const e = engine(), v = play(e), src = e.ctx.sources[0]
  v.stop(1.5)
  v.stop(1)
  assert.equal(e.voices.has(v), true)
  assert.equal(src.stopCalls.length, 1)
  src.end()
  await v.done
  assert.equal(e.voices.has(v), false)
})

test('A01: stop inmediato posterior cancela el fade (cambio de escena)', async () => {
  const e = engine(), v = play(e), src = e.ctx.sources[0]
  v.stop(5)
  v.stop(0)
  await v.done
  assert.equal(e.voices.has(v), false)
  assert.equal(src.onended, null)
  assert.equal(src.stopCalls.length, 2)
})

test('A01: stopAll con fade mantiene voces hasta sus finales', async () => {
  const e = engine(), one = play(e), two = play(e)
  e.stopAll(null, 0.75)
  assert.equal(e.voices.size, 2)
  e.ctx.sources.forEach((s) => s.end())
  await Promise.all([one.done, two.done])
  assert.equal(e.voices.size, 0)
})

test('A01: pause y resume conservan la promesa de finalización', async () => {
  const e = engine(), v = play(e), old = e.ctx.sources[0]
  v.pause()
  assert.equal(e.voices.has(v), true)
  old.end()
  v.resume()
  assert.equal(e.voices.has(v), true)
  const current = e.ctx.sources[1]
  current.end()
  await v.done
  assert.equal(e.voices.has(v), false)
})

test('A02: el override por id desactiva el efecto temporal', () => {
  const e = engine(), x = newFx('lowpass')
  e.addExtraFx('sfx', x)
  assert.equal(e.eff(e.cfg.groups.find((g) => g.id === 'sfx')).fx.at(-1).on, true)
  e.setOverride('sfx', { fx: { [x.id]: { on: false } } })
  const g = e.eff(e.cfg.groups.find((g) => g.id === 'sfx'))
  assert.equal(g.fx.at(-1).on, false)
  assert.equal(e.nodes.get('sfx').chain.length, 1)
  assert.equal(e.ctx.filters.at(-1).frequency.targets.at(-1), 22000)
})

test('A02: el override por tipo modifica efectos temporales y persistentes', () => {
  const persistent = newFx('lowpass'), extra = newFx('lowpass')
  const e = engine()
  e.configure({ groups: [{ id: 'sfx', fx: [persistent] }] })
  e.addExtraFx('sfx', extra)
  e.setOverride('sfx', { fx: { lowpass: { on: false } } })
  const fx = e.eff(e.cfg.groups.find((g) => g.id === 'sfx')).fx
  assert.equal(fx.length, 2)
  assert.deepEqual(fx.map((f) => f.on), [false, false])
})

test('A02: volver a activar efecto temporal no duplica la cadena', () => {
  const e = engine(), x = newFx('lowpass')
  e.addExtraFx('sfx', x)
  e.setOverride('sfx', { fx: { [x.id]: { on: false } } })
  e.setOverride('sfx', { fx: { [x.id]: { on: true, freq: 640 } } })
  const g = e.eff(e.cfg.groups.find((s) => s.id === 'sfx'))
  assert.equal(g.fx.at(-1).freq, 640)
  assert.equal(g.fx.at(-1).on, true)
  assert.equal(e.nodes.get('sfx').chain.length, 1)
  assert.equal(e.ctx.filters.at(-1).frequency.targets.at(-1), 640)
})

test('A02: clearOverrides retira únicamente los efectos temporales', () => {
  const e = engine(), x = newFx('lowpass')
  e.addExtraFx('sfx', x)
  assert.equal(e.eff(e.cfg.groups.find((s) => s.id === 'sfx')).fx.length, 1)
  e.clearOverrides()
  assert.equal(e.eff(e.cfg.groups.find((s) => s.id === 'sfx')).fx.length, 0)
  assert.equal(e.nodes.get('sfx').chain.length, 0)
})

test('A02: la configuración persistente permanece independiente del override', () => {
  const e = engine(), fx = newFx('lowpass')
  e.configure(normalizeAudio({ groups: [{ id: 'sfx', fx: [fx] }] }))
  e.setOverride('sfx', { fx: { [fx.id]: { on: false } } })
  assert.equal(e.cfg.groups.find((g) => g.id === 'sfx').fx[0].on, true)
  assert.equal(e.eff(e.cfg.groups.find((g) => g.id === 'sfx')).fx[0].on, false)
})
