import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultDockLayout, findDockPanel, floatDockPanel, restoreDockPanel, REQUIRED_DOCK_VIEWS } from '../src/core/editor/docking.js'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const tree = read('src/components/DockTree.vue')
const frame = read('src/components/FloatingEditorWindow.vue')
const native = read('src/core/editor/native-tool-window.js')
const main = read('electron/main.cjs')
const editor = read('src/components/ScriptEditor.vue')
const focus = read('src/core/editor/view-dock-session.js')

test('Code permanece obligatorio dentro del docking y puede regresar de un flotante anterior', () => {
  assert.ok(REQUIRED_DOCK_VIEWS.includes('codeView'))
  const layout = floatDockPanel(defaultDockLayout(), 'codeView')
  assert.equal(findDockPanel(layout, 'codeView')?.kind, 'float')
  assert.equal(findDockPanel(restoreDockPanel(layout, 'codeView'), 'codeView')?.kind, 'dock')
  assert.match(frame, /if \(location\.value\?\.kind === 'float'\) store\.prefs\.dockLayout = restoreDockPanel\(store\.prefs\.dockLayout, 'codeView'\)/)
})

test('arrastrar Code fuera del docking solicita ventana nativa sin botón específico', () => {
  assert.match(tree, /startDockGesture/)
  assert.match(read('src/core/editor/dock-gesture.js'), /releaseNative\(entry, event\)/)
  assert.match(read('src/core/editor/native-dock.js'), /century:dock-\$\{action\}/)
  assert.doesNotMatch(tree, /aria-label="Desacoplar/)
  assert.doesNotMatch(tree, /Desacoplar Code en Electron/)
  assert.match(frame, /window\.addEventListener\('century:code-detach', openNative\)/)
  assert.match(frame, /window\.removeEventListener\('century:code-detach', openNative\)/)
})

test('Code no ofrece el conmutador a flotante CSS de las otras herramientas', () => {
  assert.match(frame, /if \(props\.dockPanelId === 'codeView'\) return/)
  assert.doesNotMatch(frame, /@click="toggleWorkspaceDock"/)
  assert.match(frame, /openNative\(\)/)
  assert.match(frame, /attachNative\(\)/)
  assert.doesNotMatch(frame, /@click="openNative"/)
})

test('Electron crea Code como ventana de sistema independiente y no modal', () => {
  assert.match(main, /did-create-window', \(tool, details\)/)
  assert.match(main, /tool\.setParentWindow\(null\)/)
  assert.match(main, /modal: false/)
  assert.match(main, /minWidth: 340/)
  assert.match(native, /window\.open\('about:blank', `lf-tool-\$\{name\}`/)
})

test('la ventana nativa no usa el rol de diálogo de los flotantes CSS', () => {
  assert.match(frame, /:role="isDocked \|\| nativeTarget \? 'region' : 'dialog'"/)
  assert.match(frame, /!isDocked && !nativeTarget \? 'false' : undefined/)
  assert.match(frame, /class="native-code-tab" draggable="true"[^>]*@dragstart="startNativeDockTransfer"/)
  assert.doesNotMatch(frame, /@click="returnNative"/)
})

test('las acciones del encabezado llegan al extremo derecho sin tapar la barra de menús', () => {
  assert.match(frame, /\.code-docked \.floating-editor-chrome\.integrated \{ position:absolute; right:2px;/)
  assert.match(frame, /\.code-docked :deep\(\.se-commands\) \{ padding-right:36px; \}/)
  assert.match(frame, /\.native-code-tab \{ display:inline-flex;/)
  assert.match(editor, /\.se-commands \{ padding-right:3px; padding-left:5px;/)
})

test('en Code externo el foco no reabre el panel vacío del editor principal', () => {
  assert.match(focus, /if \(store\.ui\.codeNativeOpen && focusNativeTool\('code'\)\) return true/)
  assert.match(frame, /activateViewportDock\(store, 'sceneView'\)/)
  assert.match(editor, /!store\.ui\.codeNativeOpen && store\.ui\.viewTab !== 'code'/)
  assert.doesNotMatch(focus, /store\.play\.on = false/)
})

test('cambio de documento conserva EditorState sin un segundo editor activo', () => {
  assert.match(editor, /const state = old\.state/)
  assert.match(editor, /old\.destroy\(\)/)
  assert.match(editor, /new EditorView\(\{ parent: host, root: editorRoot, state \}\)/)
  assert.match(editor, /editor\.scrollDOM\.scrollTop = scrollTop/)
  assert.match(frame, /store\.ui\.codeNativeOpen = !!target/)
})
