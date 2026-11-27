// Electron real del proyecto: mismo MeshPanel, Three.js y EditSession, sin navegador externo.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('VW-E01: UI MeshPanel, tres planos, preview y geometría Three real', {timeout:60000},async()=>{
 const r=await verifyWebGL({port:44216,fixture:'scripts/fixtures/mesh/vertex-workflow-corr-g001.html',id:'vertex-workflow-corr-g001-result',minChecks:16})
 console.log('VERTEX_WORKFLOW_CORR_G001_ELECTRON',JSON.stringify({checks:r.checks.length,gl:r.gl,scope:'MeshPanel, raycasts y EditSession reales; QA humano Editor y Player por verificar'}))
})
