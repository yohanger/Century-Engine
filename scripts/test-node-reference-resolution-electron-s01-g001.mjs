import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('REF-E01 · Electron embebido, Three.js real y scripts de nodos', {timeout:60000}, async () => {
  const result=await verifyWebGL({port:44371,fixture:'scripts/fixtures/nodes/reference-resolution-s01-g001.html',id:'reference-resolution-s01-g001-result',minChecks:17})
  console.log('LF_REF_S01_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
