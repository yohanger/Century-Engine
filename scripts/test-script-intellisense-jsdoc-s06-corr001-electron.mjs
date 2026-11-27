import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S06 CORR-001 · escritura de /**/ y geometría estable al cambiar recursos en Electron', {timeout:60000}, async()=>{
  const result=await verifyWebGL({port:44159,fixture:'scripts/fixtures/editor/script-intellisense-jsdoc-s06-corr001.html',id:'script-jsdoc-corr001-result',minChecks:18})
  console.log('SCRIPT_JSDOC_S06_CORR001_ELECTRON',JSON.stringify({checks:result.checks.length,scope:'DOM CodeMirror y ventana; sin GPU ni QA visual manual'}))
})
