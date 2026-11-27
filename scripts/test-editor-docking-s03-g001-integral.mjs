// LF-EDITOR-DOCKING-S03-G001-INTEGRAL · contrato estructural + modelo sin duplicación.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DOCK_PANELS, DOCK_ZONES, SPECIAL_DOCK_PANELS, defaultDockLayout, normalizeDockLayout,
  dockGroups, dockDropEdge, findDockPanel, moveDockPanel, focusDockPanel, floatDockPanel, hideDockPanel,
  restoreDockPanel, resizeDockSplit, updateDockFloat, dockPanelAvailable, dockPanelIsActive,
} from '../src/core/editor/docking.js'
import { fitEditorDocks, fitEditorWindow } from '../src/core/editor/window-layout.js'
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const ids = () => Object.keys(DOCK_PANELS).filter((id) => !SPECIAL_DOCK_PANELS.includes(id))
function invariant(layout, expected = ids()) {
  const all = DOCK_ZONES.flatMap((zone) => dockGroups(layout.zones[zone]).flatMap((g) => g.tabs))
    .concat(layout.floats.map((f) => f.id), layout.hidden)
  assert.equal(new Set(all).size, all.length, 'panel no duplicado')
  assert.deepEqual(all.filter((id) => expected.includes(id)).sort(), [...expected].sort(), 'paneles preservados')
  for (const zone of DOCK_ZONES) for (const g of dockGroups(layout.zones[zone])) {
    assert.ok(g.tabs.includes(g.active), `${zone}: pestaña activa válida`)
  }
}

test('DOCK-01 · distribución nueva conserva la pestaña disponible y oculta los paneles opcionales', () => {
  const x = normalizeDockLayout(null, { bottomTab: 'console', rightTab: 'signals' })
  assert.equal(x.zones.bottom.active, 'console'); assert.equal(x.zones.right.active, 'object')
  assert.equal(findDockPanel(x, 'signals').kind, 'hidden')
  invariant(x)
})
test('DOCK-02 · centro acoplable para las vistas sin introducir otro viewport de juego', () => {
  assert.deepEqual(DOCK_ZONES, ['left','right','top','bottom','center'])
  assert.ok(DOCK_PANELS.sceneView && DOCK_PANELS.gameView)
  assert.equal(defaultDockLayout().zones.top, null)
})
test('DOCK-03 · registra todos los paneles existentes sin instancias paralelas', () => {
  for (const id of ['hierarchy','object','signals','project','console','mixer','timeline','anim','vcs','eventEditor','scriptEditor','shaderEditor','shaderGraph','uiEditor']) assert.ok(DOCK_PANELS[id])
  invariant(defaultDockLayout())
})
for (const [i, zone] of DOCK_ZONES.filter(z => z !== 'center').entries()) {
  test(`DOCK-04.${i} · mueve pestaña a ${zone}`, () => {
    const x = moveDockPanel(defaultDockLayout(), 'project', zone)
    assert.equal(findDockPanel(x, 'project').zone, zone)
    invariant(x)
  })
}
for (const [i, edge] of ['left','right','top','bottom'].entries()) {
  test(`DOCK-05.${i} · crea grupo adyacente ${edge}`, () => {
    const x = moveDockPanel(defaultDockLayout(), 'console', 'left', 'lf-dock-left', edge)
    assert.equal(x.zones.left.type, 'split')
    assert.equal(x.zones.left.dir, ['left','right'].includes(edge) ? 'row' : 'column')
    assert.equal(dockGroups(x.zones.left).length, 2)
    invariant(x)
  })
}
test('DOCK-06 · mover panel activo dentro del grupo solo cambia selección', () => {
  const x = moveDockPanel(defaultDockLayout(), 'console', 'bottom', 'lf-dock-bottom')
  assert.equal(dockGroups(x.zones.bottom).length, 1)
  assert.equal(x.zones.bottom.active, 'console')
  invariant(x)
})
test('DOCK-07 · mover la última pestaña colapsa grupos vacíos', () => {
  let x = moveDockPanel(defaultDockLayout(), 'console', 'left', 'lf-dock-left', 'bottom')
  x = moveDockPanel(x, 'console', 'bottom', 'lf-dock-bottom')
  assert.equal(x.zones.left.type, 'group')
  invariant(x)
})
test('DOCK-08 · float conserva posición, tamaño y no duplica panel', () => {
  const x = floatDockPanel(defaultDockLayout(), 'project', { x: 88, y: 110, w: 550, h: 430 })
  const p = findDockPanel(x, 'project')
  assert.deepEqual([p.kind,p.x,p.y,p.w,p.h], ['float',88,110,550,430])
  invariant(x)
})
test('DOCK-09 · flotante tiene redocking sin pérdida de identidad', () => {
  const x = restoreDockPanel(floatDockPanel(defaultDockLayout(), 'signals'), 'signals')
  assert.equal(findDockPanel(x, 'signals').kind, 'dock')
  invariant(x)
})
test('DOCK-10 · ocultar y restaurar conserva los demás paneles', () => {
  let x = hideDockPanel(defaultDockLayout(), 'hierarchy')
  assert.equal(findDockPanel(x, 'hierarchy').kind, 'hidden')
  invariant(x)
  x = restoreDockPanel(x, 'hierarchy')
  assert.equal(findDockPanel(x, 'hierarchy').zone, 'left')
  invariant(x)
})
test('DOCK-11 · preferencia activa se conserva al seleccionar otro grupo', () => {
  const start = moveDockPanel(defaultDockLayout(), 'console', 'left', 'lf-dock-left', 'bottom')
  const next = focusDockPanel(start, 'hierarchy')
  assert.equal(findDockPanel(next, 'hierarchy').active, true)
  assert.equal(findDockPanel(next, 'console').active, true)
  invariant(next)
})
test('DOCK-12 · preferencias leídas desde layout válido no agregan duplicados', () => {
  const saved = floatDockPanel(moveDockPanel(defaultDockLayout(), 'console', 'right'), 'project')
  assert.deepEqual(normalizeDockLayout(saved), saved)
})
test('DOCK-13 · reparación elimina pestañas repetidas y desconocidas', () => {
  const saved = defaultDockLayout()
  saved.zones.left.tabs.push('console', 'bogus')
  const x = normalizeDockLayout(saved)
  invariant(x)
  assert.equal(findDockPanel(x, 'console').zone, 'left')
})
test('DOCK-14 · valores malformados no dañan restauración', () => {
  for (const value of [null,{},[],{version:2,zones:{}},{version:1,zones:{left:{type:'split',first:null,second:[]}}}]) {
    const x = normalizeDockLayout(value)
    invariant(x)
  }
})
test('DOCK-15 · float repetido se limpia sin borrar el panel', () => {
  const x = defaultDockLayout()
  x.floats = [{id:'console',x:1,y:1,w:1,h:1},{id:'console',x:100,y:120,w:500,h:350}]
  const repaired = normalizeDockLayout(x)
  invariant(repaired)
})
test('DOCK-16 · tamaños divisores quedan dentro del rango permitido', () => {
  const start=moveDockPanel(defaultDockLayout(), 'console', 'left', 'lf-dock-left', 'right')
  for (const ratio of [-1,0,NaN,Infinity,.45,2]) {
    const x=resizeDockSplit(start,start.zones.left.id,ratio)
    assert.ok(x.zones.left.ratio>=.2 && x.zones.left.ratio<=.8)
    invariant(x)
  }
})
test('DOCK-17 · actualizar float no altera otros paneles', () => {
  const start=floatDockPanel(defaultDockLayout(),'project')
  const next=updateDockFloat(start,'project',{x:555,w:700})
  assert.equal(findDockPanel(next,'project').x,555)
  assert.equal(findDockPanel(next,'project').w,700)
  invariant(next)
})
test('DOCK-18 · no permite panel inexistente ni zonas inválidas', () => {
  const s=defaultDockLayout()
  assert.equal(moveDockPanel(s,'viewport','left'),s)
  assert.equal(findDockPanel(moveDockPanel(s,'console','center'),'console')?.zone,'center')
  assert.equal(floatDockPanel(s,'nonexistent'),s)
})
test('DOCK-19 · paneles contextuales no aparecen sin sus herramientas', () => {
  const state={edit:{on:false},paint:{on:false},ui:{shaderWorkspace:false},project:null,modal:null}
  assert.equal(dockPanelAvailable('mesh',state),false)
  assert.equal(dockPanelAvailable('paint',state),false)
  assert.equal(dockPanelAvailable('signals',state),true)
  state.edit.on=true;state.paint.on=true
  assert.equal(dockPanelAvailable('mesh',state),true)
  assert.equal(dockPanelAvailable('paint',state),true)
})
test('DOCK-20 · paneles específicos no aparecen sin documento abierto', () => {
  const state={edit:{on:false},paint:{on:false},ui:{shaderWorkspace:false},project:{shaders:[]},modal:null,shaderEditId:null}
  for(const id of SPECIAL_DOCK_PANELS.filter(id => id !== 'codeView')) assert.equal(dockPanelAvailable(id,state),false)
  assert.equal(dockPanelAvailable('codeView',state),true)
  state.modal='script';assert.equal(dockPanelAvailable('scriptEditor',state),false)
})
test('DOCK-21 · visibilidad de varios grupos no depende de bottomTab único', () => {
  const layout=moveDockPanel(defaultDockLayout(), 'anim', 'left', 'lf-dock-left', 'bottom')
  const prefs={leftOpen:true,bottomOpen:true,bottomTab:'project'}
  assert.equal(dockPanelIsActive(layout,prefs,'anim'),true)
  assert.equal(dockPanelIsActive(layout,prefs,'project'),true)
})
test('DOCK-22 · fit del viewport conserva mínimo y reserva zona superior', () => {
  const prefs={leftOpen:true,rightOpen:true,bottomOpen:true,topOpen:true,leftW:236,rightW:296,topH:170,bottomH:210}
  const d=fitEditorDocks(1366,768,prefs)
  assert.ok(d.top>0 && d.bottom>0 && d.top+d.bottom < 768-96-150)
  assert.ok(1366-d.left-d.right-10>=280)
  assert.equal(fitEditorWindow({x:9000,y:9000,w:520,h:410},1366,768).x<=1366-520-8,true)
})
test('DOCK-23 · límites no alteran preferencias persistidas', () => {
  const p={leftOpen:true,rightOpen:true,bottomOpen:true,topOpen:true,leftW:360,rightW:340,bottomH:380,topH:290}
  const old=JSON.stringify(p)
  fitEditorDocks(900,520,p)
  assert.equal(JSON.stringify(p),old)
})
test('DOCK-24 · App monta un solo banco de paneles sin duplicar SceneTree en escritorio', () => {
  const app=read('src/App.vue'),bank=read('src/components/DockPanelBank.vue')
  assert.match(app,/<DockPanelBank v-if=/)
  assert.match(bank,/<Teleport v-for=/)
  assert.match(bank,/<SceneTree v-if=/)
  assert.match(app,/<SceneTree \/>/) // solo drawer de móvil
  assert.doesNotMatch(app,/<SceneTree \/><\/aside>/)
})
test('DOCK-25 · la geometría flotante reutiliza AppWindow y el fit existente', () => {
  const floating=read('src/components/DockFloating.vue'), win=read('src/components/AppWindow.vue')
  assert.match(floating,/<AppWindow/)
  assert.match(win,/fitEditorWindow/)
  assert.match(win,/layoutRect/)
  assert.match(win,/geometry-change/)
})
test('DOCK-26 · Shader Graph conserva alojamiento central mientras no se mueve', () => {
  const app=read('src/App.vue'), floating=read('src/components/FloatingEditorWindow.vue')
  assert.match(app,/id="shader-graph-host"/)
  assert.match(floating,/props\.dockTarget/)
  assert.match(floating,/workspaceDocked/)
})
test('DOCK-27 · menús, viewport, Player y runtime no se duplican', () => {
  const app=read('src/App.vue')
  assert.equal((app.match(/<SceneTabs v-if/g)||[]).length,1)
  assert.equal((app.match(/ref="host" class="viewport"/g)||[]).length,1)
  assert.match(app,/!maxed/)
  assert.match(app,/mode === 'phone'/)
})
test('DOCK-28 · se conservan editores especializados y sus sesiones originales', () => {
  for(const name of ['EventEditor','ScriptEditor','ShaderEditor','ShaderGraphEditor']) assert.match(read(`src/components/${name}.vue`),/dock-panel-id=/)
  assert.match(read('src/components/UiEditor.vue'),/dock-panel-id="uiEditor"/)
})
test('DOCK-29 · existe medio visual para restaurar un panel oculto o resetear layout', () => {
  const tb=read('src/components/Toolbar.vue')
  assert.match(tb,/Restaurar disposición/)
  assert.match(tb,/hideDockPanel/)
  assert.match(tb,/restoreDockPanel/)
})
test('DOCK-30 · comandos de timeline y animación preservan su ruta de apertura', () => {
  for(const f of ['timelines','animation']) {
    const content=read(`src/core/state/${f}.js`)
    assert.match(content,/focusDockPanel/)
    assert.match(content,/bottomOpen = true/)
  }
})
test('DOCK-31 · cierre de zona no destruye el contenido del panel', () => {
  const bank=read('src/components/DockPanelBank.vue')
  assert.match(bank,/zoneMounted\(at\.zone\)/)
  assert.match(bank,/store\.prefs\.topOpen/)
  assert.match(bank,/store\.play\.on/)
  assert.match(bank,/lf-dock-bank-/)
})
test('DOCK-32 · editores especializados conservan destino oculto durante Play maximizado', () => {
  const bank=read('src/components/DockPanelBank.vue')
  assert.match(bank,/lf-dock-special-/)
  for (const comp of ['FloatingEditorWindow','AppWindow']) {
    const code=read(`src/components/${comp}.vue`)
    assert.match(code,/lf-dock-special-/)
    assert.match(code,/store\.prefs\.gameMaximize/)
  }
})
test('DOCK-33 · fixture Electron cubre DOM sin invadir GPU', () => {
  const runner=read('scripts/test-editor-docking-s03-g001-integral-electron.mjs')
  const fixture=read('scripts/fixtures/editor/docking-s03-g001-integral.html')
  assert.match(runner,/qa-electron-webgl-runner/)
  assert.match(fixture,/DockTree/)
  assert.match(fixture,/DockFloating/)
  assert.match(fixture,/viewport-guard/)
  assert.ok((fixture.match(/check\('/g)||[]).length>=28)
})
test('DOCK-34 · los panels de contexto no generan pestañas fantasma', () => {
  const tree=read('src/components/DockTree.vue')
  assert.match(tree,/dockPanelAvailable\(id, store\)/)
  assert.match(tree,/activeDockTab\(/)
  assert.match(tree,/aria-selected/)
})

// CORR-001: prioridad de pestañas compartidas y limpieza fiable del indicador DnD.
test('DOCK-C01 · el encabezado del grupo siempre acopla como pestaña', () => {
  const rect = { left: 100, top: 100, width: 290, height: 430 }
  for (const [x, y] of [[101, 101], [389, 101], [102, 529], [390, 530]]) {
    assert.equal(dockDropEdge(rect, x, y, true), 'center')
  }
})
test('DOCK-C02 · centro del grupo usa el mismo espacio, no crea divisiones', () => {
  const r = { left: 100, top: 100, width: 290, height: 430 }
  for (const [x,y] of [[160,150], [245,310], [345,470]]) assert.equal(dockDropEdge(r,x,y), 'center')
  let layout = moveDockPanel(defaultDockLayout(), 'project', 'left', 'lf-dock-left', 'center')
  assert.equal(layout.zones.left.type,'group')
  assert.deepEqual(layout.zones.left.tabs, ['hierarchy','project'])
  assert.equal(layout.zones.left.active,'project')
  assert.equal(findDockPanel(layout,'project').groupId,findDockPanel(layout,'hierarchy').groupId)
  invariant(layout)
})
test('DOCK-C03 · división solo junto a los bordes precisos', () => {
  const r = { left: 100, top: 100, width: 290, height: 430 }
  for (const [edge,x,y] of [['left',104,300],['right',385,300],['top',245,103],['bottom',245,525]]) {
    assert.equal(dockDropEdge(r,x,y),edge)
  }
})
test('DOCK-C04 · soltar en zona existente combina pestañas en el mismo grupo', () => {
  let layout = moveDockPanel(defaultDockLayout(),'project','left')
  layout = moveDockPanel(layout,'signals','left')
  assert.equal(layout.zones.left.type,'group')
  assert.deepEqual(layout.zones.left.tabs,['hierarchy','project','signals'])
  assert.equal(layout.zones.left.active,'signals')
  assert.equal(layout.zones.right.tabs.includes('signals'),false)
  invariant(layout)
})
test('DOCK-C05 · DockTree tiene drop explícito en pestañas sin división accidental', () => {
  const tree = read('src/components/DockTree.vue')
  assert.match(tree, /@dragover\.capture="over"/)
  assert.match(tree, /@drop\.capture="drop"/)
  assert.match(tree, /event\.target\.closest\?\.\('.lf-dock-tabs'\)/)
  assert.match(tree, /hoverTabs\.value \? 'center' : detectEdge\(event\)/)
  assert.match(tree, /@dragleave="leave"/)
  assert.match(tree, /dragend', clearHover/)
  assert.match(tree, /drop', clearHover/)
  assert.match(tree, /blur', clearHover/)
  assert.match(tree, /Escape/)
})
test('DOCK-C06 · overlay del viewport se limpia al cancelar y soltar fuera', () => {
  const app = read('src/App.vue')
  assert.match(app, /@dragleave="centerDockLeave"/)
  assert.doesNotMatch(app, /@dragleave\.self="centerDockPreview/)
  for (const e of ["dragend",'drop','blur']) assert.ok(app.includes(`addEventListener('${e}', clearCenterDockPreview`))
  assert.match(app,/onDockDragKey/)
  assert.match(app,/removeEventListener\('dragend', clearCenterDockPreview/)
  assert.match(app,/clearCenterDockPreview\(\)/)
  assert.match(app,/Como pestaña/)
  assert.doesNotMatch(app,/\.lf-center-drop\.edge-left \{ inset:/)
})

// CORR-002: la Jerarquía y el Inspector deben materializar contenido al activar un grupo nuevo.
test('DOCK-C07 · los paneles activos no dependen de una visita previa del grupo', () => {
  const bank = read('src/components/DockPanelBank.vue')
  assert.match(bank, /const activeIds = computed\(\(\) => builtin\.filter\(visible\)\)/)
  assert.match(bank, /watch\(activeIds/)
  assert.match(bank, /flush: 'sync'/)
  assert.match(bank, /visited\.value = \[\.\.\.visited\.value, \.\.\.missing\]/)
})
test('DOCK-C08 · Teleport se reubica solo hacia hosts existentes tras dividir o mover', () => {
  const bank = read('src/components/DockPanelBank.vue')
  assert.match(bank, /document\.getElementById\(wanted\)/)
  assert.match(bank, /document\.getElementById\(`lf-dock-bank-\$\{id\}`\)/)
  assert.match(bank, /await nextTick\(\)/)
  assert.match(bank, /<Teleport v-for="id in visited"/)
})
test('DOCK-C09 · el Inspector de escena exige selección explícita y conserva el estado vacío', () => {
  const inspector = read('src/components/Inspector.vue')
  const tree = read('src/components/SceneTree.vue')
  const selection = read('src/core/state/objects.js')
  assert.match(inspector, /v-else-if="!obj && store.sceneSel"/)
  assert.match(inspector, /v-else-if="!obj" class="empty"/)
  assert.match(tree, /const sceneActive = computed\(\(\) => store.sceneSel\)/)
  assert.match(selection, /store.sceneSel = false \/\/ solo selectScene/)
  assert.match(selection, /export function selectScene\(\) {[\s\S]*?store.sceneSel = true/)
})
test('DOCK-C10 · el drop del Inspector se captura antes de los controles de recurso anidados', () => {
  const tree = read('src/components/DockTree.vue')
  assert.match(tree, /@dragover\.capture="over"/)
  assert.match(tree, /@drop\.capture="drop"/)
  assert.match(tree, /if \(!DOCK_PANELS\[id\]\) return/)
  assert.match(tree, /@dragleave="leave"/)
})

test('DOCK-C11 · el fixture Electron reproduce interferencia de drops dentro del Inspector', () => {
  const fixture = read('scripts/fixtures/editor/docking-s03-g001-integral.html')
  assert.match(fixture, /fixture-resource-drop/)
  assert.match(fixture, /Inspector no intercepta el drop de un panel/)
  assert.match(fixture, /Drop de Assets no se intercepta por el docking/)
  assert.match(read('scripts/test-editor-docking-s03-g001-integral-electron.mjs'), /minChecks: 44/)
})

test('DOCK-C12 · Electron ejercita montaje real de SceneTree antes y después de moverlo', () => {
  const fixture=read('scripts/fixtures/editor/docking-s03-g001-integral.html')
  assert.match(fixture, /createApp\(DockPanelBank\)/)
  assert.match(fixture, /Jerarquía muestra nodo de proyecto, no solo encabezado/)
  assert.match(fixture, /Jerarquía se transporta al nuevo host sin quedar vacía/)
  assert.match(fixture, /Jerarquía regresa con una sola instancia conservada/)
})
