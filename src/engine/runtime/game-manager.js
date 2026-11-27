// Un recurso configura la escena; no crea un segundo gestor de jugador, cámara o render.

export const MANAGER_FOLDER = 'Assets/GameManagers'
export const MANAGER_EXT = '.gamemanager'

export function normalizeGameManager(data = {}) {
  const player = typeof data.player === 'string' && /^[a-z][a-z0-9_-]{0,30}$/i.test(data.player) ? data.player : 'inherit'
  return {
    id: data.id || '', name: data.name || 'GameManager.gamemanager',
    folder: data.folder || MANAGER_FOLDER,
    player, camera: typeof data.camera === 'string' ? data.camera : '',
    profile: typeof data.profile === 'string' ? data.profile : '',
  }
}

// Las escenas antiguas y las que no tienen GameManager conservan project.game sin cambios.
export function sceneGameManager(project, sceneId = project?.activeSceneId) {
  const scene = project?.scenes?.find((s) => s.id === sceneId)
  if (!scene?.gameManagerId) return null
  const resource = project?.gameManagers?.find((m) => m.id === scene.gameManagerId)
  if (!resource) return null
  const manager = normalizeGameManager(resource)
  if (manager.profile && !project.profiles?.some((p) => p.id === manager.profile)) manager.profile = ''
  return manager
}

export function sceneGameConfig(project, sceneId = project?.activeSceneId) {
  const gm = sceneGameManager(project, sceneId)
  const config = { ...(project?.game || {}) }
  if (gm && gm.player !== 'inherit') config.player = gm.player
  return { manager: gm, config }
}
