// Árbol de nodos: reparentar, agrupar, desagrupar
import * as THREE from 'three'
import { uid } from '../../engine/runtime/util.js'
import { makeObject } from '../../engine/runtime/nodes/index.js'
import { store, toast, filmBlocked } from './state.js'
import { commit } from './history.js'
import { removeObject, selectObject, uniqueName } from './objects.js'
import { getObject, childrenOf, worldPosition, reparent, selectionRoots, setLocalFromWorld } from './tree.js'

// =====================================================================
//  ÁRBOL DE NODOS
// =====================================================================
/** Ctrl+P: las demás selecciones pasan a ser hijas del nodo activo (el último seleccionado), conservando su posición en el mundo. */
export function parentSelectionToActive() {
  const active = getObject(store.selectedId)
  const roots = selectionRoots().filter((id) => id !== store.selectedId)
  if (!active || !roots.length) { toast('Selecciona los hijos y, al final, el padre', 'info'); return }
  let n = 0
  for (const id of roots) if (reparent(id, active.id, null, { commit: false })) n++
  if (n) { commit(`Emparentar ${n} nodo(s) a ${active.name}`); toast(`${n} nodo(s) ahora dentro de «${active.name}»`, 'ok') }
}

/** Alt+P: sube la selección `levels` niveles en el árbol (Infinity = a la raíz) sin mover nada en el mundo. */
export function unparentSelection(levels = 1) {
  let n = 0
  for (const id of selectionRoots()) {
    let target = getObject(id)?.parentId || null
    if (!target) continue
    for (let i = 1; i < levels && target; i++) target = getObject(target)?.parentId || null
    if (reparent(id, target, null, { commit: false })) n++
  }
  if (n) commit(`Sacar ${n} nodo(s) del padre`)
}

export function groupSelected() {
  if (store.filmMode) return filmBlocked()
  const roots = selectionRoots().map(getObject).filter(Boolean)
  if (!roots.length) return
  if (roots.some((o) => o.type === 'node')) {
    toast('Para agrupar con transformación utiliza Node3D, no Node', 'error')
    return
  }
  const first = roots[0]
  const c = new THREE.Vector3()
  for (const r of roots) c.add(worldPosition(r.id))
  c.divideScalar(roots.length)
  const g = makeObject('group', 'group', { id: uid(), parentId: first.parentId || null })
  g.name = uniqueName('Grupo')
  const world = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z)
  setLocalFromWorld(g, g.parentId, world)
  const arr = store.project.objects
  arr.splice(arr.indexOf(first), 0, g)
  store.editor.syncObject(g.id)
  for (const r of roots) reparent(r.id, g.id, null, { commit: false })
  selectObject(g.id)
  commit(`Agrupar ${roots.length} nodo(s)`)
}

export function ungroup(id) {
  if (store.filmMode) return filmBlocked()
  const g = getObject(id)
  if (!g) return
  const kids = childrenOf(id)
  for (const k of kids) reparent(k.id, g.parentId || null, g.id, { commit: false })
  removeObject(id, { commit: false })
  store.selectedIds = kids.map((k) => k.id)
  store.selectedId = kids.at(-1)?.id ?? null
  store.editor.setSelection(store.selectedId, store.selectedIds)
  commit(`Desagrupar ${g.name}`)
}
