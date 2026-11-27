// Malla poligonal editable: vértices, caras de n lados y aristas sueltas. Sin dependencias del DOM ni de three.js,
// de modo que toda la lógica de edición se puede probar en Node.
//
// Convención: las caras se escriben en sentido antihorario visto desde fuera (normal = (b-a)×(c-a)), igual que three.js.

const M = 4194304 // 2^22: máximo de vértices por malla en las claves de arista
export const ekey = (a, b) => (a < b ? a * M + b : b * M + a)
export const ekeyA = (k) => Math.floor(k / M)
export const ekeyB = (k) => k % M

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const len = (a) => Math.hypot(a[0], a[1], a[2])
export const norm = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0] }
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const dist = (a, b) => len(sub(a, b))

export function meshGeometrySignature(mesh) {
  const r8 = (n) => Math.round(n * 1e8) / 1e8
  const r5 = (n) => Math.round(n * 1e5) / 1e5
  const text = JSON.stringify([
    mesh.v.map((v) => v.map(r8)), mesh.f, mesh.we, !!mesh.smooth,
    [...mesh.hidden].sort((a, b) => a - b),
    mesh.uv.map((f) => f.map((v) => v.map(r5))), mesh.seams,
    mesh.colors.map((v) => v.map(r5)), mesh.weights.map((v) => v.map(r5)),
  ])
  let a = 2166136261, b = 374761393
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 16777619)
    b = Math.imul(b ^ c, 2246822519)
  }
  return `${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`
}

function copyGenerator(source) {
  if (!source || typeof source.kind !== 'string' || !source.params || typeof source.params !== 'object' || typeof source.signature !== 'string') return null
  const params = {}
  for (const [key, value] of Object.entries(source.params)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    Object.defineProperty(params, key, { value, enumerable: true, writable: true, configurable: true })
  }
  return { kind: source.kind, params, signature: source.signature }
}

let REV = 1
/** Contador global: cada versión de una malla recibe un número distinto (sirve para saber cuándo reconstruir la geometría). */
export const nextRev = () => ++REV

export class PolyMesh {
  constructor(v = [], f = [], we = []) {
    this.v = v // [[x,y,z], …]
    this.f = f // [[i,j,k,…], …]
    this.we = we // aristas sueltas [[a,b], …] (sin cara)
    this.smooth = false
    this.hidden = new Set() // vértices ocultos (H)
    this.uv = [] // por cara y por esquina: admite costuras en vértices compartidos
    this.seams = [] // pares de vértices que delimitan islas UV
    this.colors = [] // RGB por vértice; datos reservados para Vertex Paint
    this.weights = [] // hasta ocho pesos por vértice; no activa todavía la mezcla de terreno
    this.generator = null
  }

  static fromJSON(j) {
    const v = []
    const flat = j.v || []
    for (let i = 0; i < flat.length; i += 3) v.push([flat[i], flat[i + 1], flat[i + 2]])
    const m = new PolyMesh(v, (j.f || []).map((a) => [...a]), (j.we || []).map((a) => [...a]))
    m.smooth = !!j.smooth
    m.hidden = new Set(j.h || [])
    m.uv = Array.isArray(j.uv) ? j.uv.map((face) => face.map((v) => [...v])) : []
    m.seams = Array.isArray(j.seams) ? j.seams.map((e) => [...e]) : []
    m.colors = Array.isArray(j.colors) ? j.colors.map((v) => [...v]) : []
    m.weights = Array.isArray(j.weights) ? j.weights.map((v) => [...v]) : []
    m.generator = copyGenerator(j.generator)
    m.validateAttributes()
    return m
  }

  /** Datos para guardar en el proyecto: vértices hasta 8 decimales; atributos heredados a 5. */
  toJSON() {
    const flat = []
    for (const p of this.v) flat.push(r8(p[0]), r8(p[1]), r8(p[2]))
    const j = { v: flat, f: this.f.map((a) => [...a]), we: this.we.map((a) => [...a]), smooth: this.smooth, rev: nextRev() }
    if (this.hidden.size) j.h = [...this.hidden]
    if (this.uv.length) j.uv = this.uv.map((f) => f.map((v) => v.map(r5)))
    if (this.seams.length) j.seams = this.seams.map((e) => [...e])
    if (this.colors.length) j.colors = this.colors.map((v) => v.map(r5))
    if (this.weights.length) j.weights = this.weights.map((v) => v.map(r5))
    if (this.generator) {
      if (!this.generator.signature) this.generator.signature = meshGeometrySignature(this)
      j.generator = copyGenerator(this.generator)
    }
    return j
  }

  clone() {
    const m = new PolyMesh(this.v.map((p) => [...p]), this.f.map((a) => [...a]), this.we.map((a) => [...a]))
    m.smooth = this.smooth
    m.hidden = new Set(this.hidden)
    m.uv = this.uv.map((f) => f.map((v) => [...v]))
    m.seams = this.seams.map((e) => [...e])
    m.colors = this.colors.map((v) => [...v])
    m.weights = this.weights.map((v) => [...v])
    m.generator = copyGenerator(this.generator)
    return m
  }

  /** Evita escribir datos corruptos en escenas antiguas o paquetes importados. */
  validateAttributes() {
    const validUV = this.uv.length === this.f.length && this.uv.every((loop, i) =>
      Array.isArray(loop) && loop.length === this.f[i].length && loop.every((v) =>
        Array.isArray(v) && v.length === 2 && v.every(Number.isFinite)))
    if (!validUV) this.uv = []
    this.seams = this.seams.filter((e) => Array.isArray(e) && e.length === 2 &&
      e.every((v) => Number.isInteger(v) && v >= 0 && v < this.v.length) && e[0] !== e[1])
    for (const [name, n] of [['colors', 3], ['weights', 8]]) {
      if (this[name].length && (this[name].length !== this.v.length ||
        !this[name].every((v) => Array.isArray(v) && v.length === n && v.every(Number.isFinite)))) this[name] = []
    }
  }

  /** UV automáticas para geometría heredada. Cada cara admite esquinas independientes. */
  ensureUV() {
    if (this.uv.length === this.f.length && this.uv.every((u, i) => u.length === this.f[i].length)) return
    this.uv = this.f.map((face, fi) => {
      const n = this.faceNormal(fi).map(Math.abs)
      const drop = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2
      const axis = drop === 0 ? [2, 1] : drop === 1 ? [0, 2] : [0, 1]
      return face.map((v) => [this.v[v][axis[0]], this.v[v][axis[1]]])
    })
  }

  /** Reconcilia UV y datos de pintura después de una operación topológica.
   * Mantiene exactas las esquinas que sobreviven; interpola las nuevas sobre la cara de origen.
   * Las caras laterales sin correspondencia usan proyección métrica, no UV inválidas.
   */
  reconcileAttributes(before) {
    // Solo recalcular si cambió la topología; una edición UV o transform geométrica
    // nunca debe sobrescribirse con los atributos de la copia anterior.
    const sameTopology = this.v.length === before.v.length && this.f.length === before.f.length &&
      this.f.every((f, i) => f.length === before.f[i].length && f.every((v, j) => v === before.f[i][j]))
    if (sameTopology) { this.validateAttributes(); return }
    const hasUV = before.uv.length === before.f.length
    const uv = []
    const sources = before.f.map((f, fi) => ({ f, uv: hasUV ? before.uv[fi] : null,
      pts: f.map((v) => before.v[v]) }))
    const interpolate = (p, source) => {
      const pts = source.pts, uvs = source.uv
      if (!uvs || !pts.length) return null
      for (let j = 1; j < pts.length - 1; j++) {
        const a = pts[0], b = pts[j], c = pts[j + 1]
        const e0 = sub(b, a), e1 = sub(c, a), d = sub(p, a)
        const aa = dot(e0, e0), ab = dot(e0, e1), bb = dot(e1, e1)
        const den = aa * bb - ab * ab
        if (Math.abs(den) < 1e-14) continue
        const x = (dot(d, e0) * bb - dot(d, e1) * ab) / den
        const y = (dot(d, e1) * aa - dot(d, e0) * ab) / den
        const offset = sub(d, add(mul(e0, x), mul(e1, y)))
        if (len(offset) > 1e-4 || x < -1e-4 || y < -1e-4 || x + y > 1.0001) continue
        return [0, 1].map((k) => uvs[0][k] * (1 - x - y) + uvs[j][k] * x + uvs[j + 1][k] * y)
      }
      return null
    }
    const currentUVValid = this.uv.length === this.f.length &&
      this.uv.every((loop, fi) => loop.length === this.f[fi].length)
    for (let fi = 0; fi < this.f.length; fi++) {
      const f = this.f[fi]
      if (currentUVValid && fi >= before.f.length) { uv.push(this.uv[fi].map((v) => [...v])); continue }
      if (hasUV && fi < before.f.length && f.length === before.f[fi].length &&
          f.every((v) => v >= before.v.length)) {
        uv.push(before.uv[fi].map((v) => [...v])); continue
      }
      let source = null
      if (hasUV) {
        source = sources.find((s) => f.every((v) => s.f.includes(v)) && s.f.length >= f.length)
        if (!source && before.f[fi] && before.f[fi].length === f.length) {
          const original = sources[fi]
          if (original && f.every((v) => original.f.includes(v))) source = original
        }
      }
      if (source) uv.push(f.map((v) => [...source.uv[source.f.indexOf(v)]]))
      else {
        const n = this.faceNormal(fi).map(Math.abs)
        const drop = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2
        const axis = drop === 0 ? [2, 1] : drop === 1 ? [0, 2] : [0, 1]
        uv.push(f.map((v) => {
          const p = this.v[v]
          if (hasUV) for (const s of sources) {
            const ix = s.f.indexOf(v)
            if (ix >= 0) return [...s.uv[ix]]
            const u = interpolate(p, s)
            if (u) return u
          }
          return [p[axis[0]], p[axis[1]]]
        }))
      }
    }
    if (hasUV) this.uv = uv
    const onSegment = (p, a, b) => {
      const ab = sub(b, a), ap = sub(p, a), den = dot(ab, ab)
      if (den < 1e-14) return dist(p, a) < 1e-6
      const t = dot(ap, ab) / den
      return t >= -1e-5 && t <= 1.00001 && dist(p, add(a, mul(ab, t))) < 1e-5
    }
    const appendedSeams = this.seams.filter(([a, b]) => a >= before.v.length && b >= before.v.length)
    const keepSeams = new Set(appendedSeams.map(([a, b]) => ekey(a, b)))
    this.seams = [...this.edges().values()].filter((e) => keepSeams.has(ekey(e.a, e.b)) || before.seams.some(([a, b]) =>
      onSegment(this.v[e.a], before.v[a], before.v[b]) &&
      onSegment(this.v[e.b], before.v[a], before.v[b]))).map((e) => [e.a, e.b])
    for (const [key, defaultValue] of [['colors', [1, 1, 1]], ['weights', [1, 0, 0, 0, 0, 0, 0, 0]]]) {
      if (!before[key].length) { this[key] = []; continue }
      const current = this[key].length === this.v.length ? this[key] : []
      this[key] = this.v.map((p, i) => {
        if (i >= before.v.length && current[i]) return [...current[i]]
        const match = before.v.findIndex((v) => dist(v, p) < 1e-7)
        if (match >= 0) return [...before[key][match]]
        if (i < before.v.length) return [...before[key][i]] // movimiento de vértice original
        // Para vértices nuevos, interpolar los datos sobre las caras anteriores.
        for (const old of sources) {
          const pts = old.pts
          for (let j = 1; j < pts.length - 1; j++) {
            const a = pts[0], b = pts[j], c = pts[j+1]
            const u = sub(b,a), v = sub(c,a), d = sub(p,a)
            const uu=dot(u,u), uv=dot(u,v), vv=dot(v,v), den=uu*vv-uv*uv
            if (Math.abs(den)<1e-14) continue
            const x=(dot(d,u)*vv-dot(d,v)*uv)/den, y=(dot(d,v)*uu-dot(d,u)*uv)/den
            if (x < -1e-5 || y < -1e-5 || x+y > 1.00001 ||
                len(sub(d,add(mul(u,x),mul(v,y))))>1e-5) continue
            return before[key][old.f[0]].map((n,k)=>n*(1-x-y)+before[key][old.f[j]][k]*x+before[key][old.f[j+1]][k]*y)
          }
        }
        let nearest = -1, d = Infinity
        before.v.forEach((v, j) => { const dj = dist(v, p); if (dj < d) { d = dj; nearest = j } })
        return nearest >= 0 ? [...before[key][nearest]] : [...defaultValue]
      })
    }
    this.validateAttributes()
  }

  /** Mapa clave → { a, b, faces:[índices de cara], wire:boolean }. */
  edges() {
    const E = new Map()
    this.f.forEach((f, fi) => {
      for (let i = 0; i < f.length; i++) {
        const a = f[i], b = f[(i + 1) % f.length]
        const k = ekey(a, b)
        let e = E.get(k)
        if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), faces: [], wire: false }; E.set(k, e) }
        e.faces.push(fi)
      }
    })
    for (const [a, b] of this.we) {
      const k = ekey(a, b)
      if (!E.has(k)) E.set(k, { a: Math.min(a, b), b: Math.max(a, b), faces: [], wire: true })
    }
    return E
  }

  /** Normal de una cara (método de Newell, sin normalizar → su módulo es el doble del área). */
  faceNormalRaw(fi) {
    const f = this.f[fi]
    let x = 0, y = 0, z = 0
    for (let i = 0; i < f.length; i++) {
      const p = this.v[f[i]], q = this.v[f[(i + 1) % f.length]]
      x += (p[1] - q[1]) * (p[2] + q[2])
      y += (p[2] - q[2]) * (p[0] + q[0])
      z += (p[0] - q[0]) * (p[1] + q[1])
    }
    return [x, y, z]
  }
  faceNormal(fi) { return norm(this.faceNormalRaw(fi)) }
  faceCenter(fi) {
    const f = this.f[fi]
    const c = [0, 0, 0]
    for (const i of f) { c[0] += this.v[i][0]; c[1] += this.v[i][1]; c[2] += this.v[i][2] }
    return mul(c, 1 / f.length)
  }
  faceHidden(fi) {
    if (!this.hidden.size) return false
    return this.f[fi].some((v) => this.hidden.has(v))
  }

  /** Normales por vértice (suma de normales de cara ponderadas por área). */
  vertexNormals() {
    const n = this.v.map(() => [0, 0, 0])
    this.f.forEach((f, fi) => {
      const fn = this.faceNormalRaw(fi)
      for (const i of f) { n[i][0] += fn[0]; n[i][1] += fn[1]; n[i][2] += fn[2] }
    })
    return n.map(norm)
  }

  bounds() {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]
    for (const p of this.v) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k] }
    return { min: mn, max: mx }
  }

  /** Quita vértices (y todo lo que los use). Devuelve el mapa índice viejo → nuevo (-1 si se eliminó). */
  removeVerts(kill) {
    const map = new Int32Array(this.v.length)
    const nv = []
    for (let i = 0; i < this.v.length; i++) {
      if (kill.has(i)) map[i] = -1
      else { map[i] = nv.length; nv.push(this.v[i]) }
    }
    this.v = nv
    const surviving = this.f.map((f, fi) => ({ f, fi })).filter(({ f }) => !f.some((i) => map[i] < 0))
    if (this.uv.length === this.f.length) this.uv = surviving.map(({ fi }) => this.uv[fi])
    this.f = surviving.map(({ f }) => f.map((i) => map[i]))
    for (const key of ['colors', 'weights']) if (this[key].length === map.length) this[key] = this[key].filter((_, i) => map[i] >= 0)
    this.seams = this.seams.filter(([a, b]) => map[a] >= 0 && map[b] >= 0).map(([a, b]) => [map[a], map[b]])
    this.we = this.we.filter(([a, b]) => map[a] >= 0 && map[b] >= 0).map(([a, b]) => [map[a], map[b]])
    if (this.hidden.size) this.hidden = new Set([...this.hidden].filter((i) => map[i] >= 0).map((i) => map[i]))
    return map
  }

  /** Elimina de la lista de candidatos los vértices que ya no usa ninguna cara ni arista suelta. */
  pruneLoose(cands) {
    const used = new Set()
    for (const f of this.f) for (const i of f) used.add(i)
    for (const [a, b] of this.we) { used.add(a); used.add(b) }
    const kill = new Set([...cands].filter((i) => !used.has(i)))
    return kill.size ? this.removeVerts(kill) : identityMap(this.v.length)
  }
}

export const identityMap = (n) => { const m = new Int32Array(n); for (let i = 0; i < n; i++) m[i] = i; return m }
const r5 = (x) => Math.round(x * 1e5) / 1e5
const r8 = (x) => Math.round(x * 1e8) / 1e8

/** Comprueba un contorno antes de crear una cara. No modifica la malla. */
export function validatePolygon(m, loop) {
  if (!Array.isArray(loop) || loop.length < 3 || loop.length > 4096) return 'El contorno requiere entre 3 y 4096 vértices'
  if (new Set(loop).size !== loop.length) return 'El contorno repite vértices'
  const pts = loop.map((i) => m.v[i])
  if (pts.some((p) => !Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite))) return 'El contorno contiene vértices inválidos'
  const extent = Math.max(1, ...[0, 1, 2].map((a) => Math.max(...pts.map((p) => p[a])) - Math.min(...pts.map((p) => p[a]))))
  const tol = 1e-6 * extent
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if (dist(pts[i], pts[j]) < tol) return 'El contorno contiene puntos coincidentes o demasiado próximos'
  }
  // Buscar un plano fiable incluso si Newell se anula por un cruce de aristas.
  let N = [0, 0, 0]
  for (let i = 1; i < pts.length - 1; i++) {
    const n = cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0]))
    if (len(n) > len(N)) N = n
  }
  if (len(N) < tol * tol) return 'El contorno tiene área degenerada'
  N = norm(N)
  if (pts.some((p) => Math.abs(dot(sub(p, pts[0]), N)) > tol)) return 'El contorno no es coplanar'
  const drop = Math.abs(N[0]) >= Math.abs(N[1]) && Math.abs(N[0]) >= Math.abs(N[2]) ? 0 : Math.abs(N[1]) >= Math.abs(N[2]) ? 1 : 2
  const P = pts.map((p) => drop === 0 ? [p[1], p[2]] : drop === 1 ? [p[0], p[2]] : [p[0], p[1]])
  const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const between = (a, b, p) => Math.min(a[0], b[0]) - tol <= p[0] && p[0] <= Math.max(a[0], b[0]) + tol && Math.min(a[1], b[1]) - tol <= p[1] && p[1] <= Math.max(a[1], b[1]) + tol
  const onSegment = (a, b, p) => Math.abs(orient(a, b, p)) <= tol * extent && between(a, b, p)
  const intersects = (a, b, c, d) => {
    const x = orient(a, b, c), y = orient(a, b, d), z = orient(c, d, a), w = orient(c, d, b)
    if (onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return true
    return (x > 0) !== (y > 0) && (z > 0) !== (w > 0)
  }
  let area = 0
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length
    area += P[i][0] * P[j][1] - P[j][0] * P[i][1]
    if (onSegment(P[i], P[j], P[(j + 1) % P.length])) return 'El contorno tiene tres vértices consecutivos alineados'
    for (let k = i + 1; k < P.length; k++) {
      const l = (k + 1) % P.length
      if (i === k || j === k || i === l) continue // segmentos vecinos comparten un extremo
      if (intersects(P[i], P[j], P[k], P[l])) return 'El contorno se autointerseca'
    }
  }
  if (Math.abs(area) < tol * tol) return 'El contorno tiene área degenerada'
  return null
}

// ---------------------------------------------------------------------------------------------
//  Triangulación (recorte de orejas) para caras cóncavas de n lados
// ---------------------------------------------------------------------------------------------
/** Triángulos [i,j,k] (índices de vértice de la malla) de una cara. */
export function triangulateFace(m, fi) {
  const f = m.f[fi]
  const n = f.length
  if (n === 3) return [[f[0], f[1], f[2]]]
  const nr = m.faceNormalRaw(fi)
  const ax = Math.abs(nr[0]), ay = Math.abs(nr[1]), az = Math.abs(nr[2])
  const drop = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2
  const pt = (i) => {
    const p = m.v[f[i]]
    const a = drop === 0 ? p[1] : p[0], b = drop === 2 ? p[1] : p[2]
    return [a, b] // la orientación del polígono proyectado se calcula después (ccw)
  }
  const P = Array.from({ length: n }, (_, i) => pt(i))
  const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  // orientación del polígono proyectado
  let tot = 0
  for (let i = 0; i < n; i++) tot += area2([0, 0], P[i], P[(i + 1) % n])
  const ccw = tot >= 0
  const idx = Array.from({ length: n }, (_, i) => i)
  const out = []
  let guard = 0
  while (idx.length > 3 && guard++ < n * n) {
    let clipped = false
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length]
      const a = P[i0], b = P[i1], c = P[i2]
      const ar = area2(a, b, c)
      if ((ccw ? ar : -ar) <= 1e-12) continue // vértice cóncavo o degenerado
      let inside = false
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue
        const p = P[j]
        const d1 = area2(a, b, p), d2 = area2(b, c, p), d3 = area2(c, a, p)
        const neg = d1 < -1e-12 || d2 < -1e-12 || d3 < -1e-12, pos = d1 > 1e-12 || d2 > 1e-12 || d3 > 1e-12
        if (!(neg && pos)) { inside = true; break }
      }
      if (inside) continue
      out.push([f[i0], f[i1], f[i2]])
      idx.splice(k, 1)
      clipped = true
      break
    }
    if (!clipped) break
  }
  if (idx.length === 3) out.push([f[idx[0]], f[idx[1]], f[idx[2]]])
  else return [] // nunca fabricar un abanico si falló el recorte de orejas
  return out
}

/** Triangula toda la malla. Devuelve { tris:[[a,b,c]…], faceOf:[fi…] } (omite caras ocultas si hideHidden). */
export function triangulate(m, hideHidden = true) {
  const tris = [], faceOf = []
  for (let fi = 0; fi < m.f.length; fi++) {
    if (hideHidden && m.faceHidden(fi)) continue
    for (const t of triangulateFace(m, fi)) { tris.push(t); faceOf.push(fi) }
  }
  return { tris, faceOf }
}

// ---------------------------------------------------------------------------------------------
//  Comprobaciones topológicas (usadas por las pruebas y por «recalcular normales»)
// ---------------------------------------------------------------------------------------------
/** Malla cerrada y consistente: cada arista de cara aparece exactamente dos veces, una en cada sentido. */
export function checkClosed(m) {
  const dir = new Map()
  const problems = []
  for (const f of m.f) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length]
      if (a === b) problems.push(`arista degenerada ${a}`)
      const k = a * M + b
      dir.set(k, (dir.get(k) || 0) + 1)
    }
  }
  for (const [k, c] of dir) {
    const a = Math.floor(k / M), b = k % M
    if (c > 1) problems.push(`arista ${a}→${b} usada ${c} veces en el mismo sentido`)
    if (!dir.has(b * M + a)) problems.push(`arista ${a}→${b} sin pareja (borde abierto)`)
  }
  return problems
}

export const eulerChar = (m) => {
  const used = new Set()
  for (const f of m.f) for (const i of f) used.add(i)
  let e = 0
  for (const [, ed] of m.edges()) if (ed.faces.length) e++
  return used.size - e + m.f.length
}

/** Volumen con signo (positivo si las normales apuntan hacia fuera). */
export function signedVolume(m, faces = null) {
  let vol = 0
  const list = faces || m.f.map((_, i) => i)
  for (const fi of list) {
    for (const [a, b, c] of triangulateFace(m, fi)) vol += dot(m.v[a], cross(m.v[b], m.v[c])) / 6
  }
  return vol
}
