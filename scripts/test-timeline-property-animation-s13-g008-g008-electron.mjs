import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G008-G008 · Electron: Inspector/Timeline, un clic, llaves, Undo/Redo', {timeout:90000}, async () => {
  await verifyWebGL({
    port:44618,
    fixture:'scripts/fixtures/editor/timeline-inspector-keyframes-selection-s13-g008-g008.html',
    id:'lf-g008-inspector-result',
    minChecks:20,
    fixtureWaitMs:50000,
  })
})
