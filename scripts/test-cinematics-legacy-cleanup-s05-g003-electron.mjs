import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · eliminar Timeline/Cinematics en Assets, Inspector y compatibilidad Player', { timeout: 75000 }, async () => {
  await verifyWebGL({ port: 44473, fixture: 'scripts/fixtures/editor/cinematics-legacy-cleanup-s05-g003.html', id: 'cinematics-legacy-result', minChecks: 30, fixtureWaitMs: 30000 })
})
