import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('G005 · Electron embebido: UI Inspector, voz FX, Preview, Player y Mixer', { timeout: 65000 }, async () => {
  await verifyWebGL({ port: 44545, fixture: 'scripts/fixtures/editor/timeline-audio-clip-effects-s11-g005.html',
    id: 'audio-clip-effects-result', minChecks: 40, fixtureWaitMs: 30000 })
})
