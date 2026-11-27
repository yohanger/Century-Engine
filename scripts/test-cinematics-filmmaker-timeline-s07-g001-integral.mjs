import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readonlyTimelineLanes, filmMakerSource, newTimeline, newTrack, newKey, normalizeTimeline } from '../src/core/timeline/model.js'
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const marker = filmMakerSource({ id: 'movie', name: 'Rodaje', scene: { id: 'scene' } }, 'montage', 'movie')
const camera = newTrack('camera', { name: 'Cámara de montaje', keys: [
  newKey('camera', 0, { ease: 'linear' }), newKey('camera', 2, { ease: 'cut' }),
  newKey('camera', 2.01, { ease: 'linear' }), newKey('camera', 5),
] })
const audio = newTrack('audio', { name: 'Voces', keys: [newKey('audio', 1, { clip: 'voz.wav', duration: 3 })] })
const event = newTrack('commands', { name: 'Efectos', keys: [newKey('commands', 3, { name: 'Fundido', list: [{ code: 'fade', p: { seconds: .8 } }] })] })
const node = newTrack('node', { name: 'Actor', keys: [newKey('node', 1), newKey('node', 4)] })
const tl = normalizeTimeline(newTimeline('Montaje', { duration: 7, filmMaker: marker, tracks: [camera, audio, event, node] }))
test('S07-01 · pista de cámara y cortes derivados de claves reales', () => {
  const lanes = readonlyTimelineLanes(tl)
  assert.equal(lanes[0].segments.length, 2)
  assert.equal(lanes[0].segments[0].start, 0)
  assert.equal(lanes[0].segments[1].start, 2.01)
  assert.equal(lanes[0].segments[1].end, 7)
  assert.equal(lanes[0].keys.length, 4)
})
test('S07-02 · audio, efectos y nodos usan duración y datos originales', () => {
  const lanes = readonlyTimelineLanes(tl)
  assert.deepEqual([lanes[1].segments[0].start, lanes[1].segments[0].end], [1,4])
  assert.deepEqual([lanes[2].segments[0].start, lanes[2].segments[0].end], [3,3.8])
  assert.deepEqual([lanes[3].segments[0].start, lanes[3].segments[0].end], [1,4])
})
test('S07-03 · geometría de consulta no muta la película ni sus pistas', () => {
  const before = JSON.stringify(tl)
  readonlyTimelineLanes(tl)
  assert.equal(JSON.stringify(tl), before)
})
test('S07-04 · no se convierte un timeline manual en película FilmMaker', () => {
  assert.deepEqual(readonlyTimelineLanes(newTimeline('Gameplay', { tracks: [camera] })), [])
})
test('S07-05 · límite temporal y pistas vacías no producen intervalos inválidos', () => {
  const short = newTimeline('QA', { filmMaker: marker, duration: 1, tracks: [audio, newTrack('bake', { start: .5, duration: 4, node: 'actor' })] })
  const lanes = readonlyTimelineLanes(short)
  assert.ok(lanes[0].segments.every(s => s.start >= 0 && s.end <= 1))
  assert.ok(lanes[1].segments.every(s => s.start >= 0 && s.end <= 1))
})
test('S07-06 · Cinematics y Assets usan la misma importación sin copiar el .nfm como genérico', () => {
  const assets = read('src/core/state/filesystem.js'), film = read('src/core/state/film.js')
  assert.match(assets, /extOf\(f\.name\) === 'nfm'/)
  assert.match(assets, /await importFilm\(new Uint8Array\(await f\.arrayBuffer\(\)\), \{ applyScene: false \}\)/)
  assert.match(film, /export async function importFilmDialog\(options = \{ applyScene: false \}\)/)
  assert.match(film, /if \(applyScene\) for \(const id of applied\) updateObject/)
  assert.match(film, /if \(!applyScene && !res\.timelines\.length\) throw/)
})
test('S07-07 · la interfaz representa pistas reales sin controles de autoría ni runner paralelo', () => {
  const panel = read('src/components/CinematicsPanel.vue')
  assert.match(panel, /readonlyTimelineLanes\(selected\.value\)/)
  assert.match(panel, /Timeline cinematográfica de solo lectura/)
  assert.match(panel, /@click="seekTimeline"/)
  assert.doesNotMatch(panel, /new TimelineRunner|newTrack\(|addKey\(|commit\(/)
})

// Caracterización del importador original, sin instalar un motor paralelo ni modificar archivos del usuario.
import vm from 'node:vm'
function importedFixture({ empty = false } = {}) {
  const source = read('src/core/state/film.js')
  const start = source.indexOf('export async function importFilm(')
  const end = source.indexOf('\nexport async function importFilmDialog(', start)
  assert.ok(start >= 0 && end > start)
  const fn = source.slice(start, end).replace('export async function', 'async function')
  const film = { id: 'film-id', name: 'Película de prueba', scene: { id: 'scene-id', name: 'Escena', projectId: 'project-id' },
    actor: { objectId: '' }, overrides: { cube: { position: [9,9,9] } },
    takes: [], passes: empty ? [] : [{ id: 'pass-id', name: 'Toma A', take: -1, keys: [] }], assets: [],
    edit: { shots: [], nodeTracks: [], physicsBakes: [], audio: [], filters: [] } }
  const project = { id: 'project-id', name: 'QA', activeSceneId: 'scene-id', scenes: [{ id: 'scene-id' }], objects: [{ id: 'cube', position: [0,0,0] }], captures: [], models: [], timelines: [], profiles: [], assets: [], folders: [], environment: { rain: 0 }, render: { style: 'base' }, audio: { volume: 1 } }
  film.scene.env = { rain: 10 }; film.scene.render = { style: 'altered' }; film.scene.audio = { volume: 0 }
  let commits = 0
  const ctx = {
    filmTool: () => ({ unpackNfm: async () => ({ film, assets: new Map() }), applyOverrides: () => { throw Error('No debe aplicar los overrides') },
      sequence: () => ({ items: empty ? [] : [{ start: 0, end: 1 }] }), cinematicReel: (_film, passId) => ({ shots: [{ id: passId || 'montage', start: 0, end: 1, name: 'Toma A' }], layers: [] }),
      cinematicFromPass: (ps, opts) => ({ id: 'tl-pass', name: opts.name, tracks: [], duration: 1 }),
      montageTimeline: (_f, opts) => ({ id: 'tl-montage', name: opts.name, tracks: [], duration: 1 }) }),
    store: { project, timelineId: null, editor: { syncAll() {}, syncEnvironment() {} } },
    db: { async deleteAsset() {} }, confirmOtherProject: () => true, askConfirm: async () => true,
    validateFilmMotion() {}, switchScene: async () => true, updateObject() { throw Error('No debe modificar objetos') },
    filmMakerSource: f => ({ filmId: f.id, sceneId: f.scene.id, kind: 'pass', sourceId: 'pass-id' }),
    normalizeTimeline: x => x, addFolderChain() {}, commit: () => commits++, toast() {},
    normalizeRender: x => x, normFolder: x => x, uniqueFileName: () => '', fileKind: () => '', extOf: () => '', importCapture() {},
    PROFILE_FOLDER: 'Assets/Post', CINEMATICS_FOLDER: 'Assets/Cinematics', normalizeProfile: () => ({}), uid: () => 'new', console, Uint8Array, Map, Set, JSON,
  }
  // Los marcadores del modelo real tienen clase y fuente; simulamos la propiedad que importaFilm consulta.
  ctx.filmMakerSource = (_f, kind, sourceId, reel) => ({ filmId: 'film-id', sceneId: 'scene-id', kind, sourceId, reel })
  vm.runInNewContext(`${fn}\nthis.callImport=importFilm`, ctx)
  return { run: options => ctx.callImport(new Uint8Array(), options), project, commits: () => commits }
}
test('S07-08 · consulta cinematográfica no aplica overrides, entorno, render ni audio a la escena', async () => {
  const h = importedFixture()
  const before = JSON.stringify({ objects: h.project.objects, environment: h.project.environment, render: h.project.render, audio: h.project.audio })
  const result = await h.run({ applyScene: false })
  assert.equal(h.project.timelines.length, 2)
  assert.equal(result.timelines.length, 2)
  assert.equal(h.commits(), 1)
  assert.equal(JSON.stringify({ objects: h.project.objects, environment: h.project.environment, render: h.project.render, audio: h.project.audio }), before)
})
test('S07-09 · reimportar el mismo filmId no duplica el catálogo', async () => {
  const h = importedFixture()
  await h.run({ applyScene: false })
  const second = await h.run({ applyScene: false })
  assert.equal(second.reused, true)
  assert.equal(h.project.timelines.length, 2)
  assert.equal(h.commits(), 1)
})
test('S07-CORR-10 · reimportar una película existente recupera los datos visuales sin duplicar pistas', async () => {
  const h = importedFixture()
  await h.run({ applyScene: false })
  assert.equal(h.project.timelines.length, 2)
  delete h.project.timelines[0].filmMaker.reel
  delete h.project.timelines[1].filmMaker.reel
  const result = await h.run({ applyScene: false })
  assert.equal(result.reused, true)
  assert.equal(result.metadataUpdated, 2)
  assert.equal(h.project.timelines.length, 2)
  assert.equal(h.project.timelines[0].filmMaker.reel.shots.length, 1)
  assert.equal(h.commits(), 2)
  await h.run({ applyScene: false })
  assert.equal(h.commits(), 2)
})
test('S07-10 · archivo sin datos temporales no registra película vacía', async () => {
  const h = importedFixture({ empty: true })
  await assert.rejects(h.run({ applyScene: false }), /no contiene tomas ni montaje reproducible/)
  assert.equal(h.project.timelines.length, 0)
  assert.equal(h.commits(), 0)
})

function runtimeFixture(sceneId = 'scene-id') {
  const source = read('src/core/state/film.js')
  const at = source.indexOf('export async function runFilmCinematic(')
  assert.ok(at >= 0)
  const fn = source.slice(at).replace('export async function', 'async function')
  const events = []
  const player = { on: false, async start() { events.push('start'); this.on = true }, timelinePlay(id, opts) { events.push(['timelinePlay', id, opts.from]); return Promise.resolve({ stopped: false }) } }
  const ctx = { store: { project: { activeSceneId: sceneId }, editor: { player } }, Error, Math, Number }
  vm.runInNewContext(`${fn}\nthis.call=runFilmCinematic`, ctx)
  const timeline = { id: 'tl-movie', duration: 8, filmMaker: { sceneId: 'scene-id' } }
  return { run: opts => ctx.call(timeline, opts), events, player, timeline }
}
test('S07-11 · ejecutar película completa usa el PlayMode original antes del TimelineRunner', async () => {
  const h = runtimeFixture()
  let started = false
  const result = await h.run({ from: 2, onStart: () => { started = true } })
  assert.deepEqual(h.events, ['start', ['timelinePlay', 'tl-movie', 2]])
  assert.equal(started, true)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { stopped: false })
})
test('S07-12 · Play activo reutiliza el runtime, sin arrancar otro', async () => {
  const h = runtimeFixture()
  h.player.on = true
  await h.run({ from: 50 })
  assert.deepEqual(h.events, [['timelinePlay', 'tl-movie', 8]])
})
test('S07-13 · no inicia Play ni ejecuta películas sobre otra escena', async () => {
  const h = runtimeFixture('otra-escena')
  await assert.rejects(h.run({ from: 0 }), /Activa primero la escena/)
  assert.deepEqual(h.events, [])
})
test('S07-14 · control del panel: Play integra audio y comandos solo después de cambiar a modo Juego', () => {
  const panel = read('src/components/CinematicsPanel.vue')
  assert.match(panel, /runFilmCinematic\(current, \{ from: time\.value/)
  assert.match(panel, /Reproducir en Juego/)
  assert.match(panel, /timelineControl\(current\.id, info\?\.paused/)
  assert.match(panel, /timelineControl\(selected\.value\.id, 'seek'/)
  assert.doesNotMatch(panel, /new TimelineRunner/)
})
