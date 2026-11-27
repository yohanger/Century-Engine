// Operaciones de malla · unir, fusionar y separar. Ver ops.js.
import {
  PolyMesh, ekey, ekeyA, ekeyB, sub, add, mul, dot, cross, norm, len, lerp3, dist, triangulateFace, signedVolume,
} from '../../engine/runtime/mesh/polymesh.js'
import { vertFaces, faceIslands } from './sel.js'

import { cleanup, setFromMode, faceVerts } from './ops-util.js'

// ---------- unir / fusionar ----------
function weld(m, groups, positions) {
  const rep = new Int32Array(m.v.length).map((_, i) => i)
  groups.forEach((g, gi) => { for (const v of g) rep[v] = g[0]; m.v[g[0]] = positions[gi] })
  m.f = m.f.map((f) => f.map((v) => rep[v]))
  m.we = m.we.map(([a, b]) => [rep[a], rep[b]])
  const seen = new Set()
  m.we = m.we.filter(([a, b]) => { if (a === b) return false; const k = ekey(a, b); if (seen.has(k)) return false; seen.add(k); return true })
  const kill = new Set(); groups.forEach((g) => g.slice(1).forEach((v) => kill.add(v)))
  const c = cleanup(m, kill)
  return { reps: groups.map((g) => c.vmap[g[0]]), c }
}
export const centroid = (m, vs) => { let c = [0, 0, 0]; for (const v of vs) c = add(c, m.v[v]); return mul(c, 1 / vs.length) }

export function mergeSelected(m, sel, mode, how = 'center') {
  const vs = [...sel.v]
  if (vs.length < 2) return 'Selecciona al menos dos vértices'
  const pos = how === 'first' ? m.v[vs[0]] : how === 'last' ? m.v[vs[vs.length - 1]] : centroid(m, vs)
  const r = weld(m, [vs], [[...pos]])
  setFromMode(m, sel, 'vertex', { v: r.reps })
}
export function collapseEdges(m, sel, mode) {
  if (!sel.e.size) return 'Selecciona aristas'
  const parent = new Map(); const find = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) x = parent.get(x); return x }
  for (const k of sel.e) parent.set(find(ekeyA(k)), find(ekeyB(k)))
  const groups = new Map()
  for (const v of sel.v) { const r = find(v); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(v) }
  const gs = [...groups.values()].filter((g) => g.length > 1)
  const r = weld(m, gs, gs.map((g) => centroid(m, g)))
  setFromMode(m, sel, 'vertex', { v: r.reps })
}
/** Fusionar por distancia. Devuelve el número de vértices eliminados (o texto de error). */
export function mergeByDistance(m, sel, mode, d = 1e-4, onlySel = true) {
  const ids = onlySel && sel.v.size ? [...sel.v] : m.v.map((_, i) => i)
  const cell = Math.max(d, 1e-9)
  const grid = new Map(), key = (x, y, z) => `${x},${y},${z}`
  const parent = new Map(ids.map((i) => [i, i])); const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
  for (const i of ids) {
    const p = m.v[i], cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell)
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      for (const j of grid.get(key(cx + x, cy + y, cz + z)) || []) if (dist(p, m.v[j]) <= d) parent.set(find(i), find(j))
    }
    const k = key(cx, cy, cz); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i)
  }
  const groups = new Map()
  for (const i of ids) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i) }
  const gs = [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => a - b))
  if (!gs.length) return 0
  const before = m.v.length
  const r = weld(m, gs, gs.map((g) => centroid(m, g)))
  void r
  sel.clear()
  return before - m.v.length
}

// ---------- separar ----------
/** Parte (Y / V): separa las caras seleccionadas del resto, o abre las aristas seleccionadas. */
export function splitEdges(m, keys) {
  const E = m.edges(), inc = new Map()
  for (const k of keys) for (const v of [ekeyA(k), ekeyB(k)]) inc.set(v, true)
  const vf = vertFaces(m), created = []
  const orig = m.f.map((f) => [...f])
  for (const v of inc.keys()) {
    const fs = vf[v]
    if (fs.length < 2) continue
    const parent = new Map(fs.map((f) => [f, f])); const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x }
    for (const fi of fs) {
      const f = orig[fi], i = f.indexOf(v)
      for (const o of [f[(i + 1) % f.length], f[(i + f.length - 1) % f.length]]) {
        const k = ekey(v, o)
        if (keys.has(k)) continue
        for (const g of E.get(k).faces) if (g !== fi) parent.set(find(fi), find(g))
      }
    }
    const roots = [...new Set(fs.map(find))]
    for (let r = 1; r < roots.length; r++) {
      const nv = m.v.push([...m.v[v]]) - 1; created.push(nv)
      for (const fi of fs) if (find(fi) === roots[r]) { const f = m.f[fi]; f[f.indexOf(v)] = nv }
    }
  }
  return created
}
export function split(m, sel, mode) {
  let keys = new Set()
  if (sel.f.size && (mode === 'face' || mode === 'vertex')) {
    const E = m.edges()
    for (const [k, e] of E) { const inS = e.faces.filter((f) => sel.f.has(f)).length; if (inS && (inS < e.faces.length || e.faces.length === 1)) keys.add(k) }
    // aristas de borde de malla de las caras: ya están abiertas
  } else keys = new Set(sel.e)
  if (!keys.size) return 'Nada que separar'
  const created = splitEdges(m, keys)
  if (!created.length) return 'La selección ya está separada'
  setFromMode(m, sel, mode, { v: [...sel.v], e: [...sel.e], f: [...sel.f] })
}
export function rip(m, sel, mode) {
  let keys = new Set(sel.e)
  if (!keys.size && sel.v.size) { const E = m.edges(); for (const [k, e] of E) if (sel.v.has(e.a) || sel.v.has(e.b)) keys.add(k) }
  if (!keys.size) return 'Selecciona vértices o aristas'
  const created = splitEdges(m, keys)
  if (!created.length) return 'No hay nada que abrir'
  setFromMode(m, sel, mode === 'face' ? 'vertex' : mode, { v: [...sel.v, ...created], e: [...sel.e], f: [] })
}

/** Extrae las caras dadas a una malla nueva (y las quita de `m`). */
export function extractFaces(m, faces) {
  const set = new Set(faces)
  const vmap = new Map(), nv = [], nf = []
  for (const fi of set) nf.push(m.f[fi].map((v) => { if (!vmap.has(v)) { vmap.set(v, nv.length); nv.push([...m.v[v]]) } return vmap.get(v) }))
  const part = new PolyMesh(nv, nf); part.smooth = m.smooth
  if (m.uv.length === m.f.length) part.uv = [...set].map((fi) => m.uv[fi].map((u) => [...u]))
  if (m.colors.length) part.colors = [...vmap.keys()].map((v) => [...m.colors[v]])
  if (m.weights.length) part.weights = [...vmap.keys()].map((v) => [...m.weights[v]])
  part.seams = m.seams.filter(([a, b]) => vmap.has(a) && vmap.has(b)).map(([a, b]) => [vmap.get(a), vmap.get(b)])
  const cand = faceVerts(m, set)
  for (const fi of set) m.f[fi] = null
  cleanup(m, cand)
  return part
}
export function looseParts(m) {
  const isl = faceIslands(m)
  if (isl.length < 2) return null
  return isl.map((faces) => faces)
}

export function duplicate(m, sel, mode) {
  const vs = [...sel.v]
  if (!vs.length) return 'No hay nada seleccionado'
  const map = new Map(); for (const v of vs) map.set(v, m.v.push([...m.v[v]]) - 1)
  const faces = [], edges = []
  const inFace = new Set()
  for (const fi of sel.f) { m.f.push(m.f[fi].map((v) => map.get(v))); faces.push(m.f.length - 1); const f = m.f[fi]; for (let i = 0; i < f.length; i++) inFace.add(ekey(f[i], f[(i + 1) % f.length])) }
  const E = m.edges()
  for (const k of sel.e) if (!inFace.has(k)) { const a = map.get(ekeyA(k)), b = map.get(ekeyB(k)); m.we.push([a, b]); edges.push(ekey(a, b)) }
  const nvs = [...map.values()]
  setFromMode(m, sel, mode, { v: nvs, e: [...[...sel.e].map((k) => ekey(map.get(ekeyA(k)), map.get(ekeyB(k))))], f: faces })
  void E; void edges
}
