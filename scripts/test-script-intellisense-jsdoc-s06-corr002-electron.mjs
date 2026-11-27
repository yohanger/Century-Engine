import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S06 CORR-002 · secuencias repetidas y sincronización en CodeMirror real', {timeout: 100000}, async () => {
  const result = await verifyWebGL({port: 44163,fixture:'scripts/fixtures/editor/script-intellisense-jsdoc-s06-corr002.html',id:'s06-corr002-result',minChecks:100,fixtureWaitMs:50000})
  console.log('S06_CORR002_ELECTRON', JSON.stringify({checks:result.checks.length,scope:'Entrada DOM CodeMirror real, sin QA visual/GPU'}))
})
