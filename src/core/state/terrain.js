import { SNAP_KEYS, normalizeEditorSnap } from './editor-workspace.js'
// Terreno (nodo y piezas), vegetación y ajustes del entorno
import { makeFoliageType } from '../../engine/runtime/geometry/foliage.js'
import { store, toast, filmBlocked, clone } from './state.js'
import { markDirty, commit } from './history.js'
import { selectObject } from './objects.js'
import { askConfirm } from '../dialogs.js'
import { hooks } from './hooks.js'

// ---------- terreno / entorno ----------
/** La excepción de la advertencia es exclusiva de recortes; no altera el resto de diálogos. */
export async function confirmTerrainCrop() {
  if (store.prefs.terrainCropWarning === false) return true
  const answer = await askConfirm('Recortar terreno elimina alturas, pintura y vegetación fuera del borde. Puedes deshacer la operación. ¿Continuar?', {
    title: 'Recortar terreno', allowSkip: true,
  })
  if (answer.confirmed && answer.skipFuture) store.prefs.terrainCropWarning = false
  return answer.confirmed
}

export function commitTerrain(label = 'Terreno') {
  commit(label, { terrain: true })
}

// ---------- nodo Terreno ----------
export const terrainOn = () => !!store.project && store.editor?.terrains?.some(t => t.enabled !== false) === true

export function selectTerrain() {
  if (!store.editor?.terrain) return
  const id = store.editor.terrain.id
  if (!store.project?.objects.some(o => o.id === id && o.type === 'terrain')) return
  selectObject(id)
  store.sceneSel = false
  store.prefs.rightTab = 'object'
}

/** Copia al proyecto el estado de las piezas (lista para la UI y espejo de la pieza activa). */
export function syncPieces() {
  const ed = store.editor
  if (!ed || !store.project) return
  store.pieces = ed.terrains.map((t) => ({ id: t.id, name: t.name, ox: t.ox, oy: t.oy, oz: t.oz, size: t.size, depth: t.depth, segments: t.segments, segmentsZ: t.segmentsZ, step: t.step, enabled: t.enabled !== false, visible: t.visible !== false,
    terrainBake: t.terrainBake ? { ...t.terrainBake } : null,
    bakeInfo: t.bakeInfo ? { triangles:t.bakeInfo.triangles, sourceTriangles:t.bakeInfo.sourceTriangles,
      reduction:t.bakeInfo.reduction, patches:t.bakeInfo.patches || 0,
      height:t.bakeInfo.height, paint:t.bakeInfo.paint, bakeMs:t.bakeInfo.bakeMs || 0,
      spatial:t.bakeInfo.algorithm || 'adaptativo' } : null }))
  // Nodo de escena de cada pieza activa, sin duplicar mapas de alturas ni pintura.
  const enabled = new Set(ed.terrains.filter(t => t.enabled !== false).map(t => t.id))
  const oldNodes = store.project.objects.filter(o => o.type === 'terrain')
  for (const node of oldNodes) if (!enabled.has(node.id)) {
    store.project.objects.splice(store.project.objects.indexOf(node), 1)
    ed.removeObject?.(node.id)
  }
  for (const t of ed.terrains) {
    if (t.enabled === false) continue
    const node = store.project.objects.find(o => o.id === t.id && o.type === 'terrain')
    if (node) {
      node.name = t.name; node.visible = t.visible !== false
    } else {
      store.project.objects.push({ id: t.id, name: t.name || 'Terreno', type: 'terrain', kind: 'terrain',
        parentId: null, open: false, active: true, visible: t.visible !== false, locked: false,
        tag: 'Untagged', layers: [0], props: { terrainId: t.id }, scriptIds: [] })
      ed.syncObject?.(t.id)
    }
  }
  if (store.terrainSel && !enabled.has(store.selectedId)) selectObject(null)
  const a = ed.terrain
  store.activePieceId = a?.id ?? null
  if (a) {
    store.project.terrain.size = a.size
    store.project.terrain.segments = a.segments
    store.project.terrain.enabled = ed.terrains.some((t) => t.enabled !== false)
  }
}

export function selectPiece(id) {
  store.editor.setActivePiece(id)
  syncPieces()
  selectTerrain()
}

export function removeTerrain() {
  if (store.filmMode) return filmBlocked()
  if (!terrainOn()) return
  const ed = store.editor
  if (ed.terrains.length > 1) {
    ed.removePiece(ed.terrain.id)
    syncPieces()
    commitTerrain('Eliminar pieza de terreno')
    return
  }
  const t = ed.terrain
  t.enabled = false
  t.version++
  store.project.terrain.enabled = false
  syncPieces()
  store.terrainSel = false
  if (store.tool === 'terrain') store.tool = 'select'
  store.editor.applyView()
  commitTerrain('Eliminar terreno')
}

/** Vuelve a crear el terreno (plano, sin pintura ni vegetación) en una escena que no lo tiene. */
export function addTerrain() {
  if (store.filmMode) return filmBlocked()
  if (terrainOn()) return selectTerrain()
  const t = store.editor.terrain
  t.enabled = true
  t.flat(0)
  t.resetPaint()
  for (const id of [...t.foliage.types.keys()]) t.foliage.clearType(id)
  t.version++
  store.project.terrain.enabled = true
  syncPieces()
  store.editor.applyView()
  commitTerrain('Añadir terreno')
  selectTerrain()
}

/** Añade otra pieza de terreno (plana) pegada a la activa por el lado `adjacent` (px|nx|pz|nz). */
export function addTerrainPiece({ adjacent = 'px', size = null, segments = null } = {}) {
  if (store.filmMode) return filmBlocked()
  if (!terrainOn()) return addTerrain()
  const ed = store.editor
  const t = ed.addPiece({ adjacent, size, segments })
  ed.stitch()
  syncPieces()
  commitTerrain('Añadir pieza de terreno')
  selectTerrain()
  ed.frameAll()
  return t
}

export function setPiecePosition(id, x, z, doCommit = true, y = null) {
  store.editor.movePiece(id, x, z, y)
  if (doCommit) { store.editor.stitch(); }
  syncPieces()
  if (doCommit) commitTerrain('Mover pieza de terreno')
}

/** Visibilidad por pieza, registrada en la misma serialización y Undo que el relieve.
 * No confundir con Ver → Mostrar terreno, que oculta temporalmente todas las piezas en el visor. */
let triangHorJob = null
export async function bakeSceneTerrain({ heightError = 0.08, paintError = 0.06 } = {}) {
  if (store.filmMode) return filmBlocked()
  const editor=store.editor, project=store.project
  const pieces = editor?.terrains?.filter(t => t.enabled !== false) || []
  if (!pieces.length) { toast('Sin terreno activo'); return [] }
  // Un solo trabajo CPU activo: no saturar 4 GB ni competir con otros Workers GPU.
  triangHorJob?.controller.abort()
  const controller = new AbortController(), job={ controller }
  triangHorJob=job
  store.terrainBakeProgress={active:true,done:0,total:pieces.length}
  const snapshot=pieces.map(t=>({terrain:t,version:t.version,id:t.id}))
  const cfg={ heightError, paintError }
  const plans=[]
  try {
    const { bakeTerrainOffThread } = await import('../../engine/runtime/render/trianghor/worker-client.js')
    for (const item of snapshot) {
      if (controller.signal.aborted) throw new Error('TriangHor cancelado')
      const plan=await bakeTerrainOffThread(item.terrain,cfg,controller.signal)
      if (editor!==store.editor || project!==store.project ||
          item.terrain.version!==item.version || !editor.terrains.includes(item.terrain))
        throw new Error('Terrain cambió durante el horneado; resultados descartados')
      plans.push({ ...item, plan })
      store.terrainBakeProgress={active:true,done:plans.length,total:pieces.length}
    }
    // Publicación atómica en el estado de autoría: nunca resultados parciales.
    if (controller.signal.aborted || triangHorJob!==job || editor!==store.editor || project!==store.project ||
        plans.some(p=>p.terrain.version!==p.version)) throw new Error('TriangHor cancelado o escena modificada')
    const previous=plans.map(({terrain})=>({terrain,settings:terrain.terrainBake,
      plan:terrain.bakeInfo,version:terrain.version,bakeVersion:terrain._bakeVersion}))
    try {
      const results=plans.map(({terrain,plan})=>({id:terrain.id,name:terrain.name,
        ...terrain.bakeOptimized(cfg,plan)}))
      syncPieces()
      editor.afterPiecesChanged()
      commitTerrain('TriangHor · Hornear Mapa')
      const blocked=results.filter(p=>p.triangles>=p.sourceTriangles).length
      if (blocked) toast(`TriangHor: ${blocked} pieza(s) sin reducción`)
      return results
    } catch (error) {
      // No mantener una pieza publicada y otra no si falla el commit/refresh.
      for (const old of previous) {
        old.terrain.terrainBake=old.settings
        old.terrain.bakeInfo=old.plan
        old.terrain.version++
        // La invalidez es preferible a mostrar índices de una revisión distinta.
        old.terrain._bakeVersion=-1
      }
      syncPieces()
      editor.afterPiecesChanged()
      throw error
    }
  } catch(error) {
    if (!controller.signal.aborted) toast(`TriangHor: ${error?.message || String(error)}`)
    return []
  } finally {
    if (triangHorJob===job) {triangHorJob=null;store.terrainBakeProgress=null}
  }
}

export function clearSceneTerrainBake() {
  if (store.filmMode) return filmBlocked()
  triangHorJob?.controller.abort()
  const pieces = store.editor?.terrains || []
  if (!pieces.some(t => t.terrainBake)) return false
  for (const t of pieces) t.clearOptimizedBake()
  syncPieces()
  store.editor.afterPiecesChanged()
  commitTerrain('Limpiar horneado geométrico')
  return true
}

export function setPieceVisible(id, visible) {
  if (store.filmMode) return filmBlocked()
  const ed = store.editor
  const t = ed?.terrains.find((x) => x.id === id)
  if (!t) return false
  const shown = t.enabled !== false && t.visible !== false
  if (shown === !!visible) return false
  // Recuperar un terreno antiguo desactivado no debe aplanarlo ni perder pintura.
  if (visible && !t.enabled) t.enabled = true
  t.visible = !!visible
  t.version++
  ed.afterPiecesChanged()
  syncPieces()
  commitTerrain(visible ? 'Mostrar pieza de terreno' : 'Ocultar pieza de terreno')
  return true
}

export function extendTerrainEdge(id, side, cells) {
  if (store.filmMode) return filmBlocked()
  if (!store.editor?.extendTerrainEdge(id, side, cells)) return false
  syncPieces()
  commitTerrain('Cambiar borde del terreno')
  return true
}

export function renamePiece(id, name) {
  const t = store.editor.terrains.find((x) => x.id === id)
  if (!t) return
  t.name = name || t.name
  t.version++
  syncPieces()
  commitTerrain('Renombrar pieza de terreno')
}

export function stitchTerrain() {
  const n = store.editor.stitch().length
  syncPieces()
  if (n) commitTerrain('Unir bordes de terreno')
  return n
}

// ---------- vegetación ----------
const foliageList = () => store.project.terrain.foliage || (store.project.terrain.foliage = [])
function applyFoliage(label) {
  for (const t of store.editor.terrains) t.foliage.setTypes(clone(foliageList()))
  commitTerrain(label)
}
/** Tras editar a mano un campo de un tipo (densidad, escala…): aplica y deja un punto de deshacer. */
export function commitFoliageEdit(label = 'Vegetación') { applyFoliage(label) }

export function addFoliageType(source = 'empty', ref = null, name = '') {
  const t = makeFoliageType(source, ref, name)
  foliageList().push(t)
  store.foliageBrush.typeId = t.id
  applyFoliage(`Añadir vegetación: ${t.name}`)
  return t
}

export function removeFoliageType(id) {
  const l = foliageList()
  const i = l.findIndex((t) => t.id === id)
  if (i < 0) return
  const name = l[i].name
  l.splice(i, 1)
  if (store.foliageBrush.typeId === id) store.foliageBrush.typeId = l[0]?.id || null
  applyFoliage(`Quitar vegetación: ${name}`)
}

/** Asigna un archivo del proyecto (modelo o textura) a un tipo; sin `id` crea uno nuevo. */
export function assignFoliageFile(id, entry) {
  if (!entry || !['model', 'texture'].includes(entry.kind)) { toast('Arrastra un modelo (.glb/.obj) o una textura (.png/.webp)', 'info'); return null }
  const l = foliageList()
  const base = (entry.name || '').replace(/\.[^.]+$/, '')
  let t = id ? l.find((x) => x.id === id) : null
  if (!t) return addFoliageType(entry.kind, entry.id, base)
  const fresh = makeFoliageType(entry.kind, entry.id, base)
  const keep = t.source === 'empty' ? {} : { density: t.density, minScale: t.minScale, maxScale: t.maxScale }
  Object.assign(t, { ...fresh, id: t.id, ...keep, name: t.source === 'empty' || /^(Slot vacío|Modelo|Textura)$/.test(t.name) ? base : t.name })
  if (entry.kind === 'model') { t.texture = null; t.builtin = null } else { t.modelId = null; t.builtin = null }
  applyFoliage(`Vegetación: ${base}`)
  return t
}

export function clearFoliageInstances(id) {
  for (const t of store.editor.terrains) t.foliage.clearType(id)
  commitTerrain('Borrar instancias')
}

export function updateEnvironment(patch, doCommit = true) {
  const env = store.project.environment
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object') Object.assign(env[k], v)
    else env[k] = v
  }
  store.editor.syncEnvironment()
  if (doCommit) commit('Entorno')
}

export function updateSettings(patch) {
  // Movimiento y el `snap` heredado son la misma opción. Rotar/escalar son independientes.
  if (Object.hasOwn(patch, 'snap') && !Object.hasOwn(patch, 'moveSnapOn')) patch = { ...patch, moveSnapOn: patch.snap }
  if (Object.hasOwn(patch, 'moveSnapOn')) patch = { ...patch, snap: patch.moveSnapOn }
  const local = Object.fromEntries(Object.entries(patch).filter(([key]) => SNAP_KEYS.includes(key)))
  const authored = Object.fromEntries(Object.entries(patch).filter(([key]) => !SNAP_KEYS.includes(key)))
  if (Object.keys(local).length) store.editorSnap = { ...store.editorSnap, ...normalizeEditorSnap(local) }
  if (Object.keys(authored).length) { Object.assign(store.project.settings, authored); markDirty() }
  store.editor.syncSettings()
}

/** Ctrl+J: une las mallas seleccionadas en la activa (se completa con el módulo de mallas). */
export function joinSelectedMeshes() {
  if (store.filmMode) return filmBlocked()
  return store.editor?.joinMeshes?.()
}



// Lo usa removeObject (state/objects.js) sin importar este módulo.
hooks.removeTerrain = removeTerrain
