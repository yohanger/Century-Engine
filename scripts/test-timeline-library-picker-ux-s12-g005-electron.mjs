import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S12-G005 · Electron embebido: selector compacto, búsqueda, foco y navegación real', { timeout: 85000 }, async () => {
  await verifyWebGL({ port:44551,
    fixture:'scripts/fixtures/editor/timeline-library-picker-ux-s12-g005.html',
    id:'timeline-library-picker-ux-s12-g005-result',minChecks:32,fixtureWaitMs:55000 })
})
