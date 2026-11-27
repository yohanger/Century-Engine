// Recursos de autoría para la plantilla First Person. No participan en el runtime ni crean controladores.
// Los scripts son las versiones G004–G006; quedan como recursos editables al crear el proyecto.
const FPS_SCRIPTS = [
  { name: 'FPS-Locomocion.js', code: `// CharacterBody3D FPS: consume los parámetros existentes de Database ▸ Jugador.
// Jolt integra la física; este script solo escribe la velocidad deseada.
let jumpPending = false
let jumpAge = 0
let timeOffGround = Infinity

function _ready() {
  jumpPending = false
  jumpAge = 0
  timeOffGround = Infinity
}

function _process(_delta) {
  if (game.input.justPressed('jump')) { jumpPending = true; jumpAge = 0 }
}

function _physics_process(delta) {
  const player = game.player
  // El mismo recurso puede estar en otro Prefab: solo mueve al jugador designado.
  if (!player?.node || player.node.id !== node.id) return
  const level = game.level || {}
  const blocked = !player.control || player.mode !== 'free'
  const { x, y } = blocked ? { x: 0, y: 0 } : game.input.vector('move_left', 'move_right', 'move_back', 'move_forward')
  const ground = player.ground || (node.onFloor ? 'stable' : 'air')
  const speedScale = level.speedScale ?? 1
  const speed = (level.canRun !== false && game.input.pressed('run') ? player.run : player.walk) * speedScale
  const yaw = node.rotation[1] * Math.PI / 180
  const sin = Math.sin(yaw), cos = Math.cos(yaw)
  const targetX = (cos * x - sin * y) * speed
  const targetZ = (-sin * x - cos * y) * speed
  const velocity = node.velocity
  const differenceX = targetX - velocity[0], differenceZ = targetZ - velocity[2]
  const distance = Math.hypot(differenceX, differenceZ)
  const current = Math.hypot(velocity[0], velocity[2])
  const target = Math.hypot(targetX, targetZ)
  const accelerating = target >= current
  let rate = ground === 'air' ? (accelerating ? player.airAccel : player.airDecel)
    : ground === 'steep' ? (accelerating ? player.slideAccel : player.slideDecel)
    : (accelerating ? player.groundAccel : player.groundDecel)
  if (accelerating && ground === 'stable' && current > 0.1 && target > 0.1) {
    const alignment = (velocity[0] * targetX + velocity[2] * targetZ) / (current * target)
    rate *= 1 + (player.turnBoost - 1) * Math.acos(Math.max(-1, Math.min(1, alignment))) / Math.PI
  }
  const change = Math.min(distance, rate * Math.max(0, delta))
  const ratio = distance > 0 ? change / distance : 0
  const nextX = velocity[0] + differenceX * ratio
  const nextZ = velocity[2] + differenceZ * ratio

  const canJumpFromGround = ground === 'stable' || (ground === 'steep' && player.jumpOnSteep)
  timeOffGround = canJumpFromGround ? 0 : timeOffGround + delta
  if (jumpPending) jumpAge += delta
  if (jumpAge > player.jumpBuffer || blocked) jumpPending = false
  const gravity = player.jumpAuto ? 2 * player.jumpHeight / (player.jumpTime ** 2) : player.gravity
  const jumpSpeed = player.jumpAuto ? gravity * player.jumpTime : player.jump
  const jumping = jumpPending && level.canJump !== false && (canJumpFromGround || timeOffGround <= player.coyote)
  const nextY = jumping ? jumpSpeed : velocity[1]
  if (jumping) jumpPending = false
  node.velocity = [nextX, nextY, nextZ]
}
` },
  { name: 'FPS-Camara.js', code: `// Script ordinario adjunto al CharacterBody3D que contiene una Camera3D hija «VistaFPS».
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
` },
  { name: 'FPS-Interaccion.js', code: `// Script de Nodo G006, adjunto a CharacterBody3D con Camera3D hija «VistaFPS».
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
` },
]

/** Genera recursos ordinarios de proyecto, sin instanciar el personaje en la escena. */
export function createFirstPersonResources({ uid, makeObject }) {
  const scripts = FPS_SCRIPTS.map(({ name, code }) => ({ id: uid('sc'), name, folder: 'Assets/Scripts', execution: 'node', code }))
  const prefabRoot = makeObject('node3d', 'node3d', { id: uid(), name: 'Personaje FPS' })
  const body = makeObject('characterbody3d', 'characterbody3d', {
    // CharacterVirtual usa la posición del nodo como pies: la cápsula sube desde ahí.
    id: uid(), name: 'CharacterBody3D', parentId: prefabRoot.id, position: [0, 0, 0],
    scriptIds: scripts.map(script => script.id),
  })
  const capsule = makeObject('collisionshape3d', 'collisionshape3d', {
    id: uid(), name: 'Capsula FPS', parentId: body.id,
    props: { shape: { type: 'CapsuleShape3D', radius: 0.32, height: 1.8 }, disabled: false },
  })
  const camera = makeObject('camera', 'camera', {
    id: uid(), name: 'VistaFPS', parentId: body.id, position: [0, 1.65, 0],
    props: { main: true, fov: 90 },
  })
  const prefab = { id: uid('pf'), name: 'Personaje FPS', folder: 'Assets/Prefabs', rev: 1,
    objects: [prefabRoot, body, capsule, camera], signalConnections: [] }
  return { folders: ['Assets/Prefabs', 'Assets/Scripts'], scripts, prefabs: [prefab] }
}
