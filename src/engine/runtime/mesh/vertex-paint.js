// Pesos de Vertex Paint: mismos ocho canales y metadatos de capa que Terrain.
// Las coordenadas son del mundo (la escala del objeto no deforma el radio del pincel).
import { MAX_LAYERS, normalizeLayers } from '../geometry/terrain-splat.js'

export const BASE_PAINT_LAYER = Object.freeze({ name: 'Base', color: '#b0b0b0', texture: null, tile: 1 })
export const NEW_PAINT_LAYER = Object.freeze({ name: 'Capa', color: '#577e53', texture: null, tile: 1 })
const clamp01 = (v) => Math.max(0, Math.min(1, v))

export function meshPaintConfig(config) {
  if (!config?.enabled || !Array.isArray(config.layers) || !config.layers.length) return null
  return { enabled: true, layers: normalizeLayers(config.layers).slice(0, MAX_LAYERS) }
}

export function ensurePaintWeights(poly) {
  if (poly.weights.length === poly.v.length && poly.weights.every((w) => w.length === MAX_LAYERS)) return
  poly.weights = poly.v.map(() => [1, 0, 0, 0, 0, 0, 0, 0])
}

export function paintWeights(poly, center, positions, { layer = 0, radius = 1, strength = 0.5, hardness = 0.5, erase = false } = {}) {
  if (!Array.isArray(center) || center.length !== 3 || !center.every(Number.isFinite) ||
      positions.length !== poly.v.length || !Number.isInteger(layer) || layer < 0 || layer >= MAX_LAYERS ||
      !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(strength) || strength < 0 || strength > 1 ||
      !Number.isFinite(hardness) || hardness < 0 || hardness > 1) return 0
  // No activar un array de atributos si el trazo no alcanza ningún vértice.
  const targets = []
  for (let i = 0; i < positions.length; i++) {
    if (poly.hidden.has(i)) continue
    const p = positions[i], d = Math.hypot(p[0]-center[0], p[1]-center[1], p[2]-center[2])
    if (d >= radius) continue
    const u = d / radius
    const t = u <= hardness ? 1 : clamp01((1 - u) / Math.max(1e-6, 1 - hardness))
    const falloff = t * t * (3 - 2 * t)
    if (falloff > 0) targets.push([i, falloff])
  }
  if (!targets.length || strength === 0) return 0
  ensurePaintWeights(poly)
  let changed = 0
  for (const [i, falloff] of targets) {
    const w = poly.weights[i], old = clamp01(w[layer])
    const next = clamp01(old + (erase ? -1 : 1) * strength * falloff * 0.25)
    if (Math.abs(next - old) < 1e-7) continue
    let otherSum = 0
    for (let k = 0; k < MAX_LAYERS; k++) if (k !== layer) otherSum += w[k]
    if (otherSum < 1e-8) {
      // Borrar la única capa restaura su peso a la base; pintar la base no cambia nada.
      if (layer === 0) { if (erase) continue; w[0] = 1; continue }
      for (let k = 0; k < MAX_LAYERS; k++) w[k] = 0
      w[0] = 1 - next
    } else {
      const factor = (1 - next) / otherSum
      for (let k = 0; k < MAX_LAYERS; k++) if (k !== layer) w[k] *= factor
    }
    w[layer] = next
    changed++
  }
  return changed
}

export function removePaintLayer(poly, index, count) {
  if (count <= 1 || index < 0 || index >= count) return false
  ensurePaintWeights(poly)
  for (const w of poly.weights) {
    w.splice(index, 1); w.push(0)
    const sum = w.reduce((a, b) => a + b, 0)
    if (sum < 1e-8) { w.fill(0); w[0] = 1 }
    else for (let k = 0; k < MAX_LAYERS; k++) w[k] /= sum
  }
  return true
}

export function swapPaintLayers(poly, a, b, count) {
  if (a < 0 || b < 0 || a >= count || b >= count || a === b) return false
  ensurePaintWeights(poly)
  for (const w of poly.weights) [w[a], w[b]] = [w[b], w[a]]
  return true
}
