import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('TE3-E01 · Terrain rectangular real en Electron WebGL2', {timeout:60000},async()=>{
 const r=await verifyWebGL({port:44104,fixture:'scripts/fixtures/terrain/extents-s03.html',id:'terrain-extents-s03-result',minChecks:17})
 console.log('TE3-ELECTRON:',JSON.stringify({checks:r.checks.length,gl:r.gl,scope:'Geometría y serialización reales; no equivale a QA manual Editor/Player'}))
})
