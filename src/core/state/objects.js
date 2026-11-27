// Objetos de la escena: altas, bajas, duplicados y sprites
import { finiteTuple } from '../../engine/runtime/numeric-integrity.js'
import * as db from '../db.js'
import * as THREE from 'three'
import { uid } from '../../engine/runtime/util.js'
import { analyzeScriptEditables, validEditableValue } from '../../engine/runtime/scene/script-editables.js'
import { PRIMITIVES } from '../../engine/runtime/geometry/primitives.js'
import { makeObject, getDef } from '../../engine/runtime/nodes/index.js'
import { validateNodeTree } from '../../engine/runtime/nodes/hierarchy.js'
import { addFolderChain, uniqueFileName, extOf, sanitizeName, remapSignalConnections } from '../project.js'
import { hooks } from './hooks.js'
import { store, setTreeNodeOpen, treeNodeOpen, filmBlocked, toast } from './state.js'
import { markDirty, commit } from './history.js'
import { dropUrl } from './assets.js'
import { getObject, childrenOf, descendantsOf, selectionRoots, worldMatrix, setLocalFromWorld } from './tree.js'
import { MIME, urlCache } from './files.js'
import { makeCanvas } from '../../engine/runtime/platform.js'
import { meshDataOf, linkMesh, unlinkMesh } from '../../engine/runtime/mesh/shared-mesh.js'
import { hasBoxFitGeometry, fitCollisionBoxFromScene } from '../../engine/runtime/physics/box-fit-editor.js'
import { isTriMeshSource, remapTriMeshSourceIds } from '../../engine/runtime/physics/trimesh-source.js'
import { remapMeshSubtractSourceIds, shouldAlignMeshSubtractToParent } from '../../engine/runtime/mesh/mesh-subtract-source.js'

// Portapapeles interno del Editor. No interviene en el portapapeles del sistema operativo.
let sceneClipboard = null

// ---------- altas, bajas y duplicados ----------
export function uniqueName(base) {
  const names = new Set(store.project.objects.map((o) => o.name))
  if (!names.has(base)) return base
  let i = 2
  while (names.has(`${base} ${i}`)) i++
  return `${base} ${i}`
}

/** Padre de los nodos nuevos: dentro del grupo seleccionado; junto al seleccionado si no es grupo; o la raíz. */
export function addTargetParent() {
  const sel = getObject(store.selectedId)
  if (!sel) return null
  if (['group', 'node', 'node3d', 'sceneInstance'].includes(sel.type) || store.prefs.addAsChild) return sel.id
  return sel.parentId || null
}

export function addObject(partial, { select = true, label, parentId = null } = {}) {
  if (store.filmMode) return filmBlocked()
  if (partial?.type === 'terrain') { toast('Usa Naturaleza → Terreno para crear la pieza física', 'error'); return null }
  if (parentId && ['sceneInstance'].includes(getObject(parentId)?.type) || getObject(parentId)?.sceneInstanceOwner) {
    toast('Edita la escena fuente para agregar hijos vinculados', 'warn'); return null
  }
  const obj = makeObject(partial.type, partial.kind, partial)
  obj.id = uid()
  if (["position", "rotation", "scale"].some(key => obj[key] != null && !finiteTuple(obj[key], 3))) { toast("Transformación inválida del nodo nuevo", "error"); return null }
  if (obj.type === 'sprite2d' || obj.type === 'sprite3d') parentId = prepareSprite(obj, parentId)
  obj.parentId = parentId
  if (shouldAlignMeshSubtractToParent(obj, store.project.objects, parentId)) obj.position = [0, 0, 0]
  // Solo las cajas NUEVAS con geometría propia del cuerpo inician el autoajuste.
  // Ausencia de autoFit en proyectos anteriores significa control manual.
  if (obj.type === 'collisionshape3d' && obj.props?.shape?.type === 'BoxShape3D' &&
      obj.props.shape.autoFit === undefined && hasBoxFitGeometry(store.project.objects, obj)) {
    obj.props.shape.autoFit = true
  }
  obj.name = uniqueName(partial.name || obj.name || getDef(obj.type)?.label || 'Nodo')
  try { validateNodeTree([...store.project.objects, obj]) }
  catch (e) { toast(e.message, 'error'); return null }
  store.project.objects.push(obj)
  if (parentId) { const p = getObject(parentId); if (p) setTreeNodeOpen(p, true) }
  store.editor.syncObject(obj.id)
  if (select) selectObject(obj.id)
  commit(label || `Añadir ${obj.name}`)
  return obj
}

// ---------- sprites ----------
/**
 * Al añadir un sprite: un «Lienzo de píxeles» recibe una imagen PNG en blanco (Assets/Textures) y un Sprite 2D vive dentro de un
 * Canvas (el elegido, el padre que ya tenga o, si no hay ninguno, uno nuevo: como Unity con una Image). Devuelve el padre.
 */
function prepareSprite(obj, parentId) {
  const p = obj.props || (obj.props = {})
  if (p.newCanvas && !p.image) {
    const w = Math.max(1, Math.min(2048, Math.round(+p.paintW || 64))), h = Math.max(1, Math.min(2048, Math.round(+p.paintH || 64)))
    p.image = newBlankImage(`${obj.name || 'Lienzo'}.png`, w, h)
  }
  delete p.newCanvas
  if (obj.type !== 'sprite2d') return parentId
  const isCanvas = (id) => getObject(id)?.type === 'canvas'
  if (parentId && isCanvas(parentId)) return parentId
  const sel = getObject(store.selectedId)
  let cv = sel?.type === 'canvas' ? sel : sel?.parentId && isCanvas(sel.parentId) ? getObject(sel.parentId) : null
  if (!cv) {
    cv = makeObject('canvas', 'ui')
    cv.id = uid(); cv.name = uniqueName('Canvas'); cv.parentId = parentId || null
    cv.position = obj.position ? [...obj.position] : [0, 0, 0]
    store.project.objects.push(cv)
    store.editor?.syncObject(cv.id)
  }
  // en el centro de la pantalla del Canvas (su origen está en el centro del borde inferior)
  const refH = +cv.props?.refH || 1080
  obj.position = [0, +(refH / 2 / 50).toFixed(3), 0.02]
  obj.rotation = [0, 0, 0]
  return cv.id
}

/** Crea una imagen PNG transparente de w×h en Assets/Textures y devuelve su id (se puede usar al momento). */
export function newBlankImage(name, w, h, folder = 'Assets/Textures') {
  const c = makeCanvas(); c.width = w; c.height = h
  const bytes = dataUrlBytes(c.toDataURL('image/png'))
  const p = store.project
  const id = uid('a')
  const fname = uniqueFileName(p, folder, sanitizeName(name, 'Lienzo.png'))
  p.assets.push({ id, name: fname, folder, kind: 'texture', ext: 'png', bytes: bytes.byteLength })
  addFolderChain(p, folder)
  urlCache.set(id, URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))) // disponible antes de que termine de guardarse
  void db.putAsset(p.id, id, fname, bytes)
  return id
}
const dataUrlBytes = (u) => { const b = atob(u.slice(u.indexOf(',') + 1)); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a }

/** Sustituye los bytes de una imagen del proyecto (lo pintado en un sprite) y avisa a todo lo que la usa. */
export async function replaceImageBytes(id, bytes) {
  const a = store.project.assets.find((x) => x.id === id)
  if (!a) return false
  await db.putAsset(store.project.id, id, a.name, bytes)
  a.bytes = bytes.byteLength
  dropUrl(id)
  urlCache.set(id, URL.createObjectURL(new Blob([bytes], { type: MIME[extOf(a.name)] || 'image/png' })))
  store.assetRev = (store.assetRev || 0) + 1
  store.editor?.forgetSpriteTexture(id)
  store.editor?.forgetRoadTexture(id)
  markDirty()
  return true
}

export function enforceLink(obj, oldScale) {
  const link = obj.type === 'primitive' ? PRIMITIVES[obj.kind]?.link : null
  if (!link || !oldScale) return
  const s = obj.scale
  if (link === 'xz') {
    if (s[0] !== oldScale[0]) s[2] = s[0]
    else if (s[2] !== oldScale[2]) s[0] = s[2]
  } else if (link === 'xyz') {
    const changed = [0, 1, 2].find((i) => s[i] !== oldScale[i])
    if (changed !== undefined) s[0] = s[1] = s[2] = s[changed]
  }
}

/** Orden único de autoría; scriptId antiguo solo se lee hasta que la escena migra. */
export function authoredNodeScriptIds(obj) {
  return Array.isArray(obj?.scriptIds) ? obj.scriptIds : obj?.scriptId ? [obj.scriptId] : []
}

/** Aplica una operación del Inspector/Jerarquía con un solo punto de historial. */
export function setNodeScriptIds(nodeId, ids, label = 'Editar Scripts de Nodo') {
  const obj = getObject(nodeId)
  if (!obj || obj.sceneInstanceOwner || !Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id.trim() || id !== id.trim()) ||
      new Set(ids).size !== ids.length) return false
  if (JSON.stringify(authoredNodeScriptIds(obj)) === JSON.stringify(ids)) return false
  // Nunca dejar dos fuentes editoriales después de la primera modificación.
  delete obj.scriptId
  return updateObject(nodeId, { scriptIds: ids }, { label }) !== false
}

export function addNodeScript(nodeId, scriptId) {
  const obj = getObject(nodeId)
  const script = store.project?.scripts?.find((s) => s.id === scriptId)
  if (!obj || !script || script.execution !== 'node') { toast('Selecciona un Script de Nodo válido', 'error'); return false }
  const ids = authoredNodeScriptIds(obj)
  if (ids.includes(scriptId)) { toast('El script ya pertenece a este nodo', 'error'); return false }
  return setNodeScriptIds(nodeId, [...ids, scriptId], 'Agregar Script de Nodo')
}

export function removeNodeScript(nodeId, scriptId) {
  const obj = getObject(nodeId)
  const ids = authoredNodeScriptIds(obj)
  if (!ids.includes(scriptId)) return false
  return setNodeScriptIds(nodeId, ids.filter((id) => id !== scriptId), 'Quitar Script de Nodo')
}

export function setNodeScriptEditableField(nodeId, scriptId, name, value) {
  const node = getObject(nodeId)
  const script = store.project?.scripts?.find(item => item.id === scriptId && item.execution === 'node')
  if (!node || !script || node.sceneInstanceOwner || store.locked || store.play?.on || !authoredNodeScriptIds(node).includes(scriptId)) return false
  const analysis = analyzeScriptEditables(script.code)
  if (analysis.diagnostics.length) return false
  const field = analysis.fields.find(item => item.name === name)
  if (!field || !validEditableValue(value, field.type)) return false
  const existing = node.scriptProperties?.[scriptId]
  if ((existing && Object.hasOwn(existing, name) && Object.is(existing[name], value)) ||
      ((!existing || !Object.hasOwn(existing, name)) && Object.is(field.defaultValue, value))) return false
  const next = { ...(node.scriptProperties || {}), [scriptId]: { ...(existing || {}), [name]: value } }
  return updateObject(nodeId, { scriptProperties: next }, { label: `Editar ${name}` })
}

export function moveNodeScript(nodeId, from, to) {
  const ids = authoredNodeScriptIds(getObject(nodeId))
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= ids.length ||
      to < 0 || to >= ids.length || from === to) return false
  const next = [...ids]
  next.splice(to, 0, next.splice(from, 1)[0])
  return setNodeScriptIds(nodeId, next, 'Ordenar Scripts de Nodo')
}

/** Mezcla `patch` en el objeto. Los objetos anidados (light, props) se fusionan un nivel. */
export function updateObject(id, patch, { commit: doCommit = true, label } = {}) {
  const obj = getObject(id)
  if (!obj || obj.sceneInstanceOwner) return false
  for (const key of ['position', 'rotation', 'scale']) if (key in patch && !finiteTuple(patch[key], 3)) {
    toast(`Transformación inválida: ${obj.name} (${id}).${key}`, 'error'); return false
  }
  if (obj.type === 'node' && ['position', 'rotation', 'scale'].some((key) => key in patch)) {
    toast('Node no tiene Transform; utiliza Node3D', 'error')
    return false
  }
  if ((['collisionshape3d', 'staticbody3d', 'rigidbody3d', 'characterbody3d', 'area3d'].includes(obj.type) && ('scale' in patch || 'props' in patch)) ||
      (['node3d', 'sceneInstance'].includes(obj.type) && 'scale' in patch && descendantsOf(id).some((d) => ['collisionshape3d', 'staticbody3d', 'rigidbody3d', 'characterbody3d', 'area3d'].includes(d.type)))) {
    const next = { ...obj, ...patch, props: { ...obj.props, ...(patch.props || {}) } }
    try { validateNodeTree(store.project.objects.map((n) => n.id === id ? next : n)) }
    catch (e) { toast(e.message, 'error'); return false }
  }
  // Mover manualmente una forma ajustada deshabilita el seguimiento, sin perder la forma.
  if (obj.type === 'collisionshape3d' && obj.props?.shape?.type === 'BoxShape3D' &&
      obj.props.shape.autoFit === true && patch.props?.shape?.autoFit !== true && ('position' in patch ||
      (patch.props?.shape && patch.props.shape.size && JSON.stringify(patch.props.shape.size) !== JSON.stringify(obj.props.shape.size)))) {
    patch = { ...patch, props: { ...patch.props, shape: { ...obj.props.shape, ...(patch.props?.shape || {}), autoFit: false } } }
  }
  const oldScale = obj.scale ? [...obj.scale] : null
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && obj[k] && typeof obj[k] === 'object') Object.assign(obj[k], v)
    else obj[k] = Array.isArray(v) ? [...v] : v
  }
  if (patch.scale) enforceLink(obj, oldScale)
  store.editor.syncObject(id)
  if (doCommit) commit(label || `Editar ${obj.name}`)
  return true
}


/** Congela una selección para escalar desde el estado inicial, también durante la vista previa. */
export function beginUniformScale(ids = selectionRoots()) {
  const selected = new Set(ids)
  const roots = ids.filter((id) => {
    let parent = getObject(id)?.parentId
    while (parent) { if (selected.has(parent)) return false; parent = getObject(parent)?.parentId }
    return true
  })
  const entries = roots.map((id) => getObject(id))
  if (!entries.length || entries.some((obj) => {
    if (!obj || !getDef(obj.type)?.scalable || !Array.isArray(obj.scale) || obj.scale.length !== 3) return true
    let current = obj
    while (current) { if (current.locked) return true; current = getObject(current.parentId) }
    return false
  })) return null
  const points = entries.map((obj) => new THREE.Vector3().setFromMatrixPosition(worldMatrix(obj.id)))
  const center = new THREE.Vector3()
  for (const point of points) center.add(point)
  center.multiplyScalar(1 / points.length)
  return { entries: entries.map((obj, i) => ({ id: obj.id, parentId: obj.parentId, position: [...obj.position], scale: [...obj.scale], worldPosition: points[i].clone() })), center, factor: 1 }
}

/** Preview atómica; no altera el historial hasta que se confirme. */
export function applyUniformScale(draft, factor) {
  if (!draft?.entries?.length || !Number.isFinite(factor) || factor <= 0) return false
  if (factor === draft.factor) return true
  const patches = []
  try {
    for (const base of draft.entries) {
      const obj = getObject(base.id)
      if (!obj || obj.parentId !== base.parentId || obj.locked || !getDef(obj.type)?.scalable) return false
      const scale = base.scale.map((v) => v * factor)
      if (scale.some((v) => !Number.isFinite(v) || v < 0.01 || v > 1e6)) return false
      let position = base.position
      if (draft.entries.length > 1) {
        const world = base.worldPosition.clone().sub(draft.center).multiplyScalar(factor).add(draft.center)
        const parent = worldMatrix(base.parentId)
        if (Math.abs(parent.determinant()) < 1e-10) return false
        position = world.applyMatrix4(parent.invert()).toArray()
        if (position.some((v) => !Number.isFinite(v))) return false
      }
      const candidate = { ...obj, position, scale: [...scale] }
      enforceLink(candidate, base.scale)
      patches.push({ id: base.id, patch: { position: [...position], scale: [...candidate.scale] } })
    }
    // Comprobar toda la jerarquía antes de modificar el primer objeto.
    const byId = new Map(patches.map((p) => [p.id, p.patch]))
    validateNodeTree(store.project.objects.map((o) => byId.has(o.id) ? { ...o, ...byId.get(o.id) } : o))
  } catch (error) { toast(error.message, 'error'); return false }
  for (const { id, patch } of patches) updateObject(id, patch, { commit: false })
  draft.factor = factor
  return true
}

/** El historial guarda el resultado confirmado una sola vez. */
export function finishUniformScale(draft) {
  if (!draft?.entries?.length || draft.factor === 1) return false
  const changed = draft.entries.some((base) => {
    const obj = getObject(base.id)
    return obj && [...base.scale.map((v, i) => v - obj.scale[i]), ...base.position.map((v, i) => v - obj.position[i])].some((v) => Math.abs(v) > 1e-9)
  })
  if (changed) commit(draft.entries.length === 1 ? 'Escalar nodo uniformemente' : `Escalar ${draft.entries.length} nodos uniformemente`)
  return changed
}

/** Cancelar no registra historial ni deja una escala previa en la escena. */
export function cancelUniformScale(draft) {
  if (!draft?.entries) return
  for (const base of draft.entries) {
    if (getObject(base.id)) updateObject(base.id, { position: base.position, scale: base.scale }, { commit: false })
  }
}

/** Acción manual del Inspector. Se registra en un único punto de Undo/Redo.
 * No transforma ni reescala el nodo fuente y no habilita seguimiento por sí sola. */
export function fitBoxShapeNow(id) {
  const obj = getObject(id)
  if (!obj || obj.type !== 'collisionshape3d' || obj.props?.shape?.type !== 'BoxShape3D') return false
  try {
    const result = fitCollisionBoxFromScene(store.project.objects, store.editor?.nodes || new Map(), id)
    if (!result) { toast('BoxShape3D: no se encontró geometría válida en el cuerpo físico', 'error'); return false }
    updateObject(id, {position:result.position, props:{shape:{...obj.props.shape,size:result.size, autoFit:obj.props.shape.autoFit===true}}}, {label:'Ajustar BoxShape3D a geometría'})
    return true
  } catch (e) { toast('Autoajuste BoxShape3D: '+e.message, 'error'); return false }
}

export function renameObject(id, name) {
  const obj = getObject(id)
  const n = (name || '').trim()
  if (!obj || obj.sceneInstanceOwner || !n || n === obj.name) return
  obj.name = n
  commit(`Renombrar ${n}`)
}

export function toggleOpen(id) {
  const o = getObject(id)
  if (o) setTreeNodeOpen(o, !treeNodeOpen(o))
}

function planNodeRemoval(ids) {
  const doomed = new Set()
  for (const id of ids) {
    const obj = getObject(id)
    if (!obj || obj.sceneInstanceOwner || obj.type === 'terrain') continue
    doomed.add(id)
    for (const child of descendantsOf(id)) doomed.add(child.id)
  }
  if (!doomed.size) return null
  const remaining = store.project.objects.filter((obj) => !doomed.has(obj.id))
  const blocker = remaining.find((obj) => obj.type === 'collisionshape3d' &&
    obj.props?.shape?.type === 'TriMeshShape3D' && doomed.has(obj.props.shape.sourceId))
  if (blocker) {
    toast(`No se puede eliminar: «${blocker.name || 'TriMeshShape3D'}» utiliza una malla de esa selección. Cambia la referencia o elimina ambos nodos.`, 'error')
    return null
  }
  try { validateNodeTree(remaining) }
  catch (error) { toast(error.message, 'error'); return null }
  return { doomed, remaining }
}

export function canRemoveObjects(ids) {
  return !!planNodeRemoval(ids)
}

function removeObjects(ids, { commit: doCommit = true, label } = {}) {
  const plan = planNodeRemoval(ids)
  if (!plan) return false
  const { doomed, remaining } = plan
  store.project.objects = remaining
  store.project.signalConnections = (store.project.signalConnections || []).filter((c) => !doomed.has(c.emitterId) && !doomed.has(c.receiverId))
  for (const id of doomed) store.editor.removeObject(id)
  store.selectedIds = store.selectedIds.filter((id) => !doomed.has(id))
  if (doomed.has(store.selectedId)) store.selectedId = store.selectedIds.at(-1) ?? null
  store.editor.setSelection(store.selectedId, store.selectedIds)
  if (doCommit) commit(label || 'Eliminar nodos')
  return true
}

export function removeObject(id, { commit: doCommit = true } = {}) {
  if (store.filmMode) return filmBlocked()
  const obj = getObject(id)
  if (!obj || obj.sceneInstanceOwner) return false
  if (obj.type === 'terrain') return hooks.removeTerrain()
  return removeObjects([id], { commit: doCommit, label: `Eliminar ${obj.name}` })
}

export function removeRoadPoint() {
  const o = getObject(store.selectedId)
  if (!o || !(o.type === 'road' || (o.type === 'water' && o.props.shape === 'river')) || store.roadPoint == null || o.props.points.length <= 2) return false
  const rm = store.roadPoint
  const pts = o.props.points.filter((_, i) => i !== rm)
  const patch = { points: pts }
  if (Array.isArray(o.props.pw)) patch.pw = o.props.pw.filter((_, i) => i !== rm)
  store.roadPoint = Math.min(rm, pts.length - 1)
  updateObject(o.id, { props: patch }, { label: 'Quitar punto de carretera' })
  return true
}

export function removeSelected() {
  if (store.filmMode) return filmBlocked()
  if (store.terrainSel || getObject(store.selectedId)?.type === 'terrain') return hooks.removeTerrain()
  if (store.roadPoint != null && removeRoadPoint()) return true
  const roots = selectionRoots()
  if (!roots.length) return false
  const name = getObject(roots[0])?.name
  return removeObjects(roots, { label: roots.length > 1 ? `Eliminar ${roots.length} nodos` : `Eliminar ${name}` })
}

function cloneSubtree(id, newParentId, offset, linked = false, idMap = new Map()) {
  const src = getObject(id)
  const copy = JSON.parse(JSON.stringify(src))
  // Ctrl+D siempre es independiente; Alt+D comparte solo los datos de malla.
  if (copy.type === 'mesh' && !linked && copy.props?.meshRef) unlinkMesh(store.project, copy)
  copy.id = uid()
  idMap.set(src.id, copy.id)
  copy.parentId = newParentId
  if (offset && src.position) copy.position = translatedLocalPosition(src, offset)
  copy.name = uniqueName(src.name.replace(/ \d+$/, ''))
  store.project.objects.push(copy)
  for (const c of childrenOf(id).filter((o) => o.id !== copy.id && !o.sceneInstanceOwner)) cloneSubtree(c.id, copy.id, null, linked, idMap)
  return copy
}

/** Convierte un vector mundial al espacio del padre sin descomponer el Transform. */
function translatedLocalPosition(src, offset) {
  let local = offset
  if (src.parentId) {
    const parent = worldMatrix(src.parentId)
    if (Math.abs(parent.determinant()) < 1e-10) throw new Error('Transform del padre no invertible')
    const m = parent.invert().elements
    local = [0, 1, 2].map(i => m[i] * offset[0] + m[i + 4] * offset[1] + m[i + 8] * offset[2])
  }
  const position = src.position.map((v, i) => v + local[i])
  if (!position.every(Number.isFinite)) throw new Error('Transform local inválido')
  return position
}

export function duplicateSelected() {
  if (store.filmMode) return filmBlocked()
  const roots = selectionRoots()
  if (!roots.length || roots.some(id => getObject(id)?.sceneInstanceOwner)) return false
  const originalCount = store.project.objects.length
  const ids = new Map()
  let made
  try {
    const offset = store.editor?.duplicateWorldOffset?.()
    if (!offset) return false
    made = roots.map((id) => cloneSubtree(id, getObject(id).parentId || null, offset, false, ids))
    const copies = store.project.objects.slice(originalCount)
    remapTriMeshSourceIds(copies, ids)
    remapMeshSubtractSourceIds(copies, ids)
    validateNodeTree(store.project.objects)
  } catch (error) {
    store.project.objects.splice(originalCount)
    toast(error.message, 'error')
    return false
  }
  store.project.signalConnections ||= []
  if (store.project.signalConnections.length) store.project.signalConnections.push(...remapSignalConnections(store.project.signalConnections, ids))
  store.editor.syncAll()
  store.selectedIds = made.map((m) => m.id)
  store.selectedId = made.at(-1).id
  store.editor.setSelection(store.selectedId, store.selectedIds)
  commit(roots.length > 1 ? `Duplicar ${roots.length} nodos` : `Duplicar ${made[0].name}`)
  return true
}
export const duplicateObject = (id) => { selectObject(id); duplicateSelected() }

/** Alt+D: crea objetos distintos que comparten exclusivamente la geometría. */
export function linkedDuplicateSelected() {
  if (store.filmMode || store.play?.on || store.editor?.edit) return false
  const roots = selectionRoots()
  if (!roots.length || roots.some(id => getObject(id)?.sceneInstanceOwner)) return false
  const offset = store.editor?.duplicateWorldOffset?.()
  if (!offset) return false
  const sources = roots.flatMap((id) => [getObject(id), ...descendantsOf(id).filter(o => !o.sceneInstanceOwner)])
  const eligible = sources.filter((o) => o?.type === 'mesh' || o?.type === 'primitive')
  if (!eligible.length) return false
  // Validar ANTES de modificar; si una primitiva no se puede convertir no se crea un vínculo parcial.
  if (eligible.some((o) => o.type === 'mesh' && !meshDataOf(o, store.project.meshes))) return false
  if (eligible.some((o) => o.type === 'primitive' && !store.editor?._convertToMesh)) return false
  // Si falla la conversión de alguna primitiva, se restaura todo el grupo sin dejar medios vínculos.
  const before = eligible.map((o) => ({ id: o.id, value: JSON.parse(JSON.stringify(o)) }))
  const existingIds = new Set(store.project.objects.map((o) => o.id))
  const meshCount = store.project.meshes?.length || 0
  const oldSelection = [...store.selectedIds], oldActive = store.selectedId
  const originalConnections = JSON.parse(JSON.stringify(store.project.signalConnections || []))
  try {
    for (const obj of eligible) {
      if (obj.type === 'primitive') store.editor._convertToMesh(obj)
      if (!linkMesh(store.project, obj, uid('mesh'))) throw new Error('Geometría inválida')
    }
    const ids = new Map()
    const made = roots.map((id) => cloneSubtree(id, getObject(id).parentId || null, offset, true, ids))
    const copyIds = new Set(ids.values())
    remapTriMeshSourceIds(store.project.objects.filter((node) => copyIds.has(node.id)), ids)
    remapMeshSubtractSourceIds(store.project.objects.filter((node) => copyIds.has(node.id)), ids)
    validateNodeTree(store.project.objects)
    store.project.signalConnections ||= []
    if (store.project.signalConnections.length) store.project.signalConnections.push(...remapSignalConnections(store.project.signalConnections, ids))
    store.editor.syncAll()
    store.selectedIds = made.map((o) => o.id)
    store.selectedId = made.at(-1).id
    store.editor.setSelection(store.selectedId, store.selectedIds)
    commit(roots.length === 1 ? 'Duplicar malla vinculada' : `Duplicar ${roots.length} nodos vinculados`)
    return made
  } catch (error) {
    store.project.objects = store.project.objects.filter((o) => existingIds.has(o.id))
    for (const { id, value } of before) {
      const obj = getObject(id)
      if (!obj) continue
      for (const key of Object.keys(obj)) if (!(key in value)) delete obj[key]
      Object.assign(obj, value)
    }
    if (store.project.meshes) store.project.meshes.length = meshCount
    store.project.signalConnections = originalConnections
    store.selectedIds = oldSelection; store.selectedId = oldActive
    store.editor.syncAll()
    store.editor.setSelection(store.selectedId, store.selectedIds)
    toast(`No se pudo crear la instancia vinculada: ${error.message}`, 'error')
    return false
  }
}

/** El objeto elegido deja de compartir la malla. No elimina el recurso de los demás. */
export function makeMeshIndependent() {
  if (store.filmMode || store.play?.on || store.editor?.edit) return false
  const selected = store.selectedIds.map(getObject).filter((o) => o?.type === 'mesh' && o.props?.meshRef)
  if (!selected.length || selected.some((o) => !meshDataOf(o, store.project.meshes))) return false
  for (const o of selected) unlinkMesh(store.project, o)
  store.editor.syncAll()
  commit(selected.length === 1 ? 'Hacer malla independiente' : `Hacer ${selected.length} mallas independientes`)
  return true
}

/** Guarda instantáneas independientes de las raíces elegidas y sus hijos; no modifica la escena. */
export function copySelected() {
  if (!store.project || store.filmMode || store.editor?.edit) return false
  const roots = selectionRoots().filter((id) => getObject(id) && !getObject(id).sceneInstanceOwner)
  if (!roots.length) return false
  const objects = []
  const snapshots = []
  for (const id of roots) {
    const src = getObject(id)
    const subtree = [src, ...descendantsOf(id).filter(o => !o.sceneInstanceOwner)]
    objects.push(...subtree.map((o) => {
      const snap = JSON.parse(JSON.stringify(o))
      if (snap.type === 'mesh' && snap.props?.meshRef) unlinkMesh(store.project, snap)
      return snap
    }))
    snapshots.push({ id, parentId: src.parentId || null, world: worldMatrix(id).toArray() })
  }
  const center = [0, 0, 0]
  for (const root of snapshots) {
    center[0] += root.world[12]; center[1] += root.world[13]; center[2] += root.world[14]
  }
  for (let i = 0; i < 3; i++) center[i] /= snapshots.length
  const included = new Set(objects.map((o) => o.id))
  const signalConnections = (store.project.signalConnections || []).filter((c) => included.has(c.emitterId) && included.has(c.receiverId))
  sceneClipboard = { projectId: store.project.id, objects, roots: snapshots, center, signalConnections: JSON.parse(JSON.stringify(signalConnections)) }
  return true
}

/** Solo se pega dentro del proyecto que posee las referencias a modelos, materiales y Assets. */
export function canPasteSelected() {
  return !!(sceneClipboard?.objects.length && store.project?.id === sceneClipboard.projectId && !store.filmMode && !store.play?.on && store.editor && !store.editor.edit)
}

/** Copia independiente: IDs nuevos para nodos, mismos IDs para recursos compartidos. */
export function pasteSelected(worldPoint = null) {
  if (!canPasteSelected()) return false
  const clip = sceneClipboard
  const target = Array.isArray(worldPoint) && worldPoint.length === 3 && worldPoint.every(Number.isFinite)
    ? worldPoint : clip.center
  const delta = target.map((v, i) => v - clip.center[i])
  const map = new Map(clip.objects.map((o) => [o.id, uid()]))
  const roots = new Map(clip.roots.map((r) => [r.id, r]))
  const made = clip.objects.map((src) => {
    const copy = JSON.parse(JSON.stringify(src))
    copy.id = map.get(src.id)
    if (map.has(src.parentId)) copy.parentId = map.get(src.parentId)
    else if (roots.has(src.id)) {
      // Conservar padre externo únicamente si continúa existiendo y no es una instancia de prefab.
      let parent = src.parentId ? getObject(src.parentId) : null
      let inPrefab = false
      for (let p = parent; p; p = p.parentId ? getObject(p.parentId) : null) {
        if (p.prefabId) { inPrefab = true; break }
      }
      copy.parentId = parent && !inPrefab ? parent.id : null
    } else copy.parentId = null
    // Referencias internas a nodos de la selección se redirigen; recursos/Assets no se remapean.
    if (copy.type === 'decal' && map.has(copy.props?.targetId)) copy.props.targetId = map.get(copy.props.targetId)
    if (copy.type === 'collisionshape3d') remapTriMeshSourceIds([copy], map)
    if (copy.type === 'meshSubtract') remapMeshSubtractSourceIds([copy], map)
    copy.name = uniqueName(copy.name)
    store.project.objects.push(copy)
    return copy
  })
  const parentsToOpen = new Set()
  try {
    for (const [oldId, root] of roots) {
      const copy = made.find((o) => o.id === map.get(oldId))
      if (!copy) continue
      const world = worldMatrixFromClipboard(root.world, delta)
      if (copy.type !== 'node') {
        const current = worldMatrix(copy.id)
        const sameBasis = [0, 1, 2, 4, 5, 6, 8, 9, 10].every(i => Math.abs(current.elements[i] - world.elements[i]) <= 1e-10)
        if (sameBasis) {
          const translation = [12, 13, 14].map(i => world.elements[i] - current.elements[i])
          copy.position = translatedLocalPosition(copy, translation)
        } else setLocalFromWorld(copy, copy.parentId, world)
      }
      if (copy.parentId) parentsToOpen.add(copy.parentId)
    }
    const byId = new Map(store.project.objects.map((node) => [node.id, node]))
    const invalid = made.find((node) => node.type === 'collisionshape3d' &&
      node.props?.shape?.type === 'TriMeshShape3D' && node.props.shape.sourceId &&
      !isTriMeshSource(byId, node, byId.get(node.props.shape.sourceId)))
    if (invalid) throw new Error('TriMeshShape3D: origen fuera de StaticBody3D o inexistente')
    store.project.signalConnections ||= []
    if (clip.signalConnections?.length) store.project.signalConnections.push(...remapSignalConnections(clip.signalConnections, map))
  } catch (error) {
    const newIds = new Set(map.values())
    store.project.objects = store.project.objects.filter((node) => !newIds.has(node.id))
    toast(error.message, 'error')
    return false
  }
  for (const parentId of parentsToOpen) {
    const parent = getObject(parentId)
    if (parent) setTreeNodeOpen(parent, true)
  }
  store.editor.syncAll()
  const selectedIds = clip.roots.map((r) => map.get(r.id))
  store.selectedIds = selectedIds
  store.selectedId = selectedIds.at(-1) || null
  store.editor.setSelection(store.selectedId, store.selectedIds)
  commit(selectedIds.length === 1 ? `Pegar ${getObject(selectedIds[0])?.name || 'nodo'}` : `Pegar ${selectedIds.length} nodos`)
  return made
}

/** Traslada una matriz mundial guardada; respeta la orientación de la raíz y su jerarquía. */
function worldMatrixFromClipboard(elements, delta) {
  const m = worldMatrix(null).fromArray(elements)
  m.elements[12] += delta[0]; m.elements[13] += delta[1]; m.elements[14] += delta[2]
  return m
}

/**
 * Selección. additive: añade al conjunto (Shift); toggle: alterna (Ctrl/Cmd).
 * range: lista de ids ya calculada (selección por rango en el árbol).
 */
export function selectObject(id, { additive = false, toggle = false, range = null } = {}) {
  if (id) id = getObject(id)?.sceneInstanceOwner || id
  if (range) range = [...new Set(range.map(key => getObject(key)?.sceneInstanceOwner || key))]
  store.chunkSelection = null
  const fromResource = !!(store.audioInspector || store.temporalSelection || store.projSel)
  store.audioInspector = null
  store.temporalSelection = null
  store.projSel = null
  if ((id || range?.length) && fromResource) store.prefs.rightTab = 'object'
  store.terrainSel = false
  store.sceneSel = false // solo selectScene() activa explícitamente el contexto de escena
  // Compatibilidad: preferencias antiguas usan una pestaña Terreno que ya no existe.
  if ((id || range?.length) && store.prefs.rightTab === 'terrain') store.prefs.rightTab = 'object'
  if (range) {
    store.selectedIds = [...range]
    store.selectedId = range.at(-1) ?? null
  } else if (!id) {
    store.selectedIds = []
    store.selectedId = null
  } else if (toggle) {
    if (store.selectedIds.includes(id)) {
      store.selectedIds = store.selectedIds.filter((s) => s !== id)
      store.selectedId = store.selectedIds.at(-1) ?? null
    } else {
      store.selectedIds = [...store.selectedIds, id]
      store.selectedId = id
    }
  } else if (additive) {
    if (!store.selectedIds.includes(id)) store.selectedIds = [...store.selectedIds, id]
    store.selectedId = id
  } else {
    store.selectedIds = [id]
    store.selectedId = id
  }
  const terrain = store.selectedIds.length === 1 && getObject(store.selectedId)?.type === 'terrain'
  store.terrainSel = !!terrain
  if (terrain) {
    store.activePieceId = store.selectedId
    store.editor?.setActivePiece(store.selectedId)
    // La pieza física utiliza su gizmo específico, no la transformación del nodo espejo.
    store.editor?.setSelection(null, [])
    store.editor?._syncTerrainGizmo?.()
  } else store.editor?.setSelection(store.selectedId, store.selectedIds)
}

/** Selecciona la escena abierta: quita la selección de nodos y el Inspector muestra los ajustes de la escena. */
export function selectScene() {
  selectObject(null)
  store.sceneSel = true
  store.prefs.rightTab = 'object'
  if (store.ui?.mode === 'desktop') store.prefs.rightOpen = true
}

export const isSelected = (id) => store.selectedIds.includes(id)


