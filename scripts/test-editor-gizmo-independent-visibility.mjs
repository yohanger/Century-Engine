import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GIZMO_CATEGORIES, gizmoCategory, gizmosEnabled } from '../src/core/editor/gizmo-visibility.js'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const selectionSource = read('src/core/editor/selection.js')
const colliderSource = read('src/core/editor/collider.js')
const physicsSource = read('src/engine/runtime/nodes/physics.js')
const gameViewSource = read('src/core/editor/camera-tools.js')

function selectionOwner(store, objects) {
  const block = selectionSource.match(/export const selectionMethods = \{([\s\S]*?)\n  setSelection\(/)?.[1]
  assert.ok(block)
  const owner = new Function('store', 'getObject', 'gizmoCategory', 'gizmosEnabled', `return {${block}}`)(
    store, id => objects[id], gizmoCategory, gizmosEnabled,
  )
  return owner
}

function makeNode(id, extra = {}) {
  return { userData: { id, editorGizmos: [{ userData: {}, visible: false }], ...extra } }
}

test('los seis tipos de gizmos siguen visibles al deseleccionar el nodo', () => {
  const store = { play: { on: false }, prefs: { showGizmos: true, gizmoCategories: {} }, selectedIds: [] }
  const types = ['camera', 'light', 'audio', 'collisionshape3d', 'trigger', 'spawn']
  const objects = Object.fromEntries(types.map(type => [type, { type }]))
  const nodes = new Map(types.map(type => [type, makeNode(type)]))
  const colliderCalls = []
  const owner = selectionOwner(store, objects)
  const ctx = { ...owner, nodes, edit: null, _colliderSync: (...args) => colliderCalls.push(args) }
  ctx._refreshNodeGizmos()
  for (const type of types) {
    assert.equal(nodes.get(type).userData.editorGizmos[0].visible, true, type)
    assert.equal(nodes.get(type).userData.editorGizmos[0].userData.editorGizmoAllowed, true, type)
  }
  store.selectedIds = ['camera', 'collisionshape3d']
  ctx._refreshNodeGizmos()
  for (const type of types) assert.equal(nodes.get(type).userData.editorGizmos[0].visible, true, type)
  assert.equal(colliderCalls.at(-1)[2], true)
})

test('los filtros por categoría son independientes y Mostrar gizmos prevalece', () => {
  const store = { play: { on: false }, prefs: { showGizmos: true, gizmoCategories: {} }, selectedIds: [] }
  const types = { cameras: 'camera', lights: 'light', audio: 'audio', colliders: 'collisionshape3d', volumes: 'trigger', other: 'spawn' }
  const objects = Object.fromEntries(Object.entries(types).map(([category, type]) => [category, { type }]))
  const nodes = new Map(GIZMO_CATEGORIES.map(({ id }) => [id, makeNode(id)]))
  const ctx = { ...selectionOwner(store, objects), nodes, edit: null, _colliderSync() {} }
  for (const { id } of GIZMO_CATEGORIES) {
    store.prefs.gizmoCategories[id] = false
    ctx._refreshNodeGizmos()
    for (const { id: other } of GIZMO_CATEGORIES) {
      assert.equal(nodes.get(other).userData.editorGizmos[0].visible, other !== id, `${id} / ${other}`)
    }
    store.prefs.gizmoCategories[id] = true
  }
  store.prefs.showGizmos = false
  ctx._refreshNodeGizmos()
  for (const node of nodes.values()) assert.equal(node.userData.editorGizmos[0].visible, false)
  store.prefs.showGizmos = true
  ctx._refreshNodeGizmos()
  for (const node of nodes.values()) assert.equal(node.userData.editorGizmos[0].visible, true)
})

test('ayudas editoriales, zonas y mallas físicas no dependen de selección', () => {
  const store = { play: { on: false }, prefs: { showGizmos: true, gizmoCategories: {} }, selectedIds: [] }
  const objects = { a: { type: 'camera' }, b: { type: 'light' }, c: { type: 'audio' }, d: { type: 'primitive' }, e: { type: 'event' } }
  const nodes = new Map([
    ['a', makeNode('a', { visual: { visible: false } })],
    ['b', makeNode('b', { editorOnlyVisual: { visible: false } })],
    ['c', makeNode('c', { editorOnlyVisual: { visible: false } })],
    ['d', makeNode('d', { indicatorZonesGizmo: { visible: false }, cells: { visible: false } })],
    ['e', makeNode('e', { gem: { visible: false } })],
  ])
  const colliderCalls = []
  const ctx = { ...selectionOwner(store, objects), nodes, edit: null, _colliderSync: (node, selected, enabled) => colliderCalls.push([node.userData.id, selected, enabled]) }
  ctx._refreshNodeGizmos()
  assert.equal(nodes.get('a').userData.visual.visible, true)
  assert.equal(nodes.get('b').userData.editorOnlyVisual.visible, true)
  assert.equal(nodes.get('c').userData.editorOnlyVisual.visible, true)
  assert.equal(nodes.get('d').userData.indicatorZonesGizmo.visible, true)
  assert.equal(nodes.get('e').userData.gem.visible, true)
  assert.deepEqual(colliderCalls.at(-2), ['d', false, true])
  store.prefs.gizmoCategories.volumes = false
  store.prefs.gizmoCategories.colliders = false
  ctx._refreshNodeGizmos()
  assert.equal(nodes.get('d').userData.indicatorZonesGizmo.visible, false)
  assert.equal(colliderCalls.at(-2)[2], false)
  store.play.on = true
  ctx._refreshNodeGizmos()
  for (const node of nodes.values()) assert.equal(node.userData.editorGizmos[0].visible, false)
  assert.equal(nodes.get('b').userData.editorOnlyVisual.visible, false)
  store.play.on = false
  ctx.edit = {}
  ctx._refreshNodeGizmos()
  for (const node of nodes.values()) assert.equal(node.userData.editorGizmos[0].visible, false)
})

function colliderOwner(store, objects) {
  const body = colliderSource.match(/  _colliderSync\(node, selected, enabled\) \{([\s\S]*?)\n  \},\n\n  _colliderDown/)?.[1]
  assert.ok(body)
  class Part {
    constructor(geometry, material) {
      this.geometry = geometry
      this.material = material
      this.userData = {}
      this.position = { set() {}, setComponent() {} }
      this.scale = { setScalar() {} }
    }
  }
  const built = { edges: 0 }
  const THREE = {
    Group: class { constructor() { this.userData = {}; this.children = []; this.position = { copy() {} } } add(part) { this.children.push(part) } },
    LineSegments: Part,
    Mesh: Part,
    BufferGeometry: class { dispose() {} },
    LineBasicMaterial: class {},
    MeshBasicMaterial: class {},
    SphereGeometry: class { dispose() {} },
    EdgesGeometry: class { constructor() { built.edges++ } dispose() {} },
  }
  const bounds = { kind: 'box', center: {}, size: { x: 1, y: 2, z: 3, getComponent(i) { return [this.x, this.y, this.z][i] } } }
  const owner = new Function('store', 'getObject', 'localBox', 'colliderBounds', 'gizmoScale', 'pickable', 'geometryOf', 'reach', 'THREE', `return { _colliderSync(node, selected, enabled) {${body}\n} }`)(
    store, id => objects[id], () => ({}), () => bounds, () => 1,
    obj => ['primitive', 'mesh', 'model'].includes(obj?.type) && (obj.props?.dynamic || obj.props?.floats),
    () => ({ dispose() {} }), (b, i) => b.size.getComponent(i) / 2, THREE,
  )
  return { ...owner, built, bounds }
}

test('contorno de collider visible sin selección; asas solo al seleccionar', () => {
  const store = { play: { on: false }, colliderPreview: true, prefs: { gizmoSize: 1 } }
  const objects = { body: { type: 'primitive', props: { dynamic: true } } }
  const node = { userData: { id: 'body' }, add(group) { this.userData.colliderGizmo = group } }
  const ctx = { ...colliderOwner(store, objects), edit: null, vp: { requestRender() {} } }
  ctx._colliderSync(node, false, true)
  const group = node.userData.colliderGizmo
  assert.equal(group.visible, true)
  assert.equal(group.userData.handles.length, 7)
  assert.ok(group.userData.handles.every(h => h.visible === false))
  assert.equal(ctx.built.edges, 1)
  ctx._colliderSync(node, true, true)
  assert.ok(group.userData.handles.every(h => h.visible === true))
  ctx._colliderSync(node, false, true)
  assert.ok(group.userData.handles.every(h => h.visible === false))
  assert.equal(ctx.built.edges, 1)
  ctx.bounds.size.x = 2
  ctx._colliderSync(node, false, true)
  assert.equal(ctx.built.edges, 2)
  ctx._colliderSync(node, true, false)
  assert.equal(group.visible, false)
  store.colliderPreview = false
  ctx._colliderSync(node, true, true)
  assert.equal(group.visible, false)
  store.colliderPreview = true
  store.play.on = true
  ctx._colliderSync(node, true, true)
  assert.equal(group.visible, false)
})

test('CollisionShape3D conserva la visibilidad dictada por el editor', () => {
  assert.equal((physicsSource.match(/editorGizmoAllowed/g) || []).length, 2)
  assert.doesNotMatch(physicsSource, /editorSelected/)
  assert.match(physicsSource, /editorGizmoEnabled = effective\.props\.disabled !== true/)
  assert.match(physicsSource, /editorGizmoEnabled = current\.props\.disabled !== true/)
})

test('Game View excluye todas las ayudas del editor, incluso contornos y asas', () => {
  assert.match(gameViewSource, /u\.indicatorZonesGizmo, u\.cells, u\.colliderGizmo, u\.areaFrame/)
  assert.match(gameViewSource, /\.\.\.\(u\.editorGizmos \|\| \[\]\)/)
})
