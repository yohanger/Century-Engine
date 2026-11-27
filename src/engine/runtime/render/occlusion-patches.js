import { Matrix4, Vector3 } from 'three'

const point = (attribute, index) => new Vector3().fromBufferAttribute(attribute, index)
const quant = (v) => `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.z * 1e5)}`
const nonzero = (u, v) => u.clone().cross(v).lengthSq() > 1e-12

function patch(center, u, v) {
  if (!nonzero(u, v)) return null
  const normal = u.clone().cross(v).normalize().multiplyScalar(0.01)
  return new Matrix4().makeBasis(u, v, normal).setPosition(center).toArray()
}

/** Cada superficie ocupa únicamente una región cubierta por triángulos reales. */
export function meshOcclusionPatches(mesh) {
  const geometry = mesh.geometry
  const attr = geometry?.attributes?.position
  if (!attr || attr.itemSize !== 3) return []
  const index = geometry.index, triangleCount = Math.floor((index?.count ?? attr.count) / 3)
  if ((geometry.drawRange.start || 0) % 3 !== 0) return []
  const start = Math.max(0, Math.floor((geometry.drawRange.start || 0) / 3))
  const count = Number.isFinite(geometry.drawRange.count) ? Math.floor(geometry.drawRange.count / 3) : triangleCount
  const end = Math.min(triangleCount, start + Math.max(0, count))
  const triangles = [], edges = new Map()
  mesh.updateWorldMatrix(true, false)
  for (let i = start; i < end; i++) {
    const a = point(attr, index ? index.getX(i * 3) : i * 3).applyMatrix4(mesh.matrixWorld)
    const b = point(attr, index ? index.getX(i * 3 + 1) : i * 3 + 1).applyMatrix4(mesh.matrixWorld)
    const c = point(attr, index ? index.getX(i * 3 + 2) : i * 3 + 2).applyMatrix4(mesh.matrixWorld)
    if (![a,b,c].every(v => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) || !nonzero(b.clone().sub(a), c.clone().sub(a))) continue
    const t = { verts: [a,b,c], used: false }
    const id = triangles.length
    triangles.push(t)
    for (let j = 0; j < 3; j++) {
      const p = t.verts[j], q = t.verts[(j + 1) % 3]
      const names = [quant(p),quant(q)].sort()
      const key = `${names[0]}|${names[1]}`
      if (!edges.has(key)) edges.set(key, [])
      edges.get(key).push({ id, a: p, b: q, third: t.verts[(j + 2) % 3] })
    }
  }
  const patches = []
  for (const twins of edges.values()) {
    if (twins.length !== 2) continue
    const [t, other] = twins
    if (triangles[t.id].used || triangles[other.id].used) continue
    const oppositeA = t.third, oppositeB = other.third
    const center = oppositeA.clone().add(oppositeB).add(t.a).add(t.b).multiplyScalar(0.25)
    if (oppositeA.clone().add(oppositeB).distanceToSquared(t.a.clone().add(t.b)) >
        1e-8 * Math.max(1, oppositeA.distanceToSquared(oppositeB))) continue
    // El paralelogramo completo existe porque ambos triángulos comparten su diagonal.
    const u = t.a.clone().sub(oppositeA)
    const v = t.b.clone().sub(oppositeA)
    const matrix = patch(center, u, v)
    if (!matrix) continue
    patches.push(matrix)
    triangles[t.id].used = triangles[other.id].used = true
  }
  for (const t of triangles) {
    if (t.used) continue
    const [a,b,c] = t.verts
    const center = a.clone().add(b).add(c).multiplyScalar(1/3)
    // Las cuatro esquinas quedan estrictamente dentro del triángulo (margen 3.3%).
    const matrix = patch(center, b.clone().sub(a).multiplyScalar(0.30), c.clone().sub(a).multiplyScalar(0.30))
    if (matrix) patches.push(matrix)
  }
  return patches
}

/** Huella de geometría; permite invalidar incluso mutaciones de buffers en el mismo objeto. */
export function meshOcclusionSignature(mesh) {
  const geometry = mesh?.geometry
  const pos = geometry?.attributes?.position, index = geometry?.index
  if (!pos) return ''
  let hash = 2166136261
  const mix = n => { hash ^= n >>> 0; hash = Math.imul(hash, 16777619) >>> 0 }
  const scratch = new DataView(new ArrayBuffer(8))
  const f64 = n => { scratch.setFloat64(0,n,true);mix(scratch.getUint32(0,true));mix(scratch.getUint32(4,true)) }
  mix(pos.count); mix(index?.count ?? 0); f64(geometry.drawRange.start); f64(geometry.drawRange.count)
  if (pos.itemSize === 3 && pos.array instanceof Float32Array && !pos.isInterleavedBufferAttribute) {
    const raw = new Uint32Array(pos.array.buffer, pos.array.byteOffset, pos.array.length)
    for (const value of raw) mix(value)
  } else {
    for (let i=0;i<pos.count;i++) { f64(pos.getX(i)); f64(pos.getY(i)); f64(pos.getZ(i)) }
  }
  if (index) for (let i=0;i<index.count;i++) mix(index.getX(i))
  for (const group of geometry.groups || []) { mix(group.start); mix(group.count); mix(group.materialIndex) }
  return hash.toString(16)
}
