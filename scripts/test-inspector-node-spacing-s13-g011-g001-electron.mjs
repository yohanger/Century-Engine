import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G011 · Inspector de nodos real: espaciado, 350/245 px, plegado y WebGL', { timeout: 60000 }, async () => {
  const result = await verifyWebGL({
    port:44572,
    fixture:'scripts/fixtures/editor/inspector-node-spacing-s13-g011-g001.html',
    id:'inspector-node-spacing-s13-g011-g001-result',
    minChecks:25,
    fixtureWaitMs:40000,
  })
  console.log('LF_INSPECTOR_NODE_SPACING_S13_G011_G001', JSON.stringify({checks:result.checks.length,scope:'InspectorDock, Inspector, CollisionShape3D, CSS real y WebGL'}))
})
