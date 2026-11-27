import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('EMS-E01: Shift en gizmo de Edit Mode y Snap modal en Electron/WebGL', { timeout: 60000 }, async () => {
  const result = await verifyWebGL({
    port: 43873,
    fixture: 'scripts/fixtures/editor/editmode-shift-snap-corr-g001.html',
    id: 'editmode-shift-snap-corr-g001-result',
    minChecks: 11,
  })
  console.log('EMS_WEBGL:', JSON.stringify({
    checks: result.checks.length, gl: result.gl,
    scope: 'Gizmo TransformControls real + Snap temporal y utilidades de modalidad; QA nativa de Shift/Pointer Lock pendiente',
  }))
})
