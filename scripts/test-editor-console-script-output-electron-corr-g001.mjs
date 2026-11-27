import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('CON-E01: Consola, scripts, UI, Signals y Player en Electron embebido',{timeout:90000},async()=>{
 const result=await verifyWebGL({port:44621,fixture:'scripts/fixtures/editor/console-script-output-corr-g001.html',id:'console-script-output-corr-g001-result',minChecks:35})
 console.log('LF_EDITOR_CONSOLE_CORR_G001',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
