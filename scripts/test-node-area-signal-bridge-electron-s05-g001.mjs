// LF-NODE-AREA-SIGNAL-BRIDGE-S05-G001: Electron real con WebGL2 y Jolt WASM.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('AREA-E01 · Electron embebido, Jolt WASM real, Area3D y Scripts de Nodo', {timeout:60000}, async()=>{
 const result=await verifyWebGL({
  port:44375,
  fixture:'scripts/fixtures/nodes/node-area-signal-bridge-s05-g001.html',
  id:'node-area-signal-bridge-s05-g001-result',
  minChecks:21,
 })
 console.log('LF_AREA_SIGNAL_BRIDGE_S05_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
