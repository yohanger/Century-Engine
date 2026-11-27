import { test } from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('nubes, luna y haces del visor WebGL', { timeout: 90000 }, async () => {
  const result = await verifyWebGL({
    port: 44629,
    fixture: 'scripts/fixtures/weather/cloud-light.html',
    id: 'cloud-light-result',
    minChecks: 20,
    fixtureWaitMs: 40000,
  })
  console.log(JSON.stringify(result.checks))
})
