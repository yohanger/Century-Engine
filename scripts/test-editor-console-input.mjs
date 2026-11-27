import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ContinuousGrab } from '../src/core/editor/continuous-grab.js'

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const stripImports = (text) => text.replace(/^import .*\n/gm, '')
const navCode = stripImports(read('engine/runtime/render/viewport-nav.js'))
const { navMethods } = await import(`data:text/javascript,${encodeURIComponent(`const THREE={};const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));${navCode}`)}`)
const roadsCode = stripImports(read('core/editor/roads.js'))
const { roadsMethods } = await import(`data:text/javascript,${encodeURIComponent(roadsCode)}`)
const editorCode = stripImports(read('core/editor.js').split('\nfunction mixin(')[0]).replace('export class Editor', 'class Editor')
const { Editor } = await import(`data:text/javascript,${encodeURIComponent(`class SceneGraph{};const store={terrainTool:'raise',brush:{radius:2,strength:1,layer:null}};${editorCode}\nexport { Editor }`)}`)

class Target {
  constructor() { this.listeners = new Map() }
  addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) || []), listener]) }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener)) }
  dispatch(type, props = {}) { for (const listener of [...(this.listeners.get(type) || [])]) listener(props) }
}

function scene({ denied = false } = {}) {
  const doc = new Target(), win = new Target(), dom = new Target(), parent = new Target()
  const originalWindow = globalThis.window
  globalThis.window = win
  doc.defaultView = win
  doc.hidden = false
  doc.pointerLockElement = null
  doc.createElement = () => ({ style: {}, setAttribute() {}, remove() {} })
  doc.exitPointerLock = () => { doc.pointerLockElement = null; doc.dispatch('pointerlockchange') }
  dom.ownerDocument = doc
  dom.parentElement = parent
  dom.style = {}
  dom.clientHeight = 180
  dom.focus = () => {}
  dom.getBoundingClientRect = () => ({left: 0, top: 0, width: 240, height: 180})
  parent.getBoundingClientRect = () => ({left: 0, top: 0})
  parent.appendChild = (elem) => { elem.parentElement = parent }
  dom.requestPointerLock = () => {
    if (denied) throw Error('Pointer Lock denegado')
    doc.pointerLockElement = dom
    doc.dispatch('pointerlockchange')
  }
  let captures = 0
  dom.setPointerCapture = () => {
    if (doc.pointerLockElement) throw new DOMException('Pointer Lock activo', 'InvalidStateError')
    captures++
  }
  const controls = { enabled: true, rotateSpeed: 1, panSpeed: 1, target: {}, mouseButtons: {} }
  dom.addEventListener('pointerdown', (event) => { if (controls.enabled) dom.setPointerCapture(event.pointerId) })
  const grab = new ContinuousGrab(dom)
  const vp = Object.assign({
    dom, controls, playing: false, _flying: false, _space: false, _keys: new Set(),
    camera: { position: { distanceTo: () => 12 } },
    _orbitBy() {}, _panBy() {}, _flyRotate() {},
    _endFlyNavigation() { this._flying = false; this.controls.enabled = true },
  }, navMethods)
  vp._endFlyNavigation = () => { vp._flying = false; vp.controls.enabled = true }
  vp.setEditNavigation(() => true, grab)
  vp._bindFly()
  vp._bindContinuousNavigation()
  const down = (button, other = {}) => dom.dispatch('pointerdown', { button, pointerId: 1, clientX: 100, clientY: 90, shiftKey: false, ...other })
  const up = (button) => dom.dispatch('pointerup', { button, pointerId: 1 })
  const dispose = () => { vp._stopContinuousNavigation(true); vp._continuousNavigationCleanup(); vp._flyCleanup(); grab.dispose(); globalThis.window = originalWindow }
  return { dom, doc, win, controls, grab, vp, down, up, dispose, get captures() { return captures } }
}

test('la órbita con Pointer Lock no solicita una segunda captura de puntero', () => {
  const s = scene()
  try {
    s.down(1)
    assert.equal(s.grab.locked, true)
    assert.equal(s.controls.enabled, false)
    assert.equal(s.captures, 1)
    s.down(1)
    assert.equal(s.captures, 1)
    s.up(1)
    assert.equal(s.doc.pointerLockElement, null)
    assert.equal(s.controls.enabled, true)
    s.down(0)
    assert.equal(s.captures, 2)
  } finally { s.dispose() }
})

test('Shift+central y Alt+izquierdo restauran los controles al terminar', () => {
  const s = scene()
  try {
    s.down(1, { shiftKey: true })
    assert.equal(s.vp._continuousNavigation.kind, 'pan')
    assert.equal(s.controls.enabled, false)
    s.up(1)
    assert.equal(s.controls.enabled, true)
    s.down(0, { altKey: true })
    assert.equal(s.vp._continuousNavigation.kind, 'orbit')
    assert.equal(s.controls.enabled, false)
    s.up(0)
    assert.equal(s.controls.enabled, true)
  } finally { s.dispose() }
})

test('Escape y la pérdida de foco restauran OrbitControls', () => {
  const s = scene()
  try {
    s.down(1)
    s.doc.dispatch('keydown', { key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} })
    assert.equal(s.controls.enabled, true)
    assert.equal(s.doc.pointerLockElement, null)
    s.down(1)
    s.win.dispatch('blur')
    assert.equal(s.controls.enabled, true)
    assert.equal(s.grab.active, false)
  } finally { s.dispose() }
})

test('la denegación de Pointer Lock conserva la navegación oficial', () => {
  const s = scene({ denied: true })
  try {
    s.down(1)
    assert.equal(s.grab.active, false)
    assert.equal(s.controls.enabled, true)
    assert.equal(s.vp._continuousNavigation, undefined)
  } finally { s.dispose() }
})

test('una denegación asíncrona de Pointer Lock libera el gesto pendiente', async () => {
  const s = scene()
  try {
    s.dom.requestPointerLock = () => Promise.reject(new Error('Pointer Lock denegado'))
    s.down(1)
    assert.equal(s.controls.enabled, false)
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(s.grab.active, false)
    assert.equal(s.vp._continuousNavigation, null)
    assert.equal(s.controls.enabled, true)
  } finally { s.dispose() }
})

test('el vuelo no solicita una nueva captura mientras el puntero está bloqueado', () => {
  const s = scene()
  try {
    s.down(2)
    assert.equal(s.vp._flying, true)
    assert.equal(s.controls.enabled, false)
    assert.equal(s.grab.locked, true)
    const before = s.captures
    s.down(2)
    assert.equal(s.captures, before)
    s.up(2)
    assert.equal(s.vp._flying, false)
    assert.equal(s.controls.enabled, true)
    assert.equal(s.doc.pointerLockElement, null)
  } finally { s.dispose() }
})

test('un segundo botón no inicia vuelo durante un gesto de órbita', () => {
  const s = scene()
  try {
    s.down(1)
    s.down(2)
    assert.equal(s.vp._flying, false)
    assert.equal(s.vp._continuousNavigation.kind, 'orbit')
    s.up(2)
    assert.equal(s.grab.active, true)
    s.up(1)
    assert.equal(s.grab.active, false)
  } finally { s.dispose() }
})

test('touchTerrain actualiza sombras, geometría, carretera y viewport sin llamadas inexistentes', () => {
  const calls = []
  const editor = {
    vp: { invalidateShadows: () => calls.push('shadows'), requestRender: () => calls.push('render') },
    nodes: new Map([['road', { userData: { refresh: () => calls.push('road') } }]]),
    _syncRoadHandles: () => calls.push('handles'),
  }
  roadsMethods.touchTerrain.call(editor)
  assert.equal(editor._terrainVer, 1)
  assert.deepEqual(calls, ['shadows', 'road', 'handles', 'render'])
  assert.equal(read('core/editor.js').includes('_scheduleWM'), false)
  assert.equal(read('core/editor/roads.js').includes('_wmVer'), false)
})

test('el pincel continúa aplicándose por frame sin depender del método retirado', () => {
  const actions = []
  const terrain = { enabled: true, contains: () => true, foliage: { total: 0 }, applyBrush: () => actions.push('brush') }
  const instance = {
    stroke: { flatten: 3, invert: false }, terrains: [terrain],
    _sceneFrame: () => actions.push('scene'), _postVolumeEditorTick: () => {},
    _ray: () => {}, raycaster: { ray: {} },
    raycastTerrain: () => ({ point: { x: 2, y: 3, z: 4 } }),
    _updateBrushCursor: () => actions.push('cursor'),
  }
  assert.equal(Editor.prototype._frame.call(instance, 0.016), true)
  assert.deepEqual(actions, ['scene', 'brush', 'cursor'])
  assert.equal(typeof instance._scheduleWM, 'undefined')
})
