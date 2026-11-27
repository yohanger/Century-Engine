import { normalizeMaterial, effectiveMaterialObject } from './material-resource.js'
import { MODEL_MAPS } from './native-maps.js'

export function describeModelMaterials(root) {
  const slots = [], ids = new Map(), meshes = []
  root?.traverse(mesh => {
    if (!mesh.isMesh || !mesh.material) return
    const array = Array.isArray(mesh.material)
    const materials = array ? mesh.material : [mesh.material]
    const keys = materials.map(material => {
      if (!ids.has(material)) {
        const id = `slot-${slots.length}`
        ids.set(material, id)
        slots.push({ id, name: material.name || `Material ${slots.length + 1}`, material, uv: false })
      }
      const id = ids.get(material)
      if (mesh.geometry?.getAttribute('uv')) slots[Number(id.slice(5))].uv = true
      return id
    })
    meshes.push({ mesh, array, materials, keys })
  })
  return { slots, meshes }
}
export function modelSlotState(obj, id) {
  return (obj?.props?.modelMaterials || []).find(s => s.slotId === id) || null
}
export function modelSlotPatch(obj, id, state) {
  const slots = (obj?.props?.modelMaterials || []).filter(s => s.slotId !== id)
  if (state) slots.push({ ...state, slotId:id })
  return { props: { modelMaterials: slots } }
}
export function localModelMaterial(slot) {
  const m = slot?.material
  return normalizeMaterial({ color: m?.color ? `#${m.color.getHexString()}` : '#ffffff', roughness:m?.roughness, metallic:m?.metalness, opacity:m?.opacity,
    mat:{ mapping:'object', maps:m?.userData?.centuryMaps || {} } })
}
export function modelMaterialState(obj, slot, materials) {
  const state = modelSlotState(obj, slot.id)
  return state ? effectiveMaterialObject(state, materials) : null
}

export function chooseModelSlotMaterial(slot, current, id, resources) {
  const base = current || localModelMaterial(slot)
  const local = id ? base : effectiveMaterialObject(base, resources)
  return { ...normalizeMaterial(local), materialId: id || '',
    ...(!id && (!current || current.inheritImportedMaps === true) && !base.materialId ? { inheritImportedMaps: true } : {}) }
}
export function editModelSlotMaterial(slot, current, patch) {
  const base = current || localModelMaterial(slot)
  const next = normalizeMaterial({ ...base, ...patch, mat: { ...base.mat, ...patch.mat,
    physical: { ...base.mat?.physical, ...patch.mat?.physical },
    ...(patch.mat?.maps ? { maps: { ...base.mat?.maps, ...patch.mat.maps } } : {}) } })
  return { ...next, materialId: base.materialId || '',
    ...(!base.materialId && (!current || current.inheritImportedMaps === true) ? { inheritImportedMaps: true } : {}) }
}

export function inheritedModelMap(state, original, key) {
  if (!state?.inheritImportedMaps || state.materialId || Object.hasOwn(state.mat?.maps || {}, key)) return null
  const field = MODEL_MAPS.find(map => map.key === key)
  return field ? original?.[field.property] || null : null
}
export function syncInheritedModelMaps(material, state, original) {
  if (!state?.inheritImportedMaps || state.materialId) return
  for (const field of MODEL_MAPS) {
    const texture = inheritedModelMap(state, original, field.key)
    if (texture && material[field.property] !== texture) {
      material[field.property] = texture
      material.needsUpdate = true
    }
  }
  if (inheritedModelMap(state, original, 'normal') && original.normalScale) material.normalScale?.copy(original.normalScale)
  if (!Object.hasOwn(state.mat?.maps || {}, 'emission') && original.emissive) {
    material.emissive?.copy(original.emissive)
    material.emissiveIntensity = original.emissiveIntensity ?? 1
  }
}
