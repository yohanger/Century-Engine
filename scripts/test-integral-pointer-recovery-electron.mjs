import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Solicitud pendiente, cursor convencional y nueva captura nativa', {timeout:60000}, async()=>{
  await verifyWebGL({port:44345,fixture:'scripts/fixtures/editor/integral-pointer-recovery.html',id:'result',minChecks:11,focusWindow:true})
})
