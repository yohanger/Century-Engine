// Importar un tipo aquí lo registra. Para añadir uno nuevo: crear nodes/<tipo>.js y añadir su import.
import './base.js'
import './physics.js'
import './group.js'
import './primitive.js'
import './subtract.js'
import './mesh-subtract.js'
import './light.js'
import './spawn.js'
import './camera.js'
import './camera-shake.js'
import './trigger.js'
import './atmovolume.js'
import './postvolume.js'
import './navigation.js'
import './event.js'
import './gameplay-object.js'
import './model.js'
import './decal.js'
import './mesh.js'
import './text.js'
import './road.js'
import './water.js'
import './fluid-container.js'
import './terrain.js'
import './nature.js'
import './audio.js'
import './canvas.js'
import './critters.js'
import './sprite.js'
import './vfx.js'
import { getDef, allDefs } from './registry.js'
import { migrateObjectGroups } from '../layers.js'

export { getDef, allDefs }
export { LIGHT_TYPES } from './light.js'

/** Objeto de escena completo a partir del tipo; `extra` sobrescribe lo que haga falta. */
export function makeObject(type, kind, extra = {}) {
  const def = getDef(type)
  if (!def) throw new Error(`Tipo de nodo desconocido: ${type}`)
  const base = {
    id: '', name: '', type, kind: kind || type, parentId: null, open: true,
    active: true, visible: true, locked: false, tag: 'Untagged', groups: [], layers: [0], props: {}, scriptIds: [],
  }
  if (def.base !== 'Node') Object.assign(base, {
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  })
  // Hasta S02, los nodos ya existentes conservan sus campos visuales/físicos.
  // No añadimos esas propiedades a los nuevos Node/Node3D.
  if (type !== 'node' && type !== 'node3d' && type !== 'sceneInstance' && type !== 'vfx' && type !== 'terrain' && !def.physicsNode) Object.assign(base, {
    color: '#9aa4b5', roughness: 0.8, metallic: 0, opacity: 1,
    castShadow: true,
  })
  Object.assign(base, getDef(type)?.create(kind) || {})
  const obj = Object.assign(base, extra)
  // Recursos anteriores aún pueden entrar por constructores ajenos a la carga de escena.
  if (!Object.hasOwn(extra, 'scriptIds')) obj.scriptIds = obj.scriptId ? [obj.scriptId] : []
  delete obj.scriptId
  if (!Object.hasOwn(extra, 'groups') && extra.tag && extra.tag !== 'Untagged') delete obj.groups
  return migrateObjectGroups(obj)
}

export const kindLabel = (o) => {
  const d = getDef(o.type)
  return d?.kinds?.[o.kind]?.label || d?.label || o.type
}
export const kindIcon = (o) => {
  const d = getDef(o.type)
  return d?.kinds?.[o.kind]?.icon || d?.icon || 'box'
}
