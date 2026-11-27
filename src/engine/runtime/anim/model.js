// Modelo de datos de las animaciones (clips de claves, como Blender / Unity). Sin DOM ni three.
//
//  Clip:  { id, name, duration, loop, speed, additive, tracks: [Pista], events: [Evento] }
//  Pista: { id, path, prop, keys: [Clave] }
//     path  · '' = el nodo sobre el que se reproduce · 'Mano/Vaso' = descendiente por nombres · '@slot:right' = slot del view model · '@vm' = todo el view model
//     prop  · position | rotation | scale | visible | active | light.energy | light.color
//  Clave: { id, t, v, ease, bz? }   v = [x,y,z] | boolean | número | '#rrggbb'
//     ease  · cómo se llega desde ESTA clave a la siguiente: linear · in · out · inOut · cut · bezier (bz = [x1,y1,x2,y2]) · back · bounce · elastic
//  Evento: { id, t, name, list: [Comando] }   → dispara comandos y game.on("animationEvent")
//  additive: los valores se SUMAN a la pose del nodo al empezar (posición/rotación) o la multiplican (escala): útil para objetos en la mano.
import { uid } from '../util.js'

export const PROPS = {
  position: { label: 'Posición', kind: 'vec3', def: [0, 0, 0], timelineRuntime: true },
  rotation: { label: 'Rotación (°)', kind: 'vec3', def: [0, 0, 0], timelineRuntime: true },
  scale: { label: 'Escala', kind: 'vec3', def: [1, 1, 1], timelineRuntime: true },
  visible: { label: 'Visible', kind: 'bool', def: true, timelineRuntime: true },
  active: { label: 'Activo', kind: 'bool', def: true, timelineRuntime: true },
  'light.energy': { label: 'Luz: intensidad', kind: 'number', def: 1.5, min: 0, timelineRuntime: true },
  'light.color': { label: 'Luz: color', kind: 'color', def: '#ffffff', timelineRuntime: true },
}
// Descriptores de los tipos de nodo: la definición del propietario registra en PROPS
// únicamente sus canales tipados; NO se crea un segundo catálogo de animación.
const allowedKinds = new Set(['vec3', 'number', 'bool', 'color', 'string', 'enum'])
const propertyIdPattern = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/
export function registerNodeAnimationProperties(type, definitions = {}) {
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions))
    throw new TypeError('Las propiedades de animación deben ser un objeto de descriptores')
  const entries = Object.entries(definitions)
  for (const [id, spec] of entries) {
    if (!propertyIdPattern.test(id) || Object.hasOwn(PROPS, id) || !spec || !allowedKinds.has(spec.kind) ||
        typeof spec.label !== 'string' || !spec.label.trim() || !Object.hasOwn(spec, 'def') ||
        typeof spec.read !== 'function' || typeof spec.apply !== 'function' ||
        typeof spec.capture !== 'function' || typeof spec.restore !== 'function')
      throw new TypeError(`Descriptor animable inválido o duplicado: ${id}`)
    // Validar primero TODAS las entradas antes de registrar alguna.
    if (spec.kind === 'vec3' && (!Array.isArray(spec.def) || spec.def.length !== 3 || !spec.def.every(Number.isFinite)))
      throw new TypeError(`Valor por defecto vectorial inválido: ${id}`)
    if (spec.kind === 'number' && (!Number.isFinite(spec.def) || (Number.isFinite(spec.min) && spec.def < spec.min)))
      throw new TypeError(`Valor por defecto numérico inválido: ${id}`)
    if (spec.kind === 'color' && !/^#[0-9a-f]{6}$/i.test(spec.def))
      throw new TypeError(`Color por defecto inválido: ${id}`)
    if (spec.kind === 'bool' && typeof spec.def !== 'boolean')
      throw new TypeError(`Booleano por defecto inválido: ${id}`)
    if (spec.kind === 'string' && typeof spec.def !== 'string')
      throw new TypeError(`Cadena por defecto inválida: ${id}`)
    if (spec.kind === 'enum' && (!Array.isArray(spec.options) || !spec.options.length ||
        !spec.options.every(item => typeof item === 'string') || !spec.options.includes(spec.def)))
      throw new TypeError(`Enum por defecto inválido: ${id}`)
  }
  for (const [id, spec] of entries) PROPS[id] = Object.freeze({ ...spec, ownerType: type, timelineRuntime: true })
  return Object.freeze(Object.fromEntries(entries.map(([id]) => [id, PROPS[id]])))
}
/** Elegibilidad real de un canal en un nodo, sin consultar tres, Jolt ni el Inspector. */
export function nodeAnimationProperty(node, id) {
  const spec = Object.hasOwn(PROPS, id) ? PROPS[id] : null
  if (!node || !spec?.timelineRuntime || (spec.ownerType && spec.ownerType !== node.type)) return null
  if (id.startsWith('light.') && node.type !== 'light') return null
  if (['position', 'rotation', 'scale'].includes(id)) {
    if (node.type === 'node' || node.type === 'terrain' ||
        ['rigidbody3d', 'characterbody3d'].includes(node.type)) return null
  }
  if (id === 'visible') return typeof node.visible === 'boolean' ? spec : null
  if (id === 'active') return node.active === undefined || typeof node.active === 'boolean' ? spec : null
  if (spec.ownerType) {
    if (spec.available && !spec.available(node)) return null
    try { validatePropertyValue(id, spec.read(node)) }
    catch { return null } // Un dato de nodo incompleto no puede anunciar una llave funcional.
  }
  return spec
}
export function nodeAnimationProperties(node) {
  if (!node) return []
  return Object.entries(PROPS).filter(([id]) => nodeAnimationProperty(node, id))
}
// Compartido con Timeline para el almacenamiento de valores tipados.
// La declaración de una propiedad no implica que Timeline ya pueda evaluarla.
export function validatePropertyValue(prop, value) {
  const spec = Object.hasOwn(PROPS, prop) ? PROPS[prop] : null
  if (!spec) throw new Error(`Propiedad animable no reconocida: ${prop}`)
  if (spec.kind === 'vec3') {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(v => typeof v === 'number' && Number.isFinite(v) &&
      (!Number.isFinite(spec.min) || v >= spec.min) && (!Number.isFinite(spec.max) || v <= spec.max)))
      throw new Error(`Valor vectorial inválido para ${prop}`)
    return [...value]
  }
  if (spec.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) ||
      (Number.isFinite(spec.min) && value < spec.min) || (Number.isFinite(spec.max) && value > spec.max))
      throw new Error(`Valor numérico inválido para ${prop}`)
    return value
  }
  if (spec.kind === 'bool') {
    if (typeof value !== 'boolean') throw new Error(`Valor booleano inválido para ${prop}`)
    return value
  }
  if (spec.kind === 'color') {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Color inválido para ${prop}`)
    return value.toLowerCase()
  }
  if (spec.kind === 'string' && typeof value === 'string' && value.length <= 4096) return value
  if (spec.kind === 'enum' && spec.options.includes(value)) return value
  throw new Error(`Tipo de propiedad no reconocido: ${prop}`)
}
export const EASES = [['inOut', 'Suave (entrada y salida)'], ['linear', 'Lineal'], ['in', 'Acelera'], ['out', 'Frena'], ['bezier', 'Curva Bézier'], ['back', 'Rebasa y vuelve'], ['bounce', 'Rebote'], ['elastic', 'Elástico'], ['cut', 'Corte (mantiene y salta)']]
export const BEZIER_PRESETS = [['Suave', [0.42, 0, 0.58, 1]], ['Rápido al inicio', [0, 0.6, 0.3, 1]], ['Lento al inicio', [0.7, 0, 1, 0.4]], ['Anticipación', [0.6, -0.3, 0.4, 1.3]]]

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d)
const hexOr = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d)
const vec = (v, d) => (Array.isArray(v) && v.length === 3 ? v.map((x) => num(x)) : [...d])
const easeName = (e) => (EASES.some((x) => x[0] === e) ? e : 'inOut')

export function defaultValue(prop) { const d = PROPS[prop]?.def; return Array.isArray(d) ? [...d] : d }
export function newKey(prop, t = 0, v = undefined, extra = {}) {
  return { id: uid('k'), t: Math.max(0, num(t)), v: v === undefined ? defaultValue(prop) : v, ease: 'inOut', ...extra }
}
export function newTrack(path = '', prop = 'position', extra = {}) { return { id: uid('tr'), path, prop, keys: [], ...extra } }
export function newClip(name = 'Animación', extra = {}) {
  return { id: uid('an'), name, duration: 1, loop: false, speed: 1, additive: false, tracks: [], events: [], ...extra }
}

export function normalizeKey(prop, k) {
  const kind = PROPS[prop]?.kind
  const o = { id: k?.id || uid('k'), t: Math.max(0, num(k?.t)), ease: easeName(k?.ease) }
  if (kind === 'vec3') o.v = vec(k?.v, PROPS[prop].def)
  else if (kind === 'bool') o.v = k?.v !== false && k?.v !== 0
  else if (kind === 'number') o.v = num(k?.v, PROPS[prop].def)
  else if (kind === 'string' || kind === 'enum') o.v = typeof k?.v === 'string' &&
    (kind !== 'enum' || PROPS[prop].options.includes(k.v)) ? k.v : PROPS[prop].def
  else o.v = hexOr(k?.v, PROPS[prop]?.def ?? '#ffffff')
  if (o.ease === 'bezier') { const b = Array.isArray(k?.bz) && k.bz.length === 4 ? k.bz.map((x) => num(x)) : BEZIER_PRESETS[0][1]; o.bz = [Math.min(1, Math.max(0, b[0])), b[1], Math.min(1, Math.max(0, b[2])), b[3]] }
  return o
}
export function normalizeTrack(tr) {
  const prop = PROPS[tr?.prop] ? tr.prop : 'position'
  return { id: tr?.id || uid('tr'), path: String(tr?.path || ''), prop, keys: (Array.isArray(tr?.keys) ? tr.keys : []).map((k) => normalizeKey(prop, k)).sort((a, b) => a.t - b.t) }
}
export function normalizeClip(c) {
  const o = newClip(String(c?.name || 'Animación'), { id: c?.id || uid('an') })
  o.duration = Math.max(0.05, num(c?.duration, 1)); o.loop = !!c?.loop; o.speed = Math.max(0.01, num(c?.speed, 1)); o.additive = !!c?.additive
  o.tracks = (Array.isArray(c?.tracks) ? c.tracks : []).map(normalizeTrack)
  o.events = (Array.isArray(c?.events) ? c.events : []).map((e) => ({ id: e?.id || uid('ev'), t: Math.max(0, num(e?.t)), name: String(e?.name || ''), list: Array.isArray(e?.list) ? e.list : [] })).sort((a, b) => a.t - b.t)
  return o
}
export const normalizeClips = (l) => (Array.isArray(l) ? l.map(normalizeClip) : [])
export const clipEnd = (c) => Math.max(c.duration, ...c.tracks.flatMap((t) => t.keys.map((k) => k.t)), ...c.events.map((e) => e.t))
export const sortKeys = (tr) => tr.keys.sort((a, b) => a.t - b.t)
export const findClip = (list, x) => { const q = String(x ?? '').trim().toLowerCase(); return (list || []).find((c) => c.id === x) || (list || []).find((c) => c.name.toLowerCase() === q) }

/** Animación de ejemplo para «Nueva animación»: sube y gira un objeto (vaso hacia la boca y vuelta) y un evento al llegar. */
export function sampleClip(name = 'Beber') {
  const c = newClip(name, { duration: 2, additive: true })
  const pos = newTrack('', 'position'); pos.keys = [newKey('position', 0, [0, 0, 0]), newKey('position', 0.8, [0, 0.12, 0.25]), newKey('position', 1.2, [0, 0.12, 0.25], { ease: 'inOut' }), newKey('position', 2, [0, 0, 0])]
  const rot = newTrack('', 'rotation'); rot.keys = [newKey('rotation', 0, [0, 0, 0]), newKey('rotation', 0.8, [-60, 0, 0]), newKey('rotation', 1.2, [-60, 0, 0]), newKey('rotation', 2, [0, 0, 0])]
  c.tracks = [pos, rot]
  c.events = [{ id: uid('ev'), t: 1, name: 'beber', list: [] }]
  return c
}
