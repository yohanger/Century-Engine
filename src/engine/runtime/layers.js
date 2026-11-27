// Tags y Layers del proyecto (como en Unity). GLOBALES: viven en project.tagLayers y los comparten todas las escenas.
//
//  · TAG: una etiqueta por objeto («Player», «Respawn»…). Sirve para buscar: game.findByTag("Respawn").
//  · LAYER: 32 ranuras con nombre. Un objeto puede estar en VARIAS (multi-layer): obj.layers = [índices]. Se usan para agrupar,
//    filtrar y —con la SUPERFICIE de la layer— para que el motor sepa sobre qué pisa el jugador (piedra, tierra, hierba…).
//  · SUPERFICIE: material bajo los pies. Cada layer puede tener una (la tabla SURFACES). Si un objeto está en varias layers con
//    superficie, gana la primera de su lista: el orden es la prioridad.
// Sin dependencias de THREE ni del DOM: lo usan el editor, el juego exportado y las pruebas.

export const MAX_LAYERS = 32
export const MAX_TAGS = 128
export const BUILTIN_TAGS = ['Untagged', 'Respawn', 'Finish', 'EditorOnly', 'MainCamera', 'Player', 'GameController']
export const DEFAULT_TAG = 'Untagged'
export const MAX_GROUPS = 128

/** Los grupos son pertenencias lógicas; ni parentId ni Layers representan esta relación. */
export function normalizeGroups(value) {
  const names = []
  for (const item of Array.isArray(value) ? value : []) {
    const name = String(item ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
    if (name && !names.some((n) => n.toLowerCase() === name.toLowerCase()) && names.length < MAX_GROUPS) names.push(name)
  }
  return names
}
/** Migración idempotente. Tag permanece como dato de compatibilidad de proyectos antiguos. */
export function migrateObjectGroups(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const legacy = typeof obj.tag === 'string' && obj.tag.trim() && obj.tag !== DEFAULT_TAG ? [obj.tag] : []
  obj.groups = normalizeGroups(Array.isArray(obj.groups) ? obj.groups : legacy)
  return obj
}
export const groupsOf = (obj) => normalizeGroups(obj?.groups ?? (obj?.tag && obj.tag !== DEFAULT_TAG ? [obj.tag] : []))
export const isInGroup = (obj, name) => groupsOf(obj).some((n) => n.toLowerCase() === String(name ?? '').trim().toLowerCase())
/** Para registrar nombres reutilizables en el Editor; la pertenencia vive solo en object.groups. */
export function addGroup(tl, value) {
  const name = normalizeGroups([value])[0]
  tl.groups ??= []
  if (!name || tl.groups.length >= MAX_GROUPS || tl.groups.some((n) => n.toLowerCase() === name.toLowerCase())) return null
  tl.groups.push(name)
  return name
}
export function removeGroup(tl, name) {
  const i = (tl.groups || []).findIndex((n) => n.toLowerCase() === String(name).toLowerCase())
  if (i < 0) return false
  tl.groups.splice(i, 1)
  return true
}

/**
 * Superficies: id → { label, parámetros del sintetizador heredado }. La superficie no reproduce pasos por sí sola.
 * f = frecuencia del filtro (Hz), q = resonancia, d = duración (s), g = volumen, lo = golpe grave (0–1), noise = 'white'|'brown'.
 * Añadir una superficie nueva = una entrada aquí.
 */
export const SURFACES = {
  stone:  { label: 'Piedra',  f: 2600, q: 1.1, d: 0.09, g: 0.9, lo: 0.35, noise: 'white' },
  dirt:   { label: 'Tierra',  f: 700,  q: 0.7, d: 0.13, g: 0.9, lo: 0.5,  noise: 'brown' },
  grass:  { label: 'Hierba',  f: 1500, q: 0.5, d: 0.16, g: 0.55, lo: 0.15, noise: 'brown' },
  sand:   { label: 'Arena',   f: 1100, q: 0.4, d: 0.2,  g: 0.5, lo: 0.05, noise: 'brown' },
  gravel: { label: 'Grava',   f: 3400, q: 0.8, d: 0.17, g: 0.75, lo: 0.1, noise: 'white' },
  wood:   { label: 'Madera',  f: 520,  q: 2.4, d: 0.1,  g: 0.85, lo: 0.7, noise: 'white' },
  metal:  { label: 'Metal',   f: 4200, q: 6.5, d: 0.16, g: 0.65, lo: 0.2, noise: 'white' },
  snow:   { label: 'Nieve',   f: 900,  q: 0.3, d: 0.22, g: 0.45, lo: 0.02, noise: 'brown' },
  water:  { label: 'Agua',    f: 1800, q: 0.6, d: 0.28, g: 0.7, lo: 0.1, noise: 'white' },
}
export const SURFACE_LIST = Object.entries(SURFACES).map(([id, s]) => [id, s.label])

// ---------- sonido de pasos de cada layer ----------
// Cada layer con nombre puede llevar sus propios clips (Tags y Layers ▸ Layers ▸ ♪): varios por acción, que se eligen al azar
// sin repetir el último, con volumen, variación de tono y grupo del mezclador. Sin clips, silencio.
// Las capas de pintura del terreno usan la layer que tenga su misma superficie.
export const STEP_KINDS = [['walk', 'Caminar'], ['run', 'Correr'], ['land', 'Aterrizar'], ['jump', 'Saltar']]
export const STEPS_DEFAULT = { walk: [], run: [], land: [], jump: [], volume: 1, pitch: 0.08, group: 'sfx' }
const clipList = (v) => (Array.isArray(v) ? v : []).filter((x) => typeof x === 'string' && x).slice(0, 16)
/** Sonido de pasos saneado (o null si no tiene ningún clip ni ajuste). */
export function normalizeSteps(v) {
  if (!v || typeof v !== 'object') return null
  const o = { ...STEPS_DEFAULT }
  for (const [k] of STEP_KINDS) o[k] = clipList(v[k])
  o.volume = Number.isFinite(+v.volume) ? Math.min(2, Math.max(0, +v.volume)) : 1
  o.pitch = Number.isFinite(+v.pitch) ? Math.min(0.5, Math.max(0, +v.pitch)) : 0.08
  o.group = typeof v.group === 'string' && v.group ? v.group : 'sfx'
  return o
}
export const stepsCount = (s) => (s ? STEP_KINDS.reduce((n, [k]) => n + (s[k]?.length || 0), 0) : 0)
/** Clips para una acción, con respaldo: correr y aterrizar usan los de caminar si no tienen propios; saltar, no. */
export function stepClips(s, kind) {
  if (!s) return []
  if (s[kind]?.length) return s[kind]
  return kind === 'run' || kind === 'land' ? s.walk || [] : []
}
/** Elige un clip al azar sin repetir el anterior (si hay más de uno). `rnd` = Math.random por defecto. */
export function pickClip(list, last = null, rnd = Math.random) {
  if (!list?.length) return null
  if (list.length === 1) return list[0]
  const pool = list.filter((c) => c !== last)
  return pool[Math.floor(rnd() * pool.length) % pool.length]
}
/** Layer asociada a una superficie (la primera con esa superficie, preferida la que tenga clips); -1 si ninguna. */
export function layerForSurface(tl, surface) {
  if (!surface) return -1
  let first = -1
  for (let i = 0; i < tl.layers.length; i++) {
    const l = tl.layers[i]
    if (!l.name || l.surface !== surface) continue
    if (stepsCount(l.steps)) return i
    if (first < 0) first = i
  }
  return first
}
/** Layer de audio/superficie de un objeto: la primera de las suyas con clips o superficie; -1 si ninguna. */
export function soundLayerOf(tl, obj) {
  for (const i of layersOf(obj)) { const l = tl.layers[i]; if (l && (l.surface || stepsCount(l.steps))) return i }
  return -1
}

/** Layers con las que nace un proyecto: las de Unity y, en 8–15, las superficies más habituales. [nombre, superficie]. */
export const DEFAULT_LAYER_DEFS = [
  ['Default', ''], ['TransparentFX', ''], ['Ignore Raycast', ''], ['', ''], ['Water', 'water'], ['UI', ''], ['', ''], ['', ''],
  ['Stone', 'stone'], ['Dirt', 'dirt'], ['Grass', 'grass'], ['Sand', 'sand'], ['Gravel', 'gravel'], ['Wood', 'wood'], ['Metal', 'metal'], ['Snow', 'snow'],
]
/** Layers que Unity reserva: no se renombran ni se borran. */
export const RESERVED_LAYERS = [0, 1, 2, 4, 5]

export function defaultTagLayers() {
  const layers = Array.from({ length: MAX_LAYERS }, (_, i) => ({ name: DEFAULT_LAYER_DEFS[i]?.[0] || '', surface: DEFAULT_LAYER_DEFS[i]?.[1] || '' }))
  return { tags: [...BUILTIN_TAGS], groups: [], layers }
}

const cleanName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)

/** Completa y sanea el registro. Las layers reservadas conservan su nombre; las etiquetas integradas no se pierden. */
export function normalizeTagLayers(raw) {
  const def = defaultTagLayers()
  const src = raw && typeof raw === 'object' ? raw : {}
  const tags = [...BUILTIN_TAGS]
  for (const t of Array.isArray(src.tags) ? src.tags : []) {
    const n = cleanName(t)
    if (n && !tags.some((x) => x.toLowerCase() === n.toLowerCase()) && tags.length < MAX_TAGS) tags.push(n)
  }
  const used = new Set()
  const layers = def.layers.map((d, i) => {
    const r = Array.isArray(src.layers) ? src.layers[i] : null
    let name = RESERVED_LAYERS.includes(i) ? d.name : r ? cleanName(typeof r === 'string' ? r : r.name) : d.name
    if (name && used.has(name.toLowerCase())) name = ''
    if (name) used.add(name.toLowerCase())
    let surface = r && typeof r === 'object' ? String(r.surface || '') : (src.layers ? '' : d.surface)
    if (surface && !SURFACES[surface]) surface = ''
    if (!name) surface = ''
    const steps = name && r && typeof r === 'object' ? normalizeSteps(r.steps) : null
    return steps && stepsCount(steps) ? { name, surface, steps } : { name, surface }
  })
  const groups = normalizeGroups(src.groups ?? src.tags?.filter((n) => !BUILTIN_TAGS.includes(n)))
  return { tags, groups, layers }
}

/** Layers de un objeto como lista de índices válidos y únicos (por defecto [0] = Default). */
export function layersOf(obj) {
  const a = Array.isArray(obj?.layers) ? obj.layers : null
  if (!a) return [0]
  const out = []
  for (const v of a) { const n = Math.floor(+v); if (n >= 0 && n < MAX_LAYERS && !out.includes(n)) out.push(n) }
  return out.length ? out : [0]
}
export const tagOf = (obj) => (typeof obj?.tag === 'string' && obj.tag ? obj.tag : DEFAULT_TAG)

/** Máscara de bits (entero de 32) de las layers de un objeto: útil para filtrar. */
export const layerMask = (obj) => layersOf(obj).reduce((m, i) => (m | (1 << i)) >>> 0, 0)

/** Índice de una layer por nombre (sin distinguir mayúsculas) o -1. */
export function layerIndex(tl, name) {
  const k = String(name ?? '').trim().toLowerCase()
  return k ? tl.layers.findIndex((l) => l.name && l.name.toLowerCase() === k) : -1
}
export const layerName = (tl, i) => tl.layers[i]?.name || `Layer ${i}`

/** Superficie de un objeto: la primera de sus layers que la tenga ('' si ninguna). */
export function surfaceOf(tl, obj) {
  for (const i of layersOf(obj)) { const s = tl.layers[i]?.surface; if (s) return s }
  return ''
}

/** Añade una etiqueta; devuelve su nombre final o null si no se pudo (vacía, repetida, lleno). */
export function addTag(tl, name) {
  const n = cleanName(name)
  if (!n || tl.tags.length >= MAX_TAGS || tl.tags.some((t) => t.toLowerCase() === n.toLowerCase())) return null
  tl.tags.push(n); return n
}
/** Quita una etiqueta personalizada (las integradas se quedan). Devuelve true si se quitó. */
export function removeTag(tl, name) {
  const i = tl.tags.indexOf(name)
  if (i < BUILTIN_TAGS.length) return false
  tl.tags.splice(i, 1); return true
}
/** Pone nombre a una ranura libre (8–31 y las no reservadas). Devuelve true si se aplicó. */
export function setLayerName(tl, i, name) {
  if (i < 0 || i >= MAX_LAYERS || RESERVED_LAYERS.includes(i)) return false
  const n = cleanName(name)
  if (n && tl.layers.some((l, j) => j !== i && l.name.toLowerCase() === n.toLowerCase())) return false
  tl.layers[i].name = n
  if (!n) { tl.layers[i].surface = ''; delete tl.layers[i].steps }
  return true
}
/** Cambia el sonido de pasos de una layer con nombre (null o sin clips = quitarlo). */
export function setLayerSteps(tl, i, steps) {
  if (!tl.layers[i]?.name) return false
  const s = normalizeSteps(steps)
  if (s && stepsCount(s)) tl.layers[i].steps = s; else delete tl.layers[i].steps
  return true
}
export function setLayerSurface(tl, i, surface) {
  if (!tl.layers[i]?.name || (surface && !SURFACES[surface])) return false
  tl.layers[i].surface = surface || ''; return true
}

/** Nombre de superficie por defecto de una capa de pintura del terreno («Hierba» → grass). */
export function surfaceFromPaintName(name) {
  const k = String(name || '').toLowerCase()
  const T = [[/hierba|c[eé]sped|grass|pasto/, 'grass'], [/tierra|barro|dirt|mud|suelo/, 'dirt'], [/roca|piedra|stone|rock|cliff/, 'stone'], [/arena|sand|playa/, 'sand'],
    [/grava|gravel|guijarro/, 'gravel'], [/madera|wood/, 'wood'], [/metal/, 'metal'], [/nieve|snow|hielo/, 'snow'], [/agua|water/, 'water']]
  return T.find(([re]) => re.test(k))?.[1] || ''
}
