// Matrices de los nodos. Node3D propaga escala a los hijos; los tipos existentes conservan tamaño visual propio.
import * as THREE from 'three'
import { DEG } from '../util.js'
import { nodeAncestors } from '../nodes/hierarchy.js'

const _tmpE = new THREE.Euler()
export const localMatrix = (o) => {
  _tmpE.set((o.rotation || [0, 0, 0])[0] * DEG, (o.rotation || [0, 0, 0])[1] * DEG, (o.rotation || [0, 0, 0])[2] * DEG, 'YXZ')
  return new THREE.Matrix4().compose(new THREE.Vector3(...(o.position || [0, 0, 0])), new THREE.Quaternion().setFromEuler(_tmpE), new THREE.Vector3(...(['node3d', 'sceneInstance'].includes(o.type) ? (o.scale || [1, 1, 1]) : [1, 1, 1])))
}

/** Matriz de mundo de un objeto: producto de las locales de su cadena de padres. `getObject(id)` resuelve un id. */
export function worldMatrixOf(getObject, id) {
  const chain = nodeAncestors(getObject, id).reverse()
  const m = new THREE.Matrix4()
  for (const n of chain) m.multiply(localMatrix(n))
  return m
}
