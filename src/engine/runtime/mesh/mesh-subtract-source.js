import { PolyMesh } from './polymesh.js'
import { fromPrimitive } from './generators.js'
import { initialSubtractPoly, validateSubtractPoly } from './subtract-edit.js'
import { meshDataOf } from './shared-mesh.js'
import { isTriMeshSource } from '../physics/trimesh-source.js'

export function isMeshSubtractSourceCandidate(node) {
  return !!node && (node.type === 'mesh' || node.type === 'primitive' ||
    (node.type === 'collisionshape3d' && node.props?.shape?.type === 'TriMeshShape3D'))
}

/** La referencia manual tiene prioridad; vacía significa usar el ancestro de malla más cercano. */
export function meshSubtractSourceOf(node, objects = []) {
  const byId = objects instanceof Map ? objects : new Map((objects || []).map(o => [o.id, o]))
  const sourceId = String(node?.props?.sourceId || '').trim()
  if (sourceId) {
    const selected = byId.get(sourceId) || null
    return { selected, source: resolveMeshSubtractSource(selected, [...byId.values()]), automatic: false, sourceId }
  }
  const visited = new Set()
  let selected = node?.parentId ? byId.get(node.parentId) : null
  while (selected && !visited.has(selected.id)) {
    visited.add(selected.id)
    if (selected.type === 'mesh' || selected.type === 'primitive') {
      return { selected, source: resolveMeshSubtractSource(selected, [...byId.values()]), automatic: true, sourceId: selected.id }
    }
    selected = selected.parentId ? byId.get(selected.parentId) : null
  }
  return { selected: null, source: null, automatic: true, sourceId: '' }
}

/** Un Mesh Substract automático representa al padre compatible desde su origen local. */
export function shouldAlignMeshSubtractToParent(node, objects = [], parentId = node?.parentId) {
  if (node?.type !== 'meshSubtract' || String(node.props?.sourceId || '').trim()) return false
  return !!meshSubtractSourceOf({ ...node, parentId: parentId || null }, objects).source
}

export function resolveMeshSubtractSource(selected, objects = []) {
  if (selected?.type !== 'collisionshape3d') return selected
  if (selected.props?.shape?.type !== 'TriMeshShape3D') return null
  const geometry = objects.find(o => o.id === selected.props.shape.sourceId)
  return isTriMeshSource(objects, selected, geometry) ? geometry : null
}

const SOLIDS = new Set(['box', 'ramp', 'stairs', 'cylinder', 'cone', 'sphere'])

export function meshSubtractSourcePoly(source, meshes = []) {
  if (!source) return { poly: null, error: 'Selecciona una malla cortadora o coloca el nodo bajo una malla compatible' }
  if (source.type !== 'mesh' && source.type !== 'primitive') {
    return { poly: null, error: 'La fuente debe ser una malla editable o una primitiva sólida' }
  }
  try {
    let poly
    if (source.type === 'mesh') {
      const data = meshDataOf(source, meshes)
      if (!data) return { poly: null, error: 'La malla de origen no contiene geometría' }
      poly = PolyMesh.fromJSON(data)
    } else {
      if (!SOLIDS.has(source.kind)) return { poly: null, error: 'La primitiva de origen no define un volumen sólido compatible' }
      poly = source.kind === 'stairs' ? initialSubtractPoly(source) : fromPrimitive(source.kind, [1, 1, 1], source.props || {})
    }
    const error = validateSubtractPoly(poly)
    return { poly: error ? null : poly, error: error || '' }
  } catch (error) {
    return { poly: null, error: `La geometría cortadora no es válida: ${error.message}` }
  }
}

export function meshSubtractSourceSignature(source, meshes = []) {
  if (!source) return ''
  const data = source.type === 'mesh' ? meshDataOf(source, meshes) : null
  return JSON.stringify([
    source.id, source.type, source.kind, source.props?.meshRef || '', data?.rev ?? null,
    source.type === 'primitive' ? source.props : null,
  ])
}

export function remapMeshSubtractSourceIds(nodes, idMap) {
  for (const node of nodes) {
    if (node.type !== 'meshSubtract' || !node.props?.sourceId) continue
    if (idMap.has(node.props.sourceId)) node.props.sourceId = idMap.get(node.props.sourceId)
  }
}
