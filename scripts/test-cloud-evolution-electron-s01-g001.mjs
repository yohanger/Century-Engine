// QA S01-G001 · WebGL2 real en Electron, extiende la fixture existente.
import { test } from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('LF-CLOUD-EVOLUTION-S01-G001 | formación, unión, morfología y teletransporte en WebGL2', { timeout: 120000 }, async () => {
  const result = await verifyWebGL({
    port: 44634,
    fixture: 'scripts/fixtures/weather/cloud-convection.html',
    id: 'convection-result',
    minChecks: 17,
    fixtureWaitMs: 60000,
  })
  console.log(JSON.stringify(result.checks))
})
