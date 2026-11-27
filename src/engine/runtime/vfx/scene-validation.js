import { validateVfxResource } from './resource.js'

export const VFX_SCENE_LIMIT = 4096

/** Valida referencias y presupuesto con los datos canónicos, sin mantener un registro paralelo. */
export function validateSceneVfx(objects = [], resources = [], assets = []) {
  const byId = new Map(resources.map((r) => [r.id, validateVfxResource(r)]))
  const textureIds = new Set(assets.filter((a) => a.kind === 'texture').map((a) => a.id))
  let total = 0
  for (const obj of objects) {
    if (obj.type !== 'vfx') continue
    const id = obj.props?.vfxId
    if (!id) continue // una instancia recién creada puede esperar asignación
    const resource = byId.get(id)
    if (!resource) throw new Error(`VFX3D «${obj.name || obj.id}»: no existe el recurso ${id}`)
    if (resource.appearance.textureId && !textureIds.has(resource.appearance.textureId)) {
      throw new Error(`VFX3D «${obj.name || obj.id}»: textura ausente ${resource.appearance.textureId}`)
    }
    total += resource.emission.capacity
    if (total > VFX_SCENE_LIMIT) throw new Error(`VFX3D: límite de escena (${VFX_SCENE_LIMIT} partículas) excedido`)
  }
  return total
}

