import { ekey, ekeyA, ekeyB, dist, validatePolygon, checkClosed } from '../../engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from './sel.js'
import { mergeByDistance } from './ops-join.js'

const validTolerance = (value) => Number.isFinite(value) && value > 0 && value <= 0.01

export function inspectMeshCleanup(m, tolerance = 0.0001) {
  if (!validTolerance(tolerance)) return null
  const used = new Set(), faceEdges = new Set(), edgeUses = new Map()
  for (const face of m.f) for (let i = 0; i < face.length; i++) {
    const a = face[i], b = face[(i + 1) % face.length], key = ekey(a, b)
    used.add(a); used.add(b); faceEdges.add(key)
    edgeUses.set(key, (edgeUses.get(key) || 0) + 1)
  }
  const wireUsed = new Set(), wireKeys = new Set()
  let duplicateWires = 0, invalidWires = 0, redundantWires = 0, looseWireEdges = 0
  for (const [a, b] of m.we) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= m.v.length || b >= m.v.length || a === b || dist(m.v[a], m.v[b]) <= 1e-9) { invalidWires++; continue }
    wireUsed.add(a); wireUsed.add(b)
    const key = ekey(a, b)
    if (wireKeys.has(key)) duplicateWires++
    else wireKeys.add(key)
    if (faceEdges.has(key)) redundantWires++
    else looseWireEdges++
  }
  const looseVertices = m.v.reduce((n, _, i) => n + (!used.has(i) && !wireUsed.has(i) ? 1 : 0), 0)
  const borderEdges = [...edgeUses.entries()].filter(([, n]) => n === 1).map(([key]) => key)
  let tJunctions = null
  if (borderEdges.length <= 512 && m.v.length <= 1024) {
    const tol = Math.max(1e-7, tolerance)
    tJunctions = 0
    for (const key of borderEdges) {
      const a = ekeyA(key), b = ekeyB(key), start = m.v[a], end = m.v[b]
      const delta = end.map((v, i) => v - start[i]), len2 = delta.reduce((n, v) => n + v * v, 0)
      if (len2 <= tol * tol) continue
      for (let v = 0; v < m.v.length; v++) {
        if (v === a || v === b || !used.has(v)) continue
        const vec = m.v[v].map((val, i) => val - start[i])
        const t = vec.reduce((n, val, i) => n + val * delta[i], 0) / len2
        if (t <= 1e-6 || t >= 1 - 1e-6) continue
        const squared = vec.reduce((n, val, i) => n + (val - t * delta[i]) ** 2, 0)
        if (squared <= tol ** 2) { tJunctions++; break }
      }
    }
  }
  let closePairs = 0
  if (m.v.length <= 4096) {
    const buckets = new Map(), cell = tolerance
    const key = (x, y, z) => `${x},${y},${z}`
    for (let i = 0; i < m.v.length; i++) {
      const [x, y, z] = m.v[i].map((v) => Math.floor(v / cell))
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const j of buckets.get(key(x + dx, y + dy, z + dz)) || []) if (dist(m.v[i], m.v[j]) <= tolerance) closePairs++
      }
      const k = key(x, y, z)
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k).push(i)
    }
  }
  return {
    looseVertices, wireEdges: looseWireEdges, duplicateWires, invalidWires, redundantWires,
    closePairs, closePairsChecked: m.v.length <= 4096, tJunctions,
    invalidFaces: m.f.length <= 4096 ? m.f.reduce((n, face) => n + (!!validatePolygon(m, face) ? 1 : 0), 0) : null,
    nonManifoldEdges: [...edgeUses.values()].filter((n) => n > 2).length,
  }
}

export function cleanMeshTopology(m, sel, mode, settings = {}) {
  const opts = {
    removeLooseEdges: settings.removeLooseEdges === true,
    removeLooseVertices: settings.removeLooseVertices === true,
    removeDuplicateWires: settings.removeDuplicateWires === true,
    weldVertices: settings.weldVertices === true,
    tolerance: Number(settings.tolerance ?? 0.0001),
  }
  if (!validTolerance(opts.tolerance)) return 'La tolerancia debe estar entre 0 y 0.01 metros'
  if (!opts.removeLooseEdges && !opts.removeLooseVertices && !opts.removeDuplicateWires && !opts.weldVertices) return 'Selecciona una acción de limpieza'
  if (m.v.length > 4096 && opts.weldVertices) return 'La unión por distancia está limitada a 4096 vértices por operación'
  if (opts.removeLooseVertices && m.we.some(([a, b]) => !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= m.v.length || b >= m.v.length) && !opts.removeDuplicateWires && !opts.removeLooseEdges) return 'Hay aristas inválidas. Activa su limpieza antes de reindexar vértices'
  const candidate = m.clone(), oldSel = sel.clone()
  let wiresRemoved = 0, vertsRemoved = 0, welded = 0
  const faceKeys = new Set()
  for (const face of candidate.f) for (let i = 0; i < face.length; i++) faceKeys.add(ekey(face[i], face[(i + 1) % face.length]))
  const seen = new Set()
  candidate.we = candidate.we.filter(([a, b]) => {
    const valid = Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < candidate.v.length && b < candidate.v.length && a !== b && dist(candidate.v[a], candidate.v[b]) > 1e-9
    const key = valid ? ekey(a, b) : null
    const duplicated = key !== null && (seen.has(key) || faceKeys.has(key))
    if (valid && !duplicated) seen.add(key)
    const remove = (opts.removeLooseEdges && !faceKeys.has(key)) || (opts.removeDuplicateWires && (!valid || duplicated))
    if (remove) wiresRemoved++
    return !remove
  })
  if (opts.weldVertices) {
    const errors = inspectMeshCleanup(candidate, opts.tolerance)
    if (errors?.closePairs) {
      const selected = new Sel(); selected.v = new Set(candidate.v.map((_, i) => i))
      const beforeEdges = [...candidate.edges().values()].filter((e) => e.faces.length > 2).length
      const beforeClosed = checkClosed(candidate).length === 0
      const beforeFaces = candidate.f.length
      const expected = candidate.clone()
      if (candidate.colors.length || candidate.weights.length || candidate.seams.length) {
        const compare = (a, b) => a?.length === b?.length && a.every((value, i) => Math.abs(value - b[i]) <= 1e-8)
        for (let i = 0; i < candidate.v.length; i++) for (let j = i + 1; j < candidate.v.length; j++) {
          if (dist(candidate.v[i], candidate.v[j]) > opts.tolerance) continue
          if ((candidate.colors.length && !compare(candidate.colors[i], candidate.colors[j])) ||
              (candidate.weights.length && !compare(candidate.weights[i], candidate.weights[j])) ||
              candidate.seams.some(([a, b]) => a === i || b === i || a === j || b === j)) {
            return 'La unión cambiaría pintura o costuras UV. Usa la fusión manual con una selección controlada'
          }
        }
      }
      const merged = mergeByDistance(candidate, selected, 'vertex', opts.tolerance, false)
      if (typeof merged === 'string') return merged
      if (merged > 0) {
        if (candidate.f.length !== beforeFaces || candidate.f.some((face, fi) => !!validatePolygon(candidate, face) && !validatePolygon(expected, expected.f[fi]))) {
          return 'La unión por distancia eliminaría o invalidaría caras. No se ha modificado la malla'
        }
        if (beforeClosed && checkClosed(candidate).length) return 'La unión abriría una malla cerrada. No se ha modificado la malla'
        if ([...candidate.edges().values()].filter((e) => e.faces.length > 2).length > beforeEdges) return 'La unión generaría aristas no manifold. No se ha modificado la malla'
        welded = merged
      }
    }
  }
  let vmap = Int32Array.from({ length: candidate.v.length }, (_, i) => i)
  if (opts.removeLooseVertices) {
    const used = new Set()
    for (const face of candidate.f) for (const v of face) used.add(v)
    for (const [a, b] of candidate.we) { used.add(a); used.add(b) }
    const isolated = new Set(candidate.v.map((_, i) => i).filter((i) => !used.has(i)))
    if (isolated.size) { vmap = candidate.removeVerts(isolated); vertsRemoved = isolated.size }
  }
  if (!wiresRemoved && !vertsRemoved && !welded) return 'No se encontraron elementos que coincidan con la limpieza solicitada'
  const updated = new Sel()
  if (welded) updated.clear()
  else if (mode === 'face') updated.f = new Set([...oldSel.f].filter((i) => i >= 0 && i < candidate.f.length))
  else if (mode === 'edge') updated.e = new Set([...oldSel.e].map((key) => {
    const a = vmap[ekeyA(key)], b = vmap[ekeyB(key)]
    return a >= 0 && b >= 0 ? ekey(a, b) : null
  }).filter((key) => key !== null))
  else updated.v = new Set([...oldSel.v].map((i) => vmap[i]).filter((i) => i >= 0))
  normalize(candidate, updated, mode)
  Object.assign(m, candidate)
  sel.v = updated.v; sel.e = updated.e; sel.f = updated.f
  return { wiresRemoved, vertsRemoved, welded }
}
