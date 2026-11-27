import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTimeline, normalizeTimeline, normalizeTrack, newTimelinePropertyKey, timelinePropertyPlayable } from '../src/core/timeline/model.js'
import { PROPS, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { sampleTrack } from '../src/engine/runtime/anim/eval.js'

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const track = (prop, values, extra = {}) => ({
  id: 'tr-' + prop, kind: 'node', name: prop, node: 'light-1', byId: true, sceneId: 'scene-a', prop,
  keys: values.map(([t, v], i) => ({ id: 'key-' + i, t, v, ease: 'linear' })), ...extra,
})

test('G007-01 · solo dos canales tipados de luz se activan junto a los históricos', () => {
  assert.equal(PROPS['light.energy'].timelineRuntime, true)
  assert.equal(PROPS['light.color'].timelineRuntime, true)
  assert.deepEqual(Object.keys(PROPS).filter(k => timelinePropertyPlayable(k)),
    ['position', 'rotation', 'scale', 'visible', 'light.energy', 'light.color'])
})
test('G007-02 · energía lineal tiene unidades originales e interpola sin truncar', () => {
  const tr = normalizeTrack(track('light.energy', [[0, 0], [2, 4]]))
  assert.equal(sampleTrack(tr, 1), 2)
  assert.equal(sampleTrack(tr, 0.5), 1)
})
test('G007-03 · el evaluador compartido interpola color sRGB por componentes de 8 bits', () => {
  const tr = normalizeTrack(track('light.color', [[0, '#000000'], [2, '#ffffff']]))
  assert.equal(sampleTrack(tr, 1), '#808080')
  assert.equal(sampleTrack(tr, 2), '#ffffff')
})
test('G007-04 · corte de color conserva el origen hasta la próxima clave', () => {
  const tr = normalizeTrack(track('light.color', [[0, '#123456'], [2, '#abcdef']]))
  tr.keys[0].ease = 'cut'
  assert.equal(sampleTrack(tr, 1), '#123456')
  assert.equal(sampleTrack(tr, 2), '#abcdef')
})
test('G007-05 · la duración no altera el formato de clave tipada', () => {
  const tr = normalizeTrack(track('light.energy', [[0, 1.25], [2, 3.5]]))
  assert.deepEqual(tr.keys.map(k => [k.id, k.t, k.v]), [['key-0', 0, 1.25], ['key-1', 2, 3.5]])
})
test('G007-06 · el catálogo sigue rechazando colores y energías inválidos', () => {
  for (const v of [-1, Infinity, NaN, '3']) assert.throws(() => validatePropertyValue('light.energy', v))
  for (const v of ['#fff', 'red', '', '#ffffffff']) assert.throws(() => validatePropertyValue('light.color', v))
})
test('G007-07 · dos propiedades del mismo nodo mantienen identidades distintas', () => {
  const tl = normalizeTimeline(newTimeline('Escena', { tracks: [
    track('light.energy', [[0, 1], [2, 3]]), track('light.color', [[0, '#000000'], [2, '#ffffff']]),
  ] }))
  assert.deepEqual(tl.tracks.map(t => t.prop), ['light.energy', 'light.color'])
})
test('G007-08 · normalizar y serializar no asigna políticas ni cambia IDs', () => {
  const source = newTimeline('Escena', { tracks: [track('light.energy', [[0, 0], [2, 4]])] })
  const once = normalizeTimeline(source)
  const twice = normalizeTimeline(JSON.parse(JSON.stringify(once)))
  assert.deepEqual(twice, once)
  assert.equal(twice.tracks[0].keys[0].id, 'key-0')
})
test('G007-09 · un canal tipado no recibe curvas vec3 de transformación', () => {
  const tr = normalizeTrack(track('light.energy', [[0, 1], [2, 2]], { interpolation: 'cubic-angle' }))
  assert.equal(tr.interpolation, undefined)
  assert.equal(sampleTrack(tr, 1), 1.5)
})
test('G007-10 · los clips tipados no se habilitan sin contrato de crossfade', () => {
  assert.throws(() => normalizeTrack(track('light.color', [[0, '#000000'], [2, '#ffffff']],
    { clips: [{ id: 'cl', from: 'key-0', to: 'key-1', start: 0, duration: 2, in: 0, out: 1 }] })), /requieren evaluador/)
})
test('G007-11 · una clave numérica nueva no introduce metadatos de runtime persistente', () => {
  const key = newTimelinePropertyKey('light.energy', 1, 2.5)
  assert.deepEqual(Object.keys(key).sort(), ['ease', 'id', 't', 'v'])
})
test('G007-12 · el runner conserva su único host de nodo y las salidas originales', () => {
  const body = src('src/engine/runtime/timeline/player.js')
  assert.match(body, /h\.node\?\.\(tr\.node, tr\.prop, value/)
  assert.match(body, /this\.onEnd\?\.\(this, stopped\)/)
})
test('G007-13 · scripts usan el guard de propiedad y clips filtran el canal ocupado', () => {
  assert.match(src('src/engine/runtime/events/play-light.js'), /_tlAssertWritable/)
  assert.match(src('src/engine/runtime/events/play-anim.js'), /_tlChannelOwner/)
})
test('G007-14 · Preview usa snapshots visuales y no guarda propiedades en proyecto', () => {
  const body = src('src/core/timeline/preview.js')
  assert.match(body, /pose\.light\.intensity/)
  assert.match(body, /this\.savePose\(target\.o\.id, target\.n\)/)
})
test('G007-15 · PlayMode no incorpora gestor global de propiedades', () => {
  const body = src('src/engine/runtime/events/play-timeline.js')
  assert.match(body, /_tlChannels = new Map\(\)/)
  assert.match(body, /_tlChannelRelease\(run\)/)
  assert.doesNotMatch(body, /PropertyManager|globalThis\._timeline/)
})
