import { surfaceFromPaintName } from '../layers.js'
// Selección conservadora de suelo capaz de liberar polvo. No altera terreno ni WaterWorld.
const LOOSE = new Set(['dirt', 'sand', 'gravel'])
const clamp01 = (n) => Math.max(0, Math.min(1, n))

/** Solo una superficie declarada y seca puede aportar polvo terrestre. */
export function tornadoSurfaceAt(terrains, x, z, { waterAt, wet = 0, rain = 0, snow = 0 } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null
  for (const terrain of terrains || []) {
    if (terrain?.enabled === false) continue
    const y = terrain?.groundAt?.(x, z)
    if (!Number.isFinite(y)) continue
    const layerIndex = terrain.paintAt?.(x, z) ?? -1
    const layer = terrain.layers?.[layerIndex]
    const kind = layer?.surface || surfaceFromPaintName(layer?.name)
    if (!LOOSE.has(kind)) return null // usa la misma clasificación Auto del Inspector de terreno
    const water = waterAt?.(x, z)
    if (water && Number.isFinite(water.surface) && water.surface > y + 0.02) return null
    const humidity = Math.max(clamp01(wet), clamp01(snow), clamp01(rain))
    const dryness = 1 - humidity
    if (dryness <= 0.05) return null
    return { x, y, z, surface: kind, color: layer.color, dryness }
  }
  return null
}

/** Emisión gobernada por la intensidad física, sin acoplarla a la longitud del embudo. */
export function tornadoDustRate(tornado, dryness) {
  if (!tornado?.active || !Number.isFinite(tornado.intensity) || tornado.intensity <= 0) return 0
  return Math.min(42, Math.max(0, (tornado.intensity - 7) * 1.6) * clamp01(dryness))
}
