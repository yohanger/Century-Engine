// Agua: un solo modelo matemático compartido por el editor y el juego (GLSL, three.js) y por la exportación,
// para que el agua exportada se vea igual que en el editor.
//
//   Olas grandes (3 senos direccionales, relación de dispersión de aguas profundas) → desplazan la malla y dan la normal.
//   Ondulación fina (3 senos pequeños) → solo normal; la intensidad sube con el viento.
//   Color: mezcla «profundo → superficial» según la altura de la ola + espuma en las crestas.
//   Textura opcional (color o mapa de normales) que se desplaza con el viento.
//   Todo se apaga con la distancia a la cámara (evita parpadeos lejos).
import * as THREE from 'three'

export const WATER_DEFAULTS = {
  enabled: false,
  level: 0.3,
  followTerrain: true, // el agua mide lo mismo que el terreno
  size: 2000, // lado (m) cuando no sigue al terreno: un océano
  offsetX: 0, offsetZ: 0,
  color: '#3a78a8', // superficial
  deepColor: '#12365a',
  opacity: 0.8,
  roughness: 0.08,
  waveHeight: 0.5, // altura total de las olas grandes (m)
  waveLength: 14, // longitud de onda principal (m)
  waveSpeed: 1, // 0 = agua quieta
  wind: 0.5, // 0..1: más viento = olas y ondulación más marcadas
  windDir: 30, // grados
  ripples: 0.5, // intensidad de la ondulación fina
  rippleScale: 2.5, // tamaño de la ondulación fina (m)
  foam: 0.3, // espuma en las crestas
  clarity: 6, // profundidad (m) a la que el agua ya es del color «profundo»
  shoreFoam: 0.6, // espuma de orilla (donde el agua toca el terreno)
  shoreWidth: 1, // ancho (m) de la franja de espuma de orilla
  faceted: false, // estilo facetado (low-poly, PS1)
  texture: null, // id de asset
  textureMode: 'color', // color | normal
  textureScale: 8, // m por repetición
  textureSpeed: 0.3,
  textureStrength: 0.6,
  shaderAsset: null, // id de un shader propio de la exportación (el Runtime no lo usa)
}

/** Agua con todos los campos (los proyectos antiguos solo traen unos pocos). */
export const normalizeWater = (w) => ({ ...WATER_DEFAULTS, ...(w || {}) })

export const srgb = (hex) => { const c = new THREE.Color(hex).getRGB({}, THREE.SRGBColorSpace); return [c.r, c.g, c.b] }
const G = 9.81
// ángulo relativo al viento, fracción de longitud de onda, fracción de amplitud, fase
const BIG = [[0, 1, 1, 0], [0.62, 0.62, 0.55, 1.7], [-0.87, 0.37, 0.3, 4.1]]
const FINE = [[0.4, 1, 1, 0.3], [-0.9, 0.7, 0.8, 2.2], [1.9, 0.45, 0.6, 5.0]]

/** Parámetros de ondas ya resueltos (los mismos números que usan los dos shaders). */
export function waveSet(w) {
  const a = (w.windDir * Math.PI) / 180
  const amp0 = w.waveHeight * 0.5 * (0.6 + 0.8 * w.wind)
  const mk = (list, wl0, amp, speedK) => list.map(([da, fl, fa, ph]) => {
    const wl = Math.max(0.05, wl0 * fl), k = (2 * Math.PI) / wl
    return { dx: Math.cos(a + da), dz: Math.sin(a + da), k, amp: amp * fa, om: Math.sqrt(G * k) * w.waveSpeed * speedK, ph }
  })
  return { big: mk(BIG, w.waveLength, amp0, 1), fine: mk(FINE, w.rippleScale, w.ripples * 0.05 * (0.5 + w.wind), 1) }
}

/** Altura de las olas grandes y gradiente en (x,z) en el instante t: referencia en JS (para pruebas). */
export function waveAt(w, x, z, t) {
  const s = waveSet(w)
  let h = 0, gx = 0, gz = 0
  for (const o of s.big) { const p = o.k * (o.dx * x + o.dz * z) - o.om * t + o.ph; h += o.amp * Math.sin(p); const c = o.amp * o.k * Math.cos(p); gx += c * o.dx; gz += c * o.dz }
  return { h, gx, gz }
}

/** Malla del agua (plano XZ, y = 0): más densa en el centro, para que las olas se vean bien cerca y sea barata lejos. */
export function waterGrid(size, n = 160) {
  const half = size / 2
  const map = (u) => half * (0.15 * u + 0.85 * Math.sign(u) * Math.abs(u) ** 3)
  const positions = new Float32Array((n + 1) * (n + 1) * 3)
  const normals = new Float32Array((n + 1) * (n + 1) * 3)
  let k = 0
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    positions[k] = map((i / n) * 2 - 1); positions[k + 1] = 0; positions[k + 2] = map((j / n) * 2 - 1)
    normals[k + 1] = 1
    k += 3
  }
  const indices = new Uint32Array(n * n * 6)
  let q = 0
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1
    indices[q++] = a; indices[q++] = c; indices[q++] = b
    indices[q++] = b; indices[q++] = c; indices[q++] = d
  }
  return { positions, normals, indices }
}
