import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VIEW_MODES } from '../src/engine/runtime/render/view-diagnostics-contract.js'

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const viewport = read('src/engine/runtime/render/viewport.js')
const look = read('src/engine/runtime/render/look.js')
const diagnostics = read('src/engine/runtime/render/view-diagnostics.js')
const gizmo = read('src/core/editor/gizmo.js')

const body = viewport.split('  drawEditorOverlay(visibility = null) {')[1]?.split('\n  }\n\n  _draw()')[0]
assert.ok(body, 'Debe existir una pasada editorial reutilizable en Viewport')
const draw = new Function('THREE', `return function drawEditorOverlay(visibility = null) {${body}\n}`)({ NoToneMapping: 'neutral' })

function fixture({ overlayVisible = true, gridVisible = true, boltVisible = false, overlayChildren = 2, target = null, throwRender = false } = {}) {
  const world = { name: 'world', visible: true }
  const sky = { name: 'sky', visible: true }
  const light = { name: 'light', visible: true }
  const overlay = { name: 'overlay', visible: overlayVisible, children: Array(overlayChildren).fill({ visible: true }) }
  const grid = { name: 'grid', visible: gridVisible }
  const bolt = { name: 'bolt', visible: boltVisible }
  const scene = { children: [world, overlay, sky, grid, bolt, light], background: 'background' }
  const before = scene.children.map(obj => [obj, obj.visible])
  const calls = []
  const renderer = {
    autoClear: true, toneMapping: 'lit-tonemap',
    getRenderTarget: () => target,
    setRenderTarget: (next) => { calls.push(['target', next]) },
    clearDepth: () => calls.push(['clear-depth']),
    render: (s, c) => {
      calls.push(['render', { background: s.background, autoClear: renderer.autoClear,
        toneMapping: renderer.toneMapping, children: s.children.filter(o => o.visible).map(o => o.name), camera: c }])
      if (throwRender) throw Error('GPU failure')
    },
  }
  const vp = { scene, overlay, grid, bolt: { mesh: bolt }, camera: { id: 'editor-camera' }, renderer, drawEditorOverlay: draw }
  return { vp, calls, before, renderer, scene, overlay, grid, bolt, world, light, sky }
}

test('VG01 · overlay de edición se dibuja tras diagnóstico sin repintar mundo, cielo ni luces', () => {
  const f = fixture()
  assert.equal(f.vp.drawEditorOverlay(), true)
  assert.deepEqual(f.calls.map(x => x[0]), ['clear-depth', 'render'])
  assert.deepEqual(f.calls[1][1].children, ['overlay', 'grid'])
  assert.equal(f.calls[1][1].background, null)
  assert.equal(f.calls[1][1].autoClear, false)
  assert.equal(f.calls[1][1].toneMapping, 'neutral')
  assert.equal(f.calls[1][1].camera, f.vp.camera)
  assert.deepEqual(f.scene.children.map(o => [o, o.visible]), f.before)
  assert.equal(f.scene.background, 'background')
  assert.equal(f.renderer.autoClear, true)
  assert.equal(f.renderer.toneMapping, 'lit-tonemap')
})

test('VG02 · respeta Mostrar gizmos: overlay oculto y grid oculto no generan pasadas', () => {
  const f = fixture({ overlayVisible: false, gridVisible: false })
  assert.equal(f.vp.drawEditorOverlay(), false)
  assert.deepEqual(f.calls, [])
})

test('VG03 · no repite trabajo si no hay herramientas activas', () => {
  const f = fixture({ overlayChildren: 0, gridVisible: false })
  assert.equal(f.vp.drawEditorOverlay(), false)
  assert.deepEqual(f.calls, [])
})

test('VG04 · cuadrícula se conserva aunque el overlay esté oculto', () => {
  const f = fixture({ overlayVisible: false, gridVisible: true })
  assert.equal(f.vp.drawEditorOverlay(), true)
  assert.deepEqual(f.calls.at(-1)[1].children, ['grid'])
})

test('VG05 · render target original se restituye al terminar la pasada', () => {
  const target = { name: 'offscreen' }, f = fixture({ target })
  assert.equal(f.vp.drawEditorOverlay(), true)
  assert.deepEqual(f.calls.filter(x => x[0] === 'target'), [['target', null], ['target', target]])
})

test('VG06 · una excepción de GPU restaura visibilidad, fondo, tono y target', () => {
  const target = { name: 'offscreen' }, f = fixture({ target, throwRender: true })
  assert.throws(() => f.vp.drawEditorOverlay(), /GPU failure/)
  assert.deepEqual(f.scene.children.map(o => [o, o.visible]), f.before)
  assert.equal(f.scene.background, 'background')
  assert.equal(f.renderer.autoClear, true)
  assert.equal(f.renderer.toneMapping, 'lit-tonemap')
  assert.deepEqual(f.calls.filter(x => x[0] === 'target'), [['target', null], ['target', target]])
})

test('VG07 · comparte el mismo dibujado con el compositor Lit sin duplicar gizmos', () => {
  assert.match(look, /vp\.drawEditorOverlay\(vis\)/)
  assert.doesNotMatch(look, /const hadOverlay =/)
  const f = fixture({ gridVisible: false })
  const remembered = f.scene.children.map(o => [o, o.visible])
  f.overlay.visible = false
  assert.equal(f.vp.drawEditorOverlay(remembered), true)
  assert.deepEqual(f.calls.at(-1)[1].children, ['overlay'])
  assert.deepEqual(f.scene.children.map(o => [o, o.visible]), remembered)
})

test('VG08 · todos los diagnósticos compatibles llaman overlay después de restaurar materiales', () => {
  assert.match(viewport, /if \(supported\) \{\s*this\.viewDiagnostics\.draw\(this\.viewMode\)\s*this\.drawEditorOverlay\(\)/)
  assert.match(viewport, /else \{\s*this\.viewDiagnostics\.draw\(this\.viewMode\)[^\n]*\n\s*this\.look\.render\(0\)/)
  assert.ok(VIEW_MODES.length > 10)
  for (const mode of VIEW_MODES) assert.ok(mode.id)
  assert.match(diagnostics, /for \(const \[obj, material\] of saved\) obj\.material = material/)
  assert.match(diagnostics, /for \(const \[o, visible\] of invisible\.reverse\(\)\) o\.visible = visible/)
})

test('VG09 · selección y TransformControls mantienen el overlay existente', () => {
  assert.match(gizmo, /this\.vp\.overlay\.add\(t\.getHelper\(\)\)/)
  assert.match(gizmo, /t\.addEventListener\('objectChange'/)
  assert.match(gizmo, /t\.addEventListener\('mouseUp'/)
  assert.doesNotMatch(viewport, /viewMode === 'lit'\s*\?\s*this\.drawEditorOverlay/)
})

test('VG10 · las métricas diagnósticas se toman antes de la pasada editorial', () => {
  const segment = viewport.split('if (editorDiagnostic) {')[1].split('} else {')[0]
  assert.ok(segment.indexOf('this.viewDiagnostics.draw(this.viewMode)') < segment.indexOf('this.drawEditorOverlay()'))
  assert.match(viewport, /pf\.stats\.extra\.viewDiagnostics = \{ \.\.\.d \}/)
})
