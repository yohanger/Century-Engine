import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · FilmMaker .nfm → importación → Cinematics → paquete y runtime Player', { timeout: 100000 }, async () => {
  await verifyWebGL({ port: 44474, fixture: 'scripts/fixtures/editor/cinematics-player-integration-s05-g004.html', id: 'cinematics-player-result', minChecks: 28, fixtureWaitMs: 50000 })
})
