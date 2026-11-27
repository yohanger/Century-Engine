// Regresión CORR-001: la fixture Electron observa Web Audio nativo sin usar propiedades de mocks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./fixtures/editor/timeline-audio-clip-effects-s11-g005.html', import.meta.url), 'utf8')

test('G005-CORR001-01 · la fixture registra conexiones nativas realizadas con connect()', () => {
  assert.match(source, /const nativeConnect=AudioNode\.prototype\.connect, edges=\[\]/)
  assert.match(source, /const result=nativeConnect\.apply\(this,args\)/)
  assert.match(source, /edges\.push\(\[this,args\[0\]\]\)/)
  assert.doesNotMatch(source, /\.gain\.connections/)
})

test('G005-CORR001-02 · comprueba cada voz y el bus real sin confundirlos con los FX', () => {
  assert.match(source, /const busInput=engine\.nodes\.get\('mix-g004'\)\.input/)
  assert.match(source, /edges\.some\(\(\[from,to\]\)=>from===privateA\.gain && to===busInput\)/)
  assert.match(source, /edges\.some\(\(\[from,to\]\)=>from===privateB\.gain && to===busInput\)/)
  assert.match(source, /privateA\.clipEffects\[0\]\.fx!==privateB\.clipEffects\[0\]\.fx/)
})

test('G005-CORR001-03 · restaura connect incluso en error y respeta el contrato del runner', () => {
  assert.match(source, /} finally \{\s*AudioNode\.prototype\.connect=nativeConnect\s*\}/)
  assert.match(source, /AudioNode\.prototype\.connect===nativeConnect/)
  assert.match(source, /report\.dataset\.pass='true';report\.textContent=JSON\.stringify\(\{pass:true,checks,gl:/)
  assert.match(source, /report\.dataset\.pass='false'/)
})
