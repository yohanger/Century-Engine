// Agua · formas del objeto «Agua»: océano, lago, estanque circular y río, como mallas en espacio local. Ver water.js (olas) y watershader.js.
import * as THREE from 'three'
import { waterGrid, WATER_DEFAULTS } from './water.js'

// ---------------------------------------------------------------------------------------------
// Objeto «Agua»: formas (océano, lago, círculo, río). Mallas en espacio local, y = 0 (la altura es la del nodo).
// ---------------------------------------------------------------------------------------------
export const WATER_SHAPES = { ocean: 'Océano (enorme)', rect: 'Lago / piscina', circle: 'Estanque circular', river: 'Río (por puntos)' }

export const WATER_NODE_DEFAULTS = {
  shape: 'ocean',
  size: 4000, // océano: lado (m)
  width: 40, length: 40, // lago rectangular
  radius: 20, // estanque
  riverWidth: 8, // río
  points: [[-20, 0, 0], [0, 0, 0], [20, 0, 0]],
  closed: false, smooth: true,
  res: 1.5, // tamaño de celda (m) de lagos, estanques y ríos
  flowSpeed: 0, // corriente (m/s): empuja a quien nade o vadee. Río: a lo largo del cauce; el resto: hacia `flowDir`
  flowDir: 0, // grados (lagos, estanques y océano)
  ...Object.fromEntries(Object.entries(WATER_DEFAULTS).filter(([k]) => !['enabled', 'level', 'followTerrain', 'size', 'offsetX', 'offsetZ'].includes(k))),
}

export const normalizeWaterNode = (p = {}) => {
  const out = { ...WATER_NODE_DEFAULTS, ...p }
  out.points = (p.points?.length ? p.points : WATER_NODE_DEFAULTS.points).map((v) => [...v])
  return out
}

/** Claves que cambian la forma de la malla (el resto solo toca el material). */
export const waterGeoKey = (p) => JSON.stringify(p.shape === 'ocean' ? ['o', p.size]
  : p.shape === 'rect' ? ['r', p.width, p.length, p.res]
    : p.shape === 'circle' ? ['c', p.radius, p.res]
      : ['v', p.points, p.closed, p.smooth, p.riverWidth, p.res])

function gridRect(w, l, res) {
  const nx = Math.max(1, Math.min(250, Math.ceil(w / Math.max(0.25, res)))), nz = Math.max(1, Math.min(250, Math.ceil(l / Math.max(0.25, res))))
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3), normals = new Float32Array((nx + 1) * (nz + 1) * 3)
  let k = 0
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { positions[k] = (i / nx - 0.5) * w; positions[k + 2] = (j / nz - 0.5) * l; normals[k + 1] = 1; k += 3 }
  const indices = new Uint32Array(nx * nz * 6)
  let q = 0
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1
    indices[q++] = a; indices[q++] = c; indices[q++] = b; indices[q++] = b; indices[q++] = c; indices[q++] = d
  }
  return { positions, normals, indices }
}

function gridCircle(r, res) {
  const nr = Math.max(2, Math.min(120, Math.ceil(r / Math.max(0.25, res)))), ns = Math.max(16, Math.min(192, Math.ceil((2 * Math.PI * r) / Math.max(0.25, res))))
  const positions = [0, 0, 0], normals = [0, 1, 0], indices = []
  for (let i = 1; i <= nr; i++) for (let j = 0; j < ns; j++) {
    const a = (j / ns) * Math.PI * 2, rr = (i / nr) * r
    positions.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); normals.push(0, 1, 0)
  }
  const at = (i, j) => (i === 0 ? 0 : 1 + (i - 1) * ns + (j % ns))
  for (let j = 0; j < ns; j++) indices.push(0, at(1, j + 1), at(1, j)) // hacia +Y
  for (let i = 1; i < nr; i++) for (let j = 0; j < ns; j++) {
    const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j), d = at(i + 1, j + 1)
    indices.push(a, b, c, b, d, c)
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint32Array(indices) }
}

function gridRiver(p) {
  const pts = p.points.map((v) => new THREE.Vector3(...v))
  if (pts.length < 2) return { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0) }
  let curve
  if (p.smooth && pts.length > 2) curve = new THREE.CatmullRomCurve3(pts, p.closed, 'centripetal')
  else {
    curve = new THREE.CurvePath()
    for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
    if (p.closed && pts.length > 2) curve.add(new THREE.LineCurve3(pts[pts.length - 1], pts[0]))
  }
  const L = curve.getLength()
  if (!(L > 0.01)) return { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0) }
  curve.arcLengthDivisions = Math.max(200, Math.ceil(L * 4))
  curve.updateArcLengths?.()
  const res = Math.max(0.25, p.res)
  const N = Math.min(2000, Math.max(2, Math.ceil(L / res))), M = Math.min(60, Math.max(2, Math.ceil(p.riverWidth / res)))
  const positions = [], normals = [], flow = []
  for (let i = 0; i <= N; i++) {
    const u = i / N
    const P = curve.getPointAt(u), T = curve.getTangentAt(u)
    const tl = Math.hypot(T.x, T.z) || 1
    const rx = -T.z, rz = T.x, len = Math.hypot(rx, rz) || 1
    for (let j = 0; j <= M; j++) {
      const lat = (j / M - 0.5) * p.riverWidth
      positions.push(P.x + (rx / len) * lat, P.y, P.z + (rz / len) * lat); normals.push(0, 1, 0); flow.push(T.x / tl, T.z / tl)
    }
  }
  const indices = []
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1
    indices.push(a, b, c, b, d, c)
  }
  // orientación: normal hacia +Y
  const g = (k) => [positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]]
  const A = g(indices[0]), B = g(indices[1]), C = g(indices[2])
  const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2])
  if (ny < 0) for (let i = 0; i < indices.length; i += 3) { const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint32Array(indices), flow: new Float32Array(flow), length: L }
}

/** Malla del agua según su forma. Devuelve { positions, normals, indices } (sin UV: el shader usa coordenadas de mundo). */
export function waterShapeBuffers(props) {
  const p = normalizeWaterNode(props)
  switch (p.shape) {
    case 'rect': return gridRect(Math.max(0.5, p.width), Math.max(0.5, p.length), p.res)
    case 'circle': return gridCircle(Math.max(0.5, p.radius), p.res)
    case 'river': return gridRiver(p)
    default: return waterGrid(Math.max(10, p.size))
  }
}
