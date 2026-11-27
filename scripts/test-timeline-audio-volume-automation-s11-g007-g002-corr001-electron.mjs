import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S11-G007-G002 CORR001 · Electron embebido: Ctrl sobre todos los clips y creación deliberada de puntos', { timeout: 70000 }, async () => {
  await verifyWebGL({ port: 44553,
    fixture: 'scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002-corr001.html',
    id: 'timeline-audio-volume-automation-s11-g007-g002-corr001-result',
    minChecks: 32, fixtureWaitMs: 40000 })
})
