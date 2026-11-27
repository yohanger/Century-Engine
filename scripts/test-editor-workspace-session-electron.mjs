import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Estado editorial real: guardado y reapertura en procesos Electron separados', async () => {
  await verifyWebGL({port:44348,fixture:'scripts/fixtures/editor/editor-workspace-session.html',id:'workspace-result',reopen:true,fixtureWaitMs:60000,minChecks:9})
})
