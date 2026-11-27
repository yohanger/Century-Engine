import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, lineMat } from './three-helpers.js'
import { PRIMITIVES, unitGeometry, stairsGeometry } from '../geometry/primitives.js'
import { newEventProps } from '../events/model.js'
import { resolveGraphic } from '../database/models.js'
import { buildPrefabGraphic } from './prefab-graphic.js'
import { makeSpriteMesh, applySprite } from './sprite.js'
import { updateIndicatorGizmos } from './interaction-zones.js'

/** Gráfico de una Event Page en espacio local del evento; la zona de trigger no lo escala. Usado por Editor y Play. */
export function buildEventGraphic(gr, zone, getModelScene, { prefab, sprite } = {}) {
  if (!gr || gr.kind === 'none') return null
  const [sx, sy, sz] = gr.size || [1, 1, 1]
  const height = zone?.[1] ?? 1
  let model
  if (gr.kind === 'sprite') {
    // la imagen como sprite (nodes/sprite.js): los pies en el suelo de la zona
    model = makeSpriteMesh()
    const tex = gr.imageId ? sprite?.(gr.imageId) || null : null
    applySprite(model, { type: 'sprite3d', color: '#ffffff', opacity: 1, props: { pixelSize: gr.pixelSize ?? 0.03, billboard: gr.billboard || 'y', filter: gr.filter || 'pixel', doubleSided: true, unshaded: true } }, tex)
    model.position.y += -height / 2
    const group = new THREE.Group()
    group.add(model)
    return group
  }
  if (gr.kind === 'prefab') {
    // prefab (nodes/prefab-graphic.js): los pies del conjunto en el suelo de la zona; «Tamaño» lo escala
    model = prefab?.(gr.prefabId)
    if (!model) return null
    model.scale.set(sx, sy, sz)
    model.position.set(0, -height / 2, 0)
  } else if (gr.kind === 'model') {
    const tpl = getModelScene?.(gr.modelId)
    if (!tpl) return null
    model = tpl.clone(true)
    model.scale.set(sx, sy, sz)
    model.position.set(0, -height / 2, 0)
  } else if (Object.hasOwn(PRIMITIVES, gr.kind)) {
    const geometry = gr.kind === 'stairs' ? stairsGeometry(gr.steps ?? 8) : unitGeometry(gr.kind)
    model = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: gr.color || '#d9a05b', roughness: 0.7 }))
    model.userData.ownMaterial = true
    model.castShadow = model.receiveShadow = true
    model.scale.set(sx, sy, sz)
    model.position.set(0, -height / 2 + sy / 2, 0)
  } else return null
  const group = new THREE.Group()
  group.add(model)
  return group
}

/** Destruye solamente materiales creados para el Event; geometrías en caché y assets importados son compartidos. */
export function disposeEventGraphic(graphic) {
  graphic?.traverse((m) => { if (m.userData?.ownMaterial) m.material.dispose() })
}

export const EVENT_COLOR = '#ffb547'
export const GAZE_COLOR = '#ffd23a'

/** Esfera amarilla (tres círculos) que marca dónde debe mirar el jugador; null si ninguna página exige mirar. */
function gazeSpec(props) {
  const pg = (props?.pages || []).find((p) => p.trigger === 'look' || p.gaze?.on)
  return pg ? { offset: pg.gaze?.offset || [0, 0, 0], radius: Math.max(0.05, +pg.gaze?.radius || 0.5) } : null
}
function gazeGizmo() {
  const g = new THREE.Group(), pts = []
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)) }
  const geo = new THREE.BufferGeometry().setFromPoints(pts), mat = new THREE.LineBasicMaterial({ color: GAZE_COLOR, depthTest: false, transparent: true })
  for (const r of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0]]) { const l = new THREE.Line(geo, mat); l.rotation.set(...r); l.renderOrder = 10; g.add(l) }
  g.userData.keepSize = true
  return g
}

/** Evento (estilo RPG Maker MZ): una zona con páginas de condiciones + lista de comandos. Se edita con «Editar eventos…». */
export default registerNode({
  type: 'event',
  label: 'Event',
  icon: 'event',
  category: 'Gameplay',
  scalable: true,
  visualAnimationFields: {
    color: { scope: 'object', label: 'Color de edición', kind: 'color', def: '#ffb547' },
  },
  create: () => ({ name: 'Evento', collision: false, color: EVENT_COLOR, scale: [1, 1, 1], props: newEventProps() }),

  build(obj, ctx) {
    const { root, visual } = makeRoot(obj)
    const fill = new THREE.Mesh(unitGeometry('box'), new THREE.MeshBasicMaterial({ color: obj.color, transparent: true, opacity: 0.14, depthWrite: false }))
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(unitGeometry('box')), lineMat(obj.color))
    // rombo en el centro: se ve y se selecciona aunque la zona sea grande
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: obj.color }))
    gem.userData.keepSize = true
    root.userData.fillMat = fill.material
    root.userData.edgeMat = edges.material
    root.userData.gem = gem
    visual.add(fill, edges)
    root.userData.editorGizmos = [visual]
    // Página 1: vista estática de diseño. Play decide la página activa mediante condiciones.
    const preview = buildEventGraphic(resolveGraphic(obj.props?.pages?.[0]?.graphic, ctx?.getDatabase?.()), obj.scale, (id) => ctx?.getModelScene?.(id), { prefab: (id) => buildPrefabGraphic(ctx?.getPrefab?.(id), ctx), sprite: (id) => ctx?.getSpriteTexture?.(id) })
    root.userData.previewGraphic = preview
    if (preview) root.add(preview) // fuera de visual para preservar Graphic Size, independiente del tamaño de la zona
    const gz = gazeGizmo(); gz.visible = false; gz.userData.helper = true
    root.userData.gaze = gz; root.userData.editorGizmos.push(gz); root.add(gz)
    updateIndicatorGizmos(root, obj.props?.pages?.[0]?.indicatorZones, (obj.props?.reach ?? 1.2) + 0.3, obj.props?.pages?.[0]?.showIndicator === true)
    root.add(gem) // fuera de `visual`: no se deforma con la escala de la zona
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    updateIndicatorGizmos(root, obj.props?.pages?.[0]?.indicatorZones, (obj.props?.reach ?? 1.2) + 0.3, obj.props?.pages?.[0]?.showIndicator === true)
    root.userData.fillMat.color.set(obj.color)
    root.userData.edgeMat.color.set(obj.color)
    root.userData.gem.material.color.set(obj.color)
    const gs = gazeSpec(obj.props), gz = root.userData.gaze
    if (gz) { gz.userData.editorGizmoEnabled = !!gs; if (gs) { gz.position.set(...gs.offset.map(Number)); gz.scale.setScalar(gs.radius) } }
  },
})
