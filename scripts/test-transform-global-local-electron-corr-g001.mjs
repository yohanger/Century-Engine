// Electron embebido del editor: Three.js real, gizmo real, escena con padre rotado.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('GL-E01: Global/Local y posición local/world en Electron WebGL2', {timeout:60000}, async()=>{
 const result=await verifyWebGL({port:44181,fixture:'scripts/fixtures/editor/transform-global-local-corr-g001.html',id:'transform-global-local-corr-g001-result',minChecks:16})
 console.log('GLOBAL_LOCAL_CORR_G001_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Three real/TransformControls; QA manual de ratón y Player adicional'}))
})
