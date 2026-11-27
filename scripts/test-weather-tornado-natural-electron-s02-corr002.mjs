import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TN2-C2-E01: límite vacío sin cambio de píxeles, columna visible y sin errores WebGL', {timeout:50000}, async () => {
  const data=await verifyWebGL({port:43852,fixture:'scripts/fixtures/weather/tornado-natural-s02-corr002.html',id:'natural-s02-corr002-result',minChecks:25})
  console.log('TN2_CORR002_WEBGL:',JSON.stringify({checks:data.checks.length,gl:data.gl,scope:'Fixture shader real e instrumentación diagnóstica; QA visual Editor pendiente'}))
})
