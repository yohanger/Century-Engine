import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G008-CORR-002 · Electron: Camera3D, nodo, propiedades, selección y carriles', {timeout:95000}, async()=>{
  await verifyWebGL({
    port:44620,
    fixture:'scripts/fixtures/editor/timeline-node-track-hierarchy-s13-g008-corr002.html',
    id:'result',minChecks:24,fixtureWaitMs:55000,
  })
})
