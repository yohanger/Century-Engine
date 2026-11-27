import * as THREE from 'three'
import { makePbrMaterial, syncPbrMaterial, applyShadowMats } from '../render/pbr.js'
import { registerNode } from './registry.js'
import { makeRoot, applyBase } from './three-helpers.js'
import { PolyMesh } from '../mesh/polymesh.js'
import { make, MESH_KINDS } from '../mesh/generators.js'
import { polyBuffers } from '../mesh/buffers.js'
import { ensurePaintWeights, meshPaintConfig } from '../mesh/vertex-paint.js'
import { syncMeshPaintMaterial } from '../mesh/vertex-paint-material.js'
import { effectiveMaterialObject } from '../render/material-resource.js'
import { PBR_ENV } from '../render/pbr.js'
import { meshDataOf } from '../mesh/shared-mesh.js'

const cache = new Map() // id → { rev, poly }
/** PolyMesh del objeto (con caché por revisión). */
export function polyOf(obj, meshes = PBR_ENV.meshes) {
  const j = meshDataOf(obj, meshes)
  if (!j) return new PolyMesh()
  const c = cache.get(obj.id)
  if (c && c.rev === j.rev && c.src === j) return c.poly
  const poly = PolyMesh.fromJSON(j)
  if (obj.id) cache.set(obj.id, { rev: j.rev, src: j, poly })
  return poly
}
export const clearPolyCache = () => cache.clear()

export function geometryOf(poly, painted = false, metricScale = null) {
  const b = polyBuffers(poly, { includeHidden: true, blockout: !!metricScale, scale: metricScale || [1, 1, 1] })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(b.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(b.uvs, 2))
  if (b.blockUV) {
    g.setAttribute('lfBlockUV', new THREE.BufferAttribute(b.blockUV, 2))
    g.setAttribute('lfBlockSize', new THREE.BufferAttribute(b.blockSize, 2))
  }
  if (painted) g.setAttribute('lfPaintUV', new THREE.BufferAttribute(b.uvs, 2))
  if (b.colors) g.setAttribute('lfColor', new THREE.BufferAttribute(b.colors, 3))
  if (b.weights0) g.setAttribute('lfWeights0', new THREE.BufferAttribute(b.weights0, 4))
    if (b.weights1) g.setAttribute('lfWeights1', new THREE.BufferAttribute(b.weights1, 4))
  g.setIndex(new THREE.BufferAttribute(b.indices, 1))
  g.computeBoundingSphere()
  g.userData.faceOf = b.faceOf
  return g
}

export default registerNode({
  type: 'mesh',
  label: 'Malla editable',
  icon: 'mesh',
  category: 'Malla',
  scalable: true,
  visualAnimationFields: {
    color: { scope: 'object', label: 'Albedo', kind: 'color', def: '#ffffff', read: obj => effectiveMaterialObject(obj, PBR_ENV.materials).color },
    roughness: { scope: 'object', label: 'Rugosidad', kind: 'number', def: 0.8, min: 0, max: 1, read: obj => effectiveMaterialObject(obj, PBR_ENV.materials).roughness },
    metallic: { scope: 'object', label: 'Metálico', kind: 'number', def: 0, min: 0, max: 1, read: obj => effectiveMaterialObject(obj, PBR_ENV.materials).metallic },
    opacity: { scope: 'object', label: 'Opacidad', kind: 'number', def: 1, min: 0.05, max: 1, read: obj => effectiveMaterialObject(obj, PBR_ENV.materials).opacity },
  },
  kinds: MESH_KINDS,
  create(kind) {
    const poly = make(kind)
    return { name: MESH_KINDS[kind]?.label || 'Malla', color: '#9aa4b5', props: { mesh: poly.toJSON(), collider: 'trimesh' } }
  },

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const mat = makePbrMaterial(THREE.DoubleSide)
    root.userData.mat = mat
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat)
    mesh.userData.isMeshBody = true
    visual.add(mesh)
    root.userData.meshBody = mesh
    root.userData.rev = -1
    return root
  },

  update(root, obj) {
    applyBase(root, obj, true)
    const body = root.userData.meshBody
    const sourceId = obj.props.meshRef || ''
    const rev = meshDataOf(obj, PBR_ENV.meshes)?.rev
    const effective = effectiveMaterialObject(obj, PBR_ENV.materials)
    const materialOverrides = root.userData.timelineVisualFields?.object
    // El material renderizado pertenece a esta instancia; el recurso de Assets no se altera.
    const materialState = materialOverrides ? { ...effective, ...materialOverrides, materialId: '' } : obj
    const blockout = effective.mat?.shader === 'builtin:blockout' && !effective.mat?.params?.uAlbedo
    const metricScale = blockout ? obj.scale : null
    const metricSignature = blockout ? JSON.stringify(obj.scale) : ''
    const painted = !!meshPaintConfig(obj.props?.meshPaint)
    if ((root.userData.rev !== rev || root.userData.sourceId !== sourceId || root.userData.paintEnabled !== painted || root.userData.metricSignature !== metricSignature) && !root.userData.liveEdit) {
      body.geometry.dispose()
      const poly = polyOf(obj)
      if (meshPaintConfig(obj.props?.meshPaint)) ensurePaintWeights(poly)
      body.geometry = geometryOf(poly, !!meshPaintConfig(obj.props?.meshPaint), metricScale)
      root.userData.metricSignature = metricSignature
      root.userData.rev = rev
      root.userData.sourceId = sourceId
      root.userData.paintEnabled = painted
    }
    root.userData.mat.userData.lfBlockFaces = !!body.geometry.getAttribute('lfBlockUV')
    syncPbrMaterial(root.userData.mat, materialState)
    syncMeshPaintMaterial(root.userData.mat, obj.props?.meshPaint)
    applyShadowMats(root)
  },

})
