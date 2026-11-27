// QA gráfico del runtime con Electron y WebGL; sin navegador externo.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Tornado COHESION · nubes y embudo mediante Electron', { timeout: 50000 }, async () => {
  await verifyWebGL({ port:43829, fixture:'scripts/fixtures/vfx/tornado-cohesion.html', id:'cohesion-result', minChecks:6 })
})
