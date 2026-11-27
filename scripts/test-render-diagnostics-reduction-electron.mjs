import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('LOD, GLSL activo, lotes mixtos y profundidad del cielo en WebGL real',{timeout:120000},async()=>{
 const result=await verifyWebGL({port:44672,fixture:'scripts/fixtures/render/diagnostics-reduction-regression.html',id:'diagnostics-reduction-result',minChecks:12,fixtureWaitMs:65000})
 console.log(JSON.stringify(result.checks))
})
