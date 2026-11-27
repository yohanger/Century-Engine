import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('cielo especializado: equivalencia HDR y transiciones en WebGL real',{timeout:120000},async()=>{
 const result=await verifyWebGL({port:44677,fixture:'scripts/fixtures/render/sky-variants.html',id:'sky-variants-result',minChecks:27,fixtureWaitMs:90000})
 console.log(JSON.stringify(result.comparisons))
})
