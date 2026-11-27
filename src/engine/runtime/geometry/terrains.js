// Varias piezas de terreno en una misma escena. Cada pieza es un `Terrain` (mapa de alturas local, centrado en su
// propia posición `ox,oz`). Aquí viven las consultas en coordenadas del mundo, la unión de bordes y la fusión para exportar.
import { Terrain } from './terrain.js'
import { b64ToBytes, bytesToB64 } from '../util.js'

const alive = (pieces) => pieces.filter((t) => t.enabled !== false)

/** Altura del mundo en (x,z) o NaN si ninguna pieza lo cubre (huecos entre piezas). */
export function groundAtAll(pieces, x, z) {
  for (const t of pieces) {
    const h = t.groundAt(x, z)
    if (!Number.isNaN(h)) return h
  }
  return NaN
}

/** Altura del mundo; fuera de las piezas devuelve la de la pieza más cercana (como antes con un solo terreno). */
export function heightAtAll(pieces, x, z) {
  const g = groundAtAll(pieces, x, z)
  if (!Number.isNaN(g)) return g
  let best = null, bd = Infinity
  for (const t of alive(pieces)) {
    const b = t.bounds
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1)
    const d = dx * dx + dz * dz
    if (d < bd) { bd = d; best = t }
  }
  return best ? best.oy + best.heightAt(x - best.ox, z - best.oz) : 0
}

/** Impacto más cercano del rayo (mundo) contra todas las piezas. Devuelve { point, distance, piece } o null. */
export function raycastAll(pieces, ray, maxDist = 2000) {
  let best = null
  for (const t of pieces) {
    const h = t.raycastW(ray, maxDist)
    if (h && (!best || h.distance < best.distance)) best = h
  }
  return best
}

export function rangeAll(pieces) {
  let mn = Infinity, mx = -Infinity
  for (const t of alive(pieces)) { const [a, b] = t.heightRange(); mn = Math.min(mn, a + t.oy); mx = Math.max(mx, b + t.oy) }
  return mn <= mx ? [mn, mx] : [0, 0]
}

export function boundsAll(pieces) {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
  for (const t of alive(pieces)) {
    const q = t.bounds
    b.x0 = Math.min(b.x0, q.x0); b.x1 = Math.max(b.x1, q.x1); b.z0 = Math.min(b.z0, q.z0); b.z1 = Math.max(b.z1, q.z1)
  }
  return b.x0 <= b.x1 ? b : { x0: -32, x1: 32, z0: -32, z1: 32 }
}

/** Radio del cuadrado centrado en el origen que contiene todas las piezas. */
export function halfExtentAll(pieces) {
  const b = boundsAll(pieces)
  return Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.z0), Math.abs(b.z1))
}

/** Posición para una pieza nueva de tamaño `size` pegada al lado `dir` (px|nx|pz|nz) de `ref`. */
export function adjacentSpot(ref, size, dir) {
  const h = (ref.size + size) / 2, hz = ((ref.depth ?? ref.size) + size) / 2
  switch (dir) {
    case 'nx': return [ref.ox - h, ref.oz]
    case 'pz': return [ref.ox, ref.oz + hz]
    case 'nz': return [ref.ox, ref.oz - hz]
    default: return [ref.ox + h, ref.oz]
  }
}

const EPS = 0.02
function boundaryVerts(t) {
  const out = [], n1 = t.n1, nz1 = t.nz1 ?? n1, h = t.size / 2, hz = (t.depth ?? t.size) / 2
  for (let j = 0; j < nz1; j++) {
    const edgeRow = j === 0 || j === nz1 - 1
    for (let i = 0; i < n1; i++) {
      if (!edgeRow && i !== 0 && i !== n1 - 1) continue
      out.push([j * n1 + i, t.ox - h + i * t.step, t.oz - hz + j * t.step])
    }
  }
  return out
}

/**
 * Iguala las alturas en los bordes donde dos piezas se tocan (o se solapan), para que no haya escalón.
 * Devuelve las piezas modificadas.
 */
export function stitchPieces(pieces) {
  const list = alive(pieces)
  const touched = new Set()
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      const A = list[a], B = list[b]
      // Dos piezas a distinta elevación no deben soldar automáticamente sus bordes.
      if (Math.abs(A.oy - B.oy) > EPS) continue
      const qa = A.bounds, qb = B.bounds
      if (qa.x1 < qb.x0 - EPS || qb.x1 < qa.x0 - EPS || qa.z1 < qb.z0 - EPS || qb.z1 < qa.z0 - EPS) continue // ni se tocan
      // 1) los vértices del borde de A toman la media con B; 2) los del borde de B copian el perfil resultante de A
      let changed = false
      for (const [v, x, z] of boundaryVerts(A)) {
        if (!B.contains(x, z, EPS)) continue
        A.heights[v] = (A.heights[v] + B.heightAt(x - B.ox, z - B.oz)) / 2
        changed = true
      }
      if (!changed) continue
      for (const [v, x, z] of boundaryVerts(B)) {
        if (!A.contains(x, z, EPS)) continue
        B.heights[v] = A.heightAt(x - A.ox, z - A.oz)
      }
      touched.add(A); touched.add(B)
    }
  }
  for (const t of touched) t.refreshAll()
  return [...touched]
}

/**
 * Fusiona todas las piezas en UN terreno cuadrado centrado en el origen (para exportar).
 * Los huecos entre piezas se rellenan con la cota más baja. Devuelve la propia pieza si ya es una sola y está en el origen.
 * El terreno devuelto lleva `groundFn(x,z)` (NaN en los huecos) para que las carreteras hagan de puente.
 */
export function mergePieces(pieces) {
  const list = alive(pieces)
  if (list.length === 1 && !list[0].ox && !list[0].oy && !list[0].oz && (list[0].depth ?? list[0].size) === list[0].size) return list[0]
  if (!list.length) return pieces[0]
  const S = Math.max(8, halfExtentAll(list) * 2)
  const step = Math.min(...list.map((t) => t.step))
  const capped = Math.ceil(S / step) > 1024
  const seg = Math.min(1024, Math.max(8, Math.ceil(S / step)))
  const T = new Terrain(S, seg, list[0].layers)
  const n1 = T.n1, st = T.step, half = S / 2
  const [mn] = rangeAll(list)
  T.heights.fill(mn)
  for (let j = 0; j < n1; j++) {
    for (let i = 0; i < n1; i++) {
      const x = -half + i * st, z = -half + j * st
      const v = j * n1 + i
      const src = list.find((t) => t.contains(x, z))
      if (!src) continue
      const lx = x - src.ox, lz = z - src.oz
      T.heights[v] = src.oy + src.heightAt(lx, lz)
      const si = Math.min(src.segments, Math.max(0, Math.round((lx + src.size / 2) / src.step)))
      const sj = Math.min(src.segmentsZ ?? src.segments, Math.max(0, Math.round((lz + (src.depth ?? src.size) / 2) / src.step)))
      for (let k = 0; k < 8; k++) T.splat[v * 8 + k] = src.splat[(sj * src.n1 + si) * 8 + k]
    }
  }
  T._ib.needsUpdate = true
  T.refreshAll()
  // vegetación: mismas definiciones, instancias trasladadas al mundo
  const byId = new Map()
  for (const t of list) {
    for (const f of t.foliage.serialize()) {
      const { data, ...cfg } = f
      const e = byId.get(cfg.id) || { cfg, parts: [] }
      byId.set(cfg.id, e)
      if (!data) continue
      const bytes = b64ToBytes(data)
      const arr = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
      for (let i = 0; i < arr.length; i += 4) { arr[i] += t.ox; arr[i + 1] += t.oz }
      e.parts.push(arr)
    }
  }
  T.foliage.load([...byId.values()].map(({ cfg, parts }) => {
    const total = parts.reduce((n, a) => n + a.length, 0)
    const all = new Float32Array(total)
    let o = 0
    for (const a of parts) { all.set(a, o); o += a.length }
    return { ...cfg, data: total ? bytesToB64(new Uint8Array(all.buffer)) : '' }
  }))
  T.groundFn = (x, z) => groundAtAll(list, x, z)
  T.mergedFrom = list.length
  T.mergeCapped = capped
  return T
}

/** Todas las piezas de un terreno serializado (principal + `extra`). */
export function deserializeAll(d) {
  const { extra, ...main } = d
  return [Terrain.deserialize(main), ...(extra || []).map((x) => Terrain.deserialize(x))]
}

/** Serializa una lista de piezas en un único registro (la primera es la principal; el resto va en `extra`). */
export function serializeAll(pieces) {
  const [main, ...rest] = pieces
  return rest.length ? { ...main.serialize(), extra: rest.map((t) => t.serialize()) } : main.serialize()
}

/** Instantánea de todas las piezas (deshacer/rehacer): la principal en la raíz y las demás en `extra`. */
export function snapshotAll(pieces) {
  const [main, ...rest] = pieces
  const s = main.snapshot()
  if (rest.length) s.extra = rest.map((t) => t.snapshot())
  return s
}
