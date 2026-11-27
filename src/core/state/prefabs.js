// Prefabs: un subárbol de nodos reutilizable, con instancias vinculadas
import * as THREE from 'three'
import { uid } from '../../engine/runtime/util.js'
import { makeObject } from '../../engine/runtime/nodes/index.js'
import { addFolderChain, uniqueFileName, sanitizeName, normFolder, remapSignalConnections, materializePrefab, migrateNodeScripts } from '../project.js'
import { eventUsesPrefab } from '../../engine/runtime/nodes/prefab-graphic.js'
import { store, setTreeNodeOpen, toast, filmBlocked } from './state.js'
import { commit } from './history.js'
import { getObject, descendantsOf, worldMatrix, selectionRoots } from './tree.js'
import { selectObject, uniqueName } from './objects.js'
import { SUFFIX, stripSuffix } from './naming.js'


// =====================================================================
//  PREFABS
//  Un prefab guarda un subárbol de nodos. Sus instancias son nodos normales de la escena (así el editor y la
//  exportación no cambian); la raíz de cada instancia lleva `prefabId` + `prefabRev`. «Aplicar» sube los cambios
//  de una instancia al prefab (rev++) y el resto de instancias se rehacen desde él conservando su nombre, padre y
//  transformación. Los cambios locales en los hijos de una instancia se pierden al sincronizar.
// =====================================================================
export const prefabOf = (id) => store.project?.prefabs?.find((f) => f.id === id) || null
const NO_COPY = new Set(['id', 'parentId', 'position', 'rotation', 'scale', 'name', 'prefabId', 'prefabRev', 'open', 'active', 'visible', 'locked'])
const stripMarks = (o) => { delete o.prefabId; delete o.prefabRev; return o }

export const isPrefabInstance = (obj) => !!(obj?.prefabId && prefabOf(obj.prefabId))
const instanceRootOf = (id) => {
  let o = getObject(id)
  while (o) { if (o.prefabId) return o; o = o.parentId ? getObject(o.parentId) : null }
  return null
}
export { instanceRootOf }

/** Crea un prefab con los nodos `ids` (raíces) y lo guarda en `folder`. Si es un único nodo, pasa a ser instancia suya. */
export function createPrefab(ids = selectionRoots(), folder = 'Assets/Prefabs', { name } = {}) {
  const p = store.project
  const roots = ids.map(getObject).filter(o => o && !o.sceneInstanceOwner)
  if (!roots.length) { toast('Selecciona un nodo para crear el prefab', 'error'); return null }
  folder = normFolder(folder)
  const deep = (o) => migrateNodeScripts(stripMarks(JSON.parse(JSON.stringify(o))))
  let data, label
  if (roots.length === 1) {
    const r = roots[0]
    data = [r, ...descendantsOf(r.id).filter(o => !o.sceneInstanceOwner)].map(deep)
    data[0].parentId = null
    data[0].position = [0, 0, 0]
    label = name || r.name
  } else {
    const wrap = makeObject('group', 'group', { id: uid(), name: 'Prefab' })
    data = [wrap]
    for (const r of roots) {
      const sub = [r, ...descendantsOf(r.id).filter(o => !o.sceneInstanceOwner)].map(deep)
      sub[0].parentId = wrap.id
      data.push(...sub)
    }
    label = name || 'Prefab'
  }
  const fname = stripSuffix('prefab', uniqueFileName(p, folder, sanitizeName(label, 'Prefab') + SUFFIX.prefab))
  const inside = new Set(data.map((o) => o.id))
  const signalConnections = (p.signalConnections || []).filter((c) => inside.has(c.emitterId) && inside.has(c.receiverId))
  const pf = { id: uid('pf'), name: fname, folder, rev: 1, objects: data, signalConnections: JSON.parse(JSON.stringify(signalConnections)) }
  p.prefabs.push(pf)
  addFolderChain(p, folder)
  if (roots.length === 1) { roots[0].prefabId = pf.id; roots[0].prefabRev = pf.rev } // el nodo de la escena queda vinculado
  commit('Crear prefab')
  store.projSel = { kind: 'prefab', id: pf.id }
  toast(`Prefab «${fname}» creado en ${folder}`, 'ok')
  return pf
}

/** Prefab nuevo con un grupo vacío (desde «Crear ▸ Prefab» del panel Proyecto). */
export function createEmptyPrefab(folder = 'Assets/Prefabs') {
  const p = store.project
  folder = normFolder(folder)
  const name = stripSuffix('prefab', uniqueFileName(p, folder, 'Prefab nuevo' + SUFFIX.prefab))
  const pf = { id: uid('pf'), name, folder, rev: 1, objects: [makeObject('group', 'group', { id: uid(), name: 'Prefab' })], signalConnections: [] }
  p.prefabs.push(pf)
  addFolderChain(p, folder)
  commit('Crear prefab')
  return pf
}

function materialize(pf, parentId) { return materializePrefab(pf, parentId) }

/** Instancia un prefab en la escena. `position` es mundial; si hay `parentId` se convierte a local. */
export function instantiatePrefab(prefabId, { parentId = null, position = null, select = true } = {}) {
  if (store.filmMode) return filmBlocked()
  const pf = prefabOf(prefabId)
  if (!pf) return null
  // una instancia no se anida dentro de otra (al sincronizar se perdería): sube hasta el padre de la instancia
  for (let r = parentId && instanceRootOf(parentId); r; r = parentId && instanceRootOf(parentId)) parentId = r.parentId || null
  const { objects: objs, connections } = materialize(pf, parentId)
  const root = objs[0]
  root.name = uniqueName(root.name || pf.name)
  root.prefabId = pf.id
  root.prefabRev = pf.rev
  if (position) {
    if (parentId) root.position = new THREE.Vector3(...position).applyMatrix4(worldMatrix(parentId).invert()).toArray().map((v) => +v.toFixed(4))
    else root.position = [...position]
  }
  store.project.objects.push(...objs)
  store.project.signalConnections ||= []
  store.project.signalConnections.push(...connections)
  if (parentId) { const par = getObject(parentId); if (par) setTreeNodeOpen(par, true) }
  if (objs.some(o => o.type === 'sceneInstance')) store.editor.syncAll()
  else for (const o of objs) store.editor.syncObject(o.id)
  if (select) selectObject(root.id)
  commit(`Instanciar ${root.name}`)
  return root
}

/** Rehace una instancia desde su prefab (conserva nombre, padre y transformación de la raíz). */
function refreshInstance(rootId, { silent = false } = {}) {
  const root = getObject(rootId)
  const pf = root && prefabOf(root.prefabId)
  if (!root || !pf) return false
  const doomed = new Set(descendantsOf(rootId).map((d) => d.id))
  const internalIds = new Set([rootId, ...doomed])
  // Los enlaces hacia nodos externos no se redirigen a hijos distintos: quedan visibles como inválidos.
  store.project.signalConnections = (store.project.signalConnections || []).filter((c) =>
    !(internalIds.has(c.emitterId) && internalIds.has(c.receiverId)))
  if (doomed.size) store.project.objects = store.project.objects.filter((o) => !doomed.has(o.id))
  if (!silent) {
    for (const d of doomed) store.editor.removeObject(d)
    store.selectedIds = store.selectedIds.filter((s) => !doomed.has(s))
    if (doomed.has(store.selectedId)) store.selectedId = rootId
  }
  const base = migrateNodeScripts(pf.objects[0])
  for (const [k, v] of Object.entries(base)) if (!NO_COPY.has(k)) root[k] = JSON.parse(JSON.stringify(v))
  migrateNodeScripts(root)
  const map = new Map(pf.objects.map((o) => [o.id, uid()]))
  map.set(base.id, rootId)
  const kids = pf.objects.slice(1).map((o) => {
    const c = migrateNodeScripts(stripMarks(JSON.parse(JSON.stringify(o))))
    c.id = map.get(o.id)
    c.parentId = map.get(o.parentId)
    return c
  })
  store.project.objects.push(...kids)
  store.project.signalConnections.push(...remapSignalConnections(pf.signalConnections || [], map))
  root.prefabRev = pf.rev
  if (!silent) {
    if (root.type === 'sceneInstance' || kids.some(o => o.type === 'sceneInstance')) store.editor.syncAll()
    else { store.editor.syncObject(rootId); for (const k of kids) store.editor.syncObject(k.id) }
  }
  return true
}

/** Pone al día todas las instancias de la escena activa con su prefab (y desvincula las de prefabs que ya no existen). */
export function syncPrefabInstances({ silent = false } = {}) {
  if (!store.project?.objects) return false
  let changed = false
  for (const o of [...store.project.objects]) {
    if (!o.prefabId || o.sceneInstanceOwner) continue
    const pf = prefabOf(o.prefabId)
    if (!pf) { stripMarks(o); changed = true } else if ((o.prefabRev || 0) < pf.rev) changed = refreshInstance(o.id, { silent }) || changed
  }
  return changed
}

/** Sube a su prefab los cambios de la instancia cuya raíz es `rootId`. */
export function applyToPrefab(rootId) {
  const root = getObject(rootId)
  const pf = root && prefabOf(root.prefabId)
  if (!pf) return false
  const data = [root, ...descendantsOf(rootId).filter(o => !o.sceneInstanceOwner)].map((o) => migrateNodeScripts(stripMarks(JSON.parse(JSON.stringify(o)))))
  data[0].parentId = null
  data[0].position = [0, 0, 0]
  pf.objects = data
  const included = new Set(data.map((o) => o.id))
  pf.signalConnections = JSON.parse(JSON.stringify((store.project.signalConnections || []).filter((c) =>
    included.has(c.emitterId) && included.has(c.receiverId))))
  pf.rev++
  root.prefabRev = pf.rev
  const n = [...store.project.objects].filter((o) => o.prefabId === pf.id && o.id !== rootId).length
  syncPrefabInstances()
  // eventos que lo usan como gráfico de página: se rehace su vista previa
  for (const o of store.project.objects) if (eventUsesPrefab(o, pf.id)) store.editor?._rebuild(o)
  commit(`Aplicar al prefab ${pf.name}`)
  toast(`Prefab «${pf.name}» actualizado${n ? ` · ${n} instancia(s) sincronizada(s)` : ''}`, 'ok')
  return true
}

/** Descarta los cambios locales de la instancia y la rehace desde el prefab. */
export function revertInstance(rootId) {
  if (!refreshInstance(rootId)) return false
  commit('Revertir al prefab')
  return true
}

/** La instancia pasa a ser un grupo de nodos normal (deja de estar vinculada). */
export function unpackInstance(rootId) {
  const root = getObject(rootId)
  if (!root?.prefabId) return false
  stripMarks(root)
  commit('Desvincular prefab')
  return true
}

export function removePrefabData(id) {
  const p = store.project
  p.prefabs = p.prefabs.filter((f) => f.id !== id)
  for (const o of p.objects) if (o.prefabId === id) stripMarks(o) // las instancias de esta escena quedan como nodos normales
}

export function placeModel(modelId) {
  if (store.filmMode) return filmBlocked()
  const m = store.project.models.find((x) => x.id === modelId)
  if (!m) return
  store.place = { type: 'model', kind: 'model', modelId }
  store.tool = 'place'
}

export function startPlace(type, kind, props = null, name = null) {
  store.place = { type, kind, modelId: null, props, name }
  store.tool = 'place'
}
