// CORR-002: geometría compartida y escala PCM en fixtures históricas de Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { analyzeAudioBuffer, audioWaveformPath, audioWaveformPeak } from '../src/core/timeline/audio-waveform.js'
import { timelineRulerTicks } from '../src/core/timeline/model.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const waveform = read('scripts/fixtures/editor/timeline-audio-waveform-inspector-s11-g003.html')
const automation = read('scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002.html')
const waveformRunner = read('scripts/test-timeline-audio-waveform-inspector-s11-g003-electron.mjs')
const automationRunner = read('scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs')
const timeline = read('src/components/TimelinePanel.vue')

test('TRIM-CORR002-01 · origen de la regla coincide con el contrato temporal', () => {
  assert.match(timeline, /const TIME_ORIGIN_PX = 24/)
  assert.match(timeline, /const timeToX = \(time, scale = zoom\.value\) => TIME_ORIGIN_PX \+ time \* scale/)
  const ticks = timelineRulerTicks(15, 70)
  assert.ok(ticks.some(t => t.t === 0 && t.major))
  assert.equal(24 + 1 * 70, 94)
})

test('TRIM-CORR002-02 · automatización toma el cero de la regla, no una coordenada obsoleta', () => {
  assert.match(automation, /const zeroTick=\[\.\.\.document\.querySelectorAll\('#timeline \.ruler \.tick'\)\]/)
  assert.match(automation, /approx\(clipPx-originPx,current\(\)\.t\*70\)/)
  assert.match(automation, /approx\(originPx,24\)/)
  assert.doesNotMatch(automation, /approx\(parseFloat\(clip\(\)\.style\.left\),70\)/)
  assert.match(automation, /approx\(pcmRect\.left-clipRect\.left,borderLeft\+pcmWindowLeft,\.35\)/)
  assert.match(automation, /getComputedStyle\(clip\(\)\)\.borderLeftWidth/)
})

test('TRIM-CORR002-03 · waveform inspecciona el PCM original y sus datos de ventana visible', () => {
  assert.match(waveform, /requestTimelineAudioAnalysis\(project, quiet\.id/)
  assert.match(waveform, /audioWaveformPeak\(quietPcm, key\.duration, key\.offset, key\.pitch, key\.loop\)/)
  assert.match(waveform, /audioWaveformPath\(quietPcm, key\.duration/)
  assert.match(waveform, /dataset\.waveformWindowStart/)
  assert.match(waveform, /dataset\.waveformColumns/)
  assert.match(waveform, /svg\?\.style\.width/)
})

test('TRIM-CORR002-04 · la fixture desplaza el scroll real y no impone igualdad de SVG entre zooms', () => {
  assert.match(waveform, /scroller\.scrollLeft = 72/)
  assert.match(waveform, /scroller\.dispatchEvent\(new Event\('scroll'\)\)/)
  assert.match(waveform, /afterWave\.path === afterWave\.expected/)
  assert.match(waveform, /afterWave\.peak === beforeWave\.peak/)
  assert.doesNotMatch(waveform, /waveform\(4\)\.querySelector\('path'\)\?\.getAttribute\('d'\) === shape/)
})

test('TRIM-CORR002-05 · el cambio de escala incorrecto es una regresión detectable', async () => {
  const sampleRate = 64
  const samples = Float32Array.from({ length: 256 }, (_, i) => {
    const gain = i < 64 ? 0.1 : i < 128 ? 0.55 : i < 192 ? 0.2 : 0.8
    return Math.sin(i * 0.39) * gain
  })
  const data = await analyzeAudioBuffer({ length: samples.length, sampleRate, numberOfChannels: 1,
    getChannelData: () => samples })
  const duration = 3.5, offset = 0.25, pitch = 1
  const peak = audioWaveformPeak(data, duration, offset, pitch, false)
  const first = audioWaveformPath(data, duration, offset, pitch, false,
    { columns: 64, startTime: 0, endTime: 1.5, peak })
  const second = audioWaveformPath(data, duration, offset, pitch, false,
    { columns: 120, startTime: 0.5, endTime: 3, peak })
  const wrongScale = audioWaveformPath(data, duration, offset, pitch, false,
    { columns: 120, startTime: 0.5, endTime: 3, peak: peak / 2 })
  assert.ok(first && second)
  assert.notEqual(first, second, 'zoom y ventana visible pueden producir trazados distintos')
  assert.notEqual(second, wrongScale, 'alterar la escala del pico debe ser detectable')
  assert.equal(audioWaveformPeak(data, duration, offset, pitch, false), peak)
})

test('TRIM-CORR002-06 · las comprobaciones históricas posteriores y los runners permanecen', () => {
  assert.match(waveform, /check\('La primera voz termina por duración y la segunda sigue activa'/)
  assert.match(waveform, /check\('Stop libera la voz activa y cancela el siguiente fotograma'/)
  assert.match(automation, /check\('Pointercancel restaura todos los puntos'/)
  assert.match(automation, /check\('Pista bloqueada impide editar puntos'/)
  assert.match(automation, /check\('Suprimir elimina solamente el punto seleccionado'/)
  assert.equal((automation.match(/\bcheck\('/g) || []).length, 37)
  assert.ok((waveform.match(/\bcheck\('/g) || []).length >= 24)
  assert.match(waveformRunner, /qa-electron-webgl-runner/)
  assert.match(automationRunner, /minChecks: 37/)
})

test('TRIM-CORR002-07 · scripts reales de ambas fixtures son sintácticamente válidos', () => {
  for (const source of [waveform, automation]) {
    for (const [, attrs, code] of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      const syntax = spawnSync(process.execPath, [`--input-type=${attrs.includes('module') ? 'module' : 'commonjs'}`, '--check'],
        { input: code, encoding: 'utf8' })
      assert.equal(syntax.status, 0, syntax.stderr)
    }
  }
})
