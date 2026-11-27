import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('TT2-E01: Terrain real y WebGL2 comparten traslación Y, alturas, raycast y guardado', {timeout:60000},async()=>{
 const result=await verifyWebGL({port:44021,fixture:'scripts/fixtures/terrain/transform-s02.html',id:'terrain-transform-s02-result',minChecks:14})
 console.log('TERRAIN_TRANSFORM_S02_ELECTRON:',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'QA Electron real sobre Terrain; Play/Jolt y Player exportado requieren QA local'}))
})
