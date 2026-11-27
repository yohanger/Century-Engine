// TriangHor usa el simplificador de Terrain existente y publica solo resultados certificados.
import { terrainBakePlan } from '../terrain-bake.js'
import { assertTriangHorInput } from './validate.js'
export function computeTriangHor(input, { reuse=null } = {}) {
  assertTriangHorInput(input)
  const { heights, splat, nx, nz, settings, channels=8 } = input
  const started=performance.now()
  const plan=terrainBakePlan(heights,splat,nx,nz,settings,channels,reuse)
  return { ...plan, bakeMs:performance.now()-started, algorithm:'TriangHor · adaptativo' }
}
