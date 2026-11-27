import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S06 CORR-003 · índice estable y comentarios mediante CodeMirror real en Electron', { timeout:90000 }, async () => {
  const result=await verifyWebGL({
    port:44167,
    fixture:'scripts/fixtures/editor/script-intellisense-jsdoc-s06-corr003.html',
    id:'s06-corr003-result',
    minChecks:60,
    fixtureWaitMs:45000,
  })
  console.log('S06_CORR003_ELECTRON',JSON.stringify({checks:result.checks.length,scope:'CodeMirror y Vue reales; QA visual separado'}))
})
