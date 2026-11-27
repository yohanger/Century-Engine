// S00: diagnóstico de shader actual, no aceptación visual del tornado natural futuro.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TN-E-01: el SKY_FRAG heredado compila y cambia con tornado mediante Electron', {timeout:50000}, async () => {
  const audit = await verifyWebGL({port:43839,fixture:'scripts/fixtures/vfx/tornado-cohesion.html',id:'cohesion-result',minChecks:8})
  console.log(`TN-S00_DIAGNOSTIC: ${JSON.stringify({checks:audit.checks.length,gl:audit.gl,scope:'Shader heredado; NO acredita continuidad visual de nube madre ni Player'})}`)
})
