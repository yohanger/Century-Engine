import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Inspector de escena real: búsqueda, pliegues, hora y responsividad', { timeout: 60000 }, async () => {
  await verifyWebGL({ port: 44335, fixture: 'scripts/fixtures/editor/scene-inspector-professional-ux.html', id: 'scene-inspector-professional-result', minChecks: 19 })
})
