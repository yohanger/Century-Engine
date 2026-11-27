import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Integridad editorial: captura, campo numérico, cámara, UV y persistencia', { timeout:60000 }, async()=>{
  await verifyWebGL({port:44337,fixture:'scripts/fixtures/editor/editor-numeric-pointer-integrity.html',id:'editor-numeric-pointer-integrity-result',minChecks:15})
})
