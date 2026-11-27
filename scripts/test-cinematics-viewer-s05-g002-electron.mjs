import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · Cinematics, Assets, Inspector, clips heredados y guardado', { timeout: 75000 }, async () => {
  await verifyWebGL({ port: 44472, fixture: 'scripts/fixtures/editor/cinematics-viewer-s05-g002.html', id: 'cinematics-qa-result', minChecks: 25, fixtureWaitMs: 30000 })
})
