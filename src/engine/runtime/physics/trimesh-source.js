// Fuente explícita de TriMeshShape3D. Los triángulos provienen de la malla editable;
// el recurso solo conserva el ID del nodo, sin duplicar vértices en el .lfproj.
const GEOMETRY = new Set(['primitive', 'mesh'])
const BODIES = new Set(['staticbody3d', 'rigidbody3d', 'characterbody3d', 'area3d'])

/** Una malla pertenece a un cuerpo si está bajo él, sin cruzar otro cuerpo físico. */
export function isTriMeshSource(objects, shape, candidate) {
  if (!shape || shape.type !== 'collisionshape3d' || !candidate || !GEOMETRY.has(candidate.type)) return false
  const byId = objects instanceof Map ? objects : new Map(objects.map(o => [o.id, o]))
  const body = byId.get(shape.parentId)
  if (body?.type !== 'staticbody3d' || candidate.id === shape.id) return false
  const seen = new Set()
  for (let cursor = candidate; cursor; cursor = byId.get(cursor.parentId)) {
    if (seen.has(cursor.id)) return false
    seen.add(cursor.id)
    if (cursor.id === body.id) return true
    if (BODIES.has(cursor.type)) return false
  }
  return false
}

export function triMeshSources(objects, shape) {
  return (objects || []).filter(o => isTriMeshSource(objects, shape, o))
}

export function resolveTriMeshSource(objects, shape) {
  const id = shape.props?.shape?.sourceId
  if (!id) throw new Error(`${shape.name || 'TriMeshShape3D'}: selecciona una primitiva o malla de origen`)
  const source = (objects || []).find(o => o.id === id)
  if (!isTriMeshSource(objects, shape, source)) throw new Error('TriMeshShape3D: la malla de origen no pertenece a su StaticBody3D')
  return source
}

export function remapTriMeshSourceIds(nodes, idMap) {
  for (const node of nodes) {
    const shape = node.type === 'collisionshape3d' ? node.props?.shape : null
    if (shape?.type === 'TriMeshShape3D' && idMap.has(shape.sourceId)) shape.sourceId = idMap.get(shape.sourceId)
  }
}
