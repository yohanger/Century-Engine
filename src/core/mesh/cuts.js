// Anillos de aristas, corte de bucle (Ctrl R) y cuchillo por plano (K).
import { ekey, ekeyA, ekeyB, lerp3, dot, sub, len, cross } from '../../engine/runtime/mesh/polymesh.js'

/**
 * Anillo de aristas que atraviesa quads. Devuelve:
 *  edges: [{ key, s, t }]  arista con orientación coherente (s→t) a lo largo del anillo
 *  faces: caras quad recorridas, tail: caras no-quad / vecinas finales que reciben vértices por T-junction
 */
export function ringOf(m, startKey) {
  const E = m.edges()
  const e0 = E.get(startKey)
  if (!e0 || !e0.faces.length || e0.faces.length > 2) return null
  const start = { key: startKey, s: e0.a, t: e0.b }
  const seen = new Set([startKey])
  const faceSeen = new Set()
  const faces = [], tail = new Set()
  const walk = (face) => {
    const out = []
    let cur = start, f = face, guard = 0
    while (f != null && guard++ < 100000) {
      const loop = m.f[f]
      if (loop.length !== 4) { tail.add(f); break }
      if (faceSeen.has(f)) break
      let idx = -1
      for (let i = 0; i < 4; i++) if (ekey(loop[i], loop[(i + 1) % 4]) === cur.key) idx = i
      if (idx < 0) break
      faceSeen.add(f); faces.push(f)
      const a = loop[idx], b = loop[(idx + 1) % 4], c = loop[(idx + 2) % 4], d = loop[(idx + 3) % 4]
      const oppKey = ekey(c, d) // correspondencia a↔d, b↔c
      if (seen.has(oppKey)) break
      seen.add(oppKey)
      const ne = { key: oppKey, s: cur.s === a ? d : c, t: cur.t === a ? d : c }
      out.push(ne)
      cur = ne
      const fl = E.get(oppKey)?.faces || []
      f = fl.length === 2 ? (fl[0] === f ? fl[1] : fl[0]) : null
    }
    return out
  }
  const incident = e0.faces
  const fwd = incident.length ? walk(incident[0]) : []
  const back = incident.length > 1 ? walk(incident[1]) : []
  return { edges: [start, ...fwd, ...back], faces, tail: [...tail] }
}

/** Puntos de corte: lista de [posición A, posición B] por cada anillo-cara, para previsualizar el corte. */
export function loopCutLines(m, startKey, cuts = 1, slide = 0) {
  const ring = validLoopCutRing(m, startKey, cuts)
  if (!ring) return []
  const pos = cutParams(cuts, slide)
  const P = new Map()
  for (const e of ring.edges) P.set(e.key, pos.map((t) => lerp3(m.v[e.s], m.v[e.t], t)))
  const lines = []
  for (const fi of ring.faces) {
    const f = m.f[fi]
    const ks = []
    for (let i = 0; i < 4; i++) { const k = ekey(f[i], f[(i + 1) % 4]); if (P.has(k)) ks.push(k) }
    if (ks.length === 2) for (let j = 0; j < pos.length; j++) lines.push([P.get(ks[0])[j], P.get(ks[1])[j]])
  }
  return lines
}
/** Distancia máxima que puede desplazarse el grupo sin tocar los extremos. */
export function cutSlideLimit(cuts) {
  if (!Number.isInteger(cuts) || cuts < 1 || cuts > 32) return 0
  const step = 1 / (cuts + 1)
  return step - Math.min(0.02, step * 0.2)
}

/** Desplaza el grupo completo; limita el conjunto, no cada corte por separado. */
export function cutParams(cuts, slide = 0) {
  const limit = cutSlideLimit(cuts)
  if (!limit || !Number.isFinite(slide)) return []
  const step = 1 / (cuts + 1)
  const delta = Math.max(-1, Math.min(1, slide)) * limit
  return Array.from({ length: cuts }, (_, k) => (k + 1) * step + delta)
}

/** Anillo válido para Loop Cut: quads no degenerados y aristas con longitud positiva. */
export function validLoopCutRing(m, key, cuts = 1) {
  if (!cutSlideLimit(cuts)) return null
  const ring = ringOf(m, key)
  if (!ring?.faces.length) return null
  const sourceEdges = m.edges()
  for (const e of ring.edges) {
    const faces = sourceEdges.get(e.key)?.faces
    if (!faces?.length || faces.length > 2 || len(sub(m.v[e.s], m.v[e.t])) < 1e-7) return null
  }
  for (const fi of ring.faces) {
    const f = m.f[fi]
    if (f.length !== 4 || new Set(f).size !== 4) return null
    const [a, b, c, d] = f.map((i) => m.v[i])
    const area = len(cross(sub(b, a), sub(c, a))) + len(cross(sub(c, a), sub(d, a)))
    if (!Number.isFinite(area) || area < 1e-9) return null
  }
  return ring
}

/** Movimiento del ratón proyectado sobre la arista fijada (funciona en vista perspectiva y ortográfica). */
export function loopSlideFromScreen(start, now, a, b, cuts) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
  const limit = cutSlideLimit(cuts)
  if (!limit || !Number.isFinite(l2) || l2 < 64) return null
  const shift = ((now.x - start.x) * dx + (now.y - start.y) * dy) / l2
  return Math.max(-1, Math.min(1, shift / limit))
}

/** Inserta `cuts` bucles de aristas a lo largo del anillo de `startKey`. Devuelve {verts, edges} nuevos o null. */
export function loopCut(m, startKey, cuts = 1, slide = 0) {
  const ring = validLoopCutRing(m, startKey, cuts)
  if (!ring) return null
  const pos = cutParams(cuts, slide)
  if (pos.length !== cuts) return null
  const pts = new Map() // key → [{vi}] en orden s→t
  const ringInfo = new Map(ring.edges.map((e) => [e.key, e]))
  for (const e of ring.edges) pts.set(e.key, pos.map((t) => m.v.push(lerp3(m.v[e.s], m.v[e.t], t)) - 1))
  const newEdges = []
  const faceSet = new Set(ring.faces)
  const nf = []
  const insertOn = (loop) => {
    const out = []
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length]
      out.push(a)
      const k = ekey(a, b)
      const e = ringInfo.get(k)
      if (e) { const arr = pts.get(k); out.push(...(e.s === a ? arr : [...arr].reverse())) }
    }
    return out
  }
  for (let fi = 0; fi < m.f.length; fi++) {
    const loop = m.f[fi]
    if (!faceSet.has(fi)) {
      // caras que comparten una arista cortada pero no están en el anillo: solo reciben los vértices nuevos
      nf.push(loop.some((v, i) => ringInfo.has(ekey(v, loop[(i + 1) % loop.length]))) ? insertOn(loop) : loop)
      continue
    }
    // quad con dos aristas del anillo opuestas
    let idx = -1
    for (let i = 0; i < 4; i++) if (ringInfo.has(ekey(loop[i], loop[(i + 1) % 4])) && ringInfo.has(ekey(loop[(i + 2) % 4], loop[(i + 3) % 4]))) { idx = i; break }
    if (idx < 0) { nf.push(insertOn(loop)); continue }
    const a = loop[idx], b = loop[(idx + 1) % 4], c = loop[(idx + 2) % 4], d = loop[(idx + 3) % 4]
    const ab = ringInfo.get(ekey(a, b)), cd = ringInfo.get(ekey(c, d))
    const P = ab.s === a ? pts.get(ab.key) : [...pts.get(ab.key)].reverse() // de a → b
    const Q = cd.s === d ? pts.get(cd.key) : [...pts.get(cd.key)].reverse() // de d → c
    const A = [a, ...P, b], D = [d, ...Q, c]
    for (let j = 0; j < A.length - 1; j++) nf.push([A[j], A[j + 1], D[j + 1], D[j]])
    for (let j = 0; j < P.length; j++) newEdges.push(ekey(P[j], Q[j]))
  }
  m.f = nf
  return { verts: [...pts.values()].flat(), edges: newEdges }
}

/**
 * Corte por plano (cuchillo). Parte las caras cruzadas (o solo las de `faces`) por el plano que pasa por `p0` con normal `n`.
 * Devuelve {verts, edges} de la línea de corte, o null si no cortó nada.
 */
export function bisect(m, p0, n, faces = null, eps = 1e-5) {
  const d = m.v.map((p) => dot(sub(p, p0), n))
  const E = m.edges()
  const cross = new Map() // key → vértice nuevo
  const on = new Set()
  const target = faces ? (fi) => faces.has(fi) : () => true
  m.f.forEach((face, fi) => { if (target(fi)) for (const i of face) if (Math.abs(d[i]) <= eps) on.add(i) })
  const cutKeys = new Set()
  m.f.forEach((f, fi) => {
    if (!target(fi)) return
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length]
      if (on.has(a) || on.has(b)) continue
      if (d[a] * d[b] < 0) cutKeys.add(ekey(a, b))
    }
  })
  if (!cutKeys.size && !on.size) return null
  for (const k of cutKeys) {
    const a = ekeyA(k), b = ekeyB(k)
    cross.set(k, m.v.push(lerp3(m.v[a], m.v[b], d[a] / (d[a] - d[b]))) - 1)
  }
  const crossSet = new Set(cross.values())
  const outEdges = []
  const nf = []
  let did = false
  for (let fi = 0; fi < m.f.length; fi++) {
    const loop = m.f[fi]
    const full = []
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length]
      full.push(a)
      const k = ekey(a, b)
      if (cross.has(k)) full.push(cross.get(k))
    }
    if (!target(fi)) { nf.push(full.length === loop.length ? loop : full); continue }
    const idxs = []
    full.forEach((v, i) => { if (on.has(v) || crossSet.has(v)) idxs.push(i) })
    if (idxs.length !== 2) { nf.push(full); continue }
    const [i, j] = idxs
    if (j === i + 1 || (i === 0 && j === full.length - 1)) { nf.push(full); continue } // ya es una arista
    // deben quedar vértices a ambos lados con signos opuestos
    const A = full.slice(i, j + 1)
    const B = [...full.slice(j), ...full.slice(0, i + 1)]
    nf.push(A, B)
    outEdges.push(ekey(full[i], full[j]))
    did = true
  }
  m.f = nf
  if (!did) return null
  return { verts: [...cross.values(), ...on], edges: outEdges }
}
export const edgeLen = (m, k) => len(sub(m.v[ekeyA(k)], m.v[ekeyB(k)]))
