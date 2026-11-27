// CORR-003 QA-001: la navegación entre recursos no puede depender del orden visual.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fixture = readFileSync(new URL('./fixtures/editor/script-intellisense-jsdoc-s06-corr003.html', import.meta.url), 'utf8')
const editor = readFileSync(new URL('../src/components/ScriptEditor.vue', import.meta.url), 'utf8')

test('C3-QA01 · el orden visible alfabético difiere del orden de scripts del fixture', () => {
  const names = ['Uno.js', 'Dos.js']
  assert.deepEqual([...names].sort((a,b)=>a.localeCompare(b,'es')),['Dos.js','Uno.js'])
  assert.match(editor,/items\.sort\(\(a, b\) => a\.name\.localeCompare\(b\.name, 'es'\)\)/)
  assert.match(fixture,/name:'Uno\.js'/)
  assert.match(fixture,/name:'Dos\.js'/)
})

test('C3-QA02 · selecciona por identidad de ruta, nunca por índice visual', () => {
  assert.match(fixture,/const selectById=async\(id\)=>/)
  assert.match(fixture,/find\(s=>s\.id===id\)/)
  assert.match(fixture,/el\.getAttribute\('title'\)===`\$\{resource\.folder\}\/\$\{resource\.name\}`/)
  assert.doesNotMatch(fixture,/querySelectorAll\('\.se-file'\)\[\d+\]/)
})

test('C3-QA03 · valida script activo y documento antes de comprobar su índice', () => {
  const begin=fixture.indexOf('const selectById=async(id)=>')
  const end=fixture.indexOf('\n  const exact=',begin)
  const functionSource=fixture.slice(begin,end)
  assert.match(functionSource,/store\.scriptEditId===id/)
  assert.match(functionSource,/view\.state\.doc\.toString\(\)===resource\.code/)
  assert.match(fixture,/await selectById\('b'\)\s*check\('C3-E15/)
  assert.match(fixture,/await selectById\('a'\)\s*check\('C3-E18/)
})

test('C3-QA04 · la prueba mantiene continuidad de CodeMirror y geometría', () => {
  assert.match(fixture,/C3-E16 conserva la instancia original/)
  assert.match(fixture,/C3-E17 cambio de script no altera geometría/)
  assert.match(fixture,/C3-E18 al regresar conserva los dos métodos/)
  assert.match(fixture,/C3-E19 conserva la edición y contexto del primer script/)
})

test('C3-QA05 · el arreglo es del fixture, no altera semántica del editor', () => {
  assert.match(editor,/outlineByScript = new Map\(\)/)
  assert.match(editor,/refreshOutline\(next, id\)/)
  assert.doesNotMatch(editor,/EditorView\.inputHandler\.of/)
})
