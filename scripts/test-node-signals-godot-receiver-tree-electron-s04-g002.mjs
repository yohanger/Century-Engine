// QA de integración en Electron embebido, Vue, WebGL2 y Jolt WASM.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('SIG-GODOT-TREE-E01: receptor contextual, vista escena, historial, WebGL2 y Jolt', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44439,fixture:'scripts/fixtures/nodes/node-signals-godot-receiver-tree-s04-g002.html',id:'node-signals-godot-receiver-tree-s04-g002-result',minChecks:43})
 console.log('LF_SIGNALS_RECEIVER_TREE_S04_G002_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
