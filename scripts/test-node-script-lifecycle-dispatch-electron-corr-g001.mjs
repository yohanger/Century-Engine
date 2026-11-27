import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('LCE-01 · NodeLifecycle + Game reales, WebGL2 y señales de sesión en Electron', { timeout: 65000 }, async () => {
  const result = await verifyWebGL({
    port: 44318,
    fixture: 'scripts/fixtures/nodes/lifecycle-dispatch-corr-g001.html',
    id: 'node-lifecycle-dispatch-corr-g001-result',
    minChecks: 17,
  })
  console.log('LF_NODE_LIFECYCLE_CORR_ELECTRON', JSON.stringify({ checks: result.checks.length, gl: result.gl }))
})
