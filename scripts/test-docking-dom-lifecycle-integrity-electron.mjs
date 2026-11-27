import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Destinos dinámicos y cierre de ventanas nativas conservan el DOM', {timeout:60000}, async()=>{
  await verifyWebGL({port:44343,fixture:'scripts/fixtures/editor/docking-dom-lifecycle-integrity.html',id:'dock-result',minChecks:10})
})
