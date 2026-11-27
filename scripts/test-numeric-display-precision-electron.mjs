import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Precisión de presentación en Inspector y campos Vue', {timeout:60000}, async()=>{
  await verifyWebGL({port:44341,fixture:'scripts/fixtures/editor/numeric-display-precision.html',id:'numeric-display-result',minChecks:14,focusWindow:true})
})
