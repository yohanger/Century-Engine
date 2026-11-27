// Datos de luz y de niebla volumétrica (sin DOM). Las luces guardan sus campos nuevos con valores por defecto
// que reproducen el comportamiento anterior: una luz antigua se ve exactamente igual.

export const LIGHT_MODES = { dynamic: 'Dinámica', mixed: 'Mixta', baked: 'Estática (horneada)' }
export const SHADOW_RES = [512, 1024, 2048, 4096]

export const LIGHT_DEFAULTS = {
  mode: 'dynamic',          // dinámica: sombras cada fotograma · mixta/estática: sombras en caché (y base del baking)
  temperature: 0,           // K; 0 = sin temperatura (sólo el color)
  shadowRes: 1024, shadowBias: 0.0004, shadowNormalBias: 0.04, shadowDistance: 60,
  decay: 1,                    // luces guardadas sin el campo conservan la atenuación anterior
  penumbra: 1, areaWidth: 2, areaHeight: 1,
  flareOn: false, flareSize: 72, flareIntensity: 1,
  volumetric: false, volIntensity: 1,
}

const num = (v, d, a, b) => (Number.isFinite(+v) && v !== '' && v !== null && v !== undefined ? Math.min(b, Math.max(a, +v)) : d)

/** Campos de luz válidos (lo que falta se rellena con los valores por defecto). */
export function normalizeLight(l = {}) {
  const d = LIGHT_DEFAULTS
  return {
    ...l,
    // RectAreaLight no tiene sombras ni baking en el trazador actual.
    mode: l.type === 'area' ? 'dynamic' : LIGHT_MODES[l.mode] ? l.mode : d.mode,
    areaWidth: num(l.areaWidth, d.areaWidth, 0.05, 100), areaHeight: num(l.areaHeight, d.areaHeight, 0.05, 100),
    flareOn: !!l.flareOn && ['omni', 'spot', 'directional', 'area'].includes(l.type),
    flareSize: num(l.flareSize, d.flareSize, 16, 256),
    flareIntensity: num(l.flareIntensity, d.flareIntensity, 0, 2),
    temperature: l.temperature ? num(l.temperature, 0, 1000, 20000) : 0,
    shadowRes: SHADOW_RES.includes(+l.shadowRes) ? +l.shadowRes : d.shadowRes,
    shadowBias: num(l.shadowBias, d.shadowBias, 0, 0.05), shadowNormalBias: num(l.shadowNormalBias, d.shadowNormalBias, 0, 1),
    shadowDistance: num(l.shadowDistance, d.shadowDistance, 5, 500),
    decay: +l.decay === 2 ? 2 : d.decay,
    penumbra: num(l.penumbra, d.penumbra, 0, 1),
    volumetric: !!l.volumetric, volIntensity: num(l.volIntensity, d.volIntensity, 0, 20),
  }
}

/** Color de un cuerpo negro (K) → [r,g,b] en 0..1 sRGB (aproximación de Tanner Helland). */
export function kelvinToRgb(k) {
  const t = Math.min(40000, Math.max(1000, k)) / 100
  let r, g, b
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661 } else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492) }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const c = (v) => Math.min(255, Math.max(0, v)) / 255
  return [c(r), c(g), c(b)]
}

export const VOL_DEFAULTS = {
  volOn: false, volDensity: 0.03, volAniso: 0.6, volDistance: 60, volColor: '#ffffff',
  volAmbient: 0.3, volHeight: 0, volFalloff: 0, volIntensity: 1,
  volNoise: 0, volNoiseScale: 12, volNoiseSpeed: 1.5, // ruido 3D animado: cantidad (0 = niebla lisa), tamaño de los bancos (m) y velocidad del viento (m/s)
}
export function normalizeVolumetric(e = {}) {
  const d = VOL_DEFAULTS
  return {
    volOn: !!e.volOn, volDensity: num(e.volDensity, d.volDensity, 0, 1), volAniso: num(e.volAniso, d.volAniso, -0.9, 0.95),
    volDistance: num(e.volDistance, d.volDistance, 5, 500), volColor: /^#[0-9a-f]{6}$/i.test(e.volColor) ? e.volColor : d.volColor,
    volAmbient: num(e.volAmbient, d.volAmbient, 0, 3), volHeight: num(e.volHeight, d.volHeight, -200, 2000), volFalloff: num(e.volFalloff, d.volFalloff, 0, 2),
    volIntensity: num(e.volIntensity, d.volIntensity, 0, 10),
    volNoise: num(e.volNoise, d.volNoise, 0, 1), volNoiseScale: num(e.volNoiseScale, d.volNoiseScale, 1, 200), volNoiseSpeed: num(e.volNoiseSpeed, d.volNoiseSpeed, 0, 30),
  }
}
