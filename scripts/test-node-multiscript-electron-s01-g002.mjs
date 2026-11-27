// QA real Vue/Electron para autoría multiscript, historial y compatibilidad de rendering.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('MS-UI-E01 · Inspector Vue y WebGL2 con multiscript/Undo/Redo', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44411,fixture:'scripts/fixtures/editor/node-multiscript-s01-g002.html',id:'node-multiscript-s01-g002-result',minChecks:13})
 console.log('LF_MULTISCRIPT_G002_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
