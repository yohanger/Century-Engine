import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  defaultDockLayout, normalizeDockLayout, dockGroups, findDockPanel,
  hideDockPanel, floatDockPanel, moveDockPanel, restoreDockPanel,
  REQUIRED_DOCK_VIEWS, DEFAULT_DOCK_PANELS,
} from '../src/core/editor/docking.js'

const source = relative => readFileSync(new URL('../' + relative, import.meta.url), 'utf8')

test('la distribución inicial abre solo las cuatro herramientas auxiliares y ambas vistas', () => {
  const layout = defaultDockLayout()
  assert.deepEqual(DEFAULT_DOCK_PANELS, ['sceneView', 'gameView', 'hierarchy', 'project', 'object', 'console'])
  const opened = Object.values(layout.zones).flatMap(dockGroups).flatMap(node => node.tabs)
  assert.deepEqual(new Set(opened), new Set(DEFAULT_DOCK_PANELS))
  assert.equal(layout.hidden.includes('timeline'), true)
  assert.equal(layout.hidden.includes('signals'), true)
  assert.equal(layout.hidden.includes('paint'), true)
})

test('los auxiliares se pueden ocultar y restaurar sin eliminar el resto del layout', () => {
  let layout = defaultDockLayout()
  for (const id of ['hierarchy', 'project', 'object', 'console']) {
    layout = hideDockPanel(layout, id)
    assert.equal(findDockPanel(layout, id)?.kind, 'hidden')
    layout = restoreDockPanel(layout, id)
    assert.equal(findDockPanel(layout, id)?.kind, 'dock')
  }
  assert.equal(findDockPanel(layout, 'sceneView')?.kind, 'dock')
  assert.equal(findDockPanel(layout, 'gameView')?.kind, 'dock')
})

test('las vistas pueden flotar o dividirse pero nunca ocultarse', () => {
  let layout = defaultDockLayout()
  for (const id of REQUIRED_DOCK_VIEWS) {
    assert.strictEqual(hideDockPanel(layout, id), layout)
    layout = floatDockPanel(layout, id)
    assert.equal(findDockPanel(layout, id)?.kind, 'float')
    layout = restoreDockPanel(layout, id)
  }
  layout = moveDockPanel(layout, 'gameView', 'center', 'lf-dock-center', 'right')
  assert.equal(dockGroups(layout.zones.center).length, 2)
})

test('restauración: un layout guardado no puede ocultar Edit Mode ni Play Mode', () => {
  const layout = defaultDockLayout()
  layout.zones.center = null
  layout.hidden.push('gameView', 'sceneView')
  const repaired = normalizeDockLayout(layout)
  for (const id of REQUIRED_DOCK_VIEWS) {
    assert.equal(findDockPanel(repaired, id)?.zone, 'center')
    assert.equal(repaired.hidden.includes(id), false)
  }
  assert.equal(dockGroups(repaired.zones.center).length, 1)
})

test('restauración: las vistas forzadas a una zona auxiliar regresan al centro', () => {
  const layout = defaultDockLayout()
  layout.zones.left.tabs.push('sceneView')
  layout.zones.center.tabs = ['gameView']
  const repaired = normalizeDockLayout(layout)
  assert.equal(findDockPanel(repaired, 'sceneView')?.zone, 'center')
  assert.equal(repaired.zones.left.tabs.includes('sceneView'), false)
})

test('las distribuciones históricas personalizadas preservan pestañas abiertas y ventanas flotantes', () => {
  let layout = defaultDockLayout()
  layout = moveDockPanel(layout, 'signals', 'right')
  layout = floatDockPanel(layout, 'timeline', { x: 300, y: 240, w: 700, h: 500 })
  const restored = normalizeDockLayout(layout)
  assert.deepEqual(restored, layout)
  assert.equal(findDockPanel(restored, 'signals')?.kind, 'dock')
  assert.equal(findDockPanel(restored, 'timeline')?.kind, 'float')
})

test('edición y observación de Play comparten herramientas, no crean una segunda sesión de juego', () => {
  const observer = source('src/components/SceneRuntimeObserver.vue')
  const selection = source('src/core/editor/selection.js')
  const game = source('src/core/editor/play-session.js')
  const occlusion = source('src/engine/runtime/render/camera-occlusion.js')
  assert.match(observer, /control\.disconnect\(\)/)
  assert.match(observer, /control\.connect\(connect \? renderer\.domElement : editor\.dom\)/)
  assert.match(observer, /drawEditorScene\(editor,/)
  assert.match(observer, /playerCameraFrustum\(vpCamera/)
  assert.match(observer, /outsidePlayerFrustum\(vp\.world/)
  assert.match(observer, /vp\.occlusion\.draw\(vpCamera/)
  assert.match(occlusion, /this\.lastReason = reason \|\| ''/)
  assert.doesNotMatch(observer, /new\s+PlayMode\s*\(/)
  assert.doesNotMatch(game, /selectObject\(null\)/)
  assert.match(selection, /store\.play\.on \? 'box'/)
})

test('el cierre de ventanas flotantes oculta auxiliares y reacopla vistas obligatorias', () => {
  const floating = source('src/components/DockFloating.vue')
  assert.match(floating, /function close\(\)/)
  assert.match(floating, /hideDockPanel/)
  assert.match(floating, /if \(\['sceneView', 'gameView'\]\.includes\(props\.item\.id\)\) dock\(\)/)
  assert.match(floating, /@close="close"/)
})
