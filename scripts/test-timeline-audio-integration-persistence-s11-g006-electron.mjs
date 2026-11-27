import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('G006 · Electron embebido: .lfproj, paquete, Audio Mixer y Player real', { timeout: 95000 }, async () => {
  await verifyWebGL({ port: 44546, fixture: 'scripts/fixtures/editor/timeline-audio-integration-persistence-s11-g006.html',
    id: 'timeline-audio-integration-result', minChecks: 20, fixtureWaitMs: 60000 })
})
