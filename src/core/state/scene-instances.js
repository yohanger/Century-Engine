// Puente de autoría: el Editor resuelve escenas, pero el algoritmo de expansión pertenece al Runtime.
import * as THREE from 'three'
import { toRaw } from '@vue/reactivity'
import { loadScene } from '../db.js'
import { migrateScene } from '../project.js'
import { uid } from '../../engine/runtime/util.js'
import {
  authoredSceneTree, expandSceneInstances, makeSceneInstance, readSceneSources, sceneSourceId,
} from '../../engine/runtime/scene/instances.js'
import { validateNodeTree } from '../../engine/runtime/nodes/hierarchy.js'
import { store, setTreeNodeOpen, toast } from './state.js'
import { getObject, worldMatrix } from './tree.js'
import { selectObject, uniqueName } from './objects.js'
import { commit } from './history.js'

// Únicamente caché de lectura; no hay un segundo modelo editable ni estado serializado.
const sourcesByProject = new WeakMap()
const raw = project => toRaw(project)
const sourceReader = (project, id) => {
  if (!project.scenes.some(s => s.id === id)) return null
  return loadScene(project.id, id).then(data => data && migrateScene(data))
}

export async function prepareEditorSceneInstances(project, record, sceneId) {
  const prefabNodes = (project.prefabs || []).flatMap(p => p.objects || [])
  const sources = await readSceneSources([...(record.objects || []), ...prefabNodes],
    id => sourceReader(project, id))
  const expanded = expandSceneInstances(record, sceneId, sources)
  sourcesByProject.set(raw(project), sources)
  return expanded
}

/** Reconstruye copias derivadas tras Undo/Redo, duplicación y modificación de una raíz. */
export function syncEditorSceneInstances(project) {
  if (!project || !project.activeSceneId) return
  if (!(project.objects || []).some(o => o.sceneInstanceOwner || sceneSourceId(o))) return
  const sources = sourcesByProject.get(raw(project))
  if (!sources) throw new Error('Resolver de escenas todavía no inicializado')
  const previous = new Map(project.objects.filter(o => o.sceneInstanceOwner).map(o => [o.id, o]))
  const expanded = expandSceneInstances(project, project.activeSceneId, sources)
  // Preservar la identidad reactiva cuando la fuente no cambió evita recrear el Inspector.
  project.objects = expanded.objects.map(o => previous.get(o.id) || o)
  project.signalConnections = expanded.signalConnections
}

export async function instantiateScene(sceneId, { parentId = null, position = null } = {}) {
  const project = store.project, editor = store.editor
  if (!project || !editor || store.locked || store.filmMode || store.play?.on || editor.edit) return null
  const scene = project.scenes.find(s => s.id === sceneId)
  if (!scene) return null
  const currentSceneId = project.activeSceneId
  if (sceneId === currentSceneId) {
    toast('Una escena no puede contenerse a sí misma', 'warn')
    return null
  }
  try {
    const root = makeSceneInstance(scene, { id: uid(), parentId })
    const base = sourcesByProject.get(raw(project)) || new Map()
    // No reutilizar una copia mutable del mapa si esta operación termina cancelada.
    const sources = await readSceneSources([root], id => sourceReader(project, id), new Map(base))
    if (store.project !== project || store.editor !== editor || store.locked || store.filmMode ||
        store.play?.on || editor.edit || project.activeSceneId !== currentSceneId ||
        !project.scenes.some(s => s.id === sceneId)) return null
    const parent = parentId ? getObject(parentId) : null
    if (parentId && (!parent || parent.locked || parent.sceneInstanceOwner || parent.type === 'sceneInstance' || parent.type === 'terrain'))
      throw new Error('No es posible instanciar bajo ese nodo')
    root.name = uniqueName(scene.name)
    if (position) {
      if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite))
        throw new Error('Posición de escena inválida')
      const matrix = worldMatrix(parentId)
      if (Math.abs(matrix.determinant()) < 1e-10) throw new Error('El padre tiene transformación no invertible')
      root.position = new THREE.Vector3(...position).applyMatrix4(matrix.invert()).toArray()
    }
    const expanded = expandSceneInstances({ objects: [root], signalConnections: [] }, currentSceneId, sources)
    validateNodeTree([...project.objects, ...expanded.objects])
    // Un solo cambio de autoría, con rollback si falla SceneGraph.
    const oldObjects = project.objects, oldSignals = project.signalConnections
    sourcesByProject.set(raw(project), sources)
    project.objects = [...oldObjects, ...expanded.objects]
    project.signalConnections = [...(oldSignals || []), ...expanded.signalConnections]
    try { editor.syncAll() } catch (error) {
      project.objects = oldObjects
      project.signalConnections = oldSignals
      editor.syncAll()
      throw error
    }
    if (parent) setTreeNodeOpen(parent, true)
    selectObject(root.id)
    commit(`Instanciar escena ${scene.name}`)
    return root
  } catch (error) {
    toast(error.message, 'error')
    return null
  }
}

/** Impide eliminar una fuente que todavía está referenciada desde cualquier escena o prefab. */
export async function sceneInstanceUsage(project, sceneId) {
  for (const scene of project.scenes) {
    if (scene.id === sceneId) continue
    const data = scene.id === project.activeSceneId ? project : await loadScene(project.id, scene.id)
    const ref = authoredSceneTree(data).objects.find(o => sceneSourceId(o) === sceneId)
    if (ref) return `Escena ${scene.name} / ${ref.name}`
  }
  const prefab = (project.prefabs || []).find(p => p.objects?.some(o => sceneSourceId(o) === sceneId))
  return prefab ? `Prefab ${prefab.name}` : null
}
