import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const fixture = read('./fixtures/editor/script-intellisense-jsdoc-s06-corr002.html')
const runner = read('./qa-electron-webgl-runner.mjs')
const electron = read('./qa-electron-webgl.cjs')
const spec = read('./test-script-intellisense-jsdoc-s06-corr002-electron.mjs')

test('S06-QA01 · el fixture escribe caracteres en CodeMirror real, no en un mock', () => {
  assert.match(fixture, /document\.execCommand\('insertText',false,char\)/)
  assert.match(fixture, /EditorView\.findFromDOM\(el\)/)
  assert.match(fixture, /view\.state\.doc\.toString\(\)/)
  assert.match(fixture, /store\.project\.scripts\[0\]\.code===doc/)
})

test('S06-QA02 · no depende de requestAnimationFrame en Electron oculto', () => {
  assert.doesNotMatch(fixture, /new Promise\(requestAnimationFrame\)/)
  assert.match(fixture, /new Promise\(resolve=>setTimeout\(resolve,20\)\)/)
})

test('S06-QA03 · el estado diagnóstico progresa por comprobación y recoge fallos', () => {
  assert.match(fixture, /output\.dataset\.stage=value/)
  assert.match(fixture, /stage\(name\)/)
  assert.match(fixture, /stage:output\.dataset\.stage/)
  assert.match(electron, /checks:el\?\.dataset\.checks/)
  assert.match(electron, /codeMirror:!!document\.querySelector/)
})

test('S06-QA04 · timeout ampliado solo por la fixture S06', () => {
  assert.match(runner, /fixtureWaitMs=20000/)
  assert.match(runner, /LF_QA_FIXTURE_WAIT_MS:String\(fixtureWaitMs\)/)
  assert.match(electron, /Number\(process\.env\.LF_QA_FIXTURE_WAIT_MS\)/)
  assert.match(spec, /fixtureWaitMs:50000/)
  assert.match(spec, /timeout: 100000/)
})

test('S06-QA05 · conserva Undo Redo, cursores, store y navegación', () => {
  for (const token of ['undo(view)', 'redo(view)', 'setCursor()', 'Cambio de script', 'store.project.scripts[0].code===doc']) {
    if (token === 'Cambio de script') assert.match(fixture, /Cambiar documento conserva CódigoMirror/)
    else assert.ok(fixture.includes(token), token)
  }
})
