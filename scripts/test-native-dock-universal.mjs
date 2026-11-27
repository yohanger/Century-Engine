import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DOCK_PANELS, REQUIRED_DOCK_VIEWS, defaultDockLayout, moveDockPanel, findDockPanel, hideDockPanel, normalizeDockLayout, floatDockPanel, dockGroups } from '../src/core/editor/docking.js'
import { DOCK_DRAG_START_PX, DOCK_NATIVE_RELEASE_PX, dockDragDistance, dockNativePosition, shouldDetachDockDrag, nativeDockAllowed, setDockSpawn, getDockSpawn } from '../src/core/editor/native-dock.js'

const src = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const resourceIds = ['eventEditor', 'database', 'localization', 'themeEditor', 'docs', 'uiEditor', 'shaderEditor', 'shaderGraph']

test('los paneles de edición dedicados se registran una sola vez en el docking', () => {
  for (const id of resourceIds) assert.ok(DOCK_PANELS[id], id)
  assert.equal(new Set(Object.keys(DOCK_PANELS)).size, Object.keys(DOCK_PANELS).length)
})
test('se conserva la disposición inicial y las vistas obligatorias', () => {
  const layout = defaultDockLayout()
  assert.deepEqual(layout.zones.center.tabs, ['sceneView', 'gameView', 'codeView'])
  for (const id of resourceIds) assert.equal(findDockPanel(layout,id), null)
  for (const id of REQUIRED_DOCK_VIEWS) assert.equal(hideDockPanel(layout,id), layout)
})
test('los editores de recursos pueden acoplarse también en el centro', () => {
  let layout = defaultDockLayout()
  for (const id of resourceIds) layout = moveDockPanel(layout, id, 'center', dockGroups(layout.zones.center)[0].id, 'right')
  for (const id of resourceIds) assert.equal(findDockPanel(layout,id)?.zone,'center')
})
test('un panel nunca se duplica al moverlo desde una ventana externa al docking', () => {
  let layout = floatDockPanel(defaultDockLayout(),'database',{x:130,y:170,w:620,h:460})
  layout = moveDockPanel(layout,'database','center',dockGroups(layout.zones.center)[0].id)
  assert.equal(layout.floats.filter(f => f.id==='database').length,0)
  assert.equal(dockGroups(layout.zones.center).flatMap(g=>g.tabs).filter(id=>id==='database').length,1)
})
test('la normalización preserva paneles nuevos y restaura vistas centrales', () => {
  let layout = moveDockPanel(defaultDockLayout(),'localization','center')
  layout.hidden.push('sceneView')
  const normalized = normalizeDockLayout(layout)
  assert.equal(findDockPanel(normalized,'localization')?.kind,'dock')
  for (const id of REQUIRED_DOCK_VIEWS) assert.ok(findDockPanel(normalized,id))
})
test('los umbrales separan el clic y respetan destinos válidos', () => {
  assert.equal(DOCK_DRAG_START_PX,12)
  assert.equal(DOCK_NATIVE_RELEASE_PX,24)
  const start={x:20,y:20}
  assert.equal(dockDragDistance(start,{x:23,y:24}),5)
  assert.equal(shouldDetachDockDrag(start,{x:60,y:60},true,80),false)
  assert.equal(shouldDetachDockDrag(start,{x:60,y:60},false,12),false)
  assert.equal(shouldDetachDockDrag(start,{x:60,y:60},false,25),true)
})
test('la ventana conserva el punto de agarre y admite coordenadas de otros monitores', () => {
  assert.deepEqual(dockNativePosition({ screenX: 410.4, screenY: 220.7 }, { x: 34, y: 13 }), { x: 376, y: 208 })
  assert.deepEqual(dockNativePosition({ screenX: -80, screenY: 40 }, { x: 20, y: 10 }), { x: -100, y: 30 })
})
test('las solicitudes de posición nativa validan sus parámetros', () => {
  assert.equal(nativeDockAllowed('codeView'),true)
  assert.equal(nativeDockAllowed('unknown'),false)
  assert.equal(setDockSpawn('hierarchy',{x:410.4,y:300.2}),true)
  assert.deepEqual(getDockSpawn('hierarchy'),{x:410,y:300})
  assert.equal(setDockSpawn('hierarchy',{x:NaN,y:30}),false)
})
test('los paneles generales se trasladan a Electron, sin abrir otra copia del editor', () => {
  const floating=src('src/components/DockFloating.vue')
  const bank=src('src/components/DockPanelBank.vue')
  assert.match(floating,/:native-tool="electron"/)
  assert.match(bank,/getNativeToolDocument/)
  assert.match(bank,/lf-dock-float-/)
})
test('las herramientas de recursos reutilizan sus ventanas sin apertura nativa automática', () => {
  const event=src('src/components/EventEditor.vue')
  const shader=src('src/components/ShaderEditor.vue')
  assert.match(event,/:native-on-demand="true"/)
  assert.match(shader,/:native-on-demand="true"/)
  for (const [name,id] of [['DatabaseModal','database'],['LocalizationWindow','localization'],['ThemeEditor','themeEditor']]) {
    assert.match(src(`src/components/${name}.vue`),new RegExp(`dock-panel-id="${id}"`))
  }
})
test('las zonas de soltado no necesitan un botón de desacoplamiento', () => {
  const tree=src('src/components/DockTree.vue')
  assert.match(tree,/startDockGesture/)
  assert.doesNotMatch(tree,/aria-label="Desacoplar/)
  assert.match(src('src/core/editor/dock-gesture.js'),/pointermove/)
})
test('Electron autoriza únicamente ventanas de herramientas controladas', () => {
  const main=src('electron/main.cjs')
  assert.match(main,/setWindowOpenHandler/)
  assert.match(main,/modal: false/)
  assert.match(main,/tool\.setParentWindow\(null\)/)
  assert.match(main,/tool\.showInactive\(\)/)
  assert.match(main,/setIgnoreMouseEvents\(true, \{ forward: true \}\)/)
  assert.match(main,/setIgnoreMouseEvents\(false\)/)
  assert.doesNotMatch(main,/tool\.setPosition\(Math\.max\(0/)
})

test('el desplazamiento crea la ventana y al soltar respeta el destino válido', async () => {
  const { startDockGesture } = await import('../src/core/editor/dock-gesture.js')
  const original = { window: globalThis.window, document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame }
  const listeners = new Map()
  let captures = 0
  let releases = 0
  let exposeDockTarget = false
  const nativeDragPhases = []
  const body = { setPointerCapture() { captures += 1 }, releasePointerCapture() { releases += 1 } }
  const rect = { left: 0, top: 0, right: 100, bottom: 100 }
  globalThis.window = {
    lf: {
      isElectron: true,
      beginToolWindowDrag(id) { nativeDragPhases.push(`begin:${id}`) },
      endToolWindowDrag(id) { nativeDragPhases.push(`end:${id}`) },
    },
    innerWidth: 1200, innerHeight: 800,
    addEventListener(name, callback) { listeners.set(name, callback) },
    removeEventListener(name) { listeners.delete(name) },
    dispatchEvent() {},
  }
  const dockTarget = {
    dataset: { lfDockZone: 'center', lfDockGroup: 'lf-dock-center' },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700 }),
  }
  globalThis.document = { body, elementFromPoint() { return exposeDockTarget ? { closest: () => dockTarget } : null } }
  globalThis.requestAnimationFrame = fn => fn()
  const store = { prefs: { dockLayout: defaultDockLayout() } }
  try {
    assert.equal(startDockGesture({ button: 0, pointerId: 2, clientX: 50, clientY: 50,
      currentTarget: { closest: selector => selector === '.lf-dock-tabs' ? { getBoundingClientRect: () => rect } : null, getBoundingClientRect: () => rect } }, 'hierarchy', store), true)
    assert.equal(captures, 0, 'el clic inicial no debe secuestrar la selección de pestañas')
    listeners.get('pointermove')({ pointerId: 2, clientX: 140, clientY: 150, screenX: 440, screenY: 250 })
    assert.equal(captures, 1, 'se captura después del umbral, no antes')
    assert.equal(findDockPanel(store.prefs.dockLayout, 'hierarchy')?.kind, 'float')
    assert.deepEqual(nativeDragPhases, ['begin:hierarchy'])
    exposeDockTarget = true
    listeners.get('pointerup')({ pointerId: 2, clientX: 140, clientY: 150, screenX: 440, screenY: 250 })
    assert.equal(listeners.has('pointermove'), false)
    assert.equal(releases, 1)
    assert.deepEqual(nativeDragPhases, ['begin:hierarchy', 'end:hierarchy'])
    assert.equal(findDockPanel(store.prefs.dockLayout, 'hierarchy')?.zone, 'center',
      'un destino válido permite reacoplar durante el mismo gesto')

    exposeDockTarget = false
    const secondStore = { prefs: { dockLayout: defaultDockLayout() } }
    assert.equal(startDockGesture({ button: 0, pointerId: 3, clientX: 50, clientY: 50,
      currentTarget: { closest: selector => selector === '.lf-dock-tabs' ? { getBoundingClientRect: () => rect } : null, getBoundingClientRect: () => rect } }, 'hierarchy', secondStore), true)
    listeners.get('pointermove')({ pointerId: 3, clientX: 60, clientY: 60, screenX: 360, screenY: 160 })
    listeners.get('pointerup')({ pointerId: 3, clientX: 140, clientY: 150, screenX: 440, screenY: 250 })
    assert.deepEqual(nativeDragPhases, ['begin:hierarchy', 'end:hierarchy', 'begin:hierarchy', 'end:hierarchy'],
      'desacoplar directamente en pointerup también debe cerrar el modo transparente')

    const thirdStore = { prefs: { dockLayout: defaultDockLayout() } }
    assert.equal(startDockGesture({ button: 0, pointerId: 4, clientX: 50, clientY: 50,
      currentTarget: { closest: () => ({ getBoundingClientRect: () => rect }), getBoundingClientRect: () => rect } }, 'hierarchy', thirdStore), true)
    listeners.get('pointermove')({ pointerId: 4, clientX: 140, clientY: 150, screenX: 440, screenY: 250 })
    assert.equal(findDockPanel(thirdStore.prefs.dockLayout, 'hierarchy')?.kind, 'float')
    listeners.get('lostpointercapture')({ target: {}, pointerId: 4 })
    assert.equal(listeners.has('pointermove'), true)
    listeners.get('lostpointercapture')({ target: body, pointerId: 4 })
    assert.equal(listeners.has('pointermove'), false)
    assert.equal(listeners.has('lostpointercapture'), false)
    assert.deepEqual(nativeDragPhases.slice(-2), ['begin:hierarchy', 'end:hierarchy'])
    assert.equal(findDockPanel(thirdStore.prefs.dockLayout, 'hierarchy')?.kind, 'float')
  } finally {
    globalThis.window = original.window
    globalThis.document = original.document
    globalThis.requestAnimationFrame = original.requestAnimationFrame
  }
})
