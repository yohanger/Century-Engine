// Niebla atmosférica física (bloque D, portada de FrostEnvironmentVolumetricFog): densidad exponencial con la altura integrada de forma
// analítica a lo largo del rayo, escala por humedad, dispersión solar Henyey-Greenstein + ambiente, haces de sol y volúmenes atmosféricos
// (cajas que «cierran» la niebla en interiores). JS puro (sin DOM, THREE ni WebAudio): el shader (render/atmofog.js) reproduce estas
// mismas fórmulas y los tests comparan ambos lados. Unidades: metros y 1/m. Norte −Z, este +X.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const lerp = (a, b, t) => a + (b - a) * t
const sat = (x) => clamp(x, 0, 1)

/** Constantes del modelo de Frost (las que no dependen de las unidades de la densidad). */
export const FOG = {
  MIN_EXTINCTION: 1e-5,
  MAX_DISTANCE: 2400,        // m: más allá la niebla ya no integra (el cielo cuenta como esta distancia)
  FALLOFF_DRY: 0.00085,      // 1/m: caída con la altura con aire seco (escala ≈ 1,2 km)
  FALLOFF_WET: 0.00185,      // 1/m: con aire saturado la niebla se pega al suelo (escala ≈ 540 m)
  ANISO_DRY: 0.5, ANISO_WET: 0.69, // g de Henyey-Greenstein: más humedad = más dispersión hacia delante
  HUM_SCALE_DRY: 0.82, HUM_SCALE_WET: 1.28, // la humedad multiplica la extinción
  AMBIENT_DRY: 0.58, AMBIENT_WET: 0.78,     // cuánto del color de niebla llega como luz difusa
  DEPTH_RESPONSE_MIN: 0.65,  // la luz solar dispersada pierde hasta un 35 % en las nieblas más espesas
  HG_NORM: 0.22, HG_MAX: 3,
  SHAFT_SAMPLES: 12, SHAFT_DECAY: 0.91, SHAFT_NORM: 7.5,
  SHAFT_DRY: 0.35, SHAFT_WET: 0.72,
  REF_DENSITY: 0.01,         // 1/m: densidad a la que los haces llegan a su fuerza completa (Century mide en 1/m; ver README)
  VISIBILITY_K: 3.912,       // ley de Koschmieder: V = 3,912 / β (contraste umbral 2 %)
}

export const FOG_DEFAULTS = { fogMode: 'simple', fogFalloff: 0, fogHeight: 0, fogShafts: 1, fogScatter: 1 }
const num = (v, d, a, b) => (Number.isFinite(+v) && v !== '' && v !== null ? clamp(+v, a, b) : d)
/** Ajustes de la niebla física de una escena (environment.fog*): valores sin sanear → valores dentro de rango. */
export function normalizeFog(e = {}) {
  const d = FOG_DEFAULTS
  return {
    fogMode: e.fogMode === 'physical' ? 'physical' : 'simple',
    fogFalloff: num(e.fogFalloff, d.fogFalloff, 0, 0.05), // 0 = automática por humedad
    fogHeight: num(e.fogHeight, d.fogHeight, -500, 5000),
    fogShafts: num(e.fogShafts, d.fogShafts, 0, 3),
    fogScatter: num(e.fogScatter, d.fogScatter, 0, 3),
  }
}

export const FOG_MODES = [['simple', 'Simple (exponencial uniforme)'], ['physical', 'Física (altura, humedad, sol y haces)']]

/**
 * Parámetros derivados. `density` = extinción al nivel de referencia (1/m), `humidity` 0–1, `falloff` 0 = automático (humedad),
 * `maxDistance` opcional (se recorta al plano lejano de la cámara).
 */
export function fogParams({ density = 0, humidity = 0.5, falloff = 0, baseHeight = 0, maxDistance = FOG.MAX_DISTANCE, start = 0, scatter = 1 } = {}) {
  const h = sat(humidity)
  return {
    extinction: Math.max(0, density) * lerp(FOG.HUM_SCALE_DRY, FOG.HUM_SCALE_WET, h),
    humidityScale: lerp(FOG.HUM_SCALE_DRY, FOG.HUM_SCALE_WET, h),
    falloff: falloff > 0 ? falloff : lerp(FOG.FALLOFF_DRY, FOG.FALLOFF_WET, h),
    anisotropy: lerp(FOG.ANISO_DRY, FOG.ANISO_WET, h),
    ambient: lerp(FOG.AMBIENT_DRY, FOG.AMBIENT_WET, h),
    baseHeight, humidity: h, density: Math.max(0, density), start: Math.max(0, start), scatter: Math.max(0, scatter),
    maxDistance: clamp(maxDistance, 1, FOG.MAX_DISTANCE),
    on: density > FOG.MIN_EXTINCTION,
  }
}

/** Densidad relativa a la altura `y`: 1 por debajo de la base, exp(−falloff·(y−base)) por encima. */
export const heightDensity = (y, base, falloff) => Math.exp(-Math.max(0, y - base) * falloff)

/**
 * ∫ exp(−k·(y−base)) ds sobre un tramo que queda entero por encima de la base. Forma estable: len·e^(−k·h₀)·(1−e^(−x))/x con
 * x = k·rayY·len (serie de Taylor para |x| < 0,01). Mejora deliberada sobre Frost, que por debajo de |k·rayY| < 1e-5 usaba la
 * densidad del punto inicial (error de hasta ~1 % en rayos casi horizontales largos). El shader usa exactamente la misma forma.
 */
export const FRACTION_EPS = 1e-2
export const decayFraction = (x) => (Math.abs(x) < FRACTION_EPS ? 1 - x / 2 + (x * x) / 6 - (x * x * x) / 24 : (1 - Math.exp(-x)) / x)
function integrateAbove(startY, rayY, len, base, k) {
  if (len <= 1e-4) return 0
  return heightDensity(startY, base, k) * len * decayFraction(k * rayY * len)
}

/**
 * Densidad integrada (m equivalentes a densidad 1) del rayo que sale de `originY` con componente vertical `rayY` (−1…1), entre
 * `start` y `start+len` metros. Por debajo de `base` la densidad es 1; por encima decae exponencialmente.
 */
export function integrateHeight(originY, rayY, start, len, base, k) {
  if (len <= 1e-4) return 0
  const startY = originY + rayY * start, endY = startY + rayY * len
  if (startY <= base && endY <= base) return len
  if (startY > base && endY > base) return integrateAbove(startY, rayY, len, base, k)
  if (Math.abs(rayY) <= 1e-5) return heightDensity(startY, base, k) * len
  const cross = clamp((base - startY) / rayY, 0, len)
  if (startY <= base) return cross + integrateAbove(base, rayY, len - cross, base, k)
  return integrateAbove(startY, rayY, cross, base, k) + (len - cross)
}

/** Fase de Henyey-Greenstein (escalada como en Frost) para el coseno entre la vista y el sol. */
export function hg(cosViewSun, g) {
  const gg = sat(g), g2 = gg * gg
  const den = Math.max(0.025, 1 + g2 - 2 * gg * cosViewSun)
  return Math.min(FOG.HG_MAX, ((1 - g2) / Math.pow(den, 1.5)) * FOG.HG_NORM)
}

// ── volúmenes atmosféricos ────────────────────────────────────────────────────────────────────────────────────────────────

/** Rotación (cuaternión x,y,z,w) → matriz 3×3 mundo→local (la transpuesta), fila a fila. */
function worldToLocal(q) {
  const [x, y, z, w] = q, xx = x * x, yy = y * y, zz = z * z
  const xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z
  // matriz de rotación local→mundo R; la inversa es Rᵀ
  const R = [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), 2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx), 2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)]
  return [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]
}

/**
 * Volumen atmosférico: caja orientada centrada en `position`, de tamaño `size` (m) = la escala del nodo, con `exchange` 0–1
 * (0 = interior cerrado: dentro no hay niebla hasta la salida; 1 = abierto: la niebla entra entera).
 */
export function makeVolume({ position = [0, 0, 0], rotation = [0, 0, 0, 1], size = [8, 3, 8], exchange = 0 } = {}) {
  const half = size.map((s) => Math.max(1e-4, Math.abs(s) * 0.5))
  return { position: position.slice(), rotation: rotation.slice(), size: size.slice(), half, exchange: sat(exchange), m: worldToLocal(rotation), volume: Math.max(1e-6, Math.abs(size[0] * size[1] * size[2])) }
}

function localPoint(v, p) { const d = [p[0] - v.position[0], p[1] - v.position[1], p[2] - v.position[2]], m = v.m; return [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[3] * d[0] + m[4] * d[1] + m[5] * d[2], m[6] * d[0] + m[7] * d[1] + m[8] * d[2]] }
function localDir(v, d) { const m = v.m; return [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[3] * d[0] + m[4] * d[1] + m[5] * d[2], m[6] * d[0] + m[7] * d[1] + m[8] * d[2]] }

export function volumeContains(v, p) {
  const l = localPoint(v, p), e = 1e-4
  return Math.abs(l[0]) <= v.half[0] + e && Math.abs(l[1]) <= v.half[1] + e && Math.abs(l[2]) <= v.half[2] + e
}

/** El volumen más pequeño que contiene el punto (la regla de Frost para volúmenes anidados), o null. */
export function resolveVolume(volumes, p) {
  let best = null
  for (const v of volumes || []) if (volumeContains(v, p) && (!best || v.volume < best.volume)) best = v
  return best
}

/** Distancia (m) hasta que el rayo sale de la caja, 0 si el origen está fuera; recortada a `maxDistance`. */
export function volumeExitDistance(v, origin, ray, maxDistance) {
  if (!v) return 0
  const o = localPoint(v, origin)
  if (Math.abs(o[0]) > v.half[0] + 1e-4 || Math.abs(o[1]) > v.half[1] + 1e-4 || Math.abs(o[2]) > v.half[2] + 1e-4) return 0
  const d = localDir(v, ray).map((c) => (Math.abs(c) < 1e-6 ? (c < 0 ? -1e-6 : 1e-6) : c))
  let far = Infinity
  for (let i = 0; i < 3; i++) {
    const t0 = (-v.half[i] - o[i]) / d[i], t1 = (v.half[i] - o[i]) / d[i]
    far = Math.min(far, Math.max(t0, t1))
  }
  return clamp(far, 0, maxDistance)
}

/** Dónde empieza la niebla en un rayo: la salida del volumen escalada por (1 − intercambio). */
export function integrationStart(vol, origin, ray, surfaceDistance) {
  if (!vol) return 0
  return volumeExitDistance(vol, origin, ray, surfaceDistance) * (1 - sat(vol.exchange))
}

// ── referencia en CPU del shader ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lo que el shader calcula por píxel, en CPU: transmitancia y luz dispersada hacia la cámara.
 * `ray` unitario; `dist` = distancia a la superficie (o a la distancia máxima si es cielo); `sun` = { dir, color:[r,g,b], intensity }.
 */
export function fogRay({ params: P, originY, ray, dist, color = [0.6, 0.65, 0.72], sun = { dir: [0, 1, 0], color: [1, 1, 1], intensity: 1 }, volume = null, origin = [0, originY, 0] }) {
  const d = Math.min(dist, P.maxDistance)
  const start = Math.max(P.start || 0, integrationStart(volume, origin, ray, d))
  const len = Math.max(0, d - start)
  if (len <= 1e-4 || !P.on) return { transmittance: 1, rgb: [0, 0, 0], opticalDepth: 0, start, length: len }
  const cosVS = ray[0] * sun.dir[0] + ray[1] * sun.dir[1] + ray[2] * sun.dir[2]
  const phase = hg(cosVS, P.anisotropy)
  const integ = integrateHeight(originY, ray[1], start, len, P.baseHeight, P.falloff)
  const tau = Math.max(0, P.extinction * integ), T = Math.exp(-tau), s = 1 - T
  const mean = tau > 1e-4 ? s / tau : 1
  const resp = lerp(FOG.DEPTH_RESPONSE_MIN, 1, Math.sqrt(sat(mean)))
  const rgb = [0, 1, 2].map((i) => sat(s * (color[i] * P.ambient + sun.color[i] * Math.max(0, sun.intensity) * phase * resp * (P.scatter ?? 1))))
  return { transmittance: sat(T), rgb, opticalDepth: tau, start, length: len }
}

/** Fuerza de los haces (0–1): sol dentro del encuadre, intensidad del sol, humedad y espesor de la niebla. */
export function shaftStrength({ sunInView, sunIntensity, humidity, density }) {
  const norm = sat(density / FOG.REF_DENSITY)
  return (sunInView ? 1 : 0) * sat(sunIntensity) * lerp(FOG.SHAFT_DRY, FOG.SHAFT_WET, sat(humidity)) * Math.sqrt(norm)
}

/** Visibilidad meteorológica (m) a la altura `y`: V = 3,912 / β(y). Infinita si no hay niebla. */
export function visibility(P, y = 0) {
  const beta = P.extinction * heightDensity(y, P.baseHeight, P.falloff)
  return beta <= 1e-9 ? Infinity : FOG.VISIBILITY_K / beta
}

/** Visibilidad horizontal a la altura `y` desde unos valores sueltos (para game.weather.visibility). */
export const visibilityOf = (density, humidity, y = 0, falloff = 0, baseHeight = 0) => visibility(fogParams({ density, humidity, falloff, baseHeight }), y)
