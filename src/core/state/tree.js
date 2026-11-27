// Árbol de nodos: consultas (getObject, hijos, descendientes, matriz de mundo, selección) y reparentar. Solo depende del estado.
import { toRaw } from '@vue/reactivity'
import * as THREE from 'three'
import { DEG } from '../../engine/runtime/util.js'
import { worldMatrixOf } from '../../engine/runtime/scene/matrix.js'
import { validateNodeParent, validateNodeTree } from '../../engine/runtime/nodes/hierarchy.js'
import { shouldAlignMeshSubtractToParent } from '../../engine/runtime/mesh/mesh-subtract-source.js'
import { store, setTreeNodeOpen, toast } from './state.js'
import { commit } from './history.js'

// índice id → posición, validado en cada acceso (si el array cambió se reconstruye): evita el recorrido lineal con proxies reactivos
let objIndex = new Map()
export function getObject(id) {
  const arr = store.project?.objects
  if (!arr || id == null) return null
  const raw = toRaw(arr)
  const i = objIndex.get(id)
  if (i !== undefined && raw[i]?.id === id) { void arr.length; return arr[i] }
  objIndex = new Map()
  for (let k = 0; k < raw.length; k++) objIndex.set(raw[k].id, k)
  const k = objIndex.get(id)
  return k === undefined ? null : arr[k]
}
export const selected = () => getObject(store.selectedId)

export function childrenOf(id) {
  return store.project.objects.filter((o) => (o.parentId || null) === (id || null))
}

export function descendantsOf(id) {
  const out = []
  const kids = new Map() // un solo recorrido para agrupar por padre, en vez de uno por nodo
  for (const c of store.project.objects) { if (c.parentId) { const a = kids.get(c.parentId); if (a) a.push(c); else kids.set(c.parentId, [c]) } }
  const walk = (pid) => { for (const c of kids.get(pid) || []) { out.push(c); walk(c.id) } }
  walk(id)
  return out
}

export function isDescendant(id, ancestorId) {
  let o = getObject(id)
  while (o && o.parentId) {
    if (o.parentId === ancestorId) return true
    o = getObject(o.parentId)
  }
  return false
}

export function pathOf(id) {
  const names = []
  let o = getObject(id)
  while (o) { names.unshift(o.name); o = o.parentId ? getObject(o.parentId) : null }
  return names.join(' / ')
}

export const worldMatrix = (id) => worldMatrixOf(getObject, id)

export function setLocalFromWorld(obj, parentId, world) {
  const parentWorld = worldMatrix(parentId)
  if (Math.abs(parentWorld.determinant()) < 1e-10) throw new Error('Transform del padre no invertible')
  const inv = parentWorld.invert()
  const local = inv.multiply(world)
  const p = new THREE.Vector3(), qn = new THREE.Quaternion(), s = new THREE.Vector3()
  local.decompose(p, qn, s)
  const reconstructed = new THREE.Matrix4().compose(p, qn, s)
  if (local.elements.some((v, i) => Math.abs(v - reconstructed.elements[i]) > 1e-5)) {
    throw new Error('Reparent incompatible: el Transform produciría shear')
  }
  // Solo Node3D transmite escala en la jerarquía; los demás nodos tienen tamaño visual propio.
  if (!['node3d', 'sceneInstance'].includes(obj.type) && s.toArray().some((v) => Math.abs(v - 1) > 1e-5)) {
    throw new Error('No se puede conservar la escala mundial en este tipo de nodo')
  }
  const e = new THREE.Euler().setFromQuaternion(qn, 'YXZ')
  const position = p.toArray().map((v) => +v.toFixed(5))
  const rotation = [e.x / DEG, e.y / DEG, e.z / DEG].map((v) => +v.toFixed(4))
  if (![...position, ...rotation].every(Number.isFinite)) throw new Error('Transform local inválido')
  obj.position = position
  obj.rotation = rotation
  if (['node3d', 'sceneInstance'].includes(obj.type)) obj.scale = s.toArray().map((v) => +v.toFixed(5))
}

/** Posición mundial de un nodo. */
export function worldPosition(id) {
  const p = new THREE.Vector3()
  p.setFromMatrixPosition(worldMatrix(id))
  return p
}

/** Reordena hermanos existentes sin cambiar parentId ni tocar ninguna transformación.
 * Inserción estable de varias raíces: un único cambio de array y un solo Undo. */
export function reorderSiblings(ids, parentId, beforeId = null, { commit: doCommit = true } = {}) {
  const arr = store.project?.objects
  if (!arr?.length || !ids?.length) return false
  const parent = parentId || null
  const dragged = new Set(ids)
  const moving = arr.filter(o => dragged.has(o.id))
  if (moving.length !== dragged.size || moving.some(o => (o.parentId || null) !== parent || o.sceneInstanceOwner)) return false
  if (parent && (getObject(parent)?.sceneInstanceOwner || getObject(parent)?.type === 'sceneInstance')) return false
  if (beforeId && dragged.has(beforeId)) return false
  if (beforeId && (getObject(beforeId)?.parentId || null) !== parent) return false
  for (const o of moving) {
    let current = o
    while (current) {
      if (current.locked) { toast('Desbloquea el nodo o su padre para reordenarlo', 'error'); return false }
      current = current.parentId ? getObject(current.parentId) : null
    }
  }
  const siblings = arr.filter(o => (o.parentId || null) === parent)
  const remaining = siblings.filter(o => !dragged.has(o.id))
  const at = beforeId ? remaining.findIndex(o => o.id === beforeId) : remaining.length
  if (at < 0) return false
  remaining.splice(at, 0, ...moving)
  if (siblings.every((o, i) => o === remaining[i])) return false
  let i = 0
  const ordered = arr.map(o => (o.parentId || null) === parent ? remaining[i++] : o)
  arr.splice(0, arr.length, ...ordered)
  if (doCommit) commit(moving.length > 1 ? 'Reordenar nodos' : `Reordenar ${moving[0].name}`)
  return true
}

function reorder(obj, beforeId) {
  const arr = store.project.objects
  const from = arr.indexOf(obj)
  if (from < 0) return
  arr.splice(from, 1)
  let to = beforeId ? arr.findIndex((o) => o.id === beforeId) : -1
  if (to < 0) to = arr.length
  arr.splice(to, 0, obj)
}

/** Prepara el movimiento sin alterar el árbol ni emitir avisos. */
function prepareReparent(id, newParentId, beforeId, preserveWorld) {
  const obj = getObject(id)
  if (!obj || obj.sceneInstanceOwner || (newParentId && (getObject(newParentId)?.sceneInstanceOwner || getObject(newParentId)?.type === 'sceneInstance'))) return null
  const np = newParentId || null
  if (obj.type === 'terrain' && np !== (obj.parentId || null)) throw new Error('Terreno solo admite ordenación entre nodos raíz')
  let check = obj
  while (check) {
    if (check.locked) throw new Error('Desbloquea el nodo o su padre para moverlo')
    check = check.parentId ? getObject(check.parentId) : null
  }
  if (np && getObject(np)?.locked) throw new Error('No puedes insertar nodos en un padre bloqueado')
  validateNodeParent(store.project.objects, id, np)
  if (beforeId && (beforeId === id || getObject(beforeId)?.parentId !== np)) throw new Error('El nodo de referencia debe ser un hermano distinto')
  const alignToAutomaticMeshParent = shouldAlignMeshSubtractToParent(obj, store.project.objects, np)
  if (preserveWorld && obj.type === 'node') {
    const before = worldMatrix(obj.parentId)
    const after = worldMatrix(np)
    if (before.elements.some((v, i) => Math.abs(v - after.elements[i]) > 1e-5)) throw new Error('Node no puede conservar su transformación mundial entre padres distintos; usa Node3D')
  }
  const patch = { parentId: np }
  if (alignToAutomaticMeshParent) patch.position = [0, 0, 0]
  else if (preserveWorld && obj.position && obj.rotation) {
    const temporary = { type: obj.type, position: [...obj.position], rotation: [...obj.rotation], scale: obj.scale ? [...obj.scale] : undefined }
    setLocalFromWorld(temporary, np, worldMatrix(id))
    patch.position = temporary.position
    patch.rotation = temporary.rotation
    if (['node3d', 'sceneInstance'].includes(obj.type)) patch.scale = temporary.scale
  }
  return { obj, patch, beforeId, alignToAutomaticMeshParent }
}

function applyReparent(plan, sync = true) {
  const { obj, patch, beforeId } = plan
  Object.assign(obj, patch)
  reorder(obj, beforeId)
  if (patch.parentId) { const p = getObject(patch.parentId); if (p) setTreeNodeOpen(p, true) }
  if (sync) syncReparent(obj.id)
}

function syncReparent(id) {
  store.editor.syncObject(id)
  for (const d of descendantsOf(id)) store.editor.syncObject(d.id)
}

/** Cambia el padre. El movimiento se valida antes de modificar el proyecto. */
export function reparent(id, newParentId, beforeId = null, { commit: doCommit = true, preserveWorld = true } = {}) {
  let plan
  try { plan = prepareReparent(id, newParentId, beforeId, preserveWorld) }
  catch (e) { toast(e.message, 'error'); return false }
  if (!plan) return false
  applyReparent(plan)
  if (doCommit) commit(`Mover ${plan.obj.name}`)
  return true
}

const collectionTypes = new Set(['node', 'node3d', 'group'])

function collectionPlans(ids, parentId) {
  const parent = getObject(parentId)
  if (!parent || !collectionTypes.has(parent.type) || !ids.length) return null
  for (let n = parent; n; n = n.parentId ? getObject(n.parentId) : null) {
    if (n.locked || n.sceneInstanceOwner || n.type === 'sceneInstance' || ids.includes(n.id)) return null
  }
  const selected = new Set(ids)
  const roots = store.project.objects.filter(o => selected.has(o.id))
  if (roots.length !== selected.size) return null
  const plans = []
  for (const obj of roots) {
    if (obj.type === 'terrain' || obj.sceneInstanceOwner) return null
    for (let n = obj; n; n = n.parentId ? getObject(n.parentId) : null) {
      if (n.locked || n.sceneInstanceOwner || (n !== obj && selected.has(n.id))) return null
    }
    if (obj.parentId === parentId) continue
    const plan = prepareReparent(obj.id, parentId, null, true)
    // El alineamiento automático de un cortador no garantiza conservar su mundo.
    if (!plan || plan.alignToAutomaticMeshParent) return null
    plans.push(plan)
  }
  if (!plans.length) return null
  const patches = new Map(plans.map(p => [p.obj.id, p.patch]))
  validateNodeTree(store.project.objects.map(o => patches.has(o.id) ? { ...o, ...patches.get(o.id) } : o))
  return plans
}

export function collectionGroupTargets(ids) {
  if (!store.project || !ids.length) return []
  return store.project.objects.filter(o => {
    if (!collectionTypes.has(o.type)) return false
    try { return !!collectionPlans(ids, o.id) } catch { return false }
  })
}

/** Una selección completa se valida antes de aplicar y registrar el cambio. */
export function moveToCollectionGroup(ids, parentId) {
  let plans
  try { plans = collectionPlans(ids, parentId) }
  catch (e) { toast(e.message, 'error'); return false }
  if (!plans) return false
  for (const plan of plans) applyReparent(plan, false)
  for (const plan of plans) syncReparent(plan.obj.id)
  commit(plans.length === 1 ? `Mover ${plans[0].obj.name}` : 'Mover nodos')
  return true
}

/** Raíces de la selección: descarta los nodos cuyo ancestro también está seleccionado. */
export function selectionRoots() {
  const set = new Set(store.selectedIds)
  return store.selectedIds.filter((id) => {
    let o = getObject(id)
    while (o && o.parentId) { if (set.has(o.parentId)) return false; o = getObject(o.parentId) }
    return true
  })
}
