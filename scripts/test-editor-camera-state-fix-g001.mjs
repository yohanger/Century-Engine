import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EditorCameraViews } from '../src/core/state/editor-camera-views.js'

function fakeEditor() {
  const state = { x: 10, target: 0, ortho: false }
  return { state, vp: {
    persp: { position: { set(x) { state.x = x } } },
    controls: { target: { set(x) { state.target = x }, }, update() {} },
    setOrtho(v) { state.ortho = v },
    saveEditorView() { return { ...state } },
    restoreEditorView(s) { Object.assign(state, s) },
  } }
}
test('CAM-INT-01 · A/B/A/B conserva vistas independientes', () => {
  const e = fakeEditor(), cache = new EditorCameraViews()
  cache.beginProject('P1', e)
  e.state.x = 25; e.state.target = 5
  cache.capture('P1', 'A', e)
  cache.restore('P1', 'B', e)
  assert.equal(e.state.x, 0)
  e.state.x = 99; e.state.target = 12
  cache.capture('P1', 'B', e)
  cache.restore('P1', 'A', e)
  assert.deepEqual([e.state.x, e.state.target], [25, 5])
  cache.restore('P1', 'B', e)
  assert.deepEqual([e.state.x, e.state.target], [99, 12])
})
test('CAM-INT-02 · proyectos separados y eliminación', () => {
  const e = fakeEditor(), cache = new EditorCameraViews()
  cache.beginProject('P1', e); e.state.x = 99; cache.capture('P1', 'A', e)
  cache.beginProject('P2', e); cache.restore('P2', 'A', e)
  assert.equal(e.state.x, 0)
  e.state.x = 4; cache.capture('P2', 'A', e); cache.forget('P2', 'A'); cache.restore('P2', 'A', e)
  assert.equal(e.state.x, 0)
})
test('CAM-INT-03 · integración captura antes de await y restaura tras reset', () => {
  const source = readFileSync(new URL('../src/core/state/project.js', import.meta.url), 'utf8')
  const sw = source.slice(source.indexOf('export async function switchScene'), source.indexOf('export async function addScene'))
  assert.ok(sw.indexOf('editorCameraViews.capture') < sw.indexOf('await saveNow'))
  assert.ok(sw.indexOf('editorCameraViews.restore') > sw.indexOf('resetSceneState({ frame: false })'))
  assert.match(sw, /finally\s*\{\s*sceneTransition = false/)
})
