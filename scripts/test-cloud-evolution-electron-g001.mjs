// QA G001, extiende la fixture WebGL2 existente sin cambiar el renderizador.
import { test } from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('LF-CLOUD-EVOLUTION-G001 | condensado, morfología y teletransporte en Electron WebGL2', { timeout: 90000 }, async () => {
  const result = await verifyWebGL({
    port: 44632,
    fixture: 'scripts/fixtures/weather/cloud-convection.html',
    id: 'convection-result',
    minChecks: 12,
    fixtureWaitMs: 40000,
  })
  console.log(JSON.stringify(result.checks))
})
