// Puente con three (solo editor/juego): esqueleto de un modelo cargado → descripción para retarget(), y pistas → THREE.AnimationClip.
import * as THREE from 'three'

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3()

/** Huesos del modelo en su pose de reposo, relativos a la raíz del modelo. null si no tiene esqueleto. */
export function skeletonFromModel(root) {
  if (!root) return null
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const list = []
  root.traverse((o) => { if (o.isBone) list.push(o) })
  if (!list.length) return null
  const idx = new Map(list.map((b, i) => [b, i]))
  const rel = (o) => new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)
  const bones = list.map((b) => {
    rel(b).decompose(_p, _q, _s)
    let par = b.parent
    return { name: b.name, parent: par && idx.has(par) ? idx.get(par) : -1, pos: _p.toArray(), quat: _q.toArray() }
  })
  // rotación del padre (no hueso) de la raíz del esqueleto: p. ej. el «Armature» girado 90° de los FBX convertidos
  const first = list.find((b) => !idx.has(b.parent))
  let rootQuat = [0, 0, 0, 1]
  if (first?.parent && first.parent !== root) { rel(first.parent).decompose(_p, _q, _s); rootQuat = _q.toArray() }
  return { bones, rootQuat }
}

/** Pistas de retarget() → clip de three (cuaterniones locales por hueso). */
export function clipFromTracks(name, tracks, duration) {
  const kf = tracks.filter((t) => t.times.length).map((t) => new THREE.QuaternionKeyframeTrack(`${t.bone}.quaternion`, t.times, t.values))
  const clip = new THREE.AnimationClip(name, duration ?? -1, kf)
  clip.userData = { capture: true }
  return clip
}
