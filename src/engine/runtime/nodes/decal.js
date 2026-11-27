// Calcomanía estática proyectada sobre una malla existente. Usa el mismo ciclo de vida de nodos que el resto de la escena.
import * as THREE from 'three'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, hitSphere } from './three-helpers.js'

const clamp = (v, fallback, min, max) => Number.isFinite(+v) ? Math.min(max, Math.max(min, +v)) : fallback
export function normalizeDecal(p = {}) {
  return {
    targetId: typeof p.targetId === 'string' ? p.targetId : '',
    image: typeof p.image === 'string' ? p.image : '',
    size: Array.from({ length: 3 }, (_, i) => clamp(p.size?.[i], i === 2 ? 0.5 : 1, 0.01, 1000)),
    opacity: clamp(p.opacity, 1, 0, 1),
  }
}

/** Refresca la geometría si el proyector o su malla cambian. No toca la geometría original. */
export function updateDecal(root, obj) {
  applyBase(root, obj, false)
  const u = root.userData, p = normalizeDecal(obj.props)
  const source = p.targetId && p.targetId !== obj.id ? u.ctx.getDecalTarget?.(p.targetId) : null
  const targets = []
  if (source && source !== root) source.traverse((m) => {
    if (m.isMesh && m.geometry?.getAttribute('position') && !m.userData.helper && m.visible !== false) {
      m.updateWorldMatrix(true, false)
      targets.push(m)
    }
  })
  root.updateWorldMatrix(true, false)
  const key = JSON.stringify([
    obj.position, obj.rotation, obj.parentId, p.targetId, p.size,
    root.matrixWorld.elements,
    ...targets.map((m) => [m.geometry.uuid, m.geometry.version, m.matrixWorld.elements]),
  ])
  if (key !== u.decalKey) {
    for (const m of u.projections) { u.visual.remove(m); m.geometry.dispose() }
    u.projections.length = 0
    const center = root.getWorldPosition(new THREE.Vector3())
    const rotation = new THREE.Euler().setFromQuaternion(root.getWorldQuaternion(new THREE.Quaternion()), 'YXZ')
    const scale = new THREE.Vector3(...p.size)
    const inverse = root.matrixWorld.clone().invert()
    for (const target of targets) {
      const geo = new DecalGeometry(target, center, rotation, scale)
      if (!geo.getAttribute('position')?.count) { geo.dispose(); continue }
      // DecalGeometry devuelve vértices mundiales; el nodo conserva sus transformaciones editables.
      geo.applyMatrix4(inverse)
      const mesh = new THREE.Mesh(geo, u.material)
      mesh.renderOrder = 1
      mesh.userData.isDecalProjection = true
      u.visual.add(mesh)
      u.projections.push(mesh)
    }
    u.decalKey = key
  }
  const image = p.image ? u.ctx.getSpriteTexture?.(p.image) : null
  u.material.map = image || null
  u.material.opacity = p.opacity
  u.material.needsUpdate = u.decalImage !== image
  u.decalImage = image
  for (const m of u.projections) m.visible = !!image && obj.visible !== false
}

export function disposeDecal(root) {
  for (const mesh of root.userData.projections || []) mesh.geometry.dispose()
  root.userData.material?.dispose()
  root.userData.decalHit?.geometry.dispose()
  root.userData.decalHit?.material.dispose()
  root.userData.projections = []
}

export default registerNode({
  type: 'decal', label: 'Calcomanía', icon: 'decal', category: 'Efectos', scalable: false,
  visualAnimationFields: {
    targetId: { label:'Proyectar sobre',kind:'string',def:'' },
    image: { label:'Imagen',kind:'string',def:'' },
    size: { label:'Tamaño XYZ',kind:'vec3',def:[1,1,0.5] },
    opacity: { label:'Opacidad',kind:'number',def:1,min:0,max:1 },
  },
  create() { return { name: 'Calcomanía', collision: false, castShadow: false, props: normalizeDecal() } },
  build(obj, ctx) {
    const { root, visual } = makeRoot(obj)
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide })
    const hit = hitSphere(0.25)
    hit.userData.helper = true
    visual.add(hit)
    Object.assign(root.userData, { ctx, material, projections: [], decalKey: null, decalImage: null, decalHit: hit })
    return root
  },
  update: updateDecal,
})
