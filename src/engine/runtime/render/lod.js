// Detalle adaptativo (LOD) — lógica PURA, sin three ni DOM (se prueba en «prueba retirada»).
//
// Idea: dibujar cada cosa con tantos triángulos como píxeles tiene sentido darle. Regla única para todo: un triángulo debe cubrir unos
// `targetPx` píxeles de lado; si en pantalla caben menos, sobra geometría y se usa un nivel más grueso.
//   · Terreno: la misma malla de vértices con otro índice (cada 2, 4, 8 vértices). El borde de cada pieza SIEMPRE es de resolución
//     completa, así que dos piezas con niveles distintos encajan sin grietas.
//   · Mallas pesadas: simplificación por agrupación de vértices en una rejilla (rápida y robusta; ideal para niveles lejanos).

import { terrainIndex, terrainStrides } from 'trianghor'
export { terrainIndex, terrainStrides } from 'trianghor'

/** Píxeles de lado que ocupa un tamaño `size` (m) a distancia `dist` con una focal de `focalPx` píxeles. */
export const projectedPx = (size, dist, focalPx) => (size * focalPx) / Math.max(dist, 1e-3)

/**
 * Elige el stride del terreno: el más grueso con celdas de a lo sumo `targetPx` píxeles. Con histéresis (`current`) para no oscilar.
 * `dist` = distancia de la cámara a la pieza (la más cercana de sus esquinas).
 */
export function pickStride(step, dist, focalPx, targetPx, strides, current = 1, hyst = 0.2) {
  let best = 1
  for (const s of strides) if (projectedPx(step * s, dist, focalPx) <= targetPx) best = s
  if (current !== best && strides.includes(current)) {
    // solo se cambia si el nuevo nivel queda claramente dentro de su rango
    const px = projectedPx(step * (best > current ? best : current), dist, focalPx)
    const limit = targetPx * (best > current ? 1 - hyst : 1 + hyst)
    if (best > current ? px > limit : px < limit) return current
  }
  return best
}

// ---------- mallas ----------
/**
 * Simplifica una malla por agrupación de vértices: cada celda de una rejilla se queda con UN vértice (media de los que caen dentro) y
 * los triángulos que se colapsan desaparecen. `attrs` = { nombre: { array, itemSize } } (normales, uv, colores…: se promedian).
 * @returns {{ position: Float32Array, index: Uint32Array, attrs: Object, triangles: number }}
 */
export function clusterSimplify({ position, index, attrs = {} }, cells) {
  const nv = position.length / 3
  const idx = index || Uint32Array.from({ length: nv }, (_, i) => i)
  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity
  for (let i = 0; i < nv; i++) {
    const x = position[i * 3], y = position[i * 3 + 1], z = position[i * 3 + 2]
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; if (z < minz) minz = z; if (z > maxz) maxz = z
  }
  const size = Math.max(maxx - minx, maxy - miny, maxz - minz, 1e-9), cell = (size / Math.max(1, cells)) * (1 + 1e-6) // el margen deja el vértice máximo dentro de la última celda
  const key = new Map(), remap = new Int32Array(nv)
  const sum = [], cnt = [] // por celda: suma de posición y de cada atributo
  const names = Object.keys(attrs)
  for (let i = 0; i < nv; i++) {
    const cx = Math.floor((position[i * 3] - minx) / cell), cy = Math.floor((position[i * 3 + 1] - miny) / cell), cz = Math.floor((position[i * 3 + 2] - minz) / cell)
    const exact = cx + ',' + cy + ',' + cz
    let c = key.get(exact)
    if (c === undefined) { c = cnt.length; key.set(exact, c); cnt.push(0); sum.push(new Float64Array(3 + names.reduce((a, nm) => a + attrs[nm].itemSize, 0))) }
    remap[i] = c; cnt[c]++
    const s = sum[c]; s[0] += position[i * 3]; s[1] += position[i * 3 + 1]; s[2] += position[i * 3 + 2]
    let o = 3
    for (const nm of names) { const { array, itemSize } = attrs[nm]; for (let q = 0; q < itemSize; q++) s[o + q] += array[i * itemSize + q]; o += itemSize }
  }
  // vértices nuevos; solo se conservan los que algún triángulo sigue usando
  const tris = []
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]]
    if (a !== b && b !== c && a !== c) tris.push(a, b, c)
  }
  const used = new Int32Array(cnt.length).fill(-1); let m = 0
  for (const c of tris) if (used[c] < 0) used[c] = m++
  const outPos = new Float32Array(m * 3), outAttrs = {}
  for (const nm of names) outAttrs[nm] = { array: new Float32Array(m * attrs[nm].itemSize), itemSize: attrs[nm].itemSize }
  for (let c = 0; c < cnt.length; c++) {
    const u = used[c]; if (u < 0) continue
    const s = sum[c], k = 1 / cnt[c]
    outPos[u * 3] = s[0] * k; outPos[u * 3 + 1] = s[1] * k; outPos[u * 3 + 2] = s[2] * k
    let o = 3
    for (const nm of names) {
      const { itemSize } = attrs[nm], dst = outAttrs[nm].array
      for (let q = 0; q < itemSize; q++) dst[u * itemSize + q] = s[o + q] * k
      if (/normal/i.test(nm) && itemSize === 3) { const l = Math.hypot(dst[u * 3], dst[u * 3 + 1], dst[u * 3 + 2]) || 1; dst[u * 3] /= l; dst[u * 3 + 1] /= l; dst[u * 3 + 2] /= l }
      o += itemSize
    }
  }
  return { position: outPos, index: Uint32Array.from(tris, (c) => used[c]), attrs: outAttrs, triangles: tris.length / 3 }
}

/** Simplifica hasta quedar con aproximadamente `ratio` de los triángulos (búsqueda sobre el tamaño de la rejilla). */
export function simplifyToRatio(mesh, ratio) {
  const total = (mesh.index ? mesh.index.length : mesh.position.length / 3) / 3
  const goal = Math.max(8, Math.floor(total * ratio))
  let lo = 2, hi = 512, best = null
  for (let it = 0; it < 9 && lo <= hi; it++) {
    const mid = Math.floor((lo + hi) / 2)
    const r = clusterSimplify(mesh, mid)
    if (r.triangles <= goal) { best = r; lo = mid + 1 } else hi = mid - 1
  }
  return best || clusterSimplify(mesh, 2)
}

/**
 * Niveles de una malla de `tris` triángulos: [1, …] con proporciones decrecientes. Mallas pequeñas no se tocan.
 */
export function lodRatios(tris, minTris = 1500) {
  if (tris < minTris) return [1]
  const out = [1]
  for (const r of [0.4, 0.16, 0.06]) if (tris * r >= 60) out.push(r)
  return out
}

/**
 * Nivel para un objeto de radio `radius` (m) a distancia `dist`: el más grueso cuyo número de triángulos aún cubre la pantalla con
 * triángulos de `targetPx` de lado (área proyectada del objeto / targetPx²). `tris[k]` = triángulos del nivel k (decreciente).
 */
export function pickLevel(tris, radius, dist, focalPx, targetPx, current = 0, hyst = 0.25) {
  const diam = projectedPx(radius * 2, dist, focalPx)
  const area = Math.PI * 0.25 * diam * diam
  const need = area / (targetPx * targetPx)
  let best = 0
  for (let k = 0; k < tris.length; k++) if (tris[k] >= need) best = k
  if (best !== current && current < tris.length) {
    // histéresis: para cambiar de nivel hay que pasarse de la necesidad por un margen
    const cur = tris[current]
    if (best > current && cur < need * (1 + hyst) && cur >= need) return current
    if (best < current && tris[current] > need * (1 - hyst) && need < tris[current]) return current
  }
  return best
}

/** Distancia (m) más allá de la cual una instancia de radio `radius` ya mide menos de `minPx` píxeles. */
export const cullDistance = (radius, focalPx, minPx = 3) => (radius * 2 * focalPx) / minPx

/** Fracción de instancias que se dibujan de un chunk entre `near` (todas) y `far` (ninguna), con un mínimo del 20 % antes del corte. */
export function thinning(dist, near, far) {
  if (dist <= near) return 1
  if (dist >= far) return 0
  return 0.2 + 0.8 * (1 - (dist - near) / (far - near))
}

/** Celda de rejilla (grupos de `size` m) de un punto, como clave numérica estable. */
export const cellKey = (x, z, size) => `${Math.floor(x / size)},${Math.floor(z / size)}`

/** Distancia de un punto a una caja en XZ (0 si está dentro). */
export function distToBox(px, pz, x0, z0, x1, z1) {
  const dx = Math.max(x0 - px, 0, px - x1), dz = Math.max(z0 - pz, 0, pz - z1)
  return Math.hypot(dx, dz)
}

/** Elige el nivel más simple cuyo error proyectado cabe en el presupuesto. */
export function pickErrorLod(levels, screenScale, budget, current, hysteresis = 0.2) {
  let best = 0
  for (let i = 1; i < levels.length; i++) {
    const limit = budget * (i > current ? 1 - hysteresis : 1 + hysteresis)
    if (levels[i].error * screenScale > limit) break
    best = i
  }
  return best
}
