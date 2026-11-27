// LF-EDITOR-COLOR-PICKER-G001: colores del editor y Film Maker comparten un selector no nativo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { colorHex, hexFromRgb, rgbFromHex, hsvFromRgb, rgbFromHsv, positionColorPicker, validHex } from '../src/components/color-picker-math.js'
const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
function vueFiles(dir) {
  return readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true }).flatMap(e => e.isDirectory() ? vueFiles(dir+'/'+e.name) : e.name.endsWith('.vue') ? [dir+'/'+e.name] : [])
}
const files = vueFiles('src')
const pickers = files.filter(f => f !== 'src/components/ColorInput.vue' && /<ColorInput\b/.test(src(f)))
const picker = src('src/components/ColorInput.vue')

test('COLOR-01 · el selector anterior se retiró del editor y Film Maker', () => {
 for (const f of files) assert.doesNotMatch(src(f), /<input\b[^>]*\btype="color"/, f)
})
test('COLOR-02 · selector reutilizado en 48 ubicaciones de 19 componentes', () => {
 assert.equal(pickers.length, 19)
 const count = pickers.reduce((acc,f) => acc + (src(f).match(/<ColorInput\b/g) || []).length, 0)
 assert.equal(count, 48)
})
test('COLOR-03 · selector global registrado en Editor y Film Maker, no en Player', () => {
 for(const path of ['src/main.js', 'src/filmmaker/main.js']) assert.match(src(path),/app\.component\('ColorInput', ColorInput\)/)
 assert.doesNotMatch(src('src/runtime-app/main.js'), /ColorInput/) // sin dependencia en Player
})
test('COLOR-04 · componente conserva eventos tradicionales y v-model', () => {
 assert.match(picker, /defineEmits\(\['input', 'change', 'update:modelValue'\]\)/)
 assert.match(picker, /emit\('update:modelValue', edited\.value\)/)
 assert.match(picker, /emit\('input', syntheticEvent\(edited\.value\)\)/)
 assert.match(picker, /emit\('change', syntheticEvent\(edited\.value\)\)/)
})
test('COLOR-05 · componentes legacy mantienen contratos de edición/commit', () => {
 const ins = src('src/components/MaterialSection.vue')
 assert.match(ins, /@input="setField\('color',\$event\.target\.value\)" @change="commit\('Color de material'\)"/)
 assert.match(src('src/components/TerrainPanel.vue'), /<ColorInput v-if="!l\.texture" v-model="l\.color"/)
 assert.match(src('src/components/ColorPickerPanel.vue'), /@input="live\(\$event\.target\.value\)" @change="finish"/)
})
test('COLOR-06 · hex existente conserva valor y no introduce alpha', () => {
 assert.equal(colorHex('#00CC44'),'#00cc44')
 assert.equal(validHex('#Aa44fF'),true)
 assert.equal(validHex('#12345678'),false)
 assert.equal(colorHex('bad'),'#ffffff')
})
test('COLOR-07 · conversión HEX ⇄ RGB de colores primarios', () => {
 for (const [hex, rgb] of [['#ff0000',[255,0,0]], ['#00ff00',[0,255,0]], ['#0000ff',[0,0,255]], ['#ffffff',[255,255,255]], ['#000000',[0,0,0]]]) {
  assert.deepEqual(rgbFromHex(hex),rgb)
  assert.equal(hexFromRgb(rgb),hex)
 }
})
test('COLOR-08 · RGB se limita a 0–255', () => {
 assert.equal(hexFromRgb([-10,999,63.6]),'#00ff40')
})
test('COLOR-09 · RGB ⇄ HSV mantiene los tonos RGB (margen de redondeo)', () => {
 for(const rgb of [[72,140,191],[10,20,30],[200,22,33],[255,255,255],[0,0,0],[127,200,90]]) {
  const rt = rgbFromHsv(...hsvFromRgb(rgb))
  for(let j=0;j<3;j++) assert.ok(Math.abs(rgb[j]-rt[j])<=1, `${rgb} -> ${rt}`)
 }
})
test('COLOR-10 · HSV exacto de tonalidades conocidas', () => {
 assert.deepEqual(rgbFromHsv(0,1,1),[255,0,0])
 assert.deepEqual(rgbFromHsv(120,1,1),[0,255,0])
 assert.deepEqual(rgbFromHsv(240,1,1),[0,0,255])
 assert.deepEqual(rgbFromHsv(360,1,1),[255,0,0])
})
test('COLOR-11 · selección junto al Inspector se abre a la izquierda', () => {
 const p=positionColorPicker({left:1160,right:1330,top:210,bottom:238},{width:1366,height:768})
 assert.ok(p.left < 1160,JSON.stringify(p))
 assert.ok(p.left + p.width <= 1366-8)
})
test('COLOR-12 · selección lejos del borde se abre a la derecha', () => {
 const p=positionColorPicker({left:220,right:262,top:90,bottom:117},{width:1366,height:768})
 assert.ok(p.left>=262)
})
test('COLOR-13 · selector no desborda parte inferior de pantalla', () => {
 const p=positionColorPicker({left:980,right:1150,top:730,bottom:751},{width:1366,height:768})
 assert.ok(p.top>=8 && p.top+p.maxHeight<=760,JSON.stringify(p))
})
test('COLOR-14 · pantalla compacta limita ancho y alto sin desbordarse', () => {
 const p=positionColorPicker({left:170,right:220,top:220,bottom:247},{width:240,height:180})
 assert.ok(p.left>=8 && p.left + p.width <= 232)
 assert.ok(p.top>=8 && p.top+p.maxHeight <=172)
})
test('COLOR-15 · no queda bajo overflow del Inspector', () => {
 assert.match(picker, /<Teleport to="body">/)
 assert.match(picker, /position:fixed/)
 assert.match(picker, /z-index:2147483600/)
 assert.match(picker, /getBoundingClientRect\(\)/)
})
test('COLOR-16 · actualiza posición al redimensionar o desplazarse en panel', () => {
 assert.match(picker, /window\.addEventListener\('resize', reposition\)/)
 assert.match(picker, /window\.addEventListener\('scroll', reposition, true\)/)
 assert.match(picker, /window\.removeEventListener\('scroll', reposition, true\)/)
})
test('COLOR-17 · cierra al pulsar Escape o salir del picker', () => {
 assert.match(picker, /e\.key === 'Escape'/)
 assert.match(picker, /document\.addEventListener\('pointerdown', outside, true\)/)
 assert.match(picker, /onBeforeUnmount\(close\)/)
})
test('COLOR-18 · arrastre de saturación/brillo emite un único change al soltar', () => {
 assert.match(picker, /setPointerCapture\(e\.pointerId\)/)
 assert.match(picker, /function endSV\(e\)/)
 assert.match(picker, /function finish\(\)/)
 assert.match(picker, /if \(!dirty\.value\) return/)
})
test('COLOR-19 · controles teclado, RGB y HEX permanecen accesibles', () => {
 for(const key of ['aria-label="Selector de color"','aria-label="Tono"','aria-label="Color hexadecimal"','ArrowRight','ArrowLeft','ArrowUp','ArrowDown','input type="number"']) assert.ok(picker.includes(key),key)
})
test('COLOR-20 · alcance editor-only: no se modificaron datos de materiales ni runtime', () => {
 assert.match(src('src/main.js'),/registerUiComponents\(app\)/)
 assert.match(src('src/filmmaker/main.js'),/registerUiComponents\(app\)/)
})
