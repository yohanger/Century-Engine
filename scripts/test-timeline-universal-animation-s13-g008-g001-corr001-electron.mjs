import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G008-CORR-001 · Electron: Camera3D automática, Inspector en fila y orden de capas', { timeout: 100000 }, async () => {
  await verifyWebGL({
    port: 44623,
    fixture: 'scripts/fixtures/editor/timeline-universal-animation-s13-g008-g001-corr001.html',
    id: 'result', minChecks: 12, fixtureWaitMs: 60000,
  })
})
