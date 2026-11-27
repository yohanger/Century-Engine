// QA gráfico del runtime con Electron y WebGL; sin navegador externo.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Tornado VISUAL · shader y formación mediante Electron', { timeout: 50000 }, async () => {
  await verifyWebGL({ port:43828, fixture:'scripts/fixtures/vfx/tornado-visual.html', id:'tornado-result', minChecks:6 })
})
