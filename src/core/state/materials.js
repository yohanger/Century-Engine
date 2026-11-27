// Recursos Material en Assets: creación, vínculo, edición y eliminación sin un gestor PBR paralelo.
import { uid } from '../../engine/runtime/util.js'
import { addFolderChain, uniqueFileName, normFolder } from '../project.js'
import { normalizeMaterial, materialFromObject, MATERIAL_FOLDER } from '../../engine/runtime/render/material-resource.js'
import { store } from './state.js'
import * as db from '../db.js'
import { commit } from './history.js'
import { updateObject } from './objects.js'

const all = () => store.project?.materials || []
export const findMaterial = (id) => all().find((m) => m.id === id) || null
export function createMaterial(obj = null, folder = MATERIAL_FOLDER, name = 'Material.material') {
  const dest = normFolder(folder)
  const p = store.project
  const file = uniqueFileName(p, dest, name.endsWith('.material') ? name : name + '.material')
  const material = materialFromObject(obj, uid('mt'), file, dest)
  p.materials ||= []
  p.materials.push(material)
  addFolderChain(p, dest)
  commit('Crear material')
  return material
}
export function assignMaterial(id, materialId = '') {
  if (materialId && !findMaterial(materialId)) return false
  updateObject(id, { materialId }, { label: 'Asignar material' })
  return true
}
/** Editar material compartido repercute en todos sus usuarios y se guarda en el historial actual. */
export function updateMaterial(id, patch, { commit: save = true } = {}) {
  const material = findMaterial(id)
  if (!material) return false
  const merged = { ...material, ...patch, mat: { ...material.mat, ...(patch.mat || {}),
    params: patch.mat && Object.hasOwn(patch.mat, 'params') ? patch.mat.params : (material.mat?.params || {}),
    physical: { ...(material.mat?.physical || {}), ...(patch.mat?.physical || {}) },
  } }
  Object.assign(material, normalizeMaterial(merged))
  for (const obj of store.project.objects || []) {
    if (obj.materialId === id || (obj.type === 'road' && Object.values(obj.props?.slots || {}).some((s) => s?.materialId === id)) || (obj.type === 'model' && (obj.props?.modelMaterials || []).some(s => s.materialId === id))) {
      store.editor?.syncObject?.(obj.id)
    }
  }
  if (save) commit(`Editar material ${material.name}`)
  return true
}
/** Convierte el recurso asignado en valores locales conservando la apariencia actual. */
export function makeMaterialLocal(id) {
  const obj = store.project.objects.find((o) => o.id === id)
  if (!obj?.materialId) return false
  const material = findMaterial(obj.materialId)
  const patch = { materialId: '' }
  if (material) Object.assign(patch, { color: material.color, roughness: material.roughness,
    metallic: material.metallic, opacity: material.opacity,
    mat: JSON.parse(JSON.stringify(material.mat)) })
  updateObject(id, patch, { label: 'Material local' })
  return true
}
/** Al eliminar el recurso los nodos conservan la última apariencia, no quedan huecos opacos. */
export function dropMaterial(id) {
  const p = store.project
  const material = findMaterial(id)
  if (!material) return false
  for (const obj of p.objects || []) if (obj.materialId === id) {
    Object.assign(obj, { materialId: '', color: material.color, roughness: material.roughness,
      metallic: material.metallic, opacity: material.opacity, mat: JSON.parse(JSON.stringify(material.mat)) })
  }
  for (const prefab of p.prefabs || []) for (const obj of prefab.objects || []) if (obj.materialId === id) {
    Object.assign(obj, { materialId: '', color: material.color, roughness: material.roughness,
      metallic: material.metallic, opacity: material.opacity, mat: JSON.parse(JSON.stringify(material.mat)) })
  }
  // Desvincular slots de carretera sin borrar los valores locales previos.
  // Igual que otras referencias, el Inspector permite convertir previamente a local.
  for (const obj of p.objects || []) if (obj.type === 'road') {
    for (const slot of Object.values(obj.props?.slots || {})) if (slot?.materialId === id) {
      slot.materialId = ''
      slot.color = material.color; slot.roughness = material.roughness
      slot.metallic = material.metallic; slot.opacity = material.opacity
      slot.mat = JSON.parse(JSON.stringify(material.mat))
      slot.texture = null
    }
  }
  for (const prefab of p.prefabs || []) for (const obj of prefab.objects || []) if (obj.type === 'road') {
    for (const slot of Object.values(obj.props?.slots || {})) if (slot?.materialId === id) {
      slot.materialId = ''
      slot.color = material.color; slot.roughness = material.roughness
      slot.metallic = material.metallic; slot.opacity = material.opacity
      slot.mat = JSON.parse(JSON.stringify(material.mat)); slot.texture = null
    }
  }
  for (const obj of [...(p.objects || []), ...(p.prefabs || []).flatMap(prefab => prefab.objects || [])]) {
    if (obj.type !== 'model') continue
    for (const slot of obj.props?.modelMaterials || []) if (slot.materialId === id) {
      Object.assign(slot, { materialId:'', color:material.color, roughness:material.roughness, metallic:material.metallic, opacity:material.opacity, mat:JSON.parse(JSON.stringify(material.mat)) })
    }
  }
  p.materials = p.materials.filter((m) => m.id !== id)
  if (store.projSel?.kind === 'material' && store.projSel.id === id) closeMaterialEditor()
  store.editor?.syncAll?.() // al borrar: los usuarios activos acaban de pasar a materiales locales
  return true
}

/** La eliminación no debe dejar referencias rotas en escenas inactivas de IndexedDB. */
export async function materialUsagesInOtherScenes(id) {
  const p = store.project
  const usages = []
  for (const scene of p.scenes || []) {
    if (scene.id === p.activeSceneId) continue
    const data = await db.loadScene(p.id, scene.id)
    for (const obj of data?.objects || []) {
      if (obj.materialId === id || (obj.type === 'road' && Object.values(obj.props?.slots || {}).some((s) => s?.materialId === id)) || (obj.type === 'model' && (obj.props?.modelMaterials || []).some(s => s.materialId === id))) {
        usages.push(`${scene.name} / ${obj.name || obj.id}`)
      }
    }
  }
  return usages
}

export function openMaterialEditor(id) {
  if (!findMaterial(id)) return
  store.projSel = { kind: 'material', id }
  store.prefs.rightTab = 'object'
  if (store.ui?.mode === 'desktop') store.prefs.rightOpen = true
  else if (store.ui) store.ui.drawer = 'inspector'
}
export function closeMaterialEditor() {
  if (store.projSel?.kind === 'material') store.projSel = null
}
