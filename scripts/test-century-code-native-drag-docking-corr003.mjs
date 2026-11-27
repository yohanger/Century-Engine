import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultDockLayout, dockGroups, findDockPanel, moveDockPanel, normalizeDockLayout, REQUIRED_DOCK_VIEWS } from '../src/core/editor/docking.js'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const tree = read('src/components/DockTree.vue')
const frame = read('src/components/FloatingEditorWindow.vue')
const app = read('src/App.vue')
const native = read('src/core/editor/native-tool-window.js')
const main = read('electron/main.cjs')
const focus = read('src/core/editor/view-dock-session.js')
const toolbar = read('src/components/Toolbar.vue')

test('Code sigue siendo una pestaña obligatoria adyacente a Edit y Play', () => {
  const layout = defaultDockLayout()
  assert.deepEqual(dockGroups(layout.zones.center)[0].tabs, ['sceneView', 'gameView', 'codeView'])
  assert.ok(REQUIRED_DOCK_VIEWS.includes('codeView'))
  assert.deepEqual(findDockPanel(normalizeDockLayout(layout), 'codeView')?.kind, 'dock')
})

test('desacoplar Code ocurre al arrastrar la pestaña fuera del editor', () => {
  assert.match(tree, /startDockGesture/)
  assert.match(read('src/core/editor/dock-gesture.js'), /releaseNative\(entry, event\)/)
  assert.match(read('src/core/editor/dock-gesture.js'), /window\.lf\?\.isElectron/)
  assert.match(frame, /addEventListener\('century:code-detach', openNative\)/)
})

test('Code no muestra un botón específico de desacoplar ni de volver a acoplar', () => {
  assert.doesNotMatch(tree, /aria-label="Desacoplar/)
  assert.doesNotMatch(tree, /Desacoplar Code en Electron/)
  assert.doesNotMatch(frame, /@click="openNative"|@click="returnNative"/)
  assert.doesNotMatch(frame, /class="floating-editor-action native-return"/)
})

test('el título de la ventana nativa inicia un arrastre compatible con los grupos del docking', () => {
  assert.match(frame, /class="native-code-tab" draggable="true"[^>]*@dragstart="startNativeDockTransfer"/)
  assert.match(frame, /@pointerdown="nativeTitleDown"/)
  assert.match(frame, /startDockGesture\(event, props\.dockPanelId, store, true\)/)
  assert.match(frame, /\.native-code-tab \{[^}]*-webkit-app-region:no-drag/)
  assert.match(frame, /\.native-tool-title \{[\s\S]*?-webkit-app-region: drag/)
  assert.match(tree, /hasDockDrag\(event\)/)
})

test('al soltar el título nativo en el docking se solicita devolver la misma vista', () => {
  assert.match(tree, /notifyNativeDock\(id, 'attach'\)/)
  assert.match(app, /notifyNativeDock\(id, 'attach'\)/)
  assert.match(frame, /addEventListener\('century:code-attach', attachNative\)/)
  assert.match(frame, /nativeRequested\.value = false\s*await nextTick\(\)/)
  assert.match(frame, /!nativeTarget\.value && props\.dockPanelId === 'codeView'/)
})

test('organizar Code dentro del viewport central admite pestaña o división', () => {
  const base = defaultDockLayout()
  const group = dockGroups(base.zones.center)[0]
  const split = moveDockPanel(base, 'codeView', 'center', group.id, 'right')
  assert.equal(split.zones.center.type, 'split')
  assert.deepEqual(dockGroups(split.zones.center).flatMap(g=>g.tabs).sort(), ['sceneView','gameView','codeView'].sort())
  assert.equal(findDockPanel(split,'codeView')?.kind,'dock')
  assert.match(app, /moveDockPanel\(store\.prefs\.dockLayout, id, 'center', group\?\.id, zone\)/)
})

test('ventana Electron independiente y no modal, sin segunda instancia de Code', () => {
  assert.match(main, /tool\.setParentWindow\(null\)/)
  assert.match(main, /modal: false/)
  assert.match(native, /target\.value = doc\.body/)
  assert.match(frame, /const teleportTo = computed\(\(\) => nativeTarget\.value/)
  assert.match(frame, /:role="isDocked \|\| nativeTarget \? 'region' : 'dialog'"/)
})

test('al cerrar la ventana externa retorna Code sin pérdida de la autoridad del store', () => {
  assert.match(native, /popup\.addEventListener\('pagehide', closed, \{ once: true \}\)/)
  assert.match(native, /target\.value = null/)
  assert.match(frame, /if \(props\.nativeOnDemand\) \{ nativeRequested\.value = false/)
  assert.match(frame, /store\.ui\.codeNativeOpen = !!target/)
})

test('sin iconos adicionales Code conserva maximizar y espacio de comandos', () => {
  assert.match(frame, /:aria-label="maximized \? 'Restaurar Code' : 'Maximizar Code'"/)
  assert.match(frame, /\.code-docked :deep\(\.se-commands\) \{ padding-right:36px; \}/)
})

import { runInNewContext } from 'node:vm'

function extractFunction(source, name, nextMarker) {
  const from = source.indexOf(`function ${name}(`)
  const to = source.indexOf(nextMarker, from)
  assert.ok(from >= 0 && to > from, name)
  return source.slice(from, to)
}

test('la salida de Code no abre ventana tras un drop interno ni fuera de Electron', () => {
  const source = focus.slice(focus.indexOf('export function detachCodeFromDrag(')).replace('export function ', 'function ')
  let detaches = 0
  const context = {
    window: { lf: { isElectron: true }, innerWidth: 1000, innerHeight: 700, dispatchEvent() { detaches++ } },
    Event: class { constructor(type) { this.type = type } },
  }
  runInNewContext(source + '\nthis.run = detachCodeFromDrag', context)
  const ev = (effect, clientX, clientY) => ({ dataTransfer: { dropEffect: effect }, clientX, clientY })
  assert.equal(context.run(ev('move', 0, 0)), false)
  assert.equal(context.run(ev('none', 500, 300)), false)
  assert.equal(detaches, 0)
  assert.equal(context.run(ev('none', -1, 300)), true)
  assert.equal(detaches, 1)
  assert.equal(context.run(ev('none', 1001, 300)), true)
  assert.equal(detaches, 2)
  context.window.lf.isElectron = false
  assert.equal(context.run(ev('none', -1, 300)), false)
  assert.equal(detaches, 2)
})

test('un drop externo válido vuelve a colocar Code sin enfocar la ventana saliente', () => {
  const src = extractFunction(tree, 'commitDrop', 'function drop(event)')
  const layout = defaultDockLayout()
  const events = []
  const local = { prefs: { dockLayout: layout }, ui: { codeNativeOpen: true } }
  const context = {
    store: local, props: { zone: 'center', node: { id: 'lf-dock-center' } },
    DOCK_PANELS: { codeView: ['Code', 'script', 'center'] },
    SPECIAL_DOCK_PANELS: ['codeView'],
    notifyNativeDock: (id, action) => { events.push(`century:dock-${action}`) },
    dataId() { return 'codeView' }, clearHover() {},
    moveDockPanel, window: { dispatchEvent(e) { events.push(e.type) } },
    Event: class { constructor(type) { this.type = type } },
    activateViewportDock() { throw Error('No debe tocar el viewport') },
    activateCodeDock() { throw Error('No debe enfocar Code antes de cerrar Electron') },
  }
  runInNewContext(src + '\nthis.run = commitDrop', context)
  let prevented = 0
  context.run({ preventDefault() { prevented++ }, stopPropagation() {} }, 'right')
  assert.equal(prevented, 1)
  assert.deepEqual(events, ['century:dock-attach'])
  assert.equal(local.prefs.dockLayout.zones.center.type, 'split')
  assert.equal(findDockPanel(local.prefs.dockLayout, 'codeView')?.kind, 'dock')
})

test('el retorno nativo solicita foco solo después de que se libera el destino externo', async () => {
  const src = frame.slice(frame.indexOf('async function attachNative()'), frame.indexOf('const location = computed', frame.indexOf('async function attachNative()')))
  let count = 0
  const nativeTarget = { value: {} }
  const requested = {
    set value(value) { if (!value) nativeTarget.value = null },
  }
  const ctx = { nativeTarget, nativeRequested: requested, props: { dockPanelId: 'codeView' }, nextTick: async () => {}, store: {}, activateCodeDock: () => { count++; return true } }
  runInNewContext(src + '\nthis.run = attachNative', ctx)
  await ctx.run()
  assert.equal(count, 1)
  await ctx.run()
  assert.equal(count, 1)
})

test('Code en la barra superior también admite arrastre hacia el docking y fuera de Century', () => {
  assert.match(toolbar, /data-tooltip="Editor de código de Century" @pointerdown="startDockGesture/)
  assert.match(toolbar, /startDockGesture\(\$event, 'codeView', store\)/)
  assert.match(toolbar, /import \{ startDockGesture, consumeDockClickSuppression \}/)
  assert.doesNotMatch(toolbar, /@click="openNative"/)
})
