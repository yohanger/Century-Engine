// Operaciones puras para el editor de curvas; el recurso se valida antes de confirmarse.
export function moveVfxPoint(points, index, t, value, field = 'value') {
  if (!Array.isArray(points) || index < 0 || index >= points.length) throw new Error('Punto VFX inexistente')
  const result = points.map((point) => ({ ...point }))
  const last = points.length - 1
  const low = index === 0 ? 0 : points[index - 1].t + 0.001
  const high = index === last ? 1 : points[index + 1].t - 0.001
  const time = index === 0 ? 0 : index === last ? 1 : Math.max(low, Math.min(high, t))
  result[index] = { ...result[index], t: Number(time.toFixed(4)), [field]: value }
  return result
}

export function insertVfxPoint(points, field = 'value') {
  if (!Array.isArray(points) || points.length < 2 || points.length >= 32) return null
  let position = 0
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i + 1].t - points[i].t > points[position + 1].t - points[position].t) position = i
  }
  const a = points[position], b = points[position + 1]
  const t = Number(((a.t + b.t) / 2).toFixed(4))
  if (!(t > a.t && t < b.t)) return null
  const value = field === 'color' ? a.color : (a.value + b.value) / 2
  return [...points.slice(0, position + 1), { t, [field]: value }, ...points.slice(position + 1)]
}

export function removeVfxPoint(points, index) {
  return index <= 0 || index >= points.length - 1 || points.length <= 2 ? null : points.filter((_, i) => i !== index)
}
