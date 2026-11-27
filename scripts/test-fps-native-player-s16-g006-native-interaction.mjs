import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { InputState, defaultInputMap, setBindings } from '../src/engine/runtime/input/inputmap.js'
import { inputMethods } from '../src/engine/runtime/events/play-input.js'
import { validateNodeTree } from '../src/engine/runtime/nodes/hierarchy.js'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const scene = JSON.parse(read('scripts/fixtures/fps/s16-g006-native-interaction-scene.json'))
const code = read('scripts/fixtures/fps/s16-g006-native-interaction-node.js')
const targetCode = read('scripts/fixtures/fps/s16-g006-interactable-target-node.js')
const makeController = new Function('game', 'node', code + '\nreturn { ready:_ready, frame:_process }')
const makeTarget = new Function('game', 'node', targetCode + '\nreturn { ready:_ready }')

function setup() {
  const state = new InputState(defaultInputMap())
  const input = inputMethods._inputApi.call({ input: state, _inApi: null })
  const camera = { id: 'native-camera', type: 'camera', worldPosition: [2, 1.65, 3], worldForward: [0, 0, -1], is_valid: () => true }
  const body = { id: 'a', get_node(path) { return path === 'VistaFPS' ? camera : null } }
  const records = []
  const target = {
    id: 'interact-target', name: 'ObjetoInteractivo', type: 'staticbody3d',
    is_valid: () => true, is_in_group: name => name === 'interactable',
    call(name, ...args) { records.push([name, ...args]) },
  }
  const raycasts = []
  const game = { input, camera: { active: { kind: 'camera3d', id: camera.id } }, raycast(...args) { raycasts.push(args); return { kind: 'solid', node: target } } }
  const script = makeController(game, body)
  script.ready()
  const frame = token => { if (token !== undefined) state.set(token, 1); state.step(); script.frame(1 / 60) }
  return { state, input, game, body, camera, target, records, raycasts, script, frame }
}

test('G006-01: fixture contiene CharacterBody3D, Camera3D y receptor con collider ordinario', () => {
  assert.doesNotThrow(() => validateNodeTree(scene.objects))
  const body = scene.objects.find(o => o.id === 'a')
  const camera = scene.objects.find(o => o.id === 'native-camera')
  const target = scene.objects.find(o => o.id === 'interact-target')
  assert.equal(camera.parentId, body.id)
  assert.equal(target.type, 'staticbody3d')
  assert.equal(scene.objects.find(o => o.id === 'interact-shape').parentId, target.id)
  assert.ok(body.scriptIds.includes('native-interaction-a'))
  assert.equal(scene.scripts.find(s => s.id === 'native-interaction-a').code, code)
  assert.equal(scene.scripts.find(s => s.id === 'interactable-target-a').code, targetCode)
})
test('G006-02: sin entrada no lanza rayos', () => { const h = setup(); h.frame(); assert.equal(h.raycasts.length, 0) })
test('G006-03: acción interact del Input Map ejecuta exactamente una invocación', () => {
  const h = setup(); h.frame('KeyE')
  assert.deepEqual(h.records, [['interact', 'a']])
  assert.equal(h.raycasts.length, 1)
  assert.deepEqual(h.raycasts[0], [[2, 1.65, 3], [0, 0, -1], 3, { ignore: h.body }])
  h.frame(); assert.equal(h.records.length, 1)
})
test('G006-04: pulsar sin soltar no repite la interacción', () => {
  const h = setup(); h.frame('KeyE'); h.frame('KeyE'); h.frame('KeyE')
  assert.equal(h.records.length, 1)
})
test('G006-05: nueva pulsación tras soltar vuelve a interactuar una sola vez', () => {
  const h = setup(); h.frame('KeyE'); h.state.set('KeyE', 0); h.frame(); h.frame('KeyE')
  assert.equal(h.records.length, 2)
})
test('G006-06: respeta reasignación de interact del Input Map', () => {
  const h = setup()
  const map = h.state.map
  setBindings(map, 'interact', ['KeyQ'])
  h.state.setMap(map)
  h.frame('KeyE'); assert.equal(h.records.length, 0)
  h.frame('KeyQ'); assert.equal(h.records.length, 1)
})
test('G006-07: no interactúa cuando Camera Orchestration entrega otra cámara', () => {
  for (const active of [{ kind: 'camera3d', id: 'other' }, { kind: 'film' }, { kind: 'timeline' }, { kind: 'pose' }, { kind: 'player' }]) {
    const h = setup(); h.game.camera.active = active; h.frame('KeyE')
    assert.equal(h.raycasts.length, 0, JSON.stringify(active))
  }
})
test('G006-08: la cámara propia recupera autoridad e interactúa tras la toma', () => {
  const h = setup(); h.game.camera.active = { kind: 'film' }; h.frame('KeyE')
  h.state.set('KeyE', 0); h.frame()
  h.game.camera.active = { kind: 'camera3d', id: 'native-camera' }; h.frame('KeyE')
  assert.equal(h.records.length, 1)
})
test('G006-09: sin colisión no se invoca nada', () => {
  const h = setup(); h.game.raycast = (...args) => { h.raycasts.push(args); return null }; h.frame('KeyE')
  assert.equal(h.records.length, 0)
})
test('G006-10: una pared no interactiva bloquea el rayo; no atraviesa obstáculos', () => {
  const h = setup(); h.target.is_in_group = () => false; h.frame('KeyE')
  assert.equal(h.records.length, 0)
  assert.equal(h.raycasts[0][3].tags, undefined)
})
test('G006-11: descarta hits sin nodo o hits de Trigger', () => {
  for (const hit of [{ kind: 'solid' }, { kind: 'trigger', node: { id: 'interact-target' } }]) {
    const h = setup(); h.game.raycast = () => hit; assert.doesNotThrow(() => h.frame('KeyE'))
    assert.equal(h.records.length, 0)
  }
})
test('G006-12: cámara inválida, pérdida de escena y referencia inválida no despachan', () => {
  const h = setup(); h.camera.is_valid = () => false; h.frame('KeyE'); assert.equal(h.raycasts.length, 0)
  const next = setup(); next.target.is_valid = () => false; next.frame('KeyE'); assert.equal(next.records.length, 0)
})
test('G006-13: dos personajes comparten recurso pero usan sus propios nodos y cámaras', () => {
  const a = setup(), b = setup(); b.body.id = 'b'; b.camera.worldPosition = [-2, 1.65, 3]
  a.frame('KeyE'); b.frame('KeyE')
  assert.deepEqual(a.records, [['interact', 'a']]); assert.deepEqual(b.records, [['interact', 'b']])
  assert.notDeepEqual(a.raycasts[0][0], b.raycasts[0][0])
})
test('G006-14: ausencia de Camera3D hija falla una sola vez al inicializar', () => {
  const h = setup(); h.body.get_node = () => null
  assert.throws(() => makeController(h.game, h.body).ready(), /falta Camera3D hija/)
})
test('G006-15: receptor usa señales y métodos publicados, sin administrador paralelo', () => {
  const groups = [], signals = [], publics = new Map(), emitted = []
  const node = { add_to_group(name) { groups.push(name) }, define_signal(name) { signals.push(name) }, expose(name, fn) { publics.set(name, fn) }, emit_signal(...args) { emitted.push(args) } }
  makeTarget({}, node).ready()
  assert.deepEqual(groups, ['interactable']); assert.deepEqual(signals, ['interacted'])
  publics.get('interact')('a')
  assert.deepEqual(emitted, [['interacted', 'a']])
})
test('G006-16: extensión común expone worldForward con una única declaración', () => {
  const engine = read('src/engine/runtime/events/play-nodes.js')
  assert.match(engine, /get worldForward\(\) \{ const n = active\(\); n\.updateWorldMatrix\(true, false\); return new THREE\.Vector3\(0, 0, -1\)\.transformDirection\(n\.matrixWorld\)\.toArray\(\) \}/)
  const main = read('src/core/events/game-api.d.ts'), ext = read('vscode-extension/media/game-api.d.ts')
  assert.equal(main, ext); assert.match(main, /readonly worldForward: Vec3/)
})
test('G006-17: no usa FpsPlayer, game.player.look ni movimiento físico alternativo', () => {
  assert.doesNotMatch(code, /FpsPlayer|game\.player|requestAnimationFrame|setInterval|phys\.step|move_and_slide/)
  assert.doesNotMatch(code, /game\.emit\(|onPress\(/)
})

test('G006-18: el receptor puede entregar una señal a páginas de evento existentes', async () => {
  const methods = new Map(), events = []
  const script = new Function('game','node',read('scripts/fixtures/fps/s16-g006-interactable-event-target-node.js') + '\nreturn _ready')
  const game = { emit: async (name,data) => { events.push([name,data]) } }
  const node = { id:'interact-target',add_to_group(name){ assert.equal(name,'interactable') },expose(name,fn){ methods.set(name,fn) } }
  script(game,node)()
  await methods.get('interact')('a')
  assert.deepEqual(events,[['fps_interaction',{ actorId:'a',targetId:'interact-target' }]])
})
test('G006-19: la promesa del receptor se propaga al ciclo de vida existente', async () => {
  const h=setup();h.target.call=()=>Promise.resolve('ok')
  h.state.set('KeyE',1);h.state.step()
  assert.equal(await h.script.frame(1/60),'ok')
})
