// Archivos del proyecto como datos: bytes, imagen decodificada, URL de objeto y desvincular texturas.
import * as db from '../db.js'
import { forgetLayerTexture } from '../../engine/runtime/geometry/terrain.js'
import { store } from './state.js'
import { assetUrl, urlCache } from './files.js'

/** Imagen decodificada de un archivo del proyecto (para las capas de pintura del terreno). */
/** Bytes y nombre de un archivo del proyecto (para cargadores especiales: HDR, EXR…). */
export async function assetData(id, projectId = store.project.id) {
  const a = await db.getAsset(projectId, id)
  return a ? { name: a.name, bytes: a.bytes } : null
}
export const audioAssetSource = id => db.assetVersion(store.project?.id, id)
export async function assetImage(id, projectId) {
  const url = await assetUrl(id, projectId)
  if (!url) return null
  const img = new Image()
  img.src = url
  await img.decode()
  return img
}
/** Las capas de terreno que usaban esa textura vuelven a su color plano. */
export function unlinkTexture(id) {
  for (const l of store.project.terrain?.layers || []) if (l.texture === id) l.texture = null
  forgetLayerTexture(id)
}
export function dropUrl(id) {
  const u = urlCache.get(id)
  if (u) { URL.revokeObjectURL(u); urlCache.delete(id) }
}
