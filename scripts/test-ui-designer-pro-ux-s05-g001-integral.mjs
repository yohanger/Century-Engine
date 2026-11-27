// Regresión integral UX del diseñador existente: no sustituye el modelo ni el formato .ui.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { parseUi, composeUi } from '../src/engine/runtime/ui/sfc.js'
import * as model from '../src/engine/runtime/ui/design.js'
import * as html from '../src/engine/runtime/ui/design-html.js'
import * as scripts from '../src/engine/runtime/ui/design-script.js'
import * as presets from '../src/engine/runtime/ui/dialog-presets.js'

const read = name => readFileSync(new URL('../src/components/' + name, import.meta.url), 'utf8')
const editor = read('UiEditor.vue')
const panel = read('UiDesignerPanel.vue')
const overlay = read('UiDesignOverlay.vue')
const designer = read('designer.js')
const make = (template = '') => {
  const parts = { attrs:{}, template, script:'', style:'', design:'' }
  const changes = []
  const source = designer.replace(/^import .*$/gm, '').replace('export function createDesigner(', 'function createDesigner(')
  const ctx = {...model,...html,...scripts,...presets,reactive:x=>x,structuredClone,crypto:globalThis.crypto}
  vm.runInNewContext(source+'\nglobalThis.create = createDesigner;', ctx)
  const D=ctx.create({getParts:()=>parts,patch:out=>{changes.push(out);Object.assign(parts,out)},jump:()=>{}})
  D.load()
  return {D,parts,changes}
}

test('UX05-01 · paleta, jerarquía, canvas e inspector reutilizan tres componentes aprobados',()=>{
  assert.match(editor,/<UiDesignerPanel v-if="tab === 'template'/)
  assert.match(editor,/section="library"/)
  assert.match(editor,/section="inspector"/)
  assert.match(editor,/<UiDesignOverlay v-if="designing"/)
  assert.equal((editor.match(/const D = createDesigner\(/g) || []).length,1)
})
test('UX05-02 · búsqueda de herramientas utiliza CONTROL_TYPES y CONTROLS originales',()=>{
  assert.match(panel,/const visibleGroups = computed\(/)
  assert.match(panel,/const groups = computed\(/)
  assert.match(panel,/CONTROL_GROUPS\.map/)
  assert.match(panel,/CONTROLS\[t\]\.label/)
  assert.match(panel,/normalize\('NFD'\)/)
  assert.match(panel,/v-model="toolFilter"/)
  assert.match(panel,/v-for="g in visibleGroups"/)
  assert.match(panel,/No hay herramientas con ese nombre/)
})
test('UX05-03 · grupos plegables y botones con estado ARIA sin duplicar herramientas',()=>{
  assert.match(panel,/<details v-for="g in visibleGroups"/)
  assert.match(panel,/<summary>\{\{ g\.label \}\}/)
  assert.match(panel,/:aria-pressed="dz\.tool === t"/)
  assert.match(panel,/@click="D\.setTool\(t\)"/)
  assert.match(panel,/@dblclick="D\.addDefault\(t\)"/)
})
test('UX05-04 · jerarquía continúa seleccionando, buscando y moviendo mediante API existente',()=>{
  assert.match(panel,/role="tree" aria-label="Controles del formulario"/)
  assert.match(panel,/:aria-selected="dz\.sel === c\.id"/)
  assert.match(panel,/@keydown\.enter\.prevent="D\.select\(c\.id\)"/)
  assert.match(panel,/@keydown\.space\.prevent="D\.select\(c\.id\)"/)
  assert.match(panel,/@drop="onDrop\(\$event, c\.id\)"/)
  assert.match(panel,/D\.moveToParent\(id, parentId\)/)
})
test('UX05-05 · Inspector diferencia formulario y control real con las propiedades originales',()=>{
  assert.match(panel,/data-testid="ui-inspector-selection"/)
  assert.match(panel,/sel \? sel\.name : 'Formulario'/)
  assert.match(panel,/CONTROLS\[sel\.type\]\.label/)
  assert.match(panel,/v-for="\[cat, list\] in cats"/)
  assert.match(panel,/@change="D\.setProp\(sel\.id, p\.key/)
  assert.match(panel,/@change="D\.setForm\('kind'/)
  assert.match(panel,/@change="D\.setEvent\(sel\.id/)
})
test('UX05-06 · Canvas agrupa pantalla, zoom y Snap sin alterar resolución de diseño',()=>{
  assert.match(editor,/role="toolbar" aria-label="Herramientas del Canvas"/)
  assert.match(editor,/data-testid="ui-canvas"/)
  assert.match(editor,/aria-label="Resolución de la vista previa"/)
  assert.match(editor,/v-model="zoom"/)
  assert.match(editor,/v-model="D\.dz\.snap"/)
  assert.match(editor,/v-model\.number="D\.dz\.grid" aria-label="Paso de snap"/)
  assert.match(editor,/<UiRoot :manager="pm"/)
})
test('UX05-07 · selección y controles activos comparten acento del Editor, no overlay modal',()=>{
  assert.match(panel,/\.list li\.on \{[^}]*var\(--amber\)/)
  assert.match(panel,/\.tool-group \.tools button\.on \{[^}]*var\(--amber\)/)
  assert.match(overlay,/\.box\.sel \{[^}]*var\(--amber/)
  assert.doesNotMatch(overlay,/background: rgba\(61, 155, 255/)
})
test('UX05-08 · las herramientas de Snap y medidas no se serializan en .ui',()=>{
  const {D,parts,changes}=make()
  D.dz.snap=false;D.dz.grid=16
  assert.equal(changes.length,0)
  D.add('button',{x:18,y:20})
  assert.ok(parts.design)
  assert.equal(html.templateInSync(html.parseDesign(parts.design),parts.template),true)
  assert.equal('snap' in html.parseDesign(parts.design).form,false)
})
test('UX05-09 · cambios visuales no sobrescriben HTML escrito a mano',()=>{
  const source='<section data-custom="mio">Interfaz manual</section>'
  const {D,parts,changes}=make(source)
  assert.equal(D.dz.mode,'html')
  assert.equal(changes.length,0)
  assert.equal(parts.template,source)
})
test('UX05-10 · generación de elementos conserva formato .ui y símbolos requeridos',()=>{
  const {D,parts}=make()
  const c=D.add('button',{x:40,y:32})
  D.setProp(c.id,'text','Aceptar')
  const exported=composeUi(parts), roundTrip=parseUi(exported)
  assert.equal(roundTrip.design,parts.design)
  assert.equal(roundTrip.template,parts.template)
  assert.equal(html.templateInSync(html.parseDesign(roundTrip.design),roundTrip.template),true)
})
test('UX05-11 · Asset DnD no se confunde con arrastre de jerarquía',()=>{
  assert.match(panel,/import ResourceDropSlot from '\.\/ResourceDropSlot\.vue'/)
  assert.match(panel,/application\/x-lf-ui-control/)
  assert.match(panel,/@assign="assignUiAsset/)
  assert.match(panel,/@assign="assignPortrait/)
})
test('UX05-12 · redimensionamiento y responsive de S03 permanecen',()=>{
  assert.match(editor,/dockDown\('library'/)
  assert.match(editor,/dockDown\('inspector'/)
  assert.match(editor,/@container win \(max-width: 930px\)/)
  assert.match(editor,/class="dock-splitter"/)
})
test('UX05-13 · preview y simulación no guardan datos en el proyecto',()=>{
  assert.match(editor,/const mock = reactive\(/)
  assert.match(editor,/<UiRoot :manager="pm"/)
  assert.match(editor,/<details class="simulation">/)
  assert.match(editor,/pm\.state\.preview/)
})
test('UX05-14 · la ventana usa AppWindow y mantiene toolbar de diseño, código y preview',()=>{
  assert.match(editor,/<AppWindow dock-panel-id="uiEditor"/)
  assert.match(editor,/data-testid="ui-mode-designer"/)
  assert.match(editor,/data-testid="ui-mode-html"/)
  assert.match(editor,/v-for="\[k, l\] in \[\['template', 'Plantilla'\]/)
  assert.match(editor,/<div v-if="designing" class="canvas-status"/)
})
test('UX05-15 · pruebas Electron previstas cubren montaje real y guardado del .ui',()=>{
  const electron=readFileSync(new URL('./test-ui-designer-pro-ux-s05-g001-integral-electron.mjs',import.meta.url),'utf8')
  const fixture=readFileSync(new URL('./fixtures/editor/ui-designer-pro-ux-s05-g001-integral.html',import.meta.url),'utf8')
  assert.match(electron,/verifyWebGL\(/)
  assert.match(fixture,/import UiEditor from/)
  assert.match(fixture,/doubleClick|dblclick/)
  assert.match(fixture,/parseUi\(/)
  assert.match(fixture,/dataset\.pass='true'/)
})
