import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Los chunks vinculados se seleccionan, transforman, guardan y deshacen desde la escena madre', { timeout: 90000 }, async () => {
  await verifyWebGL({
    port: 44426,
    fixture: 'scripts/fixtures/editor/streaming-preview.html',
    id: 'streaming-preview-result',
    minChecks: 17,
    fixtureWaitMs: 45000,
  })
})
