// Ajustes del mezclador de audio (project.audio) y de las fuentes de audio (nodo AudioSource). Sin DOM: lo usa también el test de Node.
export const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'opus', 'weba']

/** Una única resolución de IDs/nombres para Editor y Player, sin cargar otra escena de audio. */
export function resolveAudioClip(project, clip) {
  if (!clip) return null
  const list = (project?.assets || []).filter(a => AUDIO_EXT.includes(String(a.ext || a.name?.split('.').pop() || '').toLowerCase()))
  const value = String(clip).toLowerCase()
  return (list.find(a => a.id === clip) || list.find(a => a.name.toLowerCase() === value) ||
    list.find(a => a.name.replace(/\.[^.]+$/, '').toLowerCase() === value))?.id || null
}


export const MASTER_ID = 'master'
export const UI_ID = 'ui'
// «ui» (clics de botones, avisos, menús) es un grupo de sistema desde la fase 11: los proyectos antiguos lo reciben al normalizar.
export const BASE_IDS = ['master', 'music', 'sfx', 'voice', 'ambient', 'ui']
export const DEFAULT_GROUPS = [
  { id: 'master', name: 'Master', color: '#5b9bd5' },
  { id: 'music', name: 'Música', color: '#b07fd6' },
  { id: 'sfx', name: 'SFX', color: '#e8a24a' },
  { id: 'voice', name: 'Voz', color: '#5fc88f' },
  { id: 'ambient', name: 'Ambiente', color: '#4ab5c4' },
  { id: 'ui', name: 'UI', color: '#e86aa8' },
]

const clamp = (v, a, b, d) => (Number.isFinite(+v) && v !== '' && v !== null && v !== undefined ? Math.min(b, Math.max(a, +v)) : d)
export const dbToGain = (db) => (db <= -80 ? 0 : Math.pow(10, db / 20))
export const gainToDb = (g) => (g <= 0.0001 ? -80 : 20 * Math.log10(g))

/** Efectos del mezclador. params: { k, label, min, max, step, unit, def } */
export const FX_TYPES = {
  eq3: { label: 'Ecualizador (3 bandas)', params: [
    { k: 'low', label: 'Graves', min: -24, max: 24, step: 0.5, unit: 'dB', def: 0 }, { k: 'mid', label: 'Medios', min: -24, max: 24, step: 0.5, unit: 'dB', def: 0 }, { k: 'high', label: 'Agudos', min: -24, max: 24, step: 0.5, unit: 'dB', def: 0 },
    { k: 'lowFreq', label: 'Corte graves', min: 60, max: 1000, step: 10, unit: 'Hz', def: 250 }, { k: 'highFreq', label: 'Corte agudos', min: 1500, max: 12000, step: 50, unit: 'Hz', def: 4000 }] },
  lowpass: { label: 'Paso bajo', params: [{ k: 'freq', label: 'Frecuencia', min: 100, max: 20000, step: 10, unit: 'Hz', def: 1200 }, { k: 'q', label: 'Resonancia', min: 0.1, max: 12, step: 0.1, unit: '', def: 0.7 }] },
  highpass: { label: 'Paso alto', params: [{ k: 'freq', label: 'Frecuencia', min: 20, max: 8000, step: 5, unit: 'Hz', def: 200 }, { k: 'q', label: 'Resonancia', min: 0.1, max: 12, step: 0.1, unit: '', def: 0.7 }] },
  compressor: { label: 'Compresor', params: [
    { k: 'threshold', label: 'Umbral', min: -60, max: 0, step: 1, unit: 'dB', def: -20 }, { k: 'ratio', label: 'Ratio', min: 1, max: 20, step: 0.5, unit: ':1', def: 4 },
    { k: 'attack', label: 'Ataque', min: 0, max: 200, step: 1, unit: 'ms', def: 10 }, { k: 'release', label: 'Relajación', min: 10, max: 1000, step: 10, unit: 'ms', def: 250 }, { k: 'makeup', label: 'Ganancia', min: 0, max: 24, step: 0.5, unit: 'dB', def: 0 }] },
  limiter: { label: 'Limitador', params: [{ k: 'ceiling', label: 'Techo', min: -24, max: 0, step: 0.5, unit: 'dB', def: -1 }, { k: 'release', label: 'Relajación', min: 10, max: 500, step: 5, unit: 'ms', def: 80 }] },
  reverb: { label: 'Reverb', params: [{ k: 'mix', label: 'Mezcla', min: 0, max: 1, step: 0.01, unit: '%', def: 0.3 }, { k: 'time', label: 'Duración', min: 0.1, max: 10, step: 0.1, unit: 's', def: 1.6 }, { k: 'damping', label: 'Amortiguación', min: 0, max: 1, step: 0.01, unit: '%', def: 0.4 }] },
  echo: { label: 'Eco', params: [{ k: 'time', label: 'Retardo', min: 0.02, max: 1.5, step: 0.01, unit: 's', def: 0.35 }, { k: 'feedback', label: 'Repeticiones', min: 0, max: 0.95, step: 0.01, unit: '%', def: 0.4 }, { k: 'mix', label: 'Mezcla', min: 0, max: 1, step: 0.01, unit: '%', def: 0.3 }] },
  distortion: { label: 'Distorsión', params: [{ k: 'amount', label: 'Cantidad', min: 0, max: 1, step: 0.01, unit: '%', def: 0.4 }, { k: 'mix', label: 'Mezcla', min: 0, max: 1, step: 0.01, unit: '%', def: 1 }] },
}
export const REVERB_PRESETS = {
  habitacion: { label: 'Habitación', time: 0.6, damping: 0.5, mix: 0.25 },
  sala: { label: 'Sala', time: 1.6, damping: 0.4, mix: 0.3 },
  cueva: { label: 'Cueva', time: 4, damping: 0.3, mix: 0.4 },
  catedral: { label: 'Catedral', time: 6.5, damping: 0.2, mix: 0.45 },
  tuberia: { label: 'Túnel / tubería', time: 2.4, damping: 0.8, mix: 0.5 },
}

let fxSeq = 0
export const fxId = () => 'fx' + Date.now().toString(36) + (fxSeq++).toString(36)
export function newFx(type, extra = {}) {
  const d = FX_TYPES[type]
  if (!d) throw new Error('Efecto desconocido: ' + type)
  return normalizeFx({ id: fxId(), type, on: true, ...Object.fromEntries(d.params.map((p) => [p.k, p.def])), ...extra })
}
export function normalizeFx(f) {
  const d = FX_TYPES[f?.type]
  if (!d) return null
  const o = { id: String(f.id || fxId()), type: f.type, on: f.on !== false }
  for (const p of d.params) o[p.k] = clamp(f[p.k], p.min, p.max, p.def)
  return o
}

export const defaultGroup = (id, name, parent = MASTER_ID, color = '#8a93a0') => ({ id, name, parent: id === MASTER_ID ? null : parent, color, volume: 0, mute: false, solo: false, bypass: false, fx: [] })

/** Convierte el formato antiguo (lowpass/highpass/reverb/compressor como objetos fijos) en la lista de efectos. */
function legacyFx(g) {
  const out = []
  for (const t of ['highpass', 'lowpass', 'compressor', 'reverb']) if (g[t] && typeof g[t] === 'object' && g[t].on) out.push(newFx(t, g[t]))
  return out
}

function group(g, i, base) {
  const d = defaultGroup(String(g.id || 'g' + i), String(g.name || 'Grupo'), g.parent || MASTER_ID, base?.color || g.color || '#8a93a0')
  const fx = (Array.isArray(g.fx) ? g.fx.map(normalizeFx) : legacyFx(g)).filter(Boolean)
  return {
    id: d.id, name: d.name.slice(0, 32), parent: d.id === MASTER_ID ? null : d.parent, color: /^#[0-9a-f]{6}$/i.test(g.color || '') ? g.color : d.color,
    volume: clamp(g.volume, -80, 20, 0), mute: !!g.mute, solo: !!g.solo && d.id !== MASTER_ID, bypass: !!g.bypass, fx,
  }
}

/** Normaliza project.audio: siempre existen los cinco grupos base (Master primero); los personalizados se conservan. */
export function normalizeAudio(a) {
  const src = Array.isArray(a?.groups) ? a.groups : []
  const out = []
  for (const base of DEFAULT_GROUPS) {
    const s = src.find((g) => g.id === base.id) || {}
    out.push(group({ ...s, id: base.id, name: s.name || base.name, color: s.color || base.color, parent: base.id === MASTER_ID ? null : s.parent }, out.length, base))
  }
  const seen = new Set(out.map((g) => g.id))
  for (const g of src) if (g && g.id && !seen.has(g.id)) { seen.add(g.id); out.push(group(g, out.length)) }
  // padres válidos y sin ciclos (todo acaba en Master)
  const byId = new Map(out.map((g) => [g.id, g]))
  for (const g of out) {
    if (g.id === MASTER_ID) continue
    if (!g.parent || !byId.has(g.parent) || g.parent === g.id) g.parent = MASTER_ID
  }
  for (const g of out) {
    if (g.id === MASTER_ID) continue
    const chain = new Set([g.id])
    let p = byId.get(g.parent)
    while (p && p.id !== MASTER_ID) { if (chain.has(p.id)) { g.parent = MASTER_ID; break } chain.add(p.id); p = byId.get(p.parent) }
  }
  const snaps = (Array.isArray(a?.snapshots) ? a.snapshots : []).filter((s) => s && s.id && s.name).map((s) => ({ id: String(s.id), name: String(s.name).slice(0, 32), groups: s.groups && typeof s.groups === 'object' ? s.groups : {} }))
  return { groups: out, snapshots: snaps, startSnapshot: snaps.some((s) => s.id === a?.startSnapshot) ? a.startSnapshot : '', remember: a?.remember !== false }
}
export const defaultAudio = () => normalizeAudio({})
export const groupName = (audio, id) => audio.groups.find((g) => g.id === id)?.name || id
/** Destino canónico de una clave de Timeline, sin modificar su referencia guardada.
 * Los IDs prevalecen; los nombres solo sirven para recursos antiguos.
 * Una referencia huérfana reproduce en SFX, pero sigue marcada como ausente. */
export function resolveAudioGroup(audio, reference) {
  const raw = typeof reference === 'string' ? reference.trim() : ''
  const requested = raw || 'sfx'
  const groups = Array.isArray(audio?.groups) ? audio.groups : []
  const found = groups.find(g => g.id === requested) ||
    groups.find(g => String(g.name || '').toLowerCase() === requested.toLowerCase())
  const fallback = groups.find(g => g.id === 'sfx') || groups.find(g => g.id === MASTER_ID)
  return {
    id: found?.id || fallback?.id || 'sfx',
    reference: requested,
    missing: !!raw && !found,
    legacy: !!found && found.id !== requested,
  }
}
/** Ids de los descendientes de un grupo. */
export const descendants = (audio, id) => { const out = []; const walk = (p) => { for (const g of audio.groups) if (g.parent === p) { out.push(g.id); walk(g.id) } }; walk(id); return out }
/** Orden de árbol con profundidad, para listas. */
export function groupTree(audio) {
  const out = []
  const walk = (p, d) => { for (const g of audio.groups) if ((g.parent || null) === p) { out.push({ g, depth: d }); walk(g.id, d + 1) } }
  const m = audio.groups.find((g) => g.id === MASTER_ID)
  out.push({ g: m, depth: 0 }); walk(MASTER_ID, 1)
  return out
}
/** Foto del estado actual del mezclador (para un snapshot). */
export function captureSnapshot(audio) {
  const groups = {}
  for (const g of audio.groups) groups[g.id] = { volume: g.volume, mute: g.mute, fx: Object.fromEntries(g.fx.map((f) => [f.id, { ...f }])) }
  return groups
}

export const ROLLOFFS = { logarithmic: 'Logarítmica', linear: 'Lineal' }
export const SOURCE_MODES = { '3d': '3D (espacial)', ui: 'UI / 2D' }
export const SOURCE_DEFAULTS = {
  clip: '', group: 'sfx', mode: '3d', volume: 1, pitch: 1, loop: false, playOnStart: true, mute: false, delay: 0,
  minDistance: 1, maxDistance: 30, rolloff: 'logarithmic', spread: 360, coneInner: 360, coneOuter: 360, coneOuterGain: 0, hrtf: false, occlusion: false,
}
export function normalizeSource(p = {}) {
  const d = SOURCE_DEFAULTS
  const min = clamp(p.minDistance, 0.1, 1000, d.minDistance)
  return {
    clip: typeof p.clip === 'string' ? p.clip : '', group: typeof p.group === 'string' && p.group ? p.group : d.group, mode: p.mode === 'ui' ? 'ui' : '3d',
    volume: clamp(p.volume, 0, 2, d.volume), pitch: clamp(p.pitch, 0.1, 4, d.pitch), loop: !!p.loop, playOnStart: p.playOnStart !== false, mute: !!p.mute, delay: clamp(p.delay, 0, 60, 0),
    minDistance: min, maxDistance: Math.max(min + 0.1, clamp(p.maxDistance, 0.2, 5000, d.maxDistance)),
    rolloff: p.rolloff === 'linear' ? 'linear' : 'logarithmic', coneInner: clamp(p.coneInner, 0, 360, 360), coneOuter: clamp(p.coneOuter, 0, 360, 360), coneOuterGain: clamp(p.coneOuterGain, 0, 1, 0), hrtf: !!p.hrtf, occlusion: p.mode !== 'ui' && p.occlusion === true,
  }
}
