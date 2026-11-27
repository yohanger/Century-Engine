import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('SIGN-E01: entrada numérica nativa, dispatcher y EditSession reales',{timeout:90000},async()=>{
 const result=await verifyWebGL({port:44625,fixture:'scripts/fixtures/mesh/numeric-sign-corr-g001.html',id:'mesh-numeric-sign-corr-g001-result',minChecks:53})
 console.log('LF_MESH_NUMERIC_SIGN',JSON.stringify({checks:result.checks.length,gl:result.gl,nativeKeys:result.nativeKeys}))
})
