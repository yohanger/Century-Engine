import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G008-CORR-004 · Electron: jerarquía, menú anclado, foco, scroll y estado de pistas', {timeout:100000}, async()=>{
  await verifyWebGL({
    port:44622,
    fixture:'scripts/fixtures/editor/timeline-pro-ux-s13-g008-corr004.html',
    id:'result',minChecks:25,fixtureWaitMs:60000,
  })
})
