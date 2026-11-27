// Muestreo de pistas: dado un instante devuelve la pose de la cámara / el valor de una propiedad de nodo. Puro (sin escena).
import * as THREE from 'three'
import { easeValue as animationEase, sampleTrack as sampleAnimationTrack, blendValue } from '../anim/eval.js'
import { nodeEffectiveActive } from '../nodes/hierarchy.js'
import { PROPS } from '../anim/model.js'

const DEG = Math.PI / 180
export const EASE_FN = {
  linear: (u) => u,
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  inOut: (u) => u * u * (3 - 2 * u),
  cut: () => 0,
}
export const ease = (name, u) => (EASE_FN[name] || EASE_FN.inOut)(Math.min(1, Math.max(0, u)))

const _e = new THREE.Euler(), _q = new THREE.Quaternion()
/** Rotación [pitch, yaw, roll] en grados → cuaternión (orden YXZ, como la cámara del jugador). */
export const quatFromRot = (rot) => { _e.set(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'YXZ'); return _q.setFromEuler(_e).clone() }
export const rotFromQuat = (q) => { _e.setFromQuaternion(q, 'YXZ'); return [_e.x / DEG, _e.y / DEG, _e.z / DEG] }

let cameraScratch
export function resolveCamera3D(key, sceneId, objects, nodes) {
  if (!key.sceneId || key.sceneId !== sceneId || !key.node) return null
  const object = objects?.find(item => item.id === key.node && item.type === 'camera')
  const node = object && nodes?.get(key.node)
  if (!node || !nodeEffectiveActive(objects, object)) return null
  const byId = new Map((objects || []).map(o => [o.id, o]))
  for (let n = object; n; n = n.parentId ? byId.get(n.parentId) : null) {
    if (nodes.get(n.id)?.userData?._lfRuntimeActive === false) return null
  }
  const { position, rotation, scale } = cameraScratch ??= {
    position: new THREE.Vector3(), rotation: new THREE.Quaternion(), scale: new THREE.Vector3(),
  }
  node.updateWorldMatrix(true, false)
  node.matrixWorld.decompose(position, rotation, scale)
  return { pos: position.toArray(), quat: rotation.clone().normalize(), fov: Number(node.userData.timelineFov ?? object.props?.fov) || 70,
    profile: object.props?.profile || '' }
}

/** Segmento activo: índice i tal que keys[i].t <= t < keys[i+1].t (o el último). -1 si t es anterior a la primera. */
export function segment(keys, t) {
  if (!keys.length || t < keys[0].t) return -1
  let i = keys.length - 1
  while (i > 0 && keys[i].t > t) i--
  return i
}

const cr = (p0, p1, p2, p3, u) => {
  const u2 = u * u, u3 = u2 * u
  return p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3))
}

/**
 * Pose de la cámara en `t` o null (aún no empieza). `resolve(key)` → { pos:[3], quat:THREE.Quaternion, fov } para claves de nodo/jugador.
 * Las claves libres se resuelven aquí.
 */
export function evalCamera(track, t, resolve) {
  const ks = track.keys
  const i = segment(ks, t)
  if (i < 0) return null
  const pose = (k) => {
    if (k.mode === 'free') return { pos: k.pos, quat: quatFromRot(k.rot), fov: k.fov }
    if (k.mode === 'camera3d') return resolve?.(k) ?? null
    return resolve?.(k) || { pos: k.pos, quat: quatFromRot(k.rot), fov: k.fov }
  }
  const a = ks[i], b = ks[i + 1]
  const pa = pose(a)
  if (!b) return pa
  const span = b.t - a.t
  if (a.ease === 'cut' || span <= 0) return t >= b.t ? pose(b) : pa
  const pb = pose(b)
  // El suavizado temporal es independiente de la trayectoria espacial de cámara.
  const u = animationEase(a, (t - a.t) / span)
  if (!pa || !pb) return u === 0 ? pa : u === 1 ? pb : null
  let pos
  if (track.path === 'smooth') {
    const p0 = i > 0 && ks[i - 1].ease !== 'cut' ? pose(ks[i - 1])?.pos ?? pa.pos : pa.pos
    const p3 = ks[i + 2] && b.ease !== 'cut' ? pose(ks[i + 2])?.pos ?? pb.pos : pb.pos
    pos = cr(p0, pa.pos, pb.pos, p3, u)
  } else pos = pa.pos.map((v, n) => v + (pb.pos[n] - v) * u)
  return { pos, quat: pa.quat.clone().slerp(pb.quat, u), fov: pa.fov + (pb.fov - pa.fov) * u }
}

// Modos explícitos: no se mezclan con `ease` para preservar el comportamiento heredado.
const shortDelta = (from, to) => (((to - from + 180) % 360) + 360) % 360 - 180
// Reconstruye ángulos continuos sin saltar 360° al cruzar una clave almacenada como 10° tras 350°.
const unwrappedAngle = (keys, index, axis) => {
  let angle = keys[0].v[axis]
  for (let j = 1; j <= index; j++) angle += shortDelta(keys[j - 1].v[axis], keys[j].v[axis])
  return angle
}
const hermite = (a, b, m1, m2, span, u) => {
  const u2 = u * u, u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * a + (u3 - 2 * u2 + u) * span * m1 + (-2 * u3 + 3 * u2) * b + (u3 - u2) * span * m2
}
function interpolateNode(keys, i, mode, u) {
  const a = keys[i], b = keys[i + 1]
  if (mode === 'nearest') return (u < 0.5 ? a : b).v
  const angular = mode.endsWith('-angle')
  const cubic = mode === 'cubic' || mode === 'cubic-angle'
  const prev = keys[i - 1], next = keys[i + 2]
  const span = b.t - a.t
  return a.v.map((from, n) => {
    const start = angular ? unwrappedAngle(keys, i, n) : from
    const to = angular ? start + shortDelta(from, b.v[n]) : b.v[n]
    if (!cubic) return start + (to - start) * u
    const p0 = prev ? angular ? start - shortDelta(prev.v[n], from) : prev.v[n] : start
    const p3 = next ? angular ? to + shortDelta(b.v[n], next.v[n]) : next.v[n] : to
    const automaticOut = prev && b.t > prev.t ? (to - p0) / (b.t - prev.t) : (to - start) / span
    const automaticIn = next && next.t > a.t ? (p3 - start) / (next.t - a.t) : (to - start) / span
    const m1 = Number.isFinite(a.tanOut?.[n]) ? a.tanOut[n] : automaticOut
    const m2 = Number.isFinite(b.tanIn?.[n]) ? b.tanIn[n] : automaticIn
    return hermite(start, to, m1, m2, span, u)
  })
}

/** Valor de una pista de nodo en `t` (vec3 o bool) o undefined antes de la primera clave. */
export function evalNode(track, t) {
  // Los canales numéricos y de color reutilizan las curvas de Animation Clips.
  if (PROPS[track.prop]?.ownerType || track.prop === 'light.energy' || track.prop === 'light.color') {
    return segment(track.keys, t) < 0 ? undefined : sampleAnimationTrack(track, t)
  }
  if (!['position', 'rotation', 'scale', 'visible', 'active'].includes(track.prop)) return undefined
  const ks = track.keys
  const i = segment(ks, t)
  if (i < 0) return undefined
  const a = ks[i], b = ks[i + 1]
  if (track.prop === 'visible' || track.prop === 'active') return !!a.v
  if (!b) return track.prop === 'rotation' && ['linear-angle', 'cubic-angle'].includes(track.interpolation)
    ? a.v.map((_, n) => unwrappedAngle(ks, i, n)) : a.v
  const span = b.t - a.t
  if (span <= 0) return t >= b.t ? b.v : a.v
  const u = Math.min(1, Math.max(0, (t - a.t) / span))
  const mode = track.interpolation
  if (['nearest', 'linear', 'cubic', 'linear-angle', 'cubic-angle'].includes(mode) &&
      (track.prop === 'rotation' || !mode.endsWith('-angle'))) return interpolateNode(ks, i, mode, u)
  if (a.ease === 'cut') return a.v
  const eased = animationEase(a, u)
  return a.v.map((v, n) => v + (b.v[n] - v) * eased)
}

/** Intervalos de clips sobre fuentes por ID: no se duplican curvas ni evaluadores. */
function sourceClipTime(track,clip,time) {
  const a=track.keys.find(k=>k.id===clip.from),b=track.keys.find(k=>k.id===clip.to)
  if (!a || !b || b.t<=a.t || !(clip.duration>0)) return null
  const fraction=clip.in + (clip.out-clip.in)*Math.min(1,Math.max(0,(time-clip.start)/clip.duration))
  return a.t+(b.t-a.t)*fraction
}
function activeTimelineClips(track,time) {
  return (track.clips||[]).filter(clip=>time>=clip.start && time<clip.start+clip.duration && sourceClipTime(track,clip,time)!==null)
    .sort((a,b)=>a.start-b.start || a.id.localeCompare(b.id))
}
function timelineClipWeight(a,b,time) {
  const start=Math.max(a.start,b.start),end=Math.min(a.start+a.duration,b.start+b.duration)
  return end<=start ? 1 : Math.min(1,Math.max(0,(time-start)/(end-start)))
}
/** Fuente única o crossfade de dos clips. Con clips activos, las claves son fuente y no se reproducen por duplicado; sin clips se conserva el comportamiento heredado. */
export function evalTimelineNode(track,time) {
  const clips=activeTimelineClips(track,time)
  if (!clips.length) return track.clips?.length ? undefined : evalNode(track,time)
  const values=clips.map(clip=>evalNode(track,sourceClipTime(track,clip,time)))
  if (values.length===1) return values[0]
  const w=timelineClipWeight(clips[0],clips[1],time)
  if (values[0] === undefined) return values[1]
  if (values[1] === undefined) return values[0]
  if (track.prop === 'rotation') return values[0].map((v, i) => v + shortDelta(v, values[1][i]) * w)
  return blendValue(track.prop, values[0], values[1], w)
}
export function evalTimelineCamera(track,time,resolve) {
  const clips=activeTimelineClips(track,time)
  if (!clips.length) return track.clips?.length ? null : evalCamera(track,time,resolve)
  const poses=clips.map(clip=>evalCamera(track,sourceClipTime(track,clip,time),resolve))
  if (poses.length===1) return poses[0]
  const w=timelineClipWeight(clips[0],clips[1],time),a=poses[0],b=poses[1]
  if (!a || !b) return w === 0 ? a : w === 1 ? b : null
  return { pos:a.pos.map((v,i)=>v+(b.pos[i]-v)*w), quat:a.quat.clone().slerp(b.quat,w), fov:a.fov+(b.fov-a.fov)*w }
}
