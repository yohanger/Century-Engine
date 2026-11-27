import { shallowRef, watch } from 'vue'
import { store } from '../store.js'

export const editorAppearance = shallowRef(null)

const CONFIG_PREF_KEYS = [
  'navigation', 'orbitSelection', 'editorFov',
  'mouseSensitivity', 'mouseOrbit', 'mousePan', 'mouseZoom', 'mouseInvertZoom',
  'padOrbit', 'padPan', 'padZoom', 'padInvert', 'padInvertY', 'padZoomCursor',
  'flySpeed', 'flySprint', 'flyLook',
  'gizmoSize', 'orientGizmo', 'showGizmos',
  'selectionStyle', 'selectionOutlineColor', 'selectionOutlineWidth', 'selectionOutlineStrength',
  'tooltips', 'addAsChild', 'terrainCropWarning', 'diskDelay', 'inspLabelWidth',
]

const preferenceValues = () => Object.fromEntries(CONFIG_PREF_KEYS.map((key) => [key, store.prefs[key]]))
const fingerprint = (prefs) => JSON.stringify(CONFIG_PREF_KEYS.map((key) => prefs?.[key]))
let authoritativeFingerprint = ''
let stopPreferenceSync = null
let saveTimer = null
let saveQueue = Promise.resolve()

function applyConfig(config, { preferences = true } = {}) {
  if (!config) return
  const { style } = document.documentElement
  for (const [key, value] of Object.entries(config.css || {})) style.setProperty(key, value)
  if (preferences && config.prefs) {
    authoritativeFingerprint = fingerprint(config.prefs)
    Object.assign(store.prefs, config.prefs)
  }
  editorAppearance.value = config
}

function bindPreferenceSync() {
  if (stopPreferenceSync || !window.lf?.saveEditorPreferences) return
  stopPreferenceSync = watch(
    () => CONFIG_PREF_KEYS.map((key) => store.prefs[key]),
    () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveQueue = saveQueue.then(async () => {
          const requested = preferenceValues()
          const requestedFingerprint = fingerprint(requested)
          if (requestedFingerprint === authoritativeFingerprint) return
          const config = await window.lf.saveEditorPreferences(requested)
          if (!config) return
          authoritativeFingerprint = fingerprint(config.prefs)
          // Si el usuario cambió otro control mientras Electron escribía, no se
          // revierte ese gesto: se guarda en la siguiente vuelta de la cola.
          const unchanged = fingerprint(preferenceValues()) === requestedFingerprint
          applyConfig(config, { preferences: unchanged })
          if (!unchanged) {
            clearTimeout(saveTimer)
            saveTimer = setTimeout(() => bindPreferenceFlush(), 180)
          }
        }).catch((error) => console.warn('No se pudo guardar editor.toml:', error.message))
      }, 180)
    },
  )
}

function bindPreferenceFlush() {
  const current = preferenceValues()
  if (fingerprint(current) === authoritativeFingerprint) return
  saveQueue = saveQueue.then(async () => {
    const config = await window.lf.saveEditorPreferences(current)
    if (!config) return
    authoritativeFingerprint = fingerprint(config.prefs)
    applyConfig(config, { preferences: fingerprint(preferenceValues()) === fingerprint(current) })
  }).catch((error) => console.warn('No se pudo guardar editor.toml:', error.message))
}

export async function applyEditorAppearance(reload = false) {
  let config = await window.lf?.editorConfig?.(reload)
  if (!config) return
  // Primera ejecución tras actualizar una instalación antigua: sus preferencias
  // locales rellenan sólo las claves que aún no existen en TOML. Desde ese
  // momento el archivo queda completo y pasa a ser la única autoridad.
  if (!reload && !config.issues?.length && config.missingPrefs?.length && window.lf?.saveEditorPreferences) {
    const migrated = { ...config.prefs }
    for (const key of config.missingPrefs) if (store.prefs[key] !== undefined) migrated[key] = store.prefs[key]
    config = await window.lf.saveEditorPreferences(migrated)
  }
  applyConfig(config)
  bindPreferenceSync()
}
