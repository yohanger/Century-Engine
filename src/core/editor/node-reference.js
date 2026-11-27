// Expresión de referencia para los scripts del motor. No almacena copias del nodo.
export function nodeReference(id) {
  if (typeof id !== 'string' || !id || id.length > 160 || /[\x00-\x1f\x7f]/.test(id)) {
    throw new Error('Identificador de nodo inválido')
  }
  return `game.node(${JSON.stringify(id)})`
}

// El payload de Jerarquía ya existe; solo se acepta un nodo de la escena activa.
export function nodeReferenceFromDrop(dataTransfer, objects) {
  const types = [...(dataTransfer?.types || [])]
  if (!types.includes('application/x-lf-node')) return null
  let ids
  try { ids = JSON.parse(dataTransfer.getData('application/x-lf-node')) } catch { return null }
  if (!Array.isArray(ids) || ids.length !== 1 || !objects?.some(o => o.id === ids[0])) return null
  return nodeReference(ids[0])
}
