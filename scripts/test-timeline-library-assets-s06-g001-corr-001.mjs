import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { computed, watch, nextTick, createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

test('S06 CORR-001: importación NFM real invalida la biblioteca reactiva y el componente excluye FilmMaker', async t => {
  const vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  globalThis.window = {}
  t.after(async () => { delete globalThis.window; await vite.close() })
  const { store } = await vite.ssrLoadModule('/src/core/state/state.js')
  const { createTimeline } = await vite.ssrLoadModule('/src/core/state/timelines.js')
  const history = await vite.ssrLoadModule('/src/core/state/history.js')
  const { createProjectData, splitProject } = await vite.ssrLoadModule('/src/core/project.js')
  const { isFilmMakerTimeline } = await vite.ssrLoadModule('/src/core/timeline/model.js')
  const { newFilm, packNfm } = await vite.ssrLoadModule('/src/filmmaker/film.js')
  const { buildLfproj } = await vite.ssrLoadModule('/src/core/lfproj.js')
  const { registerCaptureFilm } = await vite.ssrLoadModule('/src/tools-register.js')
  const { importFilm } = await vite.ssrLoadModule('/src/core/state/film.js')
  const { default: TimelinePanel } = await vite.ssrLoadModule('/src/components/TimelinePanel.vue')
  history.configureHistory({ save() {}, markPending() {}, hasDisk: () => false })
  t.after(() => history.cancelPendingAutosave())
  store.project = createProjectData('QA CORR-001'); store.locked = false; store.timelineId = null
  store.editor = { snapshotTerrain: () => store.project.terrain, syncAll() {}, syncEnvironment() {} }
  store.ui.mode = 'mobile'; store.prefs.bottomTab = 'timeline'
  history.resetHistory()
  createTimeline('Entrada', false); createTimeline('Salida', false)
  const listing = computed(() => store.project.timelines.filter(t => !isFilmMakerTimeline(t)))
  // Consumidor síncrono como el watcher de selección del panel. La lista ya está evaluada antes de importar.
  const stop = watch(() => listing.value.find(t => t.id === store.timelineId)?.id, () => {}, { flush: 'sync' })
  t.after(stop)
  assert.equal(listing.value.length, 2)
  registerCaptureFilm()
  const p = store.project
  const film = newFilm({ name: 'Película QA', sceneId: p.activeSceneId, sceneName: p.scenes[0].name, projectId: p.id, projectName: p.name })
  film.passes = [{ id: 'pass-qa', name: 'Película', take: -1, duration: 1, keys: [
    { t: 0, pos: [0, 2, 5], rot: [0, 0, 0], fov: 70 }, { t: 1, pos: [1, 2, 5], rot: [0, 0, 0], fov: 70 },
  ] }]
  const { meta, scene } = splitProject(p, p.terrain)
  const source = await buildLfproj({ meta, scenes: new Map([[meta.activeSceneId, scene]]), files: new Map() })
  const bytes = await packNfm(film, new Uint8Array(await source.blob.arrayBuffer()))
  assert.ok(bytes.byteLength > 100)
  const imported = await importFilm(bytes)
  await nextTick()
  assert.equal(imported.timelines.length, 1)
  assert.equal(store.project.timelines.length, 3)
  assert.equal(store.project.timelines.filter(isFilmMakerTimeline).length, 1)
  assert.deepEqual(listing.value.map(t => t.name), ['Entrada', 'Salida'])
  const html = await renderToString(createSSRApp(TimelinePanel))
  assert.equal((html.match(/class="timeline-item/g) || []).length, 2)
  assert.ok(html.includes('Entrada') && html.includes('Salida'))
  assert.ok(!html.includes('Película'))
  console.log('CORR-001: NFM real + importFilm + lista reactiva y render SSR del componente real PASS; no sustituye Electron.')
})
