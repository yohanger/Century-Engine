import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('SIGNALS-S07: paquete Player real, escenas, señales, WebGL2 y Jolt WASM', { timeout:90000 }, async () => {
  const result=await verifyWebGL({port:44447,fixture:'scripts/fixtures/nodes/node-signals-integration-s07-g001.html',id:'node-signals-integration-s07-g001-result',minChecks:27})
  console.log('LF_SIGNALS_INTEGRATION_S07_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
