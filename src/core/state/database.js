// Base de datos (registros con id estable) y scripts del proyecto.
import { uid } from '../../engine/runtime/util.js'
import { newRecord } from '../../engine/runtime/database/schema.js'
import { addFolderChain, uniqueFileName, normFolder } from '../project.js'
import { store } from './state.js'
import { markDirty, commit } from './history.js'
import { activateCodeDock } from '../editor/view-dock-session.js'

// ---- base de datos (registros con id estable) ----
export async function addDbRecord(kind, copyOf = null) {
  const list = store.project.database[kind]
  const id = Math.max(0, ...list.map((r) => r.id)) + 1
  const src = copyOf ? list.find((r) => r.id === copyOf) : null
  const r = src ? { ...JSON.parse(JSON.stringify(src)), id, name: (src.name || '') + ' (copia)' } : newRecord(kind, id)
  if (!src) r.name = ''
  list.push(r); markDirty()
  return id
}
export function deleteDbRecord(kind, id) { const d = store.project.database; d[kind] = d[kind].filter((r) => r.id !== id); markDirty() }
export function moveDbRecord(kind, id, dir) { const l = store.project.database[kind], i = l.findIndex((r) => r.id === id), j = i + dir; if (i < 0 || j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; markDirty() }
export function touchDb() { markDirty() }

// Plantillas sin código de ejemplo que se ejecute por defecto.
export const SCRIPT_TEMPLATE = `game.on('start', () => {
})

game.on('update', (delta) => {
})

game.on('fixedUpdate', (delta) => {
})
`

export const NODE_SCRIPT_TEMPLATE = `function _ready() {
}

function _process(delta) {
}

function _physics_process(delta) {
}
`

export function createScript(folder = 'Assets/Scripts', name = 'script.js', execution = 'global') {
  const p = store.project
  const dest = normFolder(folder)
  const file = uniqueFileName(p, dest, name)
  const sc = { id: uid('sc'), name: file, folder: dest, execution, code: execution === 'node' ? NODE_SCRIPT_TEMPLATE : SCRIPT_TEMPLATE }
  p.scripts.push(sc)
  addFolderChain(p, dest)
  commit('Nuevo script')
  return sc
}
export function openScriptEditor(id = store.scriptEditId || store.project?.scripts[0]?.id || '') {
  if (!store.project || store.locked || (id && !store.project.scripts.some((c) => c.id === id))) return
  store.scriptEditId = id
  if (store.ui.mode === 'desktop') activateCodeDock(store)
}
export function closeScriptEditor() { store.scriptEditId = null; if (store.modal === 'script') store.modal = null }
export function setScriptCode(id, code) {
  const c = store.project.scripts.find((x) => x.id === id)
  if (!c || c.code === code) return
  c.code = code
  markDirty()
}


/** Cambia entre script global y recurso de nodo. El modo define una única vía de ejecución. */
export function setScriptExecution(id, execution) {
  const sc = store.project.scripts.find((s) => s.id === id)
  if (!sc || !['global', 'node'].includes(execution) || (sc.execution || 'global') === execution) return
  sc.execution = execution
  commit('Cambiar ejecución de script')
}
