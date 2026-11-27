import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Vista de juego, luz solar, efectos de entorno, refresco y giro lateral reales en Electron', { timeout: 90000 }, async () => {
  const { midday, night, rain, directSun, yaw } = await verifyWebGL({
    port: 44401, fixture: 'scripts/fixtures/editor/play-render-corrections.html',
    id: 'play-render-corrections-result', minChecks: 25, fixtureWaitMs: 45000,
  })
  console.log(JSON.stringify({ midday, night, rain, directSun, yaw }))
})
