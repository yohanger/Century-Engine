// S04 CORR-002: estilo del shell, controles dentro del marco y libertad de movimiento.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const read = name => readFileSync(new URL('../'+name, import.meta.url),'utf8')
const script = read('src/components/ScriptEditor.vue')
const shell = read('src/components/FloatingEditorWindow.vue')
const fixture = read('scripts/fixtures/editor/script-editor-godot-ux-s04-g001-integral.html')
const css=script.slice(script.indexOf('<style scoped>'))
function fragment(name, stop) {
  const start=shell.indexOf('function '+name+'(')
  const end=shell.indexOf('\nfunction '+stop+'(',start)
  assert.ok(start>=0 && end>start)
  return shell.slice(start,end)
}
test('SE-C02-01 · el Script Editor utiliza la paleta grafito del Editor',()=>{
  assert.match(css,/\.edwin\.se.*--se-rail:#0e1217.*--se-status:#0878ca/)
  assert.match(css,/\.se-sidebar.*var\(--se-sidebar\)/)
  assert.match(css,/\.se-commands.*#10141a/)
  assert.match(css,/\.se-file\.active.*var\(--se-accent\)/)
  assert.doesNotMatch(css, /#(?:1c2026|22272f|292e36|394755|374351)\b/i)
})
test('SE-C02-02 · barra de título real y acciones dentro del marco',()=>{
  assert.match(script,/:integrated-titlebar="true"/)
  assert.doesNotMatch(script,/<h2 class="script-header"/)
  assert.match(shell, /integratedTitlebar: \{ type: Boolean, default: false \}/)
  assert.match(shell, /class="floating-editor-chrome"/)
  assert.match(shell,/class="floating-editor-actions" data-no-window-drag/)
  assert.match(shell,/class="floating-editor-action close"/)
  assert.match(shell,/floating-editor-window\.has-titlebar :deep\(\.edwin\)/)
})
test('SE-C02-03 · el arrastre no obliga a encajar toda la ventana',()=>{
  const position={left:25,top:50}
  const viewport={width:1100,height:700}
  const width={value:1000}
  const context={position,viewport,width,topMargin:44,Math}
  vm.runInNewContext(fragment('clampGrabPosition','toggleMaximize')+'\nthis.clampGrabPosition=clampGrabPosition;',context)
  position.left=-390; position.top=110
  context.clampGrabPosition()
  assert.equal(position.left,-390)
  assert.equal(position.top,110)
  position.left=-9999;position.top=9000
  context.clampGrabPosition()
  assert.equal(position.left,-904)
  assert.equal(position.top,664)
})
test('SE-C02-04 · movimiento real cambia X e Y sin ajuste a ventana completa',()=>{
  const position={left:25,top:50},viewport={width:1100,height:700},width={value:1000}
  const context={position,viewport,width,topMargin:44,Math,drag:{id:7,x:150,y:70,left:25,top:50}}
  vm.runInNewContext(fragment('clampGrabPosition','toggleMaximize')+'\n'+fragment('moveDrag','endDrag')+'\nthis.moveDrag=moveDrag;',context)
  context.moveDrag({pointerId:7,clientX:-100,clientY:170})
  assert.equal(position.left,-225)
  assert.equal(position.top,150)
  context.moveDrag({pointerId:9,clientX:0,clientY:0})
  assert.equal(position.left,-225)
})
test('SE-C02-05 · el fixture Electron mide color, cierre y desplazamiento',()=>{
  for(const expression of ['Barra de título propia','Cerrar y acoplar','superficie grafito','La ventana se mueve horizontal y verticalmente','pointermove']) assert.ok(fixture.includes(expression),expression)
  assert.match(shell,/if \(!drag\) clampPosition\(\)/)
  assert.match(shell,/dimensions\.h = rect\[3\]\n  \/\/ Guardar un flotante no debe deshacer su desplazamiento horizontal\.\n  clampGrabPosition\(\)/)
  assert.ok(!fragment('moveDrag','endDrag').includes('clampPosition()'))
})
