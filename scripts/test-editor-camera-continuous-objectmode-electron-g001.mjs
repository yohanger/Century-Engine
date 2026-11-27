// LF-EDITOR-CAMERA-CONTINUOUS-OBJECTMODE-G001: fixture real de OrbitControls en ambos modos.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('OCG-E01: Object Mode y Edit Mode comparten navegación continua sin afectar Play', { timeout: 60000 }, async () => {
  const result = await verifyWebGL({
    port: 43879,
    fixture: 'scripts/fixtures/editor/camera-continuous-grab-g001.html',
    id: 'camera-continuous-grab-g001-result',
    minChecks: 16,
  })
  console.log('OCG_WEBGL:', JSON.stringify({
    checks: result.checks.length,
    gl: result.gl,
    scope: 'OrbitControls oficial y cursor virtual; Pointer Lock simulado. QA nativo de Editor en Linux/Windows pendiente.',
  }))
})
