// S06 CORR-003: índice de navegación estable sin alterar sintaxis ni texto JavaScript.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { outlineOf, outlineForDocument } from '../src/core/editor/analysis.js'
import { mask } from '../src/core/editor/types-text.js'

const source = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
const original = 'function _ready() {\n  game.log("vivo");\n}\n\nfunction _process(delta) {\n  game.log(delta);\n}\n'
const labels = (state) => state.items.map((x) => x.label)
const insertedAt = (text, pos, insert) => text.slice(0, pos) + insert + text.slice(pos)
const mapInsert = (position, insertAt, size) => position >= insertAt ? position + size : position

test('CORR3-01 · conserva índice real y el contrato de outlineOf', () => {
  assert.deepEqual(labels(outlineForDocument(original)), ['_ready', '_process'])
  assert.deepEqual(outlineForDocument(original).items, outlineOf(original))
  assert.equal(outlineForDocument(original).pending, false)
})
test('CORR3-02 · el comienzo de /* no borra funciones ni caracteres', () => {
  const initial = outlineForDocument(original)
  const text = '/*' + original
  const state = outlineForDocument(text, initial.items, (p) => p + 2)
  assert.equal(text.slice(2), original)
  assert.deepEqual(labels(state), ['_ready', '_process'])
  assert.equal(state.pending, true)
  assert.equal(state.unclosedBlockStart, 0)
  assert.ok(state.items.every((item) => item.provisional))
  assert.equal(state.items[0].pos, 2)
})
test('CORR3-03 · conserva índice tras varias transacciones dentro de comentario abierto', () => {
  let text = original, state = outlineForDocument(text)
  for (const key of '/*****') {
    const pos = text.length - original.length
    // Las pulsaciones se insertan al final del prefijo, como en CodeMirror.
    text = insertedAt(text, pos, key)
    state = outlineForDocument(text, state.items, (p) => mapInsert(p, pos, 1))
    assert.equal(state.items.length, 2)
  }
  assert.equal(text.slice(6), original)
  assert.ok(state.items.every((item) => item.provisional))
  assert.equal(state.items[1].pos, original.indexOf('function _process') + 6)
})
test('CORR3-04 · no modifica el análisis semántico de JavaScript: comentario sin cerrar', () => {
  const text = '/*' + original
  assert.equal(outlineOf(text).length, 0)
  assert.equal(mask(text).unclosedBlockStart, 0)
  assert.equal(outlineForDocument(text).items.length, 0) // Sin un índice previo, no inventar funciones.
})
test('CORR3-05 · cerrar comentario recupera el índice real, sin marcas provisionales', () => {
  const start = outlineForDocument(original)
  const pending = outlineForDocument('/*'+original,start.items,p=>p+2)
  const result = outlineForDocument('/**/'+original,pending.items,p=>p+2)
  assert.equal(result.pending,false)
  assert.equal(result.unclosedBlockStart,-1)
  assert.deepEqual(labels(result),['_ready','_process'])
  assert.ok(result.items.every((o)=>!o.provisional))
  assert.equal(result.items[0].pos,4)
})
test('CORR3-06 · anteponer /* entre métodos preserva el anterior y marca solo el posterior', () => {
  const initial=outlineForDocument(original)
  const cut=original.indexOf('function _process')
  const text=insertedAt(original,cut,'/*\n')
  const result=outlineForDocument(text,initial.items,p=>mapInsert(p,cut,3))
  assert.deepEqual(labels(result),['_ready','_process'])
  assert.equal(result.items[0].provisional,undefined)
  assert.equal(result.items[1].provisional,true)
  assert.equal(result.items[1].line,original.slice(0,cut).split('\n').length+1)
})
test('CORR3-07 · una edición adicional actualiza las líneas mediante el mapeo de cambios', () => {
  const initial=outlineForDocument(original)
  const p=outlineForDocument('/*'+original,initial.items,pos=>pos+2)
  const t='/*\n'+original
  const next=outlineForDocument(t,p.items,pos=>mapInsert(pos,2,1))
  assert.deepEqual(next.items.map(o=>o.line),[2,6])
  assert.ok(next.items.every(o=>o.provisional))
})
test('CORR3-08 · comentarios válidos, barras, asteriscos y cadenas no congelan el índice', () => {
  const samples=['///////\n','*******\n','/**/\n','/*****/\n','const texto = "/*";\n', '// /*\n']
  for(const sample of samples){
    const result=outlineForDocument(sample+original)
    assert.equal(result.pending,false,JSON.stringify(sample))
    assert.deepEqual(labels(result),['_ready','_process'],JSON.stringify(sample))
  }
})
test('CORR3-09 · comentario incompleto al final no vuelve provisionales funciones previas', () => {
  const text=original+'\n/*'
  const result=outlineForDocument(text,outlineForDocument(original).items)
  assert.equal(result.pending,true)
  assert.ok(result.items.every(o=>!o.provisional))
  assert.deepEqual(labels(result),['_ready','_process'])
})
test('CORR3-10 · comentario deliberadamente cerrado limpia el índice previo sin inventar funciones', () => {
  const initial=outlineForDocument(original)
  const pending=outlineForDocument('/*'+original,initial.items,pos=>pos+2)
  const text='/*'+original+'*/'
  const real=outlineForDocument(text,pending.items)
  assert.equal(real.pending,false)
  assert.deepEqual(real.items,[])
})
test('CORR3-11 · estado de navegación aislado por documento, nunca por nombre de función', () => {
  const previous=outlineForDocument(original)
  const other=outlineForDocument('function iniciar() {}\n')
  assert.deepEqual(labels(other),['iniciar'])
  assert.deepEqual(labels(outlineForDocument('/*'+original,previous.items,p=>p+2)),['_ready','_process'])
  assert.deepEqual(labels(outlineForDocument('/*'+original,other.items,p=>p+2)),['iniciar'])
})
test('CORR3-12 · Script Editor usa transacciones CodeMirror para posiciones y mantiene el store autoritativo', () => {
  const ui=source('../src/components/ScriptEditor.vue')
  assert.match(ui,/outlineByScript = new Map\(\)/)
  assert.match(ui,/changes\.mapPos\(pos, 1\)/)
  assert.match(ui,/refreshOutline\(code\.value, sc\.value\.id, update\.changes\)/)
  assert.match(ui,/setScriptCode\(sc\.value\.id, code\.value\)/)
  assert.match(ui,/\.is-provisional/)
  assert.match(ui,/Comentario de bloque sin cerrar/)
  assert.doesNotMatch(ui,/EditorView\.inputHandler\.of|jsdocInputEdit/)
})
test('CORR3-13 · panel de métodos distingue las posiciones provisionales y no las declara funciones activas', () => {
  const ui=source('../src/components/ScriptEditor.vue')
  assert.match(ui,/!o\.provisional && o\.line <= cursor\.value\.line/)
  assert.match(ui,/is-provisional': o\.provisional/)
  assert.match(ui,/status-comment/)
  assert.match(ui,/goTo\(o\.pos\)/)
})
test('CORR3-14 · CA-001 sigue protegiendo la escritura sin autocierre personalizado', () => {
  const ui=source('../src/components/ScriptEditor.vue')
  assert.match(ui,/basicSetup/)
  assert.match(ui,/javascript\(\)/)
  assert.doesNotMatch(ui,/transactionFilter\.of|inputHandler\.of/)
})
