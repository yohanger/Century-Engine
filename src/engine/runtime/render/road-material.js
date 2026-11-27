// Adaptador de carretera al contrato PBR existente; no crea un renderer de materiales paralelo.
import { effectiveMaterialObject } from './material-resource.js'
import { roadSurfaceColor } from '../geometry/road.js'

/** Resuelve un slot local o un recurso .material, conservando intactos los valores heredados. */
export function roadSlotMaterial(slot, key, materials = [], roadOpacity = 1) {
  const local = {
    materialId: slot.materialId || '', color: roadSurfaceColor(slot, key),
    roughness: slot.roughness, metallic: slot.metallic ?? 0,
    opacity: slot.opacity ?? 1, mat: slot.mat || {},
  }
  const shared = materials.some((m) => m.id === local.materialId)
  const effective = effectiveMaterialObject(local, materials)
  const mat = { ...(effective.mat || {}), params: { ...(effective.mat?.params || {}) } }
  // Los controles de textura anteriores siguen funcionando al utilizar un shader PBR local.
  // El material compartido prevalece sin borrar la textura local para un futuro desvínculo.
  if (!shared && slot.texture && (mat.shader === 'builtin:blockout' || mat.shader === 'builtin:realista')) {
    mat.params.uAlbedo = slot.texture
    mat.params.uTile = slot.tile
  }
  return {
    // Material resuelto aquí: evitar que syncPbrMaterial lo resuelva otra vez y
    // sobrescriba la opacidad efectiva del nodo carretera.
    ...effective, materialId: '', mat, opacity: (effective.opacity ?? 1) * roadOpacity,
    directTexture: !shared ? slot.texture || null : null,
    shared,
  }
}

/** Las carreteras nuevas llevan Blockout; las antiguas no se migran ni cambian de apariencia. */
export const defaultNewRoadAsphalt = () => ({
  color: '#ffffff', roughness: 0.85,
  mat: { shader: 'builtin:blockout', mapping: 'object', params: {} },
})
