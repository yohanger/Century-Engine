import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createFirstPersonResources } from '../src/core/templates/fps-player.js'
import { getTemplate, DEFAULT_TEMPLATE } from '../src/core/templates/index.js'
import { validatePhysicsTree } from '../src/engine/runtime/physics/shapes.js'
import { validateNodeTree } from '../src/engine/runtime/nodes/hierarchy.js'
import { defaultDatabase, emptyDatabase } from '../src/engine/runtime/database/schema.js'
import { defaultInputMap } from '../src/engine/runtime/input/inputmap.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
let serial = 0
const uid = (prefix = '') => `${prefix}${++serial}`
// El constructor real añade las mismas propiedades físicas; el harness no reemplaza el motor.
const makeObject = (type, kind, extra = {}) => {
  const props = type === 'characterbody3d'
    ? { velocity: [0, 0, 0], maxSlopeAngle: 50, stepHeight: .35, floorSnap: .5, gravity: 9.81, mass: 80 }
    : type === 'camera' ? { fov: 70, main: false } : {}
  return { type, kind, name: type, parentId: null, position: [0, 0, 0],
    rotation: [0, 0, 0], scale: [1, 1, 1], scriptIds: [], props, ...extra }
}
const source = read('src/core/project.js')
const sceneFn = source.slice(source.indexOf('export function createSceneContent('), source.indexOf('export function createProjectData(')).replace('export function ', 'function ')
const projectFn = source.slice(source.indexOf('export function createProjectData('), source.indexOf('/** Campos que pertenecen a la escena')).replace('export function ', 'function ')
const createProject = new Function('getTemplate','DEFAULT_TEMPLATE','defaultEnvironment','DEFAULT_LAYERS','makeObject','uid', 'PROJECT_VERSION','FORMAT_VERSION','defaultSettings','DEFAULT_FOLDERS','rendererPreset','presetOf','defaultAudio','normalizeLoc','BAKE_DEFAULTS','emptyDatabase','defaultDatabase','defaultInputMap','defaultTagLayers','defaultTheme','emptySlots','SCENE_FADE_DEFAULTS', `${sceneFn}\n${projectFn}\nreturn createProjectData`)(
  getTemplate, DEFAULT_TEMPLATE, () => ({}), [], makeObject, uid, 3, 2, () => ({}),
  ['Assets','Assets/Scenes'], x => ({ renderer: x }), () => ({}), () => ({}), () => ({}), {},
  emptyDatabase, defaultDatabase, defaultInputMap, () => ({}), () => ({}), () => ({}), {},
)
const fps = () => createProject('Proyecto FPS', 'empty')
const parts = p => {
  const prefab = p.prefabs[0]
  const body = prefab.objects.find(o => o.type === 'characterbody3d')
  const capsule = prefab.objects.find(o => o.type === 'collisionshape3d')
  const camera = prefab.objects.find(o => o.type === 'camera')
  return { prefab, body, capsule, camera }
}

test('G007-01 · First Person genera un solo Prefab visible en Assets/Prefabs', () => {
  const p = fps()
  assert.equal(p.prefabs.length, 1)
  assert.equal(p.prefabs[0].folder, 'Assets/Prefabs')
  assert.equal(p.prefabs[0].name, 'Personaje FPS')
  assert.deepEqual(p.prefabs[0].signalConnections, [])
  assert.ok(p.folders.includes('Assets/Prefabs'))
  assert.equal(p.prefabs[0].rev, 1)
})
test('G007-02 · scripts nativos de G004–G006 son recursos editables y no globales', () => {
  const p = fps(), { body } = parts(p)
  assert.equal(p.scripts.length, 3)
  assert.deepEqual(body.scriptIds, p.scripts.map(s => s.id))
  for (const script of p.scripts) {
    assert.equal(script.execution, 'node')
    assert.equal(script.folder, 'Assets/Scripts')
    assert.match(script.name, /\.js$/)
    assert.ok(script.code.length > 100)
  }
  const fixtures = [
    's16-g004-locomotion-node.js', 's16-g005-native-camera-node.js', 's16-g006-native-interaction-node.js',
  ]
  for (let i = 0; i < fixtures.length; i++) assert.equal(p.scripts[i].code, read(`scripts/fixtures/fps/${fixtures[i]}`))
})
test('G007-03 · el árbol físico es válido y la cápsula queda centrada', () => {
  const p = fps(), { prefab, body, capsule, camera } = parts(p)
  assert.equal(prefab.objects[0].type, 'node3d')
  assert.equal(body.parentId, prefab.objects[0].id)
  assert.deepEqual(body.position, [0, 0, 0])
  assert.equal(capsule.parentId, body.id)
  assert.deepEqual(capsule.position, [0, 0, 0])
  assert.equal(capsule.props.shape.type, 'CapsuleShape3D')
  assert.equal(camera.parentId, body.id)
  assert.equal(camera.name, 'VistaFPS')
  assert.deepEqual(camera.position, [0, 1.65, 0])
  assert.equal(camera.props.main, true)
  assert.doesNotThrow(() => validateNodeTree(prefab.objects))
  assert.doesNotThrow(() => validatePhysicsTree(new Map(prefab.objects.map(o => [o.id, o]))))
})
test('G007-04 · el Prefab no se instancia automáticamente en la escena', () => {
  const p = fps()
  assert.equal(p.objects.length, 1)
  assert.ok(!p.objects.some(o => o.type === 'spawn')) // G008: sin marcador temporal
  assert.ok(!p.objects.some(o => o.type === 'characterbody3d'))
  assert.ok(!p.objects.some(o => o.prefabId))
})
test('G007-05 · Empty y Vacío clásico no reciben el prefab ni scripts FPS', () => {
  for (const type of ['empty-project', 'blank']) {
    const p = createProject('QA', type)
    assert.deepEqual(p.prefabs, [])
    assert.deepEqual(p.scripts, [])
    assert.equal(p.folders.includes('Assets/Prefabs'), false)
  }
})
test('G007-06 · dos proyectos no comparten IDs ni instancias mutables', () => {
  const a = fps(), b = fps()
  const ids = p => [...p.prefabs.map(f => f.id), ...p.scripts.map(s => s.id), ...p.prefabs[0].objects.map(o => o.id)]
  const first = new Set(ids(a))
  assert.equal(first.size, ids(a).length)
  assert.ok(ids(b).every(id => !first.has(id)))
  a.scripts[0].code = 'cambio local'
  assert.notEqual(b.scripts[0].code, 'cambio local')
})
test('G007-07 · serialización del proyecto conserva IDs, padres y scripts del prefab', () => {
  const original = fps(), loaded = JSON.parse(JSON.stringify(original))
  assert.deepEqual(loaded.prefabs, original.prefabs)
  assert.deepEqual(loaded.scripts, original.scripts)
  const { prefab, body, camera } = parts(loaded)
  assert.ok(prefab.objects.every((o, i) => i === 0 ? o.parentId == null : !!o.parentId))
  assert.equal(camera.parentId, body.id)
})
test('G007-08 · IDs de instancia se pueden remapear sin modificar el recurso maestro', () => {
  const { prefab } = parts(fps())
  const original = JSON.stringify(prefab)
  const remap = () => {
    const ids = new Map(prefab.objects.map(o => [o.id, uid()]))
    return prefab.objects.map((o, i) => ({ ...structuredClone(o), id: ids.get(o.id), parentId: i === 0 ? null : ids.get(o.parentId) }))
  }
  const a = remap(), b = remap()
  assert.ok(a.every((o, i) => a[i].id !== b[i].id))
  assert.equal(a[2].parentId, a[1].id)
  assert.equal(b[3].parentId, b[1].id)
  assert.equal(JSON.stringify(prefab), original)
})
test('G007-09 · se reutiliza instanciación desde Assets y no hay runtime FPS nuevo', () => {
  const panel = read('src/components/ProjectPanel.vue')
  const placement = read('src/core/editor/placement.js')
  assert.match(panel, /store\.editor\.dropPrefab\(it\.id\)/)
  assert.match(placement, /instantiatePrefab\(prefabId/)
  const data = read('src/core/templates/fps-player.js')
  assert.doesNotMatch(data, /new FpsPlayer|new PlayerController|requestAnimationFrame|setInterval/)
})
test('G007-10 · el template conserva Database e Input Map, sin Spawn temporal', () => {
  const p = fps()
  assert.equal(p.template, 'empty')
  assert.equal(p.game.player, 'native')
  assert.ok(p.database.player)
  assert.ok(p.inputMap.actions.some(a => a.bindings?.length))
  assert.equal(p.objects.filter(o => o.type === 'spawn').length, 0)
})
