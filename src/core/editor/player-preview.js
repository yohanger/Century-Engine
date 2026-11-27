import { getDef } from '../../engine/runtime/nodes/index.js'
import { sceneGameConfig } from '../../engine/runtime/game-manager.js'
import { resolveScenePlayerNode } from '../project.js'
import { findPlayerCamera } from '../../engine/runtime/events/play-player.js'
import { nodeEffectiveActive } from '../../engine/runtime/nodes/hierarchy.js'

export function playerSceneVisuals(project) {
  const scene = project?.scenes?.find(s => s.id === project.activeSceneId)
  const config = project && sceneGameConfig(project).config
  if (!scene || scene.playerSpawnMode === 'api' || config?.player === 'none') return null
  const owner = resolveScenePlayerNode(scene, project.objects)
  if (owner.status !== 'valid') return null
  const db = project.database?.player
  if (!db || !Number.isFinite(db.height) || !Number.isFinite(db.radius) || db.height < db.radius * 2 || db.radius <= 0) return null
  const camera = findPlayerCamera(project.objects, owner.id, obj => nodeEffectiveActive(project.objects, obj))
  return { bodyId: owner.id, cameraId: camera?.parentId === owner.id ? camera.id : null,
    height: db.height, radius: db.radius, eyeHeight: db.eyeHeight, fov: db.fov }
}

export function syncPlayerSceneVisuals(editor, only = null) {
  if (editor.isPlaying) return false
  const project = editor.host.project
  if (!project) return false
  const objects = project.objects || []
  const selected = only && (typeof only === 'string' ? objects.find(obj => obj.id === only) : only)
  if (only && !['camera', 'collisionshape3d'].includes(selected?.type)) return false
  const byId = new Map(objects.map(obj => [obj.id, obj]))
  const player = playerSceneVisuals(project)
  let dirty = false
  for (const obj of selected ? [selected] : objects) {
    const node = editor.nodes.get(obj.id)
    if (!node) continue
    if (obj.type === 'collisionshape3d') {
      const isCharacter = byId.get(obj.parentId)?.type === 'characterbody3d' && obj.props?.shape?.type === 'CapsuleShape3D'
      const playerBody = isCharacter && player?.bodyId === obj.parentId
      const override = playerBody ? { ...obj.props.shape, radius: player.radius, height: player.height } : null
      const current = node.userData.editorPreviewShape
      if (node.userData.editorCapsuleFeet === isCharacter &&
        (current?.radius ?? null) === (override?.radius ?? null) &&
        (current?.height ?? null) === (override?.height ?? null)) continue
      node.userData.editorCapsuleFeet = isCharacter
      node.userData.editorPreviewShape = override
      getDef('collisionshape3d').update(node, obj)
      dirty = true
    } else if (obj.type === 'camera') {
      const active = !!player && obj.id === player.cameraId
      const previous = node.userData.editorPlayerCamera === true
      if (previous !== active || (active && node.userData.editorPlayerFov !== player.fov)) {
        node.userData.editorPlayerCamera = active
        node.userData.editorPlayerFov = active ? player.fov : undefined
        getDef('camera').update(node, obj)
        dirty = true
      }
      if (active && Number.isFinite(player.eyeHeight) && node.position.y !== player.eyeHeight) {
        node.position.y = player.eyeHeight
        node.updateMatrixWorld(true)
        dirty = true
      }
    }
  }
  if (dirty) editor.vp.requestRender()
  return dirty
}
