// QA de señales de árbol con WebGL2 y Jolt WASM dentro de Electron embebido.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('SIG-TREE-E01: catálogo, entrada, salida, Jolt WASM y WebGL2', {timeout:90000}, async()=>{
  const result=await verifyWebGL({
    port:44427,
    fixture:'scripts/fixtures/nodes/node-signals-tree-s01-g003.html',
    id:'node-signals-tree-s01-g003-result',
    minChecks:30,
  })
  console.log('LF_SIGNALS_TREE_G003_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
