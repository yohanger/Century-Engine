import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G004 · ScenePanel real: limpieza, plegado y autoridad World/Bake', { timeout: 60000 }, async () => {
  await verifyWebGL({
    port: 44583,
    fixture: 'scripts/fixtures/editor/inspector-scene-ux-cleanup-s13-g004.html',
    id: 'scene-ux-s13-g004-result',
    minChecks: 36,
  })
})
