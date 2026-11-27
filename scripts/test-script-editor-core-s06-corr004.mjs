// S06 CORR-004: análisis posicional y contrato de edición intacto.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mask } from '../src/core/editor/types-text.js'
import { createAnalysis, CONTEXTS, outlineForDocument } from '../src/core/editor/analysis.js'

const dts = readFileSync(new URL('../src/core/events/game-api.d.ts', import.meta.url), 'utf8')
const analysis = createAnalysis(dts)
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const source = 'game.node("Puerta");\nfunction _ready() {}\n'
const probe = source + '/* comentario sin cerrar'

for (const [name, code, cursor, expected] of [
  ['comentario de bloque posterior', probe, 1, false],
  ['comentario de bloque al final', probe, probe.length, true],
  ['comentario de línea posterior', source + '// final', 2, false],
  ['comentario de línea al final', source + '// final', (source + '// final').length, true],
  ['bloque cerrado, cursor dentro', '/* contenido */\ngame.log(1)', 6, true],
  ['bloque cerrado, cursor después', '/* contenido */\ngame.log(1)', 18, false],
  ['línea comentada, cursor siguiente línea', '// contenido\ngame.log(1)', 16, false],
  ['slashes en línea inicial', '///////\nfunction a() {}', 3, true],
  ['asteriscos sin comentario', '*******\nfunction a() {}', 4, false],
  ['cadena con delimitadores', 'const s="/*";\ngame.log(1)', 11, false],
  ['cursor antes de abrir comentario', '/* final', 0, false],
  ['cursor después de abrir comentario', '/* final', 2, true],
  ['cursor en cierre previo', '/* comentario */\n', 13, true],
  ['cursor después del cierre', '/* comentario */\n', 16, false],
]) {
  test(`CORR4 · mask posiciona ${name}`, () => assert.equal(mask(code, cursor).comment, expected))
}

test('CORR4 · mantiene enmascarado íntegro y EOF para outline/JSDoc', () => {
  const result = mask(probe, 0)
  assert.equal(result.text.length, probe.length)
  assert.equal(result.unclosedBlockStart, source.length)
  assert.equal(result.comment, false)
  assert.equal(mask(probe).comment, true)
  assert.equal(mask(probe).unclosedBlockStart, source.length)
  assert.ok(result.text.startsWith('game.node'))
})

test('CORR4 · cursor en string no es comentario y conserva comillas escapadas', () => {
  const s = 'const c="/* \\" prueba";\n// después'
  assert.equal(mask(s, 12).comment, false)
  assert.equal(mask(s, 12).string?.quote, '"')
  assert.equal(mask(s, s.length).comment, true)
  assert.equal(mask(s, 0).string, null)
})

test('CORR4 · texto posterior nunca inhabilita hover previo', () => {
  const desc = analysis.describeAt(probe, 2, CONTEXTS.script)
  assert.equal(desc?.word, 'game')
  assert.match(desc?.title || '', /Game/)
})

test('CORR4 · comentario previo sí bloquea hover dentro del comentario', () => {
  const s = '/* game.node() */\ngame.node("Puerta");'
  assert.equal(analysis.describeAt(s, 4, CONTEXTS.script), null)
  assert.equal(analysis.describeAt(s, s.indexOf('game.node', 16) + 2, CONTEXTS.script)?.word, 'game')
})

test('CORR4 · comentario posterior no cancela firma activa', () => {
  const s = 'game.node("Puerta"\n/* sin cerrar'
  const signature = analysis.signatureAt(s, 17, CONTEXTS.script)
  assert.equal(signature?.callee, 'game.node')
})

test('CORR4 · no se fabrican firmas dentro de comentario abierto', () => {
  const s = '/* game.node("Puerta"'
  assert.equal(analysis.signatureAt(s, s.length, CONTEXTS.script), null)
})

test('CORR4 · índice provisional permanece independiente del análisis de cursor', () => {
  const initial = outlineForDocument(source)
  const pending = outlineForDocument('/*' + source, initial.items, pos => pos + 2)
  assert.equal(pending.pending, true)
  assert.equal(pending.items.find(o => o.label === '_ready')?.provisional, true)
  assert.equal(mask('/*' + source, 0).comment, false)
})

test('CORR4 · integración mantiene CodeMirror como dueño de las transacciones', () => {
  const ui = read('../src/components/ScriptEditor.vue')
  assert.match(ui, /EditorView\.updateListener\.of/)
  assert.match(ui, /update\.state\.doc\.toString\(\)/)
  assert.match(ui, /setScriptCode\(sc\.value\.id, code\.value\)/)
  assert.match(ui, /update\.changes/)
  assert.doesNotMatch(ui, /EditorView\.inputHandler\.of|transactionFilter\.of|jsdocInputEdit/)
})

test('CORR4 · fixture verifica aislamiento y entrada nativa sin mocks', () => {
  const fixture = read('./fixtures/editor/script-editor-core-s06-corr004.html')
  const driver = read('./qa-electron-webgl.cjs')
  assert.match(fixture, /__lfNativeKeySteps/)
  assert.match(fixture, /__lfNativeKeyAfter/)
  assert.match(fixture, /EditorView\.findFromDOM/)
  assert.match(fixture, /setScriptCode|store\.project\.scripts/)
  assert.match(fixture, /cm-line/)
  assert.match(fixture, /\*\*\*\*\*\*\*/)
  assert.match(driver, /Input\.dispatchKeyEvent/)
})
