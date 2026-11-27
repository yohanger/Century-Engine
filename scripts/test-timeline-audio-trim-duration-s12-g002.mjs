import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { audioSourcePlaybackSpan, initialTimelineAudioDuration } from '../src/core/timeline/audio-waveform.js'
import { newKey, newTrack, newTimeline, normalizeTimeline, resizeTimelineAudioKey } from '../src/core/timeline/model.js'

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const nearly = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`)

const setup = ({ t = 1, duration = 0, locked = false } = {}) => {
  const key = newKey('audio', t, { id: 'sound', clip: 'noche.wav', duration })
  const track = newTrack('audio', { id: 'audio', keys: [key], locked })
  const timeline = newTimeline('QA Audio', { duration: 15, tracks: [track] })
  return { key, track, timeline }
}

test('G002-01 · source PCM duration respetada a pitch normal', () => {
  nearly(audioSourcePlaybackSpan(75.703, { offset: 0, pitch: 1 }), 75.703)
})
test('G002-02 · offset y pitch definen tiempo efectivo del audio', () => {
  nearly(audioSourcePlaybackSpan(12, { offset: 2, pitch: 2 }), 5)
  nearly(audioSourcePlaybackSpan(12, { offset: 2, pitch: .5 }), 20)
})
test('G002-03 · usa límites de pitch del motor, sin reproducir dos interpretaciones', () => {
  nearly(audioSourcePlaybackSpan(12, { pitch: 0 }), 120)
  nearly(audioSourcePlaybackSpan(12, { pitch: 20 }), 3)
})
test('G002-04 · fuente inválida o tramo agotado no crea duración artificial', () => {
  for (const n of [undefined, NaN, -1, 0]) assert.equal(audioSourcePlaybackSpan(n), 0)
  assert.equal(audioSourcePlaybackSpan(5, { offset: 9 }), 0)
})
test('G002-05 · clip nuevo usa longitud exacta cuando cabe en Timeline', () => {
  assert.deepEqual(initialTimelineAudioDuration(8, { t: 2, offset: 1, pitch: 1 }, 15), { seconds: 7, exceedsTimeline: false })
})
test('G002-06 · audio mayor que Timeline se limita, sin extender duración global', () => {
  assert.deepEqual(initialTimelineAudioDuration(80, { t: 5, offset: 0, pitch: 1 }, 15), { seconds: 10, exceedsTimeline: true })
})
test('G002-07 · clave al final no recibe duración persistente fuera del recurso', () => {
  assert.deepEqual(initialTimelineAudioDuration(4, { t: 15, offset: 0, pitch: 1 }, 15), { seconds: 0, exceedsTimeline: true })
})
test('G002-08 · valor inicial se redondea a precisión de Timeline', () => {
  assert.equal(initialTimelineAudioDuration(0.123456789, { t: 0 }, 9).seconds, .12346)
})
test('G002-09 · claves anteriores duration=0 conservan su significado y forma serializada', () => {
  const {timeline}=setup()
  const raw=JSON.stringify(timeline)
  const restored=normalizeTimeline(JSON.parse(raw))
  assert.equal(restored.tracks[0].keys[0].duration, 0)
  assert.equal(JSON.parse(raw).tracks[0].keys[0].duration, 0)
})
test('G002-10 · arrastre derecho modifica solo duration, sin mover izquierda ni Timeline', () => {
  const {key,timeline}=setup()
  assert.equal(resizeTimelineAudioKey(timeline,'audio','sound',6.25), true)
  assert.deepEqual([key.t,key.duration,timeline.duration,key.clip],[1,6.25,15,'noche.wav'])
})
test('G002-11 · los límites de Timeline, clave y pista bloqueada se respetan', () => {
  const {key,track,timeline}=setup({t: 8})
  assert.equal(resizeTimelineAudioKey(timeline,'audio','sound',8), false)
  assert.equal(resizeTimelineAudioKey(timeline,'audio','sound',7), true)
  track.locked=true
  assert.equal(resizeTimelineAudioKey(timeline,'audio','sound',2), false)
  assert.equal(key.duration, 7)
})
test('G002-12 · no se admiten métodos y comandos como recortes individuales', () => {
  const {timeline}=setup()
  for (const kind of ['commands','method']) {
    const track=newTrack(kind,{id:kind,keys:[newKey(kind,1,{id:`${kind}-key`})]})
    timeline.tracks.push(track)
    assert.equal(resizeTimelineAudioKey(timeline,kind,`${kind}-key`,2),false)
  }
})
test('G002-13 · duration cero sigue reservada a fuente completa, incluido Home', () => {
  const {key,timeline}=setup({duration:3})
  assert.equal(resizeTimelineAudioKey(timeline,'audio','sound',0),true)
  assert.equal(key.duration,0)
})
test('G002-14 · recorte no cambia FX, ruteo, offset, pitch ni recurso fuente', () => {
  const {key,timeline}=setup()
  Object.assign(key,{group:'music',fx:[{id:'fx',type:'echo'}],offset:.4,pitch:1.5,fadeIn:.2,fadeOut:.3})
  const original={...key}
  resizeTimelineAudioKey(timeline,'audio','sound',2)
  for(const prop of ['clip','group','fx','offset','pitch','fadeIn','fadeOut','t']) assert.deepEqual(key[prop],original[prop])
})
test('G002-15 · la onda sigue usando PCM sin alterar el análisis aprobado', () => {
  const panel=read('src/components/TimelinePanel.vue')
  const source=read('src/components/TimelineAudioSource.vue')
  assert.match(panel, /audioDisplayDuration\(k\)/)
  assert.match(source, /audioWaveformPath\(result\.value\?\.data/)
  assert.doesNotMatch(source, /\.ensure\(|\.play\(|startRendering\(/)
})
test('G002-16 · Inspector inicializa solo tras selección explícita y respeta ediciones tardías', () => {
  const s=read('src/components/TemporalResourceInspector.vue')
  assert.match(s,/if \(key === 'duration'\) \{ cancelDurationLookup\(\)/)
  assert.match(s,/key\.clip !== clip \|\| key\.duration !== 0/)
  assert.match(s,/key === 'clip'\)\s*initializeAudioDuration/)
  assert.match(s,/requestTimelineAudioAnalysis/)
})
test('G002-17 · el análisis PCM se comparte, no crea otro decodificador por Inspector', () => {
  const provider=read('src/core/timeline/audio-source-analysis.js')
  const source=read('src/components/TimelineAudioSource.vue')
  const inspector=read('src/components/TemporalResourceInspector.vue')
  assert.match(provider,/createAudioAnalysisQueue/)
  assert.match(source,/requestTimelineAudioAnalysis/)
  assert.match(inspector,/requestTimelineAudioAnalysis/)
  assert.doesNotMatch(inspector,/new OfflineAudioContext/)
})
test('G002-18 · asa dentro del borde derecho, arrastre existente y teclado accesible', () => {
  const panel=read('src/components/TimelinePanel.vue')
  assert.match(panel,/audio-duration-tail[\s\S]*?@pointerdown\.stop\.prevent="audioResizeDown/)
  assert.match(panel,/\.audio-duration-tail\s*\{[\s\S]*?transform:translateX\(-100%\)/)
  assert.match(panel,/playback\.eventsEdited\(\)/)
  assert.match(panel,/e\.key === 'Home' \? 0/)
})
