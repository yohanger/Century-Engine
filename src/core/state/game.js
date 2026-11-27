// Eventos, base de datos, etiquetas, ajustes y exportación del juego (AppImage)
import * as db from '../db.js'
import { store, toast } from './state.js'
import { markDirty } from './history.js'
import { saveNow, buildProjectFile } from './project.js'
import { includeStreamingScenes } from '../../engine/runtime/streaming/config.js'
import { includeInstancedSceneSources } from '../../engine/runtime/scene/instances.js'
import { writePackage } from '../../engine/runtime/index.js'
import { buildSceneIds, ensureBuildList, toggleScene, moveScene, validateBuildSources } from '../buildList.js'
import { getObject } from './tree.js'
import { host } from '../desktop.js'
import { sceneGameConfig } from '../../engine/runtime/game-manager.js'
import { removeTag } from '../../engine/runtime/layers.js'
import { nodeEffectiveActive } from '../../engine/runtime/nodes/hierarchy.js'
import { focusNativeTool } from '../editor/native-tool-window.js'


// =====================================================================
//  EVENTOS · SCRIPTS · BASE DE DATOS
// =====================================================================
export function openEventEditor(id) {
  if (!store.project || store.locked || (!/^(tl|an|db):/.test(id) && getObject(id)?.type !== 'event')) return
  if (store.eventEditId === id) { focusNativeTool('events'); return }
  store.eventReturn = String(id).startsWith('db:') ? 'database' : null
  store.eventEditId = id
  if (!globalThis.window?.lf?.isElectron) store.modal = 'event'
}
export function closeEventEditor() {
  store.eventEditId = null
  if (store.modal === 'event') store.modal = store.eventReturn || null
  store.eventReturn = null
}
// =====================================================================
//  LOCALIZACIÓN (i18n/localization.js): idiomas, textos por clave y voces
// =====================================================================
// ---------- juego exportado (plantilla → AppImage) ----------
export function openGameSettings() { store.modal = 'game' }
export function openEngineSettings() { store.modal = 'engine' }
export function openExportGame() { store.gameExport.result = null; store.gameExport.error = ''; store.gameExport.diagnostics = { devtools: false, stats: false }; store.modal = 'exportgame' }
export const canExportApp = () => !!host()?.exportAppImage

// ---------- ventana Build ----------
/** Destinos de exportación. Solo Linux x86_64 está implementado; el resto se muestra desactivado. */
export const BUILD_TARGETS = [
  { id: 'linux-x64', name: 'Linux', detail: 'x86_64 · AppImage', ready: true },
  { id: 'windows-x64', name: 'Windows', detail: 'x86_64', ready: false },
  { id: 'macos', name: 'macOS', detail: 'Apple Silicon / Intel', ready: false },
  { id: 'web', name: 'Web', detail: 'HTML5', ready: false },
]
export const buildScenes = (p = store.project) => buildSceneIds(p)
export function toggleBuildScene(id) { toggleScene(store.project, id); markDirty() }
/** Mueve una escena de la lista (dir −1 arriba, +1 abajo). */
export function moveBuildScene(id, dir) { if (moveScene(store.project, id, dir)) markDirty() }
export function setBuildTarget(id) { if (BUILD_TARGETS.find((t) => t.id === id)?.ready) { ensureBuildList(store.project).target = id; markDirty() } }

/** Avisos antes de exportar (qué faltaría para que el juego arranque bien). */
export function exportChecks() {
  const p = store.project, w = []
  if (!p) return w
  const ids = buildScenes(p)
  if (!ids.length) { w.push('No hay ninguna escena en la lista: añade al menos una para poder exportar.'); return w }
  const start = p.scenes.find((s) => s.id === ids[0])
  const gm = sceneGameConfig(p, start?.id)
  if (start && start.id === p.activeSceneId) {
    // Misma elegibilidad de Camera3D que PlayMode: la visibilidad no desactiva la cámara.
    const hasMain = p.objects.some((o) => o.type === 'camera' && nodeEffectiveActive(p.objects, o) && (o.props?.main || o.id === gm.manager?.camera))
    if (gm.config.player === 'none') {
      if (!hasMain) w.push(`La escena inicial «${start.name}» no tiene una cámara base activa. La vista permanecerá vacía hasta que un evento, script o Timeline active una cámara.`)
    } else if (start.playerSpawnMode !== 'api' && !p.objects.some(o => o.id === start.playerNodeId && o.type === 'characterbody3d' && nodeEffectiveActive(p.objects, o))) {
      w.push(`La escena inicial «${start.name}» no tiene un CharacterBody3D designado: no habrá jugador.` + (hasMain ? '' : ' Sin cámara base, la vista permanecerá vacía hasta activar otra cámara.'))
    }
  }
  return w
}

/** Empaqueta el juego (solo las escenas de la lista Build, en orden). Devuelve { bytes, meta }. */
export async function buildGamePackage(/** @type {(phase: string) => void} */ onPhase = () => {}) {
  onPhase('Guardando proyecto…')
  await saveNow({ thumb: false })
  const { meta, files, scenes } = await buildProjectFile()
  const list = buildScenes()
  if (!list.length) throw new Error('No hay ninguna escena en la lista')
  let included = includeStreamingScenes(meta.scenes, list)
  // Los recursos Scene referenciados y los chunks necesarios no son niveles nuevos de arranque.
  // Converger cuando un chunk contiene a su vez una escena instanciada, o viceversa.
  for (let size = -1; size !== included.length;) {
    size = included.length
    included = includeInstancedSceneSources(meta.scenes, scenes, included, meta.prefabs)
    included = includeStreamingScenes(meta.scenes, included)
  }
  const data = included.map((id) => ({ id, name: meta.scenes.find((s) => s.id === id)?.name || id, data: scenes.get(id) }))
  validateBuildSources(meta, data, files)
  onPhase('Empaquetando el juego…')
  return { bytes: await writePackage({ data: meta, scenes: data, files }), meta, streaming: included.some(id => meta.scenes.find(scene => scene.id === id)?.streaming?.enabled === true) }
}

/** Genera el AppImage del juego con la plantilla del proyecto. Solo en la app de escritorio (Linux). */
export async function exportGameAppImage() {
  const st = store.gameExport
  if (st.busy) return
  if (!canExportApp()) { st.error = 'La exportación a AppImage solo está disponible en la app de escritorio (Linux).'; return }
  if (!buildScenes().length) { st.error = 'No hay ninguna escena en la lista.'; return }
  st.busy = true; st.error = ''; st.result = null; st.phase = 'Guardando proyecto…'; st.done = 0; st.total = 1
  try {
    const { bytes, meta, streaming } = await buildGamePackage((phase) => { st.phase = phase })
    const g = meta.game || {}
    let icon = null
    if (g.icon) { const a = await db.getAsset(meta.id, g.icon); if (a && /\.png$/i.test(a.name)) icon = new Uint8Array(a.bytes) }
    let splash = null
    if (g.splash) {
      const asset = await db.getAsset(meta.id, g.splash)
      if (!asset) throw new Error('No se encontró la imagen de splash elegida en Ajustes del juego.')
      splash = new Uint8Array(asset.bytes)
    }
    const r = await host().exportAppImage(
      { name: g.title || meta.name, version: g.version || '1.0.0', window: g.window, width: g.width, height: g.height, bytes, icon, splash, streaming,
        diagnostics: { devtools: st.diagnostics?.devtools === true, stats: st.diagnostics?.stats === true } },
      (p) => { st.phase = p.phase; st.done = p.done; st.total = p.total },
    )
    if (r?.ok) {
      st.result = r
      const b = ensureBuildList(store.project); b.last = { at: Date.now(), path: r.path, size: r.size, scenes: buildScenes().length, target: b.target }
      markDirty()
      toast('Juego exportado: ' + r.path, 'ok', 5000)
    }
  } catch (e) {
    console.error(e)
    st.error = e.message || String(e)
  } finally {
    st.busy = false
  }
}

export function openDatabase() { store.modal = 'database' }
/** Tags y Layers del proyecto (core/layers.js). */
export function openTagLayers() { store.modal = 'taglayers' }
/** Aplica una operación de core/layers.js al registro global y marca el proyecto como modificado. */
export function editTagLayers(fn) { const r = fn(store.project.tagLayers); markDirty(); return r }
/** Quita una etiqueta personalizada: los objetos que la llevaban vuelven a «Untagged». */
export async function deleteTag(name) {
  if (!removeTag(store.project.tagLayers, name)) return false
  for (const o of store.project.objects) if (o.tag === name) o.tag = 'Untagged'
  markDirty(); return true
}
/** Base de datos ▸ Jugador (cuerpo, velocidad, ojos y slots del view model). */
export function openPlayerSettings() { store.dbUi.section = 'player'; store.modal = 'database' }
/** Nombre de un interruptor/variable de la base de datos (kind: 'switches' | 'variables'; id desde 1). */
export function setDbName(kind, id, name) {
  const list = store.project.database[kind]
  while (list.length < id) list.push('')
  list[id - 1] = name
  while (list.length && !list[list.length - 1]) list.pop() // sin huecos vacíos al final
  markDirty()
}
