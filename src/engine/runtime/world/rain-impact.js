// Gotas visibles: geometría de trayectoria e intersección. Solo efectos; el volumen se contabiliza en WaterWorld.
const mod = (value, size) => ((value % size) + size) % size

/** Misma transformación wrapAround que utiliza el shader GPU de PrecipFX. */
export function rainPoint(seed, offset, camera, size, height, index = 0, out = [0, 0, 0]) {
  const cy = camera.y - height * 0.35
  const sx = seed[index] * size + offset.x
  const sz = seed[index + 1] * size + offset.z
  const sy = seed[index + 3] * height + offset.y * (0.85 + 0.3 * seed[index + 2])
  out[0] = camera.x + mod(sx - camera.x + size * 0.5, size) - size * 0.5
  out[1] = cy + mod(sy - cy, height)
  out[2] = camera.z + mod(sz - camera.z + size * 0.5, size) - size * 0.5
  return out
}

/** Primer choque sobre el segmento real: primitiva o suelo. No genera lluvia ni volumen nuevo. */
export function traceRainSegment(from, to, ground, cast) {
  const dy = from[1] - to[1]
  if (!(dy > 0)) return null
  const dx = to[0] - from[0], dz = to[2] - from[2]
  let result = null, fraction = Infinity
  const hit = cast?.(from, to)
  if (hit?.point?.length === 3 && hit?.normal?.length === 3) {
    const h = hit.point, n = hit.normal
    const span = dx * dx + dy * dy + dz * dz
    const t = span > 0 ? ((h[0] - from[0]) * dx - (h[1] - from[1]) * dy + (h[2] - from[2]) * dz) / span : Infinity
    const offX = from[0] + dx * t - h[0], offY = from[1] - dy * t - h[1], offZ = from[2] + dz * t - h[2]
    const normalLength = Math.hypot(...n)
    if (t >= -1e-5 && t <= 1 + 1e-5 && offX * offX + offY * offY + offZ * offZ < 0.0004 && normalLength > 0.1) {
      fraction = Math.max(0, t)
      result = { point: [...h], normal: n.map((v) => v / normalLength),
        ...(hit.ownerId != null ? { ownerId: hit.ownerId } : {}),
        ...(hit.materialId ? { materialId: hit.materialId } : {}),
        ...(hit.surface ? { surface: hit.surface } : {}),
        ...(hit.rainAudio ? { rainAudio: hit.rainAudio } : {}) }
    }
  }
  if (ground) {
    const y = ground(to[0], to[2])
    if (Number.isFinite(y) && from[1] >= y && to[1] <= y) {
      const t = (from[1] - y) / dy
      if (t < fraction) result = { point: [from[0] + dx * t, y, from[2] + dz * t], normal: [0, 1, 0] }
    }
  }
  return result
}
