import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { validateNodeTree, validateNodeParent } from '../src/engine/runtime/nodes/hierarchy.js'
import { remapMeshSubtractSourceIds } from '../src/engine/runtime/mesh/mesh-subtract-source.js'
import { isTriMeshSource, remapTriMeshSourceIds } from '../src/engine/runtime/physics/trimesh-source.js'

const source = readFileSync(new URL('../src/core/state/objects.js', import.meta.url), 'utf8')
const historySource = readFileSync(new URL('../src/core/state/history.js', import.meta.url), 'utf8')
const body = (id = 'body') => ({ id, type: 'staticbody3d', parentId: null, name: id, scale: [1, 1, 1], props: { friction: 0.5, restitution: 0 } })
const mesh = (id = 'mesh', parentId = 'body') => ({ id, type: 'mesh', parentId, name: id, scale: [1, 1, 1], position: [0, 0, 0], rotation: [0, 0, 0], props: { mesh: { v: [[0, 0, 0]], f: [] } } })
const shape = (id = 'shape', sourceId = 'mesh', parentId = 'body') => ({ id, type: 'collisionshape3d', parentId, name: id, scale: [1, 1, 1], props: { disabled: false, shape: { type: 'TriMeshShape3D', sourceId } } })
const clone = (value) => JSON.parse(JSON.stringify(value))
let counter = 0

function fixture(objects = [body(), mesh(), shape()], selectedIds = ['mesh']) {
  const log = []
  const editor = {
    duplicateWorldOffset: () => [0, 0, -2],
    removeObject(id) { log.push(['remove', id]) },
    setSelection(id, ids) { log.push(['selection', id, [...ids]]) },
    syncAll() { log.push(['syncAll']) },
    snapshotTerrain: () => ({ layers: [], foliage: [] }),
    restoreTerrain() {}, restoreEdit() {}, syncEnvironment() {}, afterUndo() {}, applyView() {},
    syncObject() {},
  }
  const store = {
    project: { id: 'project', objects: clone(objects), signalConnections: [], environment: {}, terrain: { enabled: false, layers: [], foliage: [] } },
    selectedIds: [...selectedIds], selectedId: selectedIds.at(-1) || null, filmMode: false,
    terrainSel: false, roadPoint: null, editor,
    locked: false, disk: { state: 'saved' }, saveState: 'saved', pendingRevision: 0,
  }
  const getObject = (id) => store.project.objects.find((o) => o.id === id) || null
  const childrenOf = (id) => store.project.objects.filter((o) => o.parentId === id)
  const descendantsOf = (id) => {
    const out = []
    const visit = (key) => { for (const child of childrenOf(key)) { out.push(child); visit(child.id) } }
    visit(id)
    return out
  }
  const selectionRoots = () => store.selectedIds.filter((id) => {
    for (let obj = getObject(id); obj?.parentId; obj = getObject(obj.parentId)) if (store.selectedIds.includes(obj.parentId)) return false
    return true
  })
  const uniqueName = (name) => name
  const commit = (name) => log.push(['commit', name])
  const env = { store, getObject, childrenOf, descendantsOf, selectionRoots, validateNodeTree,
    isTriMeshSource, remapTriMeshSourceIds, remapMeshSubtractSourceIds, toast: (message) => log.push(['toast', message]),
    commit, filmBlocked: () => {}, hooks: {}, uid: () => `new${++counter}`,
    uniqueName, unlinkMesh: () => {}, remapSignalConnections: () => [], JSON, Set, Map }
  const deletion = source.slice(source.indexOf('function planNodeRemoval('), source.indexOf('export function removeRoadPoint()'))
  const selection = source.slice(source.indexOf('export function removeSelected()'), source.indexOf('function cloneSubtree('))
  const duplicate = source.slice(source.indexOf('function cloneSubtree('), source.indexOf('export const duplicateObject'))
  const methods = runInNewContext(`${deletion}\n${selection}\n${duplicate}\n;({removeObject,removeSelected,canRemoveObjects,duplicateSelected})`.replaceAll('export function ', 'function '), env)
  return { store, log, ...methods }
}

function historyFixture(objects = [body(), mesh(), shape()]) {
  const f = fixture(objects, ['mesh'])
  const env = {
    store: f.store,
    toRaw: (v) => v,
    authoredSceneTree: (p) => ({ objects: p.objects, signalConnections: p.signalConnections || [] }),
    nextNativeRevision: () => 'next',
    validateNodeTree,
    debounce: () => () => {},
    JSON, Set, Map, Object,
  }
  const code = historySource.replace(/^import\s+[^\n]+\n/gm, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g, '')
  const history = runInNewContext(`${code}\n;({resetHistory,commit,undo,redo})`, env)
  history.resetHistory()
  return { ...f, history }
}

test('eliminar la fuente de un TriMesh activo se bloquea sin alterar datos, selección ni historial', () => {
  const f = fixture()
  const before = clone(f.store.project)
  assert.equal(f.removeObject('mesh'), false)
  assert.deepEqual(f.store.project, before)
  assert.deepEqual(f.log.filter((x) => x[0] === 'commit'), [])
  assert.match(f.log.find((x) => x[0] === 'toast')[1], /utiliza una malla/)
})

test('eliminar el cuerpo físico completo elimina colisión y fuente conjuntamente', () => {
  const f = fixture(undefined, ['body'])
  assert.equal(f.removeSelected(), true)
  assert.equal(f.store.project.objects.length, 0)
  assert.equal(f.log.filter((x) => x[0] === 'commit').length, 1)
})

test('selección múltiple de malla y colisión se elimina atómicamente', () => {
  const f = fixture(undefined, ['mesh', 'shape'])
  assert.equal(f.removeSelected(), true)
  assert.deepEqual(f.store.project.objects.map((o) => o.id), ['body'])
  assert.equal(f.log.filter((x) => x[0] === 'commit').length, 1)
})

test('selección múltiple con malla referenciada externa se bloquea completa', () => {
  const f = fixture([body(), mesh(), shape(), mesh('other')], ['mesh', 'other'])
  const before = clone(f.store.project.objects)
  assert.equal(f.removeSelected(), false)
  assert.deepEqual(f.store.project.objects, before)
  assert.equal(f.log.some((x) => x[0] === 'remove'), false)
})

test('eliminar únicamente la colisión permite preservar la malla', () => {
  const f = fixture(undefined, ['shape'])
  assert.equal(f.removeObject('shape'), true)
  assert.deepEqual(f.store.project.objects.map((o) => o.id), ['body', 'mesh'])
})

test('duplicar un StaticBody3D redirige sourceId al nuevo mesh y conserva el original', () => {
  const f = fixture(undefined, ['body'])
  assert.equal(f.duplicateSelected(), true)
  const original = f.store.project.objects.slice(0, 3)
  const copied = f.store.project.objects.slice(3)
  const nextBody = copied.find((o) => o.type === 'staticbody3d')
  const nextMesh = copied.find((o) => o.type === 'mesh')
  const nextShape = copied.find((o) => o.type === 'collisionshape3d')
  assert.equal(nextMesh.parentId, nextBody.id)
  assert.equal(nextShape.props.shape.sourceId, nextMesh.id)
  assert.equal(original[2].props.shape.sourceId, 'mesh')
  assert.equal(validateNodeTree(f.store.project.objects).size, 6)
})

test('reparentado de fuente TriMesh fuera de su cuerpo se rechaza antes de mutar', () => {
  const nodes = [body(), mesh(), shape(), body('otherBody')]
  assert.throws(() => validateNodeParent(nodes, 'mesh', 'otherBody'), /origen fuera/)
  assert.equal(nodes[1].parentId, 'body')
})

test('Ctrl+Z y Ctrl+Y conservan los IDs y restauran la relación sourceId', () => {
  const f = historyFixture()
  f.store.project.objects = []
  f.history.commit('Eliminar StaticBody3D')
  f.history.undo()
  assert.deepEqual(f.store.project.objects.map((n) => n.id), ['body', 'mesh', 'shape'])
  assert.equal(f.store.project.objects[2].props.shape.sourceId, 'mesh')
  f.history.redo()
  assert.equal(f.store.project.objects.length, 0)
})

test('Undo/Redo rechaza snapshot físico inválido sin reemplazar objetos ni mover índice', () => {
  const f = historyFixture()
  f.store.project.objects = [body(), shape()]
  f.history.commit('Estado defectuoso')
  f.store.project.objects = [body(), mesh(), shape()]
  f.history.undo()
  const before = clone(f.store.project.objects)
  assert.throws(() => f.history.redo(), /origen fuera/)
  assert.deepEqual(f.store.project.objects, before)
  assert.equal(f.store.canRedo, true)
})

test('serializar escena restaurada mantiene fuente y jerarquía de TriMesh', () => {
  const nodes = clone([body(), mesh(), shape()])
  const restored = JSON.parse(JSON.stringify(nodes))
  assert.equal(restored[2].props.shape.sourceId, restored[1].id)
  assert.equal(validateNodeTree(restored).size, 3)
})

test('el remapeo por ID solo altera referencias de TriMesh incluidas en la copia', () => {
  const nodes = [shape('copy', 'mesh'), shape('other', 'untouched')]
  remapTriMeshSourceIds(nodes, new Map([['mesh', 'copyMesh']]))
  assert.equal(nodes[0].props.shape.sourceId, 'copyMesh')
  assert.equal(nodes[1].props.shape.sourceId, 'untouched')
})
