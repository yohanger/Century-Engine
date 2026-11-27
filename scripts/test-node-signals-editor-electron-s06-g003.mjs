// Interfaz Vue real en Electron embebido, sin ejecutar scripts de usuario en Edit Mode.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('UI-E01 · Inspector Signals, historial y WebGL2 Electron', {timeout:60000}, async()=>{
 const result=await verifyWebGL({port:44381,fixture:'scripts/fixtures/editor/node-signals-editor-s06-g003.html',id:'node-signals-editor-s06-g003-result',minChecks:16})
 console.log('LF_SIGNALS_EDITOR_G003_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
