import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { snapEnabled, snapStep } from '../src/core/editor/snap.js'
import { readNumberDraft } from '../src/components/number-draft.js'
const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')

test('G005-01 · el snapping antiguo OFF se conserva en los tres ejes', () => {
  const s = { snap: false, gridSize: 1, rotSnap: 15, scaleSnap: 0.25 }
  for (const m of ['translate', 'rotate', 'scale']) assert.equal(snapEnabled(s, m), false)
})
test('G005-02 · el snapping antiguo ON se conserva', () => {
  for (const m of ['translate', 'rotate', 'scale']) assert.equal(snapEnabled({ snap: true }, m), true)
})
test('G005-03 · estados independientes, sin interferencia entre operaciones', () => {
  const s = { snap: true, moveSnapOn: false, rotateSnapOn: true, scaleSnapOn: false }
  assert.equal(snapEnabled(s, 'translate'), false)
  assert.equal(snapEnabled(s, 'rotate'), true)
  assert.equal(snapEnabled(s, 'scale'), false)
})
test('G005-04 · incrementos inválidos no causan división por cero', () => {
  assert.equal(snapStep({ gridSize: 0 }, 'translate'), 1)
  assert.equal(snapStep({ rotSnap: NaN }, 'rotate'), 15)
  assert.equal(snapStep({ scaleSnap: 0.2 }, 'scale'), 0.2)
})
test('G005-05 · formas numéricas completas, decimales y exponentes', () => {
  assert.equal(readNumberDraft('-12.50'), -12.5)
  assert.equal(readNumberDraft('0.'), 0)
  assert.equal(readNumberDraft('.75'), .75)
  assert.equal(readNumberDraft('1e2'), 100)
  assert.equal(readNumberDraft('1,25'), 1.25)
})
test('G005-06 · la edición incompleta no muta valores del modelo', () => {
  for (const s of ['', '-', '+', '1e', '--1', '.', '3..2']) assert.equal(readNumberDraft(s), null)
})
test('G005-07 · límites y valores no finitos', () => {
  assert.equal(readNumberDraft('20', 0, 10), 10)
  assert.equal(readNumberDraft('-5', 0, 10), 0)
  assert.equal(readNumberDraft('1e999'), null)
})
test('G005-08 · NumberField conserva un borrador y confirma en blur', () => {
  const src = read('src/components/NumberField.vue')
  assert.match(src, /const draft = ref/)
  assert.match(src, /@input="draft = \$event\.target\.value"/)
  assert.match(src, /@blur="confirm"/)
  assert.match(src, /@keydown\.esc="cancel"/)
  assert.match(src, /@pointermove="move"/)
})
test('G005-09 · TextField evita perder cursor y soporta Escape', () => {
  const src = read('src/components/TextField.vue')
  assert.match(src, /if \(!editing\.value\) draft\.value/)
  assert.match(src, /@blur="finish"/)
  assert.match(src, /@keydown\.esc="cancel"/)
})
test('G005-10 · Inspector y ParamForm consumen el campo compartido', () => {
  for (const f of ['Inspector.vue', 'ParamForm.vue']) assert.match(read('src/components/' + f), /<TextField/)
})
test('G005-11 · Viewport usa los tres toggles reales', () => {
  const src = read('src/components/SnapControls.vue')
  for (const key of ['moveSnapOn', 'rotateSnapOn', 'scaleSnapOn']) assert.ok(src.includes(key))
  assert.match(read('src/components/Toolbar.vue'), /<SnapControls/)
})
test('G005-12 · SnapControls conserva ajustes sin duplicarlos en ScenePanel', () => {
  const scene = read('src/components/ScenePanel.vue')
  const snap = read('src/components/SnapControls.vue')
  for (const key of ['moveSnapOn', 'rotateSnapOn', 'scaleSnapOn']) {
    assert.ok(snap.includes(key))
    assert.equal(scene.includes(key), false)
  }
  assert.doesNotMatch(scene, /<summary>Cuadrícula y snap<\/summary>/)
})
test('G005-13 · Object y MeshEdit respetan valores independientes', () => {
  for (const f of ['src/core/editor.js', 'src/core/mesh/session.js']) {
    const src = read(f)
    for (const mode of ['translate', 'rotate', 'scale']) assert.ok(src.includes(`snapEnabled(s, '${mode}')`))
  }
})
test('G005-14 · migra snapping antiguo cuando se normaliza el proyecto', () => {
  const src = read('src/core/project.js')
  for (const key of ['moveSnapOn', 'rotateSnapOn', 'scaleSnapOn']) assert.ok(src.includes(`${key}: oldSnap.${key} ?? oldSnap.snap ?? true`))
})
test('G005-15 · pestaña Color contextual comparte el mismo color que Inspector', () => {
  const src = read('src/components/ColorPickerPanel.vue')
  assert.match(src, /updateObject\(obj\.value\.id, \{ color: v \}/)
  assert.match(src, /commit\('Color de '/)
  assert.match(read('src/components/SceneTree.vue'), /<ColorPickerPanel/)
})
test('G005-16 · no se crea una segunda selección ni otro color persistente', () => {
  const src = read('src/components/ColorPickerPanel.vue')
  assert.match(src, /getObject\(store\.selectedId\)/)
  assert.doesNotMatch(src, /store\.project\.objects\.push/)
})
