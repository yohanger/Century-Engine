// Generadores de mallas base (tamaño real, centradas en el origen, caras antihorarias hacia fuera).
import { PolyMesh, signedVolume, checkClosed } from './polymesh.js'

/** El mismo rango gobierna la primitiva, Edit Mesh y los exportadores. */
export function normalizeStairSteps(value) {
  const n = Number(value ?? 8)
  return Number.isFinite(n) ? Math.max(2, Math.min(64, Math.floor(n))) : 8
}

/** Giro en grados, limitado al rango del Inspector. Cero conserva la forma recta. */
export function normalizeStairTurn(value) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.max(-90, Math.min(90, n)) : 0
}

/** Un giro es viable si el radio interior de la escalera sigue siendo positivo. */
export function validStairTurn(turn, width, length) {
  const a = Math.abs(Number(turn)) * Math.PI / 180
  return Number.isFinite(a) && a <= Math.PI / 2 &&
    Number.isFinite(width) && Number.isFinite(length) && width > 0 && length > 0 &&
    (a === 0 || length / a > width / 2 + 1e-5)
}

/** Si una escena antigua tiene parámetros inválidos, vuelve a la forma recta sin romper el Player. */
export function effectiveStairTurn(value, width, length) {
  const a = normalizeStairTurn(value)
  return validStairTurn(a, Math.abs(width), Math.abs(length)) ? a : 0
}

/** Parapetos: unidades métricas, sin alterar la escalera de proyectos anteriores. */
export function stairSideOptions(props = {}) {
  const sides = ['none', 'left', 'right', 'both'].includes(props?.sides) ? props.sides : 'none'
  const limit = (value, fallback, min, max) => {
    const n = Number(value ?? fallback)
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
  }
  return { sides, sideHeight: limit(props?.sideHeight, 1, 0.1, 5), sideThickness: limit(props?.sideThickness, 0.15, 0.05, 2) }
}

/** El parapeto interior también debe respetar el radio mínimo del arco. */
export function validStairSidesTurn(turn, width, length, props = {}) {
  const o = stairSideOptions(props)
  const inner = turn > 0 ? ['left', 'both'].includes(o.sides) : turn < 0 ? ['right', 'both'].includes(o.sides) : false
  return validStairTurn(turn, width + (inner ? 2 * o.sideThickness : 0), length)
}

/** Si la malla es cerrada y su volumen es negativo, invierte todas las caras. */
function outward(m) {
  if (signedVolume(m) < 0) m.f = m.f.map((f) => [...f].reverse())
  return m
}

export function cube(sx = 1, sy = 1, sz = 1) {
  const x = sx / 2, y = sy / 2, z = sz / 2
  const v = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]
  const f = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]]
  return new PolyMesh(v, f)
}

/** Rejilla de nx × nz celdas en el plano XZ, normal +Y. */
export function grid(sx = 1, sz = 1, nx = 1, nz = 1) {
  const v = [], f = []
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) v.push([(i / nx - 0.5) * sx, 0, (j / nz - 0.5) * sz])
  const W = nx + 1
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * W + i
    f.push([a, a + W, a + W + 1, a + 1])
  }
  const m = new PolyMesh(v, f)
  if (m.faceNormal(0)[1] < 0) m.f = m.f.map((q) => [...q].reverse())
  return m
}
export const plane = (sx = 1, sz = 1) => grid(sx, sz, 1, 1)

export function circle(r = 0.5, n = 16, fill = true) {
  const v = []
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; v.push([Math.cos(a) * r, 0, -Math.sin(a) * r]) }
  const m = new PolyMesh(v, fill ? [Array.from({ length: n }, (_, i) => i)] : [])
  if (!fill) for (let i = 0; i < n; i++) m.we.push([i, (i + 1) % n])
  return m
}

export function cylinder(rx = 0.5, h = 1, n = 16, rz = rx, rTop = rx) {
  const v = [], f = []
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; v.push([Math.cos(a) * rx, -h / 2, -Math.sin(a) * rz]) }
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; v.push([Math.cos(a) * rTop, h / 2, -Math.sin(a) * rTop * (rz / rx || 1)]) }
  for (let i = 0; i < n; i++) f.push([i, n + i, n + ((i + 1) % n), (i + 1) % n])
  f.push(Array.from({ length: n }, (_, i) => 2 * n - 1 - i)) // tapa superior
  f.push(Array.from({ length: n }, (_, i) => i)) // tapa inferior
  return outward(new PolyMesh(v, f))
}

export function cone(r = 0.5, h = 1, n = 16) {
  const v = [[0, h / 2, 0]], f = []
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; v.push([Math.cos(a) * r, -h / 2, -Math.sin(a) * r]) }
  for (let i = 0; i < n; i++) f.push([0, 1 + i, 1 + ((i + 1) % n)])
  f.push(Array.from({ length: n }, (_, i) => n - i))
  return outward(new PolyMesh(v, f))
}

/** Esfera UV: `seg` meridianos y `rings` anillos (polos con triángulos). */
export function sphere(r = 0.5, seg = 16, rings = 8) {
  const v = [[0, r, 0]], f = []
  for (let j = 1; j < rings; j++) {
    const p = (j / rings) * Math.PI
    for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; v.push([Math.cos(a) * Math.sin(p) * r, Math.cos(p) * r, -Math.sin(a) * Math.sin(p) * r]) }
  }
  v.push([0, -r, 0])
  const bot = v.length - 1
  const ring = (j, i) => 1 + (j - 1) * seg + (i % seg)
  for (let i = 0; i < seg; i++) f.push([0, ring(1, i), ring(1, i + 1)])
  for (let j = 1; j < rings - 1; j++) for (let i = 0; i < seg; i++) f.push([ring(j, i), ring(j + 1, i), ring(j + 1, i + 1), ring(j, i + 1)])
  for (let i = 0; i < seg; i++) f.push([ring(rings - 1, i), bot, ring(rings - 1, i + 1)])
  return outward(new PolyMesh(v, f))
}

export function torus(R = 0.5, r = 0.2, major = 16, minor = 8) {
  const v = [], f = []
  for (let i = 0; i < major; i++) {
    const a = (i / major) * Math.PI * 2
    for (let j = 0; j < minor; j++) {
      const b = (j / minor) * Math.PI * 2
      const d = R + Math.cos(b) * r
      v.push([Math.cos(a) * d, Math.sin(b) * r, -Math.sin(a) * d])
    }
  }
  for (let i = 0; i < major; i++) for (let j = 0; j < minor; j++) {
    const i2 = (i + 1) % major, j2 = (j + 1) % minor
    f.push([i * minor + j, i * minor + j2, i2 * minor + j2, i2 * minor + j])
  }
  return outward(new PolyMesh(v, f))
}

/** Prisma triangular (misma forma que la rampa del editor: cara vertical en -X, pendiente hacia +X). */
export function ramp(sx = 1, sy = 1, sz = 1) {
  const x = sx / 2, y = sy / 2, z = sz / 2
  const v = [[-x, -y, -z], [x, -y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [-x, y, z]]
  const f = [[0, 2, 1], [3, 4, 5], [0, 1, 4, 3], [0, 3, 5, 2], [1, 2, 5, 4]]
  return outward(new PolyMesh(v, f))
}

export function stairs(sx = 1, sy = 1, sz = 1, steps = 8, turn = 0, props = {}) {
  const n = normalizeStairSteps(steps)
  const opts = stairSideOptions(props)
  const normalized = normalizeStairTurn(turn)
  const a = validStairSidesTurn(normalized, Math.abs(sx), Math.abs(sz), opts) ? normalized : 0
  const base = a !== 0 ? curvedStairs(sx, sy, sz, n, a) : straightStairs(sx, sy, sz, n)
  if (opts.sides === 'none') return base
  for (const side of ['left', 'right']) {
    if (opts.sides !== side && opts.sides !== 'both') continue
    const inner = (side === 'left' ? -1 : 1) * sx / 2
    const outer = inner + (side === 'left' ? -1 : 1) * opts.sideThickness
    const wall = a !== 0
      ? curvedStairs(sx, sy, sz, n, a, Math.min(inner, outer), Math.max(inner, outer), opts.sideHeight)
      : straightStairs(sx, sy, sz, n, Math.min(inner, outer), Math.max(inner, outer), opts.sideHeight)
    const offset = base.v.length
    base.v.push(...wall.v)
    base.f.push(...wall.f.map((face) => face.map((i) => i + offset)))
  }
  return base
}

function straightStairs(sx, sy, sz, n, left = -sx / 2, right = sx / 2, rim = 0) {
  // perfil en el plano YZ: de atrás (−z) hacia delante, extruido a lo largo de X
  const prof = [[-sy / 2, -sz / 2]]
  for (let i = 0; i < n; i++) {
    const h = -sy / 2 + (sy * (i + 1)) / n + rim, z0 = -sz / 2 + (sz * i) / n, z1 = -sz / 2 + (sz * (i + 1)) / n
    prof.push([h, z0])
    prof.push([h, z1])
  }
  prof.push([-sy / 2, sz / 2])
  // prof: lista de (y,z) del contorno del lado; los puntos [-sy/2,-sz/2] y el último cierran abajo
  const pts = prof.map(([y, z]) => [y, z])
  const v = [], f = []
  const N = pts.length
  for (const x of [left, right]) for (const [y, z] of pts) v.push([x, y, z])
  f.push(Array.from({ length: N }, (_, i) => i))
  f.push(Array.from({ length: N }, (_, i) => 2 * N - 1 - i))
  for (let i = 0; i < N; i++) f.push([i, N + i, N + ((i + 1) % N), (i + 1) % N])
  return outward(new PolyMesh(v, f))
}

/** Superficie escalonada continua sobre un arco circular de longitud sz. */
function curvedStairs(sx, sy, sz, n, turn, left = -sx / 2, right = sx / 2, rim = 0) {
  const theta = turn * Math.PI / 180
  const radius = sz / theta
  const vertices = [], faces = [], ids = new Map()
  const station = (side, j, level) => {
    const key = `${side}:${j}:${level}`
    if (ids.has(key)) return ids.get(key)
    const phi = theta * (j / n - 0.5)
    const offset = side < 0 ? left : right
    const x = radius * (Math.cos(phi) - Math.cos(theta / 2)) + offset * Math.cos(phi)
    const z = radius * Math.sin(phi) + offset * Math.sin(phi)
    const y = -sy / 2 + sy * level / n + (level > 0 ? rim : 0)
    const id = vertices.length
    vertices.push([x, y, z])
    ids.set(key, id)
    return id
  }
  const L = (j, level) => station(-1, j, level)
  const R = (j, level) => station(1, j, level)
  for (let i = 0; i < n; i++) {
    const h = i + 1
    // Huella, fondo, caras exteriores y tabica. Se comparten los bordes entre escalones.
    faces.push([L(i, h), R(i, h), R(i + 1, h), L(i + 1, h)])
    faces.push([L(i + 1, 0), R(i + 1, 0), R(i, 0), L(i, 0)])
    for (const side of [-1, 1]) {
      const at = side < 0 ? L : R
      const wall = [at(i, 0), at(i + 1, 0), at(i + 1, h), at(i, h)]
      if (i > 0) wall.push(at(i, i))
      faces.push(side < 0 ? wall.reverse() : wall)
    }
    faces.push([L(i, i), R(i, i), R(i, h), L(i, h)])
  }
  faces.push([L(n, 0), L(n, n), R(n, n), R(n, 0)])
  return outward(new PolyMesh(vertices, faces))
}

/**
 * PolyMesh a partir de los polígonos de un recorte CSG ([{ pts }] en el espacio unitario del sólido) con las dimensiones reales.
 * Suelda vértices coincidentes (1e-4 m); los polígonos quedan como caras convexas (fragmentos, no se vuelven a unir).
 */
export function fromCarved(polys, scale = [1, 1, 1]) {
  const v = [], f = [], at = new Map()
  const id = (p) => {
    const q = [p[0] * scale[0], p[1] * scale[1], p[2] * scale[2]]
    const k = q.map((x) => Math.round(x * 1e4)).join(',')
    let i = at.get(k)
    if (i === undefined) { i = v.length; at.set(k, i); v.push(q) }
    return i
  }
  for (const p of polys) {
    const ids = []
    for (const q of p.pts) { const i = id(q); if (ids[ids.length - 1] !== i) ids.push(i) }
    if (ids.length > 1 && ids[0] === ids[ids.length - 1]) ids.pop()
    if (new Set(ids).size >= 3) f.push(ids)
  }
  // uniones en T: un vértice que cae sobre la arista de otra cara se inserta en ella (si no, la malla queda con bordes abiertos)
  const EPS = 2e-4
  for (const ids of f) {
    for (let k = 0; k < ids.length; k++) {
      const A = v[ids[k]], B = v[ids[(k + 1) % ids.length]]
      const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], l2 = dx * dx + dy * dy + dz * dz
      if (l2 < 1e-12) continue
      const on = []
      for (let i = 0; i < v.length; i++) {
        if (i === ids[k] || i === ids[(k + 1) % ids.length]) continue
        const P = v[i]
        if (P[0] < Math.min(A[0], B[0]) - EPS || P[0] > Math.max(A[0], B[0]) + EPS || P[1] < Math.min(A[1], B[1]) - EPS || P[1] > Math.max(A[1], B[1]) + EPS || P[2] < Math.min(A[2], B[2]) - EPS || P[2] > Math.max(A[2], B[2]) + EPS) continue
        const t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy + (P[2] - A[2]) * dz) / l2
        if (t <= 1e-6 || t >= 1 - 1e-6) continue
        if (Math.hypot(A[0] + dx * t - P[0], A[1] + dy * t - P[1], A[2] + dz * t - P[2]) < EPS) on.push([t, i])
      }
      if (on.length) { on.sort((p, q) => p[0] - q[0]); ids.splice(k + 1, 0, ...on.map((o) => o[1])); k += on.length }
    }
  }
  return new PolyMesh(v, f)
}

export const GENERATOR_FIELDS = {
  plane: [{ key: 'nx', label: 'Divisiones X', min: 1, max: 64 }, { key: 'nz', label: 'Divisiones Z', min: 1, max: 64 }],
  grid: [{ key: 'nx', label: 'Divisiones X', min: 1, max: 64 }, { key: 'nz', label: 'Divisiones Z', min: 1, max: 64 }],
  circle: [{ key: 'n', label: 'Segmentos', min: 3, max: 96 }],
  cylinder: [{ key: 'n', label: 'Segmentos radiales', min: 3, max: 96 }],
  cone: [{ key: 'n', label: 'Segmentos radiales', min: 3, max: 96 }],
  sphere: [{ key: 'seg', label: 'Segmentos', min: 3, max: 96 }, { key: 'rings', label: 'Anillos', min: 3, max: 64 }],
  torus: [{ key: 'major', label: 'Anillos principales', min: 3, max: 96 }, { key: 'minor', label: 'Segmentos del tubo', min: 3, max: 64 }],
}

export function makeParametric(kind, o) {
  const fields = GENERATOR_FIELDS[kind]
  if (!fields || !o || fields.some(({ key, min, max }) => !Number.isInteger(o[key]) || o[key] < min || o[key] > max)) return null
  let m
  switch (kind) {
    case 'plane': case 'grid': m = grid(o.sx, o.sz, o.nx, o.nz); break
    case 'circle': m = circle(o.r, o.n, true); break
    case 'cylinder': m = cylinder(o.rx, o.h, o.n, o.rz); break
    case 'cone': m = scaleZ(cone(o.rx, o.h, o.n), o.rz / o.rx); break
    case 'sphere': m = scaleXYZ(sphere(0.5, o.seg, o.rings), o.sx, o.sy, o.sz); break
    case 'torus': m = torus(o.R, o.r, o.major, o.minor); break
    default: return null
  }
  m.generator = { kind, params: { ...o }, signature: '' }
  return m
}

const scaleZ = (m, k) => { for (const p of m.v) p[2] *= k; return m }
const scaleXYZ = (m, x, y, z) => { for (const p of m.v) { p[0] *= x; p[1] *= y; p[2] *= z } return m }

/** Malla inicial para cada primitiva del editor (con las dimensiones reales ya aplicadas). */
export function fromPrimitive(kind, scale = [1, 1, 1], props = {}) {
  const [sx, sy, sz] = scale
  switch (kind) {
    case 'plane': return cube(sx, sy, sz)
    case 'box': return cube(sx, sy, sz)
    case 'ramp': return ramp(sx, sy, sz)
    case 'stairs': return stairs(sx, sy, sz, props.steps ?? 8, props.turn ?? 0, props)
    case 'cylinder': return makeParametric('cylinder', { rx: sx / 2, rz: sz / 2, h: sy, n: 32 })
    case 'cone': return makeParametric('cone', { rx: sx / 2, rz: sz / 2, h: sy, n: 32 })
    case 'sphere': return makeParametric('sphere', { sx, sy, sz, seg: 32, rings: 20 })
    default: return cube(sx, sy, sz)
  }
}

/** Malla nueva por tipo (menú «Añadir» del modo edición y objetos tipo `mesh`). */
export function make(kind, o = {}) {
  switch (kind) {
    case 'vertex': return new PolyMesh([[0, 0, 0]], [], [])
    case 'cube': return cube(o.sx ?? 2, o.sy ?? 2, o.sz ?? 2)
    case 'plane': return makeParametric(kind, { sx: o.sx ?? 2, sz: o.sz ?? 2, nx: o.nx ?? 1, nz: o.nz ?? 1 })
    case 'grid': return makeParametric(kind, { sx: o.sx ?? 4, sz: o.sz ?? 4, nx: o.nx ?? 4, nz: o.nz ?? 4 })
    case 'circle': return makeParametric(kind, { r: o.r ?? 1, n: o.n ?? 16 })
    case 'cylinder': return makeParametric(kind, { rx: o.rx ?? o.r ?? 1, rz: o.rz ?? o.r ?? 1, h: o.h ?? 2, n: o.n ?? 16 })
    case 'cone': return makeParametric(kind, { rx: o.rx ?? o.r ?? 1, rz: o.rz ?? o.r ?? 1, h: o.h ?? 2, n: o.n ?? 16 })
    case 'sphere': { const r = o.r ?? 1; return makeParametric(kind, { sx: o.sx ?? 2 * r, sy: o.sy ?? 2 * r, sz: o.sz ?? 2 * r, seg: o.seg ?? 16, rings: o.rings ?? 8 }) }
    case 'torus': return makeParametric(kind, { R: o.R ?? 1, r: o.r ?? 0.35, major: o.major ?? 20, minor: o.minor ?? 10 })
    default: return cube(2, 2, 2)
  }
}
export const MESH_KINDS = {
  vertex: { label: 'Vértice', icon: 'vertex' },
  cube: { label: 'Cubo', icon: 'box' },
  plane: { label: 'Plano', icon: 'plane' },
  grid: { label: 'Rejilla', icon: 'mesh-grid' },
  circle: { label: 'Círculo', icon: 'mesh-circle' },
  cylinder: { label: 'Cilindro', icon: 'cylinder' },
  cone: { label: 'Cono', icon: 'cone' },
  sphere: { label: 'Esfera UV', icon: 'sphere' },
  torus: { label: 'Toro', icon: 'mesh-torus' },
}
export { checkClosed }
