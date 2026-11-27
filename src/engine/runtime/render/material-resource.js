// Recurso Material de Century: datos serializables; el renderer sigue siendo el único consumidor PBR.
export const MATERIAL_FOLDER = 'Assets/Materials'
export const MATERIAL_EXT = '.material'
const own = (o, k, fallback) => o && Object.hasOwn(o, k) ? o[k] : fallback
const validColor = (v, def) => /^#[0-9a-f]{6}$/i.test(v || '') ? v : def
const scalar = (v, def, lo, hi) => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : def
import { normalizeSurfaceDetail } from './surface-detail.js'
import { normalizeRainAudio } from '../world/rain-audio-profile.js'
const clone = (v) => JSON.parse(JSON.stringify(v))

/** Mantiene el contrato anterior color/roughness/metallic/mat, ahora dentro de un recurso. */
export function normalizeMaterial(raw = {}) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const m = o.mat && typeof o.mat === 'object' && !Array.isArray(o.mat) ? o.mat : {}
  return {
    id: String(o.id || ''), name: String(o.name || 'Material.material'), folder: String(o.folder || MATERIAL_FOLDER),
    color: validColor(o.color, '#ffffff'), roughness: scalar(o.roughness, 0.8, 0, 1),
    metallic: scalar(o.metallic, 0, 0, 1), opacity: scalar(o.opacity, 1, 0.05, 1),
    mat: {
      shader: typeof m.shader === 'string' ? m.shader : '',
      mapping: m.mapping === 'object' ? 'object' : 'world',
      params: m.params && typeof m.params === 'object' && !Array.isArray(m.params) ? clone(m.params) : {},
      ...(m.maps && typeof m.maps === 'object' ? { maps: Object.fromEntries(Object.entries(m.maps).filter(([k,v]) => ['albedo','normal','roughness','metallic','ao','emission'].includes(k) && typeof v === 'string')) } : {}),
      physical: m.physical && typeof m.physical === 'object' && !Array.isArray(m.physical) ? clone(m.physical) : {},
      ...(m.surfaceDetail ? { surfaceDetail: normalizeSurfaceDetail(m.surfaceDetail) } : {}),
      ...(m.runoff != null ? { runoff: normalizedRunoff(m.runoff) } : {}),
      ...(m.rainAudio != null ? { rainAudio: normalizeRainAudio(m.rainAudio) } : {}),
    },
  }
}
export const normalizeMaterials = (list) => Array.isArray(list) ? list.map(normalizeMaterial) : []
export function materialFromObject(obj, id, name, folder = MATERIAL_FOLDER) {
  return normalizeMaterial({ id, name, folder, color: own(obj,'color','#ffffff'), roughness: own(obj,'roughness',0.8),
    metallic: own(obj,'metallic',0), opacity: own(obj,'opacity',1), mat: obj?.mat })
}
/** Si falta el recurso no se cambia nada: los proyectos antiguos y refs rotas conservan su material local. */
export function effectiveMaterialObject(obj, materials = []) {
  const material = obj?.materialId && materials.find((m) => m.id === obj.materialId)
  return material ? { ...obj, color: material.color, roughness: material.roughness, metallic: material.metallic,
    opacity: material.opacity, mat: material.mat } : obj
}

/** Perfil óptico no: propiedades físicas de escurrimiento expresadas en mm y m/s. */
export function normalizedRunoff(raw) {
  if (raw == null) return { enabled: false, retentionMm: 0, runoffMps: 0.25 }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.enabled !== 'boolean' ||
      !(typeof (raw.retentionMm ?? 0) === 'number' && Number.isFinite(raw.retentionMm ?? 0) && (raw.retentionMm ?? 0) >= 0) || (raw.retentionMm ?? 0) > 1000 ||
      !(typeof (raw.runoffMps ?? 0.25) === 'number' && Number.isFinite(raw.runoffMps ?? 0.25) && (raw.runoffMps ?? 0.25) >= 0) || (raw.runoffMps ?? 0.25) > 20)
    throw new RangeError('Material: escurrimiento hidráulico inválido')
  return { enabled: raw.enabled, retentionMm: raw.retentionMm ?? 0, runoffMps: raw.runoffMps ?? 0.25 }
}

