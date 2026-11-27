import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · menús contextuales y Inspector temporal 260 px', { timeout: 60000 }, async () => {
  await verifyWebGL({ port: 44461, fixture: 'scripts/fixtures/editor/temporal-context-menu-s03-g001.html', id: 'temporal-result', minChecks: 45 })
})
