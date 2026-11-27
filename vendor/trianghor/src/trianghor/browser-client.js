import { requestTriangHorBake } from './job.js'
import { assertTriangHorInput } from './validate.js'

// El host controla el ciclo de vida del Worker y la cancelación.
export function createTriangHorWorker() {
  return new Worker(new URL('./bake.worker.js', import.meta.url), { type: 'module' })
}

export function bakeTerrainOffThread(terrain, settings, signal, onProgress) {
  if (signal?.aborted) return Promise.reject(new Error('TriangHor cancelado'))
  try {
    assertTriangHorInput(terrain)
    const input = {
      heights: new Float32Array(terrain.heights),
      splat: terrain.splat != null ? new Uint8Array(terrain.splat) : null,
      nx: terrain.nx,
      nz: terrain.nz,
      settings,
      channels: terrain.channels ?? 8,
    }
    return requestTriangHorBake(input, {
      makeWorker: createTriangHorWorker, signal, onProgress,
    })
  } catch (error) { return Promise.reject(error) }
}
