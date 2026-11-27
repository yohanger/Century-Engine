import * as THREE from 'three'
import { registerNode, AREA3D_NATIVE_SIGNALS } from './registry.js'
import { makeRoot, applyBase, hitSphere, lineMat } from './three-helpers.js'
import { combustionEnvironmentAnimation } from './base.js'
import { newPhysicsShape, PHYSICS_SHAPES, effectiveCollisionShape } from '../physics/shapes.js'
import { triMeshGeometry } from '../physics/trimesh-geometry.js'

const BODY_ICONS = { staticbody3d: 'static-body', rigidbody3d: 'rigid-body', characterbody3d: 'character-body', area3d: 'area3d' }

const bodyColor = { staticbody3d: '#83a8d3', rigidbody3d: '#d1a46c', characterbody3d: '#85c5a9', area3d: '#a489c5' }

// Cada propiedad se aplica en su propietario físico original: NodeBodyRuntime
// (BodyInterface/MotionProperties) o NodeSpatialRuntime (CharacterVirtual/Area3D).
// No registrar formas físicas hasta certificar su reemplazo sin perder cuerpos.
const spatialAnimationFields = {
  staticbody3d: [
    ['friction', 'Rozamiento', 0.5, 0, 1, 'staticFriction'],
    ['restitution', 'Rebote', 0, 0, 1, 'staticRestitution'],
  ],
  rigidbody3d: [
    ['friction', 'Rozamiento', 0.5, 0, 1, 'rigidFriction'],
    ['restitution', 'Rebote', 0, 0, 1, 'rigidRestitution'],
    ['gravityScale', 'Escala gravedad', 1, -100, 100],
    ['linearDamping', 'Amortiguación lineal', 0.05, 0, 10],
    ['angularDamping', 'Amortiguación angular', 0.05, 0, 10],
    ['mass', 'Masa (kg)', 1, 0.001, 20000, 'rigidMass'],
    ['canSleep', 'Puede dormir', true],
  ],
  characterbody3d: [
    ['velocity', 'Velocidad (m/s)', [0, 0, 0]],
    ['gravity', 'Gravedad (m/s²)', 9.81, 0, 500],
    ['maxSlopeAngle', 'Pendiente máxima (°)', 50, 0, 89],
    ['mass', 'Masa (kg)', 80, 0.001, 20000, 'characterMass'],
    ['stepHeight', 'Altura escalón (m)', 0.35, 0, 10],
    ['floorSnap', 'Snap suelo (m)', 0.5, 0, 10],
  ],
  area3d: [
    ['monitoring', 'Monitoring', true],
    ['monitorable', 'Monitorable', true],
  ],
}
function spatialAnimation(type) {
  return Object.fromEntries((spatialAnimationFields[type] || []).map(([key, label, def, min, max, propertyId = key]) => {
    const current = root => root.userData.timelineSpatial || null
    return [`physics.${propertyId}`, {
      label, kind: Array.isArray(def) ? 'vec3' : typeof def === 'boolean' ? 'bool' : 'number', def,
      ...(typeof def === 'number' ? { min, max } : {}),
      read: obj => obj.props?.[key] ?? (Array.isArray(def) ? [...def] : def),
      runtimeRead: (root, obj) => current(root)?.[key] ?? obj.props?.[key] ?? def,
      apply: (root, value) => { (root.userData.timelineSpatial ??= {})[key] = Array.isArray(value) ? [...value] : value },
      capture: root => ({ had:Object.hasOwn(current(root) || {}, key), value:Array.isArray(current(root)?.[key]) ? [...current(root)[key]] : current(root)?.[key] }),
      restore: (root, snapshot) => {
        if (snapshot?.had) (root.userData.timelineSpatial ??= {})[key] = snapshot.value
        else if (current(root)) {
          delete root.userData.timelineSpatial[key]
          if (!Object.keys(root.userData.timelineSpatial).length) delete root.userData.timelineSpatial
        }
      },
    }]
  }))
}

function bodyDefinition(type, label, defaults) {
  return registerNode({
    type, base: 'Node3D', label, category: 'Física', icon: BODY_ICONS[type], scalable: false, physicsNode: true,
    nativeSignals: type === 'area3d' ? AREA3D_NATIVE_SIGNALS : [],
    animation: { ...spatialAnimation(type), 
      ...(['staticbody3d','rigidbody3d'].includes(type) ? combustionEnvironmentAnimation(type) : {}) },
    create: () => ({ name: label, props: { ...defaults } }),
    build(obj) {
      const { root, visual } = makeRoot(obj)
      // Marcador editorial, no collider. Jolt solo se conectará durante S03.
      const marker = hitSphere(0.32)
      root.add(marker)
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.38, 0.38, 0.38)), lineMat(bodyColor[type]))
      lines.userData.helper = true
      visual.add(lines)
      root.userData.editorGizmos = [visual]
      visual.visible = false // En Player no se muestra la ayuda de edición.
      root.userData.disposePhysicsPreview = () => { lines.geometry.dispose(); lines.material.dispose() }
      return root
    },
    update(root, obj) { applyBase(root, obj, false) },
  })
}

bodyDefinition('staticbody3d', 'StaticBody3D', { friction: 0.5, restitution: 0 })
bodyDefinition('rigidbody3d', 'RigidBody3D', {
  mass: 1, gravityScale: 1, linearDamping: 0.05, angularDamping: 0.05,
  friction: 0.5, restitution: 0, canSleep: true,
})

bodyDefinition('characterbody3d', 'CharacterBody3D', {
  velocity: [0, 0, 0], maxSlopeAngle: 50, stepHeight: 0.35, floorSnap: 0.5, gravity: 9.81, mass: 80,
})
bodyDefinition('area3d', 'Area3D', { monitoring: true, monitorable: true })

// La descripción pertenece al nodo, como las claves de física de los padres.
const collisionKeys = [
  ['size', 'Tamaño (m)', 'vec3', [1, 1, 1], ['BoxShape3D']],
  ['radius', 'Radio (m)', 'number', 0.5, ['SphereShape3D', 'CapsuleShape3D']],
  ['height', 'Altura total (m)', 'number', 2, ['CapsuleShape3D']],
  ['disabled', 'Desactivada', 'bool', false, null],
  ['type', 'Forma', 'enum', 'BoxShape3D', null],
  ['sourceId', 'Malla de origen', 'string', '', ['TriMeshShape3D']],
]
const collisionAnimation = Object.fromEntries(collisionKeys.map(([key, label, kind, def, types]) => {
  const available = obj => !types || types.includes(obj.props?.shape?.type)
  const authored = obj => key === 'disabled' ? obj.props?.disabled === true : obj.props?.shape?.[key] ?? def
  const getOverrides = root => root.userData.timelineCollision
  return [`collision.${key}`, {
    label, kind, def, available,
    ...(kind === 'enum' ? { options: Object.values(PHYSICS_SHAPES).map(s => s.type) } : {}),
    ...(kind === 'number' || kind === 'vec3' ? { min: 0.01, max: 100000 } : {}),
    read: authored,
    runtimeRead: (root, obj) => getOverrides(root)?.[key] ?? authored(obj),
    apply: (root, value, obj) => {
      if (!available(obj)) throw new Error(`CollisionShape3D: ${key} no disponible para esta forma`)
      if (kind === 'vec3' && (!Array.isArray(value) || value.some(x => !Number.isFinite(x) || x < 0.01 || x > 100000)))
        throw new RangeError('CollisionShape3D: tamaño inválido')
      ;(root.userData.timelineCollision ??= {})[key] = Array.isArray(value) ? [...value] : value
      refreshCollisionPreview(root,obj)
    },
    capture: root => ({ had: Object.hasOwn(getOverrides(root) || {}, key),
      value: Array.isArray(getOverrides(root)?.[key]) ? [...getOverrides(root)[key]] : getOverrides(root)?.[key] }),
    restore: (root, snapshot, obj) => {
      if (snapshot?.had) (root.userData.timelineCollision ??= {})[key] = snapshot.value
      else if (getOverrides(root)) {
        delete root.userData.timelineCollision[key]
        if (!Object.keys(root.userData.timelineCollision).length) delete root.userData.timelineCollision
      }
      refreshCollisionPreview(root,obj)
    },
  }]
}))
function refreshCollisionPreview(root, obj) {
  const current = effectiveCollisionShape(obj,root)
  const shape = root.userData.editorPreviewShape || current.props.shape
  const signature = JSON.stringify(shape)
  const outline = root.userData.physicsOutline
  if (outline && root.userData.physicsShapeSignature !== signature) {
    const source = previewGeometry(shape)
    const edges = source ? new THREE.EdgesGeometry(source) : new THREE.BufferGeometry()
    outline.geometry.dispose()
    outline.geometry = edges
    source?.dispose()
    root.userData.physicsShapeSignature = signature
  }
  if (outline) outline.position.y = root.userData.editorCapsuleFeet && shape.type === 'CapsuleShape3D' ? shape.height / 2 : 0
  const visual = root.userData.visual
  if (visual) {
    visual.userData.editorGizmoEnabled = current.props.disabled !== true
    visual.visible = !!visual.userData.editorGizmoAllowed && current.props.disabled !== true
  }
}

const shapes = Object.fromEntries(Object.entries(PHYSICS_SHAPES).map(([kind, v]) => [kind, { label: v.label, icon: `shape-${kind}` }]))

function previewGeometry(shape) {
  if (shape.type === 'SphereShape3D') return new THREE.SphereGeometry(shape.radius, 20, 12)
  if (shape.type === 'CapsuleShape3D') {
    const length = Math.max(0, shape.height - shape.radius * 2)
    return new THREE.CapsuleGeometry(shape.radius, length, 6, 12)
  }
  if (shape.type === 'TriMeshShape3D') return null
  return new THREE.BoxGeometry(...shape.size)
}

registerNode({
  type: 'collisionshape3d', base: 'Node3D', label: 'CollisionShape3D', icon: 'shape-box',
  category: 'Física', scalable: false, physicsNode: true, kinds: shapes, animation: collisionAnimation,
  create(kind) { return { name: 'CollisionShape3D', props: { shape: newPhysicsShape(kind === 'collisionshape3d' ? 'box' : kind), disabled: false } } },
  build(obj) {
    const { root, visual } = makeRoot(obj)
    root.add(hitSphere(0.32))
    root.userData.editorGizmos = [visual]
    visual.visible = false // En Player no se muestra la forma de autoría.
    root.userData.disposePhysicsPreview = () => {
      const outline = root.userData.physicsOutline
      if (outline) { outline.geometry.dispose(); outline.material.dispose() }
    }
    return root
  },
  update(root, obj) {
    applyBase(root, obj, false)
    const effective = effectiveCollisionShape(obj,root)
    const shape = root.userData.editorPreviewShape || effective.props.shape
    const sig = JSON.stringify(shape)
    if (root.userData.physicsShapeSignature !== sig) {
      root.userData.disposePhysicsPreview?.()
      root.userData.visual.clear()
      const geometry = previewGeometry(shape)
      const outline = new THREE.LineSegments(geometry ? new THREE.EdgesGeometry(geometry) : new THREE.BufferGeometry(), lineMat('#67bed7'))
      // Las líneas no son superficies ni deben participar en raycast, baking o export.
      outline.userData.helper = true
      geometry?.dispose()
      root.userData.visual.add(outline)
      root.userData.physicsOutline = outline
      root.userData.physicsShapeSignature = sig
    }
    root.userData.physicsOutline.position.y = root.userData.editorCapsuleFeet && shape.type === 'CapsuleShape3D' ? shape.height / 2 : 0
    // Preview ligada a la fuente. Solo se usan líneas de autoría, no un collider adicional.
    root.userData.refreshTriMeshPreview = (sourceRoot) => {
      if (shape.type !== 'TriMeshShape3D' || !sourceRoot) return
      const outline = root.userData.physicsOutline
      if (!outline) return
      try {
        const {positions,indices}=triMeshGeometry(sourceRoot,root)
        const g = new THREE.BufferGeometry()
        g.setAttribute('position',new THREE.BufferAttribute(positions,3))
        g.setIndex(new THREE.BufferAttribute(indices,1))
        const edges=new THREE.EdgesGeometry(g)
        g.dispose();outline.geometry.dispose();outline.geometry=edges
      } catch { // Falta fuente o geometría válida: no mostrar caja engañosa.
        outline.geometry.dispose();outline.geometry=new THREE.BufferGeometry()
      }
    }
    root.userData.visual.userData.editorGizmoEnabled = effective.props.disabled !== true
    root.userData.visual.visible = !!root.userData.visual.userData.editorGizmoAllowed && effective.props.disabled !== true
  },
})
