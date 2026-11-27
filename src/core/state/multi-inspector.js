import { store } from './state.js'
import { getObject } from './tree.js'
import { commit } from './history.js'
import { validateNodeTree } from '../../engine/runtime/nodes/hierarchy.js'
import { getDef } from '../../engine/runtime/nodes/index.js'
import { PRIMITIVES } from '../../engine/runtime/geometry/primitives.js'
import { OCCLUSION_NODE_TYPES } from '../../engine/runtime/render/occlusion-static.js'

const keys = new Set(['active', 'visible', 'static', 'dontDestroyOnLoad', 'position', 'rotation', 'scale', 'color', 'roughness', 'metallic', 'opacity', 'castShadow', 'carve', 'steps'])

export function sharedValue(nodes, key, axis) {
  if (!nodes?.length) return { value: null, mixed: false }
  const valueOf = (node) => key === 'carve' ? node.props?.carve !== false : key === 'steps' ? (node.props?.steps ?? 8) : key === 'static' ? (node.props?.static ?? node.props?.batchStatic) === true
    : axis == null ? (key === 'active' || key === 'visible' ? node[key] !== false : ['static','dontDestroyOnLoad','castShadow'].includes(key) ? node[key] === true : node[key])
      : node[key]?.[axis]
  const first = valueOf(nodes[0])
  return { value: first, mixed: nodes.some(n => !Object.is(valueOf(n), first)) }
}

export function canEditShared(nodes, key) {
  if (!keys.has(key) || !Array.isArray(nodes) || nodes.length < 2 || nodes.some(n => !n)) return false
  if (key === 'static') return nodes.every(n => OCCLUSION_NODE_TYPES.includes(n.type))
  if (key === 'carve') return nodes.every(n => n.type === 'primitive')
  if (key === 'steps') return nodes.every(n => n.type === 'primitive' && n.kind === 'stairs')
  if (['color', 'roughness', 'metallic', 'opacity', 'castShadow'].includes(key))
    return nodes.every(n => ['primitive', 'mesh', 'model', 'road', 'text', 'nature'].includes(n.type) && Object.hasOwn(n, key))
  if (['position', 'rotation', 'scale'].includes(key)) {
    return nodes.every(n => !!getDef(n.type) && getDef(n.type).base !== 'Node' &&
      (key !== 'scale' || getDef(n.type)?.scalable) &&
      Array.isArray(n[key]) && n[key].length === 3)
  }
  return key !== 'dontDestroyOnLoad' || nodes.every(n => n.type !== 'terrain')
}

/** Validación completa antes de escribir; una operación = un solo historial. */
export function updateSharedSelection(ids, key, value, { axis = null, label } = {}) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length < 2 ||
      !store.project || store.locked || store.play?.on || store.edit?.on) return false
  const nodes = ids.map(getObject)
  if (!canEditShared(nodes, key) || nodes.some(n => n.sceneInstanceOwner || n.locked)) return false
  if (nodes.some(n => {
    for (let parent = getObject(n.parentId); parent; parent = getObject(parent.parentId)) if (parent.locked) return true
    return false
  })) return false
  const numeric = ['position','rotation','scale'].includes(key)
  const materialNumber = ['roughness','metallic','opacity'].includes(key)
  const stepsNumber = key === 'steps'
  if (numeric ? (!Number.isInteger(axis) || axis < 0 || axis > 2 || !Number.isFinite(value) || (key === 'scale' && (value < 0.01 || value > 1e6)))
    : stepsNumber ? (!Number.isInteger(value) || value < 2 || value > 64) : materialNumber ? (!Number.isFinite(value) || value < (key === 'opacity' ? 0.05 : 0) || value > 1) :
      key === 'color' ? (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) : typeof value !== 'boolean') return false
  const original = nodes.map(n => ({ id:n.id, value:numeric ? [...n[key]] : ['static','carve','steps'].includes(key) ? { ...n.props } : n[key] }))
  const proposals = nodes.map(n => {
    if (numeric) {
      const updated = [...n[key]]; updated[axis] = value
      if (key === 'scale' && n.type === 'primitive') {
        const link = PRIMITIVES[n.kind]?.link
        if (link === 'xyz') updated.fill(value)
        else if (link === 'xz' && axis !== 1) updated[0] = updated[2] = value
      }
      return { [key]: updated }
    }
    return ['static','carve','steps'].includes(key) ? { props: { ...n.props, [key]: value } } : { [key]: value }
  })
  if (nodes.every((n, i) => {
    const patch=proposals[i]
    return key === 'static' ? (n.props?.static === value && (n.props?.batchStatic === undefined || value)) :
      key === 'carve' ? n.props?.carve === value : key === 'steps' ? (n.props?.steps ?? 8) === value :
      JSON.stringify(n[key]) === JSON.stringify(patch[key])
  })) return false
  const patches = new Map(ids.map((id, i) => [id, proposals[i]]))
  try { validateNodeTree(store.project.objects.map(n => patches.has(n.id) ? { ...n, ...patches.get(n.id) } : n)) }
  catch { return false }
  try {
    nodes.forEach((n, i) => {
      if (['static','carve','steps'].includes(key)) n.props = proposals[i].props
      else n[key] = proposals[i][key]
      store.editor?.syncObject(n.id)
    })
  } catch {
    nodes.forEach((n, i) => {
      if (['static','carve','steps'].includes(key)) n.props = original[i].value
      else n[key] = original[i].value
      try { store.editor?.syncObject(n.id) } catch { /* se conserva el estado de autoría */ }
    })
    return false
  }
  if (key === 'static' || key === 'carve' || key === 'steps' || key === 'position' || key === 'rotation' || key === 'scale' || key === 'visible') {
    if (store.project.environment) store.project.environment.occlusionBake = null
  }
  commit(label || `Editar ${key} (${ids.length} nodos)`)
  return true
}
