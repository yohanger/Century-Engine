import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { assetIcon } from '../src/core/editor/asset-icon.js'
import { defaultDockLayout, findDockPanel, hideDockPanel, moveDockPanel, dockGroups, REQUIRED_DOCK_VIEWS } from '../src/core/editor/docking.js'
import { dockMenuItems, revealDockPanel, dockPanelToggleActive, toggleDockPanel, resetDocking } from '../src/core/editor/view-dock-session.js'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const name = url => new URL(url).pathname.split('/').at(-1)
const state = () => ({ ui: { mode: 'desktop' }, prefs: { dockLayout: defaultDockLayout(), leftOpen: true, rightOpen: true, bottomOpen: true }, edit: { on: false }, paint: { on: false }, play: { on: false } })

test('los formatos de modelos admitidos tienen tres iconos distintos y disponibles', () => {
  const source = read('src/core/project.js')
  const formats = [...source.match(/export const MODEL_EXT = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  const urls = formats.map(ext => assetIcon({ kind: 'model', name: `test.${ext}` }))
  assert.deepEqual(formats, ['glb', 'gltf', 'obj'])
  assert.equal(new Set(urls).size, formats.length)
  for (const url of urls) assert.ok(existsSync(new URL(url)))
  assert.equal(assetIcon({kind:'model', name:'car.OBJ'}), assetIcon({kind:'model', ref:{ext:'.obj'}}))
  assert.equal(name(assetIcon({kind:'file', name:'car.fbx'})), 'icn_file_tiny.png')
})
test('todos los tipos del catálogo tienen arte propio, incluidos recursos temporales', () => {
  const source=read('src/core/project.js')
  const classify=source.slice(source.indexOf('export function fileKind('),source.indexOf('export const defaultFolderFor'))
  const catalog=source.slice(source.indexOf('export function allEntries('),source.indexOf('export function uniqueFileName('))
  const kinds=new Set(['folder', ...[...classify.matchAll(/return '([a-z]+)'/g)].map(m=>m[1]), ...[...catalog.matchAll(/kind: '([a-z]+)'/g)].map(m=>m[1]), 'timeline'])
  kinds.delete('file')
  const recognized=[...kinds]
  assert.equal(recognized.length,18)
  const urls=recognized.map(kind=>assetIcon({kind}))
  assert.equal(new Set(urls).size, recognized.length)
  for (const url of urls) assert.ok(existsSync(new URL(url)))
})
test('formatos auxiliares reconocidos por el runtime tienen arte sin reclasificar archivos', () => {
  for (const ext of ['hdr','exr','mtl']) assert.equal(name(assetIcon({kind:'file',name:`resource.${ext.toUpperCase()}`})),`asset_${ext}.svg`)
  assert.equal(name(assetIcon({kind:'file',name:'resource.xyz'})),'icn_file_tiny.png')
})
test('carpetas, material, script y fallback conservan el arte existente', () => {
  for (const [kind,file] of [['folder','icn_folder_close.png'],['script','icn_menu_script.png'],['material','icn_material_silueta.png'],['file','icn_file_tiny.png'],['unknown','icn_file_tiny.png']]) assert.equal(name(assetIcon({kind})),file)
  assert.equal(name(assetIcon({kind:'folder'},true)),'icn_folder_open.png')
})
test('cuadrícula y lista comparten el selector de arte y priorizan la miniatura real', () => {
  const panel=read('src/components/ProjectPanel.vue')
  assert.match(panel,/const artwork = \(it\) => assetIcon\(it, isSel\(it\)\)/)
  assert.match(panel,/v-if="it.kind === 'texture' && urls\[it.id\]"[\s\S]*?<img v-else class="asset-art" :src="artwork\(it\)"/)
  assert.equal((panel.match(/:src="artwork\(it\)"/g)||[]).length,1)
  assert.match(panel,/\.asset-list \.thumb/)
  for (const x of ['@dragstart="dragStart($event, it)"','@dblclick.stop="dblOpen(it)"','@contextmenu="itemMenu($event, it)"','@click.stop="tileClick($event, it)"']) assert.ok(panel.includes(x))
})
test('la barra conserva las tres vistas y las herramientas; Añadir vive en el menú y el atajo', () => {
  const toolbar=read('src/components/Toolbar.vue'), commands=read('src/core/commands.js')
  for (const label of ['Edit Mode','Play Mode','Code']) assert.ok(toolbar.includes(`>${label}</button>`))
  assert.doesNotMatch(toolbar,/class="dock-menu"|@click="openAdd"|v-for="\[id, ic, label, on\] in panels"/)
  assert.match(commands,/keys: 'Shift A', run: \(pos\) => openAddMenu\(pos\)/)
  assert.match(read('src/components/MenuBar.vue'),/openAddMenu\(/)
  assert.match(commands,/'dock.toggle', 'dock.panels'/)
  assert.match(commands,/children: \(\) => dockMenuItems\(store\)/)
  assert.match(commands,/typeof c.children === 'function' \? c.children\(\)/)
})
test('las tres acciones trasladadas alternan el panel y conservan el layout al mostrar otro', () => {
  const store=state()
  for (const [id,panel] of [['hierarchy','hierarchy'],['inspector','object'],['project','project']]) {
    revealDockPanel(store,panel)
    assert.equal(dockPanelToggleActive(store,id),true)
    toggleDockPanel(store,id)
    assert.equal(findDockPanel(store.prefs.dockLayout,panel)?.kind,'hidden')
    toggleDockPanel(store,id)
    assert.equal(findDockPanel(store.prefs.dockLayout,panel)?.kind,'dock')
  }
})
test('Mostrar panel revela el destino existente sin sustituir su región', () => {
  const store=state()
  const group=dockGroups(store.prefs.dockLayout.zones.center)[0].id
  store.prefs.dockLayout=moveDockPanel(store.prefs.dockLayout,'project','center',group,'right')
  const before=findDockPanel(store.prefs.dockLayout,'project')
  const panels=dockMenuItems(store).find(it=>it.label==='Mostrar panel').children
  panels.find(it=>it.label==='Proyecto').run()
  const after=findDockPanel(store.prefs.dockLayout,'project')
  assert.equal(after.zone,before.zone);assert.equal(after.groupId,before.groupId)
})
test('las herramientas contextuales se evalúan al abrir Ver, no al definir comandos', () => {
  const store=state()
  const labels=()=>dockMenuItems(store).find(it=>it.label==='Mostrar panel').children.map(it=>it.label)
  assert.ok(!labels().includes('Malla'));store.edit.on=true;assert.ok(labels().includes('Malla'))
  store.eventEditId='event';assert.ok(labels().includes('Event Editor'))
})
test('Restaurar disposición conserva las vistas obligatorias y tamaños anteriores', () => {
  const store=state()
  store.prefs.dockLayout=hideDockPanel(store.prefs.dockLayout,'project')
  dockMenuItems(store).find(it=>it.label==='Restaurar disposición').run()
  assert.deepEqual(store.prefs.dockLayout,defaultDockLayout())
  for(const id of REQUIRED_DOCK_VIEWS) assert.ok(findDockPanel(store.prefs.dockLayout,id))
  assert.equal(store.prefs.bottomH,210);assert.equal(store.prefs.rightW,296)
})
test('en modos compactos las tres acciones conservan los drawers', () => {
  const store=state();store.ui.mode='phone';store.ui.drawer=null
  const menu=dockMenuItems(store);assert.equal(menu.length,3)
  menu[2].run();assert.equal(store.ui.drawer,'project')
  dockMenuItems(store)[2].run();assert.equal(store.ui.drawer,null)
})
