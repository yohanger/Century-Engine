// Bisel de contorno sobre caras aisladas: admite aristas consecutivas y comparte
// el mismo vértice de unión entre sus tiras. Nunca modifica la malla al fallar.
import { add, sub, mul, len, norm, cross, dot, ekey, validatePolygon } from '../../engine/runtime/mesh/polymesh.js'

const EPS = 1e-8

/** Redondea aristas consecutivas de una cara abierta sin crear juntas en T. */
export function bevelBoundaryEdges(mesh, keys, width, segments = 1, profile = 0.5, clampOverlap = true) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isInteger(segments) || segments < 1 || segments > 32 ||
      !Number.isFinite(profile) || profile < 0.1 || profile > 1) return null
  const edges = mesh.edges(), selected = new Set(keys)
  if (!selected.size) return null
  const faceGroups = new Map(), useCount = mesh.v.map(() => 0)
  mesh.f.forEach((face) => face.forEach((v) => useCount[v]++))
  for (const key of selected) {
    const edge = edges.get(key)
    if (!edge || edge.faces.length !== 1 || edge.wire) return null
    const fi = edge.faces[0], face = mesh.f[fi]
    if (face.length < 3 || mesh.faceHidden(fi) || useCount[edge.a] !== 1 || useCount[edge.b] !== 1) return null
    if (!faceGroups.has(fi)) faceGroups.set(fi, new Set())
    faceGroups.get(fi).add(key)
  }
  const work = mesh.clone(), made = [], innerEdges = [], newVerts = []
  const create = (pos) => { const id = work.v.push(pos) - 1; newVerts.push(id); return id }
  for (const [fi, keysInFace] of faceGroups) {
    const face = mesh.f[fi], n = face.length, normal = mesh.faceNormal(fi)
    if (len(normal) < 0.99) return null
    const chosen = face.map((v, i) => keysInFace.has(ekey(v, face[(i + 1) % n])))
    if (chosen.filter(Boolean).length !== keysInFace.size) return null
    const inner = new Array(n), layers = Array.from({ length: segments + 1 }, () => new Array(n))
    const rise = width * profile * 0.5
    for (let i = 0; i < n; i++) {
      const prev = (i + n - 1) % n, next = (i + 1) % n
      const hasPrev = chosen[prev], hasNext = chosen[i]
      if (!hasPrev && !hasNext) { inner[i] = face[i]; continue }
      const v = face[i], p = mesh.v[v], towardsPrev = sub(mesh.v[face[prev]], p), towardsNext = sub(mesh.v[face[next]], p)
      const lp = len(towardsPrev), ln = len(towardsNext)
      if (lp < EPS || ln < EPS) return null
      const dn = norm(towardsNext), dp = norm(towardsPrev)
      // Para un rincón convexo, el miter llega a la intersección interior de ambas bandas.
      const sin = len(cross(dp, dn)), cos = dot(dp, dn)
      if (sin < 1e-5 || cos > 0.99999) return null
      let offset
      if (hasPrev && hasNext) {
        const bis = add(dp, dn)
        if (len(bis) < EPS) return null
        offset = mul(norm(bis), width / Math.max(EPS, Math.sqrt((1 + cos) * 0.5)))
      } else if (hasPrev) offset = mul(dn, width / sin)
      else offset = mul(dp, width / sin)
      if (!offset.every(Number.isFinite) || len(offset) > (clampOverlap ? 0.45 : 0.95) * Math.min(lp, ln) / Math.max(0.1, sin)) return null
      const target = add(p, offset)
      // El mismo vértice de cada nivel se comparte entre las dos aristas seleccionadas.
      layers[0][i] = v
      for (let j = 1; j <= segments; j++) {
        const t = j / segments
        const bulge = rise * (1 - t) * (1 - t)
        const pos = add(add(mul(p, 1 - t), mul(target, t)), mul(normal, bulge))
        layers[j][i] = create(pos)
      }
      inner[i] = layers[segments][i]
      // El perfil modifica la elevación sin desplazar la esquina fuera de la cara.
      work.v[v] = add(p, mul(normal, rise))
    }
    const remaining = inner.filter((v, i) => i === 0 || v !== inner[i - 1])
    if (remaining.length < 3 || new Set(remaining).size !== remaining.length) return null
    work.f[fi] = inner
    if (validatePolygon(work, inner)) return null
    for (let i = 0; i < n; i++) if (chosen[i]) {
      const next = (i + 1) % n
      for (let j = 0; j < segments; j++) {
        work.f.push([layers[j][i], layers[j][next], layers[j + 1][next], layers[j + 1][i]])
        made.push(work.f.length - 1)
      }
      innerEdges.push(ekey(inner[i], inner[next]))
    }
  }
  if (work.f.some((face, fi) => face.length < 3 || new Set(face).size !== face.length ||
      face.some((v) => !Number.isInteger(v) || v < 0 || v >= work.v.length) || len(work.faceNormal(fi)) < EPS)) return null
  Object.assign(mesh, work)
  return { faces: made, edges: innerEdges, verts: newVerts }
}
