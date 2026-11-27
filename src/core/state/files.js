// Sistema de archivos del proyecto: caché de URLs de los archivos y tipos MIME.
import * as db from '../db.js'
import { extOf } from '../project.js'
import { store } from './state.js'

// =====================================================================
export const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }
export const urlCache = new Map()
/** URL temporal (blob:) de un asset, para mostrar miniaturas de texturas. */
export async function assetUrl(id, projectId = store.project.id) {
  if (urlCache.has(id)) return urlCache.get(id)
  const a = await db.getAsset(projectId, id)
  if (!a) return null
  const u = URL.createObjectURL(new Blob([a.bytes], { type: MIME[extOf(a.name)] || 'application/octet-stream' }))
  urlCache.set(id, u)
  return u
}
