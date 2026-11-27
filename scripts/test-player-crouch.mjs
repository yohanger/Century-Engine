import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { crouchMethods, crouchHeight } from '../src/engine/runtime/events/play-crouch.js'
import { NodeBodyRuntime } from '../src/engine/runtime/physics/node-bodies.js'
import { JoltWorld, loadJolt } from '../src/engine/runtime/physics/jolt.js'
import { makeObject } from '../src/engine/runtime/nodes/index.js'
import { normalizeLevel } from '../src/engine/runtime/world/params.js'
import { PLAYER_DEFAULTS } from '../src/engine/runtime/database/player.js'

test('La escena permite agacharse salvo que se desactive el permiso', () => {
  assert.equal(normalizeLevel().canCrouch, true)
  assert.equal(normalizeLevel({ canCrouch: false }).canCrouch, false)
})

test('El jugador encoge la cápsula real, baja la cámara y sigue agachado bajo un techo', async () => {
  const J = await loadJolt()
  const phys = new JoltWorld(J)
  const objects = [
    makeObject('characterbody3d', 'characterbody3d', { id: 'player', position: [3, 0, 0] }),
    makeObject('collisionshape3d', 'collisionshape3d', { id: 'capsule', parentId: 'player',
      props: { shape: { type: 'CapsuleShape3D', radius: 0.32, height: 1.8 } } }),
    makeObject('staticbody3d', 'staticbody3d', { id: 'ceiling', position: [0, 1.6, 0] }),
    makeObject('collisionshape3d', 'collisionshape3d', { id: 'roof', parentId: 'ceiling',
      props: { shape: { type: 'BoxShape3D', size: [1.8, 0.4, 1.8] } } }),
    makeObject('camera', 'camera', { id: 'camera', parentId: 'player', position: [0, 1.6, 0] }),
  ]
  const nodes = new Map(objects.map(obj => {
    const node = new THREE.Object3D()
    node.position.fromArray(obj.position)
    return [obj.id, node]
  }))
  for (const obj of objects) if (obj.parentId) nodes.get(obj.parentId).add(nodes.get(obj.id))
  const cfg = { ...PLAYER_DEFAULTS, height: 1.8, radius: 0.32, eyeHeight: 1.6 }
  const changes = []
  const play = Object.assign({
    phys, ed: { nodes }, project: { objects }, colliders: [], _bodies: [],
    level: normalizeLevel(), game: { db: { player: cfg }, emit: (_event, change) => changes.push(change.on) },
    _nativePlayerId: 'player', _nodeEnabled: () => true, _nativePitchCamera: () => objects.at(-1),
  }, crouchMethods)
  const bodies = new NodeBodyRuntime(play, 1)
  try {
    bodies.start()
    const spatial = bodies.spatial
    const body = spatial.characters.get('player')
    spatial.configurePlayerShape('player', cfg)
    body.onFloor = true
    const request = play._nativeCrouchState()
    request.script = true
    play._nativeCrouchStep(1 / 60)
    assert.equal(request.on, true)
    assert.equal(body.playerCapsule.height, crouchHeight(cfg))
    play._nativeCrouchView(1)
    assert.ok(nodes.get('camera').position.y < cfg.eyeHeight)
    spatial.setVelocity('player', [10, 2, 0])
    play._nativeCrouchSpeed()
    assert.deepEqual(body.velocity, [cfg.walk * cfg.crouchSpeed, 2, 0])

    nodes.get('player').position.x = 0
    spatial.syncCharacter(body)
    request.script = false
    play._nativeCrouchStep(1 / 60)
    assert.equal(request.on, true)
    assert.equal(body.playerCapsule.height, crouchHeight(cfg))

    nodes.get('player').position.x = 3
    spatial.syncCharacter(body)
    play._nativeCrouchStep(0.2)
    assert.equal(request.on, false)
    assert.equal(body.playerCapsule.height, cfg.height)
    assert.deepEqual(changes, [true, false])

    play.level.canCrouch = false
    request.script = true
    play._nativeCrouchStep(1 / 60)
    assert.equal(request.on, false)
  } finally {
    bodies.dispose()
    phys.dispose()
  }
})
