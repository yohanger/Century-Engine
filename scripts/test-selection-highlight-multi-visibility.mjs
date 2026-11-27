import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }) }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this }
  setScalar(n) { return this.set(n, n, n) }
  copy(v) { return this.set(v.x, v.y, v.z) }
  max(v) { return this.set(Math.max(this.x, v.x), Math.max(this.y, v.y), Math.max(this.z, v.z)) }
}
class Box3 {
  setFromObject(o) { this._source = o; this.bounds = o.bounds; return this }
  isEmpty() { return !this.bounds }
  getCenter(v) { return v.copy(this.bounds.center) }
  getSize(v) { return v.copy(this.bounds.size) }
}
class Color {
  constructor(value = '#ffffff') { this.value = value }
  set(v) { this.value = v; return this }
  lerp(color, amount) { this.tint = { color: color.value, amount }; this.value = `mixed-${this.value}-${color.value}`; return this }
}
class LineMaterial {
  constructor(opts) { Object.assign(this, opts); this.color = new Color(opts.color) }
}
class LineSegmentsGeometry {
  setPositions(values) { this.positions = [...values]; return this }
  dispose() { this.disposed = true }
}
class LineSegments2 {
  constructor(geometry, material) {
    this.geometry = geometry
    this.material = material
    this.userData = {}
    this.position = new Vector3()
    this.scale = new Vector3()
    this.visible = true
  }
}
const THREE = { Vector3, Box3, Color, MathUtils: { clamp: (v, a, b) => Math.min(Math.max(v, a), b) } }
const source = read('src/core/editor/selection-box.js')
  .replace(/^import .*$/gm, '').replaceAll('export function ', 'function ')
const visualContext = vm.createContext({ THREE, LineSegments2, LineSegmentsGeometry, LineMaterial })
vm.runInContext(source + '\nglobalThis.api={configureSelectionBoxes,makeSelectionBox}', visualContext)
const { configureSelectionBoxes, makeSelectionBox } = visualContext.api
const selectorSource = read('src/core/editor/selection.js')
  .replace(/^import .*$/gm, '').replace('export const selectionMethods =', 'const selectionMethods =')

function setup({ count = 4, mode = 'box', playing = false } = {}) {
  const objects = new Map(), nodes = new Map(), overlays = new Set(), events = []
  for (let i = 1; i <= count; i++) {
    const id = `node-${i}`
    objects.set(id, { id, type: 'primitive' })
    nodes.set(id, { parent: {}, visible: true, bounds: { center: new Vector3(i * 3, 1, 0), size: new Vector3(2, 2, 2) },
      userData: { id, editorGizmos: [] }, getWorldPosition: v => v.set(i * 3, 1, 0) })
  }
  const selectedIds = [...objects.keys()]
  const store = { selectedId: selectedIds.at(-1), selectedIds,
    play: { on: playing }, tool: 'select', prefs: {
      selectionStyle: mode, selectionOutlineColor: '#eab441', selectionOutlineWidth: 2,
      selectionOutlineStrength: 4,
    }, gizmo: 'none', space: 'world', roadPoint: null }
  const look = { setEditorOutline(...args) { events.push(['outline', ...args]) } }
  const editor = {
    nodes, boxes: [], edit: null, streamingPreview: null, vp: {
      playing: false, overlay: { add(b) { overlays.add(b) }, remove(b) { overlays.delete(b) } },
      look, requestRender() { events.push(['render']) },
    },
    _refreshNodeGizmos() {}, _detachAll() {}, _updateGizmoMode() {}, _lockedChain() { return false },
    _multiTargets() { return selectedIds }, _syncRoadHandles() {}, _syncTerrainGizmo() {},
    _tcs() { return [] }, _isPath() { return false },
  }
  const env = vm.createContext({ THREE, store, getObject: id => objects.get(id), gizmoCategory: () => 'meshes',
    gizmosEnabled: () => true, getDef: () => ({ scalable: true }),
    configureSelectionBoxes, makeSelectionBox })
  vm.runInContext(selectorSource + '\nglobalThis.selectionMethods = selectionMethods', env)
  Object.assign(editor, env.selectionMethods)
  return { editor, store, nodes, events, overlays, selectedIds }
}

test('cuatro nodos seleccionados generan cuatro indicadores independientes', () => {
  const f = setup()
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  assert.equal(f.editor.boxes.length, 4)
  assert.equal(f.overlays.size, 4)
  assert.ok(f.editor.boxes.every(b => b.geometry.positions.length === 72))
  assert.ok(f.editor.boxes.every(b => b.material.depthTest === false))
  assert.ok(f.editor.boxes.every(b => b.frustumCulled === false))
})

test('el nodo activo es más visible que los secundarios, en píxeles y sin depender de la profundidad', () => {
  const f = setup()
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  const active = f.editor.boxes.at(-1), other = f.editor.boxes[0]
  assert.ok(active.material.linewidth > other.material.linewidth)
  assert.equal(active.material.color.value, '#eab441')
  assert.notEqual(other.material.color.value, active.material.color.value)
  assert.equal(other.material.color.tint.color, '#35d7ee')
  assert.equal(active.material.depthWrite, false)
  assert.equal(other.material.depthTest, false)
})

test('preferencias de color, grosor e intensidad actualizan los indicadores sin crear un nuevo renderizador', () => {
  const f = setup()
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  const box = f.editor.boxes.at(-1)
  const previousWidth = box.material.linewidth
  f.store.prefs.selectionOutlineWidth = 4
  f.store.prefs.selectionOutlineStrength = 6
  f.store.prefs.selectionOutlineColor = '#ff3300'
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  assert.equal(f.editor.boxes.at(-1).material.color.value, '#ff3300')
  assert.ok(f.editor.boxes.at(-1).material.linewidth > previousWidth)
})

test('cambiar la selección libera geometrías anteriores sin tocar materiales de autoría', () => {
  const f = setup()
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  const previous = [...f.editor.boxes]
  f.editor.setSelection('node-1', ['node-1'])
  assert.ok(previous.every(box => box.geometry.disposed))
  assert.equal(f.editor.boxes.length, 1)
  assert.equal(f.overlays.size, 1)
})

test('el helper sigue el movimiento y tamaño de cada nodo sin regenerar topología', () => {
  const f = setup({ count: 1 })
  f.editor.setSelection('node-1', ['node-1'])
  const box = f.editor.boxes[0], geometry = box.geometry
  f.nodes.get('node-1').bounds = { center: new Vector3(12, 4, 6), size: new Vector3(4, 5, 8) }
  f.editor._updateBoxes()
  assert.equal(box.geometry, geometry)
  assert.equal(box.position.x, 12)
  assert.equal(box.scale.z, 8)
})

test('grupos sin geometría visible reciben un indicador mínimo de ubicación', () => {
  const f = setup({ count: 1 })
  f.nodes.get('node-1').bounds = null
  f.editor.setSelection('node-1', ['node-1'])
  assert.equal(f.editor.boxes[0].scale.x, 0.35)
  assert.equal(f.editor.boxes[0].position.x, 3)
})

test('un nodo retirado del árbol no deja un contorno residual', () => {
  const f = setup({ count: 1 })
  f.editor.setSelection('node-1', ['node-1'])
  f.nodes.get('node-1').parent = null
  f.editor._updateBoxes()
  assert.equal(f.editor.boxes[0].visible, false)
})

test('modo contorno mantiene los cuatro objetos seleccionados sin cajas adicionales', () => {
  const f = setup({ mode: 'outline' })
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  assert.equal(f.editor.boxes.length, 0)
  const last = f.events.filter(e => e[0] === 'outline').at(-1)
  assert.equal(last[1].length, 4)
  assert.equal(last[2], true)
})

test('modo Ninguno desactiva los indicadores, no elimina la selección', () => {
  const f = setup({ mode: 'none' })
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  assert.equal(f.editor.boxes.length, 0)
  assert.equal(f.selectedIds.length, 4)
  assert.equal(f.events.filter(e => e[0] === 'outline').at(-1)[2], false)
})

test('Edit Mesh suprime indicadores y Play los conserva únicamente para el observador editorial', () => {
  const f = setup()
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  f.editor.edit = { objId: f.store.selectedId }
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  assert.equal(f.editor.boxes.length, 0)
  f.editor.edit = null
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  f.store.play.on = true
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  assert.equal(f.editor.boxes.length, 4)
  assert.equal(f.events.filter(e => e[0] === 'outline').at(-1)[2], false)
})

test('se conserva el indicador de previsualización vinculada', () => {
  const f = setup({ count: 1 })
  const linked = f.nodes.get('node-1')
  f.editor.streamingPreview = { selection() { return { nodeId: 'node-1', node: linked } },
    updateBounds() {} }
  f.editor.setSelection('node-1', ['node-1'])
  assert.equal(f.editor.boxes.length, 1)
})

test('las opciones de grosor e intensidad están disponibles en Caja y Contorno', () => {
  const prefs = read('src/components/PreferencesModal.vue')
  assert.match(prefs, /p\.selectionStyle !== 'none'/)
  assert.match(prefs, /selectionOutlineColor/)
  assert.match(prefs, /selectionOutlineWidth/)
  assert.match(prefs, /selectionOutlineStrength/)
})


test('la superposición de la selección se dibuja después de cada viewmode nativo', () => {
  const viewport = read('src/engine/runtime/render/viewport.js')
  const diagIndex = viewport.indexOf('this.viewDiagnostics.draw(this.viewMode)')
  const overlayIndex = viewport.indexOf('this.drawEditorOverlay()', diagIndex)
  assert.ok(diagIndex >= 0 && overlayIndex > diagIndex)
  assert.match(viewport, /renderer\.clearDepth\(\)\s+renderer\.render\(scene, this\.camera\)/)
})

test('los indicadores editoriales usan un único par de materiales compartidos y no cambian mallas', () => {
  const source = read('src/core/editor/selection-box.js')
  assert.match(source, /const activeMaterial = new LineMaterial/)
  assert.match(source, /const secondaryMaterial = new LineMaterial/)
  assert.match(source, /new LineSegments2\(geometry, active \? activeMaterial : secondaryMaterial\)/)
  assert.doesNotMatch(source, /node\.material\s*=|node\.geometry\s*=/)
})

test('un conjunto grande reutiliza los materiales y libera sus geometrías al deseleccionar', () => {
  const f = setup({ count: 120 })
  f.editor.setSelection(f.store.selectedId, f.selectedIds)
  assert.equal(f.overlays.size, 120)
  assert.equal(new Set(f.editor.boxes.map(b => b.material)).size, 2)
  const previous = [...f.editor.boxes]
  f.editor.setSelection(null, [])
  assert.equal(f.overlays.size, 0)
  assert.ok(previous.every(b => b.geometry.disposed))
})
