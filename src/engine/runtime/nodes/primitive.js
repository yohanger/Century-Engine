import * as THREE from 'three'
import { makePbrMaterial, syncPbrMaterial, applyShadowMats } from '../render/pbr.js'
import { registerNode } from './registry.js'
import { makeRoot, applyBase } from './three-helpers.js'
import { PRIMITIVES, unitGeometry, stairsGeometry } from '../geometry/primitives.js'
import { primitiveMetricAttributes } from '../mesh/blockout-metrics.js'
import { effectiveMaterialObject } from '../render/material-resource.js'
import { PBR_ENV } from '../render/pbr.js'

const METRIC_PRIMITIVES = new Set(['box', 'plane', 'ramp', 'stairs'])
const kinds = Object.fromEntries(Object.entries(PRIMITIVES).map(([k, v]) => [k, { label: v.label, icon: v.icon }]))

export default registerNode({
  type: 'primitive',
  label: 'Primitiva',
  icon: 'box',
  category: 'Primitivas',
  scalable: true,
  visualAnimationFields: {
    color: { scope: 'object', label: 'Albedo', kind: 'color', def: '#ffffff', read: obj => effectiveMaterialObject(obj, PBR_ENV.materials).color },
    roughness: { scope: 'object', label: 'Rugosidad', kind: 'number', def: 0.8, min: 0, max: 1, read: obj => effectiveMaterialObject(obj, PBR_ENV.materials).roughness },
    metallic: { scope: 'object', label: 'Metálico', kind: 'number', def: 0, min: 0, max: 1, read: obj => effectiveMaterialObject(obj, PBR_ENV.materials).metallic },
    opacity: { scope: 'object', label: 'Opacidad', kind: 'number', def: 1, min: 0.05, max: 1, read: obj => effectiveMaterialObject(obj, PBR_ENV.materials).opacity },
  },
  kinds,
  create(kind) {
    const d = PRIMITIVES[kind]
    return { name: d.label, scale: [...d.defaults.scale], props: { ...(d.defaults.props || {}) },
      color: '#ffffff', mat: { shader: 'builtin:blockout', mapping: 'object', params: {} } }
  },

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const mat = makePbrMaterial()
    root.userData.mat = mat
    const geometry = obj.kind === 'stairs' ? stairsGeometry(obj.props?.steps ?? 8, obj.props?.turn ?? 0, obj.scale?.[0] ?? 1, obj.scale?.[2] ?? 1, obj.scale?.[1] ?? 1, obj.props) : unitGeometry(obj.kind)
    const own = METRIC_PRIMITIVES.has(obj.kind)
    const cloned = own ? geometry.clone() : geometry
    const metricGeometry = own && cloned.index ? cloned.toNonIndexed() : cloned
    if (metricGeometry !== cloned) cloned.dispose()
    visual.add(new THREE.Mesh(metricGeometry, mat))
    root.userData.metricOwnGeometry = own
    return root
  },

  update(root, obj) {
    applyBase(root, obj, true)
    const mesh = root.userData.visual.children.find((c) => c.isMesh)
    const effective = effectiveMaterialObject(obj, PBR_ENV.materials)
    const materialOverrides = root.userData.timelineVisualFields?.object
    // El material renderizado pertenece a esta instancia; el recurso de Assets no se altera.
    const materialState = materialOverrides ? { ...effective, ...materialOverrides, materialId: '' } : obj
    const blockout = effective.mat?.shader === 'builtin:blockout' && !effective.mat?.params?.uAlbedo
    const scaleKey = blockout && root.userData.metricOwnGeometry ? JSON.stringify(obj.scale) : ''
    if (scaleKey && root.userData.metricScale !== scaleKey) {
      const a = mesh.geometry.attributes
      const metrics = primitiveMetricAttributes(a.position.array, a.normal.array, obj.scale)
      mesh.geometry.setAttribute('lfBlockUV', new THREE.BufferAttribute(metrics.uv, 2))
      mesh.geometry.setAttribute('lfBlockSize', new THREE.BufferAttribute(metrics.size, 2))
      root.userData.metricScale = scaleKey
    }
    root.userData.mat.userData.lfBlockFaces = !!scaleKey
    syncPbrMaterial(root.userData.mat, materialState)
    applyShadowMats(root)
  },

})
