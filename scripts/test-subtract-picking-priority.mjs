import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
  clone() { return new Vector3(this.x, this.y, this.z) }
  addScaledVector(v, scale) { this.x += v.x * scale; this.y += v.y * scale; this.z += v.z * scale; return this }
}

const THREE = { Vector3, Vector2: class { constructor(x, y) { this.x = x; this.y = y } } }

function setup(options = {}) {
  const listeners = new Map()
  const events = []
  const group = { visible: true }
  const store = { tool: 'select', view: { terrain: true }, play: { on: false }, gameView: { on: false }, roadPaint: { active: false } }
  const dom = {
    addEventListener(name, listener) { listeners.set(name, listener) },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 } },
  }
  const sandbox = {
    THREE, store, getObject: id => id == null ? null : { id }, win: { addEventListener() {}, removeEventListener() {} },
    selectObject(id, flags) { events.push({ id, flags }) }, selectPiece(id) { events.push({ piece: id }) },
  }
  const pointer = fs.readFileSync(new URL('../src/core/editor/pointer.js', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '').replace('export const pointerMethods =', 'const pointerMethods =')
  vm.runInNewContext(`${pointer}\nglobalThis.pointerMethods = pointerMethods`, sandbox, { filename: 'pointer.js' })
  const methods = sandbox.pointerMethods
  let hits = options.hits ?? []
  let terrain = options.terrain ?? null
  const editor = {
    objectsGroup: group, dom,
    pointer: { x: 0, y: 0 },
    raycaster: { ray: { origin: new Vector3(), direction: new Vector3(0, 0, -1) },
      setFromCamera() {}, intersectObjects() { return hits } },
    vp: { camera: {}, wantsNav: () => false }, _lockedChain: () => false,
    raycastTerrain: () => terrain, _anyAxis: () => false,
    _colliderDown: () => false, _colliderUp: () => false,
    _roadPickHandle: () => -1,
    _updateBrushCursor() {}, _hover() {},
  }
  Object.assign(editor, methods)
  function node(id, type = 'mesh') {
    const root = { visible: true, userData: { id, kind: 'object' }, parent: group }
    const fill = { isMesh: true, visible: true,
      userData: type === 'subtract' ? { pickProxy: true } : {},
      material: { visible: true, opacity: type === 'subtract' ? 0.18 : 1 }, parent: root }
    const edges = { isLineSegments: true, visible: true, userData: { pickIgnore: true }, parent: root }
    return { root, fill, edges }
  }
  const hit = (part, distance) => ({ object: part, distance, point: new Vector3(0, 0, -distance) })
  return { editor, group, store, events, listeners, node, hit,
    setHits(value) { hits = value }, setTerrain(value) { terrain = value },
    click(extra = {}) {
      const event = { button: 0, clientX: 40, clientY: 50, pointerId: 1, shiftKey: false, ctrlKey: false, metaKey: false, ...extra }
      listeners.get('pointerdown')(event)
      listeners.get('pointerup')(event)
    },
  }
}

test('Substract visible tiene prioridad sobre un sólido situado detrás de su volumen', () => {
  const f = setup(); const sub = f.node('cut', 'subtract'), mesh = f.node('box')
  f.setHits([f.hit(sub.fill, 1), f.hit(mesh.fill, 3)])
  assert.equal(f.editor._pick().object.id, 'cut')
})

test('Substract continúa seleccionable cuando no existe otra superficie', () => {
  const f = setup(); const sub = f.node('cut', 'subtract')
  f.setHits([f.hit(sub.fill, 1)])
  assert.equal(f.editor._pick().object.id, 'cut')
})

test('un sólido delante de Substract mantiene prioridad', () => {
  const f = setup(); const sub = f.node('cut', 'subtract'), box = f.node('box')
  f.setHits([f.hit(box.fill, 1), f.hit(sub.fill, 4)])
  assert.equal(f.editor._pick().object.id, 'box')
})

test('dos Substract superpuestos eligen el volumen visible más cercano', () => {
  const f = setup(); const one = f.node('cut1', 'subtract'), two = f.node('cut2', 'subtract'), box = f.node('box')
  f.setHits([f.hit(one.fill, 1), f.hit(two.fill, 2), f.hit(box.fill, 3)])
  assert.equal(f.editor._pick().object.id, 'cut1')
})

test('sin sólidos, elige el Substract más cercano', () => {
  const f = setup(); const one = f.node('cut1', 'subtract'), two = f.node('cut2', 'subtract')
  f.setHits([f.hit(one.fill, 1), f.hit(two.fill, 2)])
  assert.equal(f.editor._pick().object.id, 'cut1')
})

test('las aristas del cortador se omiten y su volumen recibe el clic', () => {
  const f = setup(); const sub = f.node('cut', 'subtract'), box = f.node('box')
  f.setHits([f.hit(sub.edges, 0.9), f.hit(sub.fill, 1), f.hit(box.fill, 3)])
  assert.equal(f.editor._pick().object.id, 'cut')
})

test('con el cortador delante no altera el raycast de superficies de colocación', () => {
  const f = setup(); const sub = f.node('cut', 'subtract'), box = f.node('box')
  f.setHits([f.hit(sub.fill, 1), f.hit(box.fill, 3)])
  const result = f.editor._surfaceHit()
  assert.equal(result.onObject, true)
  assert.equal(result.point.z, -3)
})

test('respeta bloqueo y ocultación del sólido de fondo', () => {
  const f = setup(); const sub = f.node('cut', 'subtract'), box = f.node('box')
  f.setHits([f.hit(sub.fill, 1), f.hit(box.fill, 3)])
  f.editor._lockedChain = (id) => id === 'cut'
  assert.equal(f.editor._pick().object.id, 'box')
  f.editor._lockedChain = () => false
  sub.fill.visible = false
  assert.equal(f.editor._pick().object.id, 'box')
})

test('el clic real del viewport selecciona Substract delante de otro nodo', () => {
  const f = setup(); const sub = f.node('cut', 'subtract'), box = f.node('box')
  f.setHits([f.hit(sub.fill, 1), f.hit(box.fill, 3)])
  f.editor._bindPointer()
  f.click()
  assert.equal(f.events.at(-1)?.id, 'cut')
  f.setHits([f.hit(sub.fill, 1)])
  f.click()
  assert.equal(f.events.at(-1)?.id, 'cut')
})

test('Substract visible delante del terreno conserva la prioridad del clic', () => {
  const f = setup(); const sub = f.node('cut', 'subtract'), box = f.node('box')
  f.setHits([f.hit(sub.fill, 1), f.hit(box.fill, 4)])
  f.setTerrain({ distance: 2, point: new Vector3(), piece: { id: 'terrain1' } })
  f.editor._bindPointer()
  f.click()
  assert.equal(f.events.at(-1)?.id, 'cut')
})

test('la implementación de Substract hace seleccionable el volumen y omite sus aristas', () => {
  const source = fs.readFileSync(new URL('../src/engine/runtime/nodes/subtract.js', import.meta.url), 'utf8')
  assert.match(source, /fill\.userData\.pickProxy\s*=\s*true/)
  assert.doesNotMatch(source, /fill\.userData\.pickThrough/)
  assert.match(source, /edges\.userData\.pickIgnore\s*=\s*true/)
})
