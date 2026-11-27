// Operaciones geométricas adicionales de Edit Mesh. Trabajan en coordenadas locales,
// sobre PolyMesh; no introducen geometría auxiliar de three.js ni estados paralelos.
import { ekey, ekeyA, ekeyB, add, sub, mul, dot, cross, norm, len, lerp3 } from '../../engine/runtime/mesh/polymesh.js'
import { normalize, vertNeighbors } from './sel.js'
import { setFromMode } from './ops-util.js'

const LIMIT = 0.95 // El extremo exacto de la arista colapsaría caras adyacentes.
const finite = (n) => typeof n === 'number' && Number.isFinite(n)
const validVert = (m, i) => Number.isInteger(i) && i >= 0 && i < m.v.length && !m.hidden.has(i)
const factorOf = (p) => Math.max(-LIMIT, Math.min(LIMIT, Number(p.factor ?? 0)))
const centroid = (m, ids) => mul([...ids].reduce((s, v) => add(s, m.v[v]), [0, 0, 0]), 1 / ids.size)

/** Desliza vértices por una arista vecina; en bifurcaciones exige el destino explícito. */
export function vertexSlide(m, sel, mode, p = {}) {
  if (mode !== 'vertex' || !sel.v.size) return 'Vertex Slide requiere vértices seleccionados'
  const f = Number(p.factor ?? 0)
  if (!finite(f)) return 'El factor debe ser un número válido'
  const nb = vertNeighbors(m), moves = []
  for (const v of sel.v) {
    if (!validVert(m, v)) return 'Hay un vértice oculto o inválido'
    const neighbors = [...nb[v]].filter((u) => validVert(m, u) && !sel.v.has(u)).sort((a, b) => a - b)
    const explicit = p.targets?.[v] ?? p.target
    let target
    if (explicit != null) {
      if (!neighbors.includes(explicit)) return 'El destino debe compartir una arista libre con el vértice'
      target = explicit
    } else if (p.axis && ['x', 'y', 'z'].includes(p.axis)) {
      const ax = 'xyz'.indexOf(p.axis), sign = Math.sign(f || 1)
      const choices = neighbors.map((u) => ({ u, score: norm(sub(m.v[u], m.v[v]))[ax] * sign }))
        .sort((a, b) => b.score - a.score)
      if (!choices.length || choices[0].score < 0.25) return 'No existe una arista en la dirección del eje elegido'
      target = choices[0].u
    } else {
      if (neighbors.length !== 2) return 'Vertex Slide necesita dos aristas libres o un eje/destino explícito'
      target = neighbors[f < 0 ? 0 : 1]
    }
    moves.push([v, lerp3(m.v[v], m.v[target], Math.min(Math.abs(f), LIMIT))])
  }
  for (const [v, pos] of moves) m.v[v] = pos
  normalize(m, sel, mode)
}

/** Desliza una cadena de aristas sobre las aristas laterales de su superficie. */
export function edgeSlide(m, sel, mode, p = {}) {
  if (mode !== 'edge' || !sel.e.size) return 'Edge Slide requiere aristas seleccionadas'
  const f = Number(p.factor ?? 0)
  if (!finite(f)) return 'El factor debe ser un número válido'
  const E = m.edges(), degree = new Map(), selected = new Set(sel.e)
  for (const k of selected) {
    const e = E.get(k)
    if (!e || e.faces.length !== 2 || m.hidden.has(e.a) || m.hidden.has(e.b)) return 'Edge Slide requiere aristas interiores con dos caras'
    for (const v of [e.a, e.b]) degree.set(v, (degree.get(v) || 0) + 1)
  }
  if ([...degree.values()].some((n) => n > 2)) return 'La selección tiene una bifurcación; selecciona una cadena simple'
  const ends = [...degree].filter(([, d]) => d === 1).map(([v]) => v).sort((a, b) => a - b)
  if (ends.length !== 2) return 'Edge Slide requiere una cadena abierta, sin bucles'
  const adjacency = new Map([...degree.keys()].map((v) => [v, []]))
  for (const k of selected) { const a = ekeyA(k), b = ekeyB(k); adjacency.get(a).push(b); adjacency.get(b).push(a) }
  const chain = [ends[0]]
  while (chain.length < degree.size) {
    const cur = chain.at(-1), prev = chain.at(-2)
    const next = adjacency.get(cur).find((u) => u !== prev)
    if (next == null || chain.includes(next)) return 'Las aristas no forman una cadena continua'
    chain.push(next)
  }
  if (chain.at(-1) !== ends[1]) return 'Las aristas no forman una cadena continua'
  const nb = vertNeighbors(m), vn = m.vertexNormals(), moves = []
  for (let i = 0; i < chain.length; i++) {
    const v = chain[i], along = adjacency.get(v)
    const tangent = sub(m.v[chain[Math.min(i + 1, chain.length - 1)]], m.v[chain[Math.max(0, i - 1)]])
    const lateral = norm(cross(vn[v], tangent))
    if (len(lateral) < 1e-8) return 'La cadena no tiene una normal de superficie válida'
    const rails = [...nb[v]].filter((u) => !along.includes(u) && validVert(m, u))
    let choice = null, best = -Infinity
    for (const u of rails) {
      const d = sub(m.v[u], m.v[v]), projection = dot(norm(d), lateral) * Math.sign(f || 1)
      if (projection > best) { choice = u; best = projection }
    }
    if (choice === null || best < 0.15) return 'La arista no tiene continuidad lateral en esa dirección'
    moves.push([v, lerp3(m.v[v], m.v[choice], Math.min(Math.abs(f), LIMIT))])
  }
  for (const [v, pos] of moves) m.v[v] = pos
  normalize(m, sel, mode)
}

/** Cizalla reversible: desplaza un eje proporcionalmente a otro, alrededor del pivote. */
export function shear(m, sel, mode, p = {}) {
  if (!sel.v.size) return 'Selecciona geometría para inclinar'
  const f = Number(p.factor ?? 0), axis = p.axis ?? 'x', reference = p.reference ?? 'y'
  if (!finite(f) || Math.abs(f) > 100) return 'El factor de inclinación no es válido'
  if (!['x', 'y', 'z'].includes(axis) || !['x', 'y', 'z'].includes(reference) || axis === reference) return 'Selecciona dos ejes distintos'
  const pivot = p.pivot ?? centroid(m, sel.v)
  if (!Array.isArray(pivot) || pivot.length !== 3 || !pivot.every(finite)) return 'Pivote inválido'
  const a = 'xyz'.indexOf(axis), b = 'xyz'.indexOf(reference)
  for (const v of sel.v) {
    if (!validVert(m, v)) return 'Hay un vértice oculto o inválido'
    m.v[v][a] += (m.v[v][b] - pivot[b]) * f
  }
  normalize(m, sel, mode)
}

const rotation = (p, axis, angle) => {
  // Rodrigues, para evitar depender de three.js en las operaciones puras.
  const c = Math.cos(angle), s = Math.sin(angle), q = norm(axis)
  return add(add(mul(p, c), mul(cross(q, p), s)), mul(q, dot(q, p) * (1 - c)))
}

/** Extrusión rotatoria de una región abierta de caras. No une extremos ni rellena huecos internos. */
export function spin(m, sel, mode, p = {}) {
  if (mode !== 'face' || !sel.f.size) return 'Spin requiere al menos una cara seleccionada'
  const angle = Number(p.angle ?? 90), steps = Number(p.steps ?? 8)
  const axis = p.axis ?? 'y', center = p.center ?? [0, 0, 0]
  if (!finite(angle) || Math.abs(angle) < 0.001 || Math.abs(angle) >= 360) return 'El ángulo debe estar entre -360° y 360°, sin alcanzar una vuelta completa'
  if (!Number.isInteger(steps) || steps < 1 || steps > 128) return 'Spin admite entre 1 y 128 pasos'
  if (!['x', 'y', 'z'].includes(axis) || !Array.isArray(center) || center.length !== 3 || !center.every(finite)) return 'Eje o centro de Spin inválidos'
  const faces = [...sel.f].sort((a, b) => a - b)
  if (faces.length * steps * 8 > 250000) return 'Spin excede el límite de geometría por operación'
  if (faces.some((fi) => !m.f[fi] || m.faceHidden(fi))) return 'Hay caras ocultas o inválidas'
  const selected = new Set(faces), count = new Map(), directed = []
  for (const fi of faces) {
    const f = m.f[fi]
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length], k = ekey(a, b)
      count.set(k, (count.get(k) || 0) + 1)
      directed.push({ a, b, k })
    }
  }
  if ([...count.values()].some((n) => n > 2)) return 'La región tiene aristas no manifold'
  const boundary = directed.filter((e) => count.get(e.k) === 1)
  if (!boundary.length) return 'Spin requiere una región con borde abierto'
  const ids = new Set(faces.flatMap((fi) => m.f[fi]))
  const axisVec = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]
  const orig = new Map([...ids].map((v) => [v, [...m.v[v]]]))
  const rad = angle * Math.PI / 180
  // Una cara que yace sobre el eje produciría una región colapsada: rechazarla.
  for (const v of ids) if (len(cross(axisVec, sub(orig.get(v), center))) < 1e-7) return 'Spin: la selección toca el eje; cambia el centro o la selección'
  const layers = [new Map([...ids].map((v) => [v, v]))]
  const newFaces = []
  for (let s = 1; s <= steps; s++) {
    const layer = new Map(), theta = rad * s / steps
    for (const v of ids) {
      const pos = add(center, rotation(sub(orig.get(v), center), axisVec, theta))
      layer.set(v, m.v.push(pos) - 1)
    }
    const prev = layers[s - 1]
    for (const { a, b } of boundary) newFaces.push([prev.get(a), prev.get(b), layer.get(b), layer.get(a)])
    layers.push(layer)
  }
  for (const fi of faces) {
    const f = m.f[fi]
    m.f[fi] = f.map((v) => layers[steps].get(v))
  }
  m.f.push(...newFaces)
  // Los vértices originales pueden quedar sueltos en una región desconectada.
  // Se conservan únicamente si participan en otras caras; de lo contrario, limpiar.
  m.pruneLoose(ids)
  setFromMode(m, sel, mode, { f: faces })
}
