// Nether Film Maker · proyecto de película (.nfm). Sin DOM ni three: lo usan la app, Century y las pruebas.
//
//  .nfm = zip { film.json, scene.lfproj }
//    scene.lfproj  el proyecto de Century tal cual (todas sus escenas y archivos): el ENTORNO. Se puede sustituir
//                  por una versión nueva sin tocar nada de la película.
//    film.json     { format:'nfm', id, name, created, updated,
//                    scene:{ id, name, projectId, projectName },   ← escena de la película dentro del proyecto
//                    seed,                                         ← semilla del clima (rayos) para que cada reproducción sea idéntica
//                    cameras:[{id,name,operator,pose}], activeCameraId, // autoría exclusiva de FilmMaker
//                    actor:{ objectId, modelId },
//                    takes:[captura .lfcap], passes:[pase de cámara], edit:{ shots, layers, filters } (montaje, montage.js),
//                    overrides:{ [id de objeto]: { position?, rotation?, scale?, props?, visible?, … } }   ← objetos ajustados (vuelven a Century)
//                    scene:{ …, env?, render?, audio? }   ← atmósfera (entorno), color (render) y mezclador cambiados: vuelven a la escena
//                    assets:[{ id, name, folder, kind, ext }] } ← archivos añadidos en la app (audio, imágenes): van en assets/<id> del zip
import JSZip from 'jszip'
import { normalizeEdit } from './montage.js'
import { FILM_FRAME_PRESETS, normalizeFilmFrame } from './frame.js'

export const NFM = 'nfm'
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d)
const vec = (v) => (Array.isArray(v) && v.length === 3 && v.every((x) => Number.isFinite(+x)) ? v.map((x) => +x) : null)
const uid = (p) => p + Math.random().toString(36).slice(2, 10)
const TF = ['position', 'rotation', 'scale']
const NO_OVERRIDE = new Set(['id', 'parentId', 'type', 'kind', 'children']) // ni la jerarquía ni el tipo: en la película solo se AJUSTA lo que existe

export const OPERATORS = {
  person: { label: 'Persona con cámara', hint: 'Se nota el pulso de la mano (suavizable). Agacharse o caminar lo detecta el móvil.' },
  machine: { label: 'Máquina', hint: 'Trípode, riel o grúa: movimiento limpio, sin temblor.' },
}
export const RIGS = { tripod: 'Trípode (giro e inclinación)', dolly: 'Dolly sobre riel', crane: 'Grúa articulada' }
const range = (v, min, max, fallback) => Math.min(max, Math.max(min, num(v, fallback)))
/** Normaliza los controles del rig, propiedad de cada cámara cinematográfica. */
export function normalizeOperator(op = {}) {
  const dolly = op.dolly || {}, crane = op.crane || {}, shake = op.shake || {}
  return {
    kind: op.kind === 'machine' ? 'machine' : 'person',
    height: range(op.height, 0.5, 2.5, 1.7),
    handheld: range(op.handheld, 0, 1, 0.5),
    smooth: range(op.smooth, 0, 1, op.kind === 'machine' ? 0.85 : 0.6),
    stabilization: range(op.stabilization, 0, 1, 0),
    rig: RIGS[op.rig] ? op.rig : 'tripod',
    speed: range(op.speed, 0.05, 15, 1.4), // m/s
    sprint: range(op.sprint, 0.05, 30, 3.2), // multiplicador de velocidad
    turnSpeed: range(op.turnSpeed, 10, 360, 180), // grados/s para entradas discretas
    sensitivity: range(op.sensitivity, 0.1, 4, 1),
    acceleration: range(op.acceleration, 0.2, 30, 12), // m/s²
    deceleration: range(op.deceleration, 0.2, 40, 18), // m/s²
    panLimit: range(op.panLimit, 0, 180, 180), // grados desde el encuadre base
    tiltLimit: range(op.tiltLimit, 5, 89, 83),
    dolly: { points: (Array.isArray(dolly.points) ? dolly.points : []).map(vec).filter(Boolean).slice(0, 32) },
    crane: { pivot: vec(crane.pivot), arm: range(crane.arm, 0.5, 25, 3), yaw: range(crane.yaw, -180, 180, 0), elevation: range(crane.elevation, -80, 80, 0) },
    shake: { nodeId: String(shake.nodeId || ''), intensity: range(shake.intensity, 0, 2, 1) },
  }
}
const defaultPose = () => ({ pos: [0, 1.6, 0], rot: [0, 0, 0], fov: 60 })
export function normalizeFilmCamera(camera) {
  if (!camera || typeof camera.id !== 'string' || !camera.id.trim()) throw new Error('Cámara cinematográfica sin ID')
  const pose = camera.pose || defaultPose()
  return { id: camera.id, name: String(camera.name || 'Cámara'),
    operator: normalizeOperator(camera.operator),
    pose: { pos: vec(pose.pos) || [0, 1.6, 0], rot: vec(pose.rot) || [0, 0, 0], fov: range(pose.fov, 5, 170, 60) } }
}
export const activeFilmCamera = (film) => film?.cameras?.find(c => c.id === film.activeCameraId) || null


export function newFilm(o = {}) {
  const now = new Date().toISOString()
  const camera = normalizeFilmCamera({ id: uid('cam_'), name: 'Cámara principal' })
  return normalizeFilm({ id: uid('film_'), name: o.name || 'Película', created: now, updated: now,
    scene: { id: o.sceneId, name: o.sceneName, projectId: o.projectId, projectName: o.projectName },
    frame: o.frame ?? { width: FILM_FRAME_PRESETS[0].width, height: FILM_FRAME_PRESETS[0].height },
    seed: o.seed ?? Math.floor(Math.random() * 1e9), cameras: [camera], activeCameraId: camera.id })
}

export function normalizeFilm(f) {
  if (!f || (f.format && f.format !== NFM)) throw new Error('No es una película de Nether Film Maker (.nfm)')
  const cameras = Array.isArray(f.cameras) ? f.cameras.map(normalizeFilmCamera) : []
  if (!cameras.length) throw new Error('Película sin cámaras cinematográficas: archivo incompleto')
  if (new Set(cameras.map(c => c.id)).size !== cameras.length) throw new Error('Cámaras cinematográficas con ID duplicado')
  const activeCameraId = String(f.activeCameraId || '')
  if (!cameras.some(c => c.id === activeCameraId)) throw new Error('Referencia de cámara activa inválida')

  const overrides = {}
  for (const [id, o] of Object.entries(f.overrides || {})) {
    if (!o || typeof o !== 'object') continue
    const t = {}
    for (const [k, v] of Object.entries(o)) {
      if (NO_OVERRIDE.has(k)) continue
      if (TF.includes(k)) { const x = vec(v); if (x) t[k] = x } else if (v !== undefined) t[k] = JSON.parse(JSON.stringify(v))
    }
    if (Object.keys(t).length) overrides[String(id)] = t
  }
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : null)
  return {
    format: NFM, frame: normalizeFilmFrame(f.frame), id: String(f.id || uid('film_')), name: String(f.name || 'Película'),
    created: String(f.created || new Date().toISOString()), updated: String(f.updated || f.created || new Date().toISOString()),
    scene: { id: String(f.scene?.id || ''), name: String(f.scene?.name || ''), projectId: String(f.scene?.projectId || ''), projectName: String(f.scene?.projectName || ''), env: obj(f.scene?.env), render: obj(f.scene?.render), audio: obj(f.scene?.audio) },
    assets: (Array.isArray(f.assets) ? f.assets : []).filter((a) => a && a.id && a.name).map((a) => ({ id: String(a.id), name: String(a.name), folder: String(a.folder || 'Assets'), kind: String(a.kind || 'file'), ext: String(a.ext || String(a.name).split('.').pop() || '').toLowerCase() })),
    seed: Math.abs(Math.floor(num(f.seed, 1))) || 1,
    cameras, activeCameraId,
    actor: {
      objectId: String(f.actor?.objectId || ''), modelId: String(f.actor?.modelId || ''),
      contact: f.actor?.contact !== false,               // choca con el entorno (manos, pies, dedos)
      hands: !!f.actor?.hands,                           // seguir también los dedos con la cámara (más lento)
      grip: { L: Math.min(1, Math.max(0, num(f.actor?.grip?.L, 0))), R: Math.min(1, Math.max(0, num(f.actor?.grip?.R, 0))) }, // cierre de la mano si no se ven los dedos
    },
    takes: Array.isArray(f.takes) ? f.takes : [],
    passes: (Array.isArray(f.passes) ? f.passes : []).filter((p) => p && Array.isArray(p.keys)).map((p) => ({
      id: String(p.id || uid('pass_')), name: String(p.name || 'Cámara'), take: Number.isInteger(p.take) ? p.take : -1, input: String(p.input || ''),
      operator: p.operator || null, cameraId: String(p.cameraId || ''), duration: num(p.duration, p.keys.at(-1)?.t ?? 0),
      keys: p.keys.map((k) => ({ t: Math.max(0, num(k.t)), pos: vec(k.pos) || [0, 1.6, 0], rot: vec(k.rot) || [0, 0, 0], fov: Math.min(170, Math.max(5, num(k.fov, 60))) })).sort((a, b) => a.t - b.t),
    })),
    overrides,
    edit: normalizeEdit(f.edit),
  }
}

const differs = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => Math.abs(v - b[i]) > 1e-5)
/** Lo que la película ha cambiado de cada objeto respecto a la escena original (transformación, propiedades, visibilidad…). */
export function diffOverrides(baseObjects = [], curObjects = []) {
  const base = new Map(baseObjects.map((o) => [o.id, o]))
  const out = {}
  for (const o of curObjects) {
    const b = base.get(o.id); if (!b) continue
    const t = {}
    for (const k of Object.keys(o)) {
      if (NO_OVERRIDE.has(k)) continue
      if (TF.includes(k)) { if (Array.isArray(o[k]) && differs(o[k], b[k])) t[k] = o[k].map((v) => Math.round(v * 1e5) / 1e5) }
      else if (JSON.stringify(o[k]) !== JSON.stringify(b[k])) t[k] = JSON.parse(JSON.stringify(o[k] ?? null))
    }
    if (Object.keys(t).length) out[o.id] = t
  }
  return out
}
/** ¿Ha cambiado un ajuste de escena (entorno, render, audio)? Devuelve la copia nueva o null si es igual al original. */
export const diffSetting = (base, cur) => (JSON.stringify(base ?? null) === JSON.stringify(cur ?? null) ? null : JSON.parse(JSON.stringify(cur)))
/** Aplica los cambios de la película a los objetos de una escena. Devuelve objetos nuevos y qué se aplicó / qué ya no existe. */
export function applyOverrides(objects = [], overrides = {}) {
  const ids = new Set(objects.map((o) => o.id))
  const applied = [], missing = []
  for (const id of Object.keys(overrides)) (ids.has(id) ? applied : missing).push(id)
  const out = objects.map((o) => (overrides[o.id] ? { ...o, ...JSON.parse(JSON.stringify(overrides[o.id])) } : o))
  return { objects: out, applied, missing }
}
/** Quita de la película los cambios de objetos que ya no existen en la escena (tras sustituirla). */
export function pruneOverrides(film, objects) {
  const ids = new Set(objects.map((o) => o.id))
  const removed = Object.keys(film.overrides).filter((id) => !ids.has(id))
  const overrides = Object.fromEntries(Object.entries(film.overrides).filter(([id]) => ids.has(id)))
  return { film: { ...film, overrides }, removed }
}

const toU8 = (b) => (b instanceof Uint8Array ? b : new Uint8Array(b))
/** `files`: Map id → bytes de los assets añadidos en la app (film.assets). */
export async function packNfm(film, lfproj, files = new Map()) {
  const z = new JSZip(), f = normalizeFilm(film)
  z.file('film.json', JSON.stringify({ ...f, updated: new Date().toISOString() }))
  z.file('scene.lfproj', toU8(lfproj))
  for (const a of f.assets) if (files.get(a.id)) z.file(`assets/${a.id}`, toU8(files.get(a.id)))
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
export async function unpackNfm(bytes) {
  let z
  try { z = await JSZip.loadAsync(toU8(bytes)) } catch { throw new Error('No es una película de Nether Film Maker (.nfm)') }
  const fj = z.file('film.json'), sc = z.file('scene.lfproj')
  if (!fj || !sc) throw new Error('Película incompleta: falta film.json o scene.lfproj')
  const film = normalizeFilm(JSON.parse(await fj.async('string')))
  const assets = new Map()
  for (const a of film.assets) { const e = z.file(`assets/${a.id}`); if (e) assets.set(a.id, await e.async('uint8array')) }
  film.assets = film.assets.filter((a) => assets.has(a.id))
  return { film, lfproj: await sc.async('uint8array'), assets }
}
