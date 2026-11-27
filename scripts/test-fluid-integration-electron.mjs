import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('fluidos reales: FFT costero, nodo Utilería, Inspector, partículas, Play/Stop y guardado',{timeout:120000},async()=>{
  const result=await verifyWebGL({port:44424,fixture:'scripts/fixtures/water/fluid-integration.html',id:'fluid-integration-result',minChecks:21,fixtureWaitMs:90000})
  console.log(JSON.stringify({images:result.images,warnings:result.warnings}))
})
