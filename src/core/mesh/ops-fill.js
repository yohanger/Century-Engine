// Operaciones de malla · rellenar, puente, normales, subdividir y triangular. Ver ops.js.
import { centroid } from './ops-join.js'
import {
  PolyMesh, ekey, ekeyA, ekeyB, sub, add, mul, dot, cross, norm, len, lerp3, dist, triangulateFace, signedVolume, validatePolygon,
} from '../../engine/runtime/mesh/polymesh.js'
import { normalize } from './sel.js'

import { setFromMode, fixLoop } from './ops-util.js'

// ---------- rellenar / puente ----------
function chains(m, keys, E) {
  const adj = new Map()
  for (const k of keys) { const a = ekeyA(k), b = ekeyB(k); if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push(b); adj.get(b).push(a) }
  const seen = new Set(), out = []
  for (const s of adj.keys()) {
    if (seen.has(s)) continue
    // componente
    const comp = [], st = [s]; seen.add(s)
    while (st.length) { const v = st.pop(); comp.push(v); for (const w of adj.get(v)) if (!seen.has(w)) { seen.add(w); st.push(w) } }
    const simple = comp.every((v) => adj.get(v).length <= 2)
    if (!simple) { out.push({ verts: comp, closed: false, simple: false }); continue }
    const ends = comp.filter((v) => adj.get(v).length === 1)
    const closed = ends.length === 0
    let cur = closed ? comp[0] : ends[0]
    const order = [cur], vis = new Set([cur])
    for (;;) { const nx = adj.get(cur).find((w) => !vis.has(w)); if (nx == null) break; order.push(nx); vis.add(nx); cur = nx }
    out.push({ verts: order, closed, simple: true })
  }
  void E
  return out
}
const dirVotes = (m, verts, closed) => {
  const faceDir = new Set(); for (const f of m.f) for (let i = 0; i < f.length; i++) faceDir.add(f[i] * 4194304 + f[(i + 1) % f.length])
  let fw = 0, bw = 0
  const n = closed ? verts.length : verts.length - 1
  for (let i = 0; i < n; i++) { const a = verts[i], b = verts[(i + 1) % verts.length]; if (faceDir.has(a * 4194304 + b)) fw++; if (faceDir.has(b * 4194304 + a)) bw++ }
  return fw - bw
}
/** Cierra una cadena de aristas sueltas desde uno de sus extremos, sin generar caras. */
export function closeContour(m, sel, mode) {
  if (mode !== 'vertex' || sel.v.size !== 1) return 'Selecciona un extremo de la cadena en modo Vértices'
  const start = [...sel.v][0]
  const adj = new Map()
  for (const [a, b] of m.we) {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a).add(b); adj.get(b).add(a)
  }
  if (adj.get(start)?.size !== 1) return 'Selecciona un extremo de una cadena abierta'
  const loop = [start], seen = new Set([start])
  let prev = null, cur = start
  for (;;) {
    if (adj.get(cur)?.size > 2) return 'La cadena contiene una bifurcación'
    const next = [...adj.get(cur)].find((v) => v !== prev)
    if (next === undefined) break
    if (seen.has(next)) return 'La cadena ya está cerrada o contiene un ciclo'
    loop.push(next); seen.add(next); prev = cur; cur = next
  }
  if (loop.length < 3) return 'Necesitas al menos tres vértices para cerrar el contorno'
  if (m.edges().has(ekey(start, cur))) return 'La arista de cierre ya existe'
  const error = validatePolygon(m, loop)
  if (error) return error
  m.we.push([cur, start])
  setFromMode(m, sel, 'vertex', { v: [start] })
}

export function fill(m, sel, mode) {
  const E = m.edges()
  let keys = [...sel.e].filter((k) => E.get(k)?.faces.length <= 1)
  let loops = []
  if (!keys.length) {
    const vs = [...sel.v]
    if (vs.length === 2) {
      if (E.has(ekey(vs[0], vs[1]))) return 'Los vértices ya están conectados'
      m.we.push([vs[0], vs[1]]); return
    }
    if (!vs.length) return 'Selecciona vértices o un bucle de aristas'
    // Con el extremo activo de PolyShape, Fill encuentra el bucle conectado sin seleccionar todos los puntos.
    const connected = new Set(vs)
    if (vs.length === 1) {
      let previousSize
      do {
        previousSize = connected.size
        for (const [a, b] of m.we) {
          if (connected.has(a)) connected.add(b)
          if (connected.has(b)) connected.add(a)
        }
      } while (connected.size !== previousSize)
    }
    const selectedWire = [...E].filter(([, ed]) => !ed.faces.length && connected.has(ed.a) && connected.has(ed.b)).map(([k]) => k)
    const found = selectedWire.length ? chains(m, selectedWire, E) : []
    if (found.length === 1 && found[0].closed && found[0].simple && found[0].verts.length === connected.size) loops = [found[0].verts]
    else if (selectedWire.length) return 'Selecciona un único contorno cerrado, sin ramas ni cadenas abiertas'
    else if (vs.length < 3) return 'Selecciona tres o más vértices, o un bucle de aristas'
    else {
      // Compatibilidad de Fill clásico con vértices independientes; el trazado con aristas es preferible.
      const c = centroid(m, vs)
      let N = [0, 0, 0], best = 0
      for (const v of vs) { const x = cross(sub(m.v[vs[0]], c), sub(m.v[v], c)); if (len(x) > best) { best = len(x); N = x } }
      N = norm(N)
      if (len(N) < 1e-9) return 'Los vértices están alineados'
      const u = norm(sub(m.v[vs[0]], c)), w = cross(N, u)
      vs.sort((a, b) => Math.atan2(dot(sub(m.v[a], c), w), dot(sub(m.v[a], c), u)) - Math.atan2(dot(sub(m.v[b], c), w), dot(sub(m.v[b], c), u)))
      loops = [vs]
    }
  } else {
    const parts = chains(m, keys, E)
    if (!parts.length || parts.some((ch) => !ch.closed || !ch.simple || ch.verts.length < 3)) return 'Selecciona bucles cerrados de aristas de borde, sin ramas'
    loops = parts.map((ch) => dirVotes(m, ch.verts, true) > 0 ? [...ch.verts].reverse() : ch.verts)
  }
  // Validar todas las caras antes de modificar nada; EditSession ejecuta esta operación en una transacción.
  for (const loop of loops) {
    const err = validatePolygon(m, loop)
    if (err) return err
    if (m.f.some((f) => f.length === loop.length && f.every((v) => loop.includes(v)))) return 'El contorno ya tiene una cara'
    const probe = m.f.length
    m.f.push(loop)
    const good = triangulateFace(m, probe).length === loop.length - 2
    m.f.pop()
    if (!good) return 'La triangulación del contorno no es válida'
  }
  const made = []
  for (const loop of loops) made.push(m.f.push(loop) - 1)
  setFromMode(m, sel, 'face', { f: made })
}

export function bridge(m, sel, mode, p = {}) {
  const E = m.edges()
  const keys = [...sel.e].filter((k) => E.get(k).faces.length <= 1)
  const lp = chains(m, keys, E).filter((c) => c.simple && c.verts.length >= 2)
  if (lp.length !== 2) return 'Selecciona exactamente dos bucles de aristas de borde'
  let [A, B] = lp
  const closed = A.closed && B.closed
  if (A.closed !== B.closed) return 'Los dos bucles deben ser ambos cerrados o ambos abiertos'
  let a = A.verts, b = B.verts
  const cost = (bb) => {
    const N = Math.max(a.length, bb.length)
    let best = Infinity, bo = 0
    const rots = closed ? bb.length : 1
    for (let o = 0; o < rots; o++) {
      let c = 0
      for (let i = 0; i <= N; i++) {
        const ia = Math.min(a.length - 1, Math.floor((i * a.length) / N)), ib = Math.min(bb.length - 1, Math.floor((i * bb.length) / N))
        const pa = m.v[a[ia % a.length]], pb = m.v[bb[(ib + o) % bb.length]]
        c += dist(pa, pb) ** 2
      }
      if (c < best) { best = c; bo = o }
    }
    return { best, bo }
  }
  const c1 = cost(b), c2 = cost([...b].reverse())
  let bo = c1.bo
  if (c2.best < c1.best) { b = [...b].reverse(); bo = c2.bo }
  b = closed ? [...b.slice(bo), ...b.slice(0, bo)] : b
  const N = closed ? Math.max(a.length, b.length) : Math.max(a.length, b.length) - 1
  const idxA = (i) => Math.min(a.length - 1, Math.floor((i * (closed ? a.length : a.length - 1)) / N + 1e-9))
  const idxB = (i) => Math.min(b.length - 1, Math.floor((i * (closed ? b.length : b.length - 1)) / N + 1e-9))
  const flip = dirVotes(m, a, closed) > 0
  const made = []
  for (let i = 0; i < N; i++) {
    const a0 = a[idxA(i) % a.length], a1 = a[idxA(i + 1) % a.length], b0 = b[idxB(i) % b.length], b1 = b[idxB(i + 1) % b.length]
    let q = flip ? [a1, a0, b0, b1] : [a0, a1, b1, b0]
    q = fixLoop(q)
    if (q.length < 3) continue
    m.f.push(q); made.push(m.f.length - 1)
  }
  if (!made.length) return 'No se pudo crear el puente'
  setFromMode(m, sel, mode === 'vertex' ? 'face' : mode, { f: made, e: [] })
  if (mode === 'edge') { const ks = new Set(); for (const fi of made) { const f = m.f[fi]; for (let i = 0; i < f.length; i++) ks.add(ekey(f[i], f[(i + 1) % f.length])) } sel.e = ks; normalize(m, sel, 'edge') }
  void p
}

// ---------- normales ----------
export function flipNormals(m, sel, mode) {
  const faces = sel.f.size ? [...sel.f] : m.f.map((_, i) => i)
  for (const fi of faces) m.f[fi] = [...m.f[fi]].reverse()
}
export function recalcNormals(m, sel, mode, inside = false) {
  const E = m.edges(), done = new Uint8Array(m.f.length)
  const scope = sel.f.size ? sel.f : null
  for (let s = 0; s < m.f.length; s++) {
    if (done[s] || (scope && !scope.has(s))) continue
    const comp = [], st = [s]; done[s] = 1
    while (st.length) {
      const fi = st.pop(); comp.push(fi); const f = m.f[fi]
      for (let i = 0; i < f.length; i++) {
        const a = f[i], b = f[(i + 1) % f.length]
        for (const gi of E.get(ekey(a, b)).faces) {
          if (gi === fi || done[gi] || (scope && !scope.has(gi))) continue
          const g = m.f[gi]
          for (let j = 0; j < g.length; j++) if (g[j] === a && g[(j + 1) % g.length] === b) { m.f[gi] = [...g].reverse(); break }
          done[gi] = 1; st.push(gi)
        }
      }
    }
    const vol = signedVolume(m, comp)
    if ((vol < 0) !== inside) for (const fi of comp) m.f[fi] = [...m.f[fi]].reverse()
  }
}

// ---------- subdividir / triangular ----------
export function subdivide(m, sel, mode, p = {}) {
  const cuts = Math.max(1, Math.min(16, Math.round(Number(p.cuts) || 1)))
  if (mode === 'face') {
    for (const fi of sel.f) {
      const f = m.f[fi]
      if (!f || f.length < 3) return 'La selección contiene caras inválidas'
      if (f.length <= 4) continue
      const normal = m.faceNormal(fi)
      if (len(normal) < 1e-8) return 'La cara seleccionada tiene normal degenerada'
      for (let i = 0; i < f.length; i++) {
        const a = m.v[f[i]], b = m.v[f[(i + 1) % f.length]], c = m.v[f[(i + 2) % f.length]]
        if (dot(cross(sub(b, a), sub(c, b)), normal) < -1e-8) return 'Subdividir N-gons cóncavos requiere una triangulación previa'
      }
    }
  }
  let keys = new Set(sel.e)
  if (mode === 'face') { keys = new Set(); for (const fi of sel.f) { const f = m.f[fi]; for (let i = 0; i < f.length; i++) keys.add(ekey(f[i], f[(i + 1) % f.length])) } }
  if (!keys.size) return 'Selecciona aristas o caras para subdividir'
  const existingEdges = m.edges()
  if ([...keys].some((key) => (existingEdges.get(key)?.faces.length ?? 0) > 2)) return 'No se puede subdividir una arista no manifold'
  const pts = new Map(), newVerts = []
  for (const k of keys) {
    const a = ekeyA(k), b = ekeyB(k), arr = []
    for (let i = 1; i <= cuts; i++) { arr.push(m.v.push(lerp3(m.v[a], m.v[b], i / (cuts + 1))) - 1); newVerts.push(arr[arr.length - 1]) }
    pts.set(k, arr)
  }
  const along = (a, b) => { const arr = pts.get(ekey(a, b)); return arr ? (a < b ? arr : [...arr].reverse()) : [] }
  const nf = [], selectedNewFaces = []
  for (let fi = 0; fi < m.f.length; fi++) {
    const f = m.f[fi]
    const start = nf.length
    const n = f.length
    const cutE = f.map((v, i) => pts.has(ekey(v, f[(i + 1) % n])))
    if (!cutE.some(Boolean)) { nf.push(f); if (mode === 'face' && sel.f.has(fi)) selectedNewFaces.push(start); continue }
    if (mode === 'face' && !sel.f.has(fi)) {
      const loop = []
      for (let i = 0; i < n; i++) loop.push(f[i], ...along(f[i], f[(i + 1) % n]))
      nf.push(loop)
      continue
    }
    const side = (i) => [f[i], ...along(f[i], f[(i + 1) % n]), f[(i + 1) % n]] // incluye extremos
    if (n === 4 && cutE.every(Boolean)) {
      const P0 = side(0), P1 = side(1), P2 = side(2), P3 = side(3), c = cuts + 1
      const G = (i, j) => {
        if (j === 0) return P0[i]; if (i === c) return P1[j]; if (j === c) return P2[c - i]; if (i === 0) return P3[c - j]
        const p = bil(m.v[f[0]], m.v[f[1]], m.v[f[2]], m.v[f[3]], i / c, j / c)
        const key = `${f.join('_')}:${i}:${j}`
        if (!G.cache) G.cache = new Map()
        if (!G.cache.has(key)) G.cache.set(key, m.v.push(p) - 1)
        return G.cache.get(key)
      }
      for (let j = 0; j < c; j++) for (let i = 0; i < c; i++) nf.push([G(i, j), G(i + 1, j), G(i + 1, j + 1), G(i, j + 1)])
      if (mode === 'face') for (let k = start; k < nf.length; k++) selectedNewFaces.push(k)
      continue
    }
    if (n === 4 && cutE[0] && cutE[2] && !cutE[1] && !cutE[3]) { stripFill(nf, side(0), side(2), cuts, f, 0); if (mode === 'face') for (let k = start; k < nf.length; k++) selectedNewFaces.push(k); continue }
    if (n === 4 && cutE[1] && cutE[3] && !cutE[0] && !cutE[2]) { stripFill(nf, side(1), side(3), cuts, f, 1); if (mode === 'face') for (let k = start; k < nf.length; k++) selectedNewFaces.push(k); continue }
    if (cutE.every(Boolean) && cuts === 1) {
      const c = m.v.push(centroid(m, f)) - 1
      const mids = f.map((v, i) => pts.get(ekey(v, f[(i + 1) % n]))[0])
      for (let i = 0; i < n; i++) nf.push([f[i], mids[i], c, mids[(i + n - 1) % n]])
      if (mode === 'face') for (let k = start; k < nf.length; k++) selectedNewFaces.push(k)
      continue
    }
    const loop = []
    for (let i = 0; i < n; i++) loop.push(f[i], ...along(f[i], f[(i + 1) % n]))
    const center = m.v.push(centroid(m, f)) - 1
    for (let i = 0; i < loop.length; i++) nf.push([loop[i], loop[(i + 1) % loop.length], center])
    if (mode === 'face') for (let k = start; k < nf.length; k++) selectedNewFaces.push(k)
  }
  m.f = nf
  if (mode === 'face') setFromMode(m, sel, 'face', { f: selectedNewFaces })
  else setFromMode(m, sel, mode, { v: [...sel.v, ...newVerts], e: [...sel.e] })
  if (mode === 'edge') { const E = m.edges(); sel.e = new Set([...E.keys()].filter((k) => { const a = ekeyA(k), b = ekeyB(k); return (sel.v.has(a) && sel.v.has(b)) }));  normalize(m, sel, 'edge') }
}
const bil = (a, b, c, d, u, v) => lerp3(lerp3(a, b, u), lerp3(d, c, u), v)
function stripFill(nf, P0, P2, cuts, f, rot) {
  const c = cuts + 1
  void f; void rot
  for (let k = 0; k < c; k++) nf.push([P0[k], P0[k + 1], P2[c - k - 1], P2[c - k]])
}
export function triangulateSel(m, sel, mode) {
  const faces = sel.f.size ? [...sel.f] : m.f.map((_, i) => i)
  const set = new Set(faces), nf = []
  m.f.forEach((f, fi) => { if (!set.has(fi) || f.length === 3) nf.push(f); else for (const t of triangulateFace(m, fi)) nf.push(t) })
  m.f = nf
  sel.clear()
}
