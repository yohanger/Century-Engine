import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TA2-E01: tormenta, disco solar y niebla angular con shader real en Electron', {timeout:50000}, async()=>{
  const data=await verifyWebGL({port:43864,fixture:'scripts/fixtures/weather/tornado-natural-s04-corr002.html',id:'natural-s04-corr002-result',minChecks:29})
  console.log('TA2_WEBGL', JSON.stringify({checks:data.checks.length,gl:data.gl,scope:'Shader real; pendiente QA visual Editor/Player'}))
})
