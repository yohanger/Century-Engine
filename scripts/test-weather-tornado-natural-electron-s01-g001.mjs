import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TN1-E01: World/CloudField/Sky organizan nubes clásicas y celdas en Electron', { timeout:50000 }, async () => {
  const data=await verifyWebGL({port:43846,fixture:'scripts/fixtures/weather/tornado-natural-s01.html',id:'natural-s01-result',minChecks:12})
  console.log('TN1_WEBGL:',JSON.stringify({checks:data.checks.length,gl:data.gl,visual:'Organización S01, no continuidad de embudo S02'}))
})
