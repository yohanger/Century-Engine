import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Inspector de nodos real: ejes, materiales, scripts, historial y responsividad', { timeout: 60000 }, async () => {
  await verifyWebGL({ port: 44336, fixture: 'scripts/fixtures/editor/node-inspector-professional-ux.html', id: 'node-inspector-professional-result', minChecks: 15 })
})
