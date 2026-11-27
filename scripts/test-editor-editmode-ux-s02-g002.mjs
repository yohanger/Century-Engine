import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultDockLayout, findDockPanel } from '../src/core/editor/docking.js'
import { revealDockPanel } from '../src/core/editor/view-dock-session.js'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const toolbar = read('src/components/Toolbar.vue')
const commands = read('src/core/commands.js')
const panel = read('src/components/MeshPanel.vue')
const dock = read('src/components/InspectorDock.vue')
const view = read('src/components/ViewBar.vue')
const app = read('src/App.vue')
const keymap = read('src/core/editor/keys.js')

const code = toolbar.split('</script>')[0].split('<script setup>')[1]
const store = {
  edit: { on: true, mode: 'vertex', count: { sv: 2, se: 0, sf: 0 }, hud: null, paint: { active: false } },
  ui: { mode: 'desktop', drawer: null }, prefs: { rightTab: 'object', rightOpen: false, dockLayout: defaultDockLayout() },
}
const computed = (f) => ({ get value() { return f() } })
const model = new Function('store', 'computed', 'revealDockPanel', `${code.match(/const meshTransforms = [^\n]+/)[0]}\n${code.match(/const meshActions = \{[\s\S]*?\n\}/)[0]}\n${code.match(/const selectedGeometry = computed\([\s\S]*?\n\}\)/)[0]}\n${code.match(/function canMeshAction\(id\) \{[\s\S]*?\n\}/)[0]}\n${code.match(/function openMeshPanel\(\) \{[\s\S]*?\n\}/)[0]}\nreturn {meshTransforms, meshActions, selectedGeometry, canMeshAction, openMeshPanel}`)(store, computed, revealDockPanel)

test('ED-S02-01: sólo una rama de herramientas de objetos fuera de edición/pintura', () => {
  assert.match(toolbar, /v-if="!store\.edit\.on && !store\.paint\.on"/)
  assert.match(toolbar, /aria-label="Herramientas de entorno"/)
  assert.match(toolbar, /aria-label="Transformar objetos"/)
  assert.match(toolbar, /v-else-if="store\.edit\.on"/)
})
test('ED-S02-02: el editor de malla no usa gizmos de objeto para sus transformaciones', () => {
  assert.deepEqual(model.meshTransforms.map(x=>x[0]), ['mesh.grab','mesh.rotate','mesh.scale'])
  for (const id of model.meshTransforms.map(x=>x[0])) assert.ok(commands.includes(`'${id}'`))
})
test('ED-S02-03: operaciones contextuales de vértices', () => {
  assert.deepEqual(model.meshActions.vertex.map(x=>x[0]), ['mesh.bevelVertex','mesh.merge.center'])
})
test('ED-S02-04: operaciones contextuales de aristas', () => {
  assert.deepEqual(model.meshActions.edge.map(x=>x[0]), ['mesh.bevel','mesh.loopcut'])
})
test('ED-S02-05: operaciones contextuales de caras', () => {
  assert.deepEqual(model.meshActions.face.map(x=>x[0]), ['mesh.extrude','mesh.inset'])
})
test('ED-S02-06: todas las operaciones enlazan comandos reales', () => {
  for (const actions of Object.values(model.meshActions)) for (const [id] of actions) assert.ok(commands.includes(`'${id}'`),id)
})
test('ED-S02-07: fusionar exige al menos dos vértices', () => {
  assert.equal(model.canMeshAction('mesh.merge.center'),true)
  store.edit.count.sv = 1
  assert.equal(model.canMeshAction('mesh.merge.center'),false)
  assert.equal(model.canMeshAction('mesh.bevelVertex'),true)
})
test('ED-S02-08: modo arista tiene estado de selección propio', () => {
  store.edit.mode='edge';store.edit.count.se=0
  assert.equal(model.selectedGeometry.value,0)
  assert.equal(model.canMeshAction('mesh.bevel'),false)
  assert.equal(model.canMeshAction('mesh.loopcut'),true)
  store.edit.count.se=3
  assert.equal(model.canMeshAction('mesh.bevel'),true)
})
test('ED-S02-09: modo cara tiene estado de selección propio', () => {
  store.edit.mode='face';store.edit.count.sf=0
  assert.equal(model.canMeshAction('mesh.extrude'),false)
  store.edit.count.sf=2
  assert.equal(model.canMeshAction('mesh.inset'),true)
})
test('ED-S02-10: HUD modal y pintura bloquean operaciones concurrentes', () => {
  store.edit.hud='Valor: 0.5'
  assert.equal(model.canMeshAction('mesh.loopcut'),false)
  assert.equal(model.canMeshAction('mesh.inset'),false)
  store.edit.hud=null;store.edit.paint.active=true
  assert.equal(model.canMeshAction('mesh.inset'),false)
  store.edit.paint.active=false
})
test('ED-S02-11: abrir panel Malla reutiliza dock del Inspector desktop', () => {
  model.openMeshPanel()
  assert.equal(store.prefs.rightTab,'mesh')
  assert.equal(store.prefs.rightOpen,true)
  assert.equal(findDockPanel(store.prefs.dockLayout,'mesh').active,true)
  assert.match(dock, /<MeshPanel v-if="tab === 'mesh'"/)
})
test('ED-S02-12: en móvil abre el drawer existente', () => {
  store.ui.mode='mobile';store.ui.drawer=null;store.prefs.rightOpen=false
  model.openMeshPanel()
  assert.equal(store.ui.drawer,'inspector')
  assert.equal(store.prefs.rightTab,'mesh')
})
test('ED-S02-13: añadir geometría reutiliza add.menu y la rama Edit Mesh existente', () => {
  assert.match(read('src/components/MenuBar.vue'), /openAddMenu\(\{ x: r\.left, y: r\.bottom \+ 2 \}\)/)
  assert.match(commands,/if \(store\.edit\.on\) return ed\.openEditAddMenu\(pos\)/)
  assert.match(commands,/keys: 'Shift A', run: \(pos\) => openAddMenu\(pos\)/)
  assert.doesNotMatch(toolbar, /@click="openAdd"/)
})
test('ED-S02-14: Snap y opciones de malla utilizan los controles anteriores', () => {
  for (const id of ['mesh.xray','mesh.proportional','mesh.mirror','mesh.edit']) assert.match(toolbar,new RegExp(id.replace('.','\\.')))
  assert.match(toolbar,/<SnapControls \/>/)
  assert.match(toolbar,/command\(id\)\.checked\(\)/)
})
test('ED-S02-15: malla tiene bloqueo modal y botón de salir explícito', () => {
  assert.match(toolbar, /data-testid="mesh-exit"/)
  assert.match(toolbar, /run\('mesh\.edit'\)/)
  assert.match(toolbar, /:disabled="!!store\.edit\.hud"/)
})
test('ED-S02-16: sin FOV ni render; CA-002 recupera solo acceso directo ratón/trackpad', () => {
  assert.doesNotMatch(view,/editorFov|renderMethod|gizmoSize/)
  assert.match(view,/nav\.mouse/)
  assert.match(view,/nav\.trackpad/)
  assert.doesNotMatch(toolbar,/editorFov|renderMethod|camera\.pilot/)
})
test('ED-S02-17: se conserva el panel de modelado detallado y sus parámetros', () => {
  for (const s of ['Bisel: ancho','Bisel: segmentos','Transformación precisa','Edición proporcional','Proyección caja']) assert.ok(panel.includes(s),s)
})
test('ED-S02-18: las herramientas no cambian handlers ni historial de geometría', () => {
  assert.match(toolbar, /@click="run\(id\)"/)
  assert.match(app, /store\.prefs\.rightTab = 'mesh'/)
  assert.match(keymap, /if \(this\.edit && k !== 'tab' && this\.edit\.onKey\(e\)\)/)
})
test('ED-S02-19: botones accesibles, scroll horizontal y puntos de quiebre', () => {
  assert.match(toolbar,/aria-pressed="store\.edit\.mode === m"/)
  assert.match(toolbar,/role="group" aria-label="Transformar geometría"/)
  assert.match(toolbar,/overflow-x: auto/)
  assert.match(toolbar,/@media \(max-width: 1450px\)/)
  assert.match(toolbar,/:focus-visible/)
})
