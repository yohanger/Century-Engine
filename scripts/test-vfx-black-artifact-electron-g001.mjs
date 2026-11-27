import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('VBQ-08 · VFX sin rectángulo de oclusión GTAO (Electron/WebGL)', { timeout: 50000 }, async () => {
  await verifyWebGL({ port: 43836, fixture: 'scripts/fixtures/vfx/black-artifact.html', id: 'black-qa-result', minChecks: 7 })
})
