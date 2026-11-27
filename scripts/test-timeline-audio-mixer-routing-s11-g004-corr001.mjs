import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Contrato estable entre fixture y runner Electron embebido.
const fixture = readFileSync(new URL('./fixtures/editor/timeline-audio-mixer-routing-s11-g004.html', import.meta.url), 'utf8')
const runner = readFileSync(new URL('./qa-electron-webgl.cjs', import.meta.url), 'utf8')

function reportPayload(success) {
  const marker = `JSON.stringify({pass:${success},`
  assert.equal(fixture.split(marker).length - 1, 1, `La fixture debe emitir ${marker} exactamente una vez`)
}

test('CORR001-01 · el resultado exitoso de la fixture declara pass:true', () => {
  reportPayload('true')
  assert.match(fixture, /report\.dataset\.pass='true'/)
})

test('CORR001-02 · el error de la fixture declara pass:false', () => {
  reportPayload('false')
  assert.match(fixture, /report\.dataset\.pass='false'/)
})

test('CORR001-03 · el runner compartido exige pass del DOM y del JSON', () => {
  assert.match(runner, /result\.pass==='true' && parsed\.pass===true/)
  assert.doesNotMatch(fixture, /JSON\.stringify\(\{ok:(?:true|false),/)
})
