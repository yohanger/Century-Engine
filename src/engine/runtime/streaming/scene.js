import * as THREE from 'three'
import { deserializeAll } from '../geometry/terrains.js'
import { getDef } from '../nodes/index.js'
import { nodeEffectiveActive, validateNodeTree } from '../nodes/hierarchy.js'
import { NodeBodyRuntime } from '../physics/node-bodies.js'
import { normalizeStreaming } from './config.js'
import { WorldStreamer } from './streamer.js'
import { expandSceneInstances, readSceneSources } from '../scene/instances.js'

const CONTENT = new Set(['node', 'node3d', 'sceneInstance', 'group', 'primitive', 'mesh', 'model', 'staticbody3d', 'collisionshape3d', 'terrain'])

function streamableObjects(objects) {
  const byId = validateNodeTree(objects)
  const supported = new Map()
  function include(obj) {
    if (supported.has(obj.id)) return supported.get(obj.id)
    const parent = byId.get(obj.parentId)
    const keep = CONTENT.has(obj.type) && (!parent || include(parent)) &&
      (obj.type !== 'collisionshape3d' || parent?.type === 'staticbody3d')
    supported.set(obj.id, keep)
    return keep
  }
  return objects.filter(include)
}

export function createSceneStreamer(play, collisionLayer) {
  const { ed: graph, rt: host, project } = play
  const ownerId = project.activeSceneId
  const config = normalizeStreaming(project.scenes.find(scene => scene.id === ownerId)?.streaming, ownerId)
  if (!config.enabled || !config.chunks.length || !host.readStreamScene) return null
  return new WorldStreamer({
    ...config,
    async prepare(id, signal) {
      const authored = await host.readStreamScene(id)
      if (signal.aborted) return null
      if (!authored) throw new Error('Escena de chunk no disponible')
      const sources = await readSceneSources(authored.objects || [], sceneId => host.readStreamScene(sceneId))
      if (signal.aborted) return null
      // Streaming consume la misma jerarquía expandida, sin duplicar el modelo de escena.
      const scene = expandSceneInstances(authored, id, sources)
      const models = new Set(streamableObjects(scene.objects || []).filter(obj => obj.type === 'model').map(obj => obj.modelId).filter(Boolean))
      for (const terrain of [scene.terrain, ...(scene.terrain?.extra || [])]) {
        for (const item of terrain?.foliage || []) {
          const foliage = item.cfg || item
          if (foliage.source === 'model' && foliage.modelId) models.add(foliage.modelId)
        }
      }
      const release = await host.retainStreamModels?.(models, signal)
      return { scene, release }
    },
    mount: ({ scene }, chunk, detail) => mountChunk(graph, play, collisionLayer, scene, chunk, detail),
    onError: (error, id) => host.log?.(`Streaming de ${id}: ${error.message}`, 'error', 'Streaming'),
  })
}

export function mountChunkPreview(graph, scene, chunk) {
  return mountChunk(graph, null, null, scene, chunk, true)
}

function mountChunk(graph, play, collisionLayer, scene, chunk, detail) {
  const root = new THREE.Group()
  root.name = `Streaming · ${detail ? chunk.sceneId : chunk.distantSceneId}`
  root.position.set(chunk.x, chunk.y, chunk.z)
  const namespace = root.uuid + '/'
  const source = streamableObjects(scene.objects || [])
  const idsBySource = new Map(source.map((o, index) => [o.id, namespace + index]))
  const objects = source.map(o => ({
    ...o, id: idsBySource.get(o.id),
    parentId: idsBySource.get(o.parentId) || null,
    ...(o.type === 'collisionshape3d' && o.props?.shape?.sourceId ? {
      props: { ...o.props, shape: { ...o.props.shape, sourceId: idsBySource.get(o.props.shape.sourceId) || '' } },
    } : {}),
  }))
  const byId = validateNodeTree(objects)
  const nodes = new Map(), terrains = [], terrainParts = [], addedTerrain = [], ids = new Set()
  const context = { ...graph._ctx(), getDecalTarget: id => nodes.get(id) }
  const physics = play && new NodeBodyRuntime({
    project: { objects }, ed: { nodes }, phys: play.phys,
    get colliders() { return play.colliders },
    set colliders(value) { play.colliders = value },
    _nodeEnabled: obj => nodeEffectiveActive(byId, obj),
  }, collisionLayer)
  const dispose = () => {
    play?.lod?.clusters?.removeStreamed(root)
    physics?.detach(ids)
    for (const terrain of addedTerrain) play.phys?.removeTerrain(terrain.id)
    for (const terrain of terrains) { graph.streamedTerrains.delete(terrain); terrain.dispose() }
    root.removeFromParent()
    for (const node of nodes.values()) {
      const data = node.userData
      data.disposePhysicsPreview?.()
      data.meshBody?.geometry.dispose()
      if (data.metricOwnGeometry) data.visual.children.find(child => child.isMesh)?.geometry.dispose()
      if (data.modelRoot) {
        const skeletons = new Set()
        data.modelRoot.traverse(child => { if (child.isSkinnedMesh) skeletons.add(child.skeleton) })
        for (const skeleton of skeletons) skeleton.dispose()
      } else if (node._lfNodeOwner?.type === 'model') data.visual.children[0]?.material.dispose()
      data.mat?.dispose()
    }
    graph.vp.invalidateShadows()
    graph.vp.requestRender()
  }
  try {
    for (const obj of objects) {
      if (obj.type === 'terrain' || (!detail && obj.type === 'collisionshape3d')) continue
      const def = getDef(obj.type)
      const node = def.build(obj, context)
      node._lfNodeOwner = obj
      nodes.set(obj.id, node)
      ids.add(obj.id)
      def.update(node, obj)
      node.visible = obj.visible !== false && nodeEffectiveActive(byId, obj)
      if ((obj.type === 'collisionshape3d' || obj.type === 'staticbody3d') && node.userData.visual) node.userData.visual.visible = false
      graph._applyShadowFlags(node, obj)
    }
    // En el LOD lejano se conservan los transformes de los padres físicos.
    for (const obj of objects) {
      const node = nodes.get(obj.id)
      if (node) (nodes.get(obj.parentId) || root).add(node)
    }
    graph.vp.world.add(root)
    if (scene.terrain) {
      terrains.push(...deserializeAll(scene.terrain))
      for (const terrain of terrains) {
        const originalId = terrain.id
        const obj = byId.get(idsBySource.get(originalId))
        terrain.id = namespace + 'terrain/' + originalId
        if (obj && !nodeEffectiveActive(byId, obj)) terrain.enabled = false
        const show = terrain.enabled && terrain.visible !== false && obj?.visible !== false
        terrain.ox += chunk.x; terrain.oy += chunk.y; terrain.oz += chunk.z
        terrain.mesh.position.set(terrain.ox - chunk.x, terrain.oy - chunk.y, terrain.oz - chunk.z)
        terrain.foliage.group.position.copy(terrain.mesh.position)
        terrain.mesh.visible = show && graph.host.view.terrain !== false
        terrain.foliage.group.visible = show && graph.host.view.foliage !== false
        terrain.foliage.requestRender = () => graph.vp.requestRender()
        root.add(terrain.mesh, terrain.foliage.group)
        if (!play) terrainParts.push({ mesh: terrain.mesh, foliage: terrain.foliage.group, visible: show })
        if (play && detail && terrain.enabled) {
          graph.streamedTerrains.add(terrain)
          play.phys?.addTerrain(terrain)
          addedTerrain.push(terrain)
        }
      }
    }
    if (detail && play?.phys) physics.attach(ids)
    if (detail) play?.lod?.clusters?.addStreamed(nodes, root)
    graph.vp.invalidateShadows()
    graph.vp.requestRender()
    return {
      root, terrainParts,
      sourceNodes: play ? null : new Map([...idsBySource].map(([id, mountedId]) => [id, nodes.get(mountedId)]).filter(([, node]) => node)),
      show(visible) {
        if (visible === root.visible) return
        root.visible = visible
        graph.vp.invalidateShadows()
        graph.vp.requestRender()
      },
      dispose,
    }
  } catch (error) {
    dispose()
    throw error
  }
}
