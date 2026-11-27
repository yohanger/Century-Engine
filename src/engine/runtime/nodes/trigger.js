import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, lineMat, hitSphere } from './three-helpers.js'
import { unitGeometry } from '../geometry/primitives.js'

// La autoría permanece en props; Timeline solo establece los valores efectivos
// mientras su pista conserva la propiedad del canal.
const TRIGGER_FIELDS = [
  ['tag', 'Etiqueta', 'string', 'zona'],
  ['onEnter', 'Al entrar', 'string', ''],
  ['onExit', 'Al salir', 'string', ''],
  ['look', 'Mirada', 'bool', false],
  ['lookDistance', 'Alcance (m)', 'number', 3, { min: 0.5, max: 50 }],
  ['onLook', 'Al mirar', 'string', ''],
  ['onLookEnd', 'Al dejar de mirar', 'string', ''],
]
const triggerAnimation = Object.fromEntries(TRIGGER_FIELDS.map(([key, label, kind, def, bounds = {}]) => {
  const props = root => root.userData.timelineTriggerProps || null
  return [`trigger.${key}`, {
    label, kind, def, ...bounds,
    read: obj => obj.props?.[key] ?? def,
    runtimeRead: (root, obj) => props(root)?.[key] ?? obj.props?.[key] ?? def,
    apply: (root, value) => { (root.userData.timelineTriggerProps ??= {})[key] = value },
    capture: root => ({ had: Object.hasOwn(props(root) || {}, key), value: props(root)?.[key] }),
    restore: (root, snapshot) => {
      if (snapshot?.had) (root.userData.timelineTriggerProps ??= {})[key] = snapshot.value
      else if (props(root)) {
        delete root.userData.timelineTriggerProps[key]
        if (!Object.keys(root.userData.timelineTriggerProps).length) delete root.userData.timelineTriggerProps
      }
    },
  }]
}))
triggerAnimation['trigger.color'] = {
  label: 'Color', kind: 'color', def: '#3ddc84',
  read: obj => obj.color,
  runtimeRead: (root, obj) => root.userData.timelineTriggerColor ?? obj.color,
  apply: (root, value) => {
    root.userData.timelineTriggerColor = value
    root.userData.fillMat?.color.set(value); root.userData.edgeMat?.color.set(value)
  },
  capture: root => ({ had: Object.hasOwn(root.userData, 'timelineTriggerColor'), value: root.userData.timelineTriggerColor }),
  restore: (root, snapshot, obj) => {
    if (snapshot?.had) root.userData.timelineTriggerColor = snapshot.value
    else delete root.userData.timelineTriggerColor
    const color = root.userData.timelineTriggerColor ?? obj.color
    root.userData.fillMat?.color.set(color); root.userData.edgeMat?.color.set(color)
  },
}

export default registerNode({
  type: 'trigger',
  label: 'Trigger',
  icon: 'trigger',
  category: 'Gameplay',
  scalable: true,
  animation: triggerAnimation,
  create: () => ({ name: 'Trigger', collision: false, color: '#3ddc84', scale: [4, 3, 4], props: { tag: 'zona', onEnter: '', onExit: '', look: false, lookDistance: 3, onLook: '', onLookEnd: '' } }),

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const fill = new THREE.Mesh(unitGeometry('box'), new THREE.MeshBasicMaterial({ color: obj.color, transparent: true, opacity: 0.18, depthWrite: false }))
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(unitGeometry('box')), lineMat(obj.color))
    root.userData.fillMat = fill.material
    root.userData.edgeMat = edges.material
    visual.add(fill, edges)
    root.userData.editorGizmos = [visual]
    root.add(hitSphere(0.4))
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    root.userData.fillMat.color.set(root.userData.timelineTriggerColor ?? obj.color)
    root.userData.edgeMat.color.set(root.userData.timelineTriggerColor ?? obj.color)
  },
})
