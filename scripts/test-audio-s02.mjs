// LF-AUDIO-S02-G001: regresión de oclusión 3D, sin dispositivos de sonido.
import test from 'node:test'
import assert from 'node:assert/strict'
import { AudioEngine } from '../src/engine/runtime/audio/engine.js'
import { normalizeSource, SOURCE_DEFAULTS } from '../src/engine/runtime/audio/config.js'

class Param {
  constructor(value = 1) { this.value = value; this.targets = [] }
  cancelScheduledValues() {}
  setValueAtTime(v) { this.value = v }
  setTargetAtTime(v, time, smooth) { this.value = v; this.targets.push([v, smooth]) }
}
class Node {
  constructor() { this.connections = []; this.disconnected = false }
  connect(n) { this.connections.push(n); return n }
  disconnect() { this.connections = []; this.disconnected = true }
}
class Gain extends Node { constructor() { super(); this.gain = new Param() } }
class Filter extends Node { constructor() { super(); this.frequency = new Param(); this.Q = new Param() } }
class Source extends Node {
  constructor() { super(); this.playbackRate = new Param(); this.onended = null }
  start() {}
  stop() { this.onended?.() }
}
class Panner extends Node {
  constructor() {
    super()
    for (const key of ['positionX', 'positionY', 'positionZ', 'orientationX', 'orientationY', 'orientationZ']) this[key] = new Param(0)
  }
}
class Context {
  constructor() { this.currentTime = 2; this.filters = []; this.panners = []; this.gains = [] }
  createGain() { const n = new Gain(); this.gains.push(n); return n }
  createBiquadFilter() { const n = new Filter(); this.filters.push(n); return n }
  createPanner() { const n = new Panner(); this.panners.push(n); return n }
  createBufferSource() { return new Source() }
  createAnalyser() { const a = new Node(); a.fftSize = 512; a.getFloatTimeDomainData = () => {}; return a }
}
const make = () => { const e = new AudioEngine(); e.ctx = new Context(); e._build(); return e }
const play = (engine, opts = {}) => engine._voice({ duration: 12 }, { group: 'sfx', mode: '3d', position: [4, 0, 0], ...opts })

test('A06: valores anteriores tienen oclusión desactivada', () => {
  assert.equal(SOURCE_DEFAULTS.occlusion, false)
  assert.equal(normalizeSource({}).occlusion, false)
  assert.equal(normalizeSource({ occlusion: true, mode: 'ui' }).occlusion, false)
  assert.equal(normalizeSource({ occlusion: true, mode: '3d' }).occlusion, true)
  assert.equal(normalizeSource({ occlusion: 'true' }).occlusion, false)
})
test('A07: grafo de voz 3D activo conecta filtro y ganancia antes del mezclador', () => {
  const e = make(), v = play(e, { occlusion: true })
  assert.ok(v.occlusionFilter && v.occlusionGain && v.panner)
  assert.equal(v.panner.connections[0], v.occlusionFilter)
  assert.equal(v.occlusionFilter.connections[0], v.occlusionGain)
  assert.equal(v.occlusionGain.connections[0], e.groupInput('sfx'))
  assert.equal(v.occlusionFilter.frequency.value, 22000)
  assert.equal(v.occlusionGain.gain.value, 1)
})
test('A07: sin oclusión, la cadena Panner -> grupo permanece igual', () => {
  const e = make(), v = play(e)
  assert.equal(v.occlusionFilter, undefined)
  assert.equal(v.panner.connections[0], e.groupInput('sfx'))
})
test('A07: audio 2D no crea filtros incluso si se pide oclusión', () => {
  const e = make(), v = e._voice({ duration: 1 }, { mode: 'ui', group: 'ui', occlusion: true })
  assert.equal(v.panner, undefined)
  assert.equal(v.occlusionFilter, undefined)
})
test('A08: bloquear y desbloquear aplica transiciones suavizadas, sin tocar volumen', () => {
  const e = make(), v = play(e, { occlusion: true, volume: 0.6 })
  v.setOcclusion(true)
  assert.deepEqual(v.occlusionFilter.frequency.targets.at(-1), [850, 0.07])
  assert.deepEqual(v.occlusionGain.gain.targets.at(-1), [0.35, 0.07])
  assert.equal(v.gain.gain.value, 0.6)
  v.setOcclusion(false)
  assert.deepEqual(v.occlusionFilter.frequency.targets.at(-1), [22000, 0.13])
  assert.deepEqual(v.occlusionGain.gain.targets.at(-1), [1, 0.13])
})
test('A08: posiciones modificadas por scripts se reflejan en el seguimiento de oclusión', () => {
  const e = make(), v = play(e, { occlusion: true })
  v.setPosition([3, 2, 1])
  assert.deepEqual(v.opts.position, [3, 2, 1])
})
test('A08: parada libera los nodos de filtro independientes', async () => {
  const e = make(), v = play(e, { occlusion: true })
  v.stop(0)
  await v.done
  v.dispose()
  assert.equal(v.panner.disconnected, true)
  assert.equal(v.occlusionFilter.disconnected, true)
  assert.equal(v.occlusionGain.disconnected, true)
})

// La suite de lógica escénica requiere Three.js instalado, como en npm ci del usuario.
const audioScene = await import('../src/engine/runtime/audio/scene.js').then((m) => m.AudioScene).catch((e) => {
  if (e.code === 'ERR_MODULE_NOT_FOUND' && e.message.includes('three')) return null
  throw e
})
const fakeVoice = (pos, owner = null) => ({
  occlusionFilter: {}, isPlaying: true, opts: { position: pos }, occlusionOwner: owner,
  states: [], setOcclusion(value) { this.states.push(value) },
})
const scene = (voices, cast) => {
  const a = Object.create(audioScene.prototype)
  a.cast = cast; a.engine = { voices: new Set(voices) }; a._occTokens = 4; a._occAt = null; a._occCursor = 0; a._occNext = new WeakMap()
  return a
}
test('A06: obstáculo activa y ausencia de obstáculo libera el filtrado', { skip: !audioScene && 'Instala Three.js para estas pruebas de escena' }, () => {
  const v = fakeVoice([5, 0, 0]), a = scene([v], () => true)
  a._updateOcclusion([0, 0, 0]); assert.deepEqual(v.states, [true])
  a._occNext.set(v, -Infinity)
  a.cast = () => false; a._updateOcclusion([0, 0, 0]); assert.deepEqual(v.states, [true, false])
})
test('A10: presupuesto de consultas y mínimo 200 ms por fuente', { skip: !audioScene && 'Instala Three.js para estas pruebas de escena' }, () => {
  const v = fakeVoice([4, 0, 0]); let rays = 0
  const a = scene([v], () => { rays++; return false })
  a._updateOcclusion([0, 0, 0]); a._updateOcclusion([0, 0, 0]); assert.equal(rays, 1)
  assert.ok(a._occTokens <= 3.1)
  assert.ok(a._occNext.get(v) > performance.now())
})
test('A10: distribuye consultas entre múltiples voces activas', { skip: !audioScene && 'Instala Three.js para estas pruebas de escena' }, () => {
  const voices = Array.from({ length: 12 }, (_, i) => fakeVoice([i + 1, 0, 0]))
  const a = scene(voices, () => true)
  a._updateOcclusion([0, 0, 0])
  assert.equal(voices.filter((v) => v.states.length).length, 4)
  a._occTokens = 4
  a._updateOcclusion([0, 0, 0])
  assert.equal(voices.filter((v) => v.states.length).length, 8)
})
test('A10: no consulta fuente sin oclusión, detenida o demasiado cercana', { skip: !audioScene && 'Instala Three.js para estas pruebas de escena' }, () => {
  const close = fakeVoice([0.01, 0, 0]), off = fakeVoice([4, 0, 0]), stopped = fakeVoice([4, 0, 0])
  delete off.occlusionFilter; stopped.isPlaying = false
  let rays = 0; const a = scene([close, off, stopped], () => { rays++; return false })
  a._updateOcclusion([0, 0, 0]); assert.equal(rays, 0); assert.deepEqual(close.states, [false])
})
test('A11: el cast integrado usa el mismo _castOnce del modo Jugar', async () => {
  const { readFile } = await import('node:fs/promises')
  const code = await readFile(new URL('../src/engine/runtime/events/play.js', import.meta.url), 'utf8')
  assert.match(code, /new AudioScene\(\{ scene: this\.ed, host: this\.rt, onFinished: .*?, cast:/)
  assert.match(code, /this\._castOnce\(start, dir, left\)/)
})
