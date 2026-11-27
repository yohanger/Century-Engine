// Clasificación de ayudas de autoría existentes. Las opciones pertenecen al Editor,
// nunca a la escena ni al Runtime. No crea geometrías ni otro sistema de gizmos.
export const GIZMO_CATEGORIES = Object.freeze([
  { id: 'cameras', label: 'Cámaras', icon: 'camera' },
  { id: 'lights', label: 'Luces', icon: 'light' },
  { id: 'audio', label: 'Audio', icon: 'audio' },
  { id: 'colliders', label: 'Colisiones y físicas', icon: 'shape-box' },
  { id: 'volumes', label: 'Triggers y volúmenes', icon: 'trigger' },
  { id: 'other', label: 'Otros auxiliares', icon: 'eye' },
])

const CAMERA = new Set(['camera', 'camera-shake'])
const PHYSICS = new Set(['collisionshape3d', 'staticbody3d', 'rigidbody3d', 'characterbody3d', 'area3d'])
const VOLUME = new Set(['trigger', 'atmovolume', 'postvolume', 'navigation'])

export function gizmoCategory(obj) {
  const type = obj?.type
  if (CAMERA.has(type)) return 'cameras'
  if (type === 'light') return 'lights'
  if (type === 'audio') return 'audio'
  if (PHYSICS.has(type)) return 'colliders'
  if (VOLUME.has(type)) return 'volumes'
  return 'other'
}

/** La ausencia de un ajuste significa «visible» para proyectos/perfiles existentes. */
export function gizmosEnabled(prefs, category) {
  return prefs?.showGizmos !== false && prefs?.gizmoCategories?.[category] !== false
}
