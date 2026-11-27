// Influencia local de perfiles sobre la CÁMARA activa. No usa Jolt ni crea otro compositor.
import { findProfile, applyProfile, lerpRender, PROFILE_KEYS } from './profiles.js'

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(+v) ? +v : min))
const smooth = (t) => t * t * (3 - 2 * t)

/** Peso 0–1: el tamaño viene de la escala mundial del nodo, incluso con padres rotados. */
export function influence(point, center, rotation, size, props = {}) {
  const local = point.clone().sub(center).applyQuaternion(rotation.clone().invert())
  const half = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)].map((x) => Math.max(0.0001, x / 2))
  let dist
  if (props.shape === 'sphere') {
    const r = Math.max(...half)
    dist = Math.max(0, local.length() - r)
  } else {
    const dx = Math.max(0, Math.abs(local.x) - half[0]), dy = Math.max(0, Math.abs(local.y) - half[1]), dz = Math.max(0, Math.abs(local.z) - half[2])
    dist = Math.hypot(dx, dy, dz)
  }
  const fade = clamp(props.blendDistance ?? 2, 0, 100)
  return clamp(props.weight ?? 1, 0, 1) * (dist <= 0 ? 1 : fade ? smooth(1 - clamp(dist / fade, 0, 1)) : 0)
}

/** Devuelve el render deseado y la duración del volumen dominante. No modifica base ni perfiles. */
export function volumeRender(base, objects, nodes, camera, profiles) {
  const list = []
  if (!camera || !nodes || !objects?.length) return { render: base, active: false, duration: 0 }
  const point = camera.getWorldPosition ? camera.getWorldPosition(camera.position.clone()) : camera.position.clone()
  for (const obj of objects) {
    if (obj.type !== 'postvolume' || obj.visible === false) continue
    const root = nodes.get(obj.id)
    if (!root || !root.parent) continue
    const props = root.userData.timelinePostProps ? { ...(obj.props || {}), ...root.userData.timelinePostProps } : obj.props || {}
    if (props.enabled === false) continue
    const profile = findProfile(profiles, props.profile)
    if (!profile) continue
    let visible = true
    for (let parent = root; parent; parent = parent.parent) if (parent.visible === false) { visible = false; break }
    if (!visible) continue
    const visual = root.userData.visual || root
    visual.updateWorldMatrix(true, false)
    const w = influence(point, visual.getWorldPosition(point.clone()), visual.getWorldQuaternion(visual.quaternion.clone()), visual.getWorldScale(point.clone()), props)
    if (w > 0) list.push({ id: String(obj.id), priority: clamp(props.priority ?? 0, -100, 100), weight: w, duration: clamp(props.blendTime ?? 0.5, 0, 10), profile })
  }
  // Los volúmenes altos se aplican al final. Empates: orden estable por identidad, no por posición en el array.
  list.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
  let render = base
  for (const v of list) render = lerpRender(render, applyProfile(render, v.profile), v.weight)
  return { render, active: !!list.length, duration: list.at(-1)?.duration ?? 0 }
}

/** Evita escrituras de GPU si la configuración ya es perceptualmente idéntica. */
export function renderChanged(a, b) {
  if (!a) return true
  for (const k of PROFILE_KEYS) {
    if (typeof b[k] === 'number') { if (Math.abs(b[k] - a[k]) > 0.0005) return true }
    else if (a[k] !== b[k]) return true
  }
  if ((a.postShader || '') !== (b.postShader || '') || Math.abs((a.postMix || 0) - (b.postMix || 0)) > 0.0005) return true
  if (a.postShader && JSON.stringify(a.postParams || {}) !== JSON.stringify(b.postParams || {})) return true
  return false
}
