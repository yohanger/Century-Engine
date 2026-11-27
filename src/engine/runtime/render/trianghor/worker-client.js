import TriangHorWorker from 'trianghor/worker?worker&inline'
import { runTerrainBake, releaseTerrainBakeWorker } from './worker-service.js'

function makeWorker() { return new TriangHorWorker() }

export function bakeTerrainOffThread(terrain, settings, signal, onProgress) {
  return runTerrainBake(terrain, settings, signal, onProgress, makeWorker)
}

export { releaseTerrainBakeWorker }
