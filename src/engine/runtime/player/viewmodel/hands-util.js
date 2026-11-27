// Ayudas compartidas de las manos (view model): capa propia, vectores de trabajo y conversiones. Ver hands.js.
import * as THREE from 'three'
import { DEG } from '../../util.js'

export const VM_LAYER = 4
export const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3()
export const arr3 = (v, d) => (Array.isArray(v) && v.length >= 3 && v.every((n) => Number.isFinite(+n)) ? [+v[0], +v[1], +v[2]] : d)
export const eul = (rot) => _e.set(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'YXZ')

/** Pone un objeto (y todo lo que cuelga de él) en la capa del view model; devuelve cómo estaba para deshacerlo. */
export function toVmLayer(root) {
  const saved = []
  root.traverse((o) => { saved.push([o, o.layers.mask]); o.layers.set(VM_LAYER) })
  return saved
}
export const fromVmLayer = (saved) => { for (const [o, m] of saved) o.layers.mask = m }
