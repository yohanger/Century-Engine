// CharacterBody3D FPS: consume los parámetros existentes de Database ▸ Jugador.
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
