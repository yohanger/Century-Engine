// Interfaces del juego (Assets/UI): crear, editar y borrar .ui.
import { uid } from '../../engine/runtime/util.js'
import { addFolderChain, uniqueFileName, normFolder } from '../project.js'
import { store, toast } from './state.js'
import { markDirty, commit } from './history.js'
import { UI_DESIGN_TEMPLATE, defaultUi } from '../../engine/runtime/ui/defaults.js'
import { normalizeTheme } from '../../engine/runtime/ui/theme.js'
import { newTimeline, sampleTimeline, normalizeTimeline } from '../timeline/model.js'
import { newClip, sampleClip, normalizeClip } from '../../engine/runtime/anim/model.js'
import { ROLE_BY_KEY } from '../../engine/runtime/ui/roles.js'
import { isSystemUi, isSystemUiPath, restoreSystemUiCode } from '../../engine/runtime/ui/system.js'

// ---------- interfaces del juego (Assets/UI) ----------

export function dropUi(id) {
  const p = store.project
  if (isSystemUi(p.uis.find((c) => c.id === id))) return false
  p.uis = p.uis.filter((c) => c.id !== id)
  const s = p.ui.slots
  s.hud = s.hud.filter((x) => x !== id)
  for (const k of Object.keys(s)) if (s[k] === id) s[k] = null
  if (store.uiEditId === id) closeUiEditor()
  return true
}
export function createUi(folder = 'Assets/UI', name = 'interfaz.ui', code = UI_DESIGN_TEMPLATE) {
  const p = store.project
  const dest = normFolder(folder)
  if (isSystemUiPath(dest)) return null
  const file = uniqueFileName(p, dest, name)
  const d = { id: uid('u'), name: file, folder: dest, code }
  p.uis.push(d)
  addFolderChain(p, dest)
  commit('Nueva interfaz')
  return d
}
export function resetSystemUi(id) {
  const d = store.project?.uis?.find((u) => u.id === id)
  if (!isSystemUi(d)) return false
  if (restoreSystemUiCode(store.project, id)) commit('Restaurar interfaz del sistema')
  return true
}
export function resetAllSystemUi() {
  const changed = restoreSystemUiCode(store.project)
  if (changed) commit('Restaurar interfaces del sistema')
  toast(changed + ' interfaces del sistema restauradas', 'ok')
  return changed
}
export function openUiEditor(id) {
  if (!store.project.uis.some((c) => c.id === id)) return
  store.uiEditId = id
  store.modal = 'ui'
}
export function closeUiEditor() { store.uiEditId = null; if (store.modal === 'ui') store.modal = null }
export function setUiCode(id, code) {
  const c = store.project.uis.find((x) => x.id === id)
  if (!c || c.code === code) return
  c.code = code
  markDirty()
}
export function openUiSlots() { store.modal = 'uislots' }
