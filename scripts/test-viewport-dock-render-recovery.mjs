import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultDockLayout, findDockPanel, focusDockPanel, floatDockPanel, moveDockPanel } from '../src/core/editor/docking.js'
import { resolveViewportDockTarget, recoverViewportDrawing } from '../src/core/editor/view-dock-session.js'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const target = (id, connected = true) => ({ id, isConnected: connected })
const root = entries => ({ querySelector: selector => entries.get(selector) || null })

test('el destino de un Teleport se recupera después de reconstruir un grupo', () => {
  const fallback = target('lf-viewport-fallback')
  let live = target('lf-dock-target-lf-dock-center-sceneView')
  const entries = new Map([['#lf-viewport-fallback', fallback], ['#lf-dock-target-lf-dock-center-sceneView', live]])
  const document = root(entries)
  assert.equal(resolveViewportDockTarget(document, '#lf-dock-target-lf-dock-center-sceneView', '#lf-viewport-fallback'), live)
  live.isConnected = false
  assert.equal(resolveViewportDockTarget(document, '#lf-dock-target-lf-dock-center-sceneView', '#lf-viewport-fallback'), fallback)
  live = target('lf-dock-target-lf-dock-center-sceneView')
  entries.set('#lf-dock-target-lf-dock-center-sceneView', live)
  assert.equal(resolveViewportDockTarget(document, '#lf-dock-target-lf-dock-center-sceneView', '#lf-viewport-fallback'), live)
  assert.equal(resolveViewportDockTarget(document, '#lf-dock-target-lf-dock-center-gameView'), null)
})

test('la recuperación redimensiona y dibuja sin reinstanciar renderer ni sesión Play', () => {
  const calls = []
  const host = { isConnected: true, clientWidth: 720, clientHeight: 405 }
  const vp = { container: host, resize() { calls.push('resize') }, requestRender() { calls.push('draw') } }
  const editor = { vp, player: { session: {} } }
  assert.equal(recoverViewportDrawing(editor, host), true)
  assert.deepEqual(calls, ['resize', 'draw'])
  assert.equal(editor.vp, vp)
  assert.deepEqual(editor.player.session, {})
})

test('no dibujar sobre targets desmontados, de tamaño nulo ni ajenos', () => {
  let renders = 0
  const host = { isConnected: false, clientWidth: 480, clientHeight: 400 }
  const editor = { vp: { container: host, resize() { renders++ }, requestRender() { renders++ } } }
  assert.equal(recoverViewportDrawing(editor, host), false)
  host.isConnected = true
  host.clientWidth = 0
  assert.equal(recoverViewportDrawing(editor, host), false)
  host.clientWidth = 480
  assert.equal(recoverViewportDrawing(editor, {}), false)
  assert.equal(recoverViewportDrawing(null, host), false)
  assert.equal(renders, 0)
})

test('los destinos del docking siguen resolviendo tras foco, flotación y división', () => {
  let layout = defaultDockLayout()
  assert.equal(findDockPanel(layout, 'sceneView').active, true)
  layout = focusDockPanel(layout, 'gameView')
  assert.equal(findDockPanel(layout, 'gameView').active, true)
  layout = floatDockPanel(layout, 'sceneView')
  assert.equal(findDockPanel(layout, 'sceneView').kind, 'float')
  layout = moveDockPanel(layout, 'gameView', 'center', 'lf-dock-center', 'right')
  assert.equal(findDockPanel(layout, 'gameView').kind, 'dock')
})

test('el canvas conserva fallback montado y espera al DOM para resolver targets', () => {
  const app = source('src/App.vue')
  assert.match(app, /<div id="lf-viewport-fallback" v-show=/)
  assert.match(app, /<Teleport :to="mainTeleportTo" defer>/)
  assert.match(app, /await nextTick\(\)[\s\S]*resolveViewportDockTarget\(document, mainViewTarget\.value/)
  assert.match(app, /<Teleport v-if="observerDockReady" :to="observerDock\.target" defer>/)
  assert.match(app, /observerDock\.value\?\.view === observerView\.value/)
  assert.match(app, /recoverViewportDrawing\(editor, host\.value\)/)
  assert.match(app, /window\.addEventListener\('focus', onViewportReturn\)/)
  assert.match(app, /document\.addEventListener\('visibilitychange', onViewportReturn\)/)
})
