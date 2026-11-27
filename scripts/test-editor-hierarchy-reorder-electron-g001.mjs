// QA Electron embebido, sin navegadores externos ni nuevo harness.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('HR-E01: SceneTree Vue real: drag/drop antes/después, Terrain y estabilidad del Transform', {timeout:60000},async()=>{
 const result=await verifyWebGL({port:44107,fixture:'scripts/fixtures/editor/hierarchy-reorder-g001.html',id:'hierarchy-reorder-g001-result',minChecks:11})
 console.log('HIERARCHY_REORDER_G001_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Jerarquía Vue/Electron; QA manual del DnD nativo, persistencia y Player pendiente'}))
})
