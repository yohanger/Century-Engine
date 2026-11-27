import * as THREE from 'three'
import { stairs, normalizeStairSteps, effectiveStairTurn, stairSideOptions, validStairSidesTurn } from '../mesh/generators.js'
import { polyBuffers } from '../mesh/buffers.js'

/**
 * Catálogo de primitivas. Todas se definen con tamaño unitario y las dimensiones reales
 * van en `scale`. Así los exportadores pueden escribir tamaños exactos en los meshes
 * y las formas de colisión (no se admite escalado no uniforme en colisiones).
 *
 * link: 'xz'  -> X y Z se mantienen iguales (radio)
 *       'xyz' -> las tres iguales (esfera)
 */
export const PRIMITIVES = {
  box:      { label: 'Cubo',     icon: 'box', link: null,  defaults: { scale: [1, 1, 1] } },
  ramp:     { label: 'Rampa',    icon: 'ramp', link: null,  defaults: { scale: [4, 2, 4] } },
  stairs:   { label: 'Escalera', icon: 'stairs', link: null,  defaults: { scale: [3, 3, 6], props: { steps: 8, turn: 0, sides: 'none', sideHeight: 1, sideThickness: 0.15 } } },
  cylinder: { label: 'Cilindro', icon: 'cylinder', link: 'xz',  defaults: { scale: [1, 1, 1] } },
  cone:     { label: 'Cono',     icon: 'cone', link: 'xz',  defaults: { scale: [1, 1, 1] } },
  sphere:   { label: 'Esfera',   icon: 'sphere', link: 'xyz', defaults: { scale: [1, 1, 1] } },
  plane:    { label: 'Plano',    icon: 'plane', link: null,  defaults: { scale: [4, 0.1, 4] } },
}

export function rampGeometry() {
  // Prisma triangular: cara vertical en -X, pendiente descendiendo hacia +X (igual que PrismMesh left_to_right = 0).
  const s = new THREE.Shape()
  s.moveTo(-0.5, -0.5)
  s.lineTo(0.5, -0.5)
  s.lineTo(-0.5, 0.5)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false })
  g.translate(0, 0, -0.5)
  return g
}

/** Pasos de una escalera en espacio unitario (cubo de 1x1x1 centrado). */
export function stairSteps(steps) {
  const n = normalizeStairSteps(steps)
  const out = []
  for (let i = 0; i < n; i++) {
    const h = (i + 1) / n
    out.push({
      size: [1, h, 1 / n],
      center: [0, -0.5 + h / 2, -0.5 + (i + 0.5) / n],
    })
  }
  return out
}

const stairCache = new Map()
/** Escalera cerrada, sin caras internas, compartida por caché y entre Editor/Player. */
export function stairsGeometry(steps, turn = 0, sx = 1, sz = 1, sy = 1, props = {}) {
  const n = normalizeStairSteps(steps)
  const opts = stairSideOptions(props)
  const a = validStairSidesTurn(effectiveStairTurn(turn, sx, sz), Math.abs(sx), Math.abs(sz), opts) ? effectiveStairTurn(turn, sx, sz) : 0
  const hasSides = opts.sides !== 'none'
  const key = hasSides ? `${n}:${a}:${sx}:${sy}:${sz}:${opts.sides}:${opts.sideHeight}:${opts.sideThickness}` : a ? `${n}:${a}:${sx}:${sz}` : String(n)
  let g = stairCache.get(key)
  if (!g) {
    // La curva se genera en metros reales y vuelve a espacio unitario para respetar scale XYZ.
    const poly = a || hasSides ? stairs(sx, sy, sz, n, a, opts) : null
    if (poly) for (const p of poly.v) { p[0] /= sx; p[1] /= sy; p[2] /= sz }
    const b = poly ? polyBuffers(poly) : polyBuffers(stairs(1, 1, 1, n))
    g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(b.positions, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(b.uvs, 2))
    g.setIndex([...b.indices])
    stairCache.set(key, g)
    // Solo las curvas dependen de dimensiones cambiantes; limita su caché sin tocar las rectas.
    if (stairCache.size > 192) {
      const firstCurve = [...stairCache.keys()].find((k) => String(k).includes(':'))
      if (firstCurve) stairCache.delete(firstCurve) // Las primitivas clonan el buffer antes de renderizarlo.
    }
  }
  return g
}

const geoCache = {}
export function unitGeometry(kind) {
  if (geoCache[kind]) return geoCache[kind]
  let g
  switch (kind) {
    case 'box': case 'trigger': g = new THREE.BoxGeometry(1, 1, 1); break
    case 'plane': g = new THREE.BoxGeometry(1, 1, 1); break
    case 'ramp': g = rampGeometry(); break
    case 'cylinder': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break
    case 'cone': g = new THREE.CylinderGeometry(0, 0.5, 1, 32); break
    case 'sphere': g = new THREE.SphereGeometry(0.5, 32, 20); break
    default: g = new THREE.BoxGeometry(1, 1, 1)
  }
  geoCache[kind] = g
  return g
}

/** Puntos de un cono/rampa para ConvexPolygonShape3D (espacio local con tamaño real). */
export function convexPoints(kind, sx, sy, sz) {
  const pts = []
  if (kind === 'ramp') {
    for (const z of [-0.5, 0.5]) {
      pts.push([-0.5 * sx, -0.5 * sy, z * sz], [0.5 * sx, -0.5 * sy, z * sz], [-0.5 * sx, 0.5 * sy, z * sz])
    }
  } else if (kind === 'cone') {
    const r = sx / 2
    pts.push([0, 0.5 * sy, 0])
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      pts.push([Math.cos(a) * r, -0.5 * sy, Math.sin(a) * r])
    }
  }
  return pts
}
