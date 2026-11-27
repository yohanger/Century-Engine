import { writeAssetDrag, readAssetDrag } from '../src/core/editor/asset-drop.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createProjectData, allEntries, splitProject } from '../src/core/project.js'
import { newTimeline, newTrack, newKey, normalizeTimeline, timelineReferences, filmMakerSource } from '../src/core/timeline/model.js'
import { buildLfproj, parseLfproj } from '../src/core/lfproj.js'
import { buildLevelPackage, resolveLevelPackageSelection } from '../src/core/levelpackage.js'
import { readLevelPackage, planLevelPackageImport } from '../src/core/levelpackage-import.js'
import { TimelineRunner } from '../src/engine/runtime/timeline/player.js'
import { readFileSync } from 'node:fs'

test('S06: arrastre nativo de Assets conserva ID y excluye películas', () => {
  const values = new Map(), transfer = { setData: (k,v) => values.set(k,v), getData: k => values.get(k) || '' }
  assert.equal(writeAssetDrag(transfer, [{ kind: 'timeline', id: 'tl_drag' }]), true)
  assert.deepEqual(readAssetDrag(transfer), [{ kind: 'timeline', id: 'tl_drag' }])
  assert.equal(writeAssetDrag(transfer, [{ kind: 'cinematic', id: 'film' }]), false)
})
const native = () => newTimeline('Puerta', { folder: 'Assets/Secuencias' })
test('S06: carpeta lógica sobre colección original; sin archivo duplicado', () => {
  const p = createProjectData('QA'); const t = native(); p.timelines.push(t)
  const entry = allEntries(p, { includeTemporal: true }).find(e => e.id === t.id)
  assert.equal(entry.ref, t); assert.equal(entry.folder, t.folder); assert.ok(entry.embedded)
  assert.ok(!allEntries(p).some(e => e.id === t.id))
  assert.equal(normalizeTimeline(t).folder, t.folder)
})
test('S06: carpeta malformada no atraviesa normalización', () => {
  for (const folder of ['Assets/../Fuera', '/tmp/Fuera', 'Assets/./tmp', 'Assets/a\\b']) assert.equal(normalizeTimeline({ ...native(), folder }).folder, undefined)
})
test('S06: guardar/reabrir conserva ID, carpeta y pistas en project.json', async () => {
  const p = createProjectData('QA'); p.timelines = [native()]
  const { meta, scene } = splitProject(p, p.terrain)
  const output = await buildLfproj({ meta, scenes: new Map([[meta.activeSceneId, scene]]), files: new Map() })
  assert.deepEqual(output.missing, [])
  const reopened = await parseLfproj(await output.blob.arrayBuffer())
  assert.equal(reopened.meta.timelines[0].folder, 'Assets/Secuencias')
  assert.equal(reopened.meta.timelines[0].id, p.timelines[0].id)
  assert.ok(reopened.meta.folders.includes('Assets/Secuencias'))
})
test('S06: referencias por nombre se distinguen de ID', () => {
  const t = native(), data = [{ timeline: t.id }, { timeline: t.name }]
  assert.equal(timelineReferences(data, t).length, 2)
  assert.equal(timelineReferences(data, t, 'QA', { nameOnly: true }).length, 1)
})
function packageData() {
  const p = createProjectData('Paquete'), t = native(), track = newTrack('audio')
  track.keys.push(newKey('audio', 0, { clip: 'paso.ogg' }))
  t.tracks.push(track); p.timelines.push(t)
  p.assets.push({ id: 'a_sound', name: 'paso.ogg', folder: 'Assets', kind: 'audio' })
  return { p, t }
}
async function exportTimeline(p, t) {
  return buildLevelPackage({ meta: p, scenes: new Map(), files: new Map([['a_sound', Uint8Array.of(1, 2, 3)]]), selection: [{ kind: 'timeline', id: t.id }] })
}
test('S06: exportación cierra dependencias de audio por nombre', () => {
  const { p, t } = packageData()
  const plan = resolveLevelPackageSelection({ meta: p, scenes: new Map(), selection: [{ kind: 'timeline', id: t.id }] })
  assert.equal(plan.entries.length, 2); assert.ok(plan.dependencyIds.get(t.id).includes('a_sound'))
  p.assets = []
  assert.throws(() => resolveLevelPackageSelection({ meta: p, scenes: new Map(), selection: [{ kind: 'timeline', id: t.id }] }), /Audio ausente/)
})
test('S06: paquete real ida/vuelta, IDs internos nuevos y audio remapeado', async () => {
  const { p, t } = packageData(), out = await exportTimeline(p, t)
  const read = await readLevelPackage(new File([out.blob], 'QA.levelpackage'))
  let n = 0
  const plan = planLevelPackageImport({ ...read, project: createProjectData('Destino'), selectedIds: [t.id], makeId: prefix => `${prefix}_new${++n}` })
  const ref = plan.records.find(r => r.collection === 'timelines').ref
  assert.notEqual(ref.id, t.id); assert.equal(ref.folder, t.folder)
  assert.notEqual(ref.tracks[0].id, t.tracks[0].id)
  assert.notEqual(ref.tracks[0].keys[0].id, t.tracks[0].keys[0].id)
  assert.equal(ref.tracks[0].keys[0].clip, plan.idMap.a_sound)
  assert.ok(plan.warnings.some(w => w.includes('nodos')))
  const events = []; const runner = new TimelineRunner(ref, { audio: k => events.push(k.clip) }); runner.update(1)
  assert.equal(events[0], plan.idMap.a_sound)
})
test('S06: dependencias entre timelines por nombre y colisión de nombre global', async () => {
  const p = createProjectData('Origen'), a = newTimeline('Inicio', { folder: 'Assets/A' }), b = newTimeline('Final', { folder: 'Assets/B' })
  const tr = newTrack('commands'); tr.keys.push(newKey('commands', 0, { list: [{ code: 'timeline', p: { timeline: b.name } }] }))
  a.tracks.push(tr); p.timelines.push(a, b)
  const out = await buildLevelPackage({ meta: p, scenes: new Map(), files: new Map(), selection: [{ kind: 'timeline', id: a.id }] })
  assert.equal(out.manifest.entries.length, 2)
  const read = await readLevelPackage(new File([out.blob], 'QA.levelpackage')), dest = createProjectData('Destino')
  dest.timelines.push(newTimeline('Final', { folder: 'Assets/Otro' }))
  let n = 0
  const plan = planLevelPackageImport({ ...read, project: dest, selectedIds: [a.id], makeId: prefix => `${prefix}_new${++n}` })
  const imported = plan.records.filter(r => r.collection === 'timelines').map(r => r.ref)
  assert.equal(imported.find(t => t.id === plan.idMap[b.id]).name, 'Final 2')
  assert.equal(imported.find(t => t.id === plan.idMap[a.id]).tracks[0].keys[0].list[0].p.timeline, plan.idMap[b.id])
})
test('S06: rechaza cuerpo de timeline con identidad manipulada', async () => {
  const { p, t } = packageData(), out = await exportTimeline(p, t)
  const read = await readLevelPackage(new File([out.blob], 'QA.levelpackage'))
  read.contents.get(t.id).id = 'tl_otro'
  let n = 0
  assert.throws(() => planLevelPackageImport({ ...read, project: createProjectData('Destino'), selectedIds: [t.id], makeId: prefix => `${prefix}_new${++n}` }), /incoherente/)
})
test('S06: FilmMaker no se ofrece como recurso de autoría/exportación nativa', () => {
  const p = createProjectData('QA'), t = native()
  t.filmMaker = filmMakerSource({ id: 'film', scene: { id: 's_film' } }, 'pass', 'take')
  p.timelines.push(t)
  assert.throws(() => resolveLevelPackageSelection({ meta: p, scenes: new Map(), selection: [{ kind: 'timeline', id: t.id }] }), /no encontrado/)
})

test('S06: creación y acciones reales del estado con historial y diálogos', async suite => {
  const vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  globalThis.window = {}
  suite.after(async () => { delete globalThis.window; await vite.close() })
  const api = await vite.ssrLoadModule('/src/core/store.js')
  const { dialogs } = await vite.ssrLoadModule('/src/core/dialogs.js')
  const history = await vite.ssrLoadModule('/src/core/state/history.js')
  history.configureHistory({ save: () => {}, hasDisk: () => false, markPending: () => {}, syncPieces: () => {} })
  const setup = () => {
    api.store.project = createProjectData('Estado QA'); api.store.locked = false
    api.store.editor = { snapshotTerrain: () => api.store.project.terrain, serializeTerrain: () => api.store.project.terrain, syncAll: () => {}, syncEnvironment: () => {}, setSelection: () => {}, restoreTerrain: () => {}, applyView: () => {} }
    history.resetHistory()
    return api.store.project
  }
  const answer = async (task, value) => {
    for (let i = 0; i < 100 && !dialogs.list.length; i++) await new Promise(resolve => setTimeout(resolve, 5))
    assert.ok(dialogs.list.length, 'Diálogo real abierto'); dialogs.list.at(-1).done(value); return task
  }
  suite.after(() => history.cancelPendingAutosave())
  await suite.test('Cancelar no crea recursos; aceptar selecciona y abre en Assets', async () => {
    const p = setup(); assert.equal(await answer(api.createTimelineDialog(), null), null); assert.equal(p.timelines.length, 0)
    const t = await answer(api.createTimelineDialog(), 'Entrada'); assert.equal(t.folder, 'Assets'); assert.equal(t.tracks.length, 0)
    assert.equal(api.store.timelineId, t.id); assert.equal(api.store.projSel.id, t.id)
    const copy = api.createTimeline('Entrada', false); assert.equal(copy.name, 'Entrada 2')
    history.undo(); assert.equal(p.timelines.length, 1); history.redo(); assert.equal(p.timelines.length, 2)
  })
  await suite.test('Duplicar reutiliza el recurso y conserva carpeta con IDs nuevos', async () => {
    const p = setup(), t = api.createTimeline('Entrada', false, 'Assets/Pruebas')
    t.tracks.push(newTrack('node', { keys: [newKey('node')] }))
    const copy = await api.duplicateEntry('timeline', t.id), resource = p.timelines.find(r => r.id === copy.id)
    assert.equal(resource.folder, t.folder); assert.notEqual(resource.tracks[0].id, t.tracks[0].id)
    assert.notEqual(resource.tracks[0].keys[0].id, t.tracks[0].keys[0].id)
  })
  await suite.test('Mover/renombrar carpeta conservan el ID y Undo restaura ubicación', () => {
    const p = setup(), t = api.createTimeline('Entrada', false)
    api.createFolder('Assets', 'Secuencias')
    assert.equal(api.moveItems([{ kind: 'timeline', id: t.id }], 'Assets/Secuencias'), 1)
    assert.equal(t.folder, 'Assets/Secuencias')
    assert.equal(api.renameFolder('Assets/Secuencias', 'Cortes'), true)
    assert.equal(p.timelines[0].folder, 'Assets/Cortes')
    history.undo(); assert.equal(p.timelines[0].folder, 'Assets/Secuencias')
  })
  await suite.test('Mover rechaza colisión sin cambiar nombre ni ID', () => {
    const p = setup(), t = api.createTimeline('Entrada', false)
    api.createFolder('Assets', 'Destino'); p.assets.push({ id: 'a_file', name: 'Entrada', folder: 'Assets/Destino', kind: 'file' })
    assert.equal(api.moveEntry('timeline', t.id, 'Assets/Destino'), false); assert.equal(t.folder, 'Assets'); assert.equal(t.name, 'Entrada')
    assert.equal(api.moveItems([{ kind: 'timeline', id: t.id }], 'Assets/Cinematics'), 0)
  })
  await suite.test('Renombrar bloquea uso por nombre y conserva referencia por ID', async () => {
    const p = setup(), t = api.createTimeline('Entrada', false)
    p.objects = [{ id: 'o_event', name: 'Evento', props: { timeline: t.name } }]
    assert.equal(await api.renameEntry('timeline', t.id, 'Salida'), false); assert.equal(t.name, 'Entrada')
    p.objects[0].props.timeline = t.id
    assert.equal(await answer(api.renameEntry('timeline', t.id, 'Salida'), true), true)
    assert.equal(t.name, 'Salida'); assert.equal(p.objects[0].props.timeline, t.id)
    history.undo(); assert.equal(p.timelines[0].name, 'Entrada')
  })
  await suite.test('Eliminar carpeta incluye Timeline y se deshace en una operación', async () => {
    const p = setup(); const t = api.createTimeline('Entrada', false, 'Assets/Pruebas')
    assert.equal(await api.deleteFolder('Assets/Pruebas'), true); assert.equal(p.timelines.length, 0)
    history.undo(); assert.ok(p.timelines.some(r => r.id === t.id)); assert.ok(p.folders.includes('Assets/Pruebas'))
  })
})
