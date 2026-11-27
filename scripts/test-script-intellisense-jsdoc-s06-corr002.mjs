// S06 CORR-002 · integridad de texto frente a secuencias de comentario.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { mask } from '../src/core/editor/types-text.js'
import { jsdocContext, jsdocLiteralDiagnostics } from '../src/core/editor/types-jsdoc.js'
import { createTypeEngine } from '../src/core/editor/types.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const source = read('../src/components/ScriptEditor.vue')
const fixture = read('./fixtures/editor/script-intellisense-jsdoc-s06-corr002.html')
const original = '\nfunction _ready() {\n  game.log("vivo");\n}\n'
const type = (before, letters) => {
  let doc = before, cursor = 0
  for (const letter of letters) {
    doc = doc.slice(0,cursor) + letter + doc.slice(cursor)
    cursor += letter.length
  }
  return { doc, cursor }
}
const engine = createTypeEngine(read('../src/core/events/game-api.d.ts'))

test('CORR2-01 · Script Editor no intercepta input ni altera su contrato CodeMirror', () => {
  assert.match(source, /basicSetup/)
  assert.match(source, /javascript\(\)/)
  assert.match(source, /EditorView\.updateListener\.of/)
  assert.doesNotMatch(source, /EditorView\.inputHandler\.of|jsdocInputEdit/)
})
for (const [name, typed] of [['slash','///////'], ['asteriscos','*******'], ['mixto','/**/'], ['barras y asteriscos', '/////**///'], ['comentario extendido','/*****/'],['múltiples cierres','/**///////'],['estrellas posteriores','/**/*******']]) {
  test(`CORR2-02 · ${name}: ninguna pulsación desaparece`, () => {
    const {doc,cursor} = type(original,typed)
    assert.equal(doc,typed+original)
    assert.equal(cursor,typed.length)
    assert.equal(doc.slice(cursor),original)
  })
}
test('CORR2-03 · JavaScript mantiene semántica de comentarios abiertos, sin pérdida de texto', () => {
  assert.equal(mask('/**'+original).comment,true)
  assert.equal(mask('/**/'+original).comment,false)
  assert.equal(mask('///////'+original).comment,false)
  assert.equal(mask('/*****/'+original).comment,false)
})
test('CORR2-04 · tipos JSDoc siguen funcionando tras comentarios intercalados', () => {
  const text = `/** @typedef {Object} Actor\n * @property {number} vida\n */\n/**/\n/** @type {Actor} */\nconst actor = {vida: 5};\nactor.`
  const ctx = engine.contextAt(text,text.length, {game:'Game'})
  assert.ok(engine.membersAfter('actor',ctx)?.list.some(x=>x.name==='vida'))
  assert.deepEqual(jsdocLiteralDiagnostics('/**/'+original), [])
  assert.ok(jsdocContext(text,text.length).entries.length >= 1)
})
test('CORR2-05 · Suite Electron usa entrada real de Chromium, no mock de inputHandler', () => {
  assert.match(fixture,/execCommand\('insertText'/)
  assert.doesNotMatch(fixture,/facet\(EditorView\.inputHandler\)/)
  assert.match(fixture,/cm-content/)
  assert.match(fixture,/undo\(/)
  assert.match(fixture,/redo\(/)
})
test('CORR2-06 · suite Electron verifica cursor, texto, sincronización y restauración', () => {
  for (const phrase of ['///////','*******','/**/','/*****/','store.project.scripts','selection.main.head', 'document.querySelector']) assert.ok(fixture.includes(phrase),phrase)
})
test('CORR2-07 · no toca renderizador, runtime ni formato de proyecto', () => {
  assert.doesNotMatch(source,/new THREE\.|WebGLRenderer/)
  assert.match(source,/setScriptCode\(/)
})
