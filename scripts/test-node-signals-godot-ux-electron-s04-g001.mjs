// QA interactivo en Electron embebido con Vue, WebGL2 y Jolt WASM reales.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('SIG-GODOT-UX-E01: árbol, diálogo, historial y Jolt en Electron', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44435,fixture:'scripts/fixtures/nodes/node-signals-godot-ux-s04-g001.html',id:'node-signals-godot-ux-s04-g001-result',minChecks:28})
 console.log('LF_SIGNALS_GODOT_UX_S04_G001_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
