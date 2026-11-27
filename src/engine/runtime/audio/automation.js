// Curva por clip: tiempo relativo al Timeline y ganancia multiplicativa de 0 a 1.
// Los datos históricos sin puntos no cambian su reproducción ni serialización.
export const MAX_VOLUME_POINTS = 64
export const MAX_VOLUME_POINT_NAME = 48

// Opcional: abrir proyectos anteriores nunca les asigna un nombre persistente.
export function normalizeVolumePointName(name) {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > MAX_VOLUME_POINT_NAME || /[\x00-\x1f\x7f]/.test(trimmed)) return null
  return trimmed
}

export function normalizeVolumeAutomation(points, duration) {
  if (!Array.isArray(points) || !(Number.isFinite(duration) && duration > 0)) return []
  const result = [], ids = new Set(), times = new Set(), orders = new Set()
  for (const item of points.slice(0, MAX_VOLUME_POINTS)) {
    const t = Number(item?.t), value = Number(item?.value), id = typeof item?.id === 'string' ? item.id : ''
    if (!id || ids.has(id) || !Number.isFinite(t) || t < 0 || t > duration + 1e-6 ||
        !Number.isFinite(value) || value < 0 || value > 1) continue
    const at = +Math.min(duration, t).toFixed(5)
    if (times.has(at)) continue
    const point = { id, t: at, value: +value.toFixed(4) }
    const name = normalizeVolumePointName(item.name)
    if (name) point.name = name
    if (Number.isSafeInteger(item.createdOrder) && item.createdOrder > 0 && !orders.has(item.createdOrder)) {
      point.createdOrder = item.createdOrder
      orders.add(item.createdOrder)
    }
    result.push(point)
    ids.add(id); times.add(at)
  }
  return result.sort((a, b) => a.t - b.t)
}

// El Inspector muestra FIFO por orden de creación sin alterar los tiempos de WebAudio.
// Las claves antiguas sin ordinal mantienen un orden inicial determinista por su orden de lectura.
export function volumeAutomationVisualOrder(points) {
  if (!Array.isArray(points)) return []
  return points.map((point, index) => ({ point, order: Number.isSafeInteger(point.createdOrder) && point.createdOrder > 0 ? point.createdOrder : index + 1, index }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(entry => entry.point)
}

export function volumeAutomationAt(points, time) {
  if (!Array.isArray(points) || !points.length) return 1
  let previous = { t: 0, value: 1 }
  for (const next of points) {
    if (time < next.t) {
      const span = next.t - previous.t
      return span > 0 ? previous.value + (next.value - previous.value) * Math.max(0, Math.min(1, (time - previous.t) / span)) : next.value
    }
    previous = next
  }
  return previous.value
}

// Una sola programación por inicio/reanudación/seek, nunca cancelar en cada frame.
export function scheduleVolumeAutomation(param, now, points, elapsed = 0, rate = 1) {
  if (!Array.isArray(points) || !points.length) return
  const position = Math.max(0, elapsed), speed = Math.max(0.01, rate)
  param.cancelScheduledValues(now)
  param.setValueAtTime(volumeAutomationAt(points, position), now)
  for (const point of points) if (point.t > position) {
    param.linearRampToValueAtTime(point.value, now + (point.t - position) / speed)
  }
}
