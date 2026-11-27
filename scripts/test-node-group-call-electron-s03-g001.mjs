import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('GC-E01 · Electron embebido, Three.js real y call_group', {timeout:60000},async()=>{
  const result=await verifyWebGL({port:44373,fixture:'scripts/fixtures/nodes/node-group-call-s03-g001.html',id:'node-group-call-s03-g001-result',minChecks:18})
  console.log('LF_NODE_GROUP_S03_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
