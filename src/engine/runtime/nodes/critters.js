import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, lineMat, hitSphere } from './three-helpers.js'
import { normalizeCritter, getSpecies } from '../critters/index.js'

// Cluster de animales (luciérnagas…). Los parámetros los declara la especie (core/critters/): el inspector los dibuja con ParamForm.
// En el editor se ve como un círculo con su radio y un punto; la simulación (IA) la hace CritterSystem, tanto aquí como al jugar.
const circle = (r) => {
  const pts = []
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)) }
  return new THREE.BufferGeometry().setFromPoints(pts)
}

export default registerNode({
  type: 'critters',
  label: 'Cluster de animales',
  icon: 'critters',
  category: 'Gameplay',
  scalable: false,
  // Los mismos parámetros declarados por la especie gobiernan Inspector, Timeline y simulación.
  // No se permite crear canales de especies desconocidas o mezclar configuraciones.
  visualAnimationFields: Object.fromEntries((getSpecies('firefly')?.params || [])
    .filter(p => ['number', 'bool', 'color'].includes(p.type))
    .map(p => [p.key, {
      label: p.label, kind: p.type, def: p.def,
      ...(p.min === undefined ? {} : { min: p.min }),
      ...(p.max === undefined ? {} : { max: p.max }),
      available: obj => (obj.props?.species || 'firefly') === 'firefly',
    }])),
  create: () => ({ name: 'Luciérnagas', collision: false, color: '#c9ff4f', props: normalizeCritter({ species: 'firefly' }) }),

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: obj.color }))
    const ring = new THREE.Line(circle(1), lineMat(obj.color, 0.6))
    visual.add(dot, ring, hitSphere(0.5))
    ring.userData.helper = true
    root.userData.iconMat = dot.material; root.userData.ring = ring
    root.userData.editorGizmos = [ring]
    return root
  },
  update(root, obj) {
    applyBase(root, obj, false)
    const p = normalizeCritter(obj.props), u = root.userData
    u.iconMat.color.set(p.color || obj.color); u.ring.material.color.set(p.color || obj.color)
    u.ring.scale.set(p.radius, 1, p.radius)
  },
})
export { getSpecies }
