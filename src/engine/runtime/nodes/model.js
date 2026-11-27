import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase } from './three-helpers.js'
import { unitGeometry } from '../geometry/primitives.js'
import { cloneModel } from '../anim/modelclips.js'
import { describeModelMaterials, modelMaterialState, syncInheritedModelMaps } from '../render/model-material.js'
import { makePbrMaterial, syncPbrMaterial, PBR_ENV } from '../render/pbr.js'

export default registerNode({
  type: 'model',
  label: 'Modelo 3D',
  icon: 'model',
  category: 'Recursos',
  scalable: true,
  visualAnimationFields: {
    castShadow: { scope: 'object', label: 'Sombra', kind: 'bool', def: true },
  },
  create: () => ({ name: 'Modelo', color: '#ffffff', props: { collider: 'box' } }),

  build(obj, ctx) {
    const { root, visual } = makeRoot(obj)
    const scene = ctx.getModelScene?.(obj.modelId)
    if (scene) {
      const m = cloneModel(scene)
      visual.add(m); root.userData.modelRoot = m
      const bindings = describeModelMaterials(m)
      const overrides = new Map()
      root.userData.modelMaterialBindings = bindings
      root.userData.modelMaterialOverrides = overrides
      root.userData.modelMaterialMap = (id, srgb) => ctx.getModelMap?.(id, srgb, !!scene.userData.centuryObj)
      root.userData.disposeModelMaterials = () => {
        for (const material of overrides.values()) {
          material.userData.rt?.depthMat?.dispose(); material.userData.rt?.distMat?.dispose(); material.dispose()
        }
        overrides.clear()
      }
    }
    else visual.add(new THREE.Mesh(unitGeometry('box'), new THREE.MeshBasicMaterial({ color: '#ff5577', wireframe: true })))
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    const bindings = root.userData.modelMaterialBindings
    if (bindings) {
      const overrides = root.userData.modelMaterialOverrides
      const resolved = new Map()
      const env = { ...PBR_ENV, look:'clasico', getMap: root.userData.modelMaterialMap }
      for (const slot of bindings.slots) {
        const state = modelMaterialState(obj, slot, env.materials)
        let material = overrides.get(slot.id)
        if (state) {
          if (!material) {
            material = makePbrMaterial(slot.material.side)
            material.name = slot.name
            material.vertexColors = !!slot.material.vertexColors
            overrides.set(slot.id, material)
          }
          if (material.userData.inheritedModelMaps) {
            material.normalScale?.set(1, 1)
            material.emissiveIntensity = 1
          }
          syncPbrMaterial(material, state, env)
          material.userData.inheritedModelMaps = state.inheritImportedMaps === true && !state.materialId
          syncInheritedModelMaps(material, state, slot.material)
          resolved.set(slot.id, material)
        } else {
          if (material) { material.userData.rt?.depthMat?.dispose(); material.userData.rt?.distMat?.dispose(); material.dispose(); overrides.delete(slot.id) }
          resolved.set(slot.id, slot.material)
        }
      }
      for (const binding of bindings.meshes) {
        const materials = binding.keys.map(key => resolved.get(key))
        if (binding.array) {
          if (!Array.isArray(binding.mesh.material) || materials.some((m,i) => binding.mesh.material[i] !== m)) binding.mesh.material = materials
        } else binding.mesh.material = materials[0]
      }
    }
    // El glTF ya es una instancia clonada de Assets. No afectar otras instancias.
    root.userData.modelRoot?.traverse(child => {
      if (child.isMesh && !child.userData.helper) child.castShadow = obj.castShadow !== false
    })
  },

})
