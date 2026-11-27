import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, lineMat, hitSphere } from './three-helpers.js'
import { unitGeometry } from '../geometry/primitives.js'
import { registerAtmoRoot } from '../render/atmovolumes.js'

const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(+x) ? +x : 0))

const atmoAnimation = {
  'atmo.exchange': {
    label: 'Intercambio', kind: 'number', def: 0, min: 0, max: 1,
    read: obj => obj.props?.exchange ?? 0,
    runtimeRead: root => root.userData.atmoExchange ?? 0,
    apply: (root, value) => { root.userData.timelineAtmoExchange = value; root.userData.atmoExchange = clamp01(value) },
    capture: root => ({ had: Object.hasOwn(root.userData, 'timelineAtmoExchange'), value: root.userData.timelineAtmoExchange }),
    restore: (root, snapshot, obj) => {
      if (snapshot?.had) root.userData.timelineAtmoExchange = snapshot.value
      else delete root.userData.timelineAtmoExchange
      root.userData.atmoExchange = clamp01(root.userData.timelineAtmoExchange ?? obj.props?.exchange)
    },
  },
  'atmo.color': {
    label: 'Color', kind: 'color', def: '#7fb3e0',
    read: obj => obj.color,
    runtimeRead: (root, obj) => root.userData.timelineAtmoColor ?? obj.color,
    apply: (root, value) => {
      root.userData.timelineAtmoColor = value
      root.userData.fillMat?.color.set(value); root.userData.edgeMat?.color.set(value)
    },
    capture: root => ({ had: Object.hasOwn(root.userData, 'timelineAtmoColor'), value: root.userData.timelineAtmoColor }),
    restore: (root, snapshot, obj) => {
      if (snapshot?.had) root.userData.timelineAtmoColor = snapshot.value
      else delete root.userData.timelineAtmoColor
      const color = root.userData.timelineAtmoColor ?? obj.color
      root.userData.fillMat?.color.set(color); root.userData.edgeMat?.color.set(color)
    },
  },
}

// Caja que modifica la niebla física (escena con «Niebla: Física») mientras la cámara está dentro: con intercambio 0 el interior
// queda sin niebla hasta la salida del rayo; con 1 la niebla entra entera. Con volúmenes anidados manda el más pequeño.
export default registerNode({
  type: 'atmovolume',
  label: 'Volumen atmosférico',
  icon: 'atmovolume',
  category: 'Ambiente',
  scalable: true,
  animation: atmoAnimation,
  create: () => ({ name: 'Volumen atmosférico', collision: false, color: '#7fb3e0', scale: [8, 3, 8], props: { exchange: 0 } }),

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const fill = new THREE.Mesh(unitGeometry('box'), new THREE.MeshBasicMaterial({ color: obj.color, transparent: true, opacity: 0.1, depthWrite: false }))
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(unitGeometry('box')), lineMat(obj.color))
    root.userData.fillMat = fill.material
    root.userData.edgeMat = edges.material
    visual.add(fill, edges)
    root.userData.editorGizmos = [visual]
    root.add(hitSphere(0.4))
    root.userData.atmoExchange = clamp01(root.userData.timelineAtmoExchange ?? obj.props?.exchange)
    registerAtmoRoot(root)
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    root.userData.fillMat.color.set(root.userData.timelineAtmoColor ?? obj.color)
    root.userData.edgeMat.color.set(root.userData.timelineAtmoColor ?? obj.color)
    root.userData.atmoExchange = clamp01(root.userData.timelineAtmoExchange ?? obj.props?.exchange)
  },
})
