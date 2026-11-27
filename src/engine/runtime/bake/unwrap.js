// UV2 para lightmaps, determinista y sin DOM: agrupa triángulos en «charts» casi planos, los proyecta y los empaqueta.
// Entrada: posiciones y normales de una malla SIN índice (9 floats por triángulo), en metros.
// Salida: uv (2 floats por vértice, 0..1), size (lado del lightmap, potencia de 2) y estadísticas.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(a[0], a[1], a[2])

export function unwrapLightmap(pos, { density = 12, maxSize = 512, padding = 2, minSize = 16, angle = 30, scale = 1 } = {}) {
  const nTri = Math.floor(pos.length / 9)
  const tri = (t, k) => [pos[t * 9 + k * 3], pos[t * 9 + k * 3 + 1], pos[t * 9 + k * 3 + 2]]
  const nor = new Array(nTri), area = new Array(nTri)
  let totalArea = 0
  for (let t = 0; t < nTri; t++) {
    const a = tri(t, 0), b = tri(t, 1), c = tri(t, 2)
    const n = cross(sub(b, a), sub(c, a)), l = len(n)
    area[t] = l / 2; totalArea += area[t]
    nor[t] = l > 1e-12 ? [n[0] / l, n[1] / l, n[2] / l] : [0, 1, 0]
  }
  // vecinos por arista (vértices soldados por posición)
  const key = (p) => Math.round(p[0] * 1e4) + ',' + Math.round(p[1] * 1e4) + ',' + Math.round(p[2] * 1e4)
  const edges = new Map()
  for (let t = 0; t < nTri; t++) {
    const k = [key(tri(t, 0)), key(tri(t, 1)), key(tri(t, 2))]
    for (let e = 0; e < 3; e++) {
      const a = k[e], b = k[(e + 1) % 3], id = a < b ? a + '|' + b : b + '|' + a
      const arr = edges.get(id); if (arr) arr.push(t); else edges.set(id, [t])
    }
  }
  const nbr = Array.from({ length: nTri }, () => [])
  for (const arr of edges.values()) for (const t of arr) for (const u of arr) if (t !== u) nbr[t].push(u)
  // charts: crecimiento por normales parecidas a la del triángulo semilla
  const cosT = Math.cos(angle * Math.PI / 180), chart = new Int32Array(nTri).fill(-1), charts = []
  for (let s = 0; s < nTri; s++) {
    if (chart[s] >= 0) continue
    const id = charts.length, seed = nor[s], stack = [s], members = []
    chart[s] = id
    while (stack.length) {
      const t = stack.pop(); members.push(t)
      for (const u of nbr[t]) if (chart[u] < 0 && dot(nor[u], seed) >= cosT) { chart[u] = id; stack.push(u) }
    }
    // base tangente de la normal semilla
    const up = Math.abs(seed[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    let u = cross(up, seed); const ul = len(u) || 1; u = [u[0] / ul, u[1] / ul, u[2] / ul]
    const v = cross(seed, u)
    charts.push({ members, u, v, min: [Infinity, Infinity], max: [-Infinity, -Infinity], w: 0, h: 0, x: 0, y: 0 })
  }
  for (const c of charts) {
    for (const t of c.members) for (let k = 0; k < 3; k++) {
      const p = tri(t, k), x = dot(p, c.u), y = dot(p, c.v)
      if (x < c.min[0]) c.min[0] = x; if (y < c.min[1]) c.min[1] = y
      if (x > c.max[0]) c.max[0] = x; if (y > c.max[1]) c.max[1] = y
    }
    c.w = Math.max(1e-4, c.max[0] - c.min[0]); c.h = Math.max(1e-4, c.max[1] - c.min[1])
  }
  // empaquetado por estantes; si no cabe se baja la densidad
  const order = charts.map((_, i) => i).sort((a, b) => charts[b].h - charts[a].h || a - b)
  const pack = (d, side) => {
    let x = 0, y = 0, rowH = 0
    for (const i of order) {
      const c = charts[i], w = Math.max(1, Math.ceil(c.w * d)) + padding * 2, h = Math.max(1, Math.ceil(c.h * d)) + padding * 2
      if (w > side) return null
      if (x + w > side) { x = 0; y += rowH; rowH = 0 }
      if (y + h > side) return null
      c.x = x + padding; c.y = y + padding; c.pw = w - padding * 2; c.ph = h - padding * 2
      x += w; rowH = Math.max(rowH, h)
    }
    return true
  }
  let d = density * scale, side = minSize
  const guess = Math.sqrt(totalArea) * d * 1.25
  while (side < guess && side < maxSize) side *= 2
  let ok = false
  for (let iter = 0; iter < 60 && !ok; iter++) {
    ok = !!pack(d, side)
    if (!ok) { if (side < maxSize) side *= 2; else d *= 0.9 }
  }
  const uv = new Float32Array(nTri * 6)
  for (const c of charts) for (const t of c.members) for (let k = 0; k < 3; k++) {
    const p = tri(t, k)
    const px = c.x + (dot(p, c.u) - c.min[0]) * (c.pw / c.w), py = c.y + (dot(p, c.v) - c.min[1]) * (c.ph / c.h)
    uv[t * 6 + k * 2] = px / side; uv[t * 6 + k * 2 + 1] = py / side
  }
  return { uv, size: side, density: d, charts: charts.length, area: totalArea }
}

/** UV2 plana para el terreno: x,z dentro de la caja de la pieza → 0..1. */
export function planarLightmapUV(pos, min, max) {
  const n = pos.length / 3, uv = new Float32Array(n * 2), w = max[0] - min[0] || 1, h = max[1] - min[1] || 1
  for (let i = 0; i < n; i++) { uv[i * 2] = (pos[i * 3] - min[0]) / w; uv[i * 2 + 1] = (pos[i * 3 + 2] - min[1]) / h }
  return uv
}

/** Lado (potencia de 2) de un lightmap según el área y la densidad. */
export function lightmapSizeFor(area, density, maxSize = 512, minSize = 16) {
  let s = minSize; const want = Math.sqrt(area) * density * 1.25
  while (s < want && s < maxSize) s *= 2
  return s
}
