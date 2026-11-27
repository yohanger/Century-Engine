// QA de integración real: Vue, WebGL2 y Jolt WASM en Electron embebido.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('SIG-GODOT-METHOD-E01: selector de métodos, historial, WebGL2 y Jolt', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44440,fixture:'scripts/fixtures/nodes/node-signals-godot-method-picker-s05-g001.html',id:'node-signals-godot-method-picker-s05-g001-result',minChecks:48})
 console.log('LF_SIGNALS_METHOD_PICKER_S05_G001_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
