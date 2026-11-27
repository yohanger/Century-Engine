import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TV4-E01: nube madre y embudo comparten masa y paleta en WebGL real', {timeout:50000}, async () => {
  const data=await verifyWebGL({port:43861,fixture:'scripts/fixtures/weather/tornado-natural-s04.html',id:'natural-s04-result',minChecks:19})
  console.log('TV4_WEBGL:',JSON.stringify({checks:data.checks.length,gl:data.gl,scope:'Cohesión de color, volumen y ausencia de errores; QA de amenaza/realismo requiere usuario'}))
})
