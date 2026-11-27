import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { analyzeAudioBuffer, audioWaveformPath, audioWaveformPeak, MAX_WAVEFORM_COLUMNS } from '../src/core/timeline/audio-waveform.js'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const pcm = async (samples, sampleRate = samples.length) => analyzeAudioBuffer({
  sampleRate, length: samples.length, numberOfChannels: 1,
  getChannelData: () => Float32Array.from(samples),
})

const amplitude = path => [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)])

test('G003-01 · mantiene los 128 puntos del contrato anterior al omitir opciones', async () => {
  const sample = await pcm([0, -0.5, 0.5, 1])
  assert.equal(audioWaveformPath(sample, 1, 0, 1, false), audioWaveformPath(sample, 1, 0, 1, false))
  assert.match(audioWaveformPath(sample, 1, 0, 1, true), /L128 /)
})

test('G003-02 · la densidad aumenta con los píxeles visibles, sin interpolación PCM inventada', async () => {
  const values = Array.from({ length: 4096 }, (_, i) => Math.sin(i / 11))
  const data = await pcm(values)
  const paths = [128, 420, 840].map(columns => audioWaveformPath(data, 1, 0, 1, false, {columns}))
  assert.ok(paths[0].length < paths[1].length && paths[1].length < paths[2].length)
  assert.ok(Math.max(...amplitude(paths[2]).map(p => p[0])) >= 839.9)
  assert.ok(paths.every(path => path.startsWith('M') && path.endsWith('Z')))
})

test('G003-03 · límite 2.048 y resolución del PCM sin generar geometría infinita', async () => {
  const large = await pcm(Array.from({ length: 10000 }, (_, i) => Math.sin(i)))
  assert.equal(MAX_WAVEFORM_COLUMNS, 2048)
  const a = audioWaveformPath(large, 1, 0, 1, false, {columns: 90000})
  assert.ok(amplitude(a).length <= 2048 * 4)
  assert.doesNotMatch(a, /L2049 /)
  const small = await pcm([.1, .2, -.1, -.2])
  const b = audioWaveformPath(small, 1, 0, 1, false, {columns: 1000})
  assert.ok(amplitude(b).length <= 16)
})

test('G003-04 · ventana visible conserva coordenadas locales y cambia los picos consultados', async () => {
  const source = await pcm([0, 0, 0, 0, -.8, .9, 0, 0], 8)
  const peak = audioWaveformPeak(source, 1, 0, 1, false)
  assert.equal(peak, .8999999761581421)
  const left = audioWaveformPath(source, 1, 0, 1, false, {columns: 4, startTime: 0, endTime: .5, peak})
  const right = audioWaveformPath(source, 1, 0, 1, false, {columns: 4, startTime: .5, endTime: 1, peak})
  const ysLeft = amplitude(left).map(p => p[1])
  const ysRight = amplitude(right).map(p => p[1])
  assert.deepEqual([...new Set(ysLeft)], [16])
  assert.ok(Math.min(...ysRight) <= 1.1 && Math.max(...ysRight) >= 29.3)
  assert.ok(Math.max(...amplitude(right).map(p=>p[0])) <= 4)
})

test('G003-05 · pico del tramo completo mantiene escala al desplazar y ampliar', async () => {
  const source = await pcm([0, .02, -.02, 0, -.7, .8, 0, 0])
  const peak = audioWaveformPeak(source, 1, 0, 1, false)
  for (const columns of [8, 128, 512]) {
    const path = audioWaveformPath(source, 1, 0, 1, false, {columns, startTime:.5, endTime:1, peak})
    const ys = amplitude(path).map(p => p[1])
    assert.ok(Math.min(...ys) <= 1.01 && Math.max(...ys) >= 29.1)
  }
})

test('G003-06 · offset y pitch desplazan ventana sin alterar mediciones PCM', async () => {
  const source = await pcm([0, 0, -.7, .6, 0, 0, 0, 0])
  const before = {peakDb:source.peakDb, rmsDb:source.rmsDb}
  const shifted = audioWaveformPath(source, .5, .25, 1, false, {columns:32, startTime:0, endTime:.5})
  const pitched = audioWaveformPath(source, .25, .25, 2, false, {columns:32, startTime:0, endTime:.25})
  assert.equal(shifted, pitched)
  assert.deepEqual({peakDb:source.peakDb,rmsDb:source.rmsDb},before)
})

test('G003-07 · loops envolventes y fin agotado no dejan muestras ficticias', async () => {
  const source = await pcm([0, 0, 1, 0])
  const loop = audioWaveformPath(source, 1, .5, 1, true, {columns: 128})
  const exhausted = audioWaveformPath(source, 1, .5, 1, false, {columns: 128})
  assert.ok(loop.length > exhausted.length)
  assert.equal(audioWaveformPath(source, 1, 2, 1, false, {columns:200}), '')
  assert.equal(audioWaveformPath(source, 1, 0, 1, false, {columns:100, startTime:0, endTime:0}), '')
})

test('G003-08 · no modifica la cola PCM ni crea decodificador alternativo', () => {
  const source = read('src/components/TimelineAudioSource.vue')
  assert.match(source, /requestTimelineAudioAnalysis/)
  assert.doesNotMatch(source, /decodeAudioData\(|new AudioContext\(/)
  assert.match(source, /audioWaveformPeak/)
  assert.match(source, /viewportLeftPx/)
  assert.match(source, /data-waveform-columns/)
})

test('G003-09 · rueda Ctrl y gestos usan el scroller único, sin bloquear rueda simple', () => {
  const panel = read('src/components/TimelinePanel.vue')
  assert.match(panel, /@scroll\.passive="syncTimelineScroll" @wheel="zoomWheel"/)
  assert.match(panel, /if \(!event\.ctrlKey && !event\.metaKey\) return/)
  assert.match(panel, /if \(event\.cancelable\) event\.preventDefault\(\)/)
  assert.match(panel, /sc\.scrollLeft = pendingZoomScroll/)
  assert.match(panel, /pendingZoomScroll \?\? sc\.scrollLeft/)
  assert.match(panel, /@wheel\.prevent="forwardPinnedWheel"/)
})

test('G003-10 · puntos y largo de Audio se vinculan al zoom y viewport sin mutar claves', () => {
  const panel = read('src/components/TimelinePanel.vue')
  assert.match(panel, /:clip-start-px="timeToX\(k\.t\)"/)
  assert.match(panel, /:clip-width-px="audioDisplayDuration\(k\) \* zoom"/)
  assert.match(panel, /:viewport-left-px="durationScrollX"/)
  assert.match(panel, /:viewport-width-px="Math\.max\(0, viewportWidth - headerWidth\)"/)
  assert.doesNotMatch(panel, /\.duration\s*=\s*zoom/)
})

test('G003-11 · la fixture inspecciona geometría y zoom real, no solo presencia del slider', () => {
  const fixture = read('scripts/fixtures/editor/timeline-zoom-waveform-s12-g003.html')
  assert.match(fixture, /new WheelEvent\('wheel'/)
  assert.match(fixture, /getBoundingClientRect\(\)/)
  assert.match(fixture, /dataset.waveformWindowStart/)
  assert.match(fixture, /Comprobaciones completas/)
})
