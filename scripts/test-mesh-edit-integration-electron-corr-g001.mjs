import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('MEI-E01: sesión real, Snap, pintura y diagnóstico nativo de captura en Electron',{timeout:90000},async()=>{
 const result=await verifyWebGL({port:44624,fixture:'scripts/fixtures/mesh/edit-integration-corr-g001.html',id:'mesh-edit-integration-corr-g001-result',minChecks:29})
 console.log('LF_MESH_EDIT_INTEGRATION',JSON.stringify({checks:result.checks.length,gl:result.gl,pointerDiagnostic:result.pointerDiagnostic}))
})
