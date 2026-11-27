// LF-EDITOR-CAMERA-CONTINUOUS-OBJECTMODE-G001: Object Mode usa el mismo gesto que Edit Mode.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ContinuousGrab } from '../src/core/editor/continuous-grab.js'

const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
const navSource = source('engine/runtime/render/viewport-nav.js')
const script = navSource.replace(/^import .*\n/gm, '').replace('export const navMethods', 'const navMethods')
const { navMethods } = await import(`data:text/javascript,${encodeURIComponent(`const THREE={};const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));\n${script}\nexport {navMethods}`)}`)

class EventTargetFake {
  constructor() { this.handlers = new Map() }
  addEventListener(type, handler) { this.handlers.set(type, [...(this.handlers.get(type) || []), handler]) }
  removeEventListener(type, handler) { this.handlers.set(type, (this.handlers.get(type) || []).filter((h) => h !== handler)) }
  dispatch(type, props = {}) { for (const fn of [...(this.handlers.get(type) || [])]) fn(props) }
}
function makeEnvironment() {
  const document = new EventTargetFake(), window = new EventTargetFake()
  const dom = new EventTargetFake(), parent = new EventTargetFake()
  document.defaultView = window; document.pointerLockElement = null; document.hidden = false
  document.createElement = () => ({ style: {}, setAttribute() {}, remove() {} })
  document.exitPointerLock = () => { document.pointerLockElement = null; document.dispatch('pointerlockchange') }
  dom.parentElement = parent; dom.ownerDocument = document; dom.style = {}; dom.clientHeight = 180
  dom.getBoundingClientRect = () => ({ left: 20, top: 10, width: 280, height: 180 })
  parent.getBoundingClientRect = () => ({ left: 0, top: 0 })
  parent.appendChild = (el) => { el.parentElement = parent }
  dom.requestPointerLock = () => { document.pointerLockElement = dom; document.dispatch('pointerlockchange') }
  const grab = new ContinuousGrab(dom), calls = [], modes = { value: 'object' }
  const vp = Object.assign({dom, playing: false, controls: { enabled: true, rotateSpeed: 1, panSpeed: 1 }, _space: false, _flying: false}, navMethods)
  vp._orbitBy = (x, y) => calls.push(['orbit', x, y])
  vp._panBy = (x, y) => calls.push(['pan', x, y])
  vp._flyRotate = (x, y) => calls.push(['fly', x, y])
  vp._endFlyNavigation = () => { vp._flying = false; vp.controls.enabled = true }
  vp.setEditNavigation(() => modes.value !== 'play', grab)
  vp._bindContinuousNavigation()
  const down = (button, props = {}) => dom.dispatch('pointerdown', { button, clientX: 277, clientY: 91, pointerId: 1, ...props })
  const move = (dx, dy) => dom.dispatch('pointermove', { movementX: dx, movementY: dy, preventDefault() {}, stopImmediatePropagation() {} })
  const up = (button) => dom.dispatch('pointerup', { button, pointerId: 1 })
  const dispose = () => { vp._stopContinuousNavigation(true); vp._continuousNavigationCleanup(); grab.dispose() }
  return { dom, document, window, grab, calls, modes, vp, down, move, up, dispose }
}

test('OCG-01: Editor conecta navegación continua también sin sesión de malla', () => {
  const editor = source('core/editor.js')
  assert.match(editor, /setEditNavigation\(\(\) => !this\.player\?\.on && !store\.gameView\.on, this\._continuousGrab\)/)
  assert.doesNotMatch(editor, /setEditNavigation\(\(\) => !!this\.edit/)
})
test('OCG-02: se reutiliza ContinuousGrab, sin segundo cursor o gestor', () => {
  assert.doesNotMatch(navSource, /new ContinuousGrab/)
  assert.match(source('core/editor/gizmo.js'), /this\._continuousGrab = new ContinuousGrab\(this\.dom\)/)
  assert.equal((source('core/editor.js').match(/setEditNavigation\(/g) || []).length, 1)
})
test('OCG-03: movimiento normal y selección no activan bloqueo', () => {
  const s = makeEnvironment()
  try { s.down(0); assert.equal(s.grab.active, false); s.up(0) } finally { s.dispose() }
})
test('OCG-04: Object Mode permite cruzar los cuatro bordes al orbitar', () => {
  const s = makeEnvironment()
  try {
    s.down(1); assert.equal(s.grab.locked, true)
    for (const [x,y] of [[540,0],[-850,0],[0,330],[0,-490]]) s.move(x,y)
    assert.equal(s.calls.length, 4); assert.ok(s.calls.every((c) => c[0] === 'orbit'))
    assert.ok(s.grab.visual.x > 0 && s.grab.visual.x < 280)
    assert.ok(s.grab.visual.y > 0 && s.grab.visual.y < 180)
    s.up(1); assert.equal(s.grab.active,false)
  } finally { s.dispose() }
})
test('OCG-05: Shift+central desplaza la cámara, sin órbita duplicada', () => {
  const s = makeEnvironment()
  try { s.down(1,{shiftKey:true}); s.move(20,-12); assert.deepEqual(s.calls,[['pan',20,-12]]); s.up(1) } finally {s.dispose()}
})
test('OCG-06: Alt+izquierdo y Espacio+izquierdo conservan sus gestos', () => {
  const s = makeEnvironment()
  try {
    s.down(0,{altKey:true}); s.move(6,7); assert.equal(s.calls.at(-1)[0],'orbit'); s.up(0)
    s.vp._space = true; s.down(0); s.move(-9,2); assert.deepEqual(s.calls.at(-1),['pan',-9,2]); s.up(0)
  } finally {s.dispose()}
})
test('OCG-07: vuelo derecho usa un delta por evento y libera bloqueo', () => {
  const s = makeEnvironment()
  try {
    s.vp._flying=true; s.vp.controls.enabled=false
    s.down(2); s.move(40,-30); assert.deepEqual(s.calls,[['fly',40,-30]])
    s.up(2); assert.equal(s.grab.active,false)
  } finally {s.dispose()}
})
test('OCG-08: salir de Play nunca activa la navegación editorial', () => {
  const s = makeEnvironment()
  try {
    s.modes.value='play'; s.down(1); assert.equal(s.grab.active,false)
    s.modes.value='object'; s.vp.playing=true; s.down(1); assert.equal(s.grab.active,false)
    s.vp.playing=false; s.down(1); assert.equal(s.grab.locked,true)
  } finally {s.dispose()}
})
test('OCG-09: un gesto de cámara no captura otro gesto simultáneo', () => {
  const s = makeEnvironment()
  try { s.down(1); s.down(2); assert.equal(s.vp._continuousNavigation.button,1); s.up(2); assert.equal(s.grab.active,true); s.up(1) } finally {s.dispose()}
})
test('OCG-10: Escape y pérdida de foco liberan el cursor en Object Mode', () => {
  const s = makeEnvironment()
  try {
    s.down(1); s.document.dispatch('keydown',{key:'Escape',preventDefault(){},stopImmediatePropagation(){}})
    assert.equal(s.grab.active,false); assert.equal(s.vp._continuousNavigation,null)
    s.down(1); s.window.dispatch('blur'); assert.equal(s.grab.active,false)
  } finally {s.dispose()}
})
test('OCG-11: al entrar en Play se termina la navegación activa antes del cambio de cámara', () => {
  const play = source('core/editor/play-session.js')
  assert.match(play, /ed\.vp\._stopContinuousNavigation\?\.\(true\)/)
  assert.ok(play.indexOf('ed.vp._stopContinuousNavigation?.(true)') < play.indexOf('ed.exitEditMode?.('))
})
test('OCG-12: cambio de escena, salida de Edit Mode y dispose liberan el cursor', () => {
  assert.match(source('core/editor.js'), /_sceneLoading\(\) \{ this\.vp\._stopContinuousNavigation\?\.\(true\)/)
  assert.match(source('core/editor/meshedit.js'), /this\.vp\._stopContinuousNavigation\?\.\(true\)/)
  assert.match(source('engine/runtime/render/viewport.js'), /this\._stopContinuousNavigation\(true\)/)
})
test('OCG-13: no cambia la entrada del Player ni la selección por clic', () => {
  assert.doesNotMatch(source('engine/runtime/events/play-controls.js'), /ContinuousGrab/)
  assert.match(source('core/editor/pointer.js'), /this\.vp\.wantsNav\(e\)/)
})
test('OCG-14: versión sin Pointer Lock conserva fallback de OrbitControls', () => {
  const s = makeEnvironment()
  try {
    s.dom.requestPointerLock = () => { throw new Error('bloqueo rechazado') }
    s.down(1); assert.equal(s.grab.active,false); assert.equal(s.vp._continuousNavigation,undefined)
  } finally {s.dispose()}
})
