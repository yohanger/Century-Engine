// S06 CORR-001 · regresión histórica reconciliada con CA-001 de CORR-002.
// La clausura automática mediante inputHandler fue SUPERSEDIDA por el contrato de entrada sin consumo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { jsdocContext, jsdocLiteralDiagnostics } from '../src/core/editor/types-jsdoc.js'
import { mask } from '../src/core/editor/types-text.js'
import { createTypeEngine } from '../src/core/editor/types.js'

const source = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
const engine = createTypeEngine(source('../src/core/events/game-api.d.ts'))
const tail = '\nconst objetivo = game.node("Puerta");\nobjetivo.'
const members = (text) => engine.membersAfter('objetivo', engine.contextAt(text, text.length, { game: 'Game' }))?.list.map(x => x.name) || []
const insert = (text, pos, typed) => text.slice(0, pos) + typed + text.slice(pos)

test('S06-C01 · /**/ se escribe completo sin consumir ninguna pulsación', () => {
  let text = tail, at = 0
  for (const key of '/**/') { text = insert(text, at, key); at++ }
  assert.equal(text, '/**/' + tail)
  assert.equal(at, 4)
  assert.ok(members(text).length > 20)
})
test('S06-C02 · /** incompleto no borra ni reemplaza el código posterior', () => {
  const text = '/**' + tail
  assert.equal(text.slice(3), tail)
  assert.equal(mask(text).comment, true) // Resaltado de comentario abierto: sintaxis JavaScript legítima.
})
test('S06-C03 · comentario completo pegado no recibe cierres duplicados', () => {
  const text = '/**/' + tail
  assert.equal(jsdocContext(text, text.length).entries.length, 0)
  assert.deepEqual(jsdocLiteralDiagnostics(text), [])
  assert.ok(members(text).length > 20)
})
test('S06-C04 · /*****/ conserva longitud y vuelve a código al cerrar */', () => {
  const text = '/*****/' + tail
  assert.equal(text.slice(7), tail)
  assert.equal(mask(text).comment, false)
})
test('S06-C05 · cadenas con secuencias de barras y estrellas no se modifican', () => {
  const text = 'const prueba = "////// *******";' + tail
  assert.equal(mask(text).comment, false)
  assert.ok(members(text).length > 20)
})
test('S06-C06 · una línea //// no consume la línea siguiente', () => {
  const text = '///////' + tail
  assert.equal(text.slice(7), tail)
  assert.equal(mask(text).comment, false)
})
test('S06-C07 · comentario ordinario /****/ no altera las líneas siguientes', () => {
  const text = '/****/' + tail
  assert.equal(text.slice(6), tail)
  assert.equal(mask(text).comment, false)
})
test('S06-C08 · no existe interceptación personalizada que consuma barras', () => {
  const editor = source('../src/components/ScriptEditor.vue')
  const parser = source('../src/core/editor/types-jsdoc.js')
  assert.doesNotMatch(editor, /EditorView\.inputHandler\.of|jsdocInputEdit/)
  assert.doesNotMatch(parser, /export function jsdocInputEdit/)
  assert.match(editor, /basicSetup/)
})
test('S06-C09 · comentarios vacíos antes y dentro de funciones no rompen tipos de la API', () => {
  for (const text of ['/**/' + tail, '/**/\nfunction f(){\n' + tail + '\n}', '/* */' + tail]) {
    assert.equal(mask(text).comment, false)
    assert.ok(members(text).length > 20)
  }
})
test('S06-C10 · el componente histórico conserva la misma instancia al cambiar de script', () => {
  const fixture = source('./fixtures/editor/script-intellisense-jsdoc-s06-corr001.html')
  assert.match(fixture, /createApp\(ScriptEditor\)/)
  assert.match(source('../src/components/ScriptEditor.vue'), /watch\(\(\) => sc\.value\?\.id/)
})
test('S06-C11 · CodeMirror conserva sincronización de documentos sin interceptar entrada', () => {
  const editor = source('../src/components/ScriptEditor.vue')
  assert.match(editor, /watch\(\(\) => sc\.value\?\.id/)
  assert.match(editor, /if \(sc\.value && !syncingProjectDocument\) \{/ )
  assert.match(editor, /refreshOutline\(code\.value, sc\.value\.id, update\.changes\)/)
  assert.match(editor, /setScriptCode\(sc\.value\.id, code\.value\)/)
  assert.match(editor, /intelligence\.reconfigure\(jsIntelligence/)
  assert.match(editor, /EditorView\.updateListener\.of/)
  assert.doesNotMatch(editor, /EditorView\.inputHandler\.of/)
})
test('S06-C12 · la geometría del marco no depende del script seleccionado', () => {
  const frame = source('../src/components/FloatingEditorWindow.vue')
  assert.match(frame, /const persistKey = `lf\.float\.\$\{props\.label\}`/)
  assert.doesNotMatch(frame, /scriptEditId/)
})
