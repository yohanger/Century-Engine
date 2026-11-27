// QA en Electron embebido: CodeMirror + scripts Global/Nodo + JSDoc, sin GPU externa.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('JSDOC-E01 · anotaciones de tipos en CodeMirror y Script Editor real', { timeout: 60000 }, async () => {
  const result = await verifyWebGL({ port: 44158, fixture: 'scripts/fixtures/editor/script-intellisense-jsdoc-s06-g001-integral.html', id: 'script-intellisense-s06-result', minChecks: 16 })
  console.log('SCRIPT_JSDOC_S06_ELECTRON', JSON.stringify({checks:result.checks.length,scope:'CodeMirror y Vue; sin GPU ni QA visual manual'}))
})
