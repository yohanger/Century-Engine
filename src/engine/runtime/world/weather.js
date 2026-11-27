// Clima: presets numéricos (nubes, niebla, precipitación, luz) que se mezclan entre sí, y un modelo de viento con rachas.
// Todo son números: `blend()` interpola cualquier par de estados, así los cambios de tiempo son graduales (game.weather.set(…, 20 s)).
// Sin DOM ni THREE. Añadir un tiempo nuevo = añadir una entrada a PRESETS.

/**
 * type (0 estrato · 0,5 cúmulo · 1 cumulonimbo) / coverage/density/altitude/thickness/erosion/tint/light → nubes volumétricas (render/skylib.js)
 * sun: fracción de luz directa que llega al suelo · dark: oscurecimiento del cielo y del ambiente
 * fog: densidad de niebla exponencial · rain / snow: 0–1 (cantidad de precipitación)
 * windBoost: m/s que suma al viento del nivel · bolts: relámpagos por minuto (con «Relámpagos» activado)
 * humidity: humedad relativa 0–1 a la temperatura de referencia · temp: desvío de temperatura (°C) respecto a la base de la escena (ver atmosphere.js)
 */
export const PRESETS = {
  clear:    { label: 'Despejado', type: 0.5, coverage: 0.12, density: 0.6, altitude: 1900, thickness: 800, erosion: 0.65, tint: [1, 1, 1], light: 1, sun: 1, dark: 0, fog: 0, rain: 0, snow: 0, windBoost: 0, bolts: 0, humidity: 0.45, temp: 2 },
  partly:   { label: 'Parcialmente nublado', type: 0.5, coverage: 0.42, density: 0.9, altitude: 1600, thickness: 1200, erosion: 0.55, tint: [1, 1, 1], light: 1, sun: 0.85, dark: 0.05, fog: 0, rain: 0, snow: 0, windBoost: 1, bolts: 0, humidity: 0.5, temp: 1 },
  cloudy:   { label: 'Nublado', type: 0.45, coverage: 0.7, density: 1.05, altitude: 1400, thickness: 1500, erosion: 0.45, tint: [0.92, 0.94, 0.97], light: 0.9, sun: 0.5, dark: 0.18, fog: 0.0008, rain: 0, snow: 0, windBoost: 2, bolts: 0, humidity: 0.65, temp: 0 },
  overcast: { label: 'Cubierto', type: 0.1, coverage: 0.9, density: 1.2, altitude: 1200, thickness: 1700, erosion: 0.35, tint: [0.84, 0.87, 0.91], light: 0.75, sun: 0.22, dark: 0.34, fog: 0.0018, rain: 0, snow: 0, windBoost: 2, bolts: 0, humidity: 0.8, temp: -1 },
  fog:      { label: 'Niebla', type: 0.05, coverage: 0.75, density: 0.9, altitude: 900, thickness: 900, erosion: 0.3, tint: [0.88, 0.9, 0.92], light: 0.7, sun: 0.3, dark: 0.22, fog: 0.032, rain: 0, snow: 0, windBoost: -1, bolts: 0, humidity: 0.97, temp: -2 },
  drizzle:  { label: 'Llovizna', type: 0.1, coverage: 0.85, density: 1.1, altitude: 1200, thickness: 1600, erosion: 0.35, tint: [0.78, 0.81, 0.86], light: 0.7, sun: 0.25, dark: 0.3, fog: 0.004, rain: 0.28, snow: 0, windBoost: 1, bolts: 0, humidity: 0.9, temp: -2 },
  rain:     { label: 'Lluvia', type: 0.15, coverage: 0.94, density: 1.5, altitude: 1000, thickness: 2000, erosion: 0.4, tint: [0.62, 0.66, 0.72], light: 0.6, sun: 0.12, dark: 0.45, fog: 0.007, rain: 0.7, snow: 0, windBoost: 3, bolts: 0, humidity: 0.92, temp: -3 },
  storm:    { label: 'Tormenta', type: 1, coverage: 1, density: 2.1, altitude: 900, thickness: 2600, erosion: 0.7, tint: [0.42, 0.45, 0.52], light: 0.5, sun: 0.04, dark: 0.62, fog: 0.011, rain: 1, snow: 0, windBoost: 9, bolts: 7, humidity: 0.88, temp: -4 },
  snow:     { label: 'Nieve', type: 0.15, coverage: 0.9, density: 1.1, altitude: 1100, thickness: 1500, erosion: 0.35, tint: [0.9, 0.92, 0.96], light: 0.8, sun: 0.3, dark: 0.22, fog: 0.012, rain: 0, snow: 0.75, windBoost: 1, bolts: 0, humidity: 0.85, temp: -26 },
}
export const WEATHER_LIST = Object.entries(PRESETS).map(([id, p]) => [id, p.label])
export const WEATHER_IDS = Object.keys(PRESETS)

const ramp = (lo, hi, value) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

/** Transmisión media de una capa sin celdas: huecos y extinción dentro de la nube. */
export function cloudBeamTransmission(coverage, density, elevationY = 1) {
  const altitude = Math.max(0, Math.min(1, elevationY))
  const path = 1 / Math.sqrt(0.25 + 0.75 * altitude * altitude)
  const open = (1 - ramp(0.25, 1, coverage)) ** path
  return open + (1 - open) * Math.exp(-4.8 * Math.max(0, density) * path)
}

const NUMERIC = ['type', 'coverage', 'density', 'altitude', 'thickness', 'erosion', 'light', 'sun', 'dark', 'fog', 'rain', 'snow', 'windBoost', 'bolts', 'humidity', 'temp']
const lerp = (a, b, t) => a + (b - a) * t

/** Mezcla dos estados de clima (t = 0 → a, t = 1 → b). */
export function blend(a, b, t) {
  t = Math.min(1, Math.max(0, t))
  const o = { label: t < 0.5 ? a.label : b.label, tint: [0, 1, 2].map((i) => lerp(a.tint[i], b.tint[i], t)) }
  for (const k of NUMERIC) o[k] = lerp(a[k], b[k], t)
  return o
}

/** Estado de un tiempo a una intensidad: 0 = despejado, 1 = pleno. Los tiempos «suaves» no cambian de aspecto bruscamente. */
export function resolveWeather(id, intensity = 1) {
  const p = PRESETS[id] || PRESETS.clear
  return blend(PRESETS.clear, p, Math.min(1, Math.max(0, intensity)))
}

// ---------------- viento ----------------
/**
 * Viento en el instante `t` (s). `speed` en m/s, `dir` en grados (hacia dónde sopla: 0 = norte −Z, 90 = este +X), `gusts` 0–1.
 * Suma de senos con frecuencias inconmensurables: no se repite de forma perceptible y no necesita estado ni aleatoriedad.
 * Devuelve { speed, dir, x, z } (x, z = velocidad en m/s en ejes del motor).
 */
export function windAt(t, speed = 3, dir = 0, gusts = 0.35) {
  const g = Math.min(1, Math.max(0, gusts))
  const n = 0.5 * Math.sin(t * 0.37 + 1.3) + 0.3 * Math.sin(t * 0.91 + 4.1) + 0.2 * Math.sin(t * 2.3 + 0.2)   // −1…1
  const sp = Math.max(0, speed * (1 + g * 0.8 * n))
  const d = dir + g * 25 * (0.6 * Math.sin(t * 0.23 + 2.2) + 0.4 * Math.sin(t * 0.71 + 5.5))
  const a = (d * Math.PI) / 180
  return { speed: sp, dir: d, x: Math.sin(a) * sp, z: -Math.cos(a) * sp }
}

/** Escala de Beaufort (0–12) y nombre, para mostrar el viento. */
export function beaufort(ms) {
  const lim = [0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]
  const n = lim.findIndex((l) => ms < l)
  const b = n < 0 ? 12 : n
  return [b, ['Calma', 'Ventolina', 'Flojito', 'Flojo', 'Moderado', 'Fresquito', 'Fresco', 'Frescachón', 'Temporal', 'Temporal fuerte', 'Temporal duro', 'Temporal muy duro', 'Huracán'][b]]
}
