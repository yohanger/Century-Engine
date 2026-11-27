// Bisel de vértices (Ctrl+Shift+B). Trabaja sobre una copia: los errores de topología nunca mutan la malla original.
// La superficie se reconstruye por caras; el tapón de un vértice interior comparte exactamente las aristas del bisel.
import { add, sub, mul, len, cross, dot, ekey } from '../../engine/runtime/mesh/polymesh.js'

const EPS = 1e-8
const point = (mesh, value) => mesh.v.push(value) - 1

function fanFor(mesh, vertex, faces) {
  const uses = faces.map((fi) => {
    const f = mesh.f[fi], i = f.indexOf(vertex)
    return { fi, prev: f[(i + f.length - 1) % f.length], next: f[(i + 1) % f.length] }
  })
  if (!uses.length || uses.some((x) => x.prev === x.next)) return null
  const byPrev = new Map()
  for (const use of uses) {
    if (byPrev.has(use.prev)) return null // abanico no manifold o caras con la misma orientación
    byPrev.set(use.prev, use)
  }
  const starts = uses.filter((use) => !uses.some((x) => x.next === use.prev))
  const closed = starts.length === 0
  if (starts.length > 1) return null
  const start = closed ? uses[0] : starts[0]
  if (!start) return null
  const ordered = [], visited = new Set()
  let current = start
  while (current && !visited.has(current.fi)) {
    visited.add(current.fi)
    ordered.push(current)
    current = byPrev.get(current.next)
  }
  if (ordered.length !== uses.length || (closed && current !== start) || (!closed && current)) return null
  return { ordered, closed }
}

/** Genera tapas coherentes para vértices cerrados y curvas sobre fronteras abiertas. Devuelve null si no es viable. */
export function bevelVertices(mesh, ids, width, segments = 1, profile = 0.5) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isInteger(segments) || segments < 1 || segments > 32 ||
      !Number.isFinite(profile) || profile < 0.1 || profile > 1) return null
  const chosen = new Set(ids)
  if (!chosen.size || [...chosen].some((v) => !Number.isInteger(v) || v < 0 || v >= mesh.v.length || mesh.hidden.has(v))) return null
  const edges = mesh.edges(), faceUses = mesh.v.map(() => [])
  mesh.f.forEach((f, fi) => f.forEach((v) => faceUses[v].push(fi)))
  const wire = new Set(mesh.we.flat())
  const plans = new Map()
  // Validación completa antes de generar vértices. No se biselan aristas sueltas ni abanicos ambiguos.
  for (const v of chosen) {
    if (wire.has(v)) return null
    const fan = fanFor(mesh, v, faceUses[v])
    if (!fan) return null
    const neighbours = new Set()
    for (const f of fan.ordered) {
      const normal = mesh.faceNormal(f.fi)
      const a = sub(mesh.v[f.prev], mesh.v[v]), b = sub(mesh.v[f.next], mesh.v[v])
      if (len(a) < EPS || len(b) < EPS || dot(cross(b, a), normal) < -EPS) return null
      neighbours.add(f.prev); neighbours.add(f.next)
    }
    if (neighbours.size < 2 || [...neighbours].some((n) => {
      const ed = edges.get(ekey(v, n))
      return !ed || ed.faces.length < 1 || ed.faces.length > 2 || len(sub(mesh.v[n], mesh.v[v])) < EPS
    })) return null
    const boundaryCount = [...neighbours].filter((n) => edges.get(ekey(v, n)).faces.length === 1).length
    if (fan.closed ? boundaryCount !== 0 : boundaryCount !== 2) return null
    plans.set(v, { fan, neighbours })
  }
  const work = mesh.clone(), generated = new Set(), caps = []
  const cuts = new Map(), replacements = new Map()
  const cutFor = (v, n) => {
    const key = `${v}:${n}`
    if (cuts.has(key)) return cuts.get(key)
    const d = sub(mesh.v[n], mesh.v[v]), l = len(d)
    const k = point(work, add(mesh.v[v], mul(d, Math.min(width, l * 0.45) / l)))
    cuts.set(key, k); generated.add(k)
    return k
  }
  for (const [v, { fan }] of plans) {
    const rim = []
    for (const use of fan.ordered) {
      const prev = cutFor(v, use.prev), next = cutFor(v, use.next)
      const seq = [prev], a = work.v[prev], b = work.v[next], center = mesh.v[v]
      // Bézier racional: el perfil controla la redondez sin introducir vértices fuera de la cara de origen.
      const weight = Math.max(0.15, profile / 0.5)
      for (let j = 1; j < segments; j++) {
        const t = j / segments, u = 1 - t, den = u*u + 2*weight*u*t + t*t
        const p = [0,1,2].map((k) => (u*u*a[k] + 2*weight*u*t*center[k] + t*t*b[k]) / den)
        const idx = point(work, p); generated.add(idx); seq.push(idx)
      }
      seq.push(next)
      replacements.set(`${use.fi}:${v}`, seq)
      rim.push(...seq.slice(0, -1))
    }
    if (fan.closed) {
      // La orientación del tapón es opuesta al recorrido de cada esquina de las caras originales.
      const boundary = [...rim].reverse()
      if (boundary.length < 3) return null
      if (boundary.length === 3) { caps.push(boundary); continue }
      const cen = [0,0,0]
      for (const idx of boundary) for (let k=0;k<3;k++) cen[k] += work.v[idx][k] / boundary.length
      const ci = point(work, cen); generated.add(ci)
      for (let i=0;i<boundary.length;i++) caps.push([boundary[i], boundary[(i+1)%boundary.length], ci])
    }
  }
  const faces = mesh.f.map((f, fi) => f.flatMap((v) => replacements.get(`${fi}:${v}`) || [v]))
  faces.push(...caps)
  // Evitar triangulaciones degeneradas cuando la anchura colapsa aristas pequeñas.
  if (faces.some((f) => f.length < 3 || new Set(f).size !== f.length || f.length > 4096)) return null
  work.f = faces
  const index = work.pruneLoose(chosen)
  const output = [...generated].map((i) => index[i]).filter((i) => i >= 0)
  Object.assign(mesh, work)
  return { verts: output, faces: caps.map((_, i) => mesh.f.length - caps.length + i) }
}
