// Historial (deshacer / rehacer) y marca de «cambios sin guardar». Solo depende del estado; lo que necesita del resto del almacén
// (guardar, saber si hay carpeta en disco, sincronizar piezas de terreno) se inyecta con configureHistory() desde store.js: así no hay ciclos.
import { strictJson } from '../../engine/runtime/numeric-integrity.js'
import { toRaw } from '@vue/reactivity'
import { authoredSceneTree } from '../../engine/runtime/scene/instances.js'
import { store } from './state.js'
import { debounce } from '../../engine/runtime/util.js'
import { nextNativeRevision } from '../cinematic-resource.js'
import { validateNodeTree } from '../../engine/runtime/nodes/hierarchy.js'

const hooks = {}
/** { save(), hasDisk(), syncPieces() } — los pone store.js al cargarse. */
export function configureHistory(h) { Object.assign(hooks, h) }

// ---------- historial (deshacer / rehacer) ----------
let hist = { stack: [], index: -1 }
let lastTerrainRef = null

function updateHistFlags() {
  store.canUndo = hist.index > 0
  store.canRedo = hist.index < hist.stack.length - 1
}

function captureEntry(label, withTerrain) {
  const p = store.project
  const terrain = withTerrain || !lastTerrainRef ? store.editor.snapshotTerrain() : lastTerrainRef
  lastTerrainRef = terrain
  const { occlusionBake, ...environment } = toRaw(p.environment)
  const tree = authoredSceneTree(p)
  return {
    label, objects: strictJson(toRaw(tree.objects)), signalConnections: strictJson(toRaw(tree.signalConnections)), scenes: strictJson(toRaw(p.scenes || [])),
    ...(Object.hasOwn(p, 'meshes') ? { meshes: strictJson(toRaw(p.meshes || [])) } : {}), materials: strictJson(toRaw(p.materials || [])), ...(Object.hasOwn(p, 'vfx') ? { vfx: strictJson(toRaw(p.vfx)) } : {}),
    ...(Object.hasOwn(p, 'folders') ? { folders: strictJson(toRaw(p.folders)) } : {}),
    profiles: strictJson(toRaw(p.profiles || [])), gameManagers: strictJson(toRaw(p.gameManagers || [])),
    // Una película importa clips, pistas, recursos y mezclador además de objetos. Undo debe revertir todo el conjunto.
    cinematics: strictJson(toRaw(p.cinematics || [])),
    timelines: strictJson(toRaw(p.timelines || [])), animations: strictJson(toRaw(p.animations || [])), captures: strictJson(toRaw(p.captures || [])),
    assets: strictJson(toRaw(p.assets || [])), models: strictJson(toRaw(p.models || [])),
    render: strictJson(toRaw(p.render || {})), audio: strictJson(toRaw(p.audio || {})),
    // El horneado se reemplaza completo. Las entradas comparten su tabla de solo lectura.
    env: strictJson(environment), occlusionBake, terrain,
    selectedId: store.selectedId, selectedIds: [...store.selectedIds],
    edit: store.editor?.editSnapshot?.() ?? null,
  }
}

export function resetHistory() {
  hist = { stack: [], index: -1 }
  lastTerrainRef = null
  if (store.project && store.editor) {
    hist.stack.push(captureEntry('Inicio', true))
    hist.index = 0
  }
  updateHistFlags()
}

let autosaveGeneration = 0
const autosave = debounce((generation) => {
  if (generation === autosaveGeneration) hooks.save?.()
}, 1400)
export const cancelPendingAutosave = () => { autosaveGeneration++ }

export function markDirty() {
  if (!store.project || store.locked) return
  store.unsavedChanges = true
  store.pendingRevision++
  hooks.markPending?.(store.project.id)
  store.saveState = 'dirty'
  if (hooks.hasDisk?.() && store.disk.state === 'saved') store.disk.state = 'dirty' // el archivo en disco también quedó atrasado
  autosave(autosaveGeneration)
}

/** Registra un punto de deshacer. `terrain: true` si cambió el terreno. */
export function commit(label = 'Cambio', { terrain = false, scriptDelta = null, streamDelta = null } = {}) {
  if (!store.project) return
  const entry = captureEntry(label, terrain)
  hist.stack.length = hist.index + 1
  if (streamDelta) entry.streamDelta = streamDelta
  if (scriptDelta) entry.scriptDelta = { ...scriptDelta, projectId: store.project.id }
  hist.stack.push(entry)
  if (hist.stack.length > 60) hist.stack.shift()
  hist.index = hist.stack.length - 1
  updateHistFlags()
  markDirty()
}

/** El guardado de FilmMaker no debe convertirse en un Undo falso del Editor:
 * actualiza en el historial las proyecciones de recursos ya presentes, sin tocar el resto de la escena. */
export function synchronizeCinematicHistory(id, resource, timeline) {
  const currentResource = JSON.parse(JSON.stringify(toRaw(resource)))
  const currentTimeline = timeline ? JSON.parse(JSON.stringify(toRaw(timeline))) : null
  for (const entry of hist.stack) {
    const resources = JSON.parse(entry.cinematics || '[]')
    if (!resources.some(c => c.id === id)) continue
    entry.cinematics = JSON.stringify(resources.map(c => c.id === id ? currentResource : c))
    const timelines = JSON.parse(entry.timelines || '[]')
      .filter(t => t.filmMaker?.nativeResourceId !== id)
    if (currentTimeline) timelines.push(currentTimeline)
    entry.timelines = JSON.stringify(timelines)
  }
}

function restoreEntryScene(e, selection) {
  const p = store.project
  const objects = JSON.parse(e.objects)
  validateNodeTree(objects)
  p.objects = objects
  p.signalConnections = JSON.parse(e.signalConnections || '[]')
  if (e.scenes) p.scenes = JSON.parse(e.scenes)
  // Proyectos antiguos no tenían el campo meshes: restaurar su forma original.
  if (e.meshes !== undefined) p.meshes = JSON.parse(e.meshes)
  else delete p.meshes
  p.materials = JSON.parse(e.materials || '[]')
  if (e.vfx !== undefined) p.vfx = JSON.parse(e.vfx)
  else delete p.vfx
  if (e.folders !== undefined) p.folders = JSON.parse(e.folders)
  else delete p.folders
  p.profiles = JSON.parse(e.profiles || '[]')
  p.gameManagers = JSON.parse(e.gameManagers || '[]')
  if (e.cinematics) {
    const previous = new Map((p.cinematics || []).map(c => [c.id, c]))
    p.cinematics = JSON.parse(e.cinematics).map(c => {
      const old = previous.get(c.id)
      // Deshacer/Rehacer una operación sobre Assets invalida ediciones abiertas en FilmMaker.
      // Un token restaurado literalmente podría reautorizar una sesión obsoleta.
      return (!old || old.revision !== c.revision || old.name !== c.name || old.folder !== c.folder)
        ? { ...c, revision: nextNativeRevision() } : c
    })
  }
  if (e.timelines) p.timelines = JSON.parse(e.timelines)
  if (e.animations) p.animations = JSON.parse(e.animations)
  if (e.captures) p.captures = JSON.parse(e.captures)
  if (e.assets) p.assets = JSON.parse(e.assets)
  if (e.models) p.models = JSON.parse(e.models)
  if (e.render) p.render = JSON.parse(e.render)
  if (e.audio) p.audio = JSON.parse(e.audio)
  p.environment = JSON.parse(e.env)
  if (e.occlusionBake) p.environment.occlusionBake = e.occlusionBake
  const terrainChanged = e.terrain !== lastTerrainRef
  if (terrainChanged) {
    store.editor.restoreTerrain(e.terrain)
    p.terrain.layers = e.terrain.layers.map((l) => ({ ...l }))
    p.terrain.foliage = (e.terrain.foliage || []).map((x) => ({ ...x.cfg }))
    hooks.syncPieces?.()
    if (!p.terrain.enabled) store.terrainSel = false
    lastTerrainRef = e.terrain
  }
  const alive = new Set(p.objects.map((o) => o.id))
  store.selectedIds = selection.ids.filter((id) => alive.has(id))
  store.selectedId = alive.has(selection.id) ? selection.id : store.selectedIds.at(-1) ?? null
  store.editor.restoreEdit?.(e.edit, alive)
  store.editor.syncAll()
  if (terrainChanged) store.editor.applyView()
}

function applyEntry(e, selection = { id: store.selectedId, ids: [...store.selectedIds] }) {
  const p = store.project
  const restore = () => restoreEntryScene(e, selection)
  if (store.editor.withHistorySceneSync) store.editor.withHistorySceneSync(restore)
  else restore()
  store.editor?.setCaptureClips?.(p.captures || [])
  store.editor.syncEnvironment()
  // La vista previa usa el recurso restaurado, no la referencia anterior al Undo.
  const previewId = store.editor?._postPreviewProfile?.id
  if (previewId) store.editor?.previewProfile?.(p.profiles.find((pr) => pr.id === previewId) || null)
  store.editor.setSelection(store.selectedId, store.selectedIds)
  store.editor.afterUndo?.()
  markDirty()
}

// Solo las transacciones generadas llevan delta de script; Undo normal nunca reescribe JS.
function transitionScript(delta, reverse) {
  if (!delta) return null
  const script = store.project?.scripts.find(s => s.id === delta.scriptId)
  const receiver = store.project?.objects.find(o => o.id === delta.receiverId)
  const associated = receiver && (Array.isArray(receiver.scriptIds) ? receiver.scriptIds.includes(delta.scriptId) : receiver.scriptId === delta.scriptId)
  if (store.project?.id !== delta.projectId || !script || script.execution !== 'node' || !associated)
    throw new Error('El script de la transacción ya no existe en el proyecto')
  if (script.code !== (reverse ? delta.after : delta.before))
    throw new Error('Conflicto: el script fue modificado después de generar el callback; no se cambia el historial')
  if (hooks.canEditGeneratedScript) {
    const reason = hooks.canEditGeneratedScript(delta.scriptId)
    if (reason) throw new Error(reason)
  }
  return { script, code: reverse ? delta.before : delta.after }
}
function moveHistory(to, entry, reverse) {
  if (to < 0 || to >= hist.stack.length) return
  store.editor.validateHistoryEdit?.(hist.stack[to])
  const target = transitionScript(entry.scriptDelta, reverse) // Valida antes de tocar escena, script o índice.
  const original = hist.stack[hist.index]
  const editId = store.editor.edit?.objId
  const selection = editId ? { id: editId, ids: [editId] } : { id: store.selectedId, ids: [...store.selectedIds] }
  const stream = entry.streamDelta
  if (stream) store.editor.streamingPreview.applyDelta(stream, reverse)
  try {
    applyEntry(hist.stack[to], selection)
    if (target) target.script.code = target.code
    hist.index = to
    updateHistFlags()
  } catch (e) {
    try {
      if (stream) store.editor.streamingPreview.applyDelta(stream, !reverse)
      applyEntry(original, selection)
    } catch (rollbackError) {
      throw new AggregateError([e, rollbackError], `No se pudo restaurar el historial: ${e.message}; recuperación: ${rollbackError.message}`)
    }
    throw e
  }
}
export function undo() {
  if (hist.index <= 0) return
  const current = hist.stack[hist.index]
  moveHistory(hist.index - 1, current, true)
}
export function redo() {
  if (hist.index >= hist.stack.length - 1) return
  const next = hist.stack[hist.index + 1]
  moveHistory(hist.index + 1, next, false)
}
