// Recursos VFX compartidos: operaciones editoriales e historial.
import { uid } from '../../engine/runtime/util.js'
import { newVfxResource, validateVfxResource, VFX_EXT } from '../../engine/runtime/vfx/resource.js'
import { addFolderChain, normFolder, uniqueFileName } from '../project.js'
import { isSystemUiPath } from '../../engine/runtime/ui/system.js'
import { store } from './state.js'
import { commit, markDirty } from './history.js'

const pendingGestures = new WeakMap()
export const findVfx = (id) => store.project?.vfx?.find((v) => v.id === id) || null

export function createVfx(folder = 'Assets', name = 'Efecto.vfx') {
  if (!store.project || store.locked) return null
  const p = store.project
  const dest = normFolder(folder)
  if (isSystemUiPath(dest)) return null
  const file = uniqueFileName(p, dest, name.endsWith(VFX_EXT) ? name : name + VFX_EXT)
  let id
  do { id = uid('vfx') } while ((p.vfx || []).some((v) => v.id === id))
  const resource = newVfxResource(id, file, dest)
  p.vfx ||= []
  p.vfx.push(resource)
  addFolderChain(p, dest)
  commit('Crear recurso VFX')
  return resource
}

/** Valida ANTES de modificar; record=false permite un único Undo al finalizar un gesto. */
export function updateVfx(id, patch, { record = true } = {}) {
  const v = findVfx(id)
  if (!v || store.locked) return false
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('VFX: edición inválida')
  for (const k of ['id', 'name', 'folder', 'schemaVersion']) {
    if (Object.hasOwn(patch, k)) throw new Error(`VFX: cambiar «${k}» corresponde al CRUD de Assets`)
  }
  const merged = { ...v, ...patch }
  for (const k of ['emission', 'birth', 'movement', 'appearance', 'evolution']) {
    if (Object.hasOwn(patch, k)) {
      if (!patch[k] || typeof patch[k] !== 'object' || Array.isArray(patch[k])) throw new Error(`VFX: grupo «${k}» inválido`)
      merged[k] = { ...v[k], ...patch[k] }
    }
  }
  const valid = validateVfxResource(merged)
  const wasPending = pendingGestures.get(store.project)?.has(id) || false
  const changed = JSON.stringify(v) !== JSON.stringify(valid)
  if (!changed && !(record && wasPending)) return false
  if (changed) Object.assign(v, valid)
  if (record) {
    pendingGestures.get(store.project)?.delete(id)
    commit(`Editar recurso VFX ${v.name}`)
  } else {
    if (!pendingGestures.has(store.project)) pendingGestures.set(store.project, new Set())
    pendingGestures.get(store.project).add(id)
    markDirty()
  }
  return true
}

/** Confirma una edición continua aunque el último fotograma no cambie el valor. */
export function finishVfxEdit(id) {
  const pending = store.project && pendingGestures.get(store.project)
  if (!pending?.has(id) || !findVfx(id)) return false
  pending.delete(id)
  commit(`Editar recurso VFX ${findVfx(id).name}`)
  return true
}

/** Selecciona el recurso compartido para editarlo en el Inspector existente. */
export function openVfxEditor(id) {
  if (!findVfx(id) || store.locked || store.play.on) return false
  store.projSel = { kind: 'vfx', id }
  store.prefs.rightTab = 'object'
  if (store.ui?.mode === 'desktop') store.prefs.rightOpen = true
  else if (store.ui) store.ui.drawer = 'inspector'
  return true
}

export function closeVfxEditor() {
  if (store.projSel?.kind !== 'vfx') return
  finishVfxEdit(store.projSel.id)
  store.projSel = null
}
