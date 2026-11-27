// Operaciones del editor de capturas (sin React: se prueban en Node con `npm test`). Todas devuelven una captura NUEVA.
import { newLayer, duration as capDuration, J } from './core/format.js'
import { calibrate, toCanonical, fillGaps, smoothFrames, sampleFrames, sampleCamera, simplifyKeys } from './core/edit.js'
import { r4, clamp } from './core/math.js'

const D = 180 / Math.PI
const clone = (c) => ({ ...c, body: c.body, camera: { keys: c.camera.keys.map((k) => ({ ...k })) }, edits: { ...c.edits, cuts: [...c.edits.cuts], trim: c.edits.trim ? [...c.edits.trim] : null }, layers: c.layers.map((l) => ({ ...l, params: { ...l.params } })) })
export const totalOf = (c) => capDuration(c)
export const trimOf = (c) => c.edits.trim || [0, totalOf(c)]

// ---- recorte, tomas, velocidad ----
export function setTrimStart(c, t) { const o = clone(c), [, b] = trimOf(c); o.edits.trim = [r4(clamp(t, 0, b - 0.1)), b]; o.edits.cuts = o.edits.cuts.filter((x) => x > o.edits.trim[0] && x < b); return o }
export function setTrimEnd(c, t) { const o = clone(c), [a] = trimOf(c); o.edits.trim = [a, r4(clamp(t, a + 0.1, totalOf(c)))]; o.edits.cuts = o.edits.cuts.filter((x) => x > a && x < o.edits.trim[1]); return o }
export function resetTrim(c) { const o = clone(c); o.edits.trim = null; return o }
export function addCut(c, t) { const o = clone(c), [a, b] = trimOf(c); if (t <= a + 0.1 || t >= b - 0.1 || o.edits.cuts.some((x) => Math.abs(x - t) < 0.1)) return c; o.edits.cuts = [...o.edits.cuts, r4(t)].sort((x, y) => x - y); return o }
export function removeCut(c, i) { const o = clone(c); o.edits.cuts.splice(i, 1); return o }
export const setEdit = (c, patch) => { const o = clone(c); Object.assign(o.edits, patch); return o }
/** Tomas que saldrán: [{ name, t0, t1, duration }] (en tiempo de la grabación). */
export function takesOf(c) {
  const [a, b] = trimOf(c), cuts = [a, ...c.edits.cuts.filter((t) => t > a + 0.05 && t < b - 0.05), b]
  return cuts.slice(0, -1).map((t0, i) => ({ name: cuts.length > 2 ? `${c.name} · toma ${i + 1}` : c.name, t0, t1: cuts[i + 1], duration: (cuts[i + 1] - t0) / c.edits.speed }))
}

// ---- capas / efectos ----
export function addLayer(c, kind, t, len = 1.5) { const o = clone(c), end = totalOf(c); const t0 = clamp(t, 0, Math.max(0, end - 0.1)); const l = newLayer(kind, r4(t0), r4(Math.min(end, t0 + len))); o.layers.push(l); return { cap: o, id: l.id } }
export function updateLayer(c, id, patch) { const o = clone(c); const l = o.layers.find((x) => x.id === id); if (!l) return c; if (patch.params) Object.assign(l.params, patch.params); if (patch.t0 !== undefined) l.t0 = r4(Math.max(0, Math.min(patch.t0, l.t1 - 0.05))); if (patch.t1 !== undefined) l.t1 = r4(Math.max(l.t0 + 0.05, Math.min(patch.t1, totalOf(c)))); return o }
export function removeLayer(c, id) { const o = clone(c); o.layers = o.layers.filter((l) => l.id !== id); return o }
/** Lo que se ve en la vista previa en t: subtítulo, fundido (0–1), barras (%), temblor. */
export function effectsAt(c, t) {
  const out = { caption: '', fade: 0, letterbox: 0, shake: 0 }
  for (const l of c.layers) {
    if (t < l.t0 || t > l.t1) continue
    const u = (t - l.t0) / Math.max(1e-6, l.t1 - l.t0)
    if (l.kind === 'text') out.caption = String(l.params.text || '')
    else if (l.kind === 'fade') out.fade = Math.max(out.fade, l.params.dir === 'in' ? 1 - u : u)
    else if (l.kind === 'letterbox') out.letterbox = Math.max(out.letterbox, +l.params.percent || 0)
    else if (l.kind === 'shake') out.shake = Math.max(out.shake, +l.params.amount || 0)
  }
  return out
}

// ---- cámara virtual ----
/** Cámara orbitando al actor: distancia, altura y ángulo (0 = de frente). Mira a la altura `lookY`. */
export function orbitKey(dist, height, angle, lookY = 1.1, fov = 50) {
  const a = (angle * Math.PI) / 180
  return { pos: [r4(Math.sin(a) * dist), r4(height), r4(Math.cos(a) * dist)], rot: [r4(Math.atan2(lookY - height, dist) * D), r4(angle), 0], fov }
}
export const SHOTS = {
  general: { label: 'Plano general', rig: { dist: 4.5, height: 1.5, angle: 0, fov: 55 } },
  medio: { label: 'Plano medio', rig: { dist: 1.7, height: 1.35, angle: 0, fov: 40, lookY: 1.2 } },
  primer: { label: 'Primer plano', rig: { dist: 0.9, height: 1.5, angle: 0, fov: 35, lookY: 1.45 } },
  picado: { label: 'Picado', rig: { dist: 2.6, height: 3.2, angle: 0, fov: 50 } },
  contra: { label: 'Contrapicado', rig: { dist: 2.4, height: 0.4, angle: 0, fov: 55, lookY: 1.3 } },
  lateral: { label: 'Lateral', rig: { dist: 3, height: 1.4, angle: 80, fov: 50 } },
  espalda: { label: 'Por la espalda', rig: { dist: 2.5, height: 1.7, angle: 180, fov: 55, lookY: 1.4 } },
}
export const rigKey = (rig) => orbitKey(rig.dist, rig.height, rig.angle, rig.lookY ?? 1.1, rig.fov ?? 50)
/** Pone (o sustituye, si hay una a menos de 0,05 s) una clave de cámara en t. */
export function setCameraKey(c, t, key) {
  const o = clone(c)
  o.camera.keys = o.camera.keys.filter((k) => Math.abs(k.t - t) > 0.05)
  o.camera.keys.push({ t: r4(t), pos: key.pos.map(r4), rot: key.rot.map(r4), fov: r4(key.fov) })
  o.camera.keys.sort((x, y) => x.t - y.t)
  return o
}
export function removeCameraKeyNear(c, t, tol = 0.15) {
  const o = clone(c); let best = -1, bd = tol
  o.camera.keys.forEach((k, i) => { const d = Math.abs(k.t - t); if (d <= bd) { bd = d; best = i } })
  if (best >= 0) o.camera.keys.splice(best, 1)
  return o
}
export const cameraAt = (c, t) => sampleCamera(c.camera.keys, t)
/**
 * Pase de cámara: `samples` = [{ t, rot:[pitch,yaw,roll] relativos al inicio, zoom }] grabados moviendo el móvil mientras se
 * reproducía la toma. Sustituye las claves entre el primer y el último instante por las nuevas (con la base del encuadre `rig`).
 */
export function applyCameraPass(c, samples, rig) {
  if (samples.length < 2) return c
  const base = rigKey(rig), t0 = samples[0].t, t1 = samples.at(-1).t
  const fovOf = (z) => 2 * Math.atan(Math.tan(((base.fov) * Math.PI) / 360) / Math.max(0.1, z || 1)) * D
  const keys = samples.map((s) => ({ t: r4(s.t), pos: base.pos, rot: [r4(base.rot[0] + s.rot[0]), r4(base.rot[1] + s.rot[1]), r4(s.rot[2])], fov: r4(fovOf(s.zoom)) }))
  const o = clone(c)
  o.camera.keys = [...o.camera.keys.filter((k) => k.t < t0 - 0.01 || k.t > t1 + 0.01), ...simplifyKeys(keys, 0.004)].sort((x, y) => x.t - y.t)
  return o
}

// ---- vista previa ----
/** Fotogramas canónicos con espejo, huecos rellenos y suavizado (en tiempo de la grabación), y el suelo. */
export function previewOf(c) {
  const fr = c.body.frames
  if (!fr.length) return { frames: [], floor: -1 }
  const can = smoothFrames(fillGaps(toCanonical(fr, calibrate(fr), { mirror: c.edits.mirror })), c.edits.smooth)
  let floor = Infinity
  for (const f of can.slice(0, 45)) for (const j of [J.leftHeel, J.rightHeel, J.leftFootIndex, J.rightFootIndex]) floor = Math.min(floor, f.p[j * 4 + 1])
  return { frames: can, floor: Number.isFinite(floor) ? floor : -1 }
}
export const frameAt = (pv, t) => sampleFrames(pv.frames, t)
