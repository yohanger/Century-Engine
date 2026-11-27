import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Century Code conserva un espacio profesional cuando el proyecto no tiene scripts', { timeout: 60000 }, async () => {
  await verifyWebGL({
    port: 44639,
    fixture: 'scripts/fixtures/editor/century-code-welcome.html',
    id: 'century-code-welcome-result',
    minChecks: 5,
  })
})

test('Century Code aplica el rediseño profesional al documento activo', { timeout: 60000 }, async () => {
  await verifyWebGL({
    port: 44640,
    fixture: 'scripts/fixtures/editor/century-code-welcome.html?active=1',
    id: 'century-code-welcome-result',
    minChecks: 7,
  })
})
