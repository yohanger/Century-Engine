import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { activateViewportDock } from '../src/core/editor/view-dock-session.js'
import { defaultDockLayout, findDockPanel, focusDockPanel, floatDockPanel, dockPanelIsActive } from '../src/core/editor/docking.js'

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = file('src/App.vue')
const observer = file('src/components/SceneRuntimeObserver.vue')
const cameraTools = file('src/core/editor/camera-tools.js')
const viewBar = file('src/components/ViewBar.vue')

function cameraScope() {
  let source = { obj: { id: 'cam' } }
  const calls = []
  const store = { project: { objects: [], scenes: [], activeSceneId: 'scene', database: {} }, gameView: { noCamera: false } }
  const context = vm.createContext({
    store,
    THREE: {},
    nodeEffectiveActive: () => true,
    sceneGameConfig: () => ({ manager: {}, config: { player: 'none' } }),
    resolveMainCamera: () => source,
    resolveScenePlayerNode: () => null,
    findPlayerCamera: () => null,
    PLAYER_DEFAULTS: { fov: 75 },
    placeCameraNode: (cam, s, fov) => { calls.push({ cam, s, fov }); cam.pose = s.obj.id },
  })
  const text = cameraTools.replace(/^import .*$/gm, '').replace('export const cameraMethods =', 'const cameraMethods =')
  vm.runInContext(`${text}\nglobalThis.cameraMethods = cameraMethods`, context)
  const editor = {
    player: { cam: { clone: () => ({ updateMatrixWorld() { calls.push('matrix') } }) } },
    nodes: new Map(),
    vp: { overlay: { visible: true }, grid: { visible: true }, editorSun: { visible: true }, camera: { id: 'editor' }, dom: { width: 800, height: 600 } },
    ghost: { visible: true },
  }
  Object.assign(editor, context.cameraMethods)
  return { store, calls, editor, setSource: value => { source = value } }
}

test('la cámara de vista previa se resuelve desde la autoridad existente y respeta el aspecto', () => {
  const { store, editor, calls } = cameraScope()
  const cam = editor.getGamePreviewCamera(16 / 9)
  assert.equal(cam.aspect, 16 / 9)
  assert.equal(cam.pose, 'cam')
  assert.equal(store.gameView.noCamera, false)
  assert.equal(calls.length, 2)
  assert.strictEqual(editor.getGamePreviewCamera(4 / 3), cam)
  assert.equal(cam.aspect, 4 / 3)
})

test('una cámara inexistente se informa como ausente sin renderizar otra arbitraria', () => {
  const { store, editor, setSource } = cameraScope()
  setSource(null)
  assert.equal(editor.getGamePreviewCamera(1), null)
  assert.equal(store.gameView.noCamera, true)
  assert.match(observer, /No hay cámara para la vista previa/)
})

test('los visuales editoriales se restauran incluso si falla el render de la vista previa', () => {
  const { editor } = cameraScope()
  const visual = { visible: true }, helper = { visible: true }, originallyHidden = { visible: false }
  editor.nodes.set('node', { _lfNodeOwner: { type: 'camera' }, userData: { visual, editorOnlyVisual: originallyHidden, editorGizmos: [helper] } })
  assert.throws(() => editor.withGamePreviewVisuals(() => {
    assert.equal(editor.vp.overlay.visible, false)
    assert.equal(visual.visible, false)
    assert.equal(helper.visible, false)
    assert.equal(originallyHidden.visible, false)
    throw Error('render')
  }), /render/)
  assert.equal(editor.vp.overlay.visible, true)
  assert.equal(visual.visible, true)
  assert.equal(helper.visible, true)
  assert.equal(originallyHidden.visible, false)
})

test('cambiar el foco en escritorio no llama setGameView ni detiene el juego', () => {
  const calls = []
  const store = {
    project: { id: 'p' }, play: { on: false }, gameView: { on: false },
    ui: { mode: 'desktop', viewTab: 'scene' }, prefs: { dockLayout: defaultDockLayout() },
    editor: { setGameView() { calls.push('preview-global'); return true }, player: { keys: new Set(['KeyW']), input: { clear() { calls.push('input-clear') } } } },
  }
  assert.equal(activateViewportDock(store, 'gameView'), true)
  assert.equal(store.ui.viewTab, 'game')
  assert.equal(calls.length, 0)
  assert.equal(activateViewportDock(store, 'sceneView'), true)
  assert.equal(store.ui.viewTab, 'scene')
  store.play.on = true
  assert.equal(activateViewportDock(store, 'sceneView'), true)
  assert.equal(store.play.on, true)
  assert.deepEqual(calls, ['input-clear'])
  assert.equal(store.editor.player.keys.size, 0)
})

test('si una sesión antigua dejó encendida la vista previa global, se revierte al separar el docking', () => {
  const calls = []
  const store = {
    project: { id: 'p' }, play: { on: false }, gameView: { on: true },
    ui: { mode: 'desktop', viewTab: 'scene' }, prefs: { dockLayout: defaultDockLayout() },
    editor: { setGameView(on) { calls.push(on); store.gameView.on = on; return true } },
  }
  assert.equal(activateViewportDock(store, 'gameView'), true)
  assert.deepEqual(calls, [false])
  assert.equal(store.gameView.on, false)
})

test('la asignación de superficies responde al estado Play y no al foco', () => {
  assert.match(app, /const mainViewId = computed\(\(\) => store\.play\.on \|\| \(mode\.value !== 'desktop' && store\.gameView\.on\)/)
  assert.match(app, /const observerView = computed\(\(\) => mainViewId\.value === 'gameView' \? 'scene' : 'game'\)/)
  assert.match(app, /const observerPanel = computed\(\(\) => observerView\.value === 'scene' \? 'sceneView' : 'gameView'\)/)
  assert.match(app, /<SceneRuntimeObserver :key="observerView" :view="observerView"/)
  assert.doesNotMatch(app, /mainViewId = computed[^\n]*store\.ui\.viewTab/)
  assert.match(observer, /editor\.getGamePreviewCamera\(w \/ h\)/)
  assert.match(observer, /editor\.withGamePreviewVisuals\(\(\) => renderer\.render\(vp\.scene, camera\)\)/)
  assert.match(viewBar, /store\.ui\.mode === 'desktop' \? store\.ui\.viewTab/)
})

test('el observador secundario solo está activo en el panel visible o flotante', () => {
  const prefs = { dockLayout: defaultDockLayout() }
  assert.equal(dockPanelIsActive(prefs.dockLayout, prefs, 'gameView'), false)
  prefs.dockLayout = focusDockPanel(prefs.dockLayout, 'gameView')
  assert.equal(dockPanelIsActive(prefs.dockLayout, prefs, 'gameView'), true)
  prefs.dockLayout = floatDockPanel(prefs.dockLayout, 'sceneView')
  assert.equal(findDockPanel(prefs.dockLayout, 'sceneView').kind, 'float')
  assert.equal(dockPanelIsActive(prefs.dockLayout, prefs, 'sceneView'), true)
  assert.match(app, /dockPanelIsActive\(store\.prefs\.dockLayout, store\.prefs, observerPanel\.value\)/)
})

test('las dos variantes conservan reglas distintas de input y diagnóstico', () => {
  assert.match(observer, /const isGamePreview = props\.view === 'game'/)
  assert.match(observer, /controls\.enabled = !isGamePreview/)
  assert.match(observer, /if \(!isGamePreview && store\.play\.on\) useEditorGizmos\(true\)/)
  assert.match(observer, /v-if="enabled && !isGamePreview"/)
  assert.match(observer, /isGamePreview \? 'gameView' : 'sceneView'/)
  assert.match(observer, /renderer\.domElement\.style\.pointerEvents = 'none'/)
  assert.match(observer, /renderer\.domElement\.style\.width = `\$\{w\}px`/)
})
