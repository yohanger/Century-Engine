// G003 reutiliza Electron embebido y verifica Jolt WASM, scripts, preflight y ciclo de vida.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('MS-INT-E01 · Jolt WASM, Player scriptIds y validación Build en Electron', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44413,fixture:'scripts/fixtures/nodes/node-multiscript-s01-g003.html',id:'node-multiscript-s01-g003-result',minChecks:25})
 console.log('LF_MULTISCRIPT_G003_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
test('MS-INT-E02 · Inspector Vue, historial y scriptIds', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44414,fixture:'scripts/fixtures/editor/node-multiscript-s01-g002.html',id:'node-multiscript-s01-g002-result',minChecks:13})
 console.log('LF_MULTISCRIPT_G003_UI',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
