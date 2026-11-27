// Instancias de escenas. La autoría vive en recursos Scene, no en los objetos derivados.
// Módulo del runtime: deliberadamente no importa nada de src/core/.
import { makeObject } from '../nodes/index.js'
import { validateNodeTree } from '../nodes/hierarchy.js'

export const SCENE_INSTANCE_TYPE = 'sceneInstance'

export function sceneSourceId(object) {
  return object?.type === SCENE_INSTANCE_TYPE ? object.props?.sceneId : null
}

/** Extrae la autoría, nunca materializaciones derivadas ni sus señales. */
export function authoredSceneTree(record) {
  const generatedIds = new Set((record?.objects || []).filter(o => o.sceneInstanceOwner || o.sceneRuntimeOnly).map(o => o.id))
  const objects = (record?.objects || []).filter(o => !o.sceneInstanceOwner && !o.sceneRuntimeOnly)
  const signalConnections = (record?.signalConnections || []).filter(c =>
    !c.sceneInstanceOwner && !generatedIds.has(c.emitterId) && !generatedIds.has(c.receiverId))
  return { objects, signalConnections }
}

export function makeSceneInstance(scene, extra = {}) {
  if (!scene?.id) throw new Error('Escena fuente inválida')
  return makeObject(SCENE_INSTANCE_TYPE, SCENE_INSTANCE_TYPE, {
    name: scene.name || 'Escena', ...extra,
    props: { sceneId: scene.id },
  })
}

function sourcesOf(objects) {
  return objects.map(sceneSourceId).filter(Boolean)
}

/** Carga dependencias transitivas, sin mutar los registros origen. */
export async function readSceneSources(objects, read, cache = new Map()) {
  const pending = new Set(sourcesOf(objects))
  while (pending.size) {
    const ids = [...pending].filter(id => !cache.has(id))
    pending.clear()
    if (!ids.length) break
    const entries = await Promise.all(ids.map(id => read(id)))
    for (let i = 0; i < ids.length; i++) {
      if (!entries[i]) throw new Error(`Escena fuente no encontrada (${ids[i]})`)
      cache.set(ids[i], entries[i])
    }
    for (const entry of entries) for (const id of sourcesOf(authoredSceneTree(entry).objects)) {
      if (!cache.has(id)) pending.add(id)
    }
  }
  return cache
}

const childId = (parentId, id) => `${parentId}::${encodeURIComponent(id)}`
const copy = value => JSON.parse(JSON.stringify(value))

function expandBranch(instance, sourceRecords, ancestors, topId) {
  const sourceId = sceneSourceId(instance)
  if (!sourceId || typeof sourceId !== 'string') throw new Error('Instancia sin escena fuente válida')
  if (ancestors.includes(sourceId)) throw new Error(`Referencia circular de escenas: ${[...ancestors, sourceId].join(' → ')}`)
  const source = sourceRecords.get(sourceId)
  if (!source) throw new Error(`Escena fuente ausente: ${sourceId}`)
  const author = authoredSceneTree(source)
  // Terreno, atmósfera y propiedades de nivel pertenecen exclusivamente a la escena activa.
  const nodes = author.objects.filter(o => o.type !== 'terrain')
  // Los terrenos son datos del nivel (no hijos espaciales). Se mantienen en su escena fuente.
  validateNodeTree(author.objects)
  const ids = new Map(nodes.map(obj => [obj.id, childId(instance.id, obj.id)]))
  const objects = nodes.map(obj => {
    const node = copy(obj)
    node.id = ids.get(obj.id)
    node.parentId = ids.get(obj.parentId) ?? instance.id
    node.sceneInstanceOwner = topId
    node.locked = true // Hijos vinculados: edición exclusivamente desde su escena fuente.
    node.sceneSourceNodeId = obj.id
    node.sceneSourceSceneId = sourceId
    // Estos campos guardan referencias internas por ID; fuera del subárbol no son válidas.
    if (node.type === 'collisionshape3d' && node.props?.shape?.sourceId)
      node.props.shape.sourceId = ids.get(node.props.shape.sourceId) || ''
    if (node.type === 'meshSubtract' && node.props?.sourceId)
      node.props.sourceId = ids.get(node.props.sourceId) || ''
    if (node.type === 'decal' && node.props?.targetId)
      node.props.targetId = ids.get(node.props.targetId) || ''
    // Camera Orchestration conserva la autoridad. Instanciar una casa no activa su cámara.
    if (node.type === 'camera' && node.props) node.props.main = false
    return node
  })
  const connections = (author.signalConnections || [])
    .filter(c => ids.has(c.emitterId) && ids.has(c.receiverId))
    .map((c, index) => ({
      ...copy(c), id: childId(instance.id, `signal:${index}`),
      emitterId: ids.get(c.emitterId), receiverId: ids.get(c.receiverId),
      sceneInstanceOwner: topId,
    }))
  for (const nested of [...objects]) {
    if (nested.type !== SCENE_INSTANCE_TYPE) continue
    const resolved = expandBranch(nested, sourceRecords, [...ancestors, sourceId], topId)
    objects.push(...resolved.objects)
    connections.push(...resolved.signalConnections)
  }
  return { objects, signalConnections: connections }
}

/** Resuelve cada instancia; los IDs son estables mientras no cambie su ruta autoral. */
export function expandSceneInstances(record, sceneId, sources, onError = null) {
  const authored = authoredSceneTree(record)
  const objects = [...authored.objects]
  const signalConnections = [...authored.signalConnections]
  const ids = new Set(objects.map(obj => obj.id))
  const signalIds = new Set(signalConnections.map(c => c.id))
  for (const root of authored.objects) {
    if (root.type !== SCENE_INSTANCE_TYPE) continue
    try {
      const branch = expandBranch(root, sources, [sceneId], root.id)
      if (branch.objects.some(o => ids.has(o.id)) || branch.signalConnections.some(c => signalIds.has(c.id)))
        throw new Error(`Identidad derivada duplicada: ${root.name || root.id}`)
      for (const o of branch.objects) ids.add(o.id)
      for (const c of branch.signalConnections) signalIds.add(c.id)
      objects.push(...branch.objects)
      signalConnections.push(...branch.signalConnections)
    } catch (err) {
      if (!onError) throw err
      onError(err, root)
    }
  }
  validateNodeTree(objects)
  return { ...record, objects, signalConnections }
}

/** Cierre sobre escenas instanciadas: la lista Build selecciona niveles de arranque,
 * pero no puede excluir recursos Scene que esos niveles o Prefabs globales consumen.
 * Preserva el orden de las escenas seleccionadas para no alterar startScene. */
export function includeInstancedSceneSources(scenes, records, chosen, prefabs = []) {
  const known = new Set((scenes || []).map(s => s.id))
  const included = new Set(chosen)
  const pending = [...chosen]
  const include = sourceId => {
    if (!sourceId) return
    if (!known.has(sourceId)) throw new Error(`Build: referencia a escena inexistente (${sourceId})`)
    if (!included.has(sourceId)) { included.add(sourceId); pending.push(sourceId) }
  }
  for (const prefab of prefabs || []) for (const obj of authoredSceneTree(prefab).objects) include(sceneSourceId(obj))
  for (let i = 0; i < pending.length; i++) {
    const sceneId = pending[i]
    const record = records.get(sceneId)
    if (!record) throw new Error(`Build: contenido de escena inexistente (${sceneId})`)
    for (const obj of authoredSceneTree(record).objects) include(sceneSourceId(obj))
  }
  return [...included]
}
