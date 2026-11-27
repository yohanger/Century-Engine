import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultDockLayout, normalizeDockLayout, findDockPanel, moveDockPanel, floatDockPanel, restoreDockPanel, hideDockPanel, dockNodeHasAvailablePanel, dockPanelIsActive, dockGroups, focusDockPanel } from '../src/core/editor/docking.js'
import { cameraFacingLoopEdge } from '../src/core/mesh/camera-loopcut.js'
import { grid, make } from '../src/engine/runtime/mesh/generators.js'
import { ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { validLoopCutRing, loopCut } from '../src/core/mesh/cuts.js'

const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

test('nuevas vistas se añaden al docking en el centro, sin crear instancias repetidas', () => {
  const layout = defaultDockLayout()
  assert.deepEqual(layout.zones.center.tabs, ['sceneView', 'gameView', 'codeView'])
  assert.equal(findDockPanel(layout, 'sceneView').zone, 'center')
  assert.equal(findDockPanel(layout, 'gameView').zone, 'center')
  assert.equal(layout.zones.left.tabs.includes('sceneView'), false)
})
test('migración conservadora de un layout guardado sin panel central', () => {
  const old = defaultDockLayout(); delete old.zones.center
  const restored = normalizeDockLayout(old)
  assert.deepEqual(restored.zones.center.tabs, ['sceneView', 'gameView', 'codeView'])
  assert.deepEqual(restored.zones.left, old.zones.left)
  assert.deepEqual(restored.zones.right, old.zones.right)
  assert.deepEqual(restored.zones.bottom, old.zones.bottom)
})
test('la vista de juego se puede dividir del editor, cambiar el tamaño y recuperar pestañas', () => {
  let layout = moveDockPanel(defaultDockLayout(), 'gameView', 'center', 'lf-dock-center', 'right')
  assert.equal(layout.zones.center.type, 'split')
  assert.equal(dockGroups(layout.zones.center).length, 2)
  layout = focusDockPanel(layout, 'gameView')
  assert.equal(findDockPanel(layout, 'gameView').active, true)
  layout = moveDockPanel(layout, 'gameView', 'center', dockGroups(layout.zones.center)[0].id, 'center')
  assert.equal(dockGroups(layout.zones.center).length, 1)
  assert.equal(dockGroups(layout.zones.center)[0].tabs.length, 3)
})
test('escena y juego son flotantes y restaurables sin perder la otra vista', () => {
  let layout = floatDockPanel(defaultDockLayout(), 'sceneView', { x: 110, y: 120, w: 720, h: 500 })
  assert.equal(findDockPanel(layout, 'sceneView').kind, 'float')
  assert.equal(findDockPanel(layout, 'gameView').zone, 'center')
  layout = restoreDockPanel(layout, 'sceneView')
  assert.equal(findDockPanel(layout, 'sceneView').kind, 'dock')
  assert.deepEqual(normalizeDockLayout(layout), layout)
})
test('las vistas obligatorias no se ocultan y los paneles auxiliares pueden acoplarse al centro', () => {
  const layout = defaultDockLayout()
  assert.equal(hideDockPanel(layout, 'sceneView'), layout)
  assert.equal(hideDockPanel(layout, 'gameView'), layout)
  assert.equal(findDockPanel(moveDockPanel(layout, 'project', 'center'), 'project').zone, 'center')
  assert.equal(moveDockPanel(layout, 'gameView', 'left'), layout)
})
test('la superficie de observación se enlaza a la escena, no a una segunda sesión PlayMode', () => {
  const observer = file('src/components/SceneRuntimeObserver.vue')
  const app = file('src/App.vue')
  assert.match(observer, /store\.editor\.vp|editor\.vp/)
  assert.match(observer, /editor\.player\?\.cam/)
  assert.match(observer, /vp\.occlusion\.draw\(vpCamera/)
  assert.match(app, /<DockTree :node="dockLayout\.zones\.center" zone="center"/)
  assert.match(app, /<Teleport :to="mainTeleportTo" defer>/)
  assert.match(app, /<SceneRuntimeObserver :key="observerView" :view="observerView" \/>/)
  assert.doesNotMatch(observer, /new\s+PlayMode\s*\(/)
})
test('el observador runtime conserva calidad editorial, fluidez e inspección por selección', () => {
  const observer = file('src/components/SceneRuntimeObserver.vue')
  assert.match(observer, /antialias:\s*true/)
  assert.match(observer, /setPixelRatio\(editor\.vp\.renderer\.getPixelRatio\(\)\)/)
  assert.match(observer, /1000\s*\/\s*30/)
  assert.match(observer, /selectObject\(object\?\.id \|\| null/)
  assert.doesNotMatch(observer, /devicePixelRatio[^\n]*0\.75/)
})
test('el observador reutiliza la navegación completa del viewport editorial durante Play', () => {
  const observer = file('src/components/SceneRuntimeObserver.vue')
  assert.match(observer, /import \{ navMethods \} from '\.\.\/engine\/runtime\/render\/viewport-nav\.js'/)
  assert.match(observer, /Object\.assign\([^]*navMethods\)/)
  assert.match(observer, /navigation\._bindFly\(\)/)
  assert.match(observer, /navigation\._bindContinuousNavigation\(\)/)
  assert.match(observer, /navigation\._flyStep\(navigationDt\)/)
  assert.match(observer, /navigation\?\._padStep\(navigationDt, now\)/)
  assert.match(observer, /p\.flySpeed \?\? 14/)
  assert.match(observer, /controls\.mouseButtons = \{ LEFT: -1, MIDDLE: THREE\.MOUSE\.ROTATE, RIGHT: -1 \}/)
  assert.match(observer, /store\.ui\.viewTab = 'scene'[\s\S]*if \(event\.button !== 0\) return/)
})

const projection = v => ({ x:v[0]*100, y:v[1]*100, z:0 })
test('Loop Cut inicia sobre la cara visible bajo el cursor (no sobre una cara oculta)', () => {
  const mesh = make('cube'), face = mesh.f[0]
  const a = mesh.v[face[0]], b = mesh.v[face[1]]
  const screen = { x:(a[0]*.9+b[0]*.1)*100, y:(a[1]*.9+b[1]*.1)*100 }
  const edge = cameraFacingLoopEdge(mesh, 0, screen, projection)
  assert.ok(edge)
  assert.ok(face.some((v,i)=>edge===ekey(v,face[(i+1)%4])))
  assert.ok(validLoopCutRing(mesh, edge))
  assert.ok(loopCut(mesh, edge, 1))
})
test('Loop Cut no inventa anillos para triángulos y caras inexistentes', () => {
  const m=make('cube')
  assert.equal(cameraFacingLoopEdge(m,-1,{x:0,y:0},projection),null)
  assert.equal(cameraFacingLoopEdge(m,999,{x:0,y:0},projection),null)
  m.f[0].pop()
  assert.equal(cameraFacingLoopEdge(m,0,{x:0,y:0},projection),null)
})
test('Loop Cut respeta perspectiva y ortográfica mediante proyección de vértices', () => {
  const m=grid(3,2,4,2), face=0
  const perspective = v => ({ x:v[0]*100/(1+v[2]*.05), y:v[1]*100/(1+v[2]*.05), z:0 })
  const ortho = v => ({ x:v[0]*100, y:v[1]*100, z:0 })
  const screen = {x:15,y:15}
  for (const projection of [perspective,ortho]) {
    const key = cameraFacingLoopEdge(m,face,screen,projection)
    assert.ok(key)
    assert.ok(validLoopCutRing(m,key))
  }
})
test('cambio de punto de mira puede elegir otra dirección sin alterar el anillo topológico', () => {
  const m=make('cube'), face=m.f[0], a=m.v[face[0]], b=m.v[face[1]], c=m.v[face[2]]
  const nearA={x:(a[0]*.95+b[0]*.05)*100,y:(a[1]*.95+b[1]*.05)*100}
  const nearC={x:(c[0]*.95+b[0]*.05)*100,y:(c[1]*.95+b[1]*.05)*100}
  const e1=cameraFacingLoopEdge(m,0,nearA,projection), e2=cameraFacingLoopEdge(m,0,nearC,projection)
  assert.ok(e1 && e2)
  const initial=m.f.length
  assert.ok(loopCut(m,e1))
  assert.ok(m.f.length>initial)
})

test('vista Edit durante Play libera la captura, conserva el juego y permite observar sin foco', async () => {
  const { activateViewportDock } = await import('../src/core/editor/view-dock-session.js')
  const layout = defaultDockLayout(), calls=[]
  const state = {
    play:{on:true},ui:{viewTab:'game'},prefs:{dockLayout:layout},
    editor:{player:{keys:new Set(['KeyW']),input:{clear(){calls.push('clear')}}},setGameView(){throw Error('No cambiar cámara mientras se juega')}},
  }
  assert.equal(activateViewportDock(state,'sceneView'),true)
  assert.equal(state.ui.viewTab,'scene')
  assert.equal(state.editor.player.keys.size,0)
  assert.deepEqual(calls,['clear'])
  assert.equal(findDockPanel(state.prefs.dockLayout,'sceneView').active,true)
  assert.equal(activateViewportDock(state,'gameView'),true)
})
test('los controles Play Mode y Edit Mode reutilizan setGameView fuera de Runtime', async () => {
  const { activateViewportDock } = await import('../src/core/editor/view-dock-session.js')
  const calls=[]
  const state = { play:{on:false},ui:{viewTab:'scene'},prefs:{dockLayout:defaultDockLayout()},editor:{setGameView(on){calls.push(on);return true}} }
  assert.equal(activateViewportDock(state,'gameView'),true)
  assert.equal(state.ui.viewTab,'game')
  assert.equal(activateViewportDock(state,'sceneView'),true)
  assert.deepEqual(calls,[true,false])
})
test('Play editorial sigue simulando sin foco y no entrega sus teclas al jugador', () => {
  const src=file('src/engine/runtime/events/play-controls.js')
  assert.match(src,/this\.state\.focus \|\| \(!!this\.session && !this\.ui\.modalOpen\)/)
  assert.match(src,/\!this\.paused/)
  assert.match(src,/this\.session && !this\.state\.focus && !this\.ui\.modalOpen/)
  assert.doesNotMatch(src,/observeWhenUnfocused/)
})
test('un clic en el canvas de Play recupera el foco antes de capturar el puntero', async () => {
  const { controlsMethods } = await import('../src/engine/runtime/events/play-controls.js')
  const calls=[]
  const context = {
    runtime:false, session:{}, paused:false, ui:{modalOpen:false}, state:{focus:false},
    dom:{focus(options){calls.push(['focus',options])}},
    _lock(){calls.push(['lock'])},
  }
  const event={button:0,preventDefault(){calls.push(['prevent'])}}
  controlsMethods._mouse.call(context,event)
  assert.equal(calls[0][0],'focus')
  assert.deepEqual(calls.slice(1).map(call=>call[0]),['prevent','lock'])
})


test('la vista de observación consume GPU solo cuando su pestaña está visible o flotante', () => {
  const prefs = { dockLayout: defaultDockLayout() }
  const app = file('src/App.vue')
  assert.equal(dockPanelIsActive(prefs.dockLayout, prefs, 'sceneView'), true)
  prefs.dockLayout = focusDockPanel(prefs.dockLayout, 'gameView')
  assert.equal(dockPanelIsActive(prefs.dockLayout, prefs, 'sceneView'), false)
  prefs.dockLayout = floatDockPanel(prefs.dockLayout, 'sceneView')
  assert.equal(dockPanelIsActive(prefs.dockLayout, prefs, 'sceneView'), true)
  assert.match(app, /dockPanelIsActive\(store\.prefs\.dockLayout, store\.prefs, observerPanel\.value\)/)
})
test('las vistas obligatorias no muestran la acción de ocultar', () => {
  const component = file('src/components/DockTree.vue')
  assert.match(component, /v-if="!REQUIRED_DOCK_VIEWS.includes\(active\)" class="lf-dock-action"/)
})
test('un dock sin paneles disponibles colapsa y devuelve el espacio al viewport', () => {
  const contextual = { type:'group', id:'lf-dock-context', tabs:['mesh','paint'], active:'mesh' }
  const state = { edit:{on:false}, paint:{on:false}, ui:{shaderWorkspace:false}, project:null, modal:null, scriptEditId:null }
  assert.equal(dockNodeHasAvailablePanel(contextual,state),false)
  state.edit.on=true
  assert.equal(dockNodeHasAvailablePanel(contextual,state),true)
  const app=file('src/App.vue'),tree=file('src/components/DockTree.vue')
  assert.match(app,/dockNodeHasAvailablePanel\(dockLayout\.value\?\.zones\?\.\[zone\], store\)/)
  assert.doesNotMatch(tree,/Panel no disponible en este modo/)
})


test('Loop Cut usa el raycast de la cara visible antes del algoritmo del anillo', () => {
  const modal = file('src/core/mesh/session-modal.js')
  assert.match(modal, /this\._pickFace\(cur\.x, cur\.y\)/)
  assert.match(modal, /cameraFacingLoopEdge\(m\.base, face, cur/)
  assert.match(modal, /validLoopCutRing\(m\.base, m\.edge, m\.cuts\)/)
})
