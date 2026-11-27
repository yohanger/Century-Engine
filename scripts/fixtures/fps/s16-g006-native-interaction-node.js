// Script de Nodo G006, adjunto a CharacterBody3D con Camera3D hija «VistaFPS».
// La selección editorial y el FPS heredado no participan en esta interacción.
const INTERACTION_DISTANCE = 3
let camera = null

function _ready() {
  camera = node.get_node('VistaFPS')
  if (!camera || camera.type !== 'camera') throw new Error('Interacción FPS nativa: falta Camera3D hija «VistaFPS»')
}

function _process(delta) {
  if (!game.input.justPressed('interact') || !camera?.is_valid()) return
  const active = game.camera.active
  if (active && (active.kind !== 'camera3d' || active.id !== camera.id)) return

  // Un rayo único contra la primera superficie: no atravesar paredes no interactivas.
  const hit = game.raycast(camera.worldPosition, camera.worldForward, INTERACTION_DISTANCE, { ignore: node })
  const target = hit?.kind === 'solid' ? hit.node : null
  if (!target?.is_valid() || !target.is_in_group('interactable')) return
  // El objetivo decide qué hace: no existe un gestor ni un estado paralelo de interacción.
  return target.call('interact', node.id)
}
