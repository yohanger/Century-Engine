// Registro de volúmenes atmosféricos vivos (nodos «Volumen atmosférico»). Referencias débiles: un nodo que el editor descarta
// desaparece solo; uno que está fuera de la escena se salta. Devuelve volúmenes de world/fog.js listos para resolver con la cámara.
import * as THREE from 'three'
import { makeVolume } from '../world/fog.js'

const refs = new Set()
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3()

export function registerAtmoRoot(root) { refs.add(new WeakRef(root)) }

const inScene = (o) => { for (let p = o; p; p = p.parent) if (p.isScene) return true; return false }

/** Volúmenes actuales (matriz del «visual» del nodo = caja del tamaño de su escala). */
export function liveAtmoVolumes() {
  const out = []
  for (const ref of refs) {
    const root = ref.deref()
    if (!root) { refs.delete(ref); continue }
    const vis = root.userData.visual
    if (!vis || !inScene(root) || root.userData.atmoOff) continue
    vis.updateWorldMatrix(true, false)
    vis.matrixWorld.decompose(_p, _q, _s)
    out.push(makeVolume({ position: [_p.x, _p.y, _p.z], rotation: [_q.x, _q.y, _q.z, _q.w], size: [_s.x, _s.y, _s.z], exchange: root.userData.atmoExchange ?? 0 }))
  }
  return out
}
