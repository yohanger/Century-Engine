import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G002 · plegado global real: migración, teclado, controles y selección', {timeout:60000}, async () => {
  const result = await verifyWebGL({
    port:44569,
    fixture:'scripts/fixtures/editor/inspector-global-folding-s13-g002.html',
    id:'inspector-global-folding-s13-g002-result',
    minChecks:23,
    fixtureWaitMs:40000,
  })
  console.log('LF_INSPECTOR_FOLDING_S13_G002', JSON.stringify({checks:result.checks.length,scope:'InspectorDock y Inspector reales + WebGL'}))
})
