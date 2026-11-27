import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('Native TransformControls axis and pivot integrity in Electron', {timeout:60000}, async()=>{
 const result=await verifyWebGL({port:44192,fixture:'scripts/fixtures/editor/gizmo-axis-pivot-integrity.html',id:'gizmo-axis-pivot-integrity-result',minChecks:11})
 console.log('TRANSFORM_AXIS_INTEGRITY_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
