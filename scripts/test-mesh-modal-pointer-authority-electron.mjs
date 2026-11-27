import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Confirmación y cancelación en Edit Mesh con entradas nativas y fallback',{timeout:90000},async()=>{
  await verifyWebGL({port:44346,fixture:'scripts/fixtures/editor/mesh-modal-pointer-authority.html',id:'mesh-modal-result',minChecks:20,focusWindow:true,fixtureWaitMs:45000})
})
