// S15-G004: contrato de cámara y metadatos que cruzan Editor → paquete de juego.
// La ejecución gráfica de un AppImage corresponde al QA local, no a estas pruebas Node.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSceneIds, validateBuildSources } from '../src/core/buildList.js'
import { sceneGameConfig } from '../src/engine/runtime/game-manager.js'
import { nodeEffectiveActive } from '../src/engine/runtime/nodes/hierarchy.js'
import { readPackage, writePackage } from '../src/engine/runtime/package/format.js'

const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
// Se ejecuta la función existente del Editor; solo se sustituyen sus dependencias del store Vue.
const preflightSource = source('src/core/state/game.js')
const start = preflightSource.indexOf('export function exportChecks() {')
const end = preflightSource.indexOf('\n/** Empaqueta el juego', start)
assert.ok(start > 0 && end > start)
const exportChecks = Function('store', 'buildScenes', 'sceneGameConfig', 'nodeEffectiveActive',
  preflightSource.slice(start, end).replace('export function exportChecks()', 'return function exportChecks()'))

const camera = (id, extra = {}) => ({
  id, type: 'camera', name: 'Cámara ' + id, parentId: null, active: true, visible: true,
  position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1], props: { main: false, fov: 66, ...extra.props }, ...extra,
})
const project = () => ({
  name: 'Paridad S15 G004', runtimeFormat: 2, activeSceneId: 'escena-a',
  scenes: [{ id: 'escena-a', name: 'Inicio', gameManagerId: 'gm-a' }, { id: 'escena-b', name: 'Destino' }],
  build: { target: 'linux-x64', scenes: ['escena-b', 'escena-a'] },
  game: { player: 'none', physicsRate: 60 },
  gameManagers: [{ id: 'gm-a', name: 'Config', player: 'none', camera: 'cam-a', profile: '' }],
  objects: [camera('cam-a', { visible: false })],
  database: { player: { walk: 3 } }, models: [], assets: [], scripts: [], prefabs: [], timelines: [],
})
const warnings = p => exportChecks({ project: p }, buildSceneIds, sceneGameConfig, nodeEffectiveActive)()

// El exportador solo puede prevalidar los objetos cargados de la escena inicial.
test('G004-01 · cámara activa invisible de GameManager sirve como fuente base al exportar', () => {
  const p = project(); p.build.scenes = ['escena-a', 'escena-b']
  assert.deepEqual(warnings(p), [])
})
test('G004-02 · cámara inactiva aunque visible no se cuenta como cámara base', () => {
  const p = project(); p.build.scenes = ['escena-a']; p.objects[0].active = false; p.objects[0].visible = true
  assert.match(warnings(p).join(' '), /no tiene una cámara base activa/)
})
test('G004-03 · padre inactivo también invalida la cámara seleccionada', () => {
  const p = project(); p.build.scenes = ['escena-a']
  p.objects.push({ id: 'padre', type: 'node3d', active: false, visible: true })
  p.objects[0].parentId = 'padre'
  assert.match(warnings(p).join(' '), /cámara base activa/)
})
test('G004-04 · sin cámara base, el aviso permite adquisición posterior por evento/script/Timeline', () => {
  const p = project(); p.build.scenes = ['escena-a']; p.objects = []
  const messages = warnings(p).join(' ')
  assert.match(messages, /evento, script o Timeline/)
  assert.doesNotMatch(messages, /se vería en negro/)
})
test('G004-05 · no se diagnostica la escena activa del Editor como si fuera la inicial exportada', () => {
  const p = project(); p.build.scenes = ['escena-b', 'escena-a']; p.objects = []
  assert.deepEqual(warnings(p), []) // Los datos de escena-b aún no están montados en el Editor.
})
test('G004-06 · el runtime exportado instancia PlayMode y no una segunda autoridad de cámaras', () => {
  const exported = source('src/engine/runtime/package/game.js')
  assert.match(exported, /graph\.player = new PlayMode\(graph\)/)
  assert.match(source('src/engine/runtime/events/play-host.js'), /get camera\(\) \{ return self\._cameraApi\(\) \}/)
  assert.match(source('src/engine/runtime/package/host.js'), /activeSceneId = id/)
})

test('G004-07 · el paquete real conserva los ID Camera3D, nodos inactivos, recursos y pistas', async () => {
  const p = project()
  const a = {
    objects: [
      camera('cam-a', { visible: false }),
      { id: 'evento-a', type: 'event', active: true, visible: true,
        props: { pages: [{ id: 'pagina-a', trigger: 'input',
          list: [{ id: 'comando-a', code: 'cameraControl', p: { action: 'activate', node: 'cam-a' } }],
        }] },
      },
    ],
    environment: {}, terrain: { size: 32, heights: [] },
  }
  const b = { objects: [camera('cam-b', { active: false, visible: true, props: { main: true, fov: 80 } })], environment: {}, terrain: { size: 32, heights: [] } }
  p.timelines = [{ id: 'tl-a', name: 'Toma', tracks: [{ id: 'track-a', kind: 'camera', keys: [{ id: 'key-a', mode: 'camera3d', sceneId: 'escena-a', node: 'cam-a', time: 0 }] }] }]
  const scenes = [{ id: 'escena-b', name: 'Destino', data: b }, { id: 'escena-a', name: 'Inicio', data: a }]
  validateBuildSources(p, scenes, new Map())
  const bytes = await writePackage({ data: p, scenes, files: new Map() })
  const pkg = await readPackage(bytes)
  assert.deepEqual(pkg.sceneIds, ['escena-b', 'escena-a'])
  assert.equal(pkg.game.game.startScene, 'escena-b')
  assert.equal(pkg.game.scenes[1].gameManagerId, 'gm-a')
  assert.equal(pkg.game.gameManagers[0].camera, 'cam-a')
  assert.equal(pkg.game.timelines[0].tracks[0].keys[0].node, 'cam-a')
  assert.equal(pkg.game.timelines[0].tracks[0].keys[0].sceneId, 'escena-a')
  const first = await pkg.scene('escena-b'), second = await pkg.scene('escena-a')
  assert.equal(first.objects[0].active, false)
  assert.equal(first.objects[0].props.fov, 80)
  assert.equal(second.objects[0].visible, false)
  assert.equal(second.objects[1].props.pages[0].list[0].p.node, 'cam-a')
})

test('G004-08 · cambio de orden de Build mantiene identidad de la escena con GameManager', async () => {
  const p = project(); const scenes = [
    { id: 'escena-a', name: 'Inicio', data: { objects: p.objects, environment: {}, terrain: { size: 32 } } },
    { id: 'escena-b', name: 'Destino', data: { objects: [camera('cam-b')], environment: {}, terrain: { size: 32 } } },
  ]
  const pkg = await readPackage(await writePackage({ data: p, scenes, files: new Map() }))
  assert.equal(pkg.game.game.startScene, 'escena-a')
  assert.equal(sceneGameConfig({ ...pkg.game, activeSceneId: 'escena-a' }).manager?.camera, 'cam-a')
  assert.equal(sceneGameConfig({ ...pkg.game, activeSceneId: 'escena-b' }).manager, null)
})

test('G004-09 · el host real hidrata la escena inicial y cambia sin perder referencias de cámara', async () => {
  const { createPackageHost } = await import('../src/engine/runtime/package/host.js')
  const p = project()
  const scenes = [
    { id: 'escena-a', name: 'Inicio', data: { objects: [camera('cam-a', { visible: false })], environment: {}, terrain: { size: 32 } } },
    { id: 'escena-b', name: 'Destino', data: { objects: [camera('cam-b', { active: false })], environment: {}, terrain: { size: 32 } } },
  ]
  const pkg = await readPackage(await writePackage({ data: p, scenes, files: new Map() }))
  const host = createPackageHost({ pkg, storage: { get: () => null, set() {}, remove() {}, keys: () => [] } })
  let loads = 0, syncs = 0
  const fakeGraph = { host, models: new Map(), setCaptureClips: () => ({}),
    async loadProject() { loads++ }, async loadScene() { loads++ }, syncAll() { syncs++ }, syncEnvironment() {},
  }
  try {
    await host.attach(fakeGraph)
    assert.equal(host.project.activeSceneId, 'escena-a')
    assert.equal(host.project.objects[0].id, 'cam-a')
    assert.equal(host.project.objects[0].visible, false)
    assert.equal(sceneGameConfig(host.project).manager?.camera, 'cam-a')
    assert.equal(await host.switchScene('escena-b'), true)
    assert.equal(host.project.activeSceneId, 'escena-b')
    assert.equal(host.project.objects[0].id, 'cam-b')
    assert.equal(host.project.objects[0].active, false)
    assert.equal(sceneGameConfig(host.project).manager, null)
    assert.equal(await host.switchScene('escena-a'), true)
    assert.equal(sceneGameConfig(host.project).manager?.camera, 'cam-a')
    assert.equal(loads, 3)
    assert.equal(syncs, 3)
  } finally { host.dispose() }
})
