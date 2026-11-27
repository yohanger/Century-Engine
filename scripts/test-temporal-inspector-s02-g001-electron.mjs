import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · Inspector contextual de Timeline/Animación a 260 px', { timeout: 60000 }, async () => {
  await verifyWebGL({ port: 44459, fixture: 'scripts/fixtures/editor/temporal-inspector-s02-g001.html', id: 'temporal-result', minChecks: 27 })
})
