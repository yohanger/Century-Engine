// G007 · QA GPU real en Electron embebido, sin navegador externo.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('G007-E01 · Camera Orchestration con Three.js/WebGL en Electron', {timeout:100000}, async () => {
  const result = await verifyWebGL({port:44497,fixture:'scripts/fixtures/player/camera-orchestration-s15-g007.html',
    id:'camera-orchestration-s15-g007-result',minChecks:20,fixtureWaitMs:50000})
  console.log('S15_G007_ELECTRON:',JSON.stringify({checks:result.checks.length,gl:result.gl,
    scope:'Render de cámara y transición en WebGL; no certifica PlayMode completo ni AppImage independiente'}))
})
