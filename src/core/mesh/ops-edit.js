// Operaciones de malla · extruir, biselar, inset, borrar y disolver. Ver ops.js.
import {
  PolyMesh, ekey, ekeyA, ekeyB, sub, add, mul, dot, cross, norm, len, lerp3, dist, triangulateFace, signedVolume, validatePolygon,
} from '../../engine/runtime/mesh/polymesh.js'
import { normalize, vertFaces } from './sel.js'
import { bevel } from './bevel.js'
import { bevelVertices } from './bevel-vertex.js'
import { bevelBoundaryEdges } from './bevel-boundary.js'

import { cleanup, setFromMode, faceVerts } from './ops-util.js'

// ---------- extruir / inset ----------
/**
 * Núcleo de extrusión de regiones: duplica los vértices de borde, crea las caras laterales y deja las caras
 * seleccionadas sobre los vértices nuevos. Los vértices interiores no se duplican.
 * Devuelve la lista de entradas {n, p0, dir, nrm} (vértice nuevo, posición original, dirección hacia dentro, normal).
 */
function extrudeRegion(m, faces, individual, capBase = false) {
  const groups = individual ? faces.map((f) => [f]) : [faces]
  const items = []
  const vfAll = vertFaces(m)
  const E = m.edges()
  const wireV = new Set(); for (const [a, b] of m.we) { wireV.add(a); wireV.add(b) }
  const orig = m.f.map((f) => [...f])
  const side = []
  for (const g of groups) {
    const inG = new Set(g)
    // aristas de borde del grupo: dirigidas a→b en una cara del grupo con una sola cara del grupo en esa arista
    const cnt = new Map()
    for (const fi of g) { const f = orig[fi]; for (let i = 0; i < f.length; i++) { const k = ekey(f[i], f[(i + 1) % f.length]); cnt.set(k, (cnt.get(k) || 0) + 1) } }
    const bnd = [] // {a,b,fi}
    for (const fi of g) { const f = orig[fi]; for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; if (cnt.get(ekey(a, b)) === 1) bnd.push({ a, b, fi }) } }
    const bverts = new Set(); for (const e of bnd) { bverts.add(e.a); bverts.add(e.b) }
    // direcciones hacia dentro (miter) y normales por vértice de borde
    const inward = new Map(), nrmSum = new Map()
    for (const fi of g) {
      const N = m.faceNormal(fi)
      for (const v of orig[fi]) nrmSum.set(v, add(nrmSum.get(v) || [0, 0, 0], N))
    }
    const dirs = new Map()
    for (const { a, b, fi } of bnd) {
      const N = m.faceNormal(fi)
      const d = norm(cross(N, sub(m.v[b], m.v[a])))
      for (const v of [a, b]) { if (!dirs.has(v)) dirs.set(v, []); dirs.get(v).push(d) }
    }
    for (const [v, ds] of dirs) {
      let dir
      if (ds.length === 2) { const c = dot(ds[0], ds[1]); dir = mul(add(ds[0], ds[1]), 1 / Math.max(0.15, 1 + c)) }
      else { let s = [0, 0, 0]; for (const d of ds) s = add(s, d); dir = mul(s, 1 / ds.length) }
      inward.set(v, dir)
    }
    const map = new Map()
    const vOf = (v) => {
      if (map.has(v)) return map.get(v)
      const interior = !bverts.has(v) && vfAll[v].every((fi) => inG.has(fi)) && !wireV.has(v)
      let n = v
      if (!interior) n = m.v.push([...m.v[v]]) - 1
      map.set(v, n)
      items.push({ n, p0: [...m.v[v]], dir: inward.get(v) || [0, 0, 0], nrm: norm(nrmSum.get(v) || [0, 0, 1]) })
      return n
    }
    for (const fi of g) for (const v of orig[fi]) vOf(v)
    for (const { a, b } of bnd) side.push([a, b, vOf(b), vOf(a)])
    for (const fi of g) m.f[fi] = orig[fi].map((v) => map.get(v))
    if (capBase) for (const fi of g) m.f.push([...orig[fi]].reverse())
  }
  void E
  for (const q of side) m.f.push(q)
  return items
}

/** Extruye un parche superficial aislado conservando su tapa inferior. */
export function extrudeSolid(m, sel, mode) {
  if (mode !== 'face' || !sel.f.size) return 'Extruir sólido requiere una o más caras seleccionadas'
  const faces = [...sel.f]
  const E = m.edges()
  const counts = new Map(), neighbours = new Map()
  for (const fi of faces) {
    const f = m.f[fi]
    if (!f || m.faceHidden(fi) || validatePolygon(m, f)) return 'Hay caras ocultas o inválidas en la selección'
    for (let i = 0; i < f.length; i++) {
      const k = ekey(f[i], f[(i + 1) % f.length])
      counts.set(k, (counts.get(k) || 0) + 1)
    }
  }
  const picked = new Set(faces), border = new Map()
  for (const [k, count] of counts) {
    if (count > 2) return 'La selección contiene aristas no manifold'
    const all = E.get(k)?.faces || []
    if (all.some((fi) => !picked.has(fi))) return 'Extruir sólido necesita una superficie aislada, sin caras vecinas externas'
    if (count === 1) {
      const a = ekeyA(k), b = ekeyB(k)
      for (const v of [a, b]) border.set(v, (border.get(v) || 0) + 1)
    }
  }
  if (!border.size || [...border.values()].some((n) => n !== 2)) return 'La selección debe tener un borde cerrado y sin ramificaciones'
  const ref = m.faceNormal(faces[0]), origin = m.v[m.f[faces[0]][0]]
  if (len(ref) < 1e-8 || faces.some((fi) => dot(ref, m.faceNormal(fi)) < 0.999 || m.f[fi].some((v) => Math.abs(dot(sub(m.v[v], origin), ref)) > 1e-5))) return 'Las caras deben ser coplanares y orientadas en el mismo sentido'
  // Verificar que el parche sea conexo y tenga un único borde: sin islas ni agujeros.
  const seen = new Set([faces[0]]), queue = [faces[0]]
  while (queue.length) {
    const fi = queue.pop(), f = m.f[fi]
    for (let i = 0; i < f.length; i++) for (const n of E.get(ekey(f[i], f[(i + 1) % f.length])).faces) if (picked.has(n) && !seen.has(n)) { seen.add(n); queue.push(n) }
  }
  if (seen.size !== faces.length || border.size !== [...counts].filter(([, n]) => n === 1).length) return 'El parche tiene islas o contornos múltiples'
  extrudeRegion(m, faces, false, true)
  setFromMode(m, sel, 'face', { f: faces })
}

export function extrude(m, sel, mode) {
  let faces = [...sel.f]
  const edgesCovered = () => { const ks = new Set(); for (const fi of faces) { const f = m.f[fi]; for (let i = 0; i < f.length; i++) ks.add(ekey(f[i], f[(i + 1) % f.length])) } return [...sel.e].every((k) => ks.has(k)) }
  if (mode === 'face' || (faces.length && edgesCovered() && mode !== 'edge') || (mode === 'edge' && faces.length && edgesCovered())) {
    if (!faces.length) return 'Selecciona al menos una cara'
    extrudeRegion(m, faces, false)
    sel.f = new Set(faces); setFromMode(m, sel, 'face', { f: faces }); return
  }
  if (mode === 'edge' || sel.e.size) {
    if (!sel.e.size) return 'Selecciona al menos una arista'
    const E = m.edges(), map = new Map(), newE = []
    const dup = (v) => { if (!map.has(v)) map.set(v, m.v.push([...m.v[v]]) - 1); return map.get(v) }
    const wireKill = new Set()
    for (const k of sel.e) {
      const e = E.get(k); let a = e.a, b = e.b
      if (e.faces.length === 1) {
        const f = m.f[e.faces[0]]
        const i = f.indexOf(a)
        const [x, y] = f[(i + 1) % f.length] === b ? [a, b] : [b, a] // la cara recorre x→y; el lateral debe recorrer y→x
        const nx = dup(x), ny = dup(y)
        m.f.push([y, x, nx, ny])
        newE.push(ekey(nx, ny))
      } else {
        const na = dup(a), nb = dup(b)
        if (e.wire) wireKill.add(k)
        m.f.push([a, b, nb, na]); newE.push(ekey(na, nb))
      }
    }
    if (wireKill.size) m.we = m.we.filter(([a, b]) => !wireKill.has(ekey(a, b)))
    setFromMode(m, sel, 'edge', { e: newE }); return
  }
  if (!sel.v.size) return 'No hay nada seleccionado'
  const nv = []
  for (const v of sel.v) { const n = m.v.push([...m.v[v]]) - 1; m.we.push([v, n]); nv.push(n) }
  setFromMode(m, sel, 'vertex', { v: nv })
}

/** Extruye cada cara por separado utilizando su propia normal, sin promediar regiones. */
export function extrudeIndividual(m, sel, mode, p = {}) {
  if (mode !== 'face' || !sel.f.size) return 'Extrude Individual requiere caras seleccionadas'
  const distance = Number(p.distance ?? 0)
  if (!Number.isFinite(distance) || Math.abs(distance) > 100000) return 'Distancia de extrusión inválida'
  const faces = [...sel.f]
  if (faces.some((fi) => !m.f[fi] || m.faceHidden(fi))) return 'Hay caras ocultas o inválidas'
  const items = extrudeRegion(m, faces, true)
  for (const it of items) m.v[it.n] = add(it.p0, mul(it.nrm, distance))
  setFromMode(m, sel, 'face', { f: faces })
}

/** Vértices que se mueven en la extrusión (para el arrastre automático por la normal). */
export function extrudeNormal(m, sel) {
  let N = [0, 0, 0]
  for (const fi of sel.f) N = add(N, m.faceNormalRaw(fi))
  return norm(N)
}

export function inset(m, sel, mode, p = {}) {
  const { thickness = 0.1, depth = 0, individual = false } = p
  const faces = [...sel.f]
  if (!faces.length) return 'Inset trabaja sobre caras'
  const items = extrudeRegion(m, faces, individual)
  for (const it of items) m.v[it.n] = add(add(it.p0, mul(it.dir, thickness)), mul(it.nrm, depth))
  setFromMode(m, sel, 'face', { f: faces })
}

/** Ancho uniforme seguro para Clamp Overlap; no modifica la malla. */
export function bevelClampedWidth(m, keys, width) {
  const meshEdges = m.edges(), minIncidentLength = new Map()
  for (const [, edge] of meshEdges) {
    if (!edge.faces.length) continue
    const size = len(sub(m.v[edge.a], m.v[edge.b]))
    for (const v of [edge.a, edge.b]) minIncidentLength.set(v, Math.min(minIncidentLength.get(v) ?? Infinity, size))
  }
  let maxWidth = Infinity
  for (const key of keys) {
    const edge = meshEdges.get(key)
    if (!edge) return 0
    maxWidth = Math.min(maxWidth, (minIncidentLength.get(edge.a) ?? 0) * 0.45,
      (minIncidentLength.get(edge.b) ?? 0) * 0.45)
  }
  return maxWidth > 1e-6 ? Math.min(width, maxWidth) : 0
}

export function bevelOp(m, sel, mode, p = {}) {
  let keys = [...sel.e]
  if (mode === 'face') { const s = new Set(); for (const fi of sel.f) { const f = m.f[fi]; for (let i = 0; i < f.length; i++) s.add(ekey(f[i], f[(i + 1) % f.length])) } keys = [...s] }
  if (!keys.length) return 'Selecciona aristas para biselar'
  const width = p.width ?? 0.1, segments = p.segments ?? 1, profile = p.profile ?? 0.5
  if (!Number.isFinite(width) || width <= 0 || !Number.isInteger(segments) || segments < 1 || segments > 32 ||
      !Number.isFinite(profile) || profile < 0.1 || profile > 1) return 'Ancho, segmentos o perfil inválidos para Bisel'
  const selectedEdges = keys.map((k) => m.edges().get(k))
  if (selectedEdges.some((e) => !e || e.faces.length > 2 || e.faces.length === 0)) return 'La selección contiene aristas no válidas para Bisel'
  // No mezclar aristas exteriores e interiores en una misma operación: evita geometría parcial.
  const boundary = selectedEdges.every((e) => e.faces.length === 1)
  if (!boundary && selectedEdges.some((e) => e.faces.length !== 2)) return 'Bisela aristas interiores o de contorno por separado'
  // El modo Clamp limita el ancho antes de generar la topología; desactivarlo no autoriza geometría corrupta.
  const effectiveWidth = p.clampOverlap === false ? width : bevelClampedWidth(m, keys, width)
  if (!(effectiveWidth > 1e-6)) return 'No hay espacio para biselar las aristas seleccionadas'
  const work = m.clone()
  let r
  try {
    r = boundary ? bevelBoundaryEdges(work, keys, effectiveWidth, segments, profile, p.clampOverlap !== false)
      : bevel(work, keys, effectiveWidth, segments, profile, p.clampOverlap !== false)
  } catch { return 'El bisel no puede generar topología válida en esta selección' }
  if (!r || work.f.some((face) => face.length < 3 || new Set(face).size !== face.length ||
      face.some((v) => !Number.isInteger(v) || v < 0 || v >= work.v.length)) ||
      work.v.some((v) => v.some((x) => !Number.isFinite(x)))) return boundary
      ? 'El bisel de contorno no es válido para esta geometría o ancho'
      : 'No es posible biselar estas aristas sin dañar la topología'
  // Aplicación atómica: la vista previa parte siempre de la copia original.
  Object.assign(m, work)
  setFromMode(m, sel, mode === 'vertex' ? 'face' : mode, { f: r.faces, e: r.edges })
}

/** Bisel específico de vértices: respeta el modo de selección y no altera geometría si falla. */
export function bevelVertexOp(m, sel, mode, p = {}) {
  if (mode !== 'vertex' || !sel.v.size) return 'Selecciona vértices en modo vértice'
  const r = bevelVertices(m, [...sel.v], p.width ?? 0.1, p.segments ?? 1, p.profile ?? 0.5)
  if (!r) return 'No es posible biselar estos vértices (ancho, geometría o topología no manifold)'
  setFromMode(m, sel, 'vertex', { v: r.verts })
}

// ---------- borrar / disolver ----------
export function del(m, sel, mode, what = null) {
  what = what || (mode === 'face' ? 'faces' : mode === 'edge' ? 'edges' : 'verts')
  if (what === 'verts') {
    if (!sel.v.size) return 'No hay vértices seleccionados'
    m.removeVerts(new Set(sel.v))
  } else if (what === 'edges') {
    if (!sel.e.size) return 'No hay aristas seleccionadas'
    const cand = new Set()
    for (const k of sel.e) { cand.add(ekeyA(k)); cand.add(ekeyB(k)) }
    m.f = m.f.map((f) => { for (let i = 0; i < f.length; i++) if (sel.e.has(ekey(f[i], f[(i + 1) % f.length]))) return null; return f })
    m.we = m.we.filter(([a, b]) => !sel.e.has(ekey(a, b)))
    cleanup(m, cand)
  } else if (what === 'faces' || what === 'onlyfaces') {
    if (!sel.f.size) return 'No hay caras seleccionadas'
    const cand = faceVerts(m, sel.f)
    if (what === 'onlyfaces') {
      const E = m.edges(), keep = []
      for (const fi of sel.f) { const f = m.f[fi]; for (let i = 0; i < f.length; i++) { const k = ekey(f[i], f[(i + 1) % f.length]); if (E.get(k).faces.every((g) => sel.f.has(g))) keep.push([f[i], f[(i + 1) % f.length]]) } }
      const seen = new Set()
      for (const [a, b] of keep) { const k = ekey(a, b); if (!seen.has(k)) { seen.add(k); m.we.push([a, b]) } }
    }
    sel.f.forEach((fi) => { m.f[fi] = null })
    cleanup(m, what === 'onlyfaces' ? new Set() : cand)
  }
  sel.clear()
}

function mergeFaceGroup(m, group) {
  const dir = new Map()
  for (const fi of group) { const f = m.f[fi]; for (let i = 0; i < f.length; i++) dir.set(f[i] * 4194304 + f[(i + 1) % f.length], [f[i], f[(i + 1) % f.length]]) }
  const out = new Map()
  for (const [k, [a, b]] of dir) { if (dir.has(b * 4194304 + a)) continue; if (out.has(a)) return null; out.set(a, b) }
  if (!out.size) return null
  const start = out.keys().next().value
  const loop = [start]; let cur = out.get(start), guard = 0
  while (cur !== start && guard++ < 100000) { loop.push(cur); cur = out.get(cur); if (cur == null) return null }
  if (loop.length !== out.size) return null // varios bucles (agujeros): no se disuelve
  return validatePolygon(m, loop) ? null : loop
}
function groupsByEdge(m, faces) {
  const set = new Set(faces), E = m.edges(), seen = new Set(), groups = []
  for (const s of faces) {
    if (seen.has(s)) continue
    const g = [], st = [s]; seen.add(s)
    while (st.length) {
      const fi = st.pop(); g.push(fi); const f = m.f[fi]
      for (let i = 0; i < f.length; i++) for (const o of E.get(ekey(f[i], f[(i + 1) % f.length])).faces) if (set.has(o) && !seen.has(o)) { seen.add(o); st.push(o) }
    }
    groups.push(g)
  }
  return groups
}
function mergeConnectivityReason(m, groups) {
  const faces = groups.map((group) => group.map((fi) => m.f[fi]))
  const tol = Math.max(1, len(sub(m.bounds().max, m.bounds().min))) * 1e-6
  const edges = faces.map((group) => group.flatMap((face) => face.map((a, i) => [a, face[(i + 1) % face.length]])))
  if (edges.reduce((total, group) => total + group.length, 0) > 256) return 'Las caras seleccionadas no están conectadas por aristas. Revisa la continuidad de la región'
  for (let a = 0; a < edges.length; a++) for (let b = a + 1; b < edges.length; b++) {
    for (const [u, v] of edges[a]) for (const [x, y] of edges[b]) {
      if ((dist(m.v[u], m.v[x]) <= tol && dist(m.v[v], m.v[y]) <= tol) ||
          (dist(m.v[u], m.v[y]) <= tol && dist(m.v[v], m.v[x]) <= tol)) {
        return 'Las caras parecen unidas, pero sus aristas usan vértices distintos. Revisa la unión antes de fusionarlas'
      }
    }
  }
  const liesInside = (point, a, b) => {
    const delta = sub(b, a), length2 = dot(delta, delta)
    if (length2 < tol * tol) return false
    const t = dot(sub(point, a), delta) / length2
    return t > tol / Math.sqrt(length2) && t < 1 - tol / Math.sqrt(length2) &&
      dist(point, add(a, mul(delta, t))) <= tol
  }
  for (let a = 0; a < edges.length; a++) for (let b = a + 1; b < edges.length; b++) {
    for (const [u, v] of edges[a]) for (const [x, y] of edges[b]) {
      if ([m.v[x], m.v[y]].some((point) => liesInside(point, m.v[u], m.v[v])) ||
          [m.v[u], m.v[v]].some((point) => liesInside(point, m.v[x], m.v[y]))) {
        return 'Las caras tienen una unión en T: una arista está dividida y la otra no. Revisa los cortes antes de fusionarlas'
      }
    }
  }
  for (let a = 0; a < faces.length; a++) for (let b = a + 1; b < faces.length; b++) {
    const vertices = new Set(faces[a].flat())
    if (faces[b].some((face) => face.some((v) => vertices.has(v)))) {
      return 'Las caras comparten vértices, pero no una arista completa. Revisa los cortes o la subdivisión'
    }
  }
  return 'Las caras seleccionadas no están conectadas por aristas. Selecciona una región contigua'
}

export function dissolveFaces(m, sel, mode, facesArg = null) {
  const faces = facesArg || [...sel.f]
  if (!faces.length) return 'No hay caras seleccionadas'
  const cand = faceVerts(m, faces)
  const made = []
  for (const g of groupsByEdge(m, faces)) {
    if (g.length < 2) { made.push(g[0]); continue }
    const loop = mergeFaceGroup(m, g)
    if (!loop) { made.push(...g); continue }
    m.f[g[0]] = loop; made.push(g[0])
    for (let i = 1; i < g.length; i++) m.f[g[i]] = null
  }
  const c = cleanup(m, cand)
  sel.clear(); sel.f = new Set(c.F(made)); normalize(m, sel, 'face')
}
export function mergeSelectedFaces(m, sel, mode) {
  if (mode !== 'face') return 'Fusionar caras solo está disponible en modo Caras'
  const faces = [...sel.f]
  if (faces.length < 2) return 'Selecciona al menos dos caras contiguas'
  if (faces.some((fi) => !Number.isInteger(fi) || fi < 0 || fi >= m.f.length || m.faceHidden(fi) || validatePolygon(m, m.f[fi]))) {
    return 'La selección contiene caras ocultas o inválidas'
  }
  const groups = groupsByEdge(m, faces)
  if (groups.length !== 1) return mergeConnectivityReason(m, groups)
  const edges = m.edges()
  for (const fi of faces) {
    const face = m.f[fi]
    for (let i = 0; i < face.length; i++) {
      const uses = edges.get(ekey(face[i], face[(i + 1) % face.length]))?.faces
      if (!uses || uses.length > 2) return 'Las caras seleccionadas contienen aristas no manifold'
    }
  }
  const normal = m.faceNormal(faces[0]), origin = m.v[m.f[faces[0]][0]]
  const bounds = m.bounds()
  const tolerance = 1e-6 * Math.max(1, ...bounds.max.map((n, i) => n - bounds.min[i]))
  if (faces.some((fi) => dot(normal, m.faceNormal(fi)) < 0.99999 || m.f[fi].some((vi) => Math.abs(dot(sub(m.v[vi], origin), normal)) > tolerance))) {
    return 'Fusionar caras requiere una región coplanar con la misma orientación'
  }
  if (!mergeFaceGroup(m, faces)) return 'La región no tiene un contorno único válido para fusionar'
  const previousCount = m.f.length
  const result = dissolveFaces(m, sel, mode, faces)
  if (typeof result === 'string') return result
  if (m.f.length !== previousCount - faces.length + 1 || sel.f.size !== 1) return 'No se pudo fusionar la región seleccionada'
}

export function dissolveEdges(m, sel, mode) {
  if (!sel.e.size) return 'No hay aristas seleccionadas'
  const E = m.edges(), cand = new Set()
  const faces = new Set(), wire = new Set()
  for (const k of sel.e) { const e = E.get(k); if (e.faces.length === 2) e.faces.forEach((f) => faces.add(f)); else if (e.wire) wire.add(k) }
  // unir por aristas seleccionadas: se disuelven solo las aristas entre caras del mismo grupo
  const parent = new Map(); const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
  for (const fi of faces) parent.set(fi, fi)
  for (const k of sel.e) { const e = E.get(k); if (e.faces.length === 2) parent.set(find(e.faces[0]), find(e.faces[1])) }
  const groups = new Map()
  for (const fi of faces) { const r = find(fi); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(fi) }
  let merged = 0
  for (const g of groups.values()) {
    for (const fi of g) for (const v of m.f[fi]) cand.add(v)
    const loop = mergeFaceGroup(m, g)
    if (!loop) continue
    merged++
    m.f[g[0]] = loop
    for (let i = 1; i < g.length; i++) m.f[g[i]] = null
  }
  if (wire.size) m.we = m.we.filter(([a, b]) => !wire.has(ekey(a, b)))
  if (!merged && !wire.size) return 'Las caras no forman un contorno coplanar válido para disolver la arista'
  cleanup(m, cand)
  sel.clear()
}
export function dissolveVerts(m, sel, mode) {
  if (!sel.v.size) return 'No hay vértices seleccionados'
  const E = m.edges(), vf = vertFaces(m)
  const cand = new Set(sel.v)
  for (const v of sel.v) {
    const fs = vf[v].filter((fi) => m.f[fi] && m.f[fi].includes(v))
    if (!fs.length) continue
    const closed = fs.length >= 3 && fs.every((fi) => { const f = m.f[fi]; const i = f.indexOf(v); return E.get(ekey(v, f[(i + 1) % f.length])).faces.length === 2 && E.get(ekey(v, f[(i + f.length - 1) % f.length])).faces.length === 2 })
    if (closed) {
      const loop = mergeFaceGroup(m, fs)
      if (loop) { m.f[fs[0]] = loop; for (let i = 1; i < fs.length; i++) m.f[fs[i]] = null; for (const x of loop) cand.add(x) }
    } else {
      for (const fi of fs) m.f[fi] = m.f[fi].filter((x) => x !== v)
    }
    m.we = m.we.filter(([a, b]) => a !== v && b !== v)
  }
  // los vértices disueltos deben desaparecer aunque sigan referenciados por la geometría de ancla: se filtran de las caras
  const kill = new Set(sel.v)
  m.f = m.f.map((f) => (f ? f.filter((x) => !kill.has(x)) : f))
  cleanup(m, kill)
  sel.clear()
}
