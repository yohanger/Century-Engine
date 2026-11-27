// G003 · El intérprete ejecuta comandos declarativos usando la autoridad real de PlayMode.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Game } from '../src/engine/runtime/events/interpreter.js'
import { COMMANDS, newCommand, visibleParams } from '../src/engine/runtime/events/commandDefs.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const code = read('src/engine/runtime/events/play-camera.js').replace(/^import .*$/gm, '').replace(/^export /gm, '')
const cameraMethods = Function('THREE', 'setCameraFov', 'resolveCamera3D', code + '\nreturn cameraMethods')(
  { Matrix4: class { extractRotation(m) { return m } } },
  (cam, fov) => { cam.fov = fov },
  (ref, scene, objects, nodes) => {
    const obj = objects.find(o => o.id === ref.node && o.type === 'camera' && o.visible !== false)
    const node = nodes.get(ref.node)
    return ref.sceneId === scene && obj && node ? { pos: node.pos, quat: node.quat, fov: obj.props.fov, profile: obj.props.profile } : null
  },
)
const action = (op, node = '', to = 'keep') => newCommand('cameraControl', { action: op, node, to })
const context = (eventId = 'event-1', name = 'Escena', cameraOwner = null) => ({ cancelled: false, eventId, name, cameraOwner })

function fixture({ player = true, database = {} } = {}) {
  const warnings = []
  const objects = [
    { id: 'cam-a', name: 'A', type: 'camera', visible: true, props: { fov: 55, profile: 'night' } },
    { id: 'cam-b', name: 'B', type: 'camera', visible: true, props: { fov: 85, profile: 'day' } },
  ]
  const nodes = new Map([
    ['cam-a', { pos: [1, 2, 3], quat: { value: 'A' } }],
    ['cam-b', { pos: [4, 5, 6], quat: { value: 'B' } }],
  ])
  const cam = { position: { x: 0, set(x, y, z) { Object.assign(this, { x, y, z }) } }, quaternion: { copy(q) { this.value = q.value } }, fov: 0 }
  const pm = {
    _nodeEnabled(obj) {return obj?.active !== false && !this.project.objects.some(parent => parent.id === obj?.parentId && parent.active === false)},
    ...cameraMethods, on: true, hasPlayer: player, film: null, tls: [],
    ed: { nodes, vp: {} }, project: { activeSceneId: 'scene-a', objects },
    _gm: {}, g: { fov: 90 }, state: { noCamera: false }, dom: { style: {} },
    rt: { log: (msg) => warnings.push(msg) },
    _profCamera() {}, _waterFx() {}, _dofFocus() {},
    player: { viewPose(c) { c.position.set(0, 1.6, 0); c.fov = 90 } },
  }
  pm._viewCamera = c => { c.position.set(0, 1.6, 0); c.fov = 90 }
  pm._tlCamera = c => { const tl = pm.tls.at(-1); pm._cameraApply(c, tl.cam) }
  pm._cameraReset()
  const game = new Game({ database, host: { cameraEvent: (args) => pm._cameraEventControl(args) } })
  return { pm, game, cam, objects, nodes, warnings }
}

test('G003-01 · comando registrado en Mundo y selecciona solo Camera3D usando ParamForm existente', () => {
  assert.equal(COMMANDS.cameraControl.group, COMMANDS.timeline.group)
  const p = newCommand('cameraControl')
  assert.equal(p.p.action, 'activate')
  assert.equal(visibleParams('cameraControl', p.p).find(x => x.key === 'node').only[0], 'camera')
  assert.equal(visibleParams('cameraControl', { action: 'release', to: 'keep' }).some(x => x.key === 'node'), false)
  assert.match(read('src/components/ParamForm.vue'), /p\.type === 'node'/)
  assert.match(read('src/engine/runtime/events/play-host.js'), /cameraEvent: \(request\) => self\._cameraEventControl\(request\)/)
})

test('G003-02 · activate: el comando real adquiere y aplica Camera3D al render', async () => {
  const { pm, game, cam } = fixture()
  await game.exec(action('activate', 'cam-a'), context())
  pm._cameraFrame(cam)
  assert.equal(pm._cameraActive.id, 'cam-a')
  assert.equal(cam.fov, 55)
  assert.equal(cam.position.x, 1)
  assert.equal(pm._cameraSource.owner, 'event:event-1')
})

test('G003-03 · change usa el lease del mismo evento sin crear segunda autoridad', async () => {
  const { pm, game, cam } = fixture()
  await game.exec(action('activate', 'cam-a'), context())
  const token = pm._cameraSource.token
  await game.exec(action('change', 'cam-b'), context())
  assert.equal(pm._cameraSource.token, token)
  pm._cameraFrame(cam)
  assert.equal(cam.position.x, 4)
  assert.equal(cam.fov, 85)
})

test('G003-04 · release keep conserva Camera3D viva incluso tras terminar el runner', async () => {
  const { pm, game, cam, nodes } = fixture()
  const runner = game.run([action('activate', 'cam-a'), action('release', '', 'keep')], { eventId: 'event-1', name: 'Escena' })
  await runner.done
  assert.equal(pm._cameraSource.kind, 'held')
  nodes.get('cam-a').pos[0] = 9
  pm._cameraFrame(cam)
  assert.equal(cam.position.x, 9)
  assert.equal(pm._cameraActive.held, true)
})

test('G003-05 · release base devuelve la fuente base explícitamente', async () => {
  const { pm, game, cam } = fixture()
  await game.exec(action('activate', 'cam-a'), context())
  await game.exec(action('release', '', 'base'), context())
  pm._cameraFrame(cam)
  assert.equal(pm._cameraSource, null)
  assert.equal(cam.position.x, 0)
  assert.equal(cam.fov, 90)
})

test('G003-06 · evento ajeno no puede cambiar ni liberar la solicitud vigente', async () => {
  const { pm, game, cam } = fixture()
  await game.exec(action('activate', 'cam-a'), context())
  for (const command of [action('change', 'cam-b'), action('release', '', 'base'), action('activate', 'cam-b')]) {
    await assert.rejects(game.exec(command, context('event-2')), /No se pudo controlar la cámara/)
  }
  pm._cameraFrame(cam)
  assert.equal(cam.position.x, 1)
  assert.equal(pm._cameraSource.owner, 'event:event-1')
})

test('G003-07 · un script con lease activo no puede ser desplazado por evento', async () => {
  const { pm, game } = fixture()
  const lease = pm._cameraApi().acquire('cam-a')
  assert.ok(lease)
  await assert.rejects(game.exec(action('activate', 'cam-b'), context()), /No se pudo controlar/)
  assert.equal(pm._cameraSource.owner, undefined)
  assert.equal(lease.release(), true)
})

test('G003-08 · Timeline ya activo impide adquisición desde evento', async () => {
  const { pm, game } = fixture()
  pm.tls = [{ finished: false, cam: { pos: [88, 0, 0], quat: {}, fov: 33 }, tl: { id: 't' } }]
  await assert.rejects(game.exec(action('activate', 'cam-a'), context()), /No se pudo controlar/)
  assert.equal(pm._cameraSource, null)
})

test('G003-09 · FilmMaker activo conserva autoridad frente al evento', async () => {
  const { pm, game } = fixture()
  pm.film = { camera() {} }
  await assert.rejects(game.exec(action('activate', 'cam-a'), context()), /No se pudo controlar/)
  assert.equal(pm._cameraSource, null)
})

test('G003-10 · cambio de escena invalida el lease anterior y protege ID de otra escena', async () => {
  const { pm, game, cam } = fixture()
  await game.exec(action('activate', 'cam-a'), context())
  pm.project.activeSceneId = 'scene-b'
  pm._cameraFrame(cam)
  assert.equal(pm._cameraSource, null)
  await assert.rejects(game.exec(action('release'), context()), /No se pudo controlar/)
  assert.equal(pm._cameraActive.kind, 'player')
})

test('G003-11 · al desaparecer Camera3D libera autoridad, sin referencia obsoleta', async () => {
  const { pm, game, cam, objects } = fixture()
  await game.exec(action('activate', 'cam-a'), context())
  objects.shift()
  pm._cameraFrame(cam)
  assert.equal(pm._cameraSource, null)
  assert.equal(pm._cameraActive.kind, 'player')
})

test('G003-12 · plantilla Sin jugador: Camera3D del evento mantiene vista visible', async () => {
  const { pm, game, cam } = fixture({ player: false })
  await game.exec(action('activate', 'cam-a'), context())
  pm._cameraFrame(cam)
  assert.equal(pm.state.noCamera, false)
  assert.equal(pm._cameraActive.id, 'cam-a')
})

test('G003-13 · referencia ausente y acción inválida producen error sin modificar autoridad', async () => {
  const { pm, game } = fixture()
  await assert.rejects(game.exec(action('activate', 'missing'), context()), /No se pudo controlar/)
  await assert.rejects(game.exec(action('activate', ''), context()), /Selecciona una Camera3D/)
  await assert.rejects(game.exec(action('invalid', 'cam-a'), context()), /Acción de cámara desconocida/)
  assert.equal(pm._cameraSource, null)
})

test('G003-14 · common event con nombre puede controlar y liberar su propia solicitud', async () => {
  const { pm, game, cam } = fixture()
  await game.exec(action('activate', 'cam-a'), context(null, 'ComúnA', 'common:12'))
  await game.exec(action('release', '', 'keep'), context(null, 'ComúnA', 'common:12'))
  pm._cameraFrame(cam)
  assert.equal(pm._cameraActive.held, true)
})

test('G003-14B · dos eventos comunes con el mismo nombre no comparten autoridad', async () => {
  const { pm, game } = fixture()
  await game.exec(action('activate', 'cam-a'), context(null, 'Duplicado', 'common:12'))
  await assert.rejects(game.exec(action('change', 'cam-b'), context(null, 'Duplicado', 'common:13')), /No se pudo controlar/)
  assert.equal(pm._cameraSource.owner, 'common:12')
  await game.exec(action('release', '', 'keep'), context(null, 'Duplicado', 'common:12'))
})

test('G003-14C · callCommon utiliza el ID de Database y permite finalizar la toma', async () => {
  const database = { commonEvents: [{ id: 1, name: 'Secuencia común', list: [action('activate', 'cam-a'), action('release', '', 'keep')] }] }
  const { pm, game, cam } = fixture({ database })
  await game.callCommon(1)
  pm._cameraFrame(cam)
  assert.equal(pm._cameraSource.kind, 'held')
  assert.equal(pm._cameraActive.id, 'cam-a')
})

test('G003-15 · liberar sin lease propio produce error, no cambia cámara de otro', async () => {
  const { pm, game } = fixture()
  await game.exec(action('activate', 'cam-a'), context())
  await assert.rejects(game.exec(action('release', '', 'keep'), context('event-2')), /No se pudo controlar/)
  assert.equal(pm._cameraSource.kind, 'request')
})

test('G003-16 · los comandos se serializan en el modelo existente sin nuevos campos de proyecto', () => {
  const cmd = action('activate', 'cam-a')
  assert.equal(cmd.code, 'cameraControl')
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(cmd))).sort(), ['b', 'code', 'id', 'p'])
  assert.equal(JSON.parse(JSON.stringify(cmd)).p.node, 'cam-a')
  assert.match(read('src/engine/runtime/events/play.js'), /this\._cameraReset\(\)/)
})
