// De PolyMesh a buffers de triángulos (editor y exportación). Sin dependencias del DOM.
import { triangulate, norm } from './polymesh.js'
import { polyFaceMetrics } from './blockout-metrics.js'

/**
 * @param m      PolyMesh
 * @param opts   { scale:[x,y,z] aplica el tamaño al exportar, smooth: normales suaves }
 * @returns { positions:Float32Array, normals:Float32Array, indices:Uint32Array, faceOf:Int32Array(por triángulo) }
 */
export function polyBuffers(m, { scale = [1, 1, 1], smooth = m.smooth, includeHidden = true, blockout = false } = {}) {
  const { tris, faceOf } = triangulate(m)
  const keep = []
  tris.forEach((t, i) => { if (includeHidden || !m.faceHidden(faceOf[i])) keep.push(i) })
  const corners = m.uv.length === m.f.length ? m.uv : null
  const uvOf = (fi, v) => {
    const ci = m.f[fi].indexOf(v)
    if (corners && corners[fi]?.[ci]) return corners[fi][ci]
    const p = m.v[v], n = m.faceNormal(fi).map(Math.abs)
    return n[0] >= n[1] && n[0] >= n[2] ? [p[2], p[1]] : n[1] >= n[2] ? [p[0], p[2]] : [p[0], p[1]]
  }
  const S = scale
  const sp = (p) => [p[0] * S[0], p[1] * S[1], p[2] * S[2]]
  if (smooth && !blockout) {
    const used = new Map(), pos = [], idx = [], uv = [], colors = [], weights0 = [], weights1 = []
    const vn = m.vertexNormals()
    const nor = []
    const map = (v, fi) => {
      const u = uvOf(fi, v), key = `${v}:${u[0]}:${u[1]}`
      if (!used.has(key)) {
        used.set(key, pos.length / 3); pos.push(...sp(m.v[v])); nor.push(...vn[v]); uv.push(...u)
        if (m.colors.length) colors.push(...(m.colors[v] || [1, 1, 1]))
        if (m.weights.length) {
          const w = m.weights[v] || [1, 0, 0, 0, 0, 0, 0, 0]
          weights0.push(...w.slice(0, 4)); weights1.push(...w.slice(4, 8))
        }
      }
      return used.get(key)
    }
    for (const i of keep) for (const v of tris[i]) idx.push(map(v, faceOf[i]))
    return { positions: new Float32Array(pos), normals: new Float32Array(nor), uvs: new Float32Array(uv), colors: m.colors.length ? new Float32Array(colors) : null, weights0: m.weights.length ? new Float32Array(weights0) : null, weights1: m.weights.length ? new Float32Array(weights1) : null, indices: new Uint32Array(idx), faceOf: Int32Array.from(keep.map((i) => faceOf[i])) }
  }
  const metric = blockout ? polyFaceMetrics(m, scale) : null
  const blockUV = metric ? new Float32Array(keep.length * 6) : null
  const blockSize = metric ? new Float32Array(keep.length * 6) : null
  const pos = new Float32Array(keep.length * 9), nor = new Float32Array(keep.length * 9), uv = new Float32Array(keep.length * 6), colors = m.colors.length ? new Float32Array(keep.length * 9) : null, weights0 = m.weights.length ? new Float32Array(keep.length * 12) : null, weights1 = m.weights.length ? new Float32Array(keep.length * 12) : null, idx = new Uint32Array(keep.length * 3)
  keep.forEach((ti, k) => {
    const t = tris[ti]
    const n = norm(m.faceNormalRaw(faceOf[ti]))
    for (let j = 0; j < 3; j++) {
      const p = sp(m.v[t[j]])
      pos.set(p, k * 9 + j * 3); nor.set(n, k * 9 + j * 3)
      uv.set(uvOf(faceOf[ti], t[j]), k * 6 + j * 2)
      if (metric) {
        const faceIndex = faceOf[ti], c = m.f[faceIndex].indexOf(t[j]), measure = metric[faceIndex]
        if (measure) { blockUV.set(measure.uv[c], k * 6 + j * 2); blockSize.set(measure.size, k * 6 + j * 2) }
      }
      if (colors) colors.set(m.colors[t[j]] || [1, 1, 1], k * 9 + j * 3)
      if (weights0) {
        const w = m.weights[t[j]] || [1, 0, 0, 0, 0, 0, 0, 0]
        weights0.set(w.slice(0, 4), k * 12 + j * 4)
        weights1.set(w.slice(4, 8), k * 12 + j * 4)
      }
      idx[k * 3 + j] = k * 3 + j
    }
  })
  return { positions: pos, normals: nor, uvs: uv, blockUV, blockSize, colors, weights0, weights1, indices: idx, faceOf: Int32Array.from(keep.map((i) => faceOf[i])) }
}

/** Puntos de triángulo para ConcavePolygonShape3D (3 vértices por triángulo) con la escala aplicada. */
export function trimeshPoints(m, scale = [1, 1, 1]) {
  const { tris } = triangulate(m)
  const out = []
  for (const t of tris) for (const v of t) out.push(m.v[v][0] * scale[0], m.v[v][1] * scale[1], m.v[v][2] * scale[2])
  return out
}
/** Nube de puntos únicos para ConvexPolygonShape3D. */
export function convexPoints(m, scale = [1, 1, 1]) {
  const used = new Set(); for (const f of m.f) for (const v of f) used.add(v)
  const out = []
  for (const v of used) out.push(m.v[v][0] * scale[0], m.v[v][1] * scale[1], m.v[v][2] * scale[2])
  return out
}
