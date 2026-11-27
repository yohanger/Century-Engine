import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { analyzeAudioBuffer, audioWaveformPath, createAudioAnalysisQueue } from '../src/core/timeline/audio-waveform.js'
import { AudioEngine, decodeAudioBytes } from '../src/engine/runtime/audio/engine.js'

function pcm(sampleRate, ...channels) {
  const samples = channels.map(channel => Float32Array.from(channel))
  return { sampleRate, length: samples[0].length, numberOfChannels: samples.length, getChannelData: index => samples[index] }
}

const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-9, `${value} ≠ ${expected}`)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

test('PCM mono: duración, bins firmados, pico de muestra y RMS exactos', async () => {
  const result = await analyzeAudioBuffer(pcm(4, [0, -0.5, 0.25, 1]))
  assert.deepEqual([result.duration, result.channels, result.sampleRate], [1, 1, 4])
  assert.deepEqual([...result.low], [0, -0.5, 0.25, 1])
  assert.deepEqual([...result.high], [0, -0.5, 0.25, 1])
  assert.equal(result.peakDb, 0)
  near(result.rmsDb, 10 * Math.log10(1.3125 / 4))
})

test('Estéreo en contrafase, silencio y valores sobre escala completa', async () => {
  const stereo = await analyzeAudioBuffer(pcm(2, [0.5, -0.5], [-0.5, 0.5]))
  assert.deepEqual([...stereo.low], [-0.5, -0.5])
  assert.deepEqual([...stereo.high], [0.5, 0.5])
  near(stereo.peakDb, 20 * Math.log10(0.5))
  near(stereo.rmsDb, stereo.peakDb)
  const silent = await analyzeAudioBuffer(pcm(2, [0, 0]))
  assert.deepEqual([silent.peakDb, silent.rmsDb], [-Infinity, -Infinity])
  const hot = await analyzeAudioBuffer(pcm(2, [1.25, -1.5]))
  near(hot.peakDb, 20 * Math.log10(1.5))
  await assert.rejects(() => analyzeAudioBuffer(pcm(2, [])), /sin muestras/)
})

test('Los bins se acotan sin perder un pico tardío y el análisis permite cancelar entre bloques', async () => {
  const signal = new Float32Array(300000)
  signal[signal.length - 1] = -1
  let yields = 0
  const result = await analyzeAudioBuffer(pcm(48000, signal), undefined, async () => { yields++ })
  assert.equal(result.low.length, 8192)
  assert.equal(result.low.at(-1), -1)
  assert.equal(result.peakDb, 0)
  assert.ok(yields > 0)
  const controller = new AbortController()
  await assert.rejects(analyzeAudioBuffer(pcm(48000, signal), controller.signal, async () => controller.abort()), { name: 'AbortError' })
})

test('La onda usa offset, pitch, tramo visible y repetición, y deja vacío después del final', async () => {
  const result = await analyzeAudioBuffer(pcm(4, [0, 0, 1, -1]))
  assert.equal(audioWaveformPath(result, 1, 2, 1, false), '')
  const firstHalf = audioWaveformPath(result, .5, 0, 1, false)
  const secondHalf = audioWaveformPath(result, .5, .5, 1, false)
  assert.doesNotMatch(firstHalf, / 1\.00| 31\.00/)
  assert.match(secondHalf, / 1\.00/)
  assert.match(secondHalf, / 31\.00/)
  assert.equal(audioWaveformPath(result, .25, .5, 2, false), secondHalf)
  assert.match(audioWaveformPath(result, 1, .5, 1, false), /L64 31\.00/)
  assert.doesNotMatch(audioWaveformPath(result, 1, .5, 1, false), /L128 /)
  assert.match(audioWaveformPath(result, 1, .5, 1, true), /L128 16\.00/)
  assert.equal(audioWaveformPath(result, 1, 4, 1, true), audioWaveformPath(result, 1, 0, 1, true))
})

test('La escala visual usa los picos del tramo débil y deja intactas las mediciones', async () => {
  const quiet = [0, -.001, .001, -.008, .008, -.003, .003, 0]
  const source = await analyzeAudioBuffer(pcm(8, [...quiet, ...Array(8).fill(1)]))
  const quietOnly = await analyzeAudioBuffer(pcm(8, quiet))
  const measured = { peakDb: source.peakDb, rmsDb: source.rmsDb, low: [...source.low], high: [...source.high] }
  const path = audioWaveformPath(source, 1, 0, 1, false)
  assert.equal(path, audioWaveformPath(quietOnly, 1, 0, 1, false))
  const levels = new Set([...path.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(match => Number(match[1])))
  assert.ok(levels.has(1) && levels.has(31))
  assert.ok(levels.has(16) && levels.size > 5)
  assert.deepEqual({ peakDb: source.peakDb, rmsDb: source.rmsDb, low: [...source.low], high: [...source.high] }, measured)
  assert.ok(quietOnly.peakDb < -40)
})

test('El silencio sigue plano y el límite visual no amplifica el residuo hasta ocupar el carril', async () => {
  const silence = await analyzeAudioBuffer(pcm(4, [0, 0, 0, 0]))
  const residue = await analyzeAudioBuffer(pcm(4, [0, 1e-7, -1e-7, 0]))
  const heights = data => [...audioWaveformPath(data, 1, 0, 1, false).matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(match => Number(match[1]))
  assert.deepEqual([...new Set(heights(silence))], [16])
  const levels = heights(residue)
  assert.ok(Math.max(...levels) - Math.min(...levels) < .1)
})

test('Cola: un solo trabajo, deduplicación, prioridad del Inspector y LRU acotado', async () => {
  const loads = []
  let simultaneous = 0, maxConcurrent = 0
  const queue = createAudioAnalysisQueue(async ({ source }) => {
    simultaneous++; maxConcurrent = Math.max(maxConcurrent, simultaneous)
    loads.push(source)
    await delay(2)
    simultaneous--
    return pcm(4, [0.5])
  }, { limit: 2 })
  const request = (source, priority) => new Promise(resolve => queue.request({ source }, resolve, priority))
  const a = request('a'), twin = request('a'), inspector = request('b', true)
  assert.equal((await inspector).status, 'ready')
  assert.equal(await a, await twin)
  assert.deepEqual(loads, ['b', 'a'])
  await request('a')
  await request('c')
  await request('b')
  assert.deepEqual(loads, ['b', 'a', 'c', 'b'])
  assert.equal(maxConcurrent, 1)
})

test('Una decodificación invalidada no publica ni repuebla caché de la revisión anterior', async () => {
  let finish, begin
  const started = new Promise(resolve => { begin = resolve })
  let oldResults = 0, reads = 0
  const queue = createAudioAnalysisQueue(({ source }) => {
    reads++
    if (source === 'old' && reads === 1) return new Promise(resolve => { finish = resolve; begin() })
    if (source === 'missing') return null
    if (source === 'broken') throw new Error('formato')
    return pcm(4, [0.25])
  })
  queue.request({ source: 'old' }, () => oldResults++)
  await started
  queue.clear()
  const current = new Promise(resolve => queue.request({ source: 'new' }, resolve))
  finish(pcm(4, [1]))
  near((await current).data.peakDb, 20 * Math.log10(.25))
  assert.equal(oldResults, 0)
  const request = source => new Promise(resolve => queue.request({ source }, resolve))
  near((await request('old')).data.peakDb, 20 * Math.log10(.25))
  assert.equal((await request('missing')).status, 'missing')
  assert.equal((await request('broken')).status, 'invalid')
})

test('El motor comparte PCM de la revisión exacta y descarta cargas tardías tras cambiar origen', async () => {
  const engine = new AudioEngine()
  const decoded = []
  engine.ctx = { async decodeAudioData(bytes) { const buffer = pcm(48000, [...new Uint8Array(bytes)]); decoded.push(buffer); return buffer } }
  let revision = 'proyecto:A:1', pending
  const identify = () => revision
  const loader = () => new Promise(resolve => { pending = resolve })
  engine.setLoader(loader, identify)
  const old = engine.buffer('audio')
  const finishOld = pending
  revision = 'proyecto:B:1'
  const current = engine.buffer('audio'), same = engine.buffer('audio')
  pending({ bytes: new Uint8Array([3, 4, 5]).subarray(1, 2) })
  finishOld({ bytes: new Uint8Array([9]) })
  assert.equal(await old, null)
  const result = await current
  assert.equal(await same, result)
  assert.equal(result.getChannelData(0)[0], 4)
  assert.equal(decoded.length, 1)
  assert.equal(engine.cachedBuffer('audio', revision), result)
  assert.equal(engine.cachedBuffer('audio', 'proyecto:A:1'), undefined)
  engine.setLoader(loader, identify)
  assert.equal(await engine.buffer('audio'), result)
  engine.forget('audio')
  assert.equal(engine.cachedBuffer('audio', revision), undefined)
  const bytes = new Uint8Array([1, 2, 3])
  await decodeAudioBytes({ decodeAudioData(data) { new Uint8Array(data)[0] = 0 } }, bytes.buffer)
  assert.equal(bytes[0], 1)
})

test('Los componentes Vue compilan y la onda se integra en el botón original y el Inspector', () => {
  for (const name of ['TimelineAudioSource', 'TimelinePanel', 'TemporalResourceInspector']) {
    const file = readFileSync(new URL(`../src/components/${name}.vue`, import.meta.url), 'utf8')
    const parsed = parse(file, { filename: name + '.vue' })
    assert.deepEqual(parsed.errors, [])
    compileScript(parsed.descriptor, { id: name })
    assert.deepEqual(compileTemplate({ source: parsed.descriptor.template.content, filename: name + '.vue', id: name }).errors, [])
    if (name === 'TimelineAudioSource') {
      assert.doesNotMatch(file, /\.ensure\(|\.play\(|startRendering\(/)
      assert.match(file, /pointer-events:none/)
    }
  }
})
