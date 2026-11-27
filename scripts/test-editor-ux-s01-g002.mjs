// LF-EDITOR-UX-S01-G002: medidas iniciales y ayudas editoriales de selección.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const load = (path, name, globals = {}) => {
  const text = source(path).replace(/^import .*$/gm, '').replace(`export const ${name} =`, `const ${name} =`)
  const env = { ...globals }
  vm.runInNewContext(`${text}\nglobalThis.testValue = ${name}`, env, { filename: path })
  return env.testValue
}

const primitives = source('engine/runtime/geometry/primitives.js')
for (const type of ['box', 'sphere', 'cylinder', 'cone']) {
  test(`G002-UNIT-${type} · geometría ${type} nueva tiene escala [1,1,1]`, () => {
    const row = primitives.split('\n').find((line) => new RegExp(`^\\s*${type}:`).test(line))
    assert.match(row, /scale:\s*\[1,\s*1,\s*1\]/)
  })
}
test('G002-05 · eventos nuevos usan escala unitaria, pero zonas funcionales conservan dimensiones propias', () => {
  const event = source('engine/runtime/nodes/event.js')
  assert.match(event, /create:\s*\(\) => \(\{[^\n]*scale:\s*\[1, 1, 1\]/)
  for (const [path, scale] of [['trigger', '4, 3, 4'], ['navigation', '20, 6, 20'], ['atmovolume', '8, 3, 8']]) {
    assert.ok(source(`engine/runtime/nodes/${path}.js`).includes(`scale: [${scale}]`))
  }
})
test('G002-06 · no se migran escalas guardadas ni se modifica la inserción de G001', () => {
  const placement = source('core/editor/placement.js')
  const objects = source('core/state/objects.js')
  assert.match(placement, /makeObject\(spec\.type, spec\.kind/)
  assert.match(placement, /applyMatrix4\(worldMatrix\(parentId\)\.invert\(\)\)/)
  assert.match(objects, /makeObject\(partial\.type, partial\.kind, partial\)/)
})

// G002-BACK: las aserciones de asas negativas de 2026-10-25 quedan reemplazadas por
// LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL / CA-003. No desaparece el test histórico.
const gizmo = load('core/editor/gizmo.js', 'gizmoMethods')
for (const mode of ['translate', 'scale']) {
  test(`G002-BACK-${mode} · CA-003 reutiliza asas oficiales sin duplicar pickers negativos`, () => {
    const src = source('core/editor/gizmo.js')
    assert.match(src, /new TransformControls\(this\.vp\.camera, this\.dom\)/)
    assert.doesNotMatch(src, /_addBackHandles|negativeSide|backMirrored/)
    assert.equal(typeof gizmo._addBackHandles, 'undefined')
  })
}
test('G002-09 · manipuladores conservan addon, espacio y snaps; centro de escala restaurado', () => {
  const g = source('core/editor/gizmo.js'), ed = source('core/editor.js')
  assert.match(g, /this\.tcScl\.setMode\('scale'\)/)
  assert.match(g, /this\.tcRot\.showXYZE = false/)
  assert.doesNotMatch(g, /_stripHandles|_addBackHandles/)
  assert.match(ed, /setTranslationSnap\(/)
  assert.match(ed, /setRotationSnap\(/)
  assert.match(ed, /setScaleSnap\(/)
})
const gizmoPrefs = { showGizmos: true, gizmoCategories: {} }
const selection = load('core/editor/selection.js', 'selectionMethods', {
  THREE: { LineBasicMaterial: class {} },
  store: { play: { on: false }, prefs: gizmoPrefs, selectedIds: [] },
  getObject: () => ({ type: 'group' }),
  gizmoCategory: () => 'other',
  gizmosEnabled: (prefs, category) => prefs.showGizmos !== false && prefs.gizmoCategories?.[category] !== false,
})
test('G002-10 · visibilidad de ayudas según su configuración, no la selección', () => {
  const a = { visible: true, userData: {} }, b = { visible: true, userData: { editorGizmoEnabled: false } }
  const ind = { visible: true }, cells = { visible: true }
  const node = { userData: { editorGizmos: [a, b], indicatorZonesGizmo: ind, cells } }
  selection._syncNodeGizmos(node, false)
  assert.deepEqual([a.visible, b.visible, ind.visible, cells.visible], [true, false, true, true])
  selection._syncNodeGizmos(node, true)
  assert.deepEqual([a.visible, b.visible, ind.visible, cells.visible], [true, false, true, true])
  b.userData.editorGizmoEnabled = true
  selection._syncNodeGizmos(node, true)
  assert.equal(b.visible, true)
})
test('G002-11 · multiselección mantiene los auxiliares de los demás nodos', () => {
  const nodes = new Map(['a', 'b', 'c'].map((id) => [id, { userData: { editorGizmos: [{ visible: false, userData: {} }] } }]))
  const calls = []
  const scope = { nodes, edit: false, boxes: [], _rsId: '', _syncNodeGizmos: selection._syncNodeGizmos,
    _detachAll() {}, _lockedChain() { return false }, _updateGizmoMode() {}, _isPath() { return false },
    _syncRoadHandles() {}, _syncTerrainGizmo() {},
    vp: { overlay: { remove() {}, add() {} }, look: { setEditorOutline() {} }, requestRender() {} },
    _getObject() {}, }
  const ctx = load('core/editor/selection.js', 'selectionMethods', {
    getObject(id) { return { id, type: 'group' } },
    getDef() { return { scalable: false } },
    store: { play: { on: false }, selectedId: 'a', gizmo: 'none', tool: 'select', prefs: { selectionStyle: 'none' }, roadPoint: null },
    THREE: { LineBasicMaterial: class {} }, makeCanvas() {},
    configureSelectionBoxes() {}, makeSelectionBox() {},
    gizmoCategory: () => 'other', gizmosEnabled: () => true,
  })
  scope._syncNodeGizmos = ctx._syncNodeGizmos
  scope._refreshNodeGizmos = ctx._refreshNodeGizmos
  ctx.setSelection.call(scope, 'a', ['a', 'c'])
  assert.deepEqual([...nodes.values()].map((n) => n.userData.editorGizmos[0].visible), [true, true, true])
})
test('G002-12 · reconstrucción y cambios de Inspector reaplican la visibilidad sin un segundo sistema', () => {
  const src = source('core/editor.js')
  assert.match(src, /_nodeBuilt\(obj, node\)[\s\S]*?_syncNodeGizmos\(node/)
  assert.match(src, /_nodeSynced\(obj, id\)[\s\S]*?_syncNodeGizmos\(this\.nodes\.get\(id\)/)
})
test('G002-13 · iconos de luz y audio siguen visibles; únicamente las ayudas dirigidas se restringen', () => {
  const light = source('engine/runtime/nodes/light.js'), audio = source('engine/runtime/nodes/audio.js')
  assert.match(light, /visual\.add\(icon\)/)
  assert.match(light, /editorGizmos\.push\(aim\)/)
  assert.match(light, /editorGizmos\.push\(frame, aim\)/)
  assert.match(audio, /visual\.add\(body, box, aim\)/)
  assert.match(audio, /editorGizmos = \[aim, near, far\]/)
  assert.match(audio, /editorGizmoEnabled = u\.far\.userData\.editorGizmoEnabled = is3d/)
})
test('G002-14 · ayudas de cámara, spawn, evento y gameplay se filtran sin afectar la geometría real', () => {
  for (const file of ['camera', 'spawn', 'event', 'group', 'trigger', 'atmovolume', 'navigation'])
    assert.match(source(`engine/runtime/nodes/${file}.js`), /editorGizmos/)
  const event = source('engine/runtime/nodes/event.js')
  assert.match(event, /editorGizmoEnabled = !!gs/)
  assert.match(source('core/editor/selection.js'), /u\.indicatorZonesGizmo\.visible = editing && gizmosEnabled\(store\.prefs, 'volumes'\)/)
})
test('G002-15 · proxies de grupos y zonas permanecen fuera de los visuales ocultos', () => {
  for (const file of ['group', 'trigger', 'atmovolume', 'navigation'])
    assert.match(source(`engine/runtime/nodes/${file}.js`), /root\.add\(hitSphere\(0\.4\)\)/)
  assert.match(source('core/editor/pointer.js'), /pickProxy/)
})

test('G002-16 · canvas y fauna conservan marcador seleccionable y ocultan solo los rangos', () => {
  const fauna = source('engine/runtime/nodes/critters.js'), canvas = source('engine/runtime/nodes/canvas.js')
  assert.match(fauna, /editorGizmos = \[ring\]/)
  assert.match(fauna, /visual.add\(dot, ring, hitSphere/)
  assert.match(canvas, /editorGizmos = \[area, frame, corners\]/)
  assert.match(canvas, /visual.add\(area, frame, corners, tag\)/)
})
