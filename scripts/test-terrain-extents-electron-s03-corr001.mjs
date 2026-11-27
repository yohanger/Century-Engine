import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('TEC-E01: ampliar borde mientras se arrastra cambia píxeles y cancelar restaura imagen', {timeout:60000},async()=>{
 const result=await verifyWebGL({port:44129,fixture:'scripts/fixtures/terrain/extents-s03-corr001.html',id:'terrain-extents-corr001-result',minChecks:16})
 console.log('TERRAIN_S03_CORR001_ELECTRON:',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'WebGL real y restauración visual; UI manual/Player pendientes'}))
})
