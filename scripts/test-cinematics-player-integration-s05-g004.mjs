// LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004 · integración del calendario real de eventos y ruta Play/Player.
// Sin dependencias de Vite/Three en Node; no sustituye Electron/Jolt ni un AppImage ejecutado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { filmMakerSource, newTimeline, newTrack, newKey, isFilmMakerTimeline, normalizeTimeline } from '../src/core/timeline/model.js'
import { montageTimeline } from '../src/filmmaker/montage.js'
import { resolveAudioGroup } from '../src/engine/runtime/audio/config.js'

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const runnerCode = read('src/engine/runtime/timeline/player.js')
  .replace("import { evalTimelineCamera, evalTimelineNode } from './eval.js'", 'const evalTimelineCamera = () => null, evalTimelineNode = () => undefined')
  .replace("import { sampleBakeTrack } from '../../../core/timeline/physics.js'", 'const sampleBakeTrack = () => null')
  .replace('export class TimelineRunner', 'class TimelineRunner')
const ctx = vm.createContext({ Promise, Set, Map, console })
vm.runInContext(runnerCode + '\nglobalThis.TimelineRunner = TimelineRunner', ctx)
const TimelineRunner = ctx.TimelineRunner
const hostCode = read('src/engine/runtime/events/play-timeline.js')
  .replace(/^import .*\n/gm, '').replace('export const timelineMethods =', 'const timelineMethods =')
const hostCtx = vm.createContext({ THREE: { Vector3: class {}, Quaternion: class {}, Euler: class {} }, TimelineRunner,
  sampleBakeTrack: () => null, resolveAudioGroup, DEG: Math.PI / 180, setCameraFov() {}, verticalFov() { return 75 }, console, Set, Map })
vm.runInContext(hostCode + '\nglobalThis.timelineMethods = timelineMethods', hostCtx)
const timelineMethods = hostCtx.timelineMethods

const makeTimeline = () => {
  const commands = newTrack('commands', { name: 'Acciones' })
  commands.keys = [newKey('commands', .4, { name: 'Corte', list: [{ code: 'profile', p: { profile: '' } }] })]
  const audio = newTrack('audio', { name: 'Banda sonora' })
  audio.keys = [newKey('audio', .15, { action: 'play', clip: 'Música', duration: .3 })]
  const method = newTrack('method', { node: 'actor-1', byId: true })
  method.keys = [newKey('method', .3, { method: 'saludar', args: ['hola'] })]
  const tl = newTimeline('Montaje · QA', { id: 'tl-film', duration: 2, tracks: [commands, audio, method],
    filmMaker: filmMakerSource({ id: 'film-1', name: 'Película', scene: { id: 'scene-film' } }, 'montage', 'film-1') })
  return normalizeTimeline(tl)
}
function playback(tl = makeTimeline(), command = null) {
  const calls = [], errors = []
  const h = { audio: k => calls.push('audio:' + k.clip), commands: list => { calls.push('command:' + list[0].code); return command?.(list) },
    method: (node, method, args) => calls.push('method:' + node + '.' + method + '(' + args.join(',') + ')'),
    error: err => errors.push(err), camera: () => {}, letterbox: () => {} }
  return { tl, runner: new TimelineRunner(tl, h), calls, errors }
}

test('G004-01 · FilmMaker se conserva como procedencia serializada, sin crear colección paralela', () => {
  const original = makeTimeline()
  const reopened = normalizeTimeline(JSON.parse(JSON.stringify(original)))
  assert.equal(isFilmMakerTimeline(reopened), true)
  assert.equal(reopened.filmMaker.sceneId, 'scene-film')
  assert.equal(reopened.id, original.id)
  assert.deepEqual(reopened.tracks.map(t => t.kind), ['commands','audio','method'])
})
test('G004-02 · audio, métodos y comandos se despachan por tiempo global, no por columna de pista', () => {
  const h = playback(); h.runner.update(.5)
  assert.deepEqual(h.calls, ['audio:Música','method:actor-1.saludar(hola)','command:profile'])
})
test('G004-03 · la agenda se construye una vez y las claves no se vuelven a ejecutar', () => {
  const h = playback(); const schedule = h.runner._events()
  h.runner.update(.5); h.runner.update(.5)
  assert.equal(h.runner._events(), schedule)
  assert.equal(h.calls.length, 3)
})
test('G004-04 · reproducir desde medio montaje no lanza comandos ni audio anteriores', () => {
  const tl = makeTimeline(), calls = []
  const h = new TimelineRunner(tl, { audio: () => calls.push('audio'), commands: () => calls.push('commands'),
    method: () => calls.push('method'), camera: () => {}, letterbox: () => {} }, { from: .8 })
  h.update(0); h.update(.5)
  assert.deepEqual(calls, [])
})
test('G004-05 · la reproducción desde t=0 conserva el disparo de claves en t=0', () => {
  const tl = makeTimeline()
  tl.tracks[0].keys.unshift(newKey('commands', 0, { list: [{ code: 'fade', p: { seconds: 0 } }] }))
  const h = playback(tl); h.runner.update(0)
  assert.deepEqual(h.calls, ['command:fade'])
})
test('G004-06 · seek durante Play no ejecuta métodos, comandos ni audios omitidos', () => {
  const h = playback(); h.runner.seek(1.2); h.runner.update(.2)
  assert.deepEqual(h.calls, [])
})
test('G004-07 · pausa y reanudación no duplican llamadas', () => {
  const h = playback(); h.runner.update(.2); h.runner.pause(); h.runner.update(1.0)
  assert.deepEqual(h.calls, ['audio:Música']);h.runner.resume();h.runner.update(.3)
  assert.equal(h.calls.length, 3)
})
test('G004-08 · el montaje espera a la orden bloqueante final antes de liberar controles', async () => {
  let done
  const pending = new Promise(resolve => { done = resolve })
  const tl = makeTimeline()
  tl.tracks = [newTrack('commands', { keys: [newKey('commands', 2, { block: true, list: [{ code: 'fade', p: { seconds: .2 } }] })] })]
  const h = playback(tl, () => ({ done: pending }))
  h.runner.update(2.1)
  assert.equal(h.runner.finished, false); assert.equal(h.runner.blockers, 1)
  done(); await pending; await new Promise(resolve => setImmediate(resolve))
  h.runner.update(.016)
  assert.equal(h.runner.finished, true)
})
test('G004-09 · rechazo asíncrono del comando bloqueante se informa sin rechazo huérfano', async () => {
  const tl = makeTimeline()
  tl.tracks = [newTrack('commands', { keys: [newKey('commands', .2, { block: true, list: [{ code: 'fade', p: {} }] })] })]
  const h = playback(tl, () => ({ done: Promise.reject(Error('fallo de transición')) }))
  h.runner.update(.2); await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.runner.blockers, 0)
  assert.equal(h.errors.length, 1); assert.match(h.errors[0].message, /transición/)
})
test('G004-10 · excepción en comando no detiene otras pistas ni queda sin informar', () => {
  const h = playback(makeTimeline(), () => { throw Error('comando inválido') })
  h.runner.update(.6)
  assert.equal(h.calls.length, 3);assert.equal(h.errors.length, 1)
})
test('G004-11 · stop y skip no ejecutan llamadas normales futuras', async () => {
  const h = playback(); h.runner.update(.1);h.runner.stop();h.runner.update(2)
  assert.deepEqual(h.calls, [])
  const other=playback();await other.runner.skip();assert.deepEqual(other.calls, [])
})
test('G004-12 · la reproducción de película de otra escena se rechaza antes de ocupar controles', () => {
  const tl = makeTimeline(), play = {
    project: { activeSceneId: 'scene-other', scenes: [{ id: 'scene-film', name: 'Estudio' }], timelines: [tl] },
    tls: [], state: {}, control: true,
  }
  Object.assign(play, timelineMethods)
  play._tlInit()
  assert.throws(() => play.timelinePlay(tl.id), /pertenece a la escena «Estudio»/)
  assert.equal(play.tls.length, 0)
  assert.equal(play.control, true)
  assert.equal(play._tlBakeReservations.size, 0)
})
test('G004-13 · película de escena correcta reproduce por ID y devuelve control al terminar', async () => {
  const tl = makeTimeline()
  const play = { project: { activeSceneId: 'scene-film', scenes: [{ id: 'scene-film', name: 'Estudio' }], timelines: [tl] },
    tls: [], state: {}, control: true, _tlHost: () => ({ camera: () => {}, letterbox: () => {}, commands: () => null, method: () => null, audio: () => {} }),
    _tlBakeBegin() {}, _tlBakeRelease() {}, _tlBakeAt() {}, }
  Object.assign(play, timelineMethods);play._tlInit()
  const done = play.timelinePlay(tl.id)
  assert.equal(play.tls.length, 1)
  assert.equal(play.control, false) // El timeline predeterminado bloquea al jugador.
  play._tlUpdate(2.1)
  assert.deepEqual(JSON.parse(JSON.stringify(await done)), { stopped: false, skipped: false })
  assert.equal(play.tls.length, 0); assert.equal(play.control, true)
})
test('G004-14 · timeline manual conserva reproducción sin etiqueta FilmMaker', () => {
  const manual = newTimeline('Gameplay', { duration: 1 })
  const play = { project: { activeSceneId: 'scene-other', timelines: [manual] }, state: {}, control: true,
    _tlHost: () => ({ camera: () => {}, letterbox: () => {} }), _tlBakeBegin() {}, _tlBakeRelease() {}, _tlBakeAt() {} }
  Object.assign(play, timelineMethods);play._tlInit()
  assert.doesNotThrow(() => play.timelinePlay(manual.id));play.timelineStop(manual.id)
})
test('G004-15 · el Player empaqueta timelines, capturas y escenas desde project sin catálogo Cinematics duplicado', () => {
  const game = read('src/core/state/game.js'), pack = read('src/engine/runtime/package/format.js'), host = read('src/engine/runtime/package/host.js')
  assert.match(game, /writePackage\(\{ data: meta, scenes: data, files \}\)/)
  assert.match(pack, /Object\.keys\(data\)/)
  assert.ok(!/\btimelines\b/.test(pack.slice(pack.indexOf('const EDITOR_ONLY ='), pack.indexOf('export async function writePackage'))))
  assert.match(host, /reactive\(\{ \.\.\.pkg\.game/)
  assert.match(host, /setCaptureClips\(project\.captures \|\| \[\]\)/)
})
test('G004-16 · Timeline usa la autoridad común antes de los consumidores de la vista', () => {
  const controls = read('src/engine/runtime/events/play-controls.js')
  const camera = read('src/engine/runtime/events/play-camera.js')
  assert.match(controls, /this\._cameraFrame\(cam\)/)
  assert.match(camera, /else if \(timeline\) \{\s*this\._tlCamera\(cam\)/)
  assert.match(read('src/engine/runtime/events/play-timeline.js'), /this\._tlFov = true/)
})
test('G004-17 · el importador crea recursos identificados sin reemplazar los originales', () => {
  const film = read('src/core/state/film.js')
  assert.match(film,/filmMakerSource\(film, 'pass', ps\.id, filmTool\(\)\.cinematicReel\(film, ps\.id\)\)/)
  assert.match(film,/filmMakerSource\(film, 'montage', film\.id, filmTool\(\)\.cinematicReel\(film\)\)/)
  assert.match(film,/commit\('Importar película'\)/)
  assert.match(film,/validateFilmMotion\(/)
})
test('G004-18 · el visor solo previsualiza: nunca despacha audio o métodos en Edit Mode', () => {
  const panel=read('src/components/CinematicsPanel.vue')
  assert.match(panel,/preview\.apply\(/)
  assert.doesNotMatch(panel,/\.timelinePlay\(|new TimelineRunner\(/)
})
test('G004-19 · una carga de audio rechazada se informa sin rechazo asíncrono suelto', async () => {
  const tl = makeTimeline(), errors = []
  const runner = new TimelineRunner(tl, { audio: () => Promise.reject(Error('audio ausente')), error: e => errors.push(e), camera: () => {}, letterbox: () => {} })
  runner.update(.2)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /audio ausente/)
})
test('G004-20 · el host real de Play devuelve la promesa de reproducción para detectar errores', async () => {
  const reports = [], plays = []
  const fake = { game: { report: e => reports.push(e) }, _tlWarned: new Set(), rt: { toast:()=>{} },
    audio: { resolveClip:()=> 'wav-1', engine: { cfg: { groups: [] }, play: (...a) => { plays.push(a); return Promise.reject(Error('WAV inválido')) } } },
    timers: [], state: {} }
  const host = timelineMethods._tlHost.call(fake)
  const promise = host.audio({ action: 'play', clip:'pista.wav',offset:.1,volume:1,group:'music',duration:1,fadeIn:0,fadeOut:0 })
  assert.equal(plays.length, 1)
  assert.equal(typeof promise?.then, 'function')
  await assert.rejects(promise, /WAV inválido/)
  assert.deepEqual(reports, []) // el TimelineRunner, no el host, informa sin duplicación.
})
