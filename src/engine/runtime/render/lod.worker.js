// La simplificación no lee ni transfiere los buffers que ya usa WebGL.
import { packGpuClusters } from './gpu-cluster-data.js'
import { buildMeshClusters } from './mesh-clusters.js'
import { buildIndexedLods } from './lod-indexed.js'

const buffersOf = ({ position, index, attrs }) =>
  [position.buffer, index.buffer, ...Object.values(attrs).map(a => a.array.buffer)]

self.onmessage = async ({ data: { input, ratio, ratios, clusters, gpuClusters } }) => {
  try {
    if (gpuClusters) {
      const pages = await buildMeshClusters(input)
      const result = pages.length ? packGpuClusters(pages) : null
      const transfer = result ? [...Object.values(result.attrs).map(a => a.array.buffer),
        result.position.buffer, result.source.buffer, result.metadata.buffer] : []
      self.postMessage(result, transfer)
    } else if (clusters) {
      const result = await buildMeshClusters(input)
      self.postMessage(result, result.flat().flatMap(buffersOf))
    } else if (ratios) {
      const levels = await buildIndexedLods(input, ratios)
      self.postMessage(levels, levels.flatMap(buffersOf))
    } else {
      const [result] = await buildIndexedLods(input, [ratio])
      self.postMessage(result || null, result ? buffersOf(result) : [])
    }
  } catch (error) {
    console.warn('No se pudo generar el LOD de la malla', error)
    self.postMessage(null)
  }
}
