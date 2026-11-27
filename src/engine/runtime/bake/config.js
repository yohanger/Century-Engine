// Ajustes del baking (project.bake) y GI por objeto. Sin DOM: lo usa también el test de Node.
export const BAKE_DEFAULTS = {
  samples: 128,        // muestras por texel (más = menos ruido)
  bounces: 3,          // rebotes de luz
  density: 12,         // texels por metro (resolución del lightmap)
  maxSize: 512,        // lado máximo de un lightmap
  probeSpacing: 3,     // separación entre sondas (m)
  skyIntensity: 1,     // multiplica la luz del cielo horneada
  denoise: true,
  lightRadius: 0.1,    // radio de las luces de punto para sombras suaves (m)
  sunAngle: 1.5,       // tamaño angular del sol (°) para sombras suaves
  gpuUsage: 0.5,       // fracción de tiempo de GPU que puede usar el horneado (0.1–1): menos = el editor sigue fluido
}
const num = (v, d, a, b) => (Number.isFinite(+v) && v !== '' && v !== null && v !== undefined ? Math.min(b, Math.max(a, +v)) : d)
export function normalizeBake(b = {}) {
  const d = BAKE_DEFAULTS
  return {
    samples: Math.round(num(b.samples, d.samples, 4, 4096)), bounces: Math.round(num(b.bounces, d.bounces, 1, 8)),
    density: num(b.density, d.density, 1, 64), maxSize: [128, 256, 512, 1024, 2048].includes(+b.maxSize) ? +b.maxSize : d.maxSize,
    probeSpacing: num(b.probeSpacing, d.probeSpacing, 0.5, 20), skyIntensity: num(b.skyIntensity, d.skyIntensity, 0, 4),
    denoise: b.denoise !== false, lightRadius: num(b.lightRadius, d.lightRadius, 0, 2), sunAngle: num(b.sunAngle, d.sunAngle, 0, 10),
    gpuUsage: num(b.gpuUsage, d.gpuUsage, 0.1, 1),
  }
}

/** Modo de GI de un objeto: 'lightmap' (estático, recibe el lightmap) · 'probes' (dinámico, recibe sondas) · 'off'. */
export const GI_MODES = { lightmap: 'Estático (lightmap)', probes: 'Dinámico (sondas)', off: 'Ninguno' }
export function giOf(obj) {
  if (obj.gi && GI_MODES[obj.gi]) return obj.gi
  return ['primitive', 'mesh', 'model', 'road', 'text'].includes(obj.type) ? 'lightmap' : 'probes'
}
