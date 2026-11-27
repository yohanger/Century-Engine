import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('PSX temporal: material real, cámara inmóvil y comparación de fotogramas',{timeout:90000},async()=>{
 const r=await verifyWebGL({port:44347,fixture:'scripts/fixtures/render/psx-temporal.html',id:'psx-result',minChecks:54,fixtureWaitMs:45000})
 console.log('PSX_TEMPORAL_METRICS',JSON.stringify(r.metrics))
})
