import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Editor y runtime exportado usan la visibilidad estática horneada en WebGL2', { timeout: 90000 }, async () => {
  const result = await verifyWebGL({
    port: 44390, fixture: 'scripts/fixtures/editor/static-occlusion.html', id: 'static-occlusion-result',
    minChecks: 17, fixtureWaitMs: 45000,
  })
  console.log(JSON.stringify({ gpu: result.gpu, enabled: result.on, disabled: result.off }))
})
