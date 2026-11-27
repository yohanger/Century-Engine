import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G008 CORR-005 · Autoría y vista previa en Timeline', {timeout:135000}, async () => {
  await verifyWebGL({
    port:44625, fixture:'scripts/fixtures/editor/timeline-authoring-s13-g008-corr005.html',
    id:'result', minChecks:22, fixtureWaitMs:90000,
  })
})
