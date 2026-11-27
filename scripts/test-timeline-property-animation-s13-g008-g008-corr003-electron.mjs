import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('S13-G008-CORR-003 · Electron: claves genéricas, cámara explícita y UX de pistas', {timeout:100000}, async()=>{
  await verifyWebGL({
    port:44621,
    fixture:'scripts/fixtures/editor/timeline-property-keys-camera-drop-corr003.html',
    id:'result',minChecks:27,fixtureWaitMs:60000,
  })
})
