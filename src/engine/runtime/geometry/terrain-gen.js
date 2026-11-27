// Generador de terreno: parámetros, costas (isla, bahía), relieve y suavizado de pendientes. Solo funciones puras sobre arreglos:
// no sabe nada de la malla ni del editor; `Terrain.generate()` (terrain.js) lo usa.
import { clamp, lerp, fbm, valueNoise } from '../util.js'

/** Parámetros de la última generación aplicados a UNA pieza. Los proyectos antiguos no necesitan este campo. */
export const DEFAULT_TERRAIN_GENERATOR = Object.freeze({
  shape: 'terrain', seed: 1, scale: 0.05, amplitude: 8, octaves: 5, roughness: 0.5, island: 0,
  coastRoughness: 0.45, beachWidth: 6, cliffStrength: 0.25, seaLevel: 0, reliefVersion: 3, coastlineVersion: 4,
})

const finite = (v, fallback, min, max) => Number.isFinite(Number(v)) ? clamp(Number(v), min, max) : fallback
export const smooth = (v) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t) }

/** Reconstruye un contrato válido sin mutar datos del proyecto o del formulario. */
export function terrainGeneratorParams(options = {}) {
  const p = { ...DEFAULT_TERRAIN_GENERATOR, ...options }
  return {
    shape: ['terrain', 'island', 'bay'].includes(p.shape) ? p.shape : 'terrain',
    seed: Math.trunc(finite(p.seed, 1, -1000000000, 1000000000)),
    scale: finite(p.scale, 0.05, 0.005, 10000),
    amplitude: finite(p.amplitude, 8, 0, 1000000),
    octaves: Math.trunc(finite(p.octaves, 5, 1, 8)),
    roughness: finite(p.roughness, 0.5, 0.1, 0.9),
    island: finite(p.island, 0, 0, 1),
    coastRoughness: finite(p.coastRoughness, 0.45, 0, 1),
    beachWidth: finite(p.beachWidth, 6, 0.5, 512),
    cliffStrength: finite(p.cliffStrength, 0.25, 0, 1),
    seaLevel: finite(p.seaLevel, 0, -1000, 1000),
    reliefVersion: Math.trunc(finite(p.reliefVersion, 3, 1, 3)),
    coastlineVersion: Math.trunc(finite(p.coastlineVersion, 4, 1, 4)),
  }
}

/**
 * Construye una masa terrestre a partir de un eje curvo y DOS riberas
 * independientes. Evita el radio polar y los lóbulos alternados que hacían
 * que semillas distintas parecieran la misma plantilla deformada.
 * Los detalles abarcan escalas anidadas; la costa permanece continua y cabe
 * íntegra dentro del lienzo sin recortar vértices individuales.
 */
export function coastOutline(size, seed, coastRoughness, shape) {
  const half = size * 0.5
  const random = (k) => valueNoise(k * 3.719 + 0.51, k * 5.327 + 9.2, seed + 217)
  const angle = (random(1) - 0.5) * 2.5
  const ca = Math.cos(angle), sa = Math.sin(angle)
  const axis = half * (0.68 + 0.25 * random(2))
  const breadth = half * (0.40 + 0.25 * random(3))
  const phase = random(4) * Math.PI * 2
  const outline = []
  const samples = 160
  const features = [[], []]
  for (let side = 0; side < 2; side++) {
    const count = 4 + Math.floor(random(side + 10) * 4)
    for (let k = 0; k < count; k++) features[side].push({
      at: 0.09 + 0.82 * random(23 + side * 19 + k * 3),
      span: 0.024 + 0.075 * random(24 + side * 19 + k * 3),
      strength: (random(25 + side * 19 + k * 3) - 0.48) * 0.64,
    })
  }
  // Un recorrido por cada ribera. Ambas se cierran en los extremos del eje.
  for (let side = 0; side < 2; side++) {
    for (let k = 0; k <= samples; k++) {
      const u = side === 0 ? k / samples : 1 - k / samples
      const along = axis * (2 * u - 1)
      const meander = half * (0.095 * Math.sin(u * Math.PI * 2 + phase)
        + 0.05 * fbm(u * 3.3 + 12, 1.7, { seed: seed + 111, octaves: 3 }))
      const derivative = half * 0.095 * Math.PI * 2 * Math.cos(u * Math.PI * 2 + phase) / (2 * axis)
      const normal = 1 / Math.hypot(1, derivative)
      const taper = Math.pow(Math.max(0, Math.sin(u * Math.PI)), 0.48)
      const bank = side === 0 ? 1 : -1
      const macro = fbm(u * 3.8 + side * 13.1, 6.3, { seed: seed + 233, octaves: 3 })
      const medium = fbm(u * 14.0 + side * 19.3, 5.3,
        { seed: seed + 391, octaves: 3, gain: 0.5 })
      const fine = fbm(u * 47 + side * 7, 2.2, { seed: seed + 631, octaves: 2 })
      let projection = 1 + 0.35 * macro + coastRoughness * (0.20 * medium + 0.06 * fine)
      for (const f of features[side]) {
        const du = (u - f.at) / f.span
        projection += f.strength * Math.exp(-0.5 * du * du)
      }
      // La ribera izquierda y derecha tienen anchuras y accidentes propios.
      const offset = bank * breadth * taper * clamp(projection, 0.64, 1.65)
      const xx = along - derivative * normal * offset
      const zz = meander + normal * offset
      outline.push([xx * ca - zz * sa, xx * sa + zz * ca])
    }
  }
  const extent = Math.max(...outline.map(([x, z]) => Math.max(Math.abs(x), Math.abs(z))))
  const fit = Math.min(1, half * 0.90 / extent)
  // Centrar la forma en el lienzo sin deformar la geometría del litoral.
  if (fit < 1) for (const p of outline) { p[0] *= fit; p[1] *= fit }
  return outline
}

/**
 * Traza una entrada marítima curva que parte del océano exterior y termina
 * dentro del contorno terrestre. Las anchuras cambian suavemente, sin un
 * círculo restado al centro ni cortes rectos en los límites del mapa.
 * Coordenadas relativas al lado de la pieza (−0.5 .. 0.5).
 */
function bayInletPath(seed, mask, segments) {
  const r = (i) => valueNoise(i * 7.17, i * 3.53 + 11, seed + 1591)
  // La bahía puede aparecer en cualquier sector de la costa, no siempre
  // al norte del lienzo. El giro conserva la forma completa en el mapa.
  const a = r(12) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a)
  const point = (x, z, w) => ({ x: x * ca - z * sa, z: x * sa + z * ca, w })
  const drift = (r(1) - 0.5) * 0.12
  const lean = (r(2) - 0.5) * 0.13
  const bend = (r(4) - 0.5) * 0.09
  const width = 0.76 + r(5) * 0.32
  // Medir la costa realmente generada por esta semilla a lo largo del rayo.
  // La desembocadura empieza fuera de la isla; el fondo queda dentro.
  let shore = -0.22
  for (let j = 0; j <= segments; j++) {
    const z = j / segments - 0.5
    const q = point(drift, z, 0)
    const i = Math.round((q.x + 0.5) * segments), k = Math.round((q.z + 0.5) * segments)
    if (i >= 0 && i <= segments && k >= 0 && k <= segments && mask[k * (segments + 1) + i]) {
      shore = z
      break
    }
  }
  const main = [
    point(drift - 0.035, -0.70, 0.084 * width),
    point(drift - 0.030, shore - 0.16, 0.092 * width),
    point(drift - 0.008 + lean * 0.25, shore - 0.022, 0.072 * width),
    point(drift + 0.029 + lean, shore + 0.050, 0.098 * width),
    point(drift + 0.039 + lean + bend, shore + 0.12 + (r(7) - 0.5) * 0.07,
      0.058 * width),
  ]
  const side = r(9) > 0.5 ? 1 : -1
  const cove = [
    point(drift + 0.029 + lean, shore + 0.050, 0.061 * width),
    point(drift + 0.029 + lean + side * (0.055 + 0.065 * r(10)),
      shore + 0.041 + 0.05 * r(11), 0.028 * width),
  ]
  // Algunas semillas tienen una segunda cala menor en la costa opuesta.
  const secondary = [
    point(drift - 0.008 + lean * 0.25, shore - 0.022, 0.046 * width),
    point(drift - 0.008 + lean * 0.25 - side * (0.045 + 0.065 * r(15)),
      shore + 0.009 + 0.05 * r(16), 0.018 * width),
  ]
  return [main, cove, secondary]
}

/** Distancia a la entrada, relativa a su radio local. <1 significa mar. */
function bayInletDistance(x, z, paths) {
  let ratio = Infinity
  for (const path of paths) for (let k = 0; k < path.length - 1; k++) {
    const a = path[k], b = path[k + 1]
    const dx = b.x - a.x, dz = b.z - a.z
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1)
    const radius = lerp(a.w, b.w, t)
    ratio = Math.min(ratio, Math.hypot(x - a.x - t * dx, z - a.z - t * dz) / radius)
  }
  return ratio
}

/** Rasteriza cualquier contorno cerrado por paridad: no limita transiciones. */
export function coastLandMask(size, segments, outline, shape, seed = 1, roughness = 0.45) {
  const n1 = segments + 1, half = size / 2, step = size / segments
  const mask = new Uint8Array(n1 * n1)
  for (let j = 0; j < n1; j++) {
    const z = -half + j * step
    const intersections = []
    for (let k = 0; k < outline.length; k++) {
      const [x1, z1] = outline[k]
      const [x2, z2] = outline[(k + 1) % outline.length]
      if ((z1 <= z && z < z2) || (z2 <= z && z < z1)) {
        intersections.push(x1 + (x2 - x1) * (z - z1) / (z2 - z1))
      }
    }
    intersections.sort((a, b) => a - b)
    for (let k = 0; k + 1 < intersections.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((intersections[k] + half) / step))
      const i1 = Math.min(segments, Math.floor((intersections[k + 1] + half) / step))
      for (let i = i0; i <= i1; i++) mask[j * n1 + i] = 1
    }
  }
  if (shape === 'bay') {
    const paths = bayInletPath(seed, mask, segments)
    // Sólo se inspecciona la región del entrante; el resto de la isla conserva
    // exactamente la máscara original. La abertura atraviesa el anillo marino.
    const points = paths.flat()
    const minX = Math.min(...points.map(p => p.x - p.w)) - 0.024
    const maxX = Math.max(...points.map(p => p.x + p.w)) + 0.024
    const maxZ = Math.max(...points.map(p => p.z + p.w)) + 0.024
    for (let j = 0; j < n1; j++) {
      const z = j / segments - 0.5
      if (z > maxZ) break
      for (let i = 0; i < n1; i++) {
        const idx = j * n1 + i, x = i / segments - 0.5
        if (!mask[idx] || x < minX || x > maxX) continue
        // Ligera deformación espacial continua; no introduce islotes
        // aleatorios ni desconecta la boca de la bahía.
        const nx = x + roughness * 0.012 * fbm(x * 8 + 3.1, z * 8 - 6.3,
          { seed: seed + 1781, octaves: 2 })
        const nz = z + roughness * 0.009 * fbm(x * 7 - 2.1, z * 7 + 4.7,
          { seed: seed + 1847, octaves: 2 })
        if (bayInletDistance(nx, nz, paths) < 1) mask[idx] = 0
      }
    }
  }
  // Conservar exclusivamente la masa terrestre principal. El rasterizador
  // puede separar un vértice en cabos muy finos; esas piezas no constituyen
  // archipiélagos solicitados y romperían la topología de una isla única.
  const seenLand = new Uint8Array(mask.length)
  const queue = new Int32Array(mask.length)
  let largestAt = -1, largestCount = 0
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seenLand[start]) continue
    let head = 0, tail = 0
    queue[tail++] = start; seenLand[start] = 1
    while (head < tail) {
      const at = queue[head++], i = at % n1, j = Math.floor(at / n1)
      for (let dir = 0; dir < 4; dir++) {
        const next = dir === 0 ? (i ? at - 1 : -1) : dir === 1 ? (i < segments ? at + 1 : -1)
          : dir === 2 ? (j ? at - n1 : -1) : (j < segments ? at + n1 : -1)
        if (next >= 0 && !seenLand[next] && mask[next]) {
          seenLand[next] = 1; queue[tail++] = next
        }
      }
    }
    if (tail > largestCount) { largestAt = start; largestCount = tail }
  }
  if (largestAt >= 0) {
    seenLand.fill(0)
    let head = 0, tail = 0
    queue[tail++] = largestAt; seenLand[largestAt] = 1
    while (head < tail) {
      const at = queue[head++], i = at % n1, j = Math.floor(at / n1)
      for (let dir = 0; dir < 4; dir++) {
        const next = dir === 0 ? (i ? at - 1 : -1) : dir === 1 ? (i < segments ? at + 1 : -1)
          : dir === 2 ? (j ? at - n1 : -1) : (j < segments ? at + n1 : -1)
        if (next >= 0 && !seenLand[next] && mask[next]) {
          seenLand[next] = 1; queue[tail++] = next
        }
      }
    }
    for (let k = 0; k < mask.length; k++) if (mask[k] && !seenLand[k]) mask[k] = 0
  }
  // Eliminar bolsas interiores de agua aisladas del océano exterior.
  const seenSea = new Uint8Array(mask.length)
  let head = 0, tail = 0
  if (!mask[0]) { seenSea[0] = 1; queue[tail++] = 0 }
  while (head < tail) {
    const at = queue[head++], i = at % n1, j = Math.floor(at / n1)
    for (let dir = 0; dir < 4; dir++) {
      const next = dir === 0 ? (i ? at - 1 : -1) : dir === 1 ? (i < segments ? at + 1 : -1)
        : dir === 2 ? (j ? at - n1 : -1) : (j < segments ? at + n1 : -1)
      if (next >= 0 && !seenSea[next] && !mask[next]) { seenSea[next] = 1; queue[tail++] = next }
    }
  }
  for (let k = 0; k < mask.length; k++) if (!mask[k] && !seenSea[k]) mask[k] = 1
  return mask
}

/** Transformada euclidiana exacta en 1D; reutiliza buffers por filas/columnas. */
function coastDistance1D(f, count, d, v, z) {
  let k = 0
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity
  for (let q = 1; q < count; q++) {
    let s
    do {
      const vk = v[k]
      s = ((f[q] + q * q) - (f[vk] + vk * vk)) / (2 * (q - vk))
      if (s <= z[k]) k--
      else break
    } while (k >= 0)
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < count; q++) {
    while (z[k + 1] < q) k++
    const delta = q - v[k]
    d[q] = delta * delta + f[v[k]]
  }
}

/** SDF: positivo dentro de tierra, negativo bajo mar, en metros de la pieza. */
export function coastSignedDistance(mask, segments, step) {
  const n1 = segments + 1, count = n1 * n1
  const tmp = new Float64Array(count), out = new Float32Array(count)
  const f = new Float64Array(n1), d = new Float64Array(n1)
  const v = new Int32Array(n1), z = new Float64Array(n1 + 1)
  const inf = 1e12
  // Los vértices de frontera aportan la distancia a cualquier tramo costero.
  const boundary = new Uint8Array(count)
  for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
    const idx = j * n1 + i, land = mask[idx]
    if ((i > 0 && mask[idx - 1] !== land) ||
        (i < segments && mask[idx + 1] !== land) ||
        (j > 0 && mask[idx - n1] !== land) ||
        (j < segments && mask[idx + n1] !== land)) boundary[idx] = 1
  }
  for (let j = 0; j < n1; j++) {
    for (let i = 0; i < n1; i++) f[i] = boundary[j * n1 + i] ? 0 : inf
    coastDistance1D(f, n1, d, v, z)
    for (let i = 0; i < n1; i++) tmp[j * n1 + i] = d[i]
  }
  for (let i = 0; i < n1; i++) {
    for (let j = 0; j < n1; j++) f[j] = tmp[j * n1 + i]
    coastDistance1D(f, n1, d, v, z)
    for (let j = 0; j < n1; j++) {
      const idx = j * n1 + i
      const metres = Math.max(0, Math.sqrt(d[j]) - 0.3) * step
      out[idx] = mask[idx] ? metres : -metres
    }
  }
  return out
}

/**
 * Relieve costero calculado sobre una malla de muestras de escala mundial fija.
 * Las crestas son ejes alargados y curvos; los valles son corredores separados.
 * Ninguno depende del campo `amplitude` del modo Original Terrain.
 *
 * El campo se muestrea una sola vez por Generate (97² muestras) y después se
 * interpola a la resolución real de Terrain. Evita ejecutar ruido multioctava
 * en cada uno de los >1 M vértices posibles en equipos modestos.
 */
export function coastReliefField(seed) {
  const cells = 96, n1 = cells + 1
  const samples = new Float32Array(n1 * n1)
  const ridges = [], valleys = []
  const feature = (k, offset, valley) => {
    const r = (channel) => valueNoise(k * 8.37 + channel * 2.91, channel * 5.17, seed + offset)
    const a = r(1) * Math.PI * 2
    return {
      cx: (r(2) - 0.5) * (valley ? 0.75 : 0.43),
      cz: (r(3) - 0.5) * (valley ? 0.75 : 0.43),
      dx: Math.cos(a), dz: Math.sin(a),
      length: valley ? 0.26 + r(4) * 0.29 : 0.22 + r(4) * 0.26,
      width: valley ? 0.017 + r(5) * 0.022 : 0.034 + r(5) * 0.055,
      bend: (r(6) - 0.5) * (valley ? 0.095 : 0.075),
      phase: r(7) * Math.PI * 2,
      strength: valley ? 0.58 + 0.35 * r(8) : 0.56 + 0.42 * r(8),
    }
  }
  for (let k = 0; k < 4; k++) ridges.push(feature(k, 619, false))
  for (let k = 0; k < 4; k++) valleys.push(feature(k, 1277, true))
  function strength(features, x, z) {
    let highest = 0
    for (const f of features) {
      const rx = x - f.cx, rz = z - f.cz
      const along = rx * f.dx + rz * f.dz
      const across = -rx * f.dz + rz * f.dx
      const winding = f.bend * Math.sin(along / f.length * 4.0 + f.phase)
      const d = (across - winding) / f.width
      const axial = along / f.length
      const contribution = f.strength * Math.exp(-0.5 * d * d - 0.5 * axial ** 4)
      highest = Math.max(highest, contribution)
    }
    return highest
  }
  for (let j = 0; j <= cells; j++) for (let i = 0; i <= cells; i++) {
    const x = i / cells - 0.5, z = j / cells - 0.5
    // Deformación amplia y continua, distinta del relieve fino de las laderas.
    const wx = x + fbm(x * 3.1 + 17.1, z * 3.1, { seed: seed + 89, octaves: 3 }) * 0.030
    const wz = z + fbm(x * 3.1, z * 3.1 - 11.3, { seed: seed + 179, octaves: 3 }) * 0.030
    const broad = fbm(wx * 3.9 + 31.3, wz * 3.9 - 7.2, { seed: seed + 259, octaves: 4 })
    const details = fbm(wx * 12.5 - 5.1, wz * 12.5 + 14.7, { seed: seed + 317, octaves: 4 })
    const ridge = strength(ridges, wx, wz)
    const valley = strength(valleys, wx, wz)
    const elevation = 0.19 + 0.28 * (broad * 0.5 + 0.5)
      + 0.73 * ridge + 0.10 * details - 0.44 * valley
    samples[j * n1 + i] = clamp(elevation, 0.07, 1.25)
  }
  return { samples, cells, n1 }
}

export function coastReliefAt(field, x, z, size) {
  const fx = clamp((x / size + 0.5) * field.cells, 0, field.cells)
  const fz = clamp((z / size + 0.5) * field.cells, 0, field.cells)
  const i = Math.min(field.cells - 1, Math.floor(fx))
  const j = Math.min(field.cells - 1, Math.floor(fz))
  const tx = fx - i, tz = fz - j
  const p = j * field.n1 + i, h = field.samples
  return lerp(lerp(h[p], h[p + 1], tx), lerp(h[p + field.n1], h[p + field.n1 + 1], tx), tz)
}

/** Intensidad local de acantilado; el control sólo define la tendencia global. */
export function coastalCliffMix(relief, cliffStrength) {
  const zone = smooth((relief - 0.16) / 0.76)
  return clamp(cliffStrength * (0.42 + 1.65 * zone) + (zone - 0.5) * 0.28, 0, 1)
}

/** Altura máxima automática relacionada con la dimensión física de la pieza. */
export function coastalReliefScale(size, shape) {
  return clamp(size * (shape === 'island' ? 0.15 : 0.11), 2, 240)
}

/**
 * Relajación térmica ligera, determinista y conservativa (3 pasos).
 * Desplaza una pequeña cantidad de suelo de pendientes excesivas hacia
 * vecinos más bajos. Se limita al interior: playa, línea costera y fondos
 * marinos no cambian de signo ni se erosionan accidentalmente.
 * El talud usa metros reales por celda y no depende de la resolución del mesh.
 */
export function relaxCoastalSlopes(heights, distances, segments, step, beachWidth, segmentsZ = segments) {
  const n1 = segments + 1
  const delta = new Float32Array(heights.length)
  const shoreBuffer = Math.max(step * 2.1, beachWidth * 1.4)
  const talus = step * 0.37
  for (let pass = 0; pass < 3; pass++) {
    delta.fill(0)
    for (let j = 1; j < segmentsZ; j++) for (let i = 1; i < segments; i++) {
      const at = j * n1 + i
      if (distances[at] <= shoreBuffer) continue
      const here = heights[at]
      let moved = 0
      for (let dir = 0; dir < 4; dir++) {
        const nb = dir === 0 ? at - 1 : dir === 1 ? at + 1 : dir === 2 ? at - n1 : at + n1
        if (distances[nb] <= shoreBuffer) continue
        const excess = here - heights[nb] - talus
        if (excess <= 0) continue
        const amount = excess * 0.085
        moved += amount
        delta[nb] += amount
      }
      delta[at] -= moved
    }
    for (let k = 0; k < heights.length; k++) heights[k] += delta[k]
  }
}

/**
 * Los documentos previos a CORR-002 no guardaban versión. Se identifican como
 * legacy sin volver a generar ni alterar el heightmap al abrirlos.
 * Generate es la única acción que actualiza el algoritmo y su versión; el
 * proyecto conserva los vértices serializados mientras no se regenere.
 */
export function storedTerrainGeneratorParams(data) {
  if (!data) return null
  const params = terrainGeneratorParams(data)
  if (data.shape !== 'terrain' && data.reliefVersion == null) params.reliefVersion = 1
  if (data.shape !== 'terrain' && data.coastlineVersion == null) params.coastlineVersion = 1
  return params
}
