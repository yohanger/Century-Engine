// El `host` del editor: lo que el Runtime (escena y modo Jugar) pide al exterior, resuelto con el store, IndexedDB y localStorage del editor.
// El juego exportado tendrá el suyo (paquete + disco). Contrato: engine/runtime/host.js
import { store, getObject, assetData, audioAssetSource, assetImage, assetUrl, toast, switchScene } from '../store.js'
import { loadScene } from '../db.js'
import { uid } from '../../engine/runtime/util.js'

// Claves lógicas del almacenamiento del jugador → claves de localStorage que ya usaban los proyectos (no se pierden partidas ni ajustes).
const LEGACY = { language: 'lf.lang.', graphics: 'lf-gfx-', input: 'lf-inputmap-', audio: 'lf-audio-' }
const legacyKey = (key) => {
  const id = store.project?.id || ''
  if (key.startsWith('save/')) return `lf-save:${id || 'proyecto'}:${key.slice(5)}`
  return (LEGACY[key] ?? `lf-x-${key}-`) + id
}

/** Almacenamiento del jugador (ajustes y partidas), síncrono: get/set/remove por clave lógica y keys(prefijo). */
const storage = {
  get(key) { try { return localStorage.getItem(legacyKey(key)) } catch { return null } },
  set(key, value) { localStorage.setItem(legacyKey(key), value) }, // puede lanzar si se llena la cuota: quien guarda lo captura
  remove(key) { try { localStorage.removeItem(legacyKey(key)) } catch { /* nada */ } },
  keys(prefix) {
    const out = [], pre = legacyKey(prefix)
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(pre)) out.push(prefix + k.slice(pre.length)) } } catch { /* sin almacenamiento */ }
    return out
  },
}

export const EDITOR_HOST = {
  get project() { return store.project },
  get view() { return store.view },
  get playState() { return store.play },
  get muted() { return !!store.prefs.gameMute },
  get locked() { return !!store.locked },
  getObject, assetData, audioAssetSource, assetImage, assetUrl, toast, storage, switchScene,
  readStreamScene: (id) => loadScene(store.project.id, id),
  bakeState: (s) => { store.bake.state = s },
  foliageCounts: (c) => { store.foliageCounts = c },
  log: (msg, kind = 'log', context = '') => {
    store.log.push({ id: uid('t'), msg: String(msg).slice(0, 8000), kind, context, time: Date.now() })
    if (store.log.length > 300) store.log.splice(0, store.log.length - 300)
  },
}
