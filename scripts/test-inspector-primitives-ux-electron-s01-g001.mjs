import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('IP-E01: Inspector real de primitivas y materiales en Electron', {timeout:60000}, async()=>{
  const result=await verifyWebGL({port:44255,fixture:'scripts/fixtures/editor/inspector-primitives-ux-s01-g001.html',id:'inspector-primitives-ux-s01-g001-result',minChecks:15})
  console.log('INSPECTOR_PRIMITIVES_S01_ELECTRON',JSON.stringify({checks:result.checks.length,scope:'Vue Inspector real + MaterialSection + THREE WebGL; QA visual local pendiente'}))
})
