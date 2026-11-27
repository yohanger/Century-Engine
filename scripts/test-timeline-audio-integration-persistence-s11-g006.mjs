// QA S11 G006: validación pre-export, compatibilidad de recursos y paquete real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateBuildSources } from '../src/core/buildList.js'
import { normalizeTimelines, newTimeline, newTrack, newKey } from '../src/core/timeline/model.js'
import { normalizeAudio, newFx, resolveAudioClip } from '../src/engine/runtime/audio/config.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wav = new Uint8Array([82, 73, 70, 70, 12, 0, 0, 0, 87, 65, 86, 69])
const asset = { id: 'audio-01', name: 'Lluvia.wav', ext: 'wav', kind: 'audio' }
const secondary = { id: 'audio-02', name: 'Pasos.ogg', ext: 'ogg', kind: 'audio' }
const scene = { id: 'scene-01', name: 'Inicio', data: { objects: [], environment: {}, terrain: {} } }
function fixture({ clip = 'audio-01', group = 'mix-personal', fx = [newFx('eq3', { id: 'clip-eq', low: 4 })], action = 'play', muted = false } = {}) {
  const key = newKey('audio', 0, { id: 'key-01', clip, group, action, fx })
  const timeline = newTimeline('Sonidos', { id: 'tl-01', duration: 5, tracks: [newTrack('audio', { id: 'track-01', name: 'Ambiente', muted, keys: [key] })] })
  return { meta: { models: [], assets: [asset, secondary], timelines: [timeline], audio: normalizeAudio({ groups: [{ id: 'mix-personal', name: 'Bus Propio', parent: 'music' }] }) }, files: new Map([[asset.id, wav], [secondary.id, wav]]), key }
}
const validate = ({ meta, files }) => validateBuildSources(meta, [scene], files)
const asJSON = o => JSON.parse(JSON.stringify(o))

// 01-10: la prevalidación usa el mismo resolvedor que Editor/Player.
test('G006-01 · ID existente con binario permite exportar', () => { const f = fixture(); assert.doesNotThrow(() => validate(f)) })
test('G006-02 · nombre antiguo con extensión resuelve el ID sin cambiar la clave', () => {
  const f = fixture({ clip: 'lluvia.WAV' }); validate(f)
  assert.equal(resolveAudioClip(f.meta, f.key.clip), asset.id); assert.equal(f.key.clip, 'lluvia.WAV')
})
test('G006-03 · nombre antiguo sin extensión es compatible', () => {
  const f = fixture({ clip: 'LLUViA' }); assert.doesNotThrow(() => validate(f)); assert.equal(f.key.clip, 'LLUViA')
})
test('G006-04 · el binario ausente bloquea el empaquetado con contexto e ID', () => {
  const f = fixture(); f.files.delete(asset.id)
  assert.throws(() => validate(f), /Timeline «Sonidos» \/ pista «Ambiente» \/ clave «key-01»: falta el archivo de audio.*audio-01/)
})
test('G006-05 · Asset de audio inexistente se diagnostica sin borrar referencias', () => {
  const f = fixture({ clip: 'missing-audio' }); assert.throws(() => validate(f), /no existe el Audio Asset «missing-audio»/)
  assert.equal(f.key.clip, 'missing-audio')
})
test('G006-06 · Play sin asignación no exporta silencio accidental', () => {
  assert.throws(() => validate(fixture({ clip: '' })), /falta asignar el clip de audio/)
})
test('G006-07 · Stop sin clip no necesita binario', () => {
  const f = fixture({ action: 'stop', clip: '' }); f.files.clear(); assert.doesNotThrow(() => validate(f))
})
test('G006-08 · una pista Audio silenciada no impide exportar', () => {
  const f = fixture({ clip: 'no-existe', muted: true }); assert.doesNotThrow(() => validate(f))
})
test('G006-09 · el validador no altera clave, efectos ni configuración Mixer', () => {
  const f = fixture({ clip: 'Lluvia', group: 'Bus Propio' }), original = asJSON(f.meta)
  validate(f); assert.deepEqual(f.meta, original)
})
test('G006-10 · los errores en otro Timeline incluyen el nombre correcto', () => {
  const f = fixture(); f.meta.timelines.push(newTimeline('Otra', { tracks: [newTrack('audio', { keys: [newKey('audio', 1, { clip: 'Perdido.wav' })] })] }))
  assert.throws(() => validate(f), /Timeline «Otra».*Perdido.wav/)
})

test('G006-11 · un proyecto antiguo sin Timeline conserva la exportación existente', () => {
  const f = fixture(); delete f.meta.timelines; f.files.clear(); assert.doesNotThrow(() => validate(f))
})
test('G006-12 · el audio de FilmMaker no se mezcla con las claves de gameplay', () => {
  const f = fixture({ clip: 'inexistente' }); f.meta.timelines[0].filmMaker = { provider: 'nether-film-maker', kind: 'pass', filmId: 'film-1', sceneId: 'scene-1', sourceId: 'original' }
  assert.doesNotThrow(() => validate(f))
})
test('G006-13 · los tipos de pista distintos de Audio no se validan como clips', () => {
  const f = fixture(); f.meta.timelines[0].tracks[0].kind = 'commands'; f.key.clip = 'desconocido'
  assert.doesNotThrow(() => validate(f))
})
test('G006-14 · no se acepta un recurso no audio aunque exista el binario', () => {
  const f = fixture({ clip: 'image-01' }); f.meta.assets.push({ id: 'image-01', name: 'Imagen.png', ext: 'png' }); f.files.set('image-01', wav)
  assert.throws(() => validate(f), /no existe el Audio Asset/)
})

test('G006-15 · normalización y JSON conservan ID, grupo, FX y duración', () => {
  const f = fixture(), before = normalizeTimelines(f.meta.timelines), reopened = normalizeTimelines(asJSON(before))
  assert.deepEqual(reopened, before)
  const k = reopened[0].tracks[0].keys[0]
  assert.equal(k.clip, asset.id); assert.equal(k.group, 'mix-personal'); assert.equal(k.fx[0].id, 'clip-eq')
})
test('G006-16 · clave legacy sin FX sigue sin recibir la propiedad al reabrir', () => {
  const f = fixture(); delete f.key.fx
  const [loaded] = normalizeTimelines(asJSON(f.meta.timelines))
  assert.equal(Object.hasOwn(loaded.tracks[0].keys[0], 'fx'), false)
})
test('G006-17 · exportación utiliza el preflight existente y no otro empaquetador', () => {
  const game = read('src/core/state/game.js')
  assert.match(game, /validateBuildSources\(meta, data, files\)/)
  assert.match(game, /writePackage\(\{ data: meta, scenes: data, files \}\)/)
})
test('G006-18 · Player continúa usando archivo del paquete y no datos IndexedDB', () => {
  const host = read('src/engine/runtime/package/host.js')
  assert.match(host, /async assetData\(id\) \{ const b = await pkg\.file\(id\)/)
  const player = read('src/engine/runtime/package/game.js')
  assert.match(player, /createPackageHost\(\{ pkg, storage, log \}\)/)
})
test('G006-19 · el validador de escenas previo conserva el contrato existente', () => {
  assert.throws(() => validateBuildSources({ models: [], assets: [] }, [], new Map()), /No hay ninguna escena/)
  assert.throws(() => validateBuildSources({ models: [], assets: [] }, [{ ...scene, data: null }], new Map()), /Falta el contenido/)
})

test('G006-20 · el paquete real conserva metadata, FX y binario de Audio', async t => {
  let writePackage, readPackage
  try { ({ writePackage, readPackage } = await import('../src/engine/runtime/package/format.js')); await import('jszip') }
  catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return t.skip('jszip no instalado en este entorno'); throw e }
  const f = fixture({ clip: 'Lluvia.wav' }); validate(f)
  const bytes = await writePackage({ data: f.meta, scenes: [scene], files: f.files })
  const pkg = await readPackage(bytes)
  assert.equal(pkg.game.timelines[0].tracks[0].keys[0].clip, 'Lluvia.wav')
  assert.equal(pkg.game.timelines[0].tracks[0].keys[0].fx[0].id, 'clip-eq')
  assert.equal(resolveAudioClip(pkg.game, 'Lluvia.wav'), 'audio-01')
  assert.deepEqual(await pkg.file('audio-01'), wav)
  assert.equal((await pkg.scene('scene-01')).objects.length, 0)
})
test('G006-21 · el host exportado resuelve el mismo binario sin Editor', async t => {
  let writePackage, readPackage, createPackageHost
  try { ({ writePackage, readPackage } = await import('../src/engine/runtime/package/format.js')); ({ createPackageHost } = await import('../src/engine/runtime/package/host.js')) }
  catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') return t.skip('Dependencias de Player no instaladas'); throw e }
  const f = fixture(); validate(f)
  const pkg = await readPackage(await writePackage({ data: f.meta, scenes: [scene], files: f.files }))
  const host = createPackageHost({ pkg, storage: { get: () => null, set(){} }, log(){} })
  const binary = await host.assetData('audio-01')
  assert.equal(binary.name, 'Lluvia.wav'); assert.deepEqual(binary.bytes, wav)
  assert.equal(host.project.timelines[0].tracks[0].keys[0].fx[0].id, 'clip-eq')
  host.dispose()
})
