// Operaciones de edición de malla (puras, sin DOM). Cada una modifica la malla en sitio y actualiza la selección.
// Convención: devuelven undefined si todo va bien o un texto de error para mostrar al usuario.
import {
  PolyMesh, ekey, ekeyA, ekeyB, sub, add, mul, dot, cross, norm, len, lerp3, dist, triangulateFace, signedVolume,
} from '../../engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from './sel.js'
import { loopCut, bisect } from './cuts.js'
import { setFromMode } from './ops-util.js'
import { extrude, extrudeSolid, extrudeIndividual, inset, bevelOp, bevelVertexOp, del, dissolveFaces, dissolveEdges, dissolveVerts, mergeSelectedFaces } from './ops-edit.js'
import { vertexSlide, edgeSlide, shear, spin } from './ops-shape.js'
import { mergeSelected, collapseEdges, mergeByDistance, split, rip, duplicate } from './ops-join.js'
import { reduceFaces } from './ops-reduce.js'
import { inspectMeshCleanup, cleanMeshTopology } from './ops-cleanup.js'
import { fill, closeContour, bridge, flipNormals, recalcNormals, subdivide, triangulateSel } from './ops-fill.js'
export * from './ops-util.js'
export * from './ops-edit.js'
export * from './ops-shape.js'
export * from './ops-join.js'
export * from './ops-fill.js'

// ---------- ocultar / mostrar ----------
export function hide(m, sel, mode, unselected = false) {
  if (unselected) m.v.forEach((_, i) => { if (!sel.v.has(i)) m.hidden.add(i) })
  else for (const v of sel.v) m.hidden.add(v)
  sel.clear()
}
export function reveal(m, sel, mode) {
  const had = [...m.hidden]
  m.hidden.clear()
  sel.clear(); sel.v = new Set(had)
  normalize(m, sel, mode)
}

// ---------- primitivas dentro de la malla ----------
/** Añade otra malla (con transformación ya aplicada) y la deja seleccionada. */
export function addMesh(m, other, sel, mode) {
  // Unir mallas conserva UV por esquina y datos de pintura de ambas fuentes.
  m.ensureUV()
  const source = other.clone(); source.ensureUV()
  const hadColors = !!(m.colors.length || source.colors.length)
  const hadWeights = !!(m.weights.length || source.weights.length)
  if (hadColors && !m.colors.length) m.colors = m.v.map(() => [1, 1, 1])
  if (hadWeights && !m.weights.length) m.weights = m.v.map(() => [1, 0, 0, 0, 0, 0, 0, 0])
  const base = m.v.length
  for (const p of other.v) m.v.push([...p])
  if (hadColors) m.colors.push(...other.v.map((_, i) => [...(source.colors[i] || [1, 1, 1])]))
  if (hadWeights) m.weights.push(...other.v.map((_, i) => [...(source.weights[i] || [1, 0, 0, 0, 0, 0, 0, 0])]))
  const first = m.f.length
  for (const f of other.f) m.f.push(f.map((v) => v + base))
  m.uv.push(...source.uv.map((face) => face.map((uv) => [...uv])))
  m.seams.push(...source.seams.map(([a, b]) => [a + base, b + base]))
  for (const [a, b] of other.we) m.we.push([a + base, b + base])
  const vs = other.v.map((_, i) => i + base)
  const fs = other.f.map((_, i) => i + first)
  setFromMode(m, sel, mode, { v: vs, f: fs, e: [] })
  if (mode === 'edge') { sel.e = new Set(); for (const fi of fs) { const f = m.f[fi]; for (let i = 0; i < f.length; i++) sel.e.add(ekey(f[i], f[(i + 1) % f.length])) } normalize(m, sel, 'edge') }
}

// ---------- construcción de mallas sin caras ----------
/** Añade un punto local; solo lo conecta si hay un origen elegido explícitamente. */
export function appendVertex(m, sel, mode, point, from = null) {
  if (mode !== 'vertex') return 'Colocar vértice requiere el modo Vértices'
  if (!Array.isArray(point) || point.length !== 3 || point.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e5)) return 'Posición del vértice inválida'
  if (m.v.length >= 4194304) return 'La malla alcanzó su límite de vértices'
  if (from !== null && (!Number.isInteger(from) || from < 0 || from >= m.v.length || m.hidden.has(from))) return 'El vértice de origen no existe'
  if (from !== null && dist(m.v[from], point) < 1e-5) return 'El nuevo vértice debe estar separado del anterior'
  const idx = m.v.push([...point]) - 1
  if (from !== null) m.we.push([from, idx])
  setFromMode(m, sel, 'vertex', { v: [idx] })
}

/** Conecta dos vértices seleccionados, sin fabricar caras ni aristas duplicadas. */
export function connectVertices(m, sel, mode) {
  if (mode !== 'vertex' || sel.v.size !== 2) return 'Selecciona exactamente dos vértices'
  const [a, b] = [...sel.v]
  if (a === b || m.hidden.has(a) || m.hidden.has(b) || !m.v[a] || !m.v[b]) return 'Los vértices no son válidos'
  if (m.edges().has(ekey(a, b))) return 'Los vértices ya están conectados'
  m.we.push([a, b]); normalize(m, sel, 'vertex')
}

// ---------- corte de bucle / cuchillo (envoltorios) ----------
export function loopCutOp(m, sel, mode, p) {
  const r = loopCut(m, p.key, p.cuts ?? 1, p.slide ?? 0)
  if (!r) return 'No se puede cortar un bucle aquí'
  setFromMode(m, sel, mode === 'face' ? 'edge' : mode, { v: r.verts, e: r.edges })
}
export function knifeTargetFaces(m, sel, mode) {
  if (mode === 'face') return new Set(sel.f)
  if (mode === 'edge') {
    const edges = m.edges(), faces = new Set()
    for (const key of sel.e) for (const fi of edges.get(key)?.faces || []) faces.add(fi)
    return faces
  }
  const faces = new Set()
  m.f.forEach((face, fi) => { if (face.some((v) => sel.v.has(v))) faces.add(fi) })
  return faces
}
export function knifeOp(m, sel, mode, p) {
  const targets = p.faces ? new Set(p.faces) : knifeTargetFaces(m, sel, mode)
  if (!targets.size) return 'Selecciona caras, aristas o vértices para recortar'
  const r = bisect(m, p.point, p.normal, targets)
  if (!r) return 'El plano de corte no atraviesa la malla'
  setFromMode(m, sel, mode === 'face' ? 'edge' : mode, { v: r.verts, e: r.edges })
}

// ---------- mover por normal (encoger / engordar) ----------
export function vertexNormalsOf(m) { return m.vertexNormals() }

export const OPS = {
  extrude, extrudeSolid, extrudeIndividual, closeContour, vertexSlide, edgeSlide, shear, spin, inset, bevel: bevelOp, bevelVertex: bevelVertexOp, delete: del, dissolveFaces, dissolveEdges, dissolveVerts, mergeFaces: mergeSelectedFaces, merge: mergeSelected, collapse: collapseEdges,
  mergeDistance: mergeByDistance, split, rip, duplicate, fill, bridge, flip: flipNormals, recalc: recalcNormals, subdivide,
  triangulate: triangulateSel, hide, reveal, loopCut: loopCutOp, knife: knifeOp, reduceFaces, cleanMeshTopology,
}
export { mergeSelectedFaces as mergeFaces }
export { Sel }

export { reduceFaces }

export { inspectMeshCleanup, cleanMeshTopology }
