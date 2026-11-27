import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase } from './three-helpers.js'
import { buildEventGraphic } from './event.js'
import { graphicOf } from '../database/models.js'
import { gameplayRecord } from '../gameplay/object-state.js'
import { buildPrefabGraphic } from './prefab-graphic.js'
import { defaultIndicatorZones } from '../interaction/volumes.js'
import { updateIndicatorGizmos } from './interaction-zones.js'

// Un Gameplay Object es un nodo de escena, no una página de evento.
export default registerNode({
  type: 'gameplayObject', label: 'Objeto interactuable', icon: 'gameplay-object', category: 'Gameplay', scalable: true,
  visualAnimationFields: {
    reach: { label: 'Alcance (m)', kind: 'number', def: 2.2, min: 0.5, max: 12 },
    showIndicator: { label: 'Indicador', kind: 'bool', def: true },
  },
  create: () => ({ name: 'Objeto interactuable', collision: false, scale: [1, 1, 1], props: {
    recordKind: 'items', recordId: 1, mode: 'inventory', slot: 'right', reach: 2.2, showIndicator: true,
    indicatorZones: defaultIndicatorZones(2.2),
  } }),
  build(obj, ctx) {
    const { root, visual } = makeRoot(obj)
    const rec = gameplayRecord(obj, ctx.getDatabase?.())?.record
    const graphic = rec ? graphicOf(rec) : { kind: 'none' }
    const shown = buildEventGraphic(graphic, [0, 0, 0], (id) => ctx.getModelScene?.(id), {
      prefab: (id) => buildPrefabGraphic(ctx.getPrefab?.(id), ctx),
      sprite: (id) => ctx.getSpriteTexture?.(id),
    })
    if (shown) visual.add(shown)
    else {
      const missing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshBasicMaterial({ color: '#ff5577', wireframe: true }))
      missing.userData.editorOnly = true
      missing.userData.helper = true
      visual.add(missing)
    }
    updateIndicatorGizmos(root, obj.props?.indicatorZones, obj.props?.reach ?? 2.2, obj.props?.showIndicator !== false)
    return root
  },
  update(root, obj) { applyBase(root, obj, true); updateIndicatorGizmos(root, obj.props?.indicatorZones, obj.props?.reach ?? 2.2, obj.props?.showIndicator !== false) },
})
