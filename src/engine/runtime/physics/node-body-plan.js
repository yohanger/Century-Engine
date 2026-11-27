// Lee la jerarquía persistida y decide qué cuerpos físicos existen.
// No crea mallas, no toca Jolt y no depende del editor.
import { PHYSICS_BODY_TYPES, validatePhysicsTree } from './shapes.js'

export function physicsNodePlan(objects) {
  const byId = new Map(objects.map((o) => [o.id, o]))
  if (byId.size !== objects.length) throw new Error('La escena contiene IDs de nodos duplicados')
  validatePhysicsTree(byId)
  const children = new Map()
  for (const o of objects) {
    if (!o.parentId) continue
    if (!children.has(o.parentId)) children.set(o.parentId, [])
    children.get(o.parentId).push(o)
  }
  const bodies = []
  for (const obj of objects) {
    if (!['staticbody3d', 'rigidbody3d'].includes(obj.type)) continue
    const shapes = (children.get(obj.id) || []).filter((child) => child.type === 'collisionshape3d' && child.props?.disabled !== true)
    if (!shapes.length) continue // un cuerpo sin forma no crea una colisión invisible
    bodies.push({ obj, shapes, dynamic: obj.type === 'rigidbody3d' })
  }
  return bodies
}
