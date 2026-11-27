import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('SIG-E01 · Electron embebido, Three.js real y Custom Signals de nodos', { timeout: 60000 }, async () => {
  const result = await verifyWebGL({
    port: 44374,
    fixture: 'scripts/fixtures/nodes/node-custom-signals-s04-g001.html',
    id: 'node-custom-signals-s04-g001-result',
    minChecks: 19,
  })
  console.log('LF_NODE_CUSTOM_SIGNALS_S04_ELECTRON', JSON.stringify({ checks: result.checks.length, gl: result.gl }))
})
