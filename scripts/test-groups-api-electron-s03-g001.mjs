import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('GP-E01: Inspector Groups + Layers en Electron y WebGL embebido', {timeout:60000},async()=>{
 const result=await verifyWebGL({port:44323,fixture:'scripts/fixtures/editor/groups-api-s03-g001.html',id:'groups-api-s03-g001-result',minChecks:16})
 console.log('GROUPS_S03_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Vue TagLayerRow, schema, registro y WebGL; QA manual Player pendiente'}))
})
