import { isTriMeshSource } from './trimesh-source.js'
// Recursos de forma del nodo CollisionShape3D. No contienen un cuerpo Jolt ni geometría Three.js.
export const PHYSICS_SHAPES = Object.freeze({
  box: { label: 'BoxShape3D', type: 'BoxShape3D' },
  sphere: { label: 'SphereShape3D', type: 'SphereShape3D' },
  capsule: { label: 'CapsuleShape3D', type: 'CapsuleShape3D' },
  mesh: { label: 'TriMeshShape3D', type: 'TriMeshShape3D' },
})

/** Sólo lectura: superpone valores de Timeline sin modificar el proyecto. */
export function effectiveCollisionShape(obj, root) {
  const overrides = root?.userData?.timelineCollision
  if (!overrides || !Object.keys(overrides).length) return obj
  const original = obj.props.shape
  const type = overrides.type ?? original.type
  const kind = Object.keys(PHYSICS_SHAPES).find(k => PHYSICS_SHAPES[k].type === type)
  if (!kind) throw new Error(`CollisionShape3D: tipo no reconocido ${type}`)
  const shape = type === original.type ? { ...original } : newPhysicsShape(kind)
  for (const key of ['size', 'radius', 'height', 'sourceId']) if (Object.hasOwn(overrides, key))
    shape[key] = Array.isArray(overrides[key]) ? [...overrides[key]] : overrides[key]
  const props = { ...obj.props, shape, disabled: Object.hasOwn(overrides, 'disabled') ? overrides.disabled : obj.props.disabled }
  return { ...obj, props }
}

export const PHYSICS_BODY_TYPES = new Set(['staticbody3d', 'rigidbody3d'])
export const PHYSICS_SHAPE_PARENTS = new Set([...PHYSICS_BODY_TYPES, 'characterbody3d', 'area3d'])

export function newPhysicsShape(kind = 'box') {
  switch (kind) {
    case 'box': return { type: 'BoxShape3D', size: [1, 1, 1] }
    case 'sphere': return { type: 'SphereShape3D', radius: 0.5 }
    case 'capsule': return { type: 'CapsuleShape3D', radius: 0.5, height: 2 }
    case 'mesh': return { type: 'TriMeshShape3D', sourceId: '' }
    default: throw new Error(`Forma física desconocida: ${kind}`)
  }
}

function positive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.01 || value > 100000) {
    throw new Error(`${label}: valor positivo y finito requerido (0.01–100000 m)`)
  }
}

/** Valida el recurso antes de guardarlo. No corrige dimensiones defectuosas silenciosamente. */
export function validatePhysicsShape(shape) {
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) throw new Error('CollisionShape3D requiere un recurso Shape3D')
  if (shape.type === 'BoxShape3D') {
    if (!Array.isArray(shape.size) || shape.size.length !== 3) throw new Error('BoxShape3D necesita tamaño XYZ')
    shape.size.forEach((v, i) => positive(v, `Tamaño ${'XYZ'[i]}`))
    if (shape.autoFit !== undefined && typeof shape.autoFit !== 'boolean') throw new Error('Autoajuste BoxShape3D debe ser booleano')
  } else if (shape.type === 'TriMeshShape3D') {
    if (typeof shape.sourceId !== 'string' || shape.sourceId.length > 128) throw new Error('TriMeshShape3D requiere ID de malla fuente válido')
  } else if (shape.type === 'SphereShape3D') positive(shape.radius, 'Radio')
  else if (shape.type === 'CapsuleShape3D') {
    positive(shape.radius, 'Radio')
    positive(shape.height, 'Altura')
    if (shape.height < shape.radius * 2) throw new Error('La altura de la cápsula debe ser al menos dos veces su radio')
  } else throw new Error(`Recurso físico no admitido: ${shape.type}`)
  return true
}

const unitScale = (o) => !o.scale || (Array.isArray(o.scale) && o.scale.length === 3 && o.scale.every((v) => v === 1))

/** Validación de autoría sobre el mismo árbol persistido. No activa ni duplica la física. */
export function validatePhysicsTree(byId) {
  for (const o of byId.values()) {
    if (o.type !== 'collisionshape3d' && !PHYSICS_SHAPE_PARENTS.has(o.type)) continue
    if (!unitScale(o)) throw new Error(`${o.name || o.id}: los nodos físicos usan escala (1, 1, 1); cambia el recurso Shape3D`)
    if (o.type === 'collisionshape3d') {
      const parent = byId.get(o.parentId)
      if (!parent || !PHYSICS_SHAPE_PARENTS.has(parent.type)) {
        throw new Error('CollisionShape3D debe ser hija directa de StaticBody3D, RigidBody3D, CharacterBody3D o Area3D')
      }
      validatePhysicsShape(o.props?.shape)
      if (o.props.shape.type === 'TriMeshShape3D' && parent.type !== 'staticbody3d') throw new Error('TriMeshShape3D solo se admite bajo StaticBody3D')
      if (o.props.shape.type === 'TriMeshShape3D' && o.props.shape.sourceId) {
        const source = byId.get(o.props.shape.sourceId)
        if (!isTriMeshSource(byId, o, source)) throw new Error('TriMeshShape3D: origen fuera de StaticBody3D o inexistente')
      }
      if (o.props?.disabled !== undefined && typeof o.props.disabled !== 'boolean') throw new Error('Disabled debe ser booleano')
    } else {
      const p = o.props || {}
      const keys = o.type === 'rigidbody3d' ? ['mass', 'gravityScale', 'linearDamping', 'angularDamping', 'friction', 'restitution']
        : o.type === 'staticbody3d' ? ['friction', 'restitution']
        : o.type === 'characterbody3d' ? ['maxSlopeAngle', 'stepHeight', 'floorSnap', 'gravity', 'mass'] : []
      for (const k of keys) {
        if (typeof p[k] !== 'number' || !Number.isFinite(p[k]) || (k !== 'gravityScale' && p[k] < (k === 'mass' ? 0.001 : 0))) {
          throw new Error(`${o.type}: ${k} inválido`)
        }
      }
      if (o.type === 'characterbody3d') {
        if (!Array.isArray(p.velocity) || p.velocity.length !== 3 || !p.velocity.every((v) => typeof v === 'number' && Number.isFinite(v))) throw new Error('CharacterBody3D: velocity debe ser XYZ finito')
        if (p.maxSlopeAngle > 89 || p.stepHeight > 10 || p.floorSnap > 10 || p.mass === 0) throw new Error('CharacterBody3D: parámetros fuera de rango')
        const shapes = [...byId.values()].filter((n) => n.parentId === o.id && n.type === 'collisionshape3d' && n.props?.disabled !== true)
        if (shapes.length > 1 || (shapes.length && shapes[0].props.shape.type !== 'CapsuleShape3D')) throw new Error('CharacterBody3D requiere una única CapsuleShape3D habilitada')
        if (shapes.some((n) => (n.position || []).some((v) => Math.abs(v) > 1e-8) || (n.rotation || []).some((v) => Math.abs(v) > 1e-8))) throw new Error('CharacterBody3D requiere la cápsula centrada y sin rotación local')
      }
      if (o.type === 'area3d' && (typeof p.monitoring !== 'boolean' || typeof p.monitorable !== 'boolean')) throw new Error('Area3D: Monitoring y Monitorable deben ser booleanos')
      if ('friction' in p && (p.friction > 1 || p.restitution > 1)) throw new Error('Rozamiento y rebote deben estar entre 0 y 1')
      if (o.type === 'rigidbody3d' && typeof p.canSleep !== 'boolean') throw new Error('RigidBody3D: canSleep inválido')
    }
    // Jolt S03: una jerarquía física no debe heredar escala de Node3D.
    let parent = byId.get(o.parentId)
    while (parent) {
      if (!unitScale(parent)) throw new Error('Los cuerpos y formas físicos no admiten escala heredada: usa dimensiones del Shape3D')
      parent = byId.get(parent.parentId)
    }
  }
  return true
}
