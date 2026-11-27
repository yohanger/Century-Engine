import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const source = read('src/core/editor/player-preview.js').replace(/^import .*$/gm, '').replace(/^export /gm, '')
const updateCalls = []
const def = {
  collisionshape3d: { update(node, obj) {
    updateCalls.push(['collisionshape3d', obj.id])
    node.userData.viewShape = node.userData.editorPreviewShape || obj.props.shape
    node.userData.viewCenterY = node.userData.editorCapsuleFeet ? node.userData.viewShape.height / 2 : 0
  } },
  camera: { update(node, obj) {
    updateCalls.push(['camera', obj.id])
    node.position = { x: obj.position[0], y: obj.position[1], z: obj.position[2] }
    node.userData.viewFov = node.userData.editorPlayerFov ?? obj.props.fov
  } },
}
const { playerSceneVisuals, syncPlayerSceneVisuals } = new Function(
  'getDef', 'sceneGameConfig', 'resolveScenePlayerNode', 'findPlayerCamera', 'nodeEffectiveActive',
  `${source}\nreturn { playerSceneVisuals, syncPlayerSceneVisuals }`,
)(
  type => def[type],
  project => ({ config: { ...project.game, ...(project.gameManagers?.find(g => g.id === project.scenes[0].gameManagerId) || {}) } }),
  (scene, objects) => {
    const obj = objects.find(o => o.id === scene.playerNodeId)
    return { status: obj?.type === 'characterbody3d' && obj.active !== false ? 'valid' : 'unassigned', id: obj?.id }
  },
  (objects, id, enabled) => objects.find(o => o.type === 'camera' && enabled(o) && o.parentId === id) || null,
  (_objects, obj) => obj.active !== false,
)

const body = id => ({ id, type: 'characterbody3d', props: {} })
const capsule = (id, parentId, height, radius) => ({ id, type: 'collisionshape3d', parentId, props: { shape: { type: 'CapsuleShape3D', height, radius } } })
const camera = (id, parentId, y = 0.6) => ({ id, parentId, type: 'camera', position: [0.18, y, -0.13], props: { fov: 62 } })
const makeProject = () => ({
  activeSceneId: 'scene', scenes: [{ id: 'scene', playerNodeId: 'player' }], game: { player: 'fps' },
  database: { player: { height: 1.8, radius: 0.32, eyeHeight: 1.65, fov: 90, slots: [{ id: 'right', pos: [0.28, -0.24, -0.5] }] } },
  objects: [body('player'), capsule('player-cap', 'player', 2.4, 0.5), camera('player-cam', 'player'),
    body('npc'), capsule('npc-cap', 'npc', 2.2, 0.45), camera('npc-cam', 'npc', 1.3),
    { id: 'static', type: 'staticbody3d' }, capsule('static-cap', 'static', 2.7, 0.5)],
})
const makeEditor = project => ({ isPlaying: false, host: { project }, nodes: new Map(project.objects.map(o => [o.id, {
  userData: {}, position: { x: o.position?.[0] || 0, y: o.position?.[1] || 0, z: o.position?.[2] || 0 },
  updates: 0, updateMatrixWorld() { this.updates++ },
}])), vp: { draws: 0, requestRender() { this.draws++ } } })

test('PV-01: Player designado consume dimensiones y ojos de Database solo en el Editor', () => {
  const project = makeProject(), editor = makeEditor(project)
  const before = JSON.stringify(project)
  assert.equal(syncPlayerSceneVisuals(editor), true)
  const cap = editor.nodes.get('player-cap')
  assert.equal(cap.userData.viewShape.height, 1.8)
  assert.equal(cap.userData.viewShape.radius, 0.32)
  assert.equal(cap.userData.viewCenterY, 0.9)
  assert.equal(editor.nodes.get('player-cam').position.y, 1.65)
  assert.equal(editor.nodes.get('player-cam').position.x, 0.18)
  assert.equal(editor.nodes.get('player-cam').userData.viewFov, 90)
  assert.equal(JSON.stringify(project), before)
})

test('PV-02: CharacterBody3D no jugador usa cápsula autoral centrada desde los pies', () => {
  const editor = makeEditor(makeProject()); syncPlayerSceneVisuals(editor)
  const cap = editor.nodes.get('npc-cap')
  assert.equal(cap.userData.viewShape.height, 2.2)
  assert.equal(cap.userData.viewCenterY, 1.1)
  assert.equal(editor.nodes.get('npc-cam').position.y, 1.3)
  assert.notEqual(editor.nodes.get('npc-cam').userData.editorPlayerCamera, true)
})

test('PV-03: Collider no personaje conserva su centro y tamaño originales', () => {
  const editor = makeEditor(makeProject()); syncPlayerSceneVisuals(editor)
  const cap = editor.nodes.get('static-cap')
  assert.equal(cap.userData.viewShape.height, 2.7)
  assert.equal(cap.userData.viewCenterY, 0)
})

test('PV-04: cambios en Database actualizan inmediatamente dimensiones, cámara y FOV sin mutar escena', () => {
  const project = makeProject(), editor = makeEditor(project)
  syncPlayerSceneVisuals(editor)
  updateCalls.length = 0
  project.database.player.height = 2.2
  project.database.player.radius = 0.42
  project.database.player.eyeHeight = 1.95
  project.database.player.fov = 80
  syncPlayerSceneVisuals(editor)
  assert.equal(editor.nodes.get('player-cap').userData.viewCenterY, 1.1)
  assert.equal(editor.nodes.get('player-cap').userData.viewShape.radius, 0.42)
  assert.equal(editor.nodes.get('player-cam').position.y, 1.95)
  assert.equal(editor.nodes.get('player-cam').userData.viewFov, 80)
  assert.deepEqual(updateCalls, [['collisionshape3d', 'player-cap'], ['camera', 'player-cam']])
  assert.deepEqual(project.objects[1].props.shape, { type: 'CapsuleShape3D', height: 2.4, radius: 0.5 })
  assert.deepEqual(project.objects[2].position, [0.18, 0.6, -0.13])
})

test('PV-05: reasignar identidad restaura los valores autorales del jugador anterior', () => {
  const project = makeProject(), editor = makeEditor(project)
  syncPlayerSceneVisuals(editor)
  project.scenes[0].playerNodeId = 'npc'
  syncPlayerSceneVisuals(editor)
  assert.equal(editor.nodes.get('player-cap').userData.viewShape.height, 2.4)
  assert.equal(editor.nodes.get('player-cap').userData.viewCenterY, 1.2)
  assert.equal(editor.nodes.get('player-cam').position.y, 0.6)
  assert.equal(editor.nodes.get('player-cam').userData.viewFov, 62)
  assert.equal(editor.nodes.get('npc-cap').userData.viewShape.height, 1.8)
  assert.equal(editor.nodes.get('npc-cam').position.y, 1.65)
})

test('PV-06: sin designación o en aparición por API no aplica configuración de jugador a otros nodos', () => {
  for (const assign of [scene => { scene.playerNodeId = '' }, scene => { scene.playerSpawnMode = 'api' }]) {
    const project = makeProject(); assign(project.scenes[0]); const editor = makeEditor(project)
    syncPlayerSceneVisuals(editor)
    assert.equal(editor.nodes.get('player-cap').userData.viewShape.height, 2.4)
    assert.equal(editor.nodes.get('player-cam').position.y, 0.6)
  }
})

test('PV-07: fuera de Editor no modifica la escena activa durante Play', () => {
  const editor = makeEditor(makeProject()); editor.isPlaying = true
  updateCalls.length = 0
  assert.equal(syncPlayerSceneVisuals(editor), false)
  assert.equal(editor.vp.draws, 0)
  assert.deepEqual(updateCalls, [])
})

test('PV-08: el cambio sin valores nuevos no reconstruye ni re-renderiza', () => {
  const editor = makeEditor(makeProject()); syncPlayerSceneVisuals(editor)
  updateCalls.length = 0
  const prev = editor.vp.draws
  assert.equal(syncPlayerSceneVisuals(editor), false)
  assert.equal(editor.vp.draws, prev)
  assert.deepEqual(updateCalls, [])
})

test('PV-09: el refresco de un solo nodo no altera otros cuerpos ni cámaras', () => {
  const editor = makeEditor(makeProject())
  assert.equal(syncPlayerSceneVisuals(editor, editor.host.project.objects.find(obj => obj.id === 'player-cap')), true)
  assert.equal(editor.nodes.get('npc-cap').userData.viewShape, undefined)
  assert.equal(editor.nodes.get('player-cam').position.y, 0.6)
})

test('PV-10: la vista de pies usa la mitad de la altura como Jolt y Database', () => {
  const physics = read('src/engine/runtime/nodes/physics.js')
  const jolt = read('src/engine/runtime/physics/jolt-character.js')
  const preview = read('src/components/PlayerPreview.vue')
  assert.match(physics, /root\.userData\.editorCapsuleFeet && shape\.type === 'CapsuleShape3D' \? shape\.height \/ 2 : 0/)
  assert.match(jolt, /new J\.Vec3\(0, height \/ 2, 0\)/)
  assert.match(preview, /body\.position\.y = p\.height \/ 2/)
})

test('PV-11: los tres subsistemas se vinculan sin modificar Runtime ni estado persistido', () => {
  const source = read('src/core/editor.js')
  const keys = read('src/core/editor/keys.js')
  const cam = read('src/engine/runtime/nodes/camera.js')
  assert.match(source, /syncPlayerSceneVisuals\(this\)/)
  assert.match(source, /syncPlayerSceneVisuals\(this, obj\)/)
  assert.match(source, /syncPlayerSceneVisuals\(this, obj\)/)
  assert.match(keys, /p\?\.height, p\?\.radius, p\?\.eyeHeight, p\?\.fov/)
  assert.match(cam, /editorPlayerCamera \? 0\.4 : 3/)
})
