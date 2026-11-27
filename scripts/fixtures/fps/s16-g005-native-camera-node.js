// Script ordinario adjunto al CharacterBody3D que contiene una Camera3D hija «VistaFPS».
// Camera Orchestration decide qué cámara dibuja; este script únicamente orienta sus nodos.
const LOOK_SENSITIVITY = 0.126 // grados por píxel; equivalente a la sensibilidad base del FPS heredado
const PITCH_LIMIT = 85
let camera = null

function _ready() {
  camera = node.get_node('VistaFPS')
  if (!camera || camera.type !== 'camera') {
    throw new Error('FPS nativo: falta Camera3D hija «VistaFPS»')
  }
}

function _process(delta) {
  if (!camera?.is_valid()) return
  const active = game.camera.active
  // FilmMaker, Timeline, otro Camera3D o una solicitud externa conservan su autoridad.
  if (active && (active.kind !== 'camera3d' || active.id !== camera.id)) return
  const { x, y } = game.input.pointerDelta
  if (!x && !y) return
  const sensitivity = LOOK_SENSITIVITY * (game.player?.sensitivity ?? 1)
  const yaw = node.rotation
  node.rotation = [yaw[0], yaw[1] - x * sensitivity, yaw[2]]
  const pitch = camera.rotation
  const next = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch[0] - y * sensitivity))
  camera.rotation = [next, pitch[1], pitch[2]]
}
