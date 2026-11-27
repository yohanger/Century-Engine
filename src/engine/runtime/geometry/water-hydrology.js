// Hidrología S06: perfiles de capas y pesos de pintura; no crea un segundo solver.
import { STRIDE, DEFAULT_HYDROLOGY, normalizedHydrology } from './terrain-splat.js'

/** Las capas del Terrain se muestrean en el punto mundial mediante interpolación bilineal del splat. */
export function hydrologyAt(terrains, x, z) {
  for (const t of terrains) {
    if (t.enabled === false || !Number.isFinite(t.size) || !(t.size > 0) || !Number.isInteger(t.segments) || t.segments < 1) continue
    const u = (x - t.ox) / t.size + 0.5, v = (z - t.oz) / t.size + 0.5
    if (u < 0 || u > 1 || v < 0 || v > 1) continue
    const n = t.segments, cols = n + 1
    const px = u * n, py = v * n, i = Math.min(n - 1, Math.floor(px)), j = Math.min(n - 1, Math.floor(py))
    const fu = px - i, fv = py - j
    if (!t.splat || t.splat.length !== cols * cols * STRIDE) throw new Error('Hidrología: mapa de pesos inválido')
    const corners = [[i,j,(1-fu)*(1-fv)],[i+1,j,fu*(1-fv)],[i,j+1,(1-fu)*fv],[i+1,j+1,fu*fv]]
    const result = { ...DEFAULT_HYDROLOGY }
    let sum = 0
    for (const [cx, cy, frac] of corners) for (let k = 0; k < t.layers.length; k++) {
      const weight = (t.splat[(cy * cols + cx) * STRIDE + k] / 255) * frac
      if (!weight) continue
      const p = normalizedHydrology(t.layers[k].hydrology)
      for (const field of Object.keys(result)) result[field] += weight * p[field]
      sum += weight
    }
    if (sum > 0) for (const field of Object.keys(result)) result[field] /= sum
    return result
  }
  return { ...DEFAULT_HYDROLOGY }
}

/** Un perfil por celda; almacena capacidades como altura equivalente [m]. */
export function hydrologyGrid(region, terrains, valid) {
  const n = region.width * region.height
  const capacity = new Float64Array(n), infiltration = new Float64Array(n)
  const drainage = new Float64Array(n), initial = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    if (!valid[k]) continue
    const i = k % region.width, j = Math.floor(k / region.width)
    const p = hydrologyAt(terrains, region.x + (i + 0.5) * region.dx, region.z + (j + 0.5) * region.dz)
    capacity[k] = p.capacityMm / 1000
    infiltration[k] = p.infiltrationMmH / 3600000
    drainage[k] = p.drainageMmH / 3600000
    initial[k] = capacity[k] * p.initialSaturation
  }
  return { capacity, infiltration, drainage, initial }
}
