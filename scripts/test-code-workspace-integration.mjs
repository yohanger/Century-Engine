import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  REQUIRED_DOCK_VIEWS, defaultDockLayout, normalizeDockLayout, findDockPanel,
  hideDockPanel, moveDockPanel, floatDockPanel, restoreDockPanel, dockGroups, dockPanelAvailable,
} from '../src/core/editor/docking.js'
import { activateCodeDock, activateViewportDock } from '../src/core/editor/view-dock-session.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const state = (scripts = []) => ({
  ui: { mode: 'desktop', viewTab: 'scene' },
  project: { scripts }, locked: false,
  scriptEditId: null,
  play: { on: false }, gameView: { on: false },
  editor: { setGameView: () => true, player: { keys: new Set(), input: new Set() } },
  prefs: { dockLayout: defaultDockLayout() },
})

test('Code es vista central permanente y no duplica el editor', () => {
  const layout = defaultDockLayout()
  assert.deepEqual(REQUIRED_DOCK_VIEWS, ['sceneView', 'gameView', 'codeView'])
  assert.deepEqual(layout.zones.center.tabs, ['sceneView', 'gameView', 'codeView'])
  assert.equal(findDockPanel(layout, 'codeView').zone, 'center')
  assert.equal(dockPanelAvailable('codeView', { scriptEditId: null }), true)
  assert.equal(dockPanelAvailable('scriptEditor', { scriptEditId: 'abc' }), false)
  assert.equal(dockGroups(layout.zones.center).flatMap(g => g.tabs).filter(id => id === 'codeView').length, 1)
})

test('layouts previos conservan distribución y reciben Code una sola vez', () => {
  const old = defaultDockLayout()
  old.zones.center.tabs = ['sceneView', 'gameView']
  old.hidden.push('scriptEditor')
  delete old.zones.bottom.active
  const result = normalizeDockLayout(old)
  assert.equal(findDockPanel(result, 'codeView').kind, 'dock')
  assert.equal(findDockPanel(result, 'scriptEditor'), null)
  assert.equal(findDockPanel(result, 'hierarchy').zone, 'left')
  assert.equal(findDockPanel(result, 'project').zone, 'bottom')
  assert.equal(result.zones.center.tabs.filter(id => id === 'codeView').length, 1)
  assert.deepEqual(normalizeDockLayout(result), result)
})

test('Code puede dividirse, desacoplarse y regresar sin perder las demás vistas', () => {
  let layout = moveDockPanel(defaultDockLayout(), 'codeView', 'center', 'lf-dock-center', 'right')
  assert.equal(layout.zones.center.type, 'split')
  assert.equal(findDockPanel(layout, 'sceneView').kind, 'dock')
  assert.equal(findDockPanel(layout, 'gameView').kind, 'dock')
  layout = floatDockPanel(layout, 'codeView', { x: 20, y: 90, w: 850, h: 620 })
  assert.equal(findDockPanel(layout, 'codeView').kind, 'float')
  assert.deepEqual(hideDockPanel(layout, 'codeView'), layout)
  layout = restoreDockPanel(layout, 'codeView')
  assert.equal(findDockPanel(layout, 'codeView').zone, 'center')
  assert.equal(moveDockPanel(layout, 'codeView', 'left'), layout)
  assert.deepEqual(normalizeDockLayout(layout), layout)
})

test('seleccionar Code sin scripts mantiene el proyecto sin cambios', () => {
  const s = state()
  assert.equal(activateCodeDock(s), true)
  assert.equal(s.ui.viewTab, 'code')
  assert.equal(s.scriptEditId, null)
  assert.equal(s.project.scripts.length, 0)
  assert.equal(findDockPanel(s.prefs.dockLayout, 'codeView').active, true)
  assert.equal(s.gameView.on, false)
})

test('seleccionar Code con scripts existentes conserva o selecciona el documento autoritativo', () => {
  const s = state([{ id: 'a', code: 'hello' }, { id: 'b', code: 'world' }])
  assert.equal(activateCodeDock(s), true)
  assert.equal(s.scriptEditId, 'a')
  s.scriptEditId = 'b'
  activateCodeDock(s)
  assert.equal(s.scriptEditId, 'b')
  assert.equal(s.project.scripts[1].code, 'world')
})

test('Code conserva la simulación al cambiar foco durante Play', () => {
  const s = state([{ id: 'a' }])
  s.play.on = true
  s.editor.player.keys.add('KeyW')
  s.editor.player.input.add('move')
  activateCodeDock(s)
  assert.equal(s.play.on, true)
  assert.equal(s.ui.viewTab, 'code')
  assert.equal(s.editor.player.keys.size, 0)
  assert.equal(s.editor.player.input.size, 0)
  activateViewportDock(s, 'sceneView')
  assert.equal(s.ui.viewTab, 'scene')
  assert.equal(s.play.on, true)
  activateViewportDock(s, 'gameView')
  assert.equal(s.ui.viewTab, 'game')
  assert.equal(s.scriptEditId, 'a')
})

test('la apertura desde Proyecto, Inspector y Señales converge en la misma función', () => {
  const db = read('src/core/state/database.js')
  assert.match(db, /export function openScriptEditor\(id/)
  assert.match(db, /store\.scriptEditId = id/)
  assert.match(db, /activateCodeDock\(store\)/)
  assert.doesNotMatch(db, /focusNativeTool\('code'\)/)
  assert.match(read('src/components/ProjectPanel.vue'), /if \(it.kind === 'script'\) return openScriptEditor\(it.id\)/)
  assert.match(read('src/components/Inspector.vue'), /@click="openScriptEditor\(id\)"/)
  assert.match(read('src/components/SignalConnectionsPanel.vue'), /openScriptEditor\(result.scriptId\)/)
})

test('la barra superior y las pestañas usan una autoridad de selección', () => {
  const toolbar = read('src/components/Toolbar.vue')
  const tabs = read('src/components/DockTree.vue')
  assert.match(toolbar, /@click="chooseToolbarView\('codeView'\)">Code<\/button>/)
  assert.match(tabs, /if \(id === 'codeView'\) \{ activateCodeDock\(store\); return \}/)
  assert.match(tabs, /:aria-selected="active === id"/)
  assert.match(read('src/App.vue'), /id === 'codeView'\) activateCodeDock\(store\)/)
})

test('CodeMirror sigue siendo único y la ventana Electron se abre solo a petición', () => {
  const script = read('src/components/ScriptEditor.vue')
  const app = read('src/App.vue')
  const frame = read('src/components/FloatingEditorWindow.vue')
  assert.equal((script.match(/new EditorView\(/g) || []).length, 2)
  assert.match(script, /old\.destroy\(\)/)
  assert.match(script, /state = old.state/)
  assert.match(script, /dock-panel-id="codeView"/)
  assert.match(script, /native-tool="code" :native-on-demand="true"/)
  assert.match(script, /case 'vscode': if \(sc.value\) openInVSCode\(sc.value.id\)/)
  assert.match(script, /setScriptCode\(sc\.value\.id, code\.value\)/)
  assert.equal((app.match(/<ScriptEditor v-if=/g) || []).length, 1)
  assert.match(frame, /mountedDockTarget = useMountedDockTarget/)
  assert.match(read('src/core/editor/native-tool-window.js'), /await nextTick\(\)[\s\S]*resolveViewportDockTarget\(document, selector\(\), fallback\(\)\)/)
  assert.match(read('src/core/editor/view-dock-session.js'), /target\?\.isConnected/)
  assert.match(frame, /v-if="closable"/)
  assert.match(script, /:closable="store\.ui\.mode !== 'desktop'"/)
})

test('Code sigue operativo en un proyecto sin scripts y preserva guardado', () => {
  const editor = read('src/components/ScriptEditor.vue')
  assert.match(editor, /class="edwin se" :class="\{ 'se-welcome-shell': !sc \}"/)
  assert.match(editor, /class="se-welcome"/)
  assert.match(editor, /function createAndOpenScript\(\)/)
  assert.match(editor, /if \(script\) openScriptEditor\(script\.id\)/)
  assert.match(editor, /function save\(\) \{ void saveAll\(\) \}/)
  assert.match(editor, /editor\?\.requestMeasure\(\)/)
})
