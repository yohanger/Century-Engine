import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S11-G007-G002 · Electron embebido: puntos de volumen, Inspector, arrastre y persistencia', { timeout: 70000 }, async () => {
  await verifyWebGL({
    port: 44552,
    fixture: 'scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002.html',
    id: 'timeline-audio-volume-automation-s11-g007-g002-result',
    minChecks: 37,
    fixtureWaitMs: 40000,
  })
})
