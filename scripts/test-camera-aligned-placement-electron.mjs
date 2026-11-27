import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Colocación cardinal y portapapeles en el viewport real', {timeout:90000}, async()=>{
 await verifyWebGL({port:44352,fixture:'scripts/fixtures/editor/camera-aligned-placement.html',id:'placement-result',minChecks:23,fixtureWaitMs:40000})
})
