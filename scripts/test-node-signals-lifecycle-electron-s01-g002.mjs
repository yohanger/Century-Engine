// QA con Electron y Jolt WASM del proyecto, sin navegador externo.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('SIG-LIFE-E01: ready temprano, Area3D Jolt WASM y WebGL2', {timeout:90000}, async()=>{
  const result=await verifyWebGL({
    port:44426,
    fixture:'scripts/fixtures/nodes/node-signals-lifecycle-s01-g002.html',
    id:'node-signals-lifecycle-s01-g002-result',
    minChecks:25,
  })
  console.log('LF_SIGNALS_LIFECYCLE_G002_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
