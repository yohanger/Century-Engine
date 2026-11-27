// QA real en Electron/WebGL2. Node PASS no sustituye este runner ni el QA visual del editor.
import { test } from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('LF-EDITOR-VIEWMODES-S01-G001 | vistas sobre geometría y shaders GPU reales', {timeout:120000}, async () => {
  const result=await verifyWebGL({port:44670,fixture:'scripts/fixtures/render/view-modes-g001.html',id:'viewmodes-result',minChecks:25,fixtureWaitMs:65000})
  console.log(JSON.stringify(result.checks))
})
