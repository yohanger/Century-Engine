// Entrada nativa comparativa de CodeMirror, sin navegador externo.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S06 CORR-004 · núcleo CodeMirror aislado vs Script Editor integrado', async () => {
  await verifyWebGL({
    port: 44189,
    fixture: 'scripts/fixtures/editor/script-editor-core-s06-corr004.html',
    id: 's06-corr004-result',
    fixtureWaitMs: 60000,
    minChecks: 200,
  })
})
