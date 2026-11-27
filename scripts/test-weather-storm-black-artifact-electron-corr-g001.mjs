import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('STORM-E01 · quad base de lluvia: reproducir G-buffer original y verificar exclusión GTAO real', { timeout: 50000 }, async () => {
  const data = await verifyWebGL({ port:43838, fixture:'scripts/fixtures/weather/precip-gtao-black-corr.html', id:'precip-black-result', minChecks:12 })
  console.log('LF_PRECIP_GTAO_CORR_AUDIT:'+JSON.stringify(data.samples))
})
