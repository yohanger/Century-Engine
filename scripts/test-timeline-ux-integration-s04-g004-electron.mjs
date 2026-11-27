import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · Timeline S04 integral, barra 260/400/800, scroll, cabezal, DnD e Inspector', { timeout: 75000 }, async () => {
  await verifyWebGL({ port: 44466, fixture: 'scripts/fixtures/editor/timeline-ux-integration-s04-g004.html', id: 'timeline-ux-result', minChecks: 45, fixtureWaitMs: 30000 })
})
