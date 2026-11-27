// Nether Film Maker · montaje (modo edición): la película final es una SECUENCIA de planos. Cada plano es un trozo [in, out] de
// un pase de cámara (y de la toma del actor que acompaña), con su filtro; encima van las capas (subtítulos, fundidos, barras de
// cine, temblor) en tiempo de la secuencia. Sin DOM ni three: lo usan la app, Century (al importar) y las pruebas.
//
//   film.edit = { shots:[{ id, pass, in, out, filter, tin:{ kind:'cut'|'black'|'white', dur } }],  ← planos (tin = transición de entrada)
//                 outro:{ kind, dur },                                                         ← cómo termina (fundido a negro…)
//                 layers:[{ id, kind, t0, t1, params }],                                         ← texto y efectos
//                 audio:[{ id, name, group, volume, mute, solo, clips:[{ id, asset, name, start, in, dur, volume, fadeIn, fadeOut }] }],
//                 filters:[{ id, name, fx }] }                                                   ← color por plano
import { newTimeline, newTrack, newKey } from '../core/timeline/model.js'
import { LAYER_KINDS, newLayer } from '../core/capture/format.js'
import { sampleCamera } from '../core/capture/edit.js'
import { qFromEulerYXZ, qMul, qRot, eulerFromQYXZ } from '../core/capture/math.js'
import { sampleShake } from '../engine/runtime/events/play-camera-shake.js'
import { uid } from '../engine/runtime/util.js'
import { normalizeNodeTracks } from './node-tracks.js'
import { normalizePhysicsBakes } from './physics-data.js'
import { convertFilmMotion } from './montage-motion.js'

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d)
const r3 = (v) => Math.round(v * 1000) / 1000

/** Filtros listos para usar (efectos de los perfiles de post-proceso de Century). */
export const FILTER_PRESETS = {
  bn: { name: 'Blanco y negro', fx: { color: { on: true, saturation: 0, contrast: 1.15 } } },
  noir: { name: 'Noir', fx: { color: { on: true, saturation: 0, contrast: 1.45 }, vignette: { on: true, vignette: 0.7 }, grain: { on: true, grain: 0.12 } } },
  calido: { name: 'Cálido', fx: { tint: { on: true, shadowTint: '#a0785a', highlightTint: '#ffc98a', tintStrength: 0.45 }, color: { on: true, saturation: 1.1, contrast: 1.05 } } },
  frio: { name: 'Frío', fx: { tint: { on: true, shadowTint: '#5a7aa8', highlightTint: '#cfe6ff', tintStrength: 0.45 }, color: { on: true, saturation: 0.85, contrast: 1.08 } } },
  vintage: { name: 'Vintage', fx: { color: { on: true, saturation: 0.7, contrast: 0.92 }, tint: { on: true, shadowTint: '#6b5a44', highlightTint: '#ffe0b0', tintStrength: 0.4 }, vignette: { on: true, vignette: 0.55 }, grain: { on: true, grain: 0.18 } } },
  sueno: { name: 'Sueño', fx: { bloom: { on: true, bloom: 1.4, bloomThreshold: 0.5, bloomRadius: 1.0 }, color: { on: true, saturation: 0.9, contrast: 0.9 } } },
  epico: { name: 'Épico', fx: { color: { on: true, saturation: 1.15, contrast: 1.25 }, vignette: { on: true, vignette: 0.45 }, chromatic: { on: true, chromatic: 0.003 } } },
}

export const TRANSITIONS = { cut: 'Corte', black: 'Fundido a negro', white: 'Fundido a blanco' }
const trans = (t, d = 0.6) => ({ kind: TRANSITIONS[t?.kind] ? t.kind : 'cut', dur: Math.min(5, Math.max(0.05, num(t?.dur, d))) })
export function normalizeEdit(e = {}) {
  const shots = (Array.isArray(e?.shots) ? e.shots : []).filter((s) => s && s.pass).map((s) => {
    const a = Math.max(0, num(s.in)), b = Math.max(a + 0.05, num(s.out, a + 1))
    return { id: String(s.id || uid('shot')), pass: String(s.pass), in: r3(a), out: r3(b), filter: String(s.filter || ''), tin: trans(s.tin) }
  })
  const audio = (Array.isArray(e?.audio) ? e.audio : []).filter((t) => t && t.id).map((t) => ({
    id: String(t.id), name: String(t.name || 'Audio'), group: String(t.group || 'music'), volume: Math.min(2, Math.max(0, num(t.volume, 1))), mute: !!t.mute, solo: !!t.solo,
    clips: (Array.isArray(t.clips) ? t.clips : []).filter((c) => c && c.asset).map((c) => {
      const dur = Math.max(0.05, num(c.dur, 1))
      return { id: String(c.id || uid('ac')), asset: String(c.asset), name: String(c.name || 'Clip'), start: r3(Math.max(0, num(c.start))), in: r3(Math.max(0, num(c.in))), dur: r3(dur), len: Math.max(0, num(c.len, 0)),
        volume: Math.min(2, Math.max(0, num(c.volume, 1))), fadeIn: r3(Math.min(dur / 2, Math.max(0, num(c.fadeIn)))), fadeOut: r3(Math.min(dur / 2, Math.max(0, num(c.fadeOut)))) }
    }).sort((a, b) => a.start - b.start),
  }))
  const layers = (Array.isArray(e?.layers) ? e.layers : []).filter((l) => LAYER_KINDS[l?.kind]).map((l) => ({ id: String(l.id || uid('ly')), kind: l.kind, t0: Math.max(0, num(l.t0)), t1: Math.max(num(l.t0), num(l.t1, l.t0)), params: { ...LAYER_KINDS[l.kind].params, ...(l.params || {}) } }))
  const filters = (Array.isArray(e?.filters) ? e.filters : []).filter((f) => f && f.id).map((f) => ({ id: String(f.id), name: String(f.name || 'Filtro'), fx: f.fx && typeof f.fx === 'object' ? JSON.parse(JSON.stringify(f.fx)) : {} }))
  return { shots, layers, filters, audio, nodeTracks: normalizeNodeTracks(e?.nodeTracks), physicsBakes: normalizePhysicsBakes(e?.physicsBakes), outro: trans(e?.outro, 1) }
}

const passOf = (film, id) => film.passes.find((p) => p.id === id)
/** Planos con su sitio en la secuencia: [{ shot, pass, start, end, dur }] y la duración total. */
export function sequence(film) {
  const out = []; let t = 0
  for (const shot of film.edit?.shots || []) {
    const pass = passOf(film, shot.pass); if (!pass) continue
    const a = Math.min(shot.in, pass.duration), b = Math.min(Math.max(shot.out, a + 0.05), Math.max(pass.duration, a + 0.05))
    out.push({ shot, pass, start: r3(t), end: r3(t + b - a), in: a, out: b, dur: r3(b - a) })
    t += b - a
  }
  return { items: out, total: r3(t) }
}
/** Descripción de consulta del rodaje: solo nombres y rangos de edición reales.
 * La película se ejecuta siempre con las pistas normales de Timeline.
 */
export function cinematicReel(film, passId = null) {
  const seq = passId
    ? { items: (film.passes || []).filter(pass => pass.id === passId).map(pass => ({
        shot: { id: pass.id, tin: { kind: 'cut' } }, pass,
        start: 0, end: Math.max(0, pass.duration), dur: Math.max(0, pass.duration),
      })) }
    : sequence(film)
  const cameras = new Map((film.cameras || []).map(c => [c.id, c.name]))
  const shots = seq.items.map((item, index) => ({
    id: item.shot.id, start: item.start, end: item.end,
    name: item.pass.name || `Plano ${index + 1}`,
    camera: cameras.get(item.pass.cameraId) || '',
    actor: item.pass.take >= 0 ? (film.takes?.[item.pass.take]?.name || `Toma ${item.pass.take + 1}`) : '',
    transition: item.shot.tin?.kind || 'cut',
  }))
  const label = layer => layer.kind === 'text' ? String(layer.params?.text || 'Texto').slice(0, 80)
    : layer.kind === 'fade' ? 'Fundido' : layer.kind === 'letterbox' ? 'Barras de cine'
    : layer.kind === 'shake' ? 'Temblor' : String(layer.kind || 'Efecto')
  const layers = passId ? [] : (film.edit?.layers || []).map(layer => ({
    id: layer.id, start: layer.t0, end: layer.t1,
    kind: layer.kind, name: label(layer),
  }))
  return { shots, layers }
}

/** ¿Qué plano se ve en el tiempo T de la secuencia? → { index, item, local } (local = tiempo del pase / del entorno). */
export function locate(seq, T) {
  const items = seq.items
  if (!items.length) return null
  let i = items.findIndex((it) => T < it.end)
  if (i < 0) i = items.length - 1
  const it = items[i]
  return { index: i, item: it, local: Math.min(it.out, it.in + Math.max(0, T - it.start)) }
}

// ---- edición (devuelven un `edit` nuevo) ----
const E = (film) => normalizeEdit(film.edit)
export function addShot(film, passId) { const p = passOf(film, passId); if (!p) return E(film); const e = E(film); e.shots.push({ id: uid('shot'), pass: passId, in: 0, out: r3(p.duration), filter: '', tin: { kind: 'cut', dur: 0.6 } }); return normalizeEdit(e) }
/** Un plano editorial usa exactamente el modelo pass/shot de los pases grabados, sin tomar ni grabar nada. */
export function createEditorialShot(film, cameraId, duration = 5, pose = null) {
  const camera = film?.cameras?.find(c => c.id === cameraId)
  if (!camera) throw new Error('Selecciona una cámara cinematográfica válida')
  if (!Number.isFinite(duration) || duration < 0.1 || duration > 3600) throw new Error('Duración de plano fuera de 0.1–3600 segundos')
  const source = pose || camera.pose
  if (!source || !['pos', 'rot'].every(k => Array.isArray(source[k]) && source[k].length === 3 && source[k].every(Number.isFinite)) || !Number.isFinite(source.fov)) {
    throw new Error('La cámara no tiene un encuadre editorial válido')
  }
  const d = r3(duration), sample = { pos: [...source.pos], rot: [...source.rot], fov: source.fov }
  const pass = { id: uid('pass_'), name: `Plano · ${camera.name}`, take: -1, input: 'editor', cameraId: camera.id,
    operator: null, duration: d, keys: [{ t: 0, ...sample }, { t: d, ...sample }] }
  const withPass = { ...film, passes: [...(film.passes || []), pass] }
  const edit = addShot(withPass, pass.id)
  return { film: { ...withPass, edit }, passId: pass.id, shotId: edit.shots.at(-1).id }
}
/** Solo los planos editoriales pueden ampliar su duración sin datos de captura detrás. */
export function resizeEditorialShot(film, shotId, out) {
  const shot = film.edit?.shots?.find(s => s.id === shotId)
  const pass = shot && passOf(film, shot.pass)
  if (!pass || pass.input !== 'editor') throw new Error('Solo los planos editoriales admiten ampliar el encuadre fijo')
  if (!Number.isFinite(out) || out <= shot.in + 0.05 || out > 3600) throw new Error('Duración de plano inválida')
  const next = r3(out)
  const passes = film.passes.map(p => p.id !== pass.id || next <= p.duration ? p :
    { ...p, duration: next, keys: [...p.keys, { ...p.keys.at(-1), t: next }] })
  const edit = updateShot({ ...film, passes }, shotId, { out: next })
  return { ...film, passes, edit }
}
export function updateShot(film, id, patch) { const e = E(film); const s = e.shots.find((x) => x.id === id); if (s) Object.assign(s, patch); return normalizeEdit(e) }
/** Lleva el plano a la posición `index` de la secuencia (arrastrar en el timeline). */
export function reorderShot(film, id, index) { const e = E(film); const i = e.shots.findIndex((x) => x.id === id); if (i < 0) return e; const [s] = e.shots.splice(i, 1); e.shots.splice(Math.max(0, Math.min(e.shots.length, index)), 0, s); return e }
export function moveShot(film, id, dir) { const e = E(film); const i = e.shots.findIndex((x) => x.id === id), j = i + dir; if (i >= 0 && j >= 0 && j < e.shots.length) [e.shots[i], e.shots[j]] = [e.shots[j], e.shots[i]]; return e }
export function duplicateShot(film, id) {
  const e = E(film), i = e.shots.findIndex(s => s.id === id)
  if (i < 0) return { edit: e, id: null }
  const shot = { ...e.shots[i], id: uid('shot'), tin: { ...e.shots[i].tin } }
  e.shots.splice(i + 1, 0, shot)
  return { edit: normalizeEdit(e), id: shot.id }
}
export function duplicateLayer(film, id) {
  const e = E(film), layer = e.layers.find(l => l.id === id)
  if (!layer) return { edit: e, id: null }
  const dur = Math.max(.05, layer.t1 - layer.t0)
  const duplicated = { ...layer, id: uid('ly'), t0: r3(layer.t1), t1: r3(layer.t1 + dur), params: { ...layer.params } }
  e.layers.push(duplicated)
  return { edit: normalizeEdit(e), id: duplicated.id }
}
export function duplicateAudioClip(film, id) {
  const e = E(film), source = findClip(e, id)
  if (!source) return { edit: e, id: null }
  const duplicated = { ...source.c, id: uid('ac'), start: r3(source.c.start + source.c.dur) }
  source.t.clips.push(duplicated)
  return { edit: normalizeEdit(e), id: duplicated.id }
}
export function removeShot(film, id) { const e = E(film); e.shots = e.shots.filter((x) => x.id !== id); return e }
/** Divide el plano en el instante local `t` (tiempo del pase): dos planos seguidos. */
export function splitShot(film, id, t) {
  const e = E(film); const i = e.shots.findIndex((x) => x.id === id); if (i < 0) return e
  const s = e.shots[i]; if (t <= s.in + 0.05 || t >= s.out - 0.05) return e
  e.shots.splice(i, 1, { ...s, out: r3(t) }, { ...s, id: uid('shot'), in: r3(t) })
  return e
}
export function addLayer(film, kind, t, len = 2) { const e = E(film); const l = newLayer(kind, r3(t), r3(t + len)); e.layers.push(l); return { edit: e, id: l.id } }
export function updateLayer(film, id, patch) { const e = E(film); const l = e.layers.find((x) => x.id === id); if (l) { if (patch.params) Object.assign(l.params, patch.params); for (const k of ['t0', 't1']) if (patch[k] !== undefined) l[k] = r3(Math.max(0, patch[k])) ; if (l.t1 < l.t0 + 0.05) l.t1 = l.t0 + 0.05 } return normalizeEdit(e) }
/** Divide una capa (texto o efecto) en T. */
export function splitLayer(film, id, T) { const e = E(film); const i = e.layers.findIndex((x) => x.id === id); if (i < 0) return e; const l = e.layers[i]; if (T <= l.t0 + 0.05 || T >= l.t1 - 0.05) return e; e.layers.splice(i + 1, 0, { ...l, id: uid('ly'), t0: r3(T), params: { ...l.params } }); l.t1 = r3(T); return e }
export function removeLayer(film, id) { const e = E(film); e.layers = e.layers.filter((l) => l.id !== id); return e }
export function addFilter(film, preset) { const e = E(film); const p = FILTER_PRESETS[preset] || { name: 'Filtro', fx: {} }; const f = { id: uid('flt'), name: p.name, fx: JSON.parse(JSON.stringify(p.fx)) }; e.filters.push(f); return { edit: e, id: f.id } }
export function updateFilter(film, id, effect, patch) { const e = E(film); const f = e.filters.find((x) => x.id === id); if (f) f.fx[effect] = { ...(f.fx[effect] || { on: true }), ...patch }; return e }
export function removeFilter(film, id) { const e = E(film); e.filters = e.filters.filter((f) => f.id !== id); for (const s of e.shots) if (s.filter === id) s.filter = ''; return e }

// ---- transiciones ----
export function setTransition(film, shotId, patch) { const e = E(film); const s = e.shots.find((x) => x.id === shotId); if (s) s.tin = trans({ ...s.tin, ...patch }); return e }
export function setOutro(film, patch) { const e = E(film); e.outro = trans({ ...e.outro, ...patch }, 1); return e }
/** Fundido por transiciones en T: { alpha 0–1, color }. */
export function transitionAt(film, seq, T) {
  let alpha = 0, color = '#000000'
  const col = (k) => (k === 'white' ? '#ffffff' : '#000000')
  seq.items.forEach((it, i) => {
    const t = it.shot.tin; if (t.kind === 'cut') return
    if (i === 0) { if (T < t.dur) { const a = 1 - T / t.dur; if (a > alpha) { alpha = a; color = col(t.kind) } } return } // entrada desde negro/blanco
    const h = t.dur / 2, d = Math.abs(T - it.start)
    if (d < h) { const a = 1 - d / h; if (a > alpha) { alpha = a; color = col(t.kind) } }
  })
  const o = film.edit?.outro
  if (o && o.kind !== 'cut' && T > seq.total - o.dur) { const a = Math.min(1, (T - (seq.total - o.dur)) / o.dur); if (a > alpha) { alpha = a; color = col(o.kind) } }
  return { alpha, color }
}

// ---- pistas de audio ----
export function addAudioTrack(film, name, group = 'music') { const e = E(film); const t = { id: uid('at'), name: name || `Audio ${e.audio.length + 1}`, group, volume: 1, mute: false, solo: false, clips: [] }; e.audio.push(t); return { edit: e, id: t.id } }
export function updateAudioTrack(film, id, patch) { const e = E(film); const t = e.audio.find((x) => x.id === id); if (t) Object.assign(t, patch); return normalizeEdit(e) }
export function removeAudioTrack(film, id) { const e = E(film); e.audio = e.audio.filter((t) => t.id !== id); return e }
/** Añade un archivo de audio a una pista en T. `asset` = { id, name, duration } (duración real del archivo, si se conoce). */
export function addAudioClip(film, trackId, asset, start = 0) {
  const e = E(film); const t = e.audio.find((x) => x.id === trackId); if (!t) return { edit: e, id: null }
  const len = Math.max(0.05, num(asset.duration, 5))
  const c = { id: uid('ac'), asset: asset.id, name: asset.name || 'Clip', start: r3(Math.max(0, start)), in: 0, dur: r3(len), len, volume: 1, fadeIn: 0, fadeOut: 0 }
  t.clips.push(c); t.clips.sort((a, b) => a.start - b.start)
  return { edit: normalizeEdit(e), id: c.id }
}
const findClip = (e, clipId) => { for (const t of e.audio) { const c = t.clips.find((x) => x.id === clipId); if (c) return { t, c } } return null }
/** Cambia un clip (start, in, dur, volume, fadeIn, fadeOut). `in + dur` no pasa del largo del archivo si se conoce. */
export function updateAudioClip(film, clipId, patch) {
  const e = E(film); const f = findClip(e, clipId); if (!f) return e
  Object.assign(f.c, patch)
  if (f.c.len > 0) { f.c.in = Math.min(f.c.in, Math.max(0, f.c.len - 0.05)); f.c.dur = Math.min(f.c.dur, f.c.len - f.c.in) }
  return normalizeEdit(e)
}
export function moveAudioClip(film, clipId, trackId, start) {
  const e = E(film); const f = findClip(e, clipId); const to = e.audio.find((x) => x.id === trackId); if (!f || !to) return e
  f.t.clips = f.t.clips.filter((c) => c.id !== clipId); f.c.start = r3(Math.max(0, start)); to.clips.push(f.c)
  return normalizeEdit(e)
}
export function splitAudioClip(film, clipId, T) {
  const e = E(film); const f = findClip(e, clipId); if (!f) return e
  const c = f.c, cut = T - c.start
  if (cut <= 0.05 || cut >= c.dur - 0.05) return e
  const b = { ...c, id: uid('ac'), start: r3(T), in: r3(c.in + cut), dur: r3(c.dur - cut), fadeIn: 0 }
  c.dur = r3(cut); c.fadeOut = 0
  f.t.clips.push(b)
  return normalizeEdit(e)
}
export function removeAudioClip(film, clipId) { const e = E(film); for (const t of e.audio) t.clips = t.clips.filter((c) => c.id !== clipId); return e }
/** Ganancia del fundido de un clip en su tiempo local u (0…dur). */
export const clipEnvelope = (c, u) => Math.max(0, Math.min(1, c.fadeIn > 0 ? u / c.fadeIn : 1, c.fadeOut > 0 ? (c.dur - u) / c.fadeOut : 1))
/** Lo que suena en T: [{ track, clip, offset (segundo del archivo), gain }] respetando silencio y solo. */
export function audioAt(film, T) {
  const tracks = film.edit?.audio || [], solo = tracks.some((t) => t.solo)
  const out = []
  for (const t of tracks) {
    if (t.mute || (solo && !t.solo)) continue
    for (const c of t.clips) if (T >= c.start && T < c.start + c.dur) out.push({ track: t, clip: c, offset: c.in + (T - c.start), gain: t.volume * c.volume * clipEnvelope(c, T - c.start) })
  }
  return out
}
/** Contenido reproducible: las capas son overlays, no una película independiente. */
export function hasMontageContent(film, seq = film ? sequence(film) : { items: [] }) {
  const edit = film?.edit
  return !!(edit && (
    seq.items.length ||
    edit.nodeTracks?.some((tr) => !tr.muted && tr.properties?.some((part) => part.keys?.length)) ||
    edit.physicsBakes?.length ||
    edit.audio?.some((track) => track.clips?.length)
  ))
}
/** Duración efectiva de los planos, pistas y overlays de un montaje reproducible. */
export function filmEnd(film, seq = sequence(film)) {
  let end = seq.total
  for (const t of film.edit?.audio || []) for (const c of t.clips) end = Math.max(end, c.start + c.dur)
  for (const tr of film.edit?.nodeTracks || []) if (!tr.muted) for (const part of tr.properties) for (const key of part.keys) end = Math.max(end, key.t)
  for (const b of film.edit?.physicsBakes || []) end = Math.max(end, b.start + b.duration)
  // Texto y efectos pueden continuar sobre el último fotograma, nunca arrancar solos una película.
  if (hasMontageContent(film, seq)) for (const layer of film.edit?.layers || []) end = Math.max(end, layer.t1)
  return r3(end)
}

/** Lo que se ve en T: subtítulo, fundido (0–1), barras (%), temblor (°). */
export function effectsAt(film, T) {
  const out = { caption: '', captionPos: 'bottom', fade: 0, fadeColor: '#000000', letterbox: 0, shake: 0 }
  for (const l of film.edit?.layers || []) {
    if (T < l.t0 || T > l.t1) continue
    const u = (T - l.t0) / Math.max(1e-6, l.t1 - l.t0)
    if (l.kind === 'text') { out.caption = String(l.params.text ?? ''); out.captionPos = l.params.pos || 'bottom' }
    else if (l.kind === 'fade') { out.fade = Math.max(out.fade, l.params.dir === 'in' ? 1 - u : u); out.fadeColor = l.params.color || '#000000' }
    else if (l.kind === 'letterbox') out.letterbox = Math.max(out.letterbox, +l.params.percent || 0)
    else if (l.kind === 'shake') out.shake = Math.max(out.shake, +l.params.amount || 0)
  }
  return out
}
const shakeNoise = (t, s) => Math.sin(t * 12.9898 + s * 78.233) * 0.5 + Math.sin(t * 7.13 + s * 3.7) * 0.3 + Math.sin(t * 19.7 + s * 1.3) * 0.2
/** Compone la pose base con la receta Gameplay, referenciada por ID desde una cámara editorial.
 * El shake no entra en pass.keys ni en el proyecto: se hornea solo al previsualizar/exportar.
 */
export function cameraForPass(film, pass, local, context = {}) {
  const base = sampleCamera(pass?.keys || [], local)
  if (!base) return null
  const camera = film?.cameras?.find(c => c.id === pass.cameraId)
  const shake = camera?.operator?.shake
  if (!shake?.nodeId || !shake.intensity) return base
  const node = context.objects?.find(o => o.id === shake.nodeId && o.type === 'cameraShake')
  if (!node) { context.onMissingShake?.(shake.nodeId); return base }
  if (node.visible === false) return base
  const offset = sampleShake(node.props, Math.max(0, local), context.animations || [], true)
  if (!offset) return base
  const q = qFromEulerYXZ(...base.rot)
  const scale = shake.intensity
  const delta = qRot(q, offset.position.map(x => x * scale))
  const localRot = offset.rotation.map(x => x * scale * 180 / Math.PI)
  return { ...base, pos: base.pos.map((x, i) => x + delta[i]), rot: eulerFromQYXZ(qMul(q, qFromEulerYXZ(...localRot))) }
}
/** Cámara de la secuencia en T (con el temblor de las capas ya aplicado). */
export function cameraAt(film, seq, T, context = {}) {
  const loc = locate(seq, T); if (!loc) return null
  const pass = loc.item.pass
  const k = cameraForPass(film, pass, loc.local, context)
  if (!k) return null
  const activeNode = !!film?.cameras?.find(c => c.id === pass.cameraId)?.operator?.shake?.nodeId
  const sh = activeNode ? 0 : effectsAt(film, T).shake // capa shake legacy: no duplicar con la receta Gameplay
  return sh ? { ...k, rot: [k.rot[0] + shakeNoise(T, 1) * sh, k.rot[1] + shakeNoise(T, 2) * sh, k.rot[2] + shakeNoise(T, 3) * sh * 0.5] } : k
}

/**
 * La secuencia como UNA cinemática de Century: cámara con cortes entre planos, el actor de cada plano (clip desde `in`),
 * el filtro de cada plano (comando «Perfil de post-proceso») y las capas (Subtítulo, Fundido, Barras de cine; el temblor va en la cámara).
 * @param o { name, node (id del actor), clipOf(takeIndex) → nombre del clip, profileOf(filterId) → nombre del .profile }
 */
export function montageTimeline(film, o = {}) {
  const seq = sequence(film)
  const tl = newTimeline(o.name || `Montaje · ${film.name}`, { duration: Math.max(0.1, seq.total) })
  const cam = newTrack('camera', { name: 'Cámara (montaje)', path: 'linear' })
  const cmds = newTrack('commands', { name: 'Planos y efectos' })
  const cmd = (code, p) => ({ id: uid('c'), code, p, b: {} })
  seq.items.forEach((it, i) => {
    const ks = it.pass.keys.filter((k) => k.t > it.in + 1e-4 && k.t < it.out - 1e-4)
    const pts = [it.in, ...ks.map((k) => k.t), it.out]
    pts.forEach((lt, j) => {
      const T = it.start + (lt - it.in), k = cameraAt(film, seq, Math.min(T, it.end - 1e-4), o) || cameraForPass(film, it.pass, lt, o)
      const last = j === pts.length - 1
      cam.keys.push(newKey('camera', r3(last && i < seq.items.length - 1 ? it.end - 0.001 : T), { mode: 'free', pos: [...k.pos], rot: k.rot.map(r3), fov: r3(k.fov), ease: last ? 'cut' : 'linear' }))
    })
    const list = []
    const clip = it.pass.take >= 0 ? o.clipOf?.(it.pass.take) : ''
    if (clip && o.node) list.push(cmd('playAnimation', { node: o.node, clip, loop: 'no', speed: 1, fade: 0, from: r3(it.in), layer: '', mask: '', weight: 1, wait: false }))
    const prof = it.shot.filter ? o.profileOf?.(it.shot.filter) || '' : ''
    if (prof || i > 0) list.push(cmd('profile', { profile: prof, seconds: 0, wait: false }))
    if (list.length) cmds.keys.push(newKey('commands', r3(it.start), { name: `Plano ${i + 1}`, essential: true, list }))
  })
  for (const l of film.edit?.layers || []) {
    const len = Math.max(0.05, r3(l.t1 - l.t0))
    if (l.kind === 'text') cmds.keys.push(newKey('commands', r3(l.t0), { name: 'Subtítulo', list: [cmd('caption', { text: String(l.params.text ?? ''), seconds: len, pos: l.params.pos || 'bottom', wait: false })] }))
    else if (l.kind === 'fade') cmds.keys.push(newKey('commands', r3(l.t0), { name: 'Fundido', essential: l.params.dir === 'in', list: [cmd('fade', { dir: l.params.dir === 'in' ? 'in' : 'out', seconds: len, color: l.params.color || '#000000' })] }))
    else if (l.kind === 'letterbox') {
      const pc = Math.min(25, Math.max(0, +l.params.percent || 12))
      if (l.t0 <= 0.05 && l.t1 >= seq.total - 0.05) { tl.letterbox = pc; continue }
      cmds.keys.push(newKey('commands', r3(l.t0), { name: 'Barras de cine', list: [cmd('letterbox', { percent: pc })] }))
      cmds.keys.push(newKey('commands', r3(l.t1), { name: 'Quitar barras', list: [cmd('letterbox', { percent: 0 })] }))
    }
  }
  if (seq.items.some((it) => it.shot.filter)) cmds.keys.push(newKey('commands', r3(seq.total), { name: 'Fin del filtro', essential: true, list: [cmd('profile', { profile: '', seconds: 0, wait: false })] }))
  // transiciones: fundidos de pantalla alrededor de cada corte (y al empezar / terminar)
  const fadeCol = (k) => (k === 'white' ? '#ffffff' : '#000000')
  seq.items.forEach((it, i) => {
    const t = it.shot.tin; if (t.kind === 'cut') return
    if (i === 0) { cmds.keys.push(newKey('commands', 0, { name: 'Entrada', essential: true, list: [cmd('fade', { dir: 'out', seconds: 0, color: fadeCol(t.kind) }), cmd('fade', { dir: 'in', seconds: r3(t.dur), color: fadeCol(t.kind) })] })); return }
    const h = r3(t.dur / 2)
    cmds.keys.push(newKey('commands', r3(Math.max(0, it.start - h)), { name: `Transición ${i + 1}`, essential: true, list: [cmd('fade', { dir: 'out', seconds: h, color: fadeCol(t.kind) })] }))
    cmds.keys.push(newKey('commands', r3(it.start), { name: `Transición ${i + 1} (entra)`, essential: true, list: [cmd('fade', { dir: 'in', seconds: h, color: fadeCol(t.kind) })] }))
  })
  const ou = film.edit?.outro
  if (ou && ou.kind !== 'cut' && seq.items.length) cmds.keys.push(newKey('commands', r3(Math.max(0, seq.total - ou.dur)), { name: 'Final', list: [cmd('fade', { dir: 'out', seconds: r3(ou.dur), color: fadeCol(ou.kind) })] }))
  cmds.keys.sort((a, b) => a.t - b.t)
  // pistas de audio → pistas de audio del Timeline (cada clip: desde su segundo, con sus fundidos y su duración)
  const tracksA = film.edit?.audio || [], solo = tracksA.some((t) => t.solo)
  const audioTracks = tracksA.filter((t) => !t.mute && (!solo || t.solo) && t.clips.length).map((t) => {
    const tr = newTrack('audio', { name: t.name })
    tr.keys = t.clips.map((c) => newKey('audio', r3(c.start), { action: 'play', clip: o.clipName?.(c.asset) || c.asset, group: t.group, volume: r3(t.volume * c.volume), offset: r3(c.in), fadeIn: c.fadeIn > 0 ? c.fadeIn : 0, duration: r3(c.dur), fadeOut: c.fadeOut }))
    return tr
  })
  tl.duration = Math.max(tl.duration, filmEnd(film, seq))
  tl.tracks = [cam, ...(cmds.keys.length ? [cmds] : []), ...audioTracks, ...convertFilmMotion(film, o.objects, o.overrides)]
  return tl
}
