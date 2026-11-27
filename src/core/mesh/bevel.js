// Biselado de aristas (Ctrl B) sobre mallas con aristas de dos caras.
//
// Idea: alrededor de cada vértice con aristas biseladas, el abanico de caras se parte en «sectores» (tramos entre
// aristas biseladas). Cada sector aporta puntos de desplazamiento (en una cara, en el cruce de dos biseles o sobre
// una arista vecina) y el resto de caras los incorporan a su contorno; entre ellos van las tiras del perfil y,
// en cada vértice, un tapón que rellena la esquina.
import { sub, add, mul, dot, cross, norm, len, lerp3, ekey, ekeyA, ekeyB } from '../../engine/runtime/mesh/polymesh.js'

const clampLen = (v, o, m, d, clampOverlap) => Math.min(d, (clampOverlap ? 0.45 : 0.95) * len(sub(m.v[o], m.v[v])))

export function bevel(m, keys, width, segs, profile = 0.5, clampOverlap = true) {
  const E = m.edges()
  let bev = new Set(keys.filter((k) => E.get(k)?.faces.length === 2 && E.get(k).faces[0] !== E.get(k).faces[1]))
  if (!bev.size || width <= 0) return null

  // ---- abanicos ----
  const vf = m.v.map(() => [])
  m.f.forEach((f, fi) => f.forEach((v, i) => vf[v].push({ fi, prev: f[(i + f.length - 1) % f.length], next: f[(i + 1) % f.length] })))
  const fanCache = new Map()
  const fanOf = (v) => {
    if (fanCache.has(v)) return fanCache.get(v)
    const list = vf[v]
    const byNext = new Map(list.map((c) => [c.next, c]))
    let fan = null
    if (byNext.size === list.length && new Set(list.map((c) => c.prev)).size === list.length) {
      const prevSet = new Set(list.map((c) => c.prev))
      const starts = list.filter((c) => !prevSet.has(c.next))
      let first = null, closed = false
      if (starts.length === 1) first = starts[0]
      else if (starts.length === 0) { first = list[0]; closed = true }
      if (first) {
        const order = [first]
        let cur = first, guard = 0
        while (guard++ < list.length + 2) {
          const nx = byNext.get(cur.prev)
          if (!nx) break
          if (nx === first) break
          order.push(nx); cur = nx
        }
        if (order.length === list.length) {
          const others = order.map((c) => c.next)
          others.push(closed ? order[0].next : order[order.length - 1].prev)
          fan = { faces: order, others, closed, m: order.length }
        }
      }
    }
    fanCache.set(v, fan)
    return fan
  }
  // vértices con problema → se descartan sus aristas
  for (const k of [...bev]) {
    for (const v of [ekeyA(k), ekeyB(k)]) { const fan = fanOf(v); if (!fan || (fan.closed && fan.m < 3)) bev.delete(k) }
  }
  if (!bev.size) return null
  const verts = new Set(); for (const k of bev) { verts.add(ekeyA(k)); verts.add(ekeyB(k)) }

  const pt = new Map()   // `${v}>${other}` → vértice sobre esa arista junto a v
  const cp = new Map()   // `${fi}:${v}` → lista de vértices que sustituyen a v en esa cara
  const sectorsOf = new Map() // v → [{ chain, endEdge(index of bevel edge after sector) }]
  const newPos = (p) => m.v.push(p) - 1
  const dirTo = (v, o) => norm(sub(m.v[o], m.v[v]))
  const angleSin = (v, a, b) => { const x = dirTo(v, a), y = dirTo(v, b); return Math.max(0.2, len(cross(x, y))) }
  const inN = (v, fi, o, towardsNext) => { // normal hacia dentro de la cara fi de la arista (v,o)
    const N = m.faceNormal(fi), d = sub(m.v[o], m.v[v])
    return norm(towardsNext ? cross(N, d) : mul(cross(N, d), -1))
  }

  for (const v of verts) {
    const fan = fanOf(v), mm = fan.m, oth = fan.others
    const ei = (i) => (fan.closed ? ((i % mm) + mm) % mm : i)
    const isB = (i) => bev.has(ekey(v, oth[ei(i)]))
    const B = []
    if (fan.closed) { for (let i = 0; i < mm; i++) if (isB(i)) B.push(i) } else { for (let i = 1; i < mm; i++) if (isB(i)) B.push(i) }
    const k = B.length
    const secs = []
    for (let a = 0; a < k; a++) {
      const start = B[a]
      let faces = []
      let gap = false
      if (fan.closed) {
        const end = B[(a + 1) % k]
        let i = start
        do { faces.push(i % mm); i = (i + 1) % mm } while (i !== end)
        if (k === 1) { /* vuelta completa: todas las caras */ }
      } else if (a < k - 1) {
        for (let i = start; i < B[a + 1]; i++) faces.push(i)
      } else {
        for (let i = start; i < mm; i++) faces.push(i)
        gap = true
        for (let i = 0; i < B[0]; i++) faces.push(i)
      }
      secs.push({ faces, gap, endEdge: fan.closed ? B[(a + 1) % k] : B[(a + 1) % k] })
    }
    const chains = []
    for (const s of secs) {
      const n = s.faces.length
      const i0 = s.faces[0], i1 = s.faces[n - 1]
      const f0 = fan.faces[i0].fi, f1 = fan.faces[i1].fi
      const edgeIdx = ei
      if (!s.gap && n === 1) {
        const o1 = oth[edgeIdx(i0)], o2 = oth[edgeIdx(i0 + 1)] // siguiente / anterior en el contorno de la cara
        const dq = inN(v, f0, o1, true), dp = inN(v, f0, o2, false)
        const mit = mul(add(dq, dp), width / Math.max(0.2, 1 + dot(dq, dp)))
        const w = newPos(add(m.v[v], mit))
        s.chain = [w]
        fan.faces[i0].S = [w]
      } else if (!s.gap && n === 2) {
        const oa = oth[edgeIdx(i0 + 1)] // arista compartida
        const d0 = width / angleSin(v, oth[edgeIdx(i0)], oa)
        const d1 = width / angleSin(v, oth[edgeIdx(i1)], oth[edgeIdx(i1 + 1)])
        const dd = clampLen(v, oa, m, (d0 + d1) / 2, clampOverlap)
        const M = newPos(add(m.v[v], mul(dirTo(v, oa), dd)))
        pt.set(`${v}>${oa}`, M)
        s.chain = [M]
      } else {
        const oa = oth[edgeIdx(i0 + 1)], ob = oth[edgeIdx(i1)]
        const A = newPos(add(m.v[v], mul(dirTo(v, oa), clampLen(v, oa, m, width / angleSin(v, oth[edgeIdx(i0)], oa), clampOverlap))))
        const Bp = newPos(add(m.v[v], mul(dirTo(v, ob), clampLen(v, ob, m, width / angleSin(v, ob, oth[edgeIdx(i1 + 1)]), clampOverlap))))
        pt.set(`${v}>${oa}`, A); pt.set(`${v}>${ob}`, Bp)
        s.chain = [A, v, Bp]
      }
      void f1; chains.push(s.chain)
    }
    sectorsOf.set(v, { secs, fan, B })
  }
  // ---- sustitución de esquinas por cara ----
  const ptOf = (v, o) => pt.get(`${v}>${o}`)
  for (const v of verts) {
    const { fan } = sectorsOf.get(v), mm = fan.m
    fan.faces.forEach((c, i) => {
      const nxt = c.next, prv = c.prev
      const bn = bev.has(ekey(v, nxt)), bp = bev.has(ekey(v, prv))
      let S
      if (bn && bp) S = c.S
      else if (bn) S = [ptOf(v, prv)]
      else if (bp) S = [ptOf(v, nxt)]
      else { S = []; const a = ptOf(v, prv), b = ptOf(v, nxt); if (a != null) S.push(a); S.push(v); if (b != null) S.push(b) }
      cp.set(`${c.fi}:${v}`, S)
    })
    void mm
  }
  const touched = new Set()
  for (const v of verts) for (const c of vf[v]) touched.add(c.fi)
  // vértices vecinos (extremos de aristas no biseladas con punto) también reescriben su cara: ya cubierto al estar en `verts`
  const oldFaces = m.f
  const newFaces = oldFaces.map((f, fi) => {
    if (!touched.has(fi)) return f
    const out = []
    for (const v of f) { const S = cp.get(`${fi}:${v}`); if (S) out.push(...S); else out.push(v) }
    return out
  })
  // ---- tiras de perfil ----
  const made = []
  const edgeW = new Map()
  const capOf = new Map() // `${v}|${edgeKey}` → curva en orden de tapón
  const dirFace = (a, b) => { for (const c of vf[b]) if (c.prev === a) return c.fi; return -1 } // cara que contiene a→b
  for (const k of bev) {
    const a = ekeyA(k), b = ekeyB(k)
    const Fa = dirFace(b, a), Fb = dirFace(a, b) // Fa contiene b→a (en el extremo v=a es F_j)
    if (Fa < 0 || Fb < 0) continue
    const nA = m.faceNormal(Fa), nB = m.faceNormal(Fb)
    const psi = Math.acos(Math.max(-1, Math.min(1, dot(nA, nB))))
    const w = Math.max(1e-3, Math.min(3, Math.cos(psi / 2) * (profile / 0.5)))
    const curve = (v, F1, F2) => {
      const P0 = cp.get(`${F1}:${v}`)[0], P1 = cp.get(`${F2}:${v}`)[0]
      const arr = [P0]
      const C = m.v[v], p0 = m.v[P0], p1 = m.v[P1]
      for (let i = 1; i < segs; i++) {
        const t = i / segs, u = 1 - t
        const den = u * u + 2 * w * t * u + t * t
        arr.push(newPos([0, 1, 2].map((q) => (u * u * p0[q] + 2 * w * t * u * C[q] + t * t * p1[q]) / den)))
      }
      arr.push(P1)
      return arr
    }
    // en el extremo a: F_j = cara que contiene b→a (Fa); en el extremo b: F_j = cara que contiene a→b (Fb)
    const capA = curve(a, Fa, Fb)
    const capB = curve(b, Fb, Fa)
    edgeW.set(k, w)
    capOf.set(`${a}|${k}`, capA); capOf.set(`${b}|${k}`, capB)
    const cuA = [...capB].reverse() // del lado Fa al lado Fb
    for (let i = 0; i < segs; i++) {
      newFaces.push([capA[i + 1], capA[i], cuA[i], cuA[i + 1]])
      made.push(newFaces.length - 1)
    }
  }
  // ---- tapones ----
  for (const v of verts) {
    const { secs, fan } = sectorsOf.get(v)
    const poly = []
    secs.forEach((s) => {
      poly.push(...s.chain)
      const kb = ekey(v, fan.others[fan.closed ? s.endEdge % fan.m : s.endEdge])
      const cv = capOf.get(`${v}|${kb}`)
      if (cv) poly.push(...cv.slice(1, -1))
    })
    const loop = []
    for (const x of poly) if (loop[loop.length - 1] !== x) loop.push(x)
    while (loop.length > 1 && loop[0] === loop[loop.length - 1]) loop.pop()
    if (loop.length < 3) continue
    // Dos perfiles coincidentes son una costura compartida, no un polígono:
    // sin soldar sus vértices, el tapón se triangula con área cero.
    if (secs.length === 2 && loop.length === 2 * segs) {
      const weld = []
      for (let i = 1; i < segs; i++) {
        const a = loop[i], b = loop[loop.length - i]
        if (len(sub(m.v[a], m.v[b])) > 1e-5) { weld.length = 0; break }
        weld.push([a, b])
      }
      if (weld.length === segs - 1) {
        for (const [a, b] of weld) for (const face of newFaces)
          for (let i = 0; i < face.length; i++) if (face[i] === b) face[i] = a
        continue
      }
    }
    // Si el embudo de una sola arista termina en una cara coplanar, la curva debe
    // sustituir la esquina de esa cara. Un tapón adicional solaparía la superficie.
    const incident = [...bev].filter((k) => ekeyA(k) === v || ekeyB(k) === v)
    if (fan.closed && incident.length === 1) {
      const adjacent = fan.faces.filter(({ prev, next }) =>
        !bev.has(ekey(v, prev)) && !bev.has(ekey(v, next)))
      if (adjacent.length === 1) {
        const fi = adjacent[0].fi, corner = cp.get(`${fi}:${v}`)
        const curve = capOf.get(`${v}|${incident[0]}`)
        const normal = m.faceNormal(fi), base = m.v[v]
        const coplanar = curve?.every((id) => Math.abs(dot(sub(m.v[id], base), normal)) < 1e-5)
        if (corner?.length === 3 && corner[1] === v && coplanar) {
          const path = curve[0] === corner[0] && curve[curve.length - 1] === corner[2]
            ? curve : curve[curve.length - 1] === corner[0] && curve[0] === corner[2]
              ? [...curve].reverse() : null
          if (path) {
            cp.set(`${fi}:${v}`, path)
            newFaces[fi] = oldFaces[fi].flatMap((id) => cp.get(`${fi}:${id}`) ?? [id])
            continue
          }
        }
      }
    }
    if (secs.length >= 3 && segs > 1 && loop.length > 4) {
      // esquina con varios segmentos: abanico hacia un centro abombado (parche redondeado en vez de un polígono cóncavo)
      let ws = 0, wn = 0
      for (const o of sectorsOf.get(v).fan.others) { const kk = ekey(v, o); if (edgeW.has(kk)) { ws += edgeW.get(kk); wn++ } }
      const w = wn ? ws / wn : 0.7
      const cen = [0, 0, 0]
      for (const x of loop) { cen[0] += m.v[x][0]; cen[1] += m.v[x][1]; cen[2] += m.v[x][2] }
      const k0 = 1 / loop.length, mv = m.v[v], t = w / (1 + w)
      const c = newPos([0, 1, 2].map((q) => cen[q] * k0 + (mv[q] - cen[q] * k0) * t))
      for (let i = 0; i < loop.length; i++) { newFaces.push([loop[i], loop[(i + 1) % loop.length], c]); made.push(newFaces.length - 1) }
    } else { newFaces.push(loop); made.push(newFaces.length - 1) }
  }
  m.f = newFaces
  m.pruneLoose(new Set(verts)) // los vértices originales que ya no usa ninguna cara desaparecen
  return { faces: made, edges: [] }
}
