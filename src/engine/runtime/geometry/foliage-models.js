// Vegetación · geometría de las fuentes «textura» (planos en cruz) y «modelo» (partes horneadas con la base en el origen).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function crossedQuads(aspect = 1) {
  const w = aspect, h = 1
  const mk = (rot) => {
    const g = new THREE.PlaneGeometry(w, h)
    g.translate(0, h / 2, 0)
    g.rotateY(rot)
    return g
  }
  const g = mergeGeometries([mk(0), mk(Math.PI / 2)], false)
  const n = g.attributes.normal
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0)
  return g
}

/** Cada malla del modelo se hornea en coordenadas del modelo con la base centrada en el origen. */
export function modelPivot(scene) {
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(scene)
  return [-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2]
}

export function modelParts(scene) {
  const shift = new THREE.Matrix4().makeTranslation(...modelPivot(scene))
  const out = []
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return
    const g = o.geometry.clone()
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(shift, o.matrixWorld))
    const mat = Array.isArray(o.material) ? o.material[0] : o.material
    const m = mat.clone()
    m.side = THREE.DoubleSide
    out.push({ geometry: g, material: m })
  })
  return out
}
