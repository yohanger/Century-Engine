import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G008-G004 · Electron: Inspector FIFO persistente, Undo/Redo y curva temporal', {timeout:75000}, async () => {
  await verifyWebGL({
    port:44581,
    fixture:'scripts/fixtures/editor/timeline-audio-point-lifo-s13-g008-g004.html',
    id:'lf-timeline-audio-point-lifo-s13-g008-g004-result',
    minChecks:25,
    fixtureWaitMs:45000,
  })
})
