// LF-EDITOR-UX-S01-G001: los rayos de selección y de colocación no son intercambiables.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

class V3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }) }
  clone() { return new V3(this.x, this.y, this.z) }
  addScaledVector(v, k) { this.x += v.x * k; this.y += v.y * k; this.z += v.z * k; return this }
  applyMatrix4(m) { this.x -= m.tx || 0; this.y -= m.ty || 0; this.z -= m.tz || 0; return this }
  toArray() { return [this.x, this.y, this.z] }
}
const THREE = { Vector3: V3, Vector2: class { constructor(x, y) { Object.assign(this, { x, y }) } } }
function load(file, exportName, extras = {}) {
  const source = fs.readFileSync(new URL(`../src/core/editor/${file}`, import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(`export const ${exportName} =`, `const ${exportName} =`)
  const sandbox = { THREE, store: { tool: 'select', view: { terrain: true }, project: { settings: { snap: false, gridSize: 1 }, models: [] }, place: {} }, ...extras }
  vm.runInNewContext(`${source}\nglobalThis.result = ${exportName}`, sandbox, { filename: file })
  return { methods: sandbox.result, store: sandbox.store }
}
function fake(partProps = {}, rootProps = {}) {
  const group = { visible: true }, root = { visible: true, userData: { id: 'a', kind: 'object', ...rootProps }, parent: group }
  const part = { visible: true, isMesh: true, material: { visible: true }, userData: {}, parent: root, ...partProps }
  return { group, root, part }
}
function fixture(hits, terrain = null) {
  const { methods, store } = load('pointer.js', 'pointerMethods')
  const { group } = fake()
  const ed = {
    objectsGroup: group, raycaster: { ray: { origin: new V3(12, 4, -3), direction: new V3(0, 0, -1) }, intersectObjects() { return hits } },
    _lockedChain: () => false, raycastTerrain: () => terrain,
  }
  for (const name of ['_objectRoot', '_pickable', '_hitAllowed', '_pick', '_surfaceHit', '_cameraPlaceHit']) ed[name] = methods[name]
  return { ed, store }
}
const hit = (part, distance, point = new V3()) => ({ object: part, distance, point })

test('G001-01 · omite los descendientes invisibles y elige la malla visible', () => {
  const a = fake(), b = fake(); b.root.userData.id = 'b'; b.root.parent = a.group
  const ed = fixture([hit(a.part, 1), hit(b.part, 2)]).ed
  ed.objectsGroup = a.group; a.part.visible = false
  assert.equal(ed._pick().object.id, 'b')
})
test('G001-02 · los gizmos editoriales no se seleccionan', () => {
  const a = fake(), b = fake(); b.root.userData.id = 'b'; b.root.parent = a.group
  a.part.parent = { userData: { helper: true }, visible: true, parent: a.root }
  const ed = fixture([hit(a.part, 1), hit(b.part, 2)]).ed; ed.objectsGroup = a.group
  assert.equal(ed._pick().object.id, 'b')
})
test('G001-03 · un volumen intencional invisible permite seleccionar un grupo', () => {
  const a = fake({ material: { visible: false }, userData: { pickProxy: true } });
  const ed = fixture([hit(a.part, 1)]).ed; ed.objectsGroup = a.group
  assert.equal(ed._pick().object.id, 'a')
})
test('G001-04 · los proxies no sirven como superficies de inserción', () => {
  const a = fake({ material: { visible: false }, userData: { pickProxy: true } });
  const ed = fixture([hit(a.part, 1)]).ed; ed.objectsGroup = a.group
  const pos = ed._surfaceHit()
  assert.equal(pos.free, true)
  assert.deepEqual(pos.point.toArray(), [12, 4, -9])
})
test('G001-05 · coloca sobre la primera malla real detrás de una ayuda', () => {
  const a = fake({ material: { visible: false }, userData: { pickProxy: true } }); const b = fake();
  b.root.userData.id = 'b'; b.root.parent = a.group
  const ed = fixture([hit(a.part, 1), hit(b.part, 2, new V3(3, 2, -8))]).ed; ed.objectsGroup = a.group
  const pos = ed._surfaceHit()
  assert.equal(pos.onObject, true)
  assert.deepEqual(pos.point.toArray(), [3, 2, -8])
})
test('G001-06 · terreno visible delante de una malla recibe la inserción', () => {
  const a = fake(); const terrain = { distance: 2, point: new V3(2, 0, -2) }
  const ed = fixture([hit(a.part, 4, new V3(2, 1, -4))], terrain).ed; ed.objectsGroup = a.group
  const pos = ed._surfaceHit()
  assert.equal(pos.onObject, false)
  assert.deepEqual(pos.point.toArray(), [2, 0, -2])
})
test('G001-07 · el terreno detrás de la geometría no desplaza la inserción', () => {
  const a = fake(); const terrain = { distance: 5, point: new V3(2, 0, -6) }
  const ed = fixture([hit(a.part, 2, new V3(2, 1, -2))], terrain).ed; ed.objectsGroup = a.group
  assert.deepEqual(ed._surfaceHit().point.toArray(), [2, 1, -2])
})
test('G001-08 · en el vacío proyecta seis unidades en la dirección de vista', () => {
  const { ed } = fixture([])
  assert.deepEqual(ed._surfaceHit().point.toArray(), [12, 4, -9])
})
test('G001-09 · un objeto bloqueado no intercepta la selección', () => {
  const a = fake(), b = fake(); b.root.userData.id = 'b'; b.root.parent = a.group
  const ed = fixture([hit(a.part, 1), hit(b.part, 3)]).ed; ed.objectsGroup = a.group
  ed._lockedChain = (id) => id === 'a'
  assert.equal(ed._pick().object.id, 'b')
})
test('G001-10 · la colocación libre no altera la posición con offset de primitivas o luces', () => {
  const { methods, store } = load('placement.js', 'placementMethods', { getDef: () => null, makeObject: () => null })
  store.project.settings.snap = true
  for (const type of ['primitive', 'light', 'camera', 'event', 'mesh']) {
    const ed = { terrains: [] }
    assert.deepEqual(Array.from(methods._placement.call(ed, { point: new V3(1.23, 2.34, 3.45), free: true }, { type, scale: [1, 1, 1] })), [1.23, 2.34, 3.45])
  }
})
test('G001-11 · el menú fuera del visor utiliza el centro, no el último puntero', () => {
  const { methods } = load('placement.js', 'placementMethods', { getDef: () => null, makeObject: () => null })
  const calls = []
  const ed = { dom: { getBoundingClientRect() { return { left: 10, top: 20, right: 110, bottom: 120, width: 100, height: 100 } } }, pointer: { inside: false }, lastClient: { x: 15, y: 25 },
    _setRay(p) { calls.push(p) }, _ray() { calls.push('center') }, _surfaceHit() { return { point: new V3(4, 5, 6) } } }
  const pos = methods.pickPlacePoint.call(ed)
  assert.equal(ed.pointer.x, 50); assert.equal(ed.pointer.y, 50)
  assert.equal(calls[0], 'center')
  assert.deepEqual(pos.point.toArray(), [4, 5, 6])
})
test('G001-12 · el menú sobre el visor usa la última posición válida del cursor', () => {
  const { methods } = load('placement.js', 'placementMethods', { getDef: () => null, makeObject: () => null })
  let at = null
  const ed = { dom: { getBoundingClientRect() { return { left: 10, top: 20, right: 110, bottom: 120, width: 100, height: 100 } } }, pointer: { inside: true }, lastClient: { x: 55, y: 66 },
    _setRay(p) { at = p }, _surfaceHit() { return { point: new V3() } } }
  methods.pickPlacePoint.call(ed)
  assert.equal(at.clientX, 55); assert.equal(at.clientY, 66)
})
test('G001-13 · no se pierde multiselección ni inserción en padre transformado', () => {
  const pointer = fs.readFileSync(new URL('../src/core/editor/pointer.js', import.meta.url), 'utf8')
  const placement = fs.readFileSync(new URL('../src/core/editor/placement.js', import.meta.url), 'utf8')
  assert.match(pointer, /additive: e\.shiftKey, toggle: e\.ctrlKey \|\| e\.metaKey/)
  assert.match(placement, /applyMatrix4\(worldMatrix\(parentId\)\.invert\(\)\)/)
  assert.match(placement, /addObject\(\{ \.\.\.t, name: t\.name \|\| undefined \}, \{ select: true, parentId, label \}\)/)
  assert.match(placement, /!spot\.free && !spot\.onObject && this\.terrains\.length/)
})
test('G001-14 · el marcador de proxy existe y las guías de audio no bloquean selección', () => {
  const helpers = fs.readFileSync(new URL('../src/engine/runtime/nodes/three-helpers.js', import.meta.url), 'utf8')
  const audio = fs.readFileSync(new URL('../src/engine/runtime/nodes/audio.js', import.meta.url), 'utf8')
  assert.match(helpers, /m\.userData\.pickProxy = true/)
  assert.match(helpers, /g\.userData\.helper = true/)
  assert.match(audio, /g\.userData\.helper = true/)
})
