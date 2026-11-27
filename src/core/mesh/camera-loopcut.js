import { ekey } from '../../engine/runtime/mesh/polymesh.js'
import { validLoopCutRing } from './cuts.js'

/** Prioriza aristas pertenecientes a la cara visible bajo la cámara. No altera el recorrido topológico. */
export function cameraFacingLoopEdge(mesh, faceIndex, screen, projectPoint, cuts = 1) {
  const face = mesh?.f?.[faceIndex]
  if (!face || face.length !== 4 || !screen || typeof projectPoint !== 'function') return null
  let winner = null, min = Infinity
  for (let i = 0; i < 4; i++) {
    const a = face[i], b = face[(i + 1) % 4]
    const key = ekey(a, b)
    if (!validLoopCutRing(mesh, key, cuts)) continue
    const pa = projectPoint(mesh.v[a]), pb = projectPoint(mesh.v[b])
    if (![pa?.x, pa?.y, pb?.x, pb?.y].every(Number.isFinite)) continue
    if (pa.z > 1 || pb.z > 1) continue
    const dx = pb.x - pa.x, dy = pb.y - pa.y, lengthSq = dx*dx + dy*dy
    if (lengthSq < 64) continue
    const t = Math.max(0, Math.min(1, ((screen.x - pa.x)*dx + (screen.y - pa.y)*dy)/lengthSq))
    const distance = (screen.x - pa.x - t*dx)**2 + (screen.y - pa.y - t*dy)**2
    if (distance < min) { min = distance; winner = key }
  }
  return winner
}
