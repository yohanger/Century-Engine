import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TN2-E01: Sky nubes y condensación, una sola marcha, cámaras inferior/superior', { timeout: 50000 }, async () => {
  const data = await verifyWebGL({port:43847,fixture:'scripts/fixtures/weather/tornado-natural-s02.html',id:'natural-s02-result',minChecks:15})
  console.log('TN2_WEBGL:', JSON.stringify({checks:data.checks.length,gl:data.gl,visual:'Volumen sin segundo compositor; QA visual Editor/Player aún requerido'}))
})
