// Carreteras: curva por puntos de control + sección transversal (asfalto, aceras/bermas, líneas).
// Una sola función genera la geometría para el editor, el juego y la exportación (mismas mallas).
import * as THREE from 'three'

export const MARK_STYLES = { none: 'Ninguna', solid: 'Continua', dashed: 'Discontinua', double: 'Doble continua', solidDashed: 'Continua + discontinua' }
export const LANE_STYLES = { none: 'Ninguna', dashed: 'Discontinua', solid: 'Continua' }
export const MARK_MODES = { paint: 'Pintada (plana)', raised: 'En relieve' }
export const ROAD_SLOTS = [
  ['asphalt', 'Asfalto'], ['center', 'Línea central'], ['lanes', 'Líneas de carril y borde'], ['side', 'Acera / berma'],
]

export const ROAD_DEFAULTS = {
  points: [[-12, 0, 0], [0, 0, 0], [12, 0, 0]],
  pw: [1, 1, 1], // multiplicador de ancho en cada punto de control (1 = ancho general)
  closed: false, smooth: true,
  width: 7, lanes: 2, thickness: 0.3,
  conform: true, crossSlope: true, smoothing: 3, lift: 0.05, step: 1,
  sidewalks: false, sideWidth: 1.6, curbHeight: 0.15, sideLeft: true, sideRight: true,
  centerStyle: 'double', laneStyle: 'dashed', edgeLines: true, edgeInset: 0.25,
  markWidth: 0.15, markGap: 0.12, dashLen: 3, dashGap: 5,
  markMode: 'paint', markHeight: 0.08,
  slots: {
    asphalt: { color: '#2f3033', roughness: 0.92, texture: null, tile: 6, emissive: 0, tintEnabled: null },
    center: { color: '#e6b422', roughness: 0.6, texture: null, tile: 3, emissive: 0, tintEnabled: null },
    lanes: { color: '#e8e8e2', roughness: 0.6, texture: null, tile: 3, emissive: 0, tintEnabled: null },
    side: { color: '#8e8e88', roughness: 0.9, texture: null, tile: 4, emissive: 0, tintEnabled: null },
  },
}

/** Completa propiedades que falten (proyectos antiguos / valores parciales). */
export function normalizeRoad(p = {}) {
  const d = ROAD_DEFAULTS
  const out = { ...d, ...p, points: (p.points?.length ? p.points : d.points).map((v) => [...v]) }
  out.pw = out.points.map((_, i) => (Number.isFinite(p.pw?.[i]) && p.pw[i] > 0 ? p.pw[i] : 1))
  out.slots = {}
  for (const [k] of ROAD_SLOTS) out.slots[k] = { ...d.slots[k], ...(p.slots?.[k] || {}) }
  return out
}

/** Una textura sin tinte usa blanco: su color no se multiplica por el color predeterminado. */
export function roadTintEnabled(slot, key) {
  if (typeof slot.tintEnabled === 'boolean') return slot.tintEnabled
  // Compatibilidad: un color personalizado antiguo sigue actuando como tinte.
  return !!slot.texture && String(slot.color).toLowerCase() !== ROAD_DEFAULTS.slots[key].color
}
export function roadSurfaceColor(slot, key) {
  return slot.texture && !roadTintEnabled(slot, key) ? '#ffffff' : slot.color
}

// claves que cambian la forma (no solo el material) → regenerar malla
export const roadGeoKey = (p) => JSON.stringify([p.points, p.pw, p.closed, p.smooth, p.width, p.lanes, p.thickness, p.conform, p.crossSlope, p.smoothing, p.lift, p.step, p.sidewalks, p.sideWidth, p.curbHeight, p.sideLeft, p.sideRight, p.centerStyle, p.laneStyle, p.edgeLines, p.edgeInset, p.markWidth, p.markGap, p.dashLen, p.dashGap, p.markMode, p.markHeight, p.slots.asphalt.tile, p.slots.center.tile, p.slots.lanes.tile, p.slots.side.tile])

class Part {
  constructor() { this.pos = []; this.uv = []; this.paintUv = []; this.idx = [] }
  get empty() { return !this.idx.length }
  /** Malla de cuadriláteros entre filas consecutivas (cada fila: una muestra por fotograma). rows: [[{p:[x,y,z], u, v}...], ...] */
  grid(rows, w2, f) {
    const want = new THREE.Vector3(w2[0] * f.rx, w2[1], w2[0] * f.rz)
    const base = this.pos.length / 3
    const n = rows[0].length, R = rows.length
    if (n < 2 || R < 2) return
    for (const r of rows) for (let i = 0; i < n; i++) { this.pos.push(...r[i].p); this.uv.push(r[i].u, r[i].v); this.paintUv.push(...(r[i].paintUv || [0, 0])) }
    const A0 = new THREE.Vector3(...rows[0][0].p), B0 = new THREE.Vector3(...rows[1][0].p), A1 = new THREE.Vector3(...rows[0][1].p)
    const flip = B0.clone().sub(A0).cross(A1.clone().sub(A0)).dot(want) < 0
    for (let r = 0; r < R - 1; r++) for (let i = 0; i < n - 1; i++) {
      const a0 = base + r * n + i, a1 = a0 + 1, b0 = base + (r + 1) * n + i, b1 = b0 + 1
      if (flip) this.idx.push(a0, a1, b0, a1, b1, b0)
      else this.idx.push(a0, b0, a1, a1, b0, b1)
    }
  }
  strip(a, b, w2, f) { this.grid([a, b], w2, f) }
  buffers() {
    if (this.empty) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setIndex(this.idx)
    g.computeVertexNormals()
    const out = { positions: new Float32Array(g.attributes.position.array), normals: new Float32Array(g.attributes.normal.array), uvs: new Float32Array(this.uv), paintUvs: new Float32Array(this.paintUv), indices: new Uint32Array(this.idx) }
    g.dispose()
    return out
  }
}

/**
 * Genera las mallas de la carretera en el espacio local del nodo.
 * ctx: { heightAt(x,z)→y mundo, world: Matrix4 (nodo → mundo) } — solo hace falta si p.conform.
 * La calzada es una rejilla (a lo largo × a lo ancho): cada vértice toma la altura del terreno bajo él,
 * así la carretera se amolda a pendientes, lomas y laderas. Devuelve { asphalt, center, lanes, side } y `collision`.
 */
export function buildRoad(props, ctx = {}) {
  const p = normalizeRoad(props)
  const pts = p.points.map((v) => new THREE.Vector3(...v))
  const out = { asphalt: null, center: null, lanes: null, side: null, length: 0, collision: [] }
  if (pts.length < 2) return out
  let curve
  if (p.smooth && pts.length > 2) curve = new THREE.CatmullRomCurve3(pts, p.closed, 'centripetal')
  else {
    curve = new THREE.CurvePath()
    for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
    if (p.closed && pts.length > 2) curve.add(new THREE.LineCurve3(pts[pts.length - 1], pts[0]))
  }
  const L = curve.getLength()
  if (!(L > 0.01)) return out
  curve.arcLengthDivisions = Math.max(200, Math.ceil(L * 4))
  curve.updateArcLengths?.()
  out.length = L

  const world = ctx.world || new THREE.Matrix4()
  const inv = world.clone().invert()
  const tmp = new THREE.Vector3()
  const conform = !!(p.conform && ctx.heightAt)
  const closed = !!(p.closed && pts.length > 2)

  // ---- ancho variable: multiplicador por punto de control, interpolado a lo largo del trazado ----
  const nP = pts.length
  const chord = [0]
  for (let i = 1; i < (closed ? nP + 1 : nP); i++) chord.push(chord[i - 1] + pts[i % nP].distanceTo(pts[i - 1]))
  const stations = chord.map((c) => (c / chord[chord.length - 1]) * L)
  const pwAt = (s) => {
    if (p.pw.every((v) => v === p.pw[0])) return p.pw[0]
    let i = 0
    while (i < stations.length - 2 && s > stations[i + 1]) i++
    const t = (s - stations[i]) / Math.max(1e-6, stations[i + 1] - stations[i])
    const k = Math.min(1, Math.max(0, t)); const e = k * k * (3 - 2 * k)
    return p.pw[i % nP] * (1 - e) + p.pw[(i + 1) % nP] * e
  }
  const halfAt = (s) => (p.width * pwAt(s)) / 2
  const maxW = p.width * Math.max(...p.pw)

  function frame(s) {
    const u = Math.min(1, Math.max(0, s / L))
    const P = curve.getPointAt(u)
    const T = curve.getTangentAt(u)
    const right = new THREE.Vector3(-T.z, 0, T.x)
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
    right.normalize()
    return { x: P.x, yc: P.y + p.lift, z: P.z, rx: right.x, rz: right.z, s, half: halfAt(s) }
  }
  // altura local de la superficie en (x,z): la del terreno bajo ese punto + elevación
  const ground = (x, yc, z) => {
    tmp.set(x, yc, z).applyMatrix4(world)
    const h = ctx.heightAt(tmp.x, tmp.z)
    if (!Number.isFinite(h)) return NaN // sin terreno bajo este punto (hueco entre piezas)
    tmp.y = h + p.lift
    return tmp.applyMatrix4(inv).y
  }
  // Donde no hay terreno la carretera hace de puente: rampa lineal entre las alturas de ambos lados
  const bridge = (a) => {
    let first = -1, last = -1
    for (let i = 0; i < a.length; i++) if (!Number.isNaN(a[i])) { if (first < 0) first = i; last = i }
    if (first < 0) { for (let i = 0; i < a.length; i++) a[i] = frames[i].yc; return a }
    for (let i = 0; i < first; i++) a[i] = a[first]
    for (let i = last + 1; i < a.length; i++) a[i] = a[last]
    for (let i = first + 1; i < last; i++) {
      if (!Number.isNaN(a[i])) continue
      let j = i
      while (Number.isNaN(a[j])) j++
      const y0 = a[i - 1], y1 = a[j], n = j - i + 1
      for (let k = i; k < j; k++) a[k] = y0 + ((y1 - y0) * (k - i + 1)) / n
      i = j
    }
    return a
  }

  // ---- muestras a lo largo ----
  const N = Math.max(2, Math.ceil(L / Math.max(0.25, p.step)))
  const frames = []
  for (let i = 0; i <= N; i++) frames.push(frame((L * i) / N))
  if (closed) { Object.assign(frames[N], { ...frames[0], s: L }) } // cierra la vuelta exactamente
  const dS = L / N

  // suavizado longitudinal (media móvil) de una fila de alturas
  const R = conform ? Math.round(Math.max(0, p.smoothing) / 2 / dS) : 0
  const smoothRow = (a) => {
    if (R < 1) return a
    const o = new Float32Array(a.length)
    for (let i = 0; i <= N; i++) {
      let sum = 0, c = 0
      for (let k = -R; k <= R; k++) {
        let j = i + k
        if (closed) j = ((j % N) + N) % N
        else if (j < 0 || j > N) continue
        sum += a[j]; c++
      }
      o[i] = sum / c
    }
    return o
  }
  // alturas por fila lateral. lats(f,j) → desplazamiento lateral; cross=false → altura del eje en todo el ancho
  const heightRow = (latOf, cross, extra = 0) => {
    const a = new Float32Array(N + 1)
    for (let i = 0; i <= N; i++) {
      const f = frames[i]
      if (!conform) { a[i] = f.yc + extra; continue }
      const lat = cross ? latOf(f) : 0
      a[i] = ground(f.x + f.rx * lat, f.yc, f.z + f.rz * lat) + extra
    }
    return smoothRow(bridge(a))
  }

  // ---- calzada: rejilla ----
  const nA = Math.max(1, Math.min(60, Math.ceil(maxW / 1)))
  const lateralAsph = (j) => (f) => -f.half + (2 * f.half * j) / nA
  const H = []
  for (let j = 0; j <= nA; j++) H.push(heightRow(lateralAsph(j), p.crossSlope))
  const mkRow = (lat, ys, tile, surface = 'asphalt') => frames.map((f, i) => {
    const l = lat(f)
    // UV independiente de la repetición del material. Mantiene los trazos al cambiar tile.
    const x = surface === 'side' ? (l < 0
      ? (l + f.half + p.sideWidth) / (2 * p.sideWidth)
      : .5 + (l - f.half) / (2 * p.sideWidth)) : (l + f.half) / Math.max(.01, 2 * f.half)
    return { p: [f.x + f.rx * l, ys[i], f.z + f.rz * l], u: (l + f.half) / tile, v: f.s / tile,
      paintUv: [Math.max(0, Math.min(1, x)), f.s / L] }
  })
  const tA = p.slots.asphalt.tile, tS = p.slots.side.tile

  const asphalt = new Part(), side = new Part(), center = new Part(), lanes = new Part()
  asphalt.grid(H.map((ys, j) => mkRow(lateralAsph(j), ys, tA)), [0, 1], frames[0])
  // faldones laterales (esconden huecos entre el borde y el terreno)
  const lowered = (ys, d) => ys.map((y) => y - d)
  for (const [sg, j] of [[-1, 0], [1, nA]]) asphalt.grid([mkRow(lateralAsph(j), H[j], tA), mkRow(lateralAsph(j), lowered(H[j], p.thickness), tA)], [sg, 0], frames[0])

  // ---- aceras (opcionales) ----
  if (p.sidewalks && p.sideWidth > 0.01) {
    const ch = Math.max(0, p.curbHeight)
    const nS = Math.max(1, Math.min(12, Math.ceil(p.sideWidth)))
    for (const sg of [-1, 1]) {
      if (!(sg < 0 ? p.sideLeft : p.sideRight)) continue
      const edge = H[sg < 0 ? 0 : nA]
      const latK = (k) => (f) => sg * (f.half + (p.sideWidth * k) / nS)
      const rowsTop = []
      for (let k = 0; k <= nS; k++) rowsTop.push(k === 0 ? edge.map((y) => y + ch) : heightRow(latK(k), p.crossSlope, ch))
      if (ch > 0.001) side.grid([mkRow(latK(0), edge, tS, 'side'), mkRow(latK(0), rowsTop[0], tS, 'side')], [-sg, 0], frames[0]) // cara del bordillo
      side.grid(rowsTop.map((ys, k) => mkRow(latK(k), ys, tS, 'side')), [0, 1], frames[0])
      side.grid([mkRow(latK(nS), rowsTop[nS], tS, 'side'), mkRow(latK(nS), lowered(rowsTop[nS], p.thickness + ch), tS, 'side')], [sg, 0], frames[0])
    }
  }

  // altura de la calzada en (s, lat) por interpolación de la rejilla → las líneas quedan justo encima
  const surfY = (s, lat, half) => {
    const fi = Math.min(N - 1e-6, Math.max(0, s / dS)), i0 = Math.floor(fi), ti = fi - i0
    const fj = Math.min(nA, Math.max(0, ((lat + half) / (2 * half)) * nA)), j0 = Math.min(nA - 1, Math.floor(fj)), tj = fj - j0
    const g = (j, i) => H[j][i]
    const a = g(j0, i0) * (1 - ti) + g(j0, i0 + 1) * ti
    const b = g(j0 + 1, i0) * (1 - ti) + g(j0 + 1, i0 + 1) * ti
    return a * (1 - tj) + b * tj
  }

  // ---- líneas ----
  const raised = p.markMode === 'raised'
  const mh = raised ? Math.max(0.01, p.markHeight) : 0.025
  const mw = Math.max(0.02, p.markWidth)
  const ribbon = (part, tile, latOf, fr) => {
    const rw = (d, dy) => fr.map((f) => { const l = latOf(f) + d; return { p: [f.x + f.rx * l, surfY(f.s, Math.max(-f.half, Math.min(f.half, l)), f.half) + dy, f.z + f.rz * l], u: (l + f.half) / tile, v: f.s / tile } })
    part.strip(rw(-mw / 2, mh), rw(mw / 2, mh), [0, 1], fr[0])
    if (raised) {
      part.strip(rw(-mw / 2, 0), rw(-mw / 2, mh), [-1, 0], fr[0])
      part.strip(rw(mw / 2, mh), rw(mw / 2, 0), [1, 0], fr[0])
    }
  }
  const line = (part, tile, latOf, dashed) => {
    if (!dashed) return ribbon(part, tile, latOf, frames)
    const period = Math.max(0.2, p.dashLen + p.dashGap)
    for (let s0 = 0; s0 < L - 0.05; s0 += period) {
      const s1 = Math.min(L, s0 + p.dashLen)
      if (s1 - s0 < 0.05) continue
      const n = Math.max(1, Math.ceil((s1 - s0) / Math.max(0.25, p.step)))
      const fr = []
      for (let i = 0; i <= n; i++) fr.push(frame(s0 + ((s1 - s0) * i) / n))
      ribbon(part, tile, latOf, fr)
    }
  }
  const tC = p.slots.center.tile, tL = p.slots.lanes.tile
  const nLanes = Math.max(1, Math.round(p.lanes))
  const gap = p.markGap + mw
  for (let k = 1; k < nLanes; k++) {
    const lat = (d = 0) => (f) => -f.half + (2 * f.half * k) / nLanes + d
    const isCenter = nLanes % 2 === 0 && k === nLanes / 2
    if (isCenter) {
      switch (p.centerStyle) {
        case 'solid': line(center, tC, lat(), false); break
        case 'dashed': line(center, tC, lat(), true); break
        case 'double': line(center, tC, lat(-gap / 2), false); line(center, tC, lat(gap / 2), false); break
        case 'solidDashed': line(center, tC, lat(-gap / 2), false); line(center, tC, lat(gap / 2), true); break
        default: break
      }
    } else if (p.laneStyle !== 'none') line(lanes, tL, lat(), p.laneStyle === 'dashed')
  }
  if (p.edgeLines) for (const sg of [-1, 1]) line(lanes, tL, (f) => sg * Math.max(0, f.half - p.edgeInset - mw / 2), false)

  out.asphalt = asphalt.buffers(); out.side = side.buffers(); out.center = center.buffers(); out.lanes = lanes.buffers()
  // colisión: superficies transitables (asfalto + aceras), sin líneas
  for (const b of [out.asphalt, out.side]) {
    if (!b) continue
    for (let i = 0; i < b.indices.length; i++) { const k = b.indices[i] * 3; out.collision.push(b.positions[k], b.positions[k + 1], b.positions[k + 2]) }
  }
  return out
}
