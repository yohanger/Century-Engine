// Regresión de Edit Mesh: ejecuta los métodos reales de entrada sin requerir Electron ni WebGL.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entry = readFileSync(new URL('../src/core/mesh/session-input.js', import.meta.url), 'utf8')
const asModule = (text) => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(text)
const storeUrl = asModule('export const store = { edit: { paint: { active: false } } }')
const polyUrl = asModule('export const ekeyA = () => 0; export const ekeyB = () => 1')
const selUrl = asModule('export const linked = () => {}')
const platformUrl = asModule('export const win = {}')
const mockImports = new Map([
  ['../store.js', storeUrl],
  ['../../engine/runtime/mesh/polymesh.js', polyUrl],
  ['./sel.js', selUrl],
  ['../../engine/runtime/platform.js', platformUrl],
])

// Solo sustituimos los destinos de dependencias: los métodos y sus variables léxicas
// conservan el código fuente original. Sin el import de store se reproduce el ReferenceError.
const isolated = entry.replace(/from\s+(['"])([^'"]+)\1/g, (all, quote, path) => {
  const mocked = mockImports.get(path)
  assert.ok(mocked, `Importación inesperada en Edit Mesh: ${path}`)
  return `from '${mocked}'`
})
const { inputMethods } = await import(asModule(isolated))
const { store } = await import(storeUrl)
function session(mode = 'vertex') {
  const events = []
  const s = {
    mode, vp: { isFlying: false, isNavigating: false, wantsNav: () => false },
    tc: { axis: null }, modal: null, paintStroke: null, down: null,
    svg: { innerHTML: '' },
    _clientToLocal: e => ({ x: e.clientX, y: e.clientY }),
    _clickSelect: (...a) => events.push(['click', ...a]),
    _loopSelect: (...a) => events.push(['loop', ...a]),
    _boxSelect: (...a) => events.push(['box', ...a]),
    _clearSvg: () => { s.svg.innerHTML = '' },
    _paintCursor: () => events.push(['cursor']),
    _paintDab: () => events.push(['dab']),
    _startPaintStroke: () => events.push(['start']),
    _finishPaintStroke: () => events.push(['finish']),
    _drawRect: (...a) => events.push(['rect', ...a]),
  }
  Object.assign(s, inputMethods)
  return { s, events }
}
function pointer(x, y, extra = {}) {
  return { clientX: x, clientY: y, button: 0, buttons: 1,
    shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...extra }
}

test('CORR01: session-input importa su propio store (sin depender del scope de session.js)', () => {
  assert.match(entry, /import\s*\{\s*store\s*\}\s*from\s*['"]\.\.\/store\.js['"]/) 
  assert.match(entry, /store\.edit\.paint\.active/)
})

test('CORR02: _onMove, _onDown y _onUp permiten selección por clic en tres modos', () => {
  store.edit.paint.active = false
  for (const mode of ['vertex', 'edge', 'face']) {
    const { s, events } = session(mode)
    assert.doesNotThrow(() => s._onMove(pointer(10, 20)))
    assert.doesNotThrow(() => s._onDown(pointer(10, 20)))
    assert.doesNotThrow(() => s._onUp(pointer(10, 20)))
    assert.equal(events.filter(e => e[0] === 'click').length, 1, mode)
    assert.equal(events.some(e => e[0] === 'cursor'), false, mode)
  }
})

test('CORR03: arrastre inicia selección rectangular sin pintura activa', () => {
  store.edit.paint.active = false
  const { s, events } = session()
  s._onDown(pointer(2, 3))
  s._onMove(pointer(14, 24))
  assert.equal(s.down.box, true)
  assert.match(s.svg.innerHTML, /<rect /)
  s._onUp(pointer(14, 24))
  assert.equal(events.at(-1)[0], 'box')
})

test('CORR04: Vertex Paint activo enruta puntero al pincel en vez de selección', () => {
  store.edit.paint.active = true
  try {
    const { s, events } = session()
    s._onMove(pointer(5, 6))
    s._onDown(pointer(5, 6))
    s.paintStroke = { changed: false }
    s._onMove(pointer(8, 9))
    s._onUp(pointer(8, 9))
    assert.deepEqual(events.map(e => e[0]), ['cursor', 'start', 'dab', 'cursor', 'finish'])
    assert.equal(events.some(e => e[0] === 'click'), false)
  } finally { store.edit.paint.active = false }
})

test('CORR05: la navegación en vuelo no inicia una selección', () => {
  store.edit.paint.active = false
  const { s } = session()
  s.vp.isFlying = true
  s._onDown(pointer(3, 4))
  assert.equal(s.down, null)
})
