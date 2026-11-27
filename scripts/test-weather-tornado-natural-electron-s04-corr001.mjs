import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TC4-E01: descenso continuo, embudo y nube madre en WebGL Electron', {timeout:50000}, async () => {
  const data=await verifyWebGL({port:43863,fixture:'scripts/fixtures/weather/tornado-natural-s04.html',id:'natural-s04-result',minChecks:24})
  console.log('TC4_WEBGL:',JSON.stringify({checks:data.checks.length,gl:data.gl,scope:'Shader real; oclusión y realismo final requieren QA de escena'}))
})
