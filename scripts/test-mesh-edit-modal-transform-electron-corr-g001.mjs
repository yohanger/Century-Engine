// QA real de Three.js y Vue en el Electron embebido del proyecto.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('ME-E01: Edit Mesh con ratón continuo, Snap y foco en el Inspector',{timeout:60000},async()=>{
 const result=await verifyWebGL({port:44232,fixture:'scripts/fixtures/mesh/edit-modal-transform-corr-g001.html',id:'mesh-edit-modal-corr-g001-result',minChecks:47})
 console.log('MESH_EDIT_MODAL_CORR_G001_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'EditSession y MeshPanel reales, Pointer Lock simulado'}))
})
