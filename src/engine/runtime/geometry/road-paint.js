// Datos y raster de pintura, compartidos entre Editor, Player y pruebas Node.
export const ROAD_PAINT_RES = [256, 512] // lateral, longitudinal; límite fijo para evitar texturas enormes
export const ROAD_PAINT_MAX_STROKES = 320
export const ROAD_PAINT_MAX_POINTS = 4096
export const ROAD_PAINT_SLOTS = ['asphalt', 'side']
const C = 3

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(+n) ? +n : min))
const safeId = (v) => String(v || '').slice(0, 128)
export function normalizeRoadPaint(src) {
  const out = { version: 1, asphalt: [], side: [] }
  for (const slot of ROAD_PAINT_SLOTS) {
    const layers = Array.isArray(src?.[slot]) ? src[slot] : []
    out[slot] = layers.slice(0, C).map((layer, i) => ({
      id: safeId(layer.id) || `layer-${i + 1}`,
      materialId: safeId(layer.materialId),
      visible: layer.visible !== false,
      tile: clamp(layer.tile ?? 4, 0.2, 100),
      strokes: (Array.isArray(layer.strokes) ? layer.strokes : []).slice(-ROAD_PAINT_MAX_STROKES).map((s) => ({
        points: (Array.isArray(s.points) ? s.points : []).slice(0, ROAD_PAINT_MAX_POINTS).map((pt) => [clamp(pt?.[0], 0, 1), clamp(pt?.[1], 0, 1)]),
        radius: clamp(s.radius ?? 1, 0.1, 8), hardness: clamp(s.hardness ?? 0.55, 0, 1),
        opacity: clamp(s.opacity ?? 0.7, 0.01, 1), erase: !!s.erase,
      })).filter((s) => s.points.length),
    }))
  }
  return out
}

/** Una muestra de la brocha en distancia métrica aproximada. La máscara NO usa UV de repetición. */
function dab(data, ch, u, v, stroke, { width, length, closed }, w = ROAD_PAINT_RES[0], h = ROAD_PAINT_RES[1]) {
  const rx = Math.max(1, stroke.radius / Math.max(.1, width) * w)
  const ry = Math.max(1, stroke.radius / Math.max(.1, length) * h)
  const cx = u * (w - 1), cy = v * (h - 1)
  const minX = Math.max(0, Math.floor(cx - rx)), maxX = Math.min(w - 1, Math.ceil(cx + rx))
  // En circuitos cerrados, la distancia longitudinal es periódica: el trazo continúa en la unión.
  const ranges = closed ? [-h, 0, h] : [0]
  for (const off of ranges) {
    const y0 = Math.max(0, Math.floor(cy + off - ry)), y1 = Math.min(h - 1, Math.ceil(cy + off + ry))
    if (y1 < y0) continue
    for (let y = y0; y <= y1; y++) for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot((x - cx) / rx, (y - cy - off) / ry)
      if (dist >= 1) continue
      const edge = 1 - stroke.hardness
      const falloff = edge < 0.001 ? 1 : Math.min(1, (1 - dist) / edge)
      const weight = stroke.opacity * falloff
      const idx = (y * w + x) * 4 + ch
      const a = data[idx] / 255
      data[idx] = Math.round((stroke.erase ? a * (1 - weight) : a + (1 - a) * weight) * 255)
    }
  }
}

/** Rasterización determinista; no modifica datos persistidos ni geometría. */
export function rasterRoadPaint(paint, slot, dimensions, w = ROAD_PAINT_RES[0], h = ROAD_PAINT_RES[1]) {
  const data = new Uint8Array(w * h * 4)
  for (let n = 0; n < w * h; n++) data[n * 4 + 3] = 255
  const layers = normalizeRoadPaint(paint)[slot] || []
  layers.forEach((layer, ch) => {
    if (!layer.visible || !layer.materialId) return
    for (const s of layer.strokes) {
      for (let i = 0; i < s.points.length; i++) {
        const a = s.points[Math.max(0, i - 1)], b = s.points[i]
        const dist = Math.hypot((b[0] - a[0]) * dimensions.width, (b[1] - a[1]) * dimensions.length)
        const steps = Math.max(1, Math.min(1000, Math.ceil(dist / Math.max(.05, s.radius / 3))))
        for (let j = i ? 1 : 0; j <= steps; j++) {
          const t = j / steps
          dab(data, ch, a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, s, dimensions, w, h)
        }
      }
    }
  })
  return data
}

