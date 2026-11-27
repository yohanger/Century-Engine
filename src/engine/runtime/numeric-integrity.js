export const finiteTuple = (value, size) => Array.isArray(value) && value.length === size && Array.from(value).every(Number.isFinite)
export const finiteFloat32 = value => Number.isFinite(value) && Number.isFinite(Math.fround(value))
export const finiteVector = v => !!v && [v.x, v.y, v.z].every(Number.isFinite)
export const finiteQuaternion = q => !!q && finiteVector(q) && Number.isFinite(q.w) && Math.hypot(q.x, q.y, q.z, q.w) > 0 && Number.isFinite(Math.hypot(q.x, q.y, q.z, q.w))
export const usableRect = r => !!r && [r.left, r.top, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0
function finiteMeshUV(uv) {
  if (uv == null) return true
  if (!Array.isArray(uv)) return false
  for (const face of uv) {
    if (!Array.isArray(face)) return false
    for (const p of face) if (!finiteTuple(p, 2) || !p.every(finiteFloat32)) return false
  }
  return true
}
export const finiteMesh = mesh => !!mesh && Array.isArray(mesh.v) && mesh.v.every(p => finiteTuple(p, 3) && p.every(finiteFloat32)) && finiteMeshUV(mesh.uv)
/** La representación persistente de PolyMesh contiene una secuencia plana XYZ. */
export function finiteMeshRecord(mesh) {
  if (!mesh || !Array.isArray(mesh.v) || mesh.v.length % 3 !== 0) return false
  for (const coordinate of mesh.v) if (!finiteFloat32(coordinate)) return false
  return finiteMeshUV(mesh.uv)
}
/** JSON convierte NaN e Infinity a null. Rechazar la escritura antes de perder el dato y su ruta. */
export function strictJson(value, context = 'Datos', space) {
  const paths = new WeakMap()
  return JSON.stringify(value, function (key, current) {
    const path = paths.has(this) ? `${paths.get(this)}.${key}` : context
    if (typeof current === 'number' && !Number.isFinite(current)) throw new TypeError(`${path}: número no finito (${current})`)
    if (current && typeof current === 'object') paths.set(current, path)
    return current
  }, space)
}
