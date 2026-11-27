// Lector Wavefront OBJ → malla triangulada, sin dependencias del DOM.

/** @returns {{ positions: Float32Array, normals: Float32Array, indices: Uint32Array, faces: number }} */
export function parseOBJ(input) {
  const text = typeof input === 'string' ? input : new TextDecoder().decode(input instanceof Uint8Array ? input : new Uint8Array(input))
  const V = [], N = [], UV = []
  const pos = [], nor = [], uv = [], idx = []
  const materials = [], groups = [], libraries = []
  let material = "", hasUV = false
  const cache = new Map()
  let faces = 0

  const res = (i, len) => { const n = parseInt(i, 10); return n < 0 ? len + n : n - 1 }
  const corner = (tok, cacheable = true) => {
    const [a, b, c] = tok.split('/')
    const vi = res(a, V.length)
    const ni = c ? res(c, N.length) : -1
    const ti = b ? res(b, UV.length) : -1
    if (!V[vi]) throw new Error("Índice de vértice OBJ inválido")
    const key = `${vi}/${ti}/${ni}`
    let id = cacheable ? cache.get(key) : undefined
    if (id === undefined) {
      id = pos.length / 3
      pos.push(...V[vi])
      nor.push(...(ni >= 0 && N[ni] ? N[ni] : [0, 0, 0]))
      uv.push(...(UV[ti] || [0, 0]))
      hasUV ||= !!UV[ti]
      if (cacheable) cache.set(key, id)
    }
    return id
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim()
    if (!line || line[0] === '#') continue
    const p = line.split(/\s+/)
    if (p[0] === 'v') V.push([+p[1], +p[2], +p[3]])
    else if (p[0] === 'vn') N.push([+p[1], +p[2], +p[3]])
    else if (p[0] === 'vt') UV.push([+p[1], +(p[2] ?? 0)])
    else if (p[0] === 'mtllib') libraries.push(...p.slice(1))
    else if (p[0] === 'usemtl') material = p.slice(1).join(' ')
    else if (p[0] === 'f' && p.length >= 4) {
      const hasN = p.slice(1).every((t) => t.split('/')[2])
      const ids = p.slice(1).map(t => corner(t, hasN))
      let materialIndex = materials.indexOf(material)
      if (materialIndex < 0) { materialIndex = materials.length; materials.push(material) }
      const start = idx.length
      for (let k = 1; k < ids.length - 1; k++) idx.push(ids[0], ids[k], ids[k + 1])
      const last = groups.at(-1)
      if (last?.materialIndex === materialIndex) last.count += idx.length - start
      else groups.push({ start, count: idx.length - start, materialIndex })
      faces++
    }
  }
  if (!idx.length) throw new Error('El OBJ no contiene caras')

  const positions = new Float32Array(pos), normals = new Float32Array(nor), indices = new Uint32Array(idx)
  // normales de cara donde falten (suma ponderada por triángulo)
  const need = new Uint8Array(positions.length / 3)
  for (let i = 0; i < normals.length; i += 3) if (!normals[i] && !normals[i + 1] && !normals[i + 2]) need[i / 3] = 1
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2]
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    for (const i of [a, b, c]) if (need[i / 3]) { normals[i] += nx; normals[i + 1] += ny; normals[i + 2] += nz }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1
    normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l
  }
  return { positions, normals, indices, faces, uvs: hasUV ? new Float32Array(uv) : null, materials, groups, libraries }
}

export function boundsOf(positions) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], positions[i + k]); mx[k] = Math.max(mx[k], positions[i + k]) }
  return { min: mn, max: mx, size: mx.map((v, i) => v - mn[i]), center: mx.map((v, i) => (v + mn[i]) / 2) }
}
