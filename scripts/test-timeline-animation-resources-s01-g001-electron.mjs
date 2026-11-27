import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron · recursos temporales de Assets, edición y reapertura', { timeout: 60000 }, async () => {
  await verifyWebGL({
    port: 44458,
    fixture: 'scripts/fixtures/editor/timeline-animation-resources-s01-g001.html',
    id: 'temporal-result',
    minChecks: 20,
  })
})
