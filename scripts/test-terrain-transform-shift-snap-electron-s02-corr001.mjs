// LF-TERRAIN-TRANSFORM-S02-G001_CORR-001: QA WebGL de Terrain y TransformControls reales en Electron.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TSS-E01: Shift/Snap Terrain X/Y/Z, imán y cambio de estado en Electron', { timeout:60000 }, async()=>{
  const result=await verifyWebGL({
    port:44047,
    fixture:'scripts/fixtures/terrain/transform-shift-snap-s02-corr001.html',
    id:'terrain-shift-snap-s02-corr001-result',
    minChecks:14,
  })
  console.log('TERRAIN_SHIFT_SNAP_ELECTRON:',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Three.js/TransformControls reales; QA local de Shift y Pointer Lock nativo aún requerido'}))
})
