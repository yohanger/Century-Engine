import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, arrowToward } from './three-helpers.js'

export default registerNode({
  type: 'spawn',
  creatable: false, // Sólo lectura de nodos de proyectos existentes; no aparece en Añadir.
  label: 'Spawn',
  icon: 'spawn',
  category: 'Gameplay',
  scalable: false,
  animation: {
    'spawn.tag': {
      label: 'Etiqueta', kind: 'string', def: 'player',
      read: obj => obj.props?.tag ?? 'player',
      runtimeRead: (root, obj) => root.userData.timelineSpawnTag ?? obj.props?.tag ?? 'player',
      apply: (root, value) => { root.userData.timelineSpawnTag = value },
      capture: root => ({ had: Object.hasOwn(root.userData, 'timelineSpawnTag'), value: root.userData.timelineSpawnTag }),
      restore: (root, snapshot) => {
        if (snapshot?.had) root.userData.timelineSpawnTag = snapshot.value
        else delete root.userData.timelineSpawnTag
      },
    },
  },
  create: () => ({ name: 'Spawn', collision: false, color: '#5fc88f', props: { tag: 'player' } }),

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 16), new THREE.MeshBasicMaterial({ color: obj.color, transparent: true, opacity: 0.45 }))
    body.position.y = 0.9
    root.userData.iconMat = body.material
    const arrow = arrowToward(1.0, obj.color)
    arrow.position.y = 0.9
    visual.add(body, arrow)
    root.userData.editorGizmos = [arrow]
    return root
  },
  update(root, obj) {
    applyBase(root, obj, false)
    root.userData.iconMat.color.set(obj.color)
  },
})
