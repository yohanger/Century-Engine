// S04: contrato del recurso nativo y regresiones de integración sin Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { nativeCinematic, newNativeCinematic, updatedNativeCinematic, cinematicSceneStamp, encodeNativeFilm, decodeNativeFilm } from '../src/core/cinematic-resource.js'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = path => readFileSync(join(root, path), 'utf8')
const scene = { id: 'scene_1', name: 'Escena 1' }
const project = () => ({ id: 'project_1', scenes: [scene], cinematics: [], timelines: [], assets: [] })
const film = (id = 'film_1') => ({ id, name: 'Mi película', scene: { id: scene.id, projectId: 'project_1' }, cameras: [{ id: 'cam_1' }], activeCameraId: 'cam_1', passes: [], takes: [], edit: { shots: [], nodeTracks: [], physicsBakes: [], audio: [], layers: [] } })

test('S04-01 · Cinematic nativo conserva ID, cámara, datos originales y edición sin pistas ficticias', () => {
  const p = project(), original = film(), resource = newNativeCinematic(p, original)
  assert.equal(resource.id, original.id)
  assert.equal(resource.folder, 'Assets/Cinematics')
  assert.equal(resource.sceneId, scene.id)
  assert.equal('film' in resource, false)
  assert.equal(decodeNativeFilm(encodeNativeFilm(original), resource.id, p.id).cameras[0].id, 'cam_1')
  assert.deepEqual(original.edit.shots, [])
  assert.deepEqual(p.timelines, [])
  resource.name = 'Cambió'
  assert.equal(original.name, 'Mi película')
})
test('S04-02 · ID único frente a otros Cinematics, Assets y Timelines', () => {
  for (const kind of ['cinematics', 'assets', 'timelines']) {
    const p = project(); p[kind].push({ id: 'film_1' })
    assert.throws(() => newNativeCinematic(p, film()), /Ya existe un recurso/)
  }
})
test('S04-03 · escena/proyecto ajenos no permiten crear un Cinematic', () => {
  assert.throws(() => newNativeCinematic(project(), { ...film(), scene: { id: scene.id, projectId: 'otro' } }), /no pertenece/)
  assert.throws(() => newNativeCinematic(project(), { ...film(), scene: { id: 'scene_2', projectId: 'project_1' } }), /no pertenece/)
})
test('S04-04 · persistir edición mantiene identidad y aumenta token sin mutar original', () => {
  const p = project(), c = newNativeCinematic(p, film()); p.cinematics.push(c)
  const edit = { ...film(), name: 'Montaje terminado', edit: { shots: [{ id: 'shot_1' }] } }
  const updated = updatedNativeCinematic(p, c.id, edit, c.revision)
  assert.equal(updated.id, c.id)
  assert.equal(updated.name, 'Montaje terminado')
  assert.notEqual(updated.revision, c.revision)
  assert.equal(c.name, 'Mi película')
  assert.equal('film' in updated, false)
  assert.equal(decodeNativeFilm(encodeNativeFilm(edit), c.id, p.id).edit.shots.length, 1)
  assert.equal(nativeCinematic(p, c.id), c)
})
test('S04-05 · conflicto de edición concurrente impide sobrescritura silenciosa', () => {
  const p = project(), c = newNativeCinematic(p, film()); p.cinematics.push(c)
  const first = updatedNativeCinematic(p, c.id, film(), c.revision)
  p.cinematics = [first]
  assert.throws(() => updatedNativeCinematic(p, c.id, film(), c.revision), /Conflicto/)
  assert.equal(p.cinematics[0], first)
})
test('S04-06 · deshacer/reaplicar no reutiliza token y evita problema ABA', () => {
  const p = project(), c = newNativeCinematic(p, film()); p.cinematics.push(c)
  const one = updatedNativeCinematic(p, c.id, film(), c.revision)
  p.cinematics = [c] // undo
  const two = updatedNativeCinematic(p, c.id, film(), c.revision)
  assert.notEqual(one.revision, two.revision)
})
test('S04-07 · no permite modificar identidad ni escena en otro proyecto', () => {
  const p = project(), c = newNativeCinematic(p, film()); p.cinematics.push(c)
  assert.throws(() => updatedNativeCinematic(p, c.id, film('otro'), c.revision), /Identidad/)
  assert.throws(() => updatedNativeCinematic(p, c.id, { ...film(), scene: { id: 'x', projectId: p.id } }, c.revision), /Identidad/)
})
test('S04-08 · sello de escena cambia ante cambios de objetos, entorno, render o audio', () => {
  const args = [[{ id: 'x', pos: 0 }], { sky: 0 }, { quality: 'high' }, { volume: 1 }]
  const initial = cinematicSceneStamp(...args)
  assert.equal(initial, cinematicSceneStamp(...structuredClone(args)))
  for (let i = 0; i < args.length; i++) {
    const changed = structuredClone(args)
    changed[i] = i === 0 ? [{ id: 'x', pos: 5 }] : { changed: true }
    assert.notEqual(initial, cinematicSceneStamp(...changed))
  }
})
test('S04-09 · la película y la revisión no se serializan como versión histórica .nfm', () => {
  const src = source('src/core/cinematic-resource.js')
  assert.doesNotMatch(src, /NFM_VERSION|schemaVersion|version:\s*\d/)
  assert.match(src, /no es versi[oó]n de \.nfm/i)
})
test('S04-10 · editor serializa escrituras y revalida cada operación', () => {
  const src = source('src/core/state/film.js')
  assert.match(src, /nativeCinematicSaveQueue\.then\(\(\) => handleNativeCinematicRequestImpl\(action, args\)\)/)
  assert.match(src, /updatedNativeCinematic\(p, rec\.id, film, args\.revision\)/)
  assert.match(src, /args\.sceneStamp !== stamp/)
})
test('S04-11 · guardado y Assets pasan por transacción de IndexedDB y no descargan .nfm', () => {
  const src = source('src/core/state/film.js')
  const nativeSave = src.slice(src.indexOf('async function handleNativeCinematicRequestImpl('), src.indexOf('let nativeCinematicSaveQueue'))
  assert.match(nativeSave, /db\.saveLevelPackageImport\(meta, \[\], \[/)
  assert.doesNotMatch(nativeSave, /downloadBlob|packNfm\(/)
  const db = source('src/core/db.js')
  assert.match(db, /tx\(d, \['projects', 'scenes', 'assets'\], 'readwrite'/)
})
test('S04-12 · el runtime se deriva del Cinematic y descarta la proyección vieja', () => {
  const src = source('src/core/state/film.js')
  assert.match(src, /project\.timelines = project\.timelines\.filter\(t => t\.filmMaker\?\.nativeResourceId !== resource\.id\)/)
  assert.match(src, /nativeResourceId: resource\.id/)
  assert.match(src, /if \(!playable\) return null/)
})
test('S04-13 · Assets expone recurso nativo con identidad y oculta duplicado derivado', () => {
  const src = source('src/core/project.js')
  assert.match(src, /for \(const ref of project\.cinematics \|\| \[\]\)/)
  assert.match(src, /if \(ref\.filmMaker\?\.nativeResourceId && \(project\.cinematics/)
})
test('S04-14 · el formato único conserva el campo autoría sin NFM_VERSION', () => {
  const src = source('src/filmmaker/film.js')
  assert.match(src, /export (?:async )?function (?:packNfm|unpackNfm)/)
  assert.doesNotMatch(src, /NFM_VERSION|schemaVersion/)
})
test('S04-15 · Electron rechaza ventanas ajenas y múltiples editores del mismo proyecto', () => {
  const src = source('electron/main.cjs')
  assert.match(src, /!filmWin\?\.__lfFilmMaker \|\| !filmWin\.__lfCinematicContext/)
  assert.match(src, /editors\.length !== 1/)
  assert.match(src, /request\.editor !== e\.sender/)
})
test('S04-16 · FilmMaker abre por ID, no sobreescribe escena y guarda sin exportación obligatoria', () => {
  const editor = source('src/filmmaker/FilmApp.vue')
  const session = source('src/filmmaker/session.js')
  assert.match(editor, /window\.lf\.cinematic\('open'/)
  assert.match(editor, /window\.lf\.cinematic\('save'/)
  assert.match(session, /openNativeFilm\(/)
  assert.match(session, /if \(session\.native\) throw new Error\('Un Cinematic nativo conserva la escena/)
})
test('S04-17 · renombrar, mover y borrar carpetas no dejan Cinematics sin registro', () => {
  const src = source('src/core/state/filesystem.js')
  assert.match(src, /nextNativeRevision\(\)/)
  assert.match(src, /Mueve primero los Cinematics de esta carpeta/)
  assert.match(src, /p\.cinematics = p\.cinematics\.filter\(c => c\.id !== id\)/)
})
test('S04-18 · recursos nativos aparecen en inspector y edición por doble clic', () => {
  assert.match(source('src/components/CinematicResourceInspector.vue'), /movie \|\| resource/)
  assert.match(source('src/components/ProjectPanel.vue'), /openNativeCinematic\(it\.id\)\) : openCinematics\(it\.id\)/)
})
test('S04-19 · FilmMaker y Player se mantienen en responsabilidades separadas', () => {
  const editor = source('src/core/state/film.js')
  assert.match(editor, /syncCinematicRuntime\(/)
  assert.match(editor, /runFilmCinematic\(/)
  assert.match(source('src/components/CinematicsPanel.vue'), /isFilmMakerTimeline/)
})

test('S04-20 · transacciones de Cinematic y autoguardado comparten la cola de persistencia', () => {
  const project = source('src/core/state/project.js'), film = source('src/core/state/film.js')
  assert.match(project, /export function queueProjectPersistence\(action\)/)
  assert.match(project, /return queueProjectPersistence\(\(\) => saveNowImpl\(opts\)\)/)
  assert.match(film, /return queueProjectPersistence\(async \(\) => \{/)
})
test('S04-21 · no ejecuta validación del montaje sobre una escena obsoleta', () => {
  const film = source('src/core/state/film.js')
  assert.match(film, /validateFilmMotion\(film, latestScene\.objects, film\.overrides\)/)
  assert.match(film, /syncCinematicRuntime\(trial, updated, film, latestScene\.objects\)/)
})

test('S04-22 · el cuerpo Cinematic viaja como archivo de Assets dentro de .lfproj', () => {
  const p = source('src/core/project.js'), lfproj = source('src/core/lfproj.js'), film = source('src/core/state/film.js')
  assert.match(p, /file: `\$\{ref\.name\}\.cinematic`/)
  assert.match(lfproj, /for \(const e of allEntries\(meta\)\)/)
  assert.match(lfproj, /e\.kind === 'cinematic'/)
  assert.match(film, /encodeNativeFilm\(film\)/)
  assert.match(film, /db\.getAsset\(p\.id, rec\.id\)/)
})
test('S04-23 · carga de película valida integridad de ID y proyecto', () => {
  const good = encodeNativeFilm(film())
  assert.equal(decodeNativeFilm(good, 'film_1', 'project_1').id, 'film_1')
  assert.throws(() => decodeNativeFilm(good, 'otro', 'project_1'), /Identidad/)
  assert.throws(() => decodeNativeFilm(good, 'film_1', 'otro'), /Identidad/)
  assert.throws(() => decodeNativeFilm(null, 'film_1', 'project_1'), /Falta el contenido/)
  assert.throws(() => decodeNativeFilm(new Uint8Array([255, 0, 23]), 'film_1', 'project_1'), /no contiene una película válida/)
})

test('S04-24 · eliminar Cinematic conserva el binario para Undo y evita recursos huérfanos en .lfproj', () => {
  const src = source('src/core/state/filesystem.js')
  const nativeDelete = src.slice(src.indexOf("if (kind === 'cinematic' && nativeCinematic"), src.indexOf("if (kind === 'timeline' || kind === 'cinematic') return deleteTimeline"))
  assert.doesNotMatch(nativeDelete, /db\.deleteAsset\(/)
  assert.match(nativeDelete, /p\.cinematics = p\.cinematics\.filter/)
  assert.match(source('src/core/project.js'), /for \(const ref of project\.cinematics \|\| \[\]\)/)
})

test('S04-25 · guardado nativo sincroniza historial sin generar Undo falso del cuerpo de la película', () => {
  const filmSource = source('src/core/state/film.js'), history = source('src/core/state/history.js')
  assert.match(filmSource, /synchronizeCinematicHistory\(updated\.id, updated,/)
  assert.match(history, /export function synchronizeCinematicHistory\(id, resource, timeline\)/)
  assert.match(history, /nextNativeRevision\(\)/)
  const savePart = filmSource.slice(filmSource.indexOf('async function handleNativeCinematicRequestImpl'), filmSource.indexOf('let nativeCinematicSaveQueue'))
  assert.doesNotMatch(savePart, /commit\('Guardar Cinematic'\)/)
})

test('S04-26 · duplicar proyecto restaura propiedad de Cinematics sin modificar el original', () => {
  const src = source('src/core/state/project.js')
  assert.match(src, /const copiedId = uid\('p'\), sourceId = meta\.id/)
  assert.match(src, /decodeNativeFilm\(files\.get\(resource\.id\), resource\.id, sourceId\)/)
  assert.match(src, /source\.scene\.projectId = copiedId/)
  assert.match(src, /files\.set\(resource\.id, encodeNativeFilm\(source\)\)/)
})

test('S04-27 · paquetes de recursos parciales no adjuntan runtimes Cine sin fuente', () => {
  const src = source('src/core/levelpackage.js')
  assert.match(src, /meta\.timelines\.filter\(t => !t\.filmMaker\?\.nativeResourceId\)/)
})

test('S04-28 · la carpeta Cinematics permite crear un recurso nativo desde +', () => {
  const src = source('src/components/ProjectPanel.vue')
  assert.match(src, /isCinematicsFolder\(parent\) \? \[\{ label: 'Cinematic'/)
  assert.match(src, /data-tooltip="Crear recurso" aria-label="Crear" :disabled="isSystemUiPath\(folder\)"/)
  assert.doesNotMatch(src, /:disabled="isCinematicsFolder\(folder\)" @click="createMenu"/)
})
