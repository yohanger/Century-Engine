import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G008-CORR-001 · Electron WebGL: Inspector universal, timeline, historial y selección', { timeout: 90000 }, async () => {
  await verifyWebGL({
    port: 44619,
    fixture: 'scripts/fixtures/editor/timeline-universal-keyframes-s13-g008-corr001.html',
    id: 'lf-g008-universal-result',
    minChecks: 30,
    fixtureWaitMs: 50000,
  })
})
