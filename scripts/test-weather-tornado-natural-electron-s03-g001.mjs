import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TN3-E01: polvo VFX genérico sin recursos, suelo/agua y Play/Stop en WebGL', {timeout:50000}, async () => {
  const data=await verifyWebGL({port:43859,fixture:'scripts/fixtures/weather/tornado-natural-s03.html',id:'natural-s03-result',minChecks:13})
  console.log('TN3_WEBGL:',JSON.stringify({checks:data.checks.length,gl:data.gl,scope:'Materiales explícitos; falta QA visual Editor/Player'}))
})
