// Horneado del mapa de navegación a partir de un lanzador de rayos (Jolt en el editor; una función analítica en las pruebas).
//
//  raycast(origen, dirección, distMax, { backFaces }) → { point, normal, distance } | null
//  Por cada columna se lanzan rayos hacia abajo (varias capas); cada superficie debe tener pendiente suave, espacio libre para el agente
//  (rayo hacia arriba) y no estar dentro de un sólido. Después se «erosiona» con el radio del agente.
import { NavGrid } from './grid.js'
import { loadJolt, JoltWorld } from '../physics/jolt.js'
import { isCutter } from '../geometry/csg.js'

export const NAV_DEFAULTS = { cell: 0.5, agentRadius: 0.4, agentHeight: 1.8, maxSlope: 45, stepHeight: 0.55, layers: 3 }

export function normalizeNavParams(p = {}) {
  const n = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d }
  const D = NAV_DEFAULTS
  return { cell: n(p.cell, D.cell, 0.1, 4), agentRadius: n(p.agentRadius, D.agentRadius, 0, 3), agentHeight: n(p.agentHeight, D.agentHeight, 0.3, 6), maxSlope: n(p.maxSlope, D.maxSlope, 1, 89), stepHeight: n(p.stepHeight, D.stepHeight, 0, 3), layers: Math.round(n(p.layers, D.layers, 1, 6)) }
}

/**
 * @param bounds { min:[x,y,z], max:[x,y,z] }
 * @param opts   { raycast, params, onProgress(0..1), yieldEvery, signal }
 */
function navLayout(bounds, params, maxCells) {
  const cell = params.cell, x0 = bounds.min[0], z0 = bounds.min[2]
  const nx = Math.max(1, Math.ceil((bounds.max[0] - x0) / cell))
  const nz = Math.max(1, Math.ceil((bounds.max[2] - z0) / cell))
  if (nx * nz > 4_000_000 || nx * nz * params.layers > maxCells)
    throw new Error(`La región es demasiado grande (${nx}×${nz} celdas): sube el tamaño de celda o reduce la región`)
  return { cell, x0, z0, nx, nz }
}

export async function bakeNav(bounds, { raycast, params, onProgress, yieldEvery = 400, signal, maxCells = Infinity } = {}) {
  const P = normalizeNavParams(params)
  const { cell, x0, z0, nx, nz } = navLayout(bounds, P, maxCells)
  const L = P.layers, N = nx * nz * L
  const h = new Float32Array(N).fill(NaN), ok = new Uint8Array(N)
  const minSlopeY = Math.cos((P.maxSlope * Math.PI) / 180)
  const top = bounds.max[1], depth = bounds.max[1] - bounds.min[1]
  let done = 0
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      if (signal?.aborted) throw new Error('Cancelado')
      const x = x0 + (ix + 0.5) * cell, z = z0 + (iz + 0.5) * cell
      let y = top, l = 0
      for (let guard = 0; guard < L * 4 && l < L; guard++) {
        const hit = raycast([x, y, z], [0, -1, 0], y - bounds.min[1])
        if (!hit) break
        const hy = hit.point[1], ny = hit.normal ? hit.normal[1] : 1
        y = hy - 0.03
        if (ny < minSlopeY) continue // demasiado empinado (o cara inferior)
        // espacio libre arriba y no enterrado en un sólido
        const up = raycast([x, hy + 0.02, z], [0, 1, 0], Math.max(P.agentHeight + 0.5, top - hy + 0.1), { backFaces: true })
        if (up) {
          const back = up.normal && up.normal[1] < 0 ? false : up.normal ? up.normal[1] > 0 : false // normal hacia arriba mirando al rayo ascendente = cara trasera (estamos dentro)
          if (back || up.distance < P.agentHeight - 0.02) continue
        }
        h[(iz * nx + ix) * L + l] = hy; ok[(iz * nx + ix) * L + l] = 1; l++
      }
    }
    done += nx
    if (onProgress && iz % 8 === 0) onProgress(0.9 * (iz + 1) / nz)
    if (done >= yieldEvery) { done = 0; await new Promise((r) => setTimeout(r, 0)) }
  }
  const grid = new NavGrid({ cell, x0, z0, nx, nz, L, h, ok, step: P.stepHeight, agentRadius: P.agentRadius, agentHeight: P.agentHeight, maxSlope: P.maxSlope })
  erode(grid, P)
  onProgress?.(1)
  return grid
}

/** Quita las celdas a menos de `agentRadius` de un borde (sin suelo continuo al lado): así el agente no roza paredes ni cae por los bordes. */
export function erode(g, P) {
  const r = Math.max(0, Math.round(P.agentRadius / g.cell))
  if (!r) return g
  const kill = []
  for (let iz = 0; iz < g.nz; iz++) for (let ix = 0; ix < g.nx; ix++) for (let l = 0; l < g.L; l++) {
    const i = g.index(ix, iz, l); if (!g.ok[i]) continue
    let bad = false
    for (let dz = -r; dz <= r && !bad; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r + 0.5) continue
      const nx = ix + dx, nz = iz + dz
      if (!g.inside(nx, nz) || g.layerAt(nx, nz, g.h[i], g.step) < 0) { bad = true; break }
    }
    if (bad) kill.push(i)
  }
  for (const i of kill) g.ok[i] = 0
  return g
}

const SOLID = ['primitive', 'mesh', 'model', 'road', 'text']

/** Construye un NavGrid independiente con geometría y colisiones originales de la escena.
 * El caller decide su publicación transitoria o persistente. */
export async function bakeNavRegion({ editor, project, obj, bounds, signal, onProgress, refreshBrushes = true, maxCells = Infinity }) {
  // Rechazar tamaños excesivos ANTES de construir un mundo físico transitorio.
  navLayout(bounds, normalizeNavParams(obj.props), maxCells)
  if (signal?.aborted) throw new Error('Cancelado')
  // El binario WASM se carga cuando se solicita el horneado.
  const Jolt = await loadJolt()
  if (signal?.aborted) throw new Error('Cancelado')
  const world = new JoltWorld(Jolt, {})
  try {
    if (refreshBrushes) editor.refreshBrushes?.() // solo el editor actualiza brushes autorales
    editor.vp.scene.updateMatrixWorld(true)
    for (const t of editor.terrains) world.addTerrain(t)
    for (const o of project.objects) {
      if (o.collision === false || o.visible === false || isCutter(o) || !SOLID.includes(o.type)) continue
      const node = editor.nodes.get(o.id); if (!node) continue
      const parts = node.userData.parts
      node.traverse((m) => {
        if (!m.isMesh || m.userData.helper) return
        if (m.userData.road && parts && m !== parts.asphalt && m !== parts.side) return
        for (let v = m; v; v = v.parent) if (!v.visible) return
        world.addMesh(m)
      })
    }
    if (signal?.aborted) throw new Error('Cancelado')
    world.finalize()
    const raycast = (origin, dir, max, opt) => world.raycast(origin, dir, max, opt)
    const grid = await bakeNav(bounds, { raycast, params: obj.props, signal, onProgress, maxCells })
    return grid
  } finally { world.dispose() }
}
