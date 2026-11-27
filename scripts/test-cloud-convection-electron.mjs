import { test } from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('condensación y evaporación de una unión de cúmulos en WebGL2', { timeout: 90000 }, async () => {
  const result = await verifyWebGL({
    port: 44632,
    fixture: 'scripts/fixtures/weather/cloud-convection.html',
    id: 'convection-result',
    minChecks: 9,
    fixtureWaitMs: 40000,
  })
  console.log(JSON.stringify(result.checks))
})
