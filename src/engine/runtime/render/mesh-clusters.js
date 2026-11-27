import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js'
import { buildIndexedLods, compactIndexedGeometry } from './lod-indexed.js'

const CLUSTER_TRIANGLES = 768

/** Partición espacial binaria de triángulos, cuyos índices siguen apuntando al modelo original. */
export function partitionTriangles({ index, position }, limit = CLUSTER_TRIANGLES) {
  const count = index.length / 3
  const centers = new Float32Array(index.length)
  const triangles = Array.from({ length: count }, (_, i) => i)
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i] * 3, index[i + 1] * 3, index[i + 2] * 3]
    for (let k = 0; k < 3; k++) centers[i + k] = (position[a + k] + position[b + k] + position[c + k]) / 3
  }
  const leaves = []
  const split = (ids) => {
    if (ids.length <= limit) {
      const part = new Uint32Array(ids.length * 3)
      for (let i = 0; i < ids.length; i++) {
        const offset = ids[i] * 3
        part.set(index.subarray(offset, offset + 3), i * 3)
      }
      leaves.push(part)
      return
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (const id of ids) {
      for (let axis = 0; axis < 3; axis++) {
        const value = centers[id * 3 + axis]
        min[axis] = Math.min(min[axis], value)
        max[axis] = Math.max(max[axis], value)
      }
    }
    let axis = 0
    for (let k = 1; k < 3; k++) if (max[k] - min[k] > max[axis] - min[axis]) axis = k
    ids.sort((a, b) => centers[a * 3 + axis] - centers[b * 3 + axis])
    const middle = ids.length >> 1
    split(ids.slice(0, middle))
    split(ids.slice(middle))
  }
  if (count) split(triangles)
  return leaves
}

export async function buildMeshClusters(input) {
  if (!input.index || !MeshoptSimplifier.supported) return []
  await MeshoptSimplifier.ready
  const clusters = []
  for (const index of partitionTriangles(input)) {
    const base = compactIndexedGeometry(input, index)
    const lods = await buildIndexedLods(base, [0.45, 0.2])
    clusters.push([{ ...base, error: 0 }, ...lods])
  }
  return clusters
}
