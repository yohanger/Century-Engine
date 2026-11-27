import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import * as model from '../src/engine/runtime/ui/design.js'
import * as html from '../src/engine/runtime/ui/design-html.js'
import * as scripts from '../src/engine/runtime/ui/design-script.js'
import * as presets from '../src/engine/runtime/ui/dialog-presets.js'

const read = name => readFileSync(new URL(`../src/components/${name}`, import.meta.url), 'utf8')
const editor = read('UiEditor.vue')
const panel = read('UiDesignerPanel.vue')
const designer = read('designer.js')
const overlay = read('UiDesignOverlay.vue')
function instance(template = '') {
  const parts = { template, script: '', style: '', design: '' }
  const source = designer.replace(/^import .*$/gm, '').replace('export function createDesigner(', 'function createDesigner(')
  const context = { ...model, ...html, ...scripts, ...presets, reactive: x => x, structuredClone, crypto: globalThis.crypto }
  vm.runInNewContext(source + '\nglobalThis.factory = createDesigner;', context)
  const changes = []
  const D = context.factory({ getParts: () => parts, patch: out => { changes.push(out); Object.assign(parts, out) }, jump: () => {} })
  D.load()
  return { D, parts, changes }
}

test('UI-01: el diseñador distribuye paleta, vista previa e Inspector simultáneamente', () => {
  assert.match(editor, /class="body"\s+:class="\{ 'design-layout': designing \}"/)
  assert.match(editor, /section="library"/)
  assert.match(editor, /section="inspector"/)
  assert.match(editor, /<UiDesignOverlay v-if="designing"/)
  assert.match(editor, /ref="host" v-show=/)
})
test('UI-02: paneles redimensionables con ratón y teclado, sin persistencia en diseño', () => {
  assert.match(editor, /setPointerCapture\(e.pointerId\)/)
  assert.match(editor, /dockDown\('library'/)
  assert.match(editor, /dockDown\('inspector'/)
  assert.match(editor, /function dockKey/)
  assert.doesNotMatch(designer, /dockWidths/)
})
test('UI-03: layout para ventana estrecha, simulación plegable y herramientas contextuales', () => {
  assert.match(editor, /@container win \(max-width: 930px\)/)
  assert.match(editor, /<details class="simulation">/)
  assert.match(editor, /data-testid="ui-mode-designer"/)
  assert.match(editor, /data-testid="ui-mode-html"/)
})
test('UI-04: jerarquía visible, buscable, con controles de orden y arrastre interno', () => {
  assert.match(panel, /data-dock="controls"/)
  assert.match(panel, /v-model="filter"/)
  assert.match(panel, /@click="D.front\(\)"/)
  assert.match(panel, /@click="D.back\(\)"/)
  assert.match(panel, /@drop="onDrop\(\$event, c.id\)"/)
  assert.match(panel, /application\/x-lf-ui-control/)
})
test('UI-05: reparentado usa operación existente y no serializa estados visuales', () => {
  const { D, parts } = instance()
  const panelA = D.add('panel', {x:200,y:100})
  const btn = D.add('button', {x:230,y:125})
  const before = model.absRect(D.dz.design, btn)
  assert.equal(D.moveToParent(btn.id, panelA.id), true)
  assert.equal(model.byId(D.dz.design, btn.id).parent, panelA.id)
  assert.deepEqual({ ...model.absRect(D.dz.design, btn) }, { ...before })
  assert.equal(html.parseDesign(parts.design).controls.find(c=>c.id===btn.id).parent, panelA.id)
  assert.match(parts.template, /<button/)
})
test('UI-06: no permite contenedores no válidos ni ciclos', () => {
  const { D }=instance()
  const a=D.add('panel'), b=D.add('panel'), c=D.add('button')
  assert.equal(D.moveToParent(b.id,a.id),true)
  assert.equal(D.moveToParent(a.id,b.id),false)
  assert.equal(D.moveToParent(a.id,c.id),false)
  assert.equal(D.moveToParent(c.id,c.id),false)
  assert.equal(D.moveToParent(c.id,'missing'),false)
  assert.equal(D.moveToParent(c.id,null),false)
})
test('UI-07: mover a formulario mantiene las coordenadas y el diseño', () => {
  const {D}=instance()
  const parent=D.add('panel',{x:70,y:130}), child=D.add('button',{x:20,y:30},parent.id)
  const before=model.absRect(D.dz.design,child)
  assert.equal(D.moveToParent(child.id,null),true)
  assert.deepEqual({...model.absRect(D.dz.design,child)},{...before})
  assert.equal(model.byId(D.dz.design,child.id).parent,null)
})
test('UI-08: las acciones visuales no sobrescriben HTML manual', () => {
  const {D,parts,changes}=instance('<section class="personalizado">Original</section>')
  assert.equal(D.dz.legacy,true)
  assert.equal(D.dz.mode,'html')
  assert.equal(changes.length,0)
  assert.match(parts.template,/personalizado/)
})
test('UI-09: no se altera el contrato de guardado del .ui y generación de script', () => {
  const {D,parts}=instance()
  D.add('button',{x:23,y:18})
  assert.ok(parts.design)
  assert.ok(parts.template)
  assert.equal(html.templateInSync(html.parseDesign(parts.design),parts.template),true)
})
test('UI-10: Drag & Drop de Assets sigue usando ResourceDropSlot y no se sustituye por drag interno', () => {
  assert.match(panel, /import ResourceDropSlot from '\.\/ResourceDropSlot\.vue'/)
  assert.match(panel, /@assign="assignUiAsset/)
  assert.match(panel, /@assign="assignPortrait/)
  assert.match(panel, /if \(!id\) return\s+e.preventDefault\(\)/) // validar que el evento interno se detiene solo si tiene ID
})

test('UI-11: la jerarquía se recupera exactamente tras serializar y cargar de nuevo', () => {
  const {D,parts}=instance()
  const root=D.add('panel',{x:100,y:50})
  const label=D.add('label',{x:120,y:80})
  assert.equal(D.moveToParent(label.id,root.id),true)
  const snapshot=parts.design
  const loaded=html.parseDesign(snapshot)
  assert.equal(loaded.controls.find(c=>c.id===label.id)?.parent,root.id)
  assert.equal(html.templateInSync(loaded,parts.template),true)
})
test('UI-12: cambiar de contenedor inválido no escribe ni regenera la interfaz', () => {
  const {D,changes,parts}=instance()
  const p=D.add('panel'), b=D.add('button')
  const count=changes.length, code=parts.template, design=parts.design
  assert.equal(D.moveToParent(p.id,b.id),false)
  assert.equal(changes.length,count)
  assert.equal(parts.template,code)
  assert.equal(parts.design,design)
})
test('UI-13: el modelo previo sigue admitiendo orden Z, duplicación y eliminación', () => {
  const {D,parts}=instance()
  const a=D.add('button'),b=D.add('button')
  D.front(a.id);assert.equal(D.dz.design.controls.at(-1).id,a.id)
  D.back(a.id);assert.equal(D.dz.design.controls[0].id,a.id)
  D.duplicate(a.id);assert.equal(D.dz.design.controls.length,3)
  D.remove(b.id);assert.equal(D.dz.design.controls.length,2)
  assert.equal(html.templateInSync(html.parseDesign(parts.design),parts.template),true)
})
test('UI-14: HTML editado manualmente no se sustituye en la carga', () => {
  const base=instance();base.D.add('button')
  const userHtml=base.parts.template.replace('button', 'button data-owned-by="user"')
  const parts={...base.parts,template:userHtml}
  const context={...model,...html,...scripts,...presets,reactive:x=>x,structuredClone,crypto:globalThis.crypto}
  const source=designer.replace(/^import .*$/gm,'').replace('export function createDesigner(', 'function createDesigner(')
  vm.runInNewContext(source+'\nglobalThis.factory=createDesigner;',context)
  const writes=[];const D=context.factory({getParts:()=>parts,patch:v=>writes.push(v),jump:()=>{}})
  D.load()
  assert.equal(D.dz.stale,true)
  assert.equal(D.dz.mode,'html')
  assert.equal(writes.length,0)
  assert.equal(parts.template,userHtml)
})

test('UI-15: Inspector visible sin mutar estado de panel y resolución etiquetada', () => {
  assert.doesNotMatch(designer, /pane: 'tools'/)
  assert.doesNotMatch(overlay, /dz\.pane/)
  assert.match(editor, /aria-label="Resolución de la vista previa"/)
  assert.match(editor, /\{\{ r\[0\] \}\}/)
})
