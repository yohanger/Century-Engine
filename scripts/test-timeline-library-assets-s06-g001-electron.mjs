import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Electron S06 · biblioteca, crear/cancelar, Assets, duplicar, Undo y panel compacto', { timeout: 60000 }, async () => {
  await verifyWebGL({ port: 44461, fixture: 'scripts/fixtures/editor/timeline-library-assets-s06-g001.html', id: 'timeline-library-result', minChecks: 23 })
})
