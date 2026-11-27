import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js'

let ready = false
MeshoptSimplifier.ready?.then(() => { ready = true }).catch(() => {})

// Las posiciones próximas no implican conectividad. Soldar solo vértices
// idénticos, incluidos UV, normales y color, para entradas sin índice.
export function indexExactVertices(input) {
  if (input.index) return input
  const { position, attrs = {} } = input
  const unique = new Map(), index = new Uint32Array(position.length / 3)
  for (let i = 0; i < index.length; i++) {
    const values = Array.from(position.subarray(i * 3, i * 3 + 3))
    for (const { array, itemSize } of Object.values(attrs))
      for (let k = 0; k < itemSize; k++) values.push(array[i * itemSize + k])
    const key = values.join(',')
    if (!unique.has(key)) unique.set(key, i)
    index[i] = unique.get(key)
  }
  return { ...input, index }
}

/** Colapsos de aristas conectadas, con límite de desviación y bordes bloqueados. */
export function simplifyTopology(input, ratio) {
  if (!ready || !MeshoptSimplifier.supported) return null
  const { position, index, attrs = {} } = indexExactVertices(input)
  const target = Math.max(3, Math.min(index.length, Math.floor(index.length / 3 * ratio) * 3))
  const limit = MeshoptSimplifier.getScale(position, 3) * 0.02
  const [indices, error] = MeshoptSimplifier.simplify(index, position, 3, target, limit, ['LockBorder', 'ErrorAbsolute'])
  if (!indices.length || indices.length >= index.length || !Number.isFinite(error)) return null
  return { ...compactIndexedGeometry({ position, attrs }, indices), error }
}

/** Conserva los atributos originales de cada vértice y los bordes abiertos. */
export async function buildIndexedLods(input, ratios) {
  if (!MeshoptSimplifier.supported) return []
  await MeshoptSimplifier.ready
  ready = true
  const prepared = indexExactVertices(input)
  const { index } = prepared
  const levels = []
  let previousCount = index.length
  let previousError = 0
  for (const ratio of ratios) {
    const result = simplifyTopology(prepared, ratio)
    if (!result || result.index.length >= previousCount) continue
    previousCount = result.index.length
    previousError = Math.max(result.error, previousError)
    levels.push({ ...result, error: previousError })
  }
  return levels
}

// Recibe una copia de los índices porque compactMesh los remapea in situ.
export function compactIndexedGeometry({ position, attrs }, index) {
  const [remap, vertices] = MeshoptSimplifier.compactMesh(index)
  const compact = (array, itemSize) => {
    const output = new Float32Array(vertices * itemSize)
    for (let i = 0; i < remap.length; i++) {
      if (remap[i] >= vertices) continue
      for (let k = 0; k < itemSize; k++) output[remap[i] * itemSize + k] = array[i * itemSize + k]
    }
    return output
  }
  const attributes = Object.fromEntries(Object.entries(attrs).map(([name, { array, itemSize }]) =>
    [name, { array: compact(array, itemSize), itemSize }]))
  return { position: compact(position, 3), index, attrs: attributes, triangles: index.length / 3 }
}
