// S06-G002: integración Electron WebGL2 con Jolt WASM y conexiones editoriales persistidas.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('PERSIST-E01 · Electron embebido, Jolt real y activación posterior a _ready', {timeout:60000}, async()=>{
 const result=await verifyWebGL({
  port:44377,
  fixture:'scripts/fixtures/nodes/node-signals-editor-s06-g002.html',
  id:'node-signals-editor-s06-g002-result',
  minChecks:21,
 })
 console.log('LF_SIGNALS_EDITOR_G002_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
