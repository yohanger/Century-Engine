import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cinematicReel } from '../src/filmmaker/montage.js'
import { filmMakerSource, isFilmMakerTimeline, normalizeTimeline, newTimeline, newTrack, newKey, readonlyTimelineLanes } from '../src/core/timeline/model.js'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
function sampleMovie() {
  const camera = { id: 'camera-01', name: 'Principal' }
  const film = { id: 'film-01', name: 'Lluvia nocturna', scene: { id: 'scene-01' }, cameras: [camera], takes: [], passes: [], edit: { shots: [], layers: [], audio: [] } }
  film.takes = [{ name: 'Actuación de Ana' }]
  film.passes = [
    { id: 'pass-a', name: 'Acercamiento', cameraId: camera.id, duration: 5, take: 0, keys: [] },
    { id: 'pass-b', name: 'Reacción', cameraId: camera.id, duration: 3, take: -1, keys: [] },
  ]
  film.edit.shots = [
    { id: 'shot-a', pass: 'pass-a', in: 1, out: 3, tin: { kind: 'cut' } },
    { id: 'shot-b', pass: 'pass-b', in: 0.5, out: 2.5, tin: { kind: 'black', dur: 0.6 } },
  ]
  film.edit.layers = [
    { id: 'text-01', kind: 'text', t0: 0.5, t1: 1.5, params: { text: 'No mires atrás' } },
    { id: 'fade-01', kind: 'fade', t0: 2.3, t1: 3.1, params: { dir: 'in' } },
  ]
  film.edit.audio = [{ id: 'music', name: 'Ambiente', group: 'music', mute: false, solo: false, clips: [
    { id: 'audio-01', asset: 'rain', name: 'Lluvia', start: 0, in: 0, dur: 4 },
  ] }]
  return film
}

function importedTimeline(film) {
  const reel = cinematicReel(film)
  const audio = newTrack('audio', { name: 'Ambiente', keys: [newKey('audio', 0, { clip: 'Lluvia', duration: 4 })] })
  const cam = newTrack('camera', { name: 'Cámara de montaje', keys: [newKey('camera', 0), newKey('camera', 4)] })
  return normalizeTimeline(newTimeline('Montaje · Lluvia nocturna', {
    duration: 4, tracks: [cam, audio], filmMaker: filmMakerSource(film, 'montage', film.id, reel),
  }))
}

test('S07-CORR-01 · planos y cortes reales conservan orden, nombres y cámara', () => {
  const film = sampleMovie()
  const reel = cinematicReel(film)
  assert.deepEqual(reel.shots.map(s => [s.id, s.start, s.end, s.name, s.camera, s.transition]), [
    ['shot-a', 0, 2, 'Acercamiento', 'Principal', 'cut'],
    ['shot-b', 2, 4, 'Reacción', 'Principal', 'black'],
  ])
  assert.equal(reel.shots[0].actor, 'Actuación de Ana')
  assert.equal(reel.shots[1].actor, '')
})
test('S07-CORR-02 · capas reales y tiempos se consultan sin ejecutar efectos', () => {
  const film = sampleMovie(), reel = cinematicReel(film)
  assert.deepEqual(reel.layers.map(l => [l.id, l.start, l.end, l.name]), [
    ['text-01', 0.5, 1.5, 'No mires atrás'],
    ['fade-01', 2.3, 3.1, 'Fundido'],
  ])
  assert.equal(film.edit.layers[0].params.text, 'No mires atrás')
})
test('S07-CORR-03 · la procedencia y la consulta sobreviven a la normalización de Timeline', () => {
  const tl = importedTimeline(sampleMovie())
  assert.equal(isFilmMakerTimeline(tl), true)
  assert.equal(tl.filmMaker.reel.shots.length, 2)
  assert.equal(tl.filmMaker.reel.layers.length, 2)
  const lanes = readonlyTimelineLanes(tl)
  assert.equal(lanes[0].name, 'Planos y cortes')
  assert.equal(lanes[0].group, 'MONTAJE')
  assert.deepEqual(lanes[0].segments.map(s => [s.start, s.end]), [[0,2],[2,4]])
  assert.equal(lanes[1].name, 'Tomas de actor')
  assert.ok(lanes.some(l => l.name === 'Subtítulos' && l.segments[0].label === 'No mires atrás'))
  assert.ok(lanes.some(l => l.name === 'Fundidos'))
  assert.ok(lanes.some(l => l.name === 'Ambiente' && l.segments[0].end === 4))
})
test('S07-CORR-04 · no se duplica el estado de ejecución ni se modifican pistas', () => {
  const film = sampleMovie(), tl = importedTimeline(film)
  const beforeFilm = JSON.stringify(film), beforeTl = JSON.stringify(tl)
  const first = readonlyTimelineLanes(tl), second = readonlyTimelineLanes(tl)
  assert.deepEqual(first, second)
  assert.equal(JSON.stringify(tl), beforeTl)
  assert.equal(JSON.stringify(film), beforeFilm)
  assert.equal(tl.tracks.length, 2)
})
test('S07-CORR-05 · la vista de un pase no mezcla capas ni planos ajenos', () => {
  const film = sampleMovie(), reel = cinematicReel(film, 'pass-b')
  assert.equal(reel.shots.length, 1)
  assert.equal(reel.shots[0].name, 'Reacción')
  assert.equal(reel.shots[0].start, 0)
  assert.equal(reel.shots[0].end, 3)
  assert.deepEqual(reel.layers, [])
})
test('S07-CORR-06 · metadatos inválidos no permiten inventar segmentos', () => {
  const film = sampleMovie(), base = cinematicReel(film)
  const marker = filmMakerSource(film, 'montage', film.id, { shots: [
    { id: 'invalid', start: 4, end: 3, name: 'Imposible' }, ...base.shots,
  ], layers: base.layers })
  const tl = normalizeTimeline(newTimeline('QA', { duration: 4, filmMaker: marker, tracks: [] }))
  assert.equal(tl.filmMaker.reel.shots.length, 2)
  assert.equal(readonlyTimelineLanes(tl)[0].segments.length, 2)
})
test('S07-CORR-07 · un Timeline de gameplay no se convierte en Cinematics', () => {
  const film = sampleMovie(), track = newTrack('camera', { name: 'Gameplay' })
  assert.deepEqual(readonlyTimelineLanes(newTimeline('Gameplay', { tracks: [track] })), [])
  assert.equal(isFilmMakerTimeline(newTimeline('Gameplay', { tracks: [track] })), false)
  assert.equal(film.edit.shots.length, 2)
})
test('S07-CORR-08 · panel reutiliza el reproductor y bloquea autoría', () => {
  const ui = read('src/components/CinematicsPanel.vue')
  assert.match(ui, /readonlyTimelineLanes\(selected\.value\)/)
  assert.match(ui, /Reproducir en Juego/)
  assert.match(ui, /Timeline cinematográfica de solo lectura/)
  assert.match(ui, /lane\.group/)
  assert.match(ui, /@keydown="onTimelineKeydown"/)
  assert.doesNotMatch(ui, /new TimelineRunner|newTrack\(|addKey\(|\bcommit\(/)
})
test('S07-CORR-09 · el editor conserva el rechazo de .nfm sin montaje reproducible', () => {
  const film = read('src/core/state/film.js')
  assert.match(film, /if \(!applyScene && !res\.timelines\.length\) throw new Error\('La película no contiene tomas ni montaje reproducible para Cinematics'\)/)
  assert.match(film, /filmTool\(\)\.cinematicReel\(film\)/)
})


test('S07-CORR-10 · Cinematics tiene un solo bloque de plantilla raíz', () => {
  const ui = read('src/components/CinematicsPanel.vue')
  assert.equal((ui.match(/^<template>\s*$/gm) || []).length, 1)
  assert.equal((ui.match(/^<\/template>\s*$/gm) || []).length, 1)
  assert.match(ui, /<template>\s*<section class="cinematics"/)
  assert.match(ui, /<\/section>\s*<\/template>\s*<style scoped>/)
})

test('S07-CORR-11 · Vue compila la plantilla del panel Cinematics', (t) => {
  let compiler
  try { compiler = createRequire(import.meta.url)('@vue/compiler-sfc') }
  catch { t.skip('Compilador Vue no instalado en este entorno: ejecutar npm run filmmaker -- --build en el proyecto local'); return }
  const source = read('src/components/CinematicsPanel.vue')
  const { descriptor, errors } = compiler.parse(source, { filename: 'CinematicsPanel.vue' })
  assert.deepEqual(errors, [])
  assert.ok(descriptor.template)
  const compiled = compiler.compileTemplate({ source: descriptor.template.content, filename: 'CinematicsPanel.vue', id: 'cinematics-s07' })
  assert.deepEqual(compiled.errors, [])
})
