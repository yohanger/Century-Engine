// Volumen local de postproceso: solo editor muestra el gizmo; el runtime consulta la cámara sin colisionadores Jolt.
import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, lineMat, hitSphere } from './three-helpers.js'

function geometry(shape) { return shape === 'sphere' ? new THREE.SphereGeometry(0.5, 20, 12) : new THREE.BoxGeometry(1, 1, 1) }
// El volumen consulta props efectivos a través de su propio runtime, sin
// alterar el recurso o el estado de otros volúmenes de postproceso.
const POST_FIELDS = [
  ['enabled', 'Activo', 'bool', true],
  ['shape', 'Forma', 'enum', 'box', { options: ['box', 'sphere'] }],
  ['profile', 'Perfil (.post)', 'string', ''],
  ['priority', 'Prioridad', 'number', 0, { min: -100, max: 100 }],
  ['weight', 'Peso', 'number', 1, { min: 0, max: 1 }],
  ['blendDistance', 'Distancia de mezcla (m)', 'number', 2, { min: 0, max: 100 }],
  ['blendTime', 'Transición (s)', 'number', 0.5, { min: 0, max: 10 }],
]
function setVolumeShape(root, shape, obj = null) {
  if (obj) {
    if (shape === 'sphere') root.userData.visual?.scale.setScalar(Math.max(...(obj.scale || [1, 1, 1]).map(v => Math.abs(v))))
    else root.userData.visual?.scale.set(...(obj.scale || [1, 1, 1]))
  }
  const [fill, edge] = root.userData.postVisual || []
  if (!fill || !edge || root.userData.postShape === shape) return
  const oldFill = fill.geometry, oldEdge = edge.geometry
  fill.geometry = geometry(shape)
  edge.geometry = new THREE.EdgesGeometry(fill.geometry)
  oldFill.dispose(); oldEdge.dispose()
  root.userData.postShape = shape
}
const postAnimation = Object.fromEntries(POST_FIELDS.map(([key, label, kind, def, constraints = {}]) => {
  const own = root => root.userData.timelinePostProps || null
  return [`post.${key}`, {
    label, kind, def, ...constraints,
    read: obj => obj.props?.[key] ?? def,
    runtimeRead: (root, obj) => own(root)?.[key] ?? obj.props?.[key] ?? def,
    apply: (root, value, obj) => {
      (root.userData.timelinePostProps ??= {})[key] = value
      if (key === 'shape') setVolumeShape(root, value, obj)
    },
    capture: root => ({ had: Object.hasOwn(own(root) || {}, key), value: own(root)?.[key] }),
    restore: (root, snapshot, obj) => {
      if (snapshot?.had) (root.userData.timelinePostProps ??= {})[key] = snapshot.value
      else if (own(root)) {
        delete root.userData.timelinePostProps[key]
        if (!Object.keys(root.userData.timelinePostProps).length) delete root.userData.timelinePostProps
      }
      if (key === 'shape') setVolumeShape(root, own(root)?.shape ?? obj.props?.shape ?? 'box', obj)
    },
  }]
}))
postAnimation['post.color'] = {
  label: 'Color de edición', kind: 'color', def: '#cb77e8',
  read: obj => obj.color,
  runtimeRead: (root, obj) => root.userData.timelinePostColor ?? obj.color,
  apply: (root, value) => {
    root.userData.timelinePostColor = value
    for (const part of root.userData.postVisual || []) part.material.color.set(value)
  },
  capture: root => ({ had: Object.hasOwn(root.userData, 'timelinePostColor'), value: root.userData.timelinePostColor }),
  restore: (root, snapshot, obj) => {
    if (snapshot?.had) root.userData.timelinePostColor = snapshot.value
    else delete root.userData.timelinePostColor
    for (const part of root.userData.postVisual || []) part.material.color.set(root.userData.timelinePostColor ?? obj.color)
  },
}

export default registerNode({
  type: 'postvolume', label: 'PostProcessVolume', icon: 'postvolume', category: 'Ambiente', scalable: true, animation: postAnimation,
  create: () => ({ name: 'PostProcessVolume', collision: false, color: '#cb77e8', scale: [6, 4, 6],
    props: { shape: 'box', profile: '', enabled: true, priority: 0, weight: 1, blendDistance: 2, blendTime: 0.5 } }),
  build(obj) {
    const { root, visual } = makeRoot(obj)
    const fill = new THREE.Mesh(geometry(obj.props?.shape), new THREE.MeshBasicMaterial({ color: obj.color, transparent: true, opacity: 0.1, depthWrite: false }))
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(fill.geometry), lineMat(obj.color))
    visual.add(fill, edge)
    root.userData.postVisual = [fill, edge]
    root.userData.postShape = obj.props?.shape === 'sphere' ? 'sphere' : 'box'
    root.userData.editorGizmos = [visual]
    root.add(hitSphere(0.4))
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    const [fill, edge] = root.userData.postVisual
    fill.material.color.set(root.userData.timelinePostColor ?? obj.color); edge.material.color.set(root.userData.timelinePostColor ?? obj.color)
    const shape = (root.userData.timelinePostProps?.shape ?? obj.props?.shape) === 'sphere' ? 'sphere' : 'box'
    setVolumeShape(root, shape, obj)
  },
})
