// Perfiles de post-proceso (como los «Volume Profile» de Unity): un RECURSO del proyecto (Assets/Profiles/*.post; los antiguos .profile se conservan) que sobrescribe
// parte de los ajustes de render (Ajustes → Render) mientras una cámara lo usa. Cada EFECTO se activa con su casilla («override»);
// lo que no se activa se queda como esté en el render del proyecto. Una cámara —Camera3D del personaje o del mundo— lleva
// un slot «Perfil». Sin DOM ni THREE: lo usan el editor, el juego y las pruebas.
//
//   { id, name: 'Noche.post', folder: 'Assets/Profiles', fx: { bloom: { on: true, bloom: 1.2, bloomThreshold: 0.7, bloomRadius: 0.6 }, … } }
// Añadir un efecto nuevo = una entrada en PROFILE_EFFECTS (y que look.js lea esa clave de la configuración).
import { clone } from '../events/model.js'

const n = (key, label, min, max, step, def, hint) => ({ key, label, type: 'number', min, max, step, def, ...(hint ? { hint } : {}) })

export const PROFILE_EFFECTS = [
  { id: 'shader', label: 'Shader Graph personalizado', params: [n('postMix', 'Intensidad', 0, 1, 0.01, 1)] },
  { id: 'tonemapping', label: 'Tonemapping y exposición', params: [
    { key: 'tonemap', label: 'Tonemapping', type: 'select', def: 'aces', options: [['aces', 'ACES'], ['agx', 'AgX'], ['neutral', 'Neutral'], ['lineal', 'Lineal']] },
    n('exposure', 'Exposición', 0.1, 4, 0.05, 0.9)] },
  { id: 'autoexposure', label: 'Exposición automática', params: [n('autoExposure', 'Fuerza', 0, 1, 0.05, 0.8), n('aeKey', 'Brillo objetivo', 0.03, 1, 0.01, 0.25), n('aeSpeedUp', 'Velocidad al aclarar', 0.1, 30, 0.1, 3), n('aeSpeedDown', 'Velocidad al oscurecer', 0.1, 30, 0.1, 1), n('aeMin', 'Límite oscuro (EV)', -8, 0, 0.5, -3), n('aeMax', 'Límite claro (EV)', 0, 8, 0.5, 3)] },
  { id: 'dof', label: 'Profundidad de campo', params: [n('dofBlur', 'Desenfoque máx. (px)', 0, 24, 0.5, 6), n('dofFocus', 'Distancia de enfoque (m)', 0.1, 500, 0.1, 8), n('dofRange', 'Zona nítida (m)', 0, 200, 0.5, 4)] },
  { id: 'ssr', label: 'Reflejos SSR', params: [
    { key: 'ssr', label: 'Activar SSR', type: 'bool', def: false },
    { key: 'ssrQuality', label: 'Calidad', type: 'select', def: 'media', options: [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']] },
    n('ssrStrength', 'Intensidad', 0, 1, 0.05, 0.45), n('ssrDistance', 'Distancia (m)', 0.1, 100, 0.5, 30)] },
  { id: 'bloom', label: 'Bloom', params: [n('bloom', 'Intensidad', 0, 3, 0.05, 0.45), n('bloomThreshold', 'Umbral', 0, 4, 0.05, 0.85), n('bloomRadius', 'Radio', 0, 1.5, 0.05, 0.55)] },
  { id: 'ao', label: 'Oclusión ambiental (AO)', params: [n('ao', 'Intensidad', 0, 2, 0.05, 0.9), n('aoRadius', 'Radio (m)', 0.05, 4, 0.05, 0.7)] },
  { id: 'color', label: 'Ajuste de color', params: [n('saturation', 'Saturación', 0, 2, 0.02, 0.92), n('contrast', 'Contraste', 0.5, 2, 0.02, 1.08)] },
  { id: 'lut', label: 'LUT de color (fuerza)', params: [n('lutStrength', 'Fuerza', 0, 1, 0.02, 1)] },
  { id: 'tint', label: 'Tinte de sombras y luces', params: [
    { key: 'shadowTint', label: 'Sombras', type: 'color', def: '#8fa8c9' }, { key: 'highlightTint', label: 'Luces', type: 'color', def: '#ffd9ae' }, n('tintStrength', 'Fuerza', 0, 1, 0.02, 0.35)] },
  { id: 'vignette', label: 'Viñeta', params: [n('vignette', 'Intensidad', 0, 1, 0.02, 0.4), n('vignetteRadius', 'Radio', 0.05, 1, 0.01, 0.5), { key: 'vignetteColor', label: 'Color', type: 'color', def: '#000000' }] },
  { id: 'wheels', label: 'Ruedas de color (Lift · Gamma · Gain · Offset)', params: ['lift', 'gamma', 'gain', 'offset'].flatMap((w) => [n(w + 'X', `${w} · color X`, -1, 1, 0.01, 0), n(w + 'Y', `${w} · color Y`, -1, 1, 0.01, 0), n(w + 'M', `${w} · luminosidad`, -1, 1, 0.01, 0)]) },
  { id: 'balance', label: 'Balance, tono y vibrance', params: [n('temperature', 'Temperatura', -1, 1, 0.01, 0), n('tintGreen', 'Tinte (verde ↔ magenta)', -1, 1, 0.01, 0), n('hue', 'Tono (°)', -180, 180, 1, 0), n('vibrance', 'Vibrance', -1, 1, 0.01, 0)] },
  { id: 'grain', label: 'Grano de película', params: [n('grain', 'Intensidad', 0, 0.5, 0.01, 0)] },
  { id: 'chromatic', label: 'Aberración cromática', params: [n('chromatic', 'Intensidad', 0, 0.02, 0.001, 0.004)] },
  { id: 'sharpen', label: 'Nitidez', params: [n('sharpen', 'Intensidad', 0, 1, 0.02, 0.3)] },
]
export const PROFILE_KEYS = PROFILE_EFFECTS.flatMap((e) => e.params.map((p) => p.key))
const PARAM = Object.fromEntries(PROFILE_EFFECTS.flatMap((e) => e.params.map((p) => [p.key, p])))
const EFFECT = Object.fromEntries(PROFILE_EFFECTS.map((e) => [e.id, e]))
export const PROFILE_EXT = '.post'
export const LEGACY_PROFILE_EXT = '.profile'
export const PROFILE_FOLDER = 'Assets/Profiles'
export const isProfileName = (name) => /\.(post|profile)$/i.test(String(name || ''))
export const profileStem = (name) => String(name || '').replace(/\.(post|profile)$/i, '')

const fin = (v, d) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : d)

function cleanValue(p, v) {
  if (p.type === 'bool') return v === true
  if (p.type === 'number') return Math.min(p.max, Math.max(p.min, fin(v, p.def)))
  if (p.type === 'color') return /^#[0-9a-f]{6}$/i.test(v || '') ? v : p.def
  return p.options.some((o) => o[0] === v) ? v : p.def
}

/** Perfil válido: solo efectos conocidos, valores limitados a su rango. Los efectos no listados no sobrescriben nada. */
export function normalizeProfile(raw, i = 0) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const fx = {}
  for (const e of PROFILE_EFFECTS) {
    const src = r.fx?.[e.id]
    if (!src || typeof src !== 'object') continue
    const o = { on: src.on !== false }
    for (const p of e.params) o[p.key] = cleanValue(p, src[p.key])
    if (e.id === 'shader') {
      o.postShader = typeof src.postShader === 'string' ? src.postShader : ''
      o.postParams = src.postParams && typeof src.postParams === 'object' && !Array.isArray(src.postParams) ? { ...src.postParams } : {}
    }
    fx[e.id] = o
  }
  let name = String(r.name || `Perfil ${i + 1}`)
  if (!isProfileName(name)) name += PROFILE_EXT
  return { id: String(r.id || `pr${i + 1}`), name, folder: typeof r.folder === 'string' && r.folder ? r.folder : PROFILE_FOLDER, fx }
}
export const normalizeProfiles = (list) => (Array.isArray(list) ? list.map(normalizeProfile) : [])

/** Perfil nuevo con los efectos habituales ya presentes (desactivados) y con los valores por defecto del render actual si se da. */
export function newProfile(id, name, render = null) {
  const fx = {}
  for (const e of PROFILE_EFFECTS) { fx[e.id] = { on: false }; for (const p of e.params) fx[e.id][p.key] = render && render[p.key] !== undefined ? cleanValue(p, render[p.key]) : p.def }
  fx.shader.postShader = ''; fx.shader.postParams = {}
  return normalizeProfile({ id, name, fx })
}

/** Ajustes de render con el perfil encima (solo los efectos activados). `render` no se modifica. */
export function applyProfile(render, profile) {
  const out = { ...render }
  if (!profile) return out
  for (const e of PROFILE_EFFECTS) {
    const f = profile.fx?.[e.id]
    if (!f || f.on === false) continue
    for (const p of e.params) if (f[p.key] !== undefined) out[p.key] = f[p.key]
    if (e.id === 'shader') { out.postShader = f.postShader; out.postParams = { ...f.postParams } }
  }
  return out
}

const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (a) => '#' + a.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
/** Mezcla dos ajustes de render (t = 0 → a, 1 → b): números y colores se interpolan; lo demás cambia a mitad. */
export function lerpRender(a, b, t) {
  const out = { ...b }
  const aid = a.postShader || '', bid = b.postShader || ''
  // Dos programas distintos no se interpolan dentro de un mismo ShaderPass.
  // Atenuar el primero antes de activar el segundo evita un salto de color.
  out.postShader = aid === bid ? aid : (t < 0.5 ? aid : bid)
  out.postParams = t < 0.5 ? (a.postParams || {}) : (b.postParams || {})
  out.postMix = aid === bid ? (Number(a.postMix) || 0) * (1 - t) + (Number(b.postMix) || 0) * t
    : t < 0.5 ? (Number(a.postMix) || 0) * (1 - t * 2) : (Number(b.postMix) || 0) * (t * 2 - 1)
  for (const k of PROFILE_KEYS) {
    if (k === 'postMix') continue
    const p = PARAM[k], x = a[k], y = b[k]
    if (p.type === 'number') out[k] = x + (y - x) * t
    else if (p.type === 'color') { const A = hex2(x), B = hex2(y); out[k] = toHex(A.map((v, i) => v + (B[i] - v) * t)) }
    else out[k] = t < 0.5 ? x : y
  }
  return out
}

/** Perfil por id o nombre (con o sin extensión, sin distinguir mayúsculas). */
export function findProfile(list, key) {
  if (!key) return null
  const name = String(key).toLowerCase()
  const stem = profileStem(name)
  return (list || []).find((p) => p.id === key)
    || (list || []).find((p) => p.name.toLowerCase() === name)
    || (list || []).find((p) => profileStem(p.name.toLowerCase()) === stem) || null
}

/** Una copia profunda (para duplicar). */
export const cloneProfile = (p) => clone(p)

/** ¿Qué efectos modifica? (para mostrarlo en la lista) */
export const activeEffects = (p) => PROFILE_EFFECTS.filter((e) => p.fx?.[e.id]?.on).map((e) => e.label)
export const effectDef = (id) => EFFECT[id]
