// Ejecutar en Electron embebido: Vue reactivo, WebGL2 y Jolt WASM real.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('SIG-DISC-E01 · Inspector Vue, declaración estática, WebGL2 y Jolt WASM', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44431,fixture:'scripts/fixtures/nodes/node-signals-custom-discovery-s03-g001.html',id:'node-signals-custom-discovery-s03-g001-result',minChecks:23})
 console.log('LF_SIGNALS_CUSTOM_DISCOVERY_S03_G001_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
