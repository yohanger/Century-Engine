import { validatePhysicsTree } from '../physics/shapes.js'

// Contrato de parentesco de los nodos. Se usa el mismo array que guardan Editor y SceneGraph.
export function validateNodeTree(objects) {
  const byId = new Map()
  for (const node of objects) {
    if (!node?.id || typeof node.id !== 'string') throw new Error('Nodo sin ID válido')
    if (byId.has(node.id)) throw new Error(`ID de nodo duplicado: ${node.id}`)
    byId.set(node.id, node)
  }
  const done = new Set()
  const visiting = new Set()
  function visit(id) {
    if (done.has(id)) return
    if (visiting.has(id)) throw new Error(`Ciclo de nodos: ${id}`)
    visiting.add(id)
    const parentId = byId.get(id).parentId || null
    if (parentId) {
      if (!byId.has(parentId)) throw new Error(`Padre inexistente: ${parentId}`)
      visit(parentId)
    }
    visiting.delete(id)
    done.add(id)
  }
  for (const id of byId.keys()) visit(id)
  validatePhysicsTree(byId)
  return byId
}

/** Comprueba el movimiento antes de modificar parentId. No muta los nodos. */
export function validateNodeParent(objects, id, parentId) {
  const byId = validateNodeTree(objects)
  if (!byId.has(id)) throw new Error(`Nodo inexistente: ${id}`)
  if (parentId != null && !byId.has(parentId)) throw new Error(`Padre inexistente: ${parentId}`)
  if (parentId === id) throw new Error('Un nodo no puede ser su propio padre')
  let parent = parentId
  while (parent != null) {
    if (parent === id) throw new Error('Un nodo no puede depender de su descendiente')
    parent = byId.get(parent)?.parentId || null
  }
  // Se valida el parentesco resultante sin escribir todavía en el proyecto.
  validatePhysicsTree(new Map([...byId].map(([key, o]) => [key, key === id ? { ...o, parentId } : o])))
  return true
}

/** Consulta una sola cadena de padres. Evita revisar toda la escena al sincronizar un nodo. */
export function nodeAncestors(getObject, id) {
  const chain = [], visited = new Set()
  let current = id ? getObject(id) : null
  while (current) {
    if (visited.has(current.id)) throw new Error(`Ciclo de nodos: ${current.id}`)
    visited.add(current.id)
    chain.push(current)
    if (current.parentId && !getObject(current.parentId)) throw new Error(`Padre inexistente: ${current.parentId}`)
    current = current.parentId ? getObject(current.parentId) : null
  }
  return chain
}

/** Malla o primitiva antecesora más cercana; sin padre de malla, el nodo queda libre. */
export function nearestMeshParent(objects, node) {
  if (!node?.parentId) return null
  const byId = objects instanceof Map ? objects : new Map((objects || []).map(o => [o.id, o]))
  return nodeAncestors(id => byId.get(id), node.parentId)
    .find(o => o.type === 'mesh' || o.type === 'primitive') || null
}

/** Estado propio del nodo actual; la ausencia de la propiedad equivale al valor predeterminado true. */
export const nodeActive = (obj) => !!obj && obj.active !== false
export const nodeVisible = (obj) => !!obj && obj.visible !== false

/** No altera los valores de los descendientes: evalúa la cadena de padres. */
export function nodeEffectiveActive(objects, obj) {
  if (!obj) return false
  const byId = objects instanceof Map ? objects : new Map((objects || []).map(o => [o.id, o]))
  const visited = new Set()
  for (let n = obj; n; n = n.parentId ? byId.get(n.parentId) : null) {
    if (visited.has(n.id) || !nodeActive(n) || (n.parentId && !byId.has(n.parentId))) return false
    visited.add(n.id)
  }
  return true
}

export function nodeEffectiveVisible(objects, obj) {
  if (!nodeEffectiveActive(objects, obj)) return false
  const byId = objects instanceof Map ? objects : new Map((objects || []).map(o => [o.id, o]))
  for (let n = obj; n; n = n.parentId ? byId.get(n.parentId) : null) if (!nodeVisible(n)) return false
  return true
}
