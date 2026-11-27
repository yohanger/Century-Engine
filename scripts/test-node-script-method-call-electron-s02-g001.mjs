import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('MC-E01 · Electron embebido, Three.js real y comunicación entre Scripts de Nodo',{timeout:60000},async()=>{
  const result=await verifyWebGL({port:44372,fixture:'scripts/fixtures/nodes/script-method-call-s02-g001.html',id:'script-method-call-s02-g001-result',minChecks:18})
  console.log('LF_NODE_METHOD_S02_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
