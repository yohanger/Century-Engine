import { test } from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Tormenta · inventario e aislamiento de geometrías en Electron', async () => {
  const data = await verifyWebGL({ port: 43831, fixture:'scripts/fixtures/weather/storm-activation.html', id:'storm-audit-result', minChecks:7 })
  console.log('LF_WEATHER_ACTIVATION_AUDIT:' + JSON.stringify(data.audit))
})
