// Contrato único de relieve PBR (datos serializables). Sin renderer adicional ni migración obligatoria.
// Ausencia de surfaceDetail = material heredado intacto; 'none' desactiva el relieve nuevo.
export const SURFACE_DETAIL_MODES = Object.freeze(['none', 'normal', 'height', 'procedural'])
const limit = (v, fallback, min, max) => v !== null && v !== '' && v !== undefined && Number.isFinite(+v)
  ? Math.max(min, Math.min(max, +v)) : fallback
export function normalizeSurfaceDetail(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return {
    mode: SURFACE_DETAIL_MODES.includes(value.mode) ? value.mode : 'none',
    texture: typeof value.texture === 'string' ? value.texture : '',
    strength: limit(value.strength, 1, 0, 4),
    micro: limit(value.micro, 0, 0, 1),
    microScale: limit(value.microScale, 0.12, 0.01, 2),
  }
}
/** Los materiales anteriores siguen utilizando los parámetros que almacenaban originalmente. */
export function surfaceDetailFromLegacy(mat = {}) {
  const p = mat.params || {}
  return {
    mode: p.uNormal ? 'normal' : 'procedural',
    texture: p.uNormal || '',
    strength: limit(p.uNormalStrength, 1, 0, 4),
    micro: limit(p.uMicro, 0.35, 0, 1),
    microScale: limit(p.uMicroScale, 0.12, 0.01, 2),
  }
}
/** Los parámetros estándar solo se exponen para shaders que realmente los admiten. */
export function surfaceDetailSupport(shaderId) {
  if (!shaderId || shaderId === 'builtin:blockout') return { normal: true, height: true, procedural: false }
  if (shaderId === 'builtin:realista') return { normal: true, height: true, procedural: true }
  return { normal: false, height: false, procedural: false }
}
