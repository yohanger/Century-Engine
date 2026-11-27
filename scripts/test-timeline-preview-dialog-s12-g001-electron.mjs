import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S12-G001 · Electron embebido: Mostrar texto usa el UI real en el viewport', { timeout: 65000 }, async () => {
  await verifyWebGL({ port: 44547, fixture: 'scripts/fixtures/editor/timeline-preview-dialog-s12-g001.html',
    id: 'timeline-dialog-s12-g001-result', minChecks: 17, fixtureWaitMs: 30000 })
})
