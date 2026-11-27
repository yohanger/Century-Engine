// Zonas espaciales del indicador. No son colliders de Jolt ni disparan comandos.
const vec = (a, fallback) => Array.isArray(a) && a.length === 3
  ? a.map((v, i) => Number.isFinite(+v) ? +v : fallback[i]) : [...fallback]
export function defaultIndicatorZones(reach = 2.2) {
  const d = Math.max(0.5, Number(reach) || 2.2)
  return {
    ring: { shape: 'sphere', radius: d + 1.5, size: [2 * (d + 1.5), 2 * (d + 1.5), 2 * (d + 1.5)], offset: [0, 0, 0], rotation: [0, 0, 0] },
    key: { shape: 'sphere', radius: d, size: [2 * d, 2 * d, 2 * d], offset: [0, 0, 0], rotation: [0, 0, 0] },
    visual: { automatic: true, offset: [0, 0, 0], keyOffset: [0, 0, 0], scale: 1 },
  }
}
export function normalizeIndicatorZones(raw, reach = 2.2) {
  const def = defaultIndicatorZones(reach), data = raw && typeof raw === 'object' ? raw : {}
  const zone = (name) => {
    const v = data[name] || {}, d = def[name]
    return { shape: v.shape === 'box' ? 'box' : 'sphere',
      radius: Math.max(0.05, Number.isFinite(+v.radius) ? +v.radius : d.radius),
      size: vec(v.size, d.size).map((n) => Math.max(0.05, Math.abs(n))),
      offset: vec(v.offset, d.offset), rotation: vec(v.rotation, d.rotation) }
  }
  const v = data.visual || {}
  return { ring: zone('ring'), key: zone('key'), visual: {
    automatic: v.automatic !== false, offset: vec(v.offset, [0, 0, 0]),
    keyOffset: vec(v.keyOffset, [0, 0, 0]),
    scale: Math.max(0.4, Math.min(3, Number.isFinite(+v.scale) ? +v.scale : 1)) } }
}
/** Local X/Y/Z: primero desplazamos el centro y después aplicamos la rotación inversa de la zona. */
export function insideIndicatorZone(local, spec, tolerance = 0) {
  if (!spec) return false
  let [x, y, z] = [local.x - spec.offset[0], local.y - spec.offset[1], local.z - spec.offset[2]]
  if (spec.shape !== 'box') return x * x + y * y + z * z <= (spec.radius + tolerance) ** 2
  const rad = Math.PI / 180, [rx, ry, rz] = spec.rotation.map((n) => n * rad)
  // Mismo convenio de rotación YXZ que los nodos del editor.
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz)
  let t = x * cy - z * sy; z = x * sy + z * cy; x = t
  t = y * cx + z * sx; z = -y * sx + z * cx; y = t
  t = x * cz + y * sz; y = -x * sz + y * cz; x = t
  return Math.abs(x) <= spec.size[0] / 2 + tolerance &&
    Math.abs(y) <= spec.size[1] / 2 + tolerance &&
    Math.abs(z) <= spec.size[2] / 2 + tolerance
}
