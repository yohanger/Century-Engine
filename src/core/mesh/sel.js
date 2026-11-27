// Selección de elementos de malla y utilidades de adyacencia. Sin DOM: se puede probar en Node.
import { ekey, ekeyA, ekeyB } from '../../engine/runtime/mesh/polymesh.js'

export class Sel {
  constructor() { this.v = new Set(); this.e = new Set(); this.f = new Set() }
  clone() { const s = new Sel(); s.v = new Set(this.v); s.e = new Set(this.e); s.f = new Set(this.f); return s }
  clear() { this.v.clear(); this.e.clear(); this.f.clear(); return this }
  get empty() { return !this.v.size && !this.e.size && !this.f.size }
  toJSON() { return { v: [...this.v], e: [...this.e], f: [...this.f] } }
  static from(j) { const s = new Sel(); s.v = new Set(j?.v); s.e = new Set(j?.e); s.f = new Set(j?.f); return s }
}

/** Lista de caras por vértice. */
export function vertFaces(m) {
  const r = m.v.map(() => [])
  m.f.forEach((f, fi) => { for (const v of f) r[v].push(fi) })
  return r
}
/** Vecinos por vértice (aristas de caras y sueltas). */
export function vertNeighbors(m) {
  const r = m.v.map(() => new Set())
  for (const f of m.f) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; r[a].add(b); r[b].add(a) }
  for (const [a, b] of m.we) { r[a].add(b); r[b].add(a) }
  return r
}

/** Recalcula los conjuntos derivados a partir del conjunto principal del modo activo. */
export function normalize(m, sel, mode) {
  const hid = m.hidden
  const E = m.edges()
  const ok = (v) => v < m.v.length && !hid.has(v)
  if (mode === 'vertex') {
    sel.v = new Set([...sel.v].filter(ok))
    sel.e = new Set(); sel.f = new Set()
    for (const [k, e] of E) if (sel.v.has(e.a) && sel.v.has(e.b)) sel.e.add(k)
    m.f.forEach((f, fi) => { if (f.every((v) => sel.v.has(v))) sel.f.add(fi) })
  } else if (mode === 'edge') {
    sel.e = new Set([...sel.e].filter((k) => E.has(k) && ok(ekeyA(k)) && ok(ekeyB(k))))
    sel.v = new Set()
    for (const k of sel.e) { sel.v.add(ekeyA(k)); sel.v.add(ekeyB(k)) }
    sel.f = new Set()
    m.f.forEach((f, fi) => {
      for (let i = 0; i < f.length; i++) if (!sel.e.has(ekey(f[i], f[(i + 1) % f.length]))) return
      sel.f.add(fi)
    })
  } else {
    sel.f = new Set([...sel.f].filter((fi) => fi < m.f.length && !m.faceHidden(fi)))
    sel.v = new Set(); sel.e = new Set()
    for (const fi of sel.f) {
      const f = m.f[fi]
      for (let i = 0; i < f.length; i++) { sel.v.add(f[i]); sel.e.add(ekey(f[i], f[(i + 1) % f.length])) }
    }
  }
  return sel
}

export function selectAll(m, sel, mode) {
  sel.clear()
  if (mode === 'face') m.f.forEach((_, i) => sel.f.add(i))
  else if (mode === 'edge') for (const k of m.edges().keys()) sel.e.add(k)
  else m.v.forEach((_, i) => sel.v.add(i))
  return normalize(m, sel, mode)
}
export function invert(m, sel, mode) {
  const n = new Sel()
  if (mode === 'face') m.f.forEach((_, i) => { if (!sel.f.has(i)) n.f.add(i) })
  else if (mode === 'edge') { for (const k of m.edges().keys()) if (!sel.e.has(k)) n.e.add(k) }
  else m.v.forEach((_, i) => { if (!sel.v.has(i)) n.v.add(i) })
  Object.assign(sel, n)
  return normalize(m, sel, mode)
}

/** Ampliar (Ctrl +) / reducir (Ctrl −) la selección. */
export function grow(m, sel, mode) {
  const nb = vertNeighbors(m)
  if (mode === 'vertex') {
    const add = new Set(sel.v)
    for (const v of sel.v) for (const w of nb[v]) add.add(w)
    sel.v = add
  } else if (mode === 'edge') {
    for (const [k, e] of m.edges()) if (sel.v.has(e.a) || sel.v.has(e.b)) sel.e.add(k)
  } else {
    m.f.forEach((f, fi) => { if (f.some((v) => sel.v.has(v))) sel.f.add(fi) })
  }
  return normalize(m, sel, mode)
}
export function shrink(m, sel, mode) {
  if (mode === 'vertex') {
    const nb = vertNeighbors(m)
    sel.v = new Set([...sel.v].filter((v) => [...nb[v]].every((w) => sel.v.has(w))))
  } else if (mode === 'edge') {
    const keep = new Set(sel.v)
    for (const [k, e] of m.edges()) if (!sel.e.has(k)) { keep.delete(e.a); keep.delete(e.b) }
    sel.e = new Set([...sel.e].filter((k) => keep.has(ekeyA(k)) && keep.has(ekeyB(k))))
  } else {
    const keep = new Set(sel.v)
    m.f.forEach((f, fi) => { if (!sel.f.has(fi)) for (const v of f) keep.delete(v) })
    sel.f = new Set([...sel.f].filter((fi) => m.f[fi].every((v) => keep.has(v))))
  }
  return normalize(m, sel, mode)
}

/** Selecciona todo lo conectado con la selección actual (L / Ctrl L). */
export function linked(m, sel, mode, seedVerts = null) {
  const nb = vertNeighbors(m)
  const seeds = seedVerts ? [...seedVerts] : [...sel.v]
  const seen = new Set(seeds)
  const stack = [...seeds]
  while (stack.length) { const v = stack.pop(); for (const w of nb[v]) if (!seen.has(w) && !m.hidden.has(w)) { seen.add(w); stack.push(w) } }
  if (mode === 'vertex') sel.v = seen
  else if (mode === 'edge') { for (const [k, e] of m.edges()) if (seen.has(e.a) && seen.has(e.b)) sel.e.add(k) }
  else m.f.forEach((f, fi) => { if (f.every((v) => seen.has(v))) sel.f.add(fi) })
  return normalize(m, sel, mode)
}

/** Componentes conexas de caras (por vértices compartidos). Devuelve lista de listas de caras. */
export function faceIslands(m) {
  const vf = vertFaces(m)
  const seen = new Uint8Array(m.f.length)
  const out = []
  for (let s = 0; s < m.f.length; s++) {
    if (seen[s]) continue
    const comp = [], stack = [s]
    seen[s] = 1
    while (stack.length) {
      const fi = stack.pop(); comp.push(fi)
      for (const v of m.f[fi]) for (const g of vf[v]) if (!seen[g]) { seen[g] = 1; stack.push(g) }
    }
    out.push(comp)
  }
  return out
}

/** Bucle de aristas a partir de una arista (Alt+clic). Devuelve el conjunto de claves de arista. */
export function edgeLoop(m, startKey) {
  const E = m.edges()
  const inc = m.v.map(() => [])
  for (const [k, e] of E) { inc[e.a].push(k); inc[e.b].push(k) }
  const out = new Set([startKey])
  const walk = (from, key) => {
    let v = from, cur = key, guard = 0
    while (guard++ < 100000) {
      const list = inc[v]
      const ce = E.get(cur)
      let next = null
      if (ce.faces.length === 1) { // arista de borde: seguir el borde
        const b = list.filter((k) => k !== cur && E.get(k).faces.length === 1)
        if (b.length === 1) next = b[0]
      } else if (list.length === 4) {
        const faceSet = new Set(ce.faces)
        const opp = list.filter((k) => k !== cur && !E.get(k).faces.some((f) => faceSet.has(f)))
        if (opp.length === 1) next = opp[0]
      }
      if (next == null || out.has(next)) break
      out.add(next)
      const ne = E.get(next)
      v = ne.a === v ? ne.b : ne.a
      cur = next
    }
  }
  const e0 = E.get(startKey)
  if (!e0) return out
  walk(e0.a, startKey)
  walk(e0.b, startKey)
  return out
}
