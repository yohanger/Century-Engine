import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, lineMat, hitSphere } from './three-helpers.js'

export default registerNode({
  type: 'group',
  label: 'Grupo',
  icon: 'group',
  category: 'Estructura',
  scalable: false,
  create: () => ({ name: 'Grupo', collision: false, color: '#c3c9d4' }),

  build(obj) {
    const { root, visual } = makeRoot(obj)
    // pequeña cruz de ejes para ver el pivote
    const pts = [[-0.4, 0, 0, 0.4, 0, 0], [0, -0.4, 0, 0, 0.4, 0], [0, 0, -0.4, 0, 0, 0.4]]
    for (const p of pts) {
      visual.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p[0], p[1], p[2]), new THREE.Vector3(p[3], p[4], p[5])]), lineMat('#c3c9d4', 0.8)))
    }
    root.add(hitSphere(0.4))
    root.userData.editorGizmos = [visual]
    return root
  },
  update(root, obj) { applyBase(root, obj, false) },
})
