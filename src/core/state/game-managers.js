// Recursos GameManager: usan la misma lista de Assets y el mismo historial del editor.
import { uid } from '../../engine/runtime/util.js'
import { MANAGER_FOLDER, MANAGER_EXT, normalizeGameManager } from '../../engine/runtime/game-manager.js'
import { addFolderChain, normFolder, uniqueFileName } from '../project.js'
import { store } from './state.js'
import { commit } from './history.js'

export function createGameManager(folder = MANAGER_FOLDER) {
  const p = store.project, dest = normFolder(folder)
  const name = uniqueFileName(p, dest, 'GameManager' + MANAGER_EXT)
  const manager = normalizeGameManager({ id: uid('gm'), name, folder: dest })
  p.gameManagers.push(manager)
  addFolderChain(p, dest)
  commit('Crear GameManager')
  return manager
}
export function assignSceneGameManager(id, sceneId = store.project?.activeSceneId) {
  const p = store.project, scene = p?.scenes.find((s) => s.id === sceneId)
  if (!scene || (id && !p.gameManagers.some((g) => g.id === id))) return false
  if ((scene.gameManagerId || '') === id) return true
  scene.gameManagerId = id || ''
  commit('Asignar GameManager')
  return true
}
export function openGameManagerEditor(id) {
  if (!store.project?.gameManagers.some((g) => g.id === id)) return
  store.projSel = { kind: 'gamemanager', id }
  store.prefs.rightTab = 'object'
  if (store.ui?.mode === 'desktop') store.prefs.rightOpen = true
  else if (store.ui) store.ui.drawer = 'inspector'
}
export function closeGameManagerEditor() {
  if (store.projSel?.kind === 'gamemanager') store.projSel = null
}
export function touchGameManager(id, patch) {
  const gm = store.project?.gameManagers.find((g) => g.id === id)
  if (!gm) return false
  Object.assign(gm, normalizeGameManager({ ...gm, ...patch }))
  commit('Editar GameManager')
  return true
}
export function dropGameManager(id) {
  const p = store.project
  if (!p?.gameManagers.some((g) => g.id === id)) return false
  p.gameManagers = p.gameManagers.filter((g) => g.id !== id)
  for (const scene of p.scenes) if (scene.gameManagerId === id) scene.gameManagerId = ''
  if (store.projSel?.kind === 'gamemanager' && store.projSel.id === id) closeGameManagerEditor()
  return true
}
