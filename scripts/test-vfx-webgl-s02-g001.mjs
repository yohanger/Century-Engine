// QA gráfico del runtime con Electron y WebGL; sin navegador externo.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('VFX-Q07 · shader real y cámaras WebGL mediante Electron', { timeout: 50000 }, async () => {
  await verifyWebGL({ port:43827, fixture:'scripts/fixtures/vfx/webgl.html', id:'vfx-result', minChecks:10 })
})
