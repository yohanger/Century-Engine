import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const pointerSource = read('src/core/editor/pointer.js').replace(/^import .*$/gm, '').replace('export const pointerMethods =', 'const pointerMethods =')
const stateSource = read('src/core/state/objects.js')
const selectionSource = stateSource.slice(stateSource.indexOf('export function selectObject('), stateSource.indexOf('/** Selecciona la escena abierta')).replace('export function', 'function')

function setup() {
  const models = new Map(), listeners = new Map(), events = [], group = { visible: true }
  const store = { project: { activeSceneId: 'world' }, tool: 'select', view: { terrain: true }, play: { on: false }, gameView: { on: false }, roadPaint: { active: false }, selectedIds: [], selectedId: null, prefs: { rightTab: 'object' } }
  const dom = { addEventListener(name, fn) { listeners.set(name, fn) }, getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 } } }
  let hits = [], terrain = null
  const editor = { dom, objectsGroup: group, pointer: {}, raycaster: { setFromCamera() {}, intersectObjects() { return hits }, ray: {} }, vp: { camera: {}, wantsNav: () => false }, _anyAxis: () => false, _colliderDown: () => false, _colliderUp: () => false, _roadPickHandle: () => -1, _roadPaintEnd() {}, raycastTerrain: () => terrain,
    _lockedChain(id) { for (let n = models.get(id); n; n = models.get(n.parentId)) if (n.locked) return true; return false },
    setSelection(id, ids) { events.push([id, [...ids]]) } }
  store.editor = editor
  const ctx = vm.createContext({ THREE: { Vector2: class {} }, store, getObject: id => models.get(id), win: { addEventListener() {}, removeEventListener() {} }, selectPiece: id => events.push(['terrain', id]) })
  vm.runInContext(`${selectionSource}\n${pointerSource}\nglobalThis.api = {pointerMethods,selectObject}`, ctx)
  Object.assign(editor, ctx.api.pointerMethods)
  editor._bindPointer()
  function node(id, parent = null, extra = {}) {
    const model = { id, parentId: parent?.model.id ?? null, type: 'node3d', ...extra }
    models.set(id, model)
    const root = { visible: true, parent: parent?.root || group, userData: { id, kind: 'object' } }
    const part = { visible: true, parent: root, userData: {}, isMesh: true, material: { visible: true } }
    return { model, root, part }
  }
  const event = extra => ({ button: 0, pointerId: 1, clientX: 40, clientY: 50, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...extra })
  const fire = (name, extra) => listeners.get(name)(event(extra))
  const click = extra => { fire('pointerdown', extra); fire('pointerup', extra) }
  const target = (...nodes) => { hits = nodes.map((n, i) => ({ object: n.part, distance: i + 1, point: {} })) }
  const parent = node('parent'), child = node('child', parent), sibling = node('sibling', parent)
  return { store, editor, events, models, node, parent, child, sibling, target, click, fire, direct: ctx.api.selectObject, terrain: value => { terrain = value } }
}

test('clic en hijo selecciona padre y entrega ese destino al Inspector y gizmos', () => {
  const f = setup(); f.target(f.child); f.click(); assert.equal(f.store.selectedId, 'parent'); assert.deepEqual(f.events.at(-1), ['parent', ['parent']])
})
test('raíz mantiene selección propia', () => { const f = setup(); f.target(f.parent); f.click(); assert.equal(f.store.selectedId, 'parent') })
test('anidación: selecciona únicamente el padre inmediato', () => { const f = setup(); const leaf = f.node('leaf', f.child); f.target(leaf); f.click(); assert.equal(f.store.selectedId, 'child') })
test('doble clic nativo sobre el mismo hijo permite seleccionarlo', () => { const f = setup(); f.target(f.child); f.click(); f.click(); f.fire('dblclick'); assert.equal(f.store.selectedId, 'child') })
test('dos clics sobre hijos distintos no seleccionan un hijo mediante doble clic', () => { const f = setup(); f.target(f.child); f.click(); f.target(f.sibling); f.click(); f.fire('dblclick'); assert.equal(f.store.selectedId, 'parent') })
test('selección directa desde árbol conserva hijo', () => { const f = setup(); f.direct('child'); assert.equal(f.store.selectedId, 'child') })
test('Shift añade padre una sola vez incluso con varios hijos', () => { const f = setup(); const other = f.node('other'); f.target(other); f.click(); f.target(f.child); f.click({ shiftKey: true }); f.target(f.sibling); f.click({ shiftKey: true }); assert.deepEqual([...f.store.selectedIds], ['other', 'parent']) })
test('Ctrl y Cmd alternan el padre', () => { const f = setup(); f.target(f.child); f.click({ ctrlKey: true }); assert.equal(f.store.selectedId, 'parent'); f.target(f.sibling); f.click({ metaKey: true }); assert.equal(f.store.selectedId, null) })
test('doble clic con modificadores no perfora el grupo', () => { const f = setup(); f.target(f.child); f.click({ shiftKey: true }); f.click({ shiftKey: true }); f.fire('dblclick', { shiftKey: true }); assert.equal(f.store.selectedId, 'parent') })
test('instancia vinculada anidada conserva raíz atómica incluso con doble clic', () => { const f = setup(); const instance = f.node('instance', f.parent, { type: 'sceneInstance' }); const linked = f.node('linked', instance, { sceneInstanceOwner: 'instance' }); const leaf = f.node('leaf', linked, { sceneInstanceOwner: 'instance' }); f.target(leaf); f.click(); assert.equal(f.store.selectedId, 'instance'); f.click(); f.fire('dblclick'); assert.equal(f.store.selectedId, 'instance'); f.target(instance); f.click(); assert.equal(f.store.selectedId, 'instance') })
test('padre bloqueado impide seleccionar su descendiente', () => { const f = setup(); f.parent.model.locked = true; f.target(f.child); f.click(); assert.equal(f.store.selectedId, null) })
test('padre oculto excluye sus descendientes del raycast', () => { const f = setup(); f.parent.root.visible = false; f.target(f.child); f.click(); assert.equal(f.store.selectedId, null) })
test('arrastre, gizmo y gesto cancelado no habilitan doble clic', () => { const f = setup(); f.target(f.child); f.click(); f.fire('pointerdown'); f.fire('pointerup', { clientX: 60 }); f.fire('dblclick'); assert.equal(f.store.selectedId, 'parent'); f.click(); f.editor._anyAxis = () => true; f.click(); f.fire('dblclick'); assert.equal(f.store.selectedId, 'parent'); f.editor._anyAxis = () => false; f.click(); f.fire('pointerdown'); f.fire('pointercancel'); f.fire('pointerup'); f.fire('dblclick'); assert.equal(f.store.selectedId, 'parent') })
test('Edit Mesh, Play y navegación no pasan por selección de objeto', () => { const f = setup(); f.target(f.child); f.editor.edit = {}; f.click(); f.editor.edit = null; f.store.play.on = true; f.click(); f.store.play.on = false; f.editor.vp.wantsNav = () => true; f.click(); assert.equal(f.events.length, 0) })
test('cambio de escena invalida el gesto y la segunda pulsación', () => { const f = setup(); f.target(f.child); f.click(); f.fire('pointerdown'); f.store.project.activeSceneId = 'another'; f.fire('pointerup'); f.fire('dblclick'); assert.equal(f.events.length, 1); f.click(); f.fire('dblclick'); assert.equal(f.store.selectedId, 'parent') })
test('terreno frontal y chunks conservan prioridad', () => { const f = setup(); f.target(f.child); f.terrain({ distance: .5, piece: { id: 'ground' } }); f.click(); assert.deepEqual(f.events.at(-1), ['terrain', 'ground']); f.editor.streamingPreview = { pick: () => ({ distance: .1, index: 1, nodeId: 'chunk' }), select: (i, id) => f.events.push([i,id]) }; f.click(); assert.deepEqual(f.events.at(-1), [1, 'chunk']) })
test('raycast de superficies conserva el nodo alcanzado, no su padre', () => { const f = setup(); f.target(f.child); assert.equal(f.editor._pick({ surfacesOnly: true }).object.id, 'child') })
test('clic en vacío limpia selección y clic modificado en vacío la conserva', () => { const f = setup(); f.target(f.child); f.click(); f.target(); f.click({ shiftKey: true }); assert.equal(f.store.selectedId, 'parent'); f.click(); assert.equal(f.store.selectedId, null) })
