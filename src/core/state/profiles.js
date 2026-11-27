// Perfiles de post-proceso (Assets/Profiles).
import { uid } from '../../engine/runtime/util.js'
import { addFolderChain, uniqueFileName, normFolder } from '../project.js'
import { store } from './state.js'
import { markDirty, commit } from './history.js'
import { newProfile, PROFILE_FOLDER, normalizeProfile, isProfileName, PROFILE_EXT } from '../../engine/runtime/render/profiles.js'

// ---------- perfiles de post-proceso (Assets/Profiles) ----------
export function dropProfile(id) {
  const p = store.project
  p.profiles = p.profiles.filter((x) => x.id !== id)
  for (const gm of p.gameManagers || []) if (gm.profile === id) gm.profile = ''
  for (const o of p.objects) if (o.props?.profile === id) o.props.profile = '' // las cámaras que lo usaban se quedan sin perfil
  if (store.projSel?.kind === 'profile' && store.projSel.id === id) closeProfileEditor()
}
/** Crea un perfil (con los valores actuales del render como punto de partida para cada efecto). */
export function createProfile(folder = PROFILE_FOLDER, name = 'Perfil.post') {
  const p = store.project
  const dest = normFolder(folder)
  const file = uniqueFileName(p, dest, isProfileName(name) ? name : name + PROFILE_EXT)
  const d = newProfile(uid('pr'), file, p.render)
  d.folder = dest
  p.profiles.push(d)
  addFolderChain(p, dest)
  commit('Nuevo perfil')
  return d
}
export function openProfileEditor(id) {
  if (!store.project?.profiles?.some((c) => c.id === id)) return
  store.projSel = { kind: 'profile', id }
  store.prefs.rightTab = 'object'
  if (store.ui?.mode === 'desktop') store.prefs.rightOpen = true
  else if (store.ui) store.ui.drawer = 'inspector'
}
export function closeProfileEditor() {
  if (store.projSel?.kind === 'profile') store.projSel = null
  store.editor?.previewProfile?.(null)
}
/** Normaliza y refresca el perfil; registra Undo solo al finalizar la edición. */
export function touchProfile(id, { record = true } = {}) {
  const pr = store.project.profiles.find((x) => x.id === id)
  if (!pr) return
  Object.assign(pr, normalizeProfile(pr))
  if (record) commit('Editar perfil')
  else markDirty()
  store.editor?.previewProfile?.(pr)
}

